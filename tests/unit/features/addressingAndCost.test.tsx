import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultDesignSession } from "@/application/session/DesignSession";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";
import { allocateVlsm } from "@/engines/ip";
import type { CostEstimate } from "@/contracts/engines";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { makeGeoPoint } from "@/domain/geo/localFrame";
import type { IPv4Cidr, SubnetId, EpochMs } from "@/contracts/primitives";
import type { Device, DeviceCatalogItem } from "@/contracts/domain";

describe("Phase 3 Stage B — Addressing (P3-01) and Cost (P3-02)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let session: DefaultDesignSession;
  let coordinator: DefaultAnalysisCoordinator;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-p3-stageB-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db);

    projectService = new DefaultProjectService(repos);
    session = new DefaultDesignSession(repos);

    const hashService = {
      hashCanonical: async (value: unknown) => {
        const text = JSON.stringify(value);
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
          hash = (hash << 5) - hash + text.charCodeAt(i);
          hash |= 0;
        }
        return `hash_${Math.abs(hash).toString(16).padStart(16, "0")}` as never;
      },
    };

    const dummyWorkerClient = {
      run: () => ({ requestId: "dummy", result: Promise.resolve({} as never) }),
      cancel: async () => {},
      dispose: () => {},
    };

    coordinator = new DefaultAnalysisCoordinator(repos, dummyWorkerClient as never, hashService);

    useDesignStore.getState().reset();
    useAnalysisStore.getState().resetAnalyses();
  });

  describe("P3-01: IPv4 Addressing and VLSM Engine", () => {
    it("allocates subnets in descending host requirement order and calculates wastage", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Campus Addressing Plan",
        initialRegion: {
          label: "Bangalore",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);

      // 1. Set parent CIDR
      await session.dispatch({
        type: "addressing/setParentCidr",
        parentCidr: "192.168.0.0/24" as IPv4Cidr,
      });

      // 2. Add subnets: 100 hosts, 50 hosts, 20 hosts
      await session.dispatch({
        type: "subnet/add",
        name: "Branch Office",
        hostsRequired: 20,
      });
      await session.dispatch({
        type: "subnet/add",
        name: "Staff LAN",
        hostsRequired: 50,
      });
      await session.dispatch({
        type: "subnet/add",
        name: "Student Wi-Fi",
        hostsRequired: 100,
      });

      const agg = useDesignStore.getState().aggregate!;
      const subnetsList = Object.values(agg.subnetsById);
      expect(subnetsList).toHaveLength(3);

      // Run pure allocateVlsm engine
      const output = allocateVlsm({
        parentCidr: "192.168.0.0/24" as IPv4Cidr,
        subnets: subnetsList.map((s) => ({
          subnetId: s.id,
          name: s.name,
          hostsRequired: s.hostsRequired,
        })),
      });

      expect(output.isComplete).toBe(true);
      expect(output.allocations).toHaveLength(3);

      // Largest requirement (100 hosts) gets /25 (126 usable)
      const allocStudent = output.allocations.find(
        (a) => a.subnetId === subnetsList.find((s) => s.name === "Student Wi-Fi")?.id
      );
      expect(allocStudent?.cidr).toBe("192.168.0.0/25");
      expect(allocStudent?.usableHostCapacity).toBe(126);
      expect(allocStudent?.wastedUsableHosts).toBe(26);

      // Next largest (50 hosts) gets /26 (62 usable)
      const allocStaff = output.allocations.find(
        (a) => a.subnetId === subnetsList.find((s) => s.name === "Staff LAN")?.id
      );
      expect(allocStaff?.cidr).toBe("192.168.0.128/26");
      expect(allocStaff?.usableHostCapacity).toBe(62);
      expect(allocStaff?.wastedUsableHosts).toBe(12);

      // Smallest (20 hosts) gets /27 (30 usable)
      const allocBranch = output.allocations.find(
        (a) => a.subnetId === subnetsList.find((s) => s.name === "Branch Office")?.id
      );
      expect(allocBranch?.cidr).toBe("192.168.0.192/27");
      expect(allocBranch?.usableHostCapacity).toBe(30);

      // Apply allocation to authored design
      await session.dispatch({
        type: "addressing/applyAllocation",
        parentCidr: "192.168.0.0/24" as IPv4Cidr,
        allocations: output.allocations,
        allocatedAt: Date.now() as EpochMs,
      });

      const updatedAgg = useDesignStore.getState().aggregate!;
      for (const s of Object.values(updatedAgg.subnetsById)) {
        expect(s.allocationStatus).toBe("current");
        expect(s.allocatedCidr).not.toBeNull();
      }

      // Updating host count marks subnet allocation as out of date
      const branchSubnet = Object.values(updatedAgg.subnetsById).find((s) => s.name === "Branch Office")!;
      await session.dispatch({
        type: "subnet/update",
        subnetId: branchSubnet.id,
        patch: {
          hostsRequired: 60,
        },
      });

      const staleAgg = useDesignStore.getState().aggregate!;
      const staleBranch = staleAgg.subnetsById[branchSubnet.id]!;
      expect(staleBranch.allocationStatus).toBe("outOfDate");
    });

    it("handles space exhaustion with clear unallocated reasons", async () => {
      // 200 hosts inside /28 (only 14 usable hosts)
      const output = allocateVlsm({
        parentCidr: "192.168.1.0/28" as IPv4Cidr,
        subnets: [
          {
            subnetId: "sub_1" as SubnetId,
            name: "Oversized LAN",
            hostsRequired: 200,
          },
        ],
      });

      expect(output.isComplete).toBe(false);
      expect(output.allocations).toHaveLength(0);
      expect(output.unallocated).toHaveLength(1);
      expect(output.unallocated[0]?.reason).toBe("INSUFFICIENT_SPACE");
      expect(output.unallocated[0]?.requiredPrefix).toBe(24);
    });
  });

  describe("P3-02: Cost Estimation Subsystem", () => {
    it("estimates CAPEX, annual OPEX, and 5-year TCO from devices, cabling, and project settings", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Enterprise Cost Model",
        initialRegion: {
          label: "Bangalore",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);

      // Place 1 router and 1 switch
      const catalog = await repos.catalog.list();
      const rtrItem = catalog.find((i: DeviceCatalogItem) => i.type === "router")!;
      const swItem = catalog.find((i: DeviceCatalogItem) => i.type === "switch")!;

      await session.dispatch({
        type: "device/add",
        catalogItemId: rtrItem.id,
        name: "Core Gateway",
        position: makeGeoPoint(77.5946, 12.9716),
      });

      await session.dispatch({
        type: "device/add",
        catalogItemId: swItem.id,
        name: "Floor Switch",
        position: makeGeoPoint(77.5950, 12.9716),
      });

      const agg = useDesignStore.getState().aggregate!;
      const [dev1, dev2] = Object.values(agg.devicesById) as [Device, Device];

      // Connect with copper link (indoor)
      await session.dispatch({
        type: "link/add",
        sourceDeviceId: dev1.id,
        targetDeviceId: dev2.id,
        medium: "copper",
        installationMethod: "indoor",
      });

      // Run coordinator cost calculation
      const res = await coordinator.run("cost", baselineDesignId);
      expect(res.cacheHit).toBe(false);
      expect(res.freshness).toBe("current");

      const estimate = res.record.result as CostEstimate;
      expect(estimate.isEstimate).toBe(true);
      expect(estimate.currency).toBe("INR");
      expect(estimate.tcoHorizonYears).toBe(5);

      // Verify CAPEX includes hardware + cabling + labour + contingency
      expect(estimate.capex.knownSubtotal.amount).toBeGreaterThan(0);
      expect(estimate.annualOpex.knownSubtotal.amount).toBeGreaterThan(0);
      expect(estimate.tco.knownSubtotal.amount).toBeGreaterThan(estimate.capex.knownSubtotal.amount);

      // Cache hit on re-run
      const cachedRes = await coordinator.run("cost", baselineDesignId);
      expect(cachedRes.cacheHit).toBe(true);

      // AnalysisStore is updated
      const storeRecord = useAnalysisStore.getState().records.cost;
      expect(storeRecord?.id).toBe(res.record.id);
      expect(useAnalysisStore.getState().status.cost).toBe("fresh");
    });

    it("marks previous cost estimate outOfDate when aggregate inputs change", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Stale Cost Verification",
        initialRegion: {
          label: "Bangalore",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);
      const catalog = await repos.catalog.list();
      const swItem = catalog.find((i: DeviceCatalogItem) => i.type === "switch")!;

      await session.dispatch({
        type: "device/add",
        catalogItemId: swItem.id,
        name: "Switch 1",
        position: makeGeoPoint(77.5946, 12.9716),
      });

      await coordinator.run("cost", baselineDesignId);
      expect(useAnalysisStore.getState().status.cost).toBe("fresh");

      // Inspect shows current
      const inspect1 = await coordinator.inspect(baselineDesignId);
      expect(inspect1.byType.cost.status).toBe("current");

      // Add another device modifying input hash
      await session.dispatch({
        type: "device/add",
        catalogItemId: swItem.id,
        name: "Switch 2",
        position: makeGeoPoint(77.5950, 12.9716),
      });

      // Inspection detects outOfDate freshness without running engine
      const inspect2 = await coordinator.inspect(baselineDesignId);
      expect(inspect2.byType.cost.status).toBe("outOfDate");
      expect(useAnalysisStore.getState().status.cost).toBe("stale");
    });
  });
});

