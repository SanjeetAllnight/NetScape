import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { makeGeoPoint, createProjectFrame } from "@/domain/geo/localFrame";
import { StorageError } from "@/contracts/errors";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import type {
  ProjectId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  AnalysisId,
  AnalysisBlobId,
  EpochMs,
  InputHash,
} from "@/contracts/primitives";
import type {
  Project,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
} from "@/contracts/domain";
import type { DesignChangeSet } from "@/contracts/commands";
import type { AnalysisRecord, AnalysisBlob } from "@/contracts/engines";

describe("Phase 4 Stage C — Storage Safety, Quota Recovery & Concurrency (P4-03A)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-recovery-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db);
  });

  afterEach(() => {
    db.close();
  });

  describe("clearDerivedCache", () => {
    it("purges only analysis cache and blobs, strictly preserving all authored project entities", async () => {
      const now = Date.now() as EpochMs;
      const projectId = "proj_test_recovery" as ProjectId;
      const designId = "des_test_recovery" as DesignId;

      const project: Project = {
        id: projectId,
        name: "Mission Critical Campus",
        description: "Author data must survive cache clearing",
        regionId: "reg_1" as never,
        settings: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
        frame: createProjectFrame(makeGeoPoint(77.5946, 12.9716)),
        revision: 1,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      };

      const design: Design = {
        id: designId,
        projectId,
        name: "Baseline Design",
        notes: null,
        parentDesignId: null,
        isBaseline: true,
        revision: 1,
        logicalLayout: {},
        addressing: { parentCidr: null, allocationStatus: "unallocated", lastAllocatedAt: null },
        simulationSetup: { flows: [], failureScenarios: [] },
        createdAt: now,
        updatedAt: now,
      };

      const dev: Device = {
        id: "dev_1" as DeviceId,
        designId,
        catalogItemId: "cat_1" as never,
        name: "Core Switch",
        hostname: "sw-core-01",
        notes: null,
        type: "switch",
        position: makeGeoPoint(77.5946, 12.9716),
        overrides: {},
        createdAt: now,
        updatedAt: now,
      };

      const link: Link = {
        id: "link_1" as LinkId,
        designId,
        sourceDeviceId: dev.id,
        targetDeviceId: "dev_2" as DeviceId,
        medium: "fiber",
        installationMethod: "underground",
        geometry: {
          type: "LineString",
          coordinates: [dev.position.coordinates, dev.position.coordinates],
        },
        lengthOverrideM: 250,
        capacityMbps: 10000,
        routingWeight: 1,
        createdAt: now,
        updatedAt: now,
      };

      const subnet: Subnet = {
        id: "sub_1" as SubnetId,
        designId,
        name: "Data Center VLAN",
        hostsRequired: 120,
        servedByDeviceId: dev.id,
        linkId: null,
        allocatedCidr: "10.0.0.0/24" as never,
        usableHostCapacity: 254,
        wastedUsableHosts: 134,
        allocationStatus: "current",
        createdAt: now,
        updatedAt: now,
      };

      const obstacle: Obstacle = {
        id: "obs_1" as ObstacleId,
        projectId,
        label: "Concrete Wall",
        geometry: { type: "Polygon", coordinates: [] },
        material: "concrete",
        lossDbPerCrossing: 12,
        source: "manual",
        createdAt: now,
        updatedAt: now,
      };

      // 1. Commit authored data directly to DB
      await db.projects.put(project);
      await db.designs.put(design);
      await db.devices.put(dev);
      await db.links.put(link);
      await db.subnets.put(subnet);
      await db.obstacles.put(obstacle);

      // 2. Put derived analysis records & blobs
      const analysisRecord: AnalysisRecord = {
        id: "ana_1" as AnalysisId,
        projectId,
        designId,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash: "hash_xyz" as InputHash,
        parameters: { type: "cost", settings: {} as never },
        isEstimate: true,
        computedAt: now,
        result: {} as never,
      };

      const analysisBlob: AnalysisBlob = {
        id: "blob_1" as AnalysisBlobId,
        analysisId: "ana_1" as AnalysisId,
        projectId,
        designId,
        width: 10,
        height: 10,
        rssiDbm: new Int8Array(100),
        servingIndex: new Uint8Array(100),
        servingAccessPointIds: [],
        createdAt: now,
      };

      await repos.analyses.put(analysisRecord, analysisBlob);

      // Verify records exist before purge
      expect(await db.analysisCache.count()).toBe(1);
      expect(await db.analysisBlobs.count()).toBe(1);

      // 3. Trigger clearDerivedCache()
      const { deletedRecords, deletedBlobs } = await repos.analyses.clearDerivedCache();
      expect(deletedRecords).toBe(1);
      expect(deletedBlobs).toBe(1);

      // 4. Verify derived caches are completely empty
      expect(await db.analysisCache.count()).toBe(0);
      expect(await db.analysisBlobs.count()).toBe(0);

      // 5. CRITICAL: Verify ALL authored entities are 100% intact!
      const savedProject = await db.projects.get(projectId);
      expect(savedProject).not.toBeUndefined();
      expect(savedProject?.name).toBe("Mission Critical Campus");

      const savedDesign = await db.designs.get(designId);
      expect(savedDesign).not.toBeUndefined();
      expect(savedDesign?.name).toBe("Baseline Design");

      const savedDevice = await db.devices.get(dev.id);
      expect(savedDevice).not.toBeUndefined();
      expect(savedDevice?.name).toBe("Core Switch");

      const savedLink = await db.links.get(link.id);
      expect(savedLink).not.toBeUndefined();
      expect(savedLink?.lengthOverrideM).toBe(250);

      const savedSubnet = await db.subnets.get(subnet.id);
      expect(savedSubnet).not.toBeUndefined();
      expect(savedSubnet?.name).toBe("Data Center VLAN");

      const savedObstacle = await db.obstacles.get(obstacle.id);
      expect(savedObstacle).not.toBeUndefined();
      expect(savedObstacle?.material).toBe("concrete");

      const catalogCount = await db.deviceCatalog.count();
      expect(catalogCount).toBeGreaterThan(0);
    });

    it("clears derived caches for a specific project without affecting other projects", async () => {
      const now = Date.now() as EpochMs;
      const projA = "proj_A" as ProjectId;
      const projB = "proj_B" as ProjectId;
      const desA = "des_A" as DesignId;
      const desB = "des_B" as DesignId;

      await db.designs.put({ id: desA, projectId: projA } as Design);
      await db.designs.put({ id: desB, projectId: projB } as Design);

      await db.analysisCache.put({
        id: "ana_A" as AnalysisId,
        projectId: projA,
        designId: desA,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash: "hash_a" as InputHash,
        parameters: {} as never,
        isEstimate: true,
        computedAt: now,
        result: {} as never,
      });

      await db.analysisCache.put({
        id: "ana_B" as AnalysisId,
        projectId: projB,
        designId: desB,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash: "hash_b" as InputHash,
        parameters: {} as never,
        isEstimate: true,
        computedAt: now,
        result: {} as never,
      });

      // Clear only Project A
      const result = await repos.analyses.clearDerivedCache(projA);
      expect(result.deletedRecords).toBe(1);

      // Verify Project A is gone, Project B remains
      const remaining = await db.analysisCache.toArray();
      expect(remaining.length).toBe(1);
      expect(remaining[0]?.projectId).toBe(projB);
    });
  });

  describe("Multi-tab Revision Conflict Detection", () => {
    it("rejects commit when design revision has changed concurrently in another tab", async () => {
      const now = Date.now() as EpochMs;
      const projectId = "proj_concurrency" as ProjectId;
      const designId = "des_concurrency" as DesignId;

      const project: Project = {
        id: projectId,
        name: "Concurrency Test",
        description: null,
        regionId: "r1" as never,
        revision: 1,
        settings: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
        frame: createProjectFrame(makeGeoPoint(77.5, 12.9)),
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
      };

      const design: Design = {
        id: designId,
        projectId,
        name: "Concurrent Design",
        notes: null,
        parentDesignId: null,
        revision: 1,
        isBaseline: true,
        logicalLayout: {},
        addressing: { parentCidr: null, allocationStatus: "unallocated", lastAllocatedAt: null },
        simulationSetup: { flows: [], failureScenarios: [] },
        createdAt: now,
        updatedAt: now,
      };

      await db.projects.put(project);
      await db.designs.put(design);

      // Meanwhile, Tab B commits and bumps revision to 2
      await db.designs.update(designId, { revision: 2, name: "Committed by Tab B" });

      // Tab A prepares changes based on stale revision 1
      const staleChangeSet: DesignChangeSet = {
        project: null,
        region: null,
        design: {
          ...design,
          name: "Updated by Tab A",
        },
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
      };

      // Tab A tries to commit expecting design revision 1
      await expect(
        repos.designs.commit(staleChangeSet, {
          projectRevision: 1,
          designRevision: 1, // Mismatch! Tab B made it 2
        })
      ).rejects.toThrow(StorageError);

      // Verify Tab B's data was not overwritten
      const finalDesign = await db.designs.get(designId);
      expect(finalDesign?.name).toBe("Committed by Tab B");
      expect(finalDesign?.revision).toBe(2);
    });
  });
});
