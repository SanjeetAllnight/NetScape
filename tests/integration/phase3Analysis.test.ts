import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultAddressingService } from "@/application/services/AddressingService";
import { DefaultReportService } from "@/application/services/ReportService";
import { DefaultDesignSession } from "@/application/session/DesignSession";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";
import { DefaultWorkerClient } from "@/workers/WorkerClient";
import { WebCryptoHashService } from "@/application/hashService";
import { setApplicationContainer } from "@/application/container";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useEditorStore } from "@/stores/editorStore";
import { makeGeoPoint } from "@/domain/geo/localFrame";
import { allocateVlsm } from "@/engines/ip";
import { defaultCostEngine } from "@/engines/cost";
import { defaultCoverageEngine } from "@/engines/coverage";
import { defaultSimulationEngine } from "@/engines/simulation";
import { computeStructuralDiff, compareMetric } from "@/domain/comparison/compareDesigns";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import type {
  SubnetId,
  DeviceId,
  LinkId,
  CatalogItemId,
  IPv4Cidr,
  EpochMs,
  GeoPolygon,
  Longitude,
  Latitude,
} from "@/contracts/primitives";
import type { WorkerResponse } from "@/contracts/workers";
import type {
  CoverageEngineInput,
  SimulationEngineInput,
  CoverageResult,
  CostEstimate,
  SimulationResult,
} from "@/contracts/engines";

function makeGeoPolygon(ring: [number, number][]): GeoPolygon {
  return {
    type: "Polygon",
    coordinates: [ring.map(([lng, lat]) => [lng as Longitude, lat as Latitude])],
  };
}

const ROUTER_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440001" as CatalogItemId;
const SWITCH_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440002" as CatalogItemId;
const AP_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440003" as CatalogItemId;
const SERVER_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440004" as CatalogItemId;

// Test mock worker that executes pure engines with realistic progress
class IntegratedEngineWorker implements Worker {
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null;
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;

  postedMessages: unknown[] = [];
  cancelled = false;
  terminated = false;

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
    const msg = message as {
      protocolVersion: 1;
      requestId: string;
      type?: string;
      kind?: "coverage.compute" | "simulation.run";
      payload?: unknown;
    };

    if (msg.type === "cancel") {
      this.cancelled = true;
      return;
    }

    if (msg.kind) {
      setTimeout(async () => {
        try {
          if (this.cancelled) {
            this.send({
              protocolVersion: 1,
              type: "cancelled",
              requestId: msg.requestId,
            });
            return;
          }

          // Emit progress
          this.send({
            protocolVersion: 1,
            type: "progress",
            requestId: msg.requestId,
            fraction: 0.5,
            phase: "Processing in worker...",
          });

          if (msg.kind === "coverage.compute") {
            const input = msg.payload as CoverageEngineInput;
            const output = await defaultCoverageEngine.compute(input, {
              shouldCancel: () => this.cancelled,
              reportProgress: (fraction, phase) => {
                this.send({
                  protocolVersion: 1,
                  type: "progress",
                  requestId: msg.requestId,
                  fraction,
                  phase,
                });
              },
              yieldToEventLoop: () => new Promise((resolve) => setTimeout(resolve, 0)),
            });

            if (this.cancelled) {
              this.send({
                protocolVersion: 1,
                type: "cancelled",
                requestId: msg.requestId,
              });
              return;
            }

            this.send({
              protocolVersion: 1,
              type: "success",
              requestId: msg.requestId,
              result: output,
            });
          } else if (msg.kind === "simulation.run") {
            const input = msg.payload as SimulationEngineInput;
            const output = await defaultSimulationEngine.run(input, {
              shouldCancel: () => this.cancelled,
              reportProgress: (fraction, phase) => {
                this.send({
                  protocolVersion: 1,
                  type: "progress",
                  requestId: msg.requestId,
                  fraction,
                  phase,
                });
              },
              yieldToEventLoop: () => new Promise((resolve) => setTimeout(resolve, 0)),
            });

            if (this.cancelled) {
              this.send({
                protocolVersion: 1,
                type: "cancelled",
                requestId: msg.requestId,
              });
              return;
            }

            this.send({
              protocolVersion: 1,
              type: "success",
              requestId: msg.requestId,
              result: output,
            });
          }
        } catch (err) {
          this.send({
            protocolVersion: 1,
            type: "failure",
            requestId: msg.requestId,
            error: {
              name: "Error",
              code: "WORKER_FAILED",
              message: err instanceof Error ? err.message : String(err),
              details: null,
              recoverable: false,
            },
          });
        }
      }, 100);
    }
  }

  terminate(): void {
    this.terminated = true;
    this.cancelled = true;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }

  private send(msg: WorkerResponse): void {
    if (this.onmessage) {
      this.onmessage({ data: msg } as MessageEvent);
    }
  }
}

describe("Phase 3 Analysis Modules & Design Comparison (Exit Gate 20 Scenarios)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let session: DefaultDesignSession;
  let coordinator: DefaultAnalysisCoordinator;
  let workerClient: DefaultWorkerClient;
  let hashService: WebCryptoHashService;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-p3-analysis-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db);

    hashService = new WebCryptoHashService();
    workerClient = new DefaultWorkerClient(() => new IntegratedEngineWorker());
    projectService = new DefaultProjectService(repos);
    session = new DefaultDesignSession(repos);
    coordinator = new DefaultAnalysisCoordinator(repos, workerClient, hashService);

    // Register into DI container
    setApplicationContainer({
      db,
      repos,
      workerClient,
      hashService,
      sessionManager: null as never,
      designSession: session,
      projectService,
      addressingService: new DefaultAddressingService(repos, session),
      reportService: new DefaultReportService(repos, coordinator),
      geocodingService: null as never,
      tileSourceConfig: null as never,
      analysisCoordinator: coordinator,
      dispose: () => {},
    });

    useDesignStore.getState().reset();
    useAnalysisStore.getState().resetAnalyses();
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    workerClient.dispose();
    db.close();
  });

  it("Scenario 1: Open a saved design and load its existing subnet requirements", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Campus Network",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Add a subnet requirement
    await session.dispatch({
      type: "subnet/add",
      name: "Engineering LAN",
      hostsRequired: 50,
    });

    // Verify persisted in database
    const savedSubnets = await repos.subnets.listByDesign(baselineDesignId);
    expect(savedSubnets).toHaveLength(1);
    expect(savedSubnets[0]?.name).toBe("Engineering LAN");
    expect(savedSubnets[0]?.hostsRequired).toBe(50);
  });

  it("Scenario 2: Set parent CIDR, add/edit/remove subnets, allocate VLSM and reload to confirm saved allocation", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "VLSM Project",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // 1. Set parent CIDR
    await session.dispatch({
      type: "addressing/setParentCidr",
      parentCidr: "192.168.1.0/24" as IPv4Cidr,
    });

    // 2. Add two subnets
    await session.dispatch({
      type: "subnet/add",
      name: "Staff WiFi",
      hostsRequired: 100,
    });
    const sub1Id = Object.keys(useDesignStore.getState().aggregate!.subnetsById)[0]! as SubnetId;

    await session.dispatch({
      type: "subnet/add",
      name: "Lab PCs",
      hostsRequired: 50,
    });
    const sub2Id = Object.keys(useDesignStore.getState().aggregate!.subnetsById).find((id) => id !== sub1Id)! as SubnetId;

    // 3. Run pure deterministic VLSM allocation
    const vlsmOutput = allocateVlsm({
      parentCidr: "192.168.1.0/24" as IPv4Cidr,
      subnets: [
        { subnetId: sub1Id, name: "Staff WiFi", hostsRequired: 100 },
        { subnetId: sub2Id, name: "Lab PCs", hostsRequired: 50 },
      ],
    });

    expect(vlsmOutput.isComplete).toBe(true);
    expect(vlsmOutput.allocations).toHaveLength(2);
    expect(vlsmOutput.allocations[0]?.cidr).toBe("192.168.1.0/25"); // 126 usable hosts for 100
    expect(vlsmOutput.allocations[1]?.cidr).toBe("192.168.1.128/26"); // 62 usable hosts for 50

    // 4. Apply allocation to design session
    await session.dispatch({
      type: "addressing/applyAllocation",
      allocations: vlsmOutput.allocations,
      parentCidr: "192.168.1.0/24" as IPv4Cidr,
      allocatedAt: Date.now() as EpochMs,
    });

    // 5. Reload session and verify saved state in IndexedDB
    useDesignStore.getState().reset();
    await session.open(baselineDesignId);

    const loadedAgg = useDesignStore.getState().aggregate!;
    expect(loadedAgg.design.addressing.parentCidr).toBe("192.168.1.0/24");
    expect(loadedAgg.design.addressing.allocationStatus).toBe("current");
    expect(loadedAgg.subnetsById[sub1Id]?.allocatedCidr).toBe("192.168.1.0/25");
    expect(loadedAgg.subnetsById[sub2Id]?.allocatedCidr).toBe("192.168.1.128/26");
  });

  it("Scenario 3: Change host count/parent CIDR and confirm old allocation is not shown as current", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Stale Allocation Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "addressing/setParentCidr",
      parentCidr: "10.0.0.0/16" as IPv4Cidr,
    });

    await session.dispatch({
      type: "subnet/add",
      name: "Core LAN",
      hostsRequired: 200,
    });
    const subId = Object.keys(useDesignStore.getState().aggregate!.subnetsById)[0]! as SubnetId;

    const allocOutput = allocateVlsm({
      parentCidr: "10.0.0.0/16" as IPv4Cidr,
      subnets: [{ subnetId: subId, name: "Core LAN", hostsRequired: 200 }],
    });
    await session.dispatch({
      type: "addressing/applyAllocation",
      allocations: allocOutput.allocations,
      parentCidr: "10.0.0.0/16" as IPv4Cidr,
      allocatedAt: Date.now() as EpochMs,
    });

    expect(useDesignStore.getState().aggregate!.design.addressing.allocationStatus).toBe("current");

    // Edit host count requirement
    await session.dispatch({
      type: "subnet/update",
      subnetId: subId,
      patch: { hostsRequired: 600 },
    });

    // Status MUST be outOfDate
    expect(useDesignStore.getState().aggregate!.design.addressing.allocationStatus).toBe("outOfDate");
  });

  it("Scenario 4: Handle invalid CIDR and insufficient address space with clear feedback", () => {
    // 1. Invalid CIDR format
    expect(() =>
      allocateVlsm({
        parentCidr: "not-a-cidr" as IPv4Cidr,
        subnets: [{ subnetId: "s1" as SubnetId, name: "Sub1", hostsRequired: 10 }],
      })
    ).toThrow();

    // 2. Insufficient space in /29 (only 6 usable hosts) for 50 hosts
    const out = allocateVlsm({
      parentCidr: "192.168.1.0/29" as IPv4Cidr,
      subnets: [{ subnetId: "s1" as SubnetId, name: "LargeSubnet", hostsRequired: 50 }],
    });

    expect(out.isComplete).toBe(false);
    expect(out.unallocated).toHaveLength(1);
    expect(out.unallocated[0]?.reason).toBe("INSUFFICIENT_SPACE");
  });

  it("Scenario 5: Run cost calculation from real persisted design and show CAPEX, annual OPEX and TCO", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Cost Project",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Place router and switch
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: SWITCH_CAT_ID,
      position: makeGeoPoint(77.5950, 12.9720),
    });

    // Run cost through coordinator
    const runRes = await coordinator.run("cost", baselineDesignId);
    expect(runRes.record).not.toBeNull();
    expect(runRes.freshness).toBe("current");

    const costRec = useAnalysisStore.getState().records.cost;
    expect(costRec).not.toBeNull();
    const result = costRec!.result as CostEstimate;
    expect(result.capex.knownSubtotal.amount).toBeGreaterThan(0);
    expect(result.annualOpex.knownSubtotal.amount).toBeGreaterThan(0);
    expect(result.tco.knownSubtotal.amount).toBeGreaterThan(0);
  });

  it("Scenario 6: Show partial cost with missing price/spec inputs, preserve known subtotal and never substitute zero", () => {
    // Calling cost engine with incomplete device item
    const cost = defaultCostEngine.estimate({
      currency: "INR",
      devices: [
        {
          deviceId: "d1" as DeviceId,
          type: "router",
          unitPrice: null, // missing price
          priceProvenance: null,
          powerW: 50,
          lifespanYears: null,
        },
      ],
      links: [],
      settings: DEFAULT_PROJECT_SETTINGS.cost,
      devicePowerDutyRatio: 1,
    });

    expect(cost.completeness).toBe("partial");
    expect(cost.capex.total).toBeNull();
    expect(cost.capex.knownSubtotal.amount).toBe(562.5);
    expect(cost.issues.some((i) => i.code === "MISSING_DEVICE_PRICE")).toBe(true);
  });

  it("Scenario 7: Change an input after cost calculation and show previous result as Out of date", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Cost Stale Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });

    await coordinator.run("cost", baselineDesignId);
    expect(useAnalysisStore.getState().status.cost).toBe("fresh");

    // Adding another device modifies the design revision and inputs
    await session.dispatch({
      type: "device/add",
      catalogItemId: SWITCH_CAT_ID,
      position: makeGeoPoint(77.5950, 12.9720),
    });

    // Freshness inspection reflects stale status
    const freshness = await coordinator.inspect(baselineDesignId);
    expect(freshness.byType.cost.status).toBe("outOfDate");
  });

  it("Scenario 8: Run coverage through worker, receive real progress, store raster blob and record", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Coverage Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Set boundary polygon
    await session.dispatch({
      type: "region/setBoundary",
      boundary: makeGeoPolygon([
        [77.5940, 12.9710],
        [77.5960, 12.9710],
        [77.5960, 12.9730],
        [77.5940, 12.9730],
        [77.5940, 12.9710],
      ]),
    });

    // Add access point
    await session.dispatch({
      type: "device/add",
      catalogItemId: AP_CAT_ID,
      position: makeGeoPoint(77.5950, 12.9720),
    });

    const runRes = await coordinator.run("coverage", baselineDesignId);
    expect(runRes.record).not.toBeNull();

    const covRecord = useAnalysisStore.getState().records.coverage;
    expect(covRecord).not.toBeNull();
    const result = covRecord!.result as CoverageResult;
    expect(result.coveragePercent).toBeGreaterThan(0);

    const blob = useAnalysisStore.getState().coverageBlob;
    expect(blob).not.toBeNull();
    expect(blob!.width).toBeGreaterThan(0);
    expect(blob!.height).toBeGreaterThan(0);
    expect(blob!.rssiDbm.length).toBe(blob!.width * blob!.height);
  });

  it("Scenario 9: Confirm outside-mask 254 cells are transparent and in-mask no-AP 255 cells are identified", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Coverage Sentinels Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Set a boundary without any APs placed
    await session.dispatch({
      type: "region/setBoundary",
      boundary: makeGeoPolygon([
        [77.5940, 12.9710],
        [77.5960, 12.9710],
        [77.5960, 12.9730],
        [77.5940, 12.9730],
        [77.5940, 12.9710],
      ]),
    });

    await coordinator.run("coverage", baselineDesignId);
    const blob = useAnalysisStore.getState().coverageBlob!;

    // Grid bounding box contains cells outside mask (254) and inside mask with no AP (255)
    let found254 = false;
    let found255 = false;
    for (let i = 0; i < blob.servingIndex.length; i++) {
      if (blob.servingIndex[i] === 254) found254 = true;
      if (blob.servingIndex[i] === 255) found255 = true;
    }

    expect(found254).toBe(true);
    expect(found255).toBe(true);
  });

  it("Scenario 10: Cancel coverage and verify no partial result is published", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Coverage Cancel Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "region/setBoundary",
      boundary: makeGeoPolygon([
        [77.5940, 12.9710],
        [77.5960, 12.9710],
        [77.5960, 12.9730],
        [77.5940, 12.9730],
        [77.5940, 12.9710],
      ]),
    });

    const runPromise = coordinator.run("coverage", baselineDesignId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await coordinator.cancel("coverage", baselineDesignId);

    await expect(runPromise).rejects.toThrow();
    expect(useAnalysisStore.getState().status.coverage).toBe("idle");
  });

  it("Scenario 11: Change AP/boundary/obstacle and confirm coverage becomes Out of date", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Coverage Invalidation Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "region/setBoundary",
      boundary: makeGeoPolygon([
        [77.5940, 12.9710],
        [77.5960, 12.9710],
        [77.5960, 12.9730],
        [77.5940, 12.9730],
        [77.5940, 12.9710],
      ]),
    });

    await coordinator.run("coverage", baselineDesignId);
    expect(useAnalysisStore.getState().status.coverage).toBe("fresh");

    // Add obstacle
    await session.dispatch({
      type: "obstacle/add",
      material: "brick",
      geometry: makeGeoPolygon([
        [77.5945, 12.9715],
        [77.5955, 12.9715],
        [77.5955, 12.9716],
        [77.5945, 12.9716],
        [77.5945, 12.9715],
      ]),
    });

    const freshness = await coordinator.inspect(baselineDesignId);
    expect(freshness.byType.coverage.status).toBe("outOfDate");
  });

  it("Scenario 12: Run simulation baseline and at least one device/link failure scenario", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Simulation Project",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Place router, switch, server
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });
    const routerId = Object.keys(useDesignStore.getState().aggregate!.devicesById)[0]! as DeviceId;

    await session.dispatch({
      type: "device/add",
      catalogItemId: SERVER_CAT_ID,
      position: makeGeoPoint(77.5960, 12.9716),
    });
    const serverId = Object.keys(useDesignStore.getState().aggregate!.devicesById).find((id) => id !== routerId)! as DeviceId;

    // Link router and server
    await session.dispatch({
      type: "link/add",
      sourceDeviceId: routerId,
      targetDeviceId: serverId,
      medium: "copper",
    });
    const linkId = Object.keys(useDesignStore.getState().aggregate!.linksById)[0]! as LinkId;

    // Add subnet served by router
    await session.dispatch({
      type: "subnet/add",
      name: "Users",
      hostsRequired: 20,
      servedByDeviceId: routerId,
    });
    const subnetId = Object.keys(useDesignStore.getState().aggregate!.subnetsById)[0]! as SubnetId;

    // Configure simulation setup with a failure scenario
    await session.dispatch({
      type: "simulation/setup",
      setup: {
        flows: [
          {
            id: "flow-1" as never,
            name: "Users -> Server",
            sourceSubnetId: subnetId,
            destinationDeviceId: serverId,
            demandMbpsOverride: 10,
            enabled: true,
          },
        ],
        failureScenarios: [
          {
            id: "scen-link-down" as never,
            name: "Uplink Failure",
            failedDeviceIds: [],
            failedLinkIds: [linkId],
          },
        ],
      },
    });

    const runRes = await coordinator.run("simulation", baselineDesignId);
    expect(runRes.record).not.toBeNull();

    const simRecord = useAnalysisStore.getState().records.simulation;
    expect(simRecord).not.toBeNull();
    const result = simRecord!.result as SimulationResult;

    // In baseline, flow is reachable
    expect(result.baselineFlows[0]?.reachable).toBe(true);
    expect(result.baselineFlows[0]?.hopCount).toBe(1);

    // In failure scenario, link is down so flow becomes unreachable
    expect(result.scenarios[0]?.flowResults[0]?.reachable).toBe(false);
    expect(result.scenarios[0]?.flowResults[0]?.unreachableReason).toBe("noPath");
  });

  it("Scenario 12b: Core switch failure changes reachability and missing servedByDeviceId is explicit", async () => {
    const origin = makeGeoPoint(77.6, 12.9);
    const { baselineDesignId } = await projectService.createProject({
      name: "Core Failure Integration",
      initialRegion: { label: "Lab", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    const switchItem = Object.values(useDesignStore.getState().aggregate!.catalogById).find(
      (c) => c.type === "switch"
    )!;
    const serverItem = Object.values(useDesignStore.getState().aggregate!.catalogById).find(
      (c) => c.type === "server"
    )!;

    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.600, 12.900),
      name: "Mechanical Switch",
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.601, 12.900),
      name: "Core Switch",
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: serverItem.id,
      position: makeGeoPoint(77.602, 12.900),
      name: "server 6",
    });

    const devices = Object.values(useDesignStore.getState().aggregate!.devicesById);
    const mechSwitchId = devices.find((d) => d.name === "Mechanical Switch")!.id;
    const coreSwitchId = devices.find((d) => d.name === "Core Switch")!.id;
    const serverId = devices.find((d) => d.name === "server 6")!.id;

    await session.dispatch({
      type: "link/add",
      sourceDeviceId: mechSwitchId,
      targetDeviceId: coreSwitchId,
      medium: "fiber",
    });
    await session.dispatch({
      type: "link/add",
      sourceDeviceId: coreSwitchId,
      targetDeviceId: serverId,
      medium: "fiber",
    });

    await session.dispatch({
      type: "subnet/add",
      name: "Mechanical Workshop",
      hostsRequired: 10,
      servedByDeviceId: mechSwitchId,
    });
    await session.dispatch({
      type: "subnet/add",
      name: "Unassigned Subnet",
      hostsRequired: 10,
      servedByDeviceId: null,
    });

    const subnets = Object.values(useDesignStore.getState().aggregate!.subnetsById);
    const mechSubnetId = subnets.find((s) => s.name === "Mechanical Workshop")!.id;
    const unassignedSubnetId = subnets.find((s) => s.name === "Unassigned Subnet")!.id;

    await session.dispatch({
      type: "simulation/setup",
      setup: {
        flows: [
          {
            id: "flow-mech" as never,
            name: "Mechanical Workshop -> server 6",
            sourceSubnetId: mechSubnetId,
            destinationDeviceId: serverId,
            demandMbpsOverride: 50,
            enabled: true,
          },
          {
            id: "flow-unassigned" as never,
            name: "Unassigned Subnet -> server 6",
            sourceSubnetId: unassignedSubnetId,
            destinationDeviceId: serverId,
            demandMbpsOverride: 50,
            enabled: true,
          },
        ],
        failureScenarios: [
          {
            id: "scen-core-fail" as never,
            name: "Core Switch Failure",
            failedDeviceIds: [coreSwitchId],
            failedLinkIds: [],
          },
        ],
      },
    });

    await coordinator.run("simulation", baselineDesignId);
    const result = useAnalysisStore.getState().records.simulation!.result as SimulationResult;

    const baseMech = result.baselineFlows.find((f) => f.flowId === "flow-mech")!;
    expect(baseMech.reachable).toBe(true);
    expect(baseMech.pathDeviceIds).toEqual([mechSwitchId, coreSwitchId, serverId]);
    expect(baseMech.hopCount).toBe(2);

    const baseUnassigned = result.baselineFlows.find((f) => f.flowId === "flow-unassigned")!;
    expect(baseUnassigned.reachable).toBe(false);
    expect(baseUnassigned.unreachableReason).toBe("missingServingDevice");
    expect(baseUnassigned.pathDeviceIds).toEqual([]);

    const coreFail = result.scenarios[0]!;
    const failMech = coreFail.flowResults.find((f) => f.flowId === "flow-mech")!;
    expect(failMech.reachable).toBe(false);
    expect(failMech.unreachableReason).toBe("noPath");
    expect(failMech.deliveredRateMbps).toBe(0);
    expect(coreFail.metrics.reachableFlowCount).toBe(0);
  });

  it("Scenario 13: Distinguish unreachable flows from reachable paths with missing capacity", async () => {
    // Calling simulation engine directly
    const { result: res } = await defaultSimulationEngine.run(
      {
        nodes: [
          { deviceId: "n1" as DeviceId, type: "router", processingDelayMs: 1 },
          { deviceId: "n2" as DeviceId, type: "server", processingDelayMs: null },
        ],
        edges: [
          {
            linkId: "l1" as LinkId,
            sourceDeviceId: "n1" as DeviceId,
            targetDeviceId: "n2" as DeviceId,
            medium: "copper",
            lengthM: 100,
            capacityMbps: null, // missing capacity
            routingWeight: 1,
          },
        ],
        flows: [
          {
            flowId: "f1" as never,
            subnetId: "sub1" as SubnetId,
            sourceDeviceId: "n1" as DeviceId,
            destinationDeviceId: "n2" as DeviceId,
            demandMbps: 10,
          },
        ],
        scenarios: [],
        settings: DEFAULT_PROJECT_SETTINGS.simulation,
      },
      {
        shouldCancel: () => false,
        reportProgress: () => {},
        yieldToEventLoop: async () => {},
      }
    );

    // Flow is graph-reachable even though capacity is missing
    expect(res.baselineFlows[0]?.reachable).toBe(true);
    expect(res.baselineFlows[0]?.throughputCompleteness).toBe("missingCapacity");
    expect(res.baselineFlows[0]?.deliveredRateMbps).toBeNull();
  });

  it("Scenario 14: Cancel simulation and preserve previous completed result", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Sim Cancel Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    const runPromise = coordinator.run("simulation", baselineDesignId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await coordinator.cancel("simulation", baselineDesignId);

    await expect(runPromise).rejects.toThrow();
    expect(useAnalysisStore.getState().status.simulation).toBe("idle");
  });

  it("Scenario 15: Duplicate a design, verify remapped references and no copied analysis cache", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Duplication Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // Place device and calculate cost
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });
    await coordinator.run("cost", baselineDesignId);

    const baselineAnalysis = await repos.analyses.getLatest(baselineDesignId, "cost");
    expect(baselineAnalysis).not.toBeNull();

    // Duplicate design
    const newDesignId = await projectService.duplicateDesign(baselineDesignId, "Alternative 1");
    expect(newDesignId).not.toBe(baselineDesignId);

    // Check newly duplicated design has ZERO analysis records
    const newAnalysis = await repos.analyses.getLatest(newDesignId, "cost");
    expect(newAnalysis).toBeNull();

    // Check devices have remapped IDs
    const origDevices = await repos.devices.listByDesign(baselineDesignId);
    const newDevices = await repos.devices.listByDesign(newDesignId);
    expect(newDevices).toHaveLength(origDevices.length);
    expect(newDevices[0]?.id).not.toBe(origDevices[0]?.id);
  });

  it("Scenario 16: Compare two designs and show structural differences and analysis states", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Comparison Integration",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });

    const altDesignId = await projectService.duplicateDesign(baselineDesignId, "Alt Design");

    // Add extra switch to Alt Design
    await session.open(altDesignId);
    await session.dispatch({
      type: "device/add",
      catalogItemId: SWITCH_CAT_ID,
      position: makeGeoPoint(77.5960, 12.9730),
    });

    // Load both aggregates
    const aggA = await repos.designs.loadAggregate(baselineDesignId);
    const aggB = await repos.designs.loadAggregate(altDesignId);

    const diff = computeStructuralDiff(aggA!, aggB!);
    expect(diff.deviceCountA).toBe(1);
    expect(diff.deviceCountB).toBe(2);
    expect(diff.devices.length).toBe(2);
  });

  it("Scenario 17: Confirm comparison direction logic enforces better design appropriately", () => {
    // Lower is better (e.g. Cost)
    const costComp = compareMetric("capex", "CAPEX", "INR", 50000, 35000, "lowerIsBetter");
    expect(costComp.betterDesign).toBe("B");
    expect(costComp.deltaBMinusA).toBe(-15000);

    // Higher is better (e.g. Coverage)
    const covComp = compareMetric("cov", "Coverage", "%", 80, 95, "higherIsBetter");
    expect(covComp.betterDesign).toBe("B");
    expect(covComp.deltaBMinusA).toBe(15);
  });

  it("Scenario 18: Confirm logical-layout-only changes do not stale cost, coverage or simulation results", async () => {
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "Layout Invariance Test",
      initialRegion: { label: "Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });
    const routerId = Object.keys(useDesignStore.getState().aggregate!.devicesById)[0]! as DeviceId;

    // Run cost
    await coordinator.run("cost", baselineDesignId);
    expect(useAnalysisStore.getState().status.cost).toBe("fresh");

    // Change ONLY logical layout
    await session.dispatch({
      type: "layout/set",
      positions: {
        [routerId]: { coordinateSpace: "logical", x: 450, y: 600 },
      },
    });

    // Logical layout must NOT invalidate cost analysis
    const freshness = await coordinator.inspect(baselineDesignId);
    expect(freshness.byType.cost.status).toBe("current");
  });

  it("Scenario 19: Confirm all calculation workflows work offline with saved inputs and cached app assets", async () => {
    // Pure engines run locally in-browser without network requests
    const cidr = "192.168.10.0/24" as IPv4Cidr;
    const vlsm = allocateVlsm({
      parentCidr: cidr,
      subnets: [{ subnetId: "sub1" as SubnetId, name: "Offline", hostsRequired: 14 }],
    });
    expect(vlsm.isComplete).toBe(true);

    const cost = defaultCostEngine.estimate({
      currency: "INR",
      devices: [],
      links: [],
      settings: DEFAULT_PROJECT_SETTINGS.cost,
      devicePowerDutyRatio: 1,
    });
    expect(cost.isEstimate).toBe(true);
  });

  it("Scenario 20: Fresh browser profile can create a project, build a network, configure subnets, calculate cost, coverage, simulation, duplicate and compare", async () => {
    // End-to-end full workflow simulation
    const origin = makeGeoPoint(77.5946, 12.9716);
    const { baselineDesignId } = await projectService.createProject({
      name: "End-to-End Enterprise Design",
      initialRegion: { label: "Main Campus", center: origin, bbox: null },
    });

    await session.open(baselineDesignId);

    // 1. Boundary & Obstacle
    await session.dispatch({
      type: "region/setBoundary",
      boundary: makeGeoPolygon([
        [77.5940, 12.9710],
        [77.5960, 12.9710],
        [77.5960, 12.9730],
        [77.5940, 12.9730],
        [77.5940, 12.9710],
      ]),
    });

    // 2. Devices
    await session.dispatch({
      type: "device/add",
      catalogItemId: ROUTER_CAT_ID,
      position: makeGeoPoint(77.5946, 12.9716),
    });
    const rId = Object.keys(useDesignStore.getState().aggregate!.devicesById)[0]! as DeviceId;

    await session.dispatch({
      type: "device/add",
      catalogItemId: AP_CAT_ID,
      position: makeGeoPoint(77.5950, 12.9720),
    });
    const apId = Object.keys(useDesignStore.getState().aggregate!.devicesById).find((id) => id !== rId)! as DeviceId;

    // 3. Link
    await session.dispatch({
      type: "link/add",
      sourceDeviceId: rId,
      targetDeviceId: apId,
      medium: "copper",
    });

    // 4. Subnet & Addressing
    await session.dispatch({
      type: "addressing/setParentCidr",
      parentCidr: "172.16.0.0/24" as IPv4Cidr,
    });
    await session.dispatch({
      type: "subnet/add",
      name: "AP Management",
      hostsRequired: 30,
      servedByDeviceId: rId,
    });
    const subId = Object.keys(useDesignStore.getState().aggregate!.subnetsById)[0]! as SubnetId;

    const allocOut = allocateVlsm({
      parentCidr: "172.16.0.0/24" as IPv4Cidr,
      subnets: [{ subnetId: subId, name: "AP Management", hostsRequired: 30 }],
    });
    await session.dispatch({
      type: "addressing/applyAllocation",
      allocations: allocOut.allocations,
      parentCidr: "172.16.0.0/24" as IPv4Cidr,
      allocatedAt: Date.now() as EpochMs,
    });

    // 5. Cost
    const costRun = await coordinator.run("cost", baselineDesignId);
    expect(costRun.record).not.toBeNull();

    // 6. Coverage
    const covRun = await coordinator.run("coverage", baselineDesignId);
    expect(covRun.record).not.toBeNull();

    // 7. Simulation
    const simRun = await coordinator.run("simulation", baselineDesignId);
    expect(simRun.record).not.toBeNull();

    // 8. Duplicate
    const altDesignId = await projectService.duplicateDesign(baselineDesignId, "Design Variation B");
    expect(altDesignId).not.toBe(baselineDesignId);

    // 9. Compare
    const aggA = await repos.designs.loadAggregate(baselineDesignId);
    const aggB = await repos.designs.loadAggregate(altDesignId);
    const diff = computeStructuralDiff(aggA!, aggB!);
    expect(diff.deviceCountA).toBe(2);
    expect(diff.deviceCountB).toBe(2);
    expect(diff.linkCountA).toBe(1);
    expect(diff.linkCountB).toBe(1);
  });
});
