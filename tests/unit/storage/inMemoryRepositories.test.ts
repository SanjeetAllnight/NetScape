import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryRepositories } from "../../support/inMemoryRepositories";
import { StorageError } from "@/contracts/errors";
import {
  BUILTIN_CATALOG_SEED,
  DEFAULT_PROJECT_SETTINGS,
} from "@/contracts/constants";
import type {
  ProjectId,
  DesignId,
  MapRegionId,
  DeviceId,
  LinkId,
  EpochMs,
  GeoPoint,
  Longitude,
  Latitude,
} from "@/contracts/primitives";
import type { Project, MapRegion, Design, Device, Link, DeviceCatalogItem } from "@/contracts/domain";
import type { DesignChangeSet } from "@/contracts/commands";

describe("P0-04 InMemoryRepositories (Test Seam)", () => {
  let repos: InMemoryRepositories;

  const projectId = "prj_550e8400-e29b-41d4-a716-446655440001" as ProjectId;
  const regionId = "reg_550e8400-e29b-41d4-a716-446655440001" as MapRegionId;
  const baselineDesignId = "dsn_550e8400-e29b-41d4-a716-446655440001" as DesignId;

  const sampleCenter: GeoPoint = {
    type: "Point",
    coordinates: [77.5946 as Longitude, 12.9716 as Latitude],
  };

  const sampleProject: Project = {
    id: projectId,
    name: "Campus Planning Project",
    description: "Initial test aggregate",
    regionId,
    frame: {
      kind: "azimuthalEquidistant",
      origin: sampleCenter,
      units: "m",
      definition: "+proj=aeqd +lat_0=12.9716 +lon_0=77.5946 +datum=WGS84 +units=m",
    },
    settings: DEFAULT_PROJECT_SETTINGS,
    revision: 1,
    createdAt: 1700000000000 as EpochMs,
    updatedAt: 1700000000000 as EpochMs,
    lastOpenedAt: null,
  };

  const sampleRegion: MapRegion = {
    id: regionId,
    projectId,
    label: "Main Campus",
    center: sampleCenter,
    bbox: null,
    boundary: null,
    createdAt: 1700000000000 as EpochMs,
    updatedAt: 1700000000000 as EpochMs,
  };

  const sampleBaseline: Design = {
    id: baselineDesignId,
    projectId,
    name: "Baseline",
    notes: null,
    isBaseline: true,
    parentDesignId: null,
    revision: 1,
    logicalLayout: {},
    addressing: {
      parentCidr: null,
      allocationStatus: "notAllocated",
      lastAllocatedAt: null,
    },
    simulationSetup: { flows: [], failureScenarios: [] },
    createdAt: 1700000000000 as EpochMs,
    updatedAt: 1700000000000 as EpochMs,
  };

  beforeEach(async () => {
    repos = new InMemoryRepositories();
    await repos.catalog.seedBuiltIns(1, BUILTIN_CATALOG_SEED as unknown as DeviceCatalogItem[]);
    await repos.projects.createWithBaseline({
      project: sampleProject,
      region: sampleRegion,
      baseline: sampleBaseline,
    });
  });

  it("creates project with baseline design and region atomically", async () => {
    const project = await repos.projects.get(projectId);
    expect(project).not.toBeNull();
    expect(project?.name).toBe("Campus Planning Project");

    const designs = await repos.designs.listByProject(projectId);
    expect(designs).toHaveLength(1);
    expect(designs[0]?.isBaseline).toBe(true);

    const aggregate = await repos.designs.loadAggregate(baselineDesignId);
    expect(aggregate.project.id).toBe(projectId);
    expect(aggregate.region.id).toBe(regionId);
    expect(aggregate.design.id).toBe(baselineDesignId);
  });

  it("commits valid change set and updates revisions atomically", async () => {
    const devId = "dev_550e8400-e29b-41d4-a716-446655440001" as DeviceId;
    const catItem = BUILTIN_CATALOG_SEED[0]!;

    const newDevice: Device = {
      id: devId,
      designId: baselineDesignId,
      catalogItemId: catItem.id,
      type: "router",
      name: "Core-Router-1",
      hostname: "cr1",
      notes: null,
      position: sampleCenter,
      overrides: {},
      createdAt: 1700000001000 as EpochMs,
      updatedAt: 1700000001000 as EpochMs,
    };

    const changeSet: DesignChangeSet = {
      project: null,
      region: null,
      design: sampleBaseline,
      upsertDevices: [newDevice],
      deleteDeviceIds: [],
      upsertLinks: [],
      deleteLinkIds: [],
      upsertSubnets: [],
      deleteSubnetIds: [],
      upsertObstacles: [],
      deleteObstacleIds: [],
      affectedAnalysisTypes: ["cost", "simulation"],
      validationIssues: [],
    };

    await repos.designs.commit(changeSet, { projectRevision: 1, designRevision: 1 });

    const updatedDesign = await repos.designs.get(baselineDesignId);
    expect(updatedDesign?.revision).toBe(2);

    const devices = await repos.devices.listByDesign(baselineDesignId);
    expect(devices).toHaveLength(1);
    expect(devices[0]?.name).toBe("Core-Router-1");
  });

  it("rolls back completely with no partial mutation when commit fails", async () => {
    repos.setFailNextCommit(true, "Simulated disk/IndexedDB IO failure");

    const devId = "dev_550e8400-e29b-41d4-a716-446655440002" as DeviceId;
    const catItem = BUILTIN_CATALOG_SEED[0]!;

    const newDevice: Device = {
      id: devId,
      designId: baselineDesignId,
      catalogItemId: catItem.id,
      type: "router",
      name: "Uncommitted-Router",
      hostname: "ur1",
      notes: null,
      position: sampleCenter,
      overrides: {},
      createdAt: 1700000002000 as EpochMs,
      updatedAt: 1700000002000 as EpochMs,
    };

    const changeSet: DesignChangeSet = {
      project: null,
      region: null,
      design: sampleBaseline,
      upsertDevices: [newDevice],
      deleteDeviceIds: [],
      upsertLinks: [],
      deleteLinkIds: [],
      upsertSubnets: [],
      deleteSubnetIds: [],
      upsertObstacles: [],
      deleteObstacleIds: [],
      affectedAnalysisTypes: ["cost"],
      validationIssues: [],
    };

    await expect(
      repos.designs.commit(changeSet, { projectRevision: 1, designRevision: 1 })
    ).rejects.toThrowError(StorageError);

    // Verify rollback: design revision is still 1, no device was inserted
    const design = await repos.designs.get(baselineDesignId);
    expect(design?.revision).toBe(1);

    const devices = await repos.devices.listByDesign(baselineDesignId);
    expect(devices).toHaveLength(0);
  });

  it("rejects commit when base revisions do not match (revision conflict)", async () => {
    const changeSet: DesignChangeSet = {
      project: null,
      region: null,
      design: sampleBaseline,
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

    // Stale designRevision: expected 999 instead of 1
    await expect(
      repos.designs.commit(changeSet, { projectRevision: 1, designRevision: 999 })
    ).rejects.toThrowError(/revision mismatch/i);

    // Or simulated via test control
    repos.setSimulateRevisionConflict(true);
    await expect(
      repos.designs.commit(changeSet, { projectRevision: 1, designRevision: 1 })
    ).rejects.toThrowError(StorageError);
  });

  it("enforces referential integrity on link endpoint devices", async () => {
    const invalidLink: Link = {
      id: "lnk_1" as LinkId,
      designId: baselineDesignId,
      sourceDeviceId: "dev_non_existent_1" as DeviceId,
      targetDeviceId: "dev_non_existent_2" as DeviceId,
      medium: "copper",
      installationMethod: "indoor",
      geometry: { type: "LineString", coordinates: [[0 as Longitude, 0 as Latitude], [1 as Longitude, 1 as Latitude]] },
      capacityMbps: 1000,
      routingWeight: 1,
      lengthOverrideM: null,
      createdAt: 1700000000000 as EpochMs,
      updatedAt: 1700000000000 as EpochMs,
    };

    const changeSet: DesignChangeSet = {
      project: null,
      region: null,
      design: sampleBaseline,
      upsertDevices: [],
      deleteDeviceIds: [],
      upsertLinks: [invalidLink],
      deleteLinkIds: [],
      upsertSubnets: [],
      deleteSubnetIds: [],
      upsertObstacles: [],
      deleteObstacleIds: [],
      affectedAnalysisTypes: [],
      validationIssues: [],
    };

    await expect(
      repos.designs.commit(changeSet, { projectRevision: 1, designRevision: 1 })
    ).rejects.toThrowError(/endpoints do not exist/);

    // Verify rollback
    const links = await repos.links.listByDesign(baselineDesignId);
    expect(links).toHaveLength(0);
  });
});
