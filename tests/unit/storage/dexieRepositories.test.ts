import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import type {
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  DeviceCatalogItem,
} from "@/contracts/domain";
import type {
  ProjectId,
  MapRegionId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  CatalogItemId,
  ObstacleId,
  FlowId,
  FailureScenarioId,
  AnalysisId,
  AnalysisBlobId,
  InputHash,
  IPv4Cidr,
  EpochMs,
  IdGenerator,
} from "@/contracts/primitives";
import type { CostEstimate, CoverageResult } from "@/contracts/engines";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import { createProjectFrame, makeGeoPoint } from "@/domain/geo/localFrame";

describe("Dexie Storage & Repositories (P1-02)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;

  const origin = makeGeoPoint(77.5946, 12.9716);

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-netscape-${Math.random().toString(36).substring(7)}`);
    await db.open();
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db, 1000 as EpochMs);
  });

  afterEach(async () => {
    await db.delete();
  });

  it("seeds built-in catalog items and preserves custom items during reseeding", async () => {
    const items = await repos.catalog.list();
    expect(items.length).toBeGreaterThanOrEqual(4);
    const builtIns = items.filter((i) => i.origin === "builtIn");
    expect(builtIns.length).toBeGreaterThanOrEqual(4);

    // Create a custom catalog item
    const customItem: DeviceCatalogItem = {
      id: "cat-custom-1" as CatalogItemId,
      type: "switch",
      origin: "custom",
      label: "Custom Campus Switch",
      brand: "MikroTik",
      model: "CRS326",
      powerW: 30,
      lifespanYears: 5,
      unitPrice: { amount: 15000, currency: "INR" },
      priceProvenance: "userEntered",
      priceUpdatedAt: 1500 as EpochMs,
      builtInCatalogVersion: null,
      specs: {
        type: "switch",
        switchingCapacityMbps: 32000,
        ports: { copperEthernet: 24, fiber: 0, wireless: 0 },
        capacityMbps: 32000,
        processingDelayMs: 0.1,
      },
      createdAt: 1500 as EpochMs,
      updatedAt: 1500 as EpochMs,
    };
    await repos.catalog.createCustom(customItem);

    // Reseed catalog
    await seedBuiltinCatalog(db, 2000 as EpochMs);

    // Verify custom item is intact and untampered
    const fetchedCustom = await repos.catalog.get(customItem.id);
    expect(fetchedCustom).toBeDefined();
    expect(fetchedCustom?.label).toBe("Custom Campus Switch");
    expect(fetchedCustom?.origin).toBe("custom");
  });

  it("creates project with region and baseline design in one atomic transaction", async () => {
    const proj: Project = {
      id: "p-test" as ProjectId,
      name: "Engineering Block Network",
      description: null,
      regionId: "r-test" as MapRegionId,
      settings: DEFAULT_PROJECT_SETTINGS,
      frame: createProjectFrame(origin),
      revision: 1,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
      lastOpenedAt: 1000 as EpochMs,
    };
    const region: MapRegion = {
      id: "r-test" as MapRegionId,
      projectId: proj.id,
      label: "Campus North",
      center: origin,
      bbox: null,
      boundary: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const baseline: Design = {
      id: "d-baseline" as DesignId,
      projectId: proj.id,
      parentDesignId: null,
      name: "Baseline",
      notes: null,
      isBaseline: true,
      revision: 1,
      logicalLayout: {},
      addressing: { parentCidr: null, allocationStatus: "notAllocated", lastAllocatedAt: null },
      simulationSetup: { flows: [], failureScenarios: [] },
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };

    await repos.projects.createWithBaseline({ project: proj, region, baseline });

    const p = await repos.projects.get(proj.id);
    expect(p?.name).toBe("Engineering Block Network");

    const designs = await repos.designs.listByProject(proj.id);
    expect(designs).toHaveLength(1);
    expect(designs[0]?.isBaseline).toBe(true);

    const aggregate = await repos.designs.loadAggregate(baseline.id);
    expect(aggregate.project.id).toBe(proj.id);
    expect(aggregate.region.id).toBe(region.id);
    expect(aggregate.design.id).toBe(baseline.id);
  });

  it("duplicates design with remapped entity IDs, preserves topology references, and omits analysis blobs", async () => {
    const projId = "p-dup" as ProjectId;
    const baseId = "d-base" as DesignId;

    const proj: Project = {
      id: projId,
      name: "Duplication Test",
      description: null,
      regionId: "r-dup" as MapRegionId,
      settings: DEFAULT_PROJECT_SETTINGS,
      frame: createProjectFrame(origin),
      revision: 1,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
      lastOpenedAt: null,
    };
    const reg: MapRegion = {
      id: "r-dup" as MapRegionId,
      projectId: projId,
      label: "R",
      center: origin,
      bbox: null,
      boundary: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const baseDesign: Design = {
      id: baseId,
      projectId: projId,
      parentDesignId: null,
      name: "Baseline",
      notes: null,
      isBaseline: true,
      revision: 1,
      logicalLayout: {
        ["dev-1" as DeviceId]: { coordinateSpace: "logical", x: 100, y: 100 },
        ["dev-2" as DeviceId]: { coordinateSpace: "logical", x: 200, y: 200 },
      },
      addressing: { parentCidr: "192.168.1.0/24" as IPv4Cidr, allocationStatus: "notAllocated", lastAllocatedAt: null },
      simulationSetup: { flows: [], failureScenarios: [] },
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };

    await repos.projects.createWithBaseline({ project: proj, region: reg, baseline: baseDesign });

    const dev1: Device = {
      id: "dev-1" as DeviceId,
      designId: baseId,
      catalogItemId: "cat_550e8400-e29b-41d4-a716-446655440001" as CatalogItemId,
      type: "router",
      name: "R1",
      hostname: null,
      position: makeGeoPoint(77.5946, 12.9716),
      overrides: {},
      notes: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const dev2: Device = {
      id: "dev-2" as DeviceId,
      designId: baseId,
      catalogItemId: "cat_550e8400-e29b-41d4-a716-446655440002" as CatalogItemId,
      type: "switch",
      name: "SW1",
      hostname: null,
      position: makeGeoPoint(77.5950, 12.9720),
      overrides: {},
      notes: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const link: Link = {
      id: "l-1" as LinkId,
      designId: baseId,
      sourceDeviceId: dev1.id,
      targetDeviceId: dev2.id,
      medium: "copper",
      installationMethod: null,
      geometry: { type: "LineString", coordinates: [dev1.position.coordinates, dev2.position.coordinates] },
      capacityMbps: 1000,
      routingWeight: 1,
      lengthOverrideM: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const subnet: Subnet = {
      id: "s-1" as SubnetId,
      designId: baseId,
      name: "Lab LAN",
      hostsRequired: 30,
      servedByDeviceId: dev2.id,
      linkId: link.id,
      allocatedCidr: null,
      usableHostCapacity: null,
      wastedUsableHosts: null,
      allocationStatus: "notAllocated",
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };

    await db.devices.bulkPut([dev1, dev2]);
    await db.links.put(link);
    await db.subnets.put(subnet);

    // Save an analysis record for baseline
    await repos.analyses.put({
      id: "ana-1" as AnalysisId,
      projectId: projId,
      designId: baseId,
      type: "cost",
      engineId: "cost",
      engineVersion: 1,
      inputHash: "hash-1" as InputHash,
      parameters: { type: "cost", settings: proj.settings.cost },
      isEstimate: true,
      computedAt: 1200 as EpochMs,
      result: {} as unknown as CostEstimate,
    });

    let counter = 100;
    const testIds: IdGenerator = {
      device: () => `new-dev-${counter++}` as DeviceId,
      link: () => `new-link-${counter++}` as LinkId,
      subnet: () => `new-sub-${counter++}` as SubnetId,
      obstacle: () => `new-obs-${counter++}` as ObstacleId,
      flow: () => `new-flow-${counter++}` as FlowId,
      failureScenario: () => `new-sc-${counter++}` as FailureScenarioId,
      design: () => "new-d" as DesignId,
      project: () => "new-p" as ProjectId,
      mapRegion: () => "new-r" as MapRegionId,
      catalogItem: () => "new-cat" as CatalogItemId,
      analysis: () => "new-a" as AnalysisId,
      analysisBlob: () => "new-b" as AnalysisBlobId,
    };

    const newDesignId = "d-copy" as DesignId;
    await repos.designs.duplicate(baseId, newDesignId, testIds, "Alternative Plan", 2000 as EpochMs);

    const copy = await repos.designs.get(newDesignId);
    expect(copy).toBeDefined();
    expect(copy?.name).toBe("Alternative Plan");
    expect(copy?.parentDesignId).toBe(baseId);
    expect(copy?.isBaseline).toBe(false);

    const copyDevices = await repos.devices.listByDesign(newDesignId);
    expect(copyDevices).toHaveLength(2);
    expect(copyDevices[0]?.id).not.toBe("dev-1");
    expect(copyDevices[1]?.id).not.toBe("dev-2");

    const copyLinks = await repos.links.listByDesign(newDesignId);
    expect(copyLinks).toHaveLength(1);
    expect(copyLinks[0]?.sourceDeviceId).toBe(copyDevices[0]?.id);
    expect(copyLinks[0]?.targetDeviceId).toBe(copyDevices[1]?.id);

    const copySubnets = await repos.subnets.listByDesign(newDesignId);
    expect(copySubnets).toHaveLength(1);
    expect(copySubnets[0]?.servedByDeviceId).toBe(copyDevices[1]?.id);
    expect(copySubnets[0]?.linkId).toBe(copyLinks[0]?.id);

    // Verify analysis cache was NOT duplicated
    const copyAnalysis = await repos.analyses.findByHash(newDesignId, "cost", "hash-1" as InputHash);
    expect(copyAnalysis).toBeNull();
  });

  it("enforces optimistic concurrency revision conflict checks on commit", async () => {
    const projId = "p-rev" as ProjectId;
    const desId = "d-rev" as DesignId;

    const proj: Project = {
      id: projId,
      name: "Revision Test",
      description: null,
      regionId: "r-rev" as MapRegionId,
      settings: DEFAULT_PROJECT_SETTINGS,
      frame: createProjectFrame(origin),
      revision: 1,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
      lastOpenedAt: null,
    };
    const reg: MapRegion = {
      id: "r-rev" as MapRegionId,
      projectId: projId,
      label: "R",
      center: origin,
      bbox: null,
      boundary: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const design: Design = {
      id: desId,
      projectId: projId,
      parentDesignId: null,
      name: "D",
      notes: null,
      isBaseline: true,
      revision: 1,
      logicalLayout: {},
      addressing: { parentCidr: null, allocationStatus: "notAllocated", lastAllocatedAt: null },
      simulationSetup: { flows: [], failureScenarios: [] },
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };

    await repos.projects.createWithBaseline({ project: proj, region: reg, baseline: design });

    // Commit with stale expected revision (e.g. expected 0 when db has 1)
    await expect(
      repos.designs.commit(
        {
          project: null,
          region: null,
          design: { ...design, revision: 2 },
          upsertDevices: [],
          deleteDeviceIds: [],
          upsertLinks: [],
          deleteLinkIds: [],
          upsertSubnets: [],
          deleteSubnetIds: [],
          upsertObstacles: [],
          deleteObstacleIds: [],
          affectedAnalysisTypes: [],
          validationIssues: [],
        },
        { projectRevision: 1, designRevision: 0 } // Conflict!
      )
    ).rejects.toThrow(/revision conflict/i);
  });

  it("prunes derived analysis cache while never touching authored data", async () => {
    const desId = "d-prune" as DesignId;
    const projId = "p-prune" as ProjectId;

    for (let i = 1; i <= 8; i++) {
      await repos.analyses.put({
        id: `ana-${i}` as AnalysisId,
        projectId: projId,
        designId: desId,
        type: "coverage",
        engineId: "coverage",
        engineVersion: 1,
        inputHash: `hash-${i}` as InputHash,
        parameters: { type: "coverage", settings: DEFAULT_PROJECT_SETTINGS.coverage },
        isEstimate: true,
        computedAt: (1000 + i * 100) as EpochMs,
        result: {} as unknown as CoverageResult,
      });
    }

    const beforeCount = await db.analysisCache.count();
    expect(beforeCount).toBe(8);

    const { deletedRecords } = await repos.analyses.prune(3);
    expect(deletedRecords).toBe(5);

    const remaining = await db.analysisCache.toArray();
    expect(remaining).toHaveLength(3);
    const ids = remaining.map((r) => r.id);
    expect(ids).toContain("ana-6");
    expect(ids).toContain("ana-7");
    expect(ids).toContain("ana-8");
  });
});
