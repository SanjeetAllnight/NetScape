import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultDesignSession } from "@/application/session/DesignSession";
import { NominatimGeocodingService } from "@/services/geocoding/NominatimGeocodingService";
import { useDesignStore } from "@/stores/designStore";
import { useEditorStore } from "@/stores/editorStore";
import { makeGeoPoint } from "@/domain/geo/localFrame";
import type { Longitude, Latitude } from "@/contracts/primitives";
import type { Device, Link, Obstacle } from "@/contracts/domain";

describe("Phase 2 Vertical Slice Integration (Exit Gate 15 Scenarios)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let session: DefaultDesignSession;
  let geocodingService: NominatimGeocodingService;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-slice-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    projectService = new DefaultProjectService(repos);
    session = new DefaultDesignSession(repos);
    geocodingService = new NominatimGeocodingService();

    useDesignStore.getState().reset();
    useEditorStore.getState().resetEditor();
  });

  afterEach(() => {
    db.close();
  });

  it("Scenario 1: Opens with empty IndexedDB -> seeds catalogue -> shows empty projects", async () => {
    await seedBuiltinCatalog(db);

    const catalogItems = await repos.catalog.list();
    expect(catalogItems).toHaveLength(4);
    expect(catalogItems.every((item) => item.priceProvenance === "sample")).toBe(true);

    const projects = await projectService.listProjects();
    expect(projects).toHaveLength(0);
  });

  it("Scenario 2: Creates project with region, immutable frame, and exactly one baseline design atomically", async () => {
    await seedBuiltinCatalog(db);

    const origin = makeGeoPoint(77.5946, 12.9716);
    const { projectId, baselineDesignId } = await projectService.createProject({
      name: "Bangalore Central Campus",
      description: "Primary planning model",
      initialRegion: {
        label: "Central Campus",
        center: origin,
        bbox: null,
      },
    });

    const project = await projectService.getProject(projectId);
    expect(project).not.toBeNull();
    expect(project?.name).toBe("Bangalore Central Campus");
    expect(project?.frame.origin).toEqual(origin);

    const designs = await projectService.listDesigns(projectId);
    expect(designs).toHaveLength(1);
    expect(designs[0]?.id).toBe(baselineDesignId);
    expect(designs[0]?.isBaseline).toBe(true);
  });

  it("Scenario 3: Place search online via Nominatim with client caching and offline resilience", async () => {
    const results = await geocodingService.search("");
    expect(results).toEqual([]);

    // Mock fetch for online search
    const originalFetch = globalThis.fetch;
    let fetchCallCount = 0;
    globalThis.fetch = (async () => {
      fetchCallCount++;
      return {
        ok: true,
        json: async () => [
          {
            lat: "12.9716",
            lon: "77.5946",
            display_name: "Bangalore, Karnataka, India",
            boundingbox: ["12.8", "13.1", "77.4", "77.7"],
          },
        ],
      } as Response;
    }) as typeof fetch;

    try {
      const onlineResults = await geocodingService.search("Bangalore");
      expect(onlineResults).toHaveLength(1);
      expect(onlineResults[0]?.label).toBe("Bangalore, Karnataka, India");
      expect(onlineResults[0]?.center.coordinates).toEqual([77.5946, 12.9716]);
      expect(onlineResults[0]?.bbox).toEqual([77.4, 12.8, 77.7, 13.1]);

      // Cache hit: should not call fetch again
      const cached = await geocodingService.search("bangalore");
      expect(cached).toHaveLength(1);
      expect(fetchCallCount).toBe(1);

      // Offline resilience: network error returns empty list without throwing
      globalThis.fetch = (async () => {
        throw new Error("Network offline");
      }) as typeof fetch;

      const offlineResults = await geocodingService.search("Mysore");
      expect(offlineResults).toEqual([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("Scenario 4: Draws and commits planning boundary polygon -> verifies committed boundary in projection", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Boundary Test Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);

    const boundaryCoords: [Longitude, Latitude][] = [
      [77.5940 as Longitude, 12.9710 as Latitude],
      [77.5960 as Longitude, 12.9710 as Latitude],
      [77.5960 as Longitude, 12.9730 as Latitude],
      [77.5940 as Longitude, 12.9730 as Latitude],
      [77.5940 as Longitude, 12.9710 as Latitude],
    ];

    const dispatchRes = await session.dispatch({
      type: "region/setBoundary",
      boundary: {
        type: "Polygon",
        coordinates: [boundaryCoords],
      },
    });

    expect(dispatchRes.status).toBe("committed");

    const agg = useDesignStore.getState().aggregate!;
    expect(agg.region.boundary).not.toBeNull();
    expect(agg.region.boundary?.coordinates[0]).toHaveLength(5);
  });

  it("Scenario 5: Draws manual obstacle with brick material -> persists at project level across designs", async () => {
    await seedBuiltinCatalog(db);
    const { projectId, baselineDesignId } = await projectService.createProject({
      name: "Obstacle Test Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);

    const obsCoords: [Longitude, Latitude][] = [
      [77.5945 as Longitude, 12.9715 as Latitude],
      [77.5950 as Longitude, 12.9715 as Latitude],
      [77.5950 as Longitude, 12.9720 as Latitude],
      [77.5945 as Longitude, 12.9720 as Latitude],
      [77.5945 as Longitude, 12.9715 as Latitude],
    ];

    const res = await session.dispatch({
      type: "obstacle/add",
      label: "Main Library Wall",
      material: "brick",
      geometry: {
        type: "Polygon",
        coordinates: [obsCoords],
      },
    });

    expect(res.status).toBe("committed");
    const agg = useDesignStore.getState().aggregate!;
    const obstacles = Object.values(agg.obstaclesById) as Obstacle[];
    expect(obstacles).toHaveLength(1);
    expect(obstacles[0]?.material).toBe("brick");
    expect(obstacles[0]?.lossDbPerCrossing).toBe(8); // brick default wall loss

    // Duplicate design to test project-level cross-design persistence
    const dupDesignId = await projectService.duplicateDesign(baselineDesignId, "Alternative 1");
    await session.close();

    await session.open(dupDesignId);
    const dupAgg = useDesignStore.getState().aggregate!;
    expect(Object.values(dupAgg.obstaclesById)).toHaveLength(1);
    expect(dupAgg.project.id).toBe(projectId);
  });

  it("Scenario 6: Places router, switch, and access point with catalogue specifications", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Device Placement Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const routerItem = catalog.find((c) => c.type === "router")!;
    const switchItem = catalog.find((c) => c.type === "switch")!;
    const apItem = catalog.find((c) => c.type === "accessPoint")!;

    await session.dispatch({
      type: "device/add",
      catalogItemId: routerItem.id,
      position: makeGeoPoint(77.5946, 12.9716),
      name: "Core Router",
    });

    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.5950, 12.9716),
      name: "Dist Switch 1",
    });

    await session.dispatch({
      type: "device/add",
      catalogItemId: apItem.id,
      position: makeGeoPoint(77.5954, 12.9716),
      name: "Library AP",
    });

    const agg = useDesignStore.getState().aggregate!;
    const devices = Object.values(agg.devicesById) as Device[];
    expect(devices).toHaveLength(3);

    const placedRouter = devices.find((d) => d.name === "Core Router");
    expect(placedRouter?.type).toBe("router");
    expect(placedRouter?.catalogItemId).toBe(routerItem.id);
  });

  it("Scenario 7 & 8: Connects devices on map and moves a device updating incident link geometry", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Link & Move Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const routerItem = catalog.find((c) => c.type === "router")!;
    const switchItem = catalog.find((c) => c.type === "switch")!;

    // Add router
    await session.dispatch({
      type: "device/add",
      catalogItemId: routerItem.id,
      position: makeGeoPoint(77.5946, 12.9716),
      name: "Router",
    });

    // Add switch
    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.5950, 12.9716),
      name: "Switch",
    });

    let agg = useDesignStore.getState().aggregate!;
    const [rtr, sw] = Object.values(agg.devicesById) as [Device, Device];

    // Connect link on map
    const linkRes = await session.dispatch({
      type: "link/add",
      sourceDeviceId: rtr.id,
      targetDeviceId: sw.id,
      medium: "copper",
    });
    expect(linkRes.status).toBe("committed");

    agg = useDesignStore.getState().aggregate!;
    const links = Object.values(agg.linksById) as Link[];
    expect(links).toHaveLength(1);
    expect(links[0]?.geometry.coordinates[0]).toEqual(rtr.position.coordinates);
    expect(links[0]?.geometry.coordinates[1]).toEqual(sw.position.coordinates);

    // Move switch to new position
    const newSwitchPos = makeGeoPoint(77.5960, 12.9725);
    await session.dispatch({
      type: "device/move",
      deviceId: sw.id,
      position: newSwitchPos,
    });

    agg = useDesignStore.getState().aggregate!;
    const updatedSwitch = agg.devicesById[sw.id]!;
    expect(updatedSwitch.position).toEqual(newSwitchPos);

    // Incident link geometry must reflect updated switch position
    const updatedLink = Object.values(agg.linksById)[0]!;
    expect(updatedLink.geometry.coordinates[1]).toEqual(newSwitchPos.coordinates);
  });

  it("Scenario 9 & 10: Inspects/updates device properties and deletes device with link cascade", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Inspect & Delete Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const routerItem = catalog.find((c) => c.type === "router")!;
    const switchItem = catalog.find((c) => c.type === "switch")!;

    await session.dispatch({
      type: "device/add",
      catalogItemId: routerItem.id,
      position: makeGeoPoint(77.5946, 12.9716),
      name: "Old Router Name",
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.5950, 12.9716),
    });

    let agg = useDesignStore.getState().aggregate!;
    const [dev1, dev2] = Object.values(agg.devicesById) as [Device, Device];

    // Connect them
    await session.dispatch({
      type: "link/add",
      sourceDeviceId: dev1.id,
      targetDeviceId: dev2.id,
      medium: "fiber",
    });

    // Update dev1 name & hostname
    await session.dispatch({
      type: "device/update",
      deviceId: dev1.id,
      patch: {
        name: "Renamed Core Router",
        hostname: "core-rtr-blr",
      },
    });

    agg = useDesignStore.getState().aggregate!;
    expect(agg.devicesById[dev1.id]?.name).toBe("Renamed Core Router");
    expect(agg.devicesById[dev1.id]?.hostname).toBe("core-rtr-blr");

    // Delete dev1 -> incident link must be automatically deleted in cascade
    await session.dispatch({
      type: "device/delete",
      deviceId: dev1.id,
    });

    agg = useDesignStore.getState().aggregate!;
    expect(agg.devicesById[dev1.id]).toBeUndefined();
    expect(Object.keys(agg.linksById)).toHaveLength(0);
  });

  it("Scenario 11, 12 & 13: Logical topology layout updates independently and bi-directional link creation reflects on map", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Topology Integration Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const switchItem = catalog.find((c) => c.type === "switch")!;
    const apItem = catalog.find((c) => c.type === "accessPoint")!;

    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.5946, 12.9716),
      name: "Switch A",
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: apItem.id,
      position: makeGeoPoint(77.5950, 12.9720),
      name: "AP B",
    });

    let agg = useDesignStore.getState().aggregate!;
    const [sw, ap] = Object.values(agg.devicesById) as [Device, Device];

    // Node layout update (drag stop on React Flow canvas)
    const layoutRes = await session.dispatch({
      type: "layout/set",
      positions: {
        [sw.id]: { coordinateSpace: "logical", x: 250, y: 350 },
        [ap.id]: { coordinateSpace: "logical", x: 600, y: 350 },
      },
    });
    expect(layoutRes.status).toBe("committed");

    agg = useDesignStore.getState().aggregate!;
    expect(agg.design.logicalLayout[sw.id]).toEqual({ coordinateSpace: "logical", x: 250, y: 350 });
    // Geographic positions remain unchanged!
    expect(agg.devicesById[sw.id]?.position.coordinates).toEqual([77.5946, 12.9716]);

    // Connect link from topology view
    const connectRes = await session.dispatch({
      type: "link/add",
      sourceDeviceId: sw.id,
      targetDeviceId: ap.id,
      medium: "copper",
    });
    expect(connectRes.status).toBe("committed");

    // Link exists in aggregate with valid geographic LineString for the map view
    agg = useDesignStore.getState().aggregate!;
    const createdLink = Object.values(agg.linksById)[0]!;
    expect(createdLink.sourceDeviceId).toBe(sw.id);
    expect(createdLink.targetDeviceId).toBe(ap.id);
    expect(createdLink.geometry.type).toBe("LineString");
    expect(createdLink.geometry.coordinates).toHaveLength(2);
  });

  it("Scenario 14: Failed Dexie commit shows save error without corrupting projection", async () => {
    await seedBuiltinCatalog(db);
    const { baselineDesignId } = await projectService.createProject({
      name: "Fault Resilience Project",
      initialRegion: {
        label: "Region 1",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const routerItem = catalog.find((c) => c.type === "router")!;

    // Sabotage repository commit
    const originalCommit = repos.designs.commit;
    repos.designs.commit = async () => {
      throw new Error("Disk quota exceeded or database transaction aborted");
    };

    await expect(
      session.dispatch({
        type: "device/add",
        catalogItemId: routerItem.id,
        position: makeGeoPoint(77.5946, 12.9716),
      })
    ).rejects.toThrow(/quota/);

    expect(useDesignStore.getState().saveStatus).toBe("error");
    expect(useDesignStore.getState().errorMessage).toContain("Disk quota exceeded");

    // Projection has 0 devices (uncorrupted)
    expect(Object.keys(useDesignStore.getState().aggregate!.devicesById)).toHaveLength(0);

    repos.designs.commit = originalCommit;
  });

  it("Scenario 15: Browser reload / fresh session restores complete authored design from IndexedDB", async () => {
    await seedBuiltinCatalog(db);
    const { projectId, baselineDesignId } = await projectService.createProject({
      name: "Persistence Reload Project",
      initialRegion: {
        label: "Main Campus",
        center: makeGeoPoint(77.5946, 12.9716),
        bbox: null,
      },
    });

    await session.open(baselineDesignId);
    const catalog = await repos.catalog.list();
    const routerItem = catalog.find((c) => c.type === "router")!;
    const switchItem = catalog.find((c) => c.type === "switch")!;

    // 1. Boundary
    await session.dispatch({
      type: "region/setBoundary",
      boundary: {
        type: "Polygon",
        coordinates: [
          [
            [77.5940 as Longitude, 12.9710 as Latitude],
            [77.5960 as Longitude, 12.9710 as Latitude],
            [77.5960 as Longitude, 12.9730 as Latitude],
            [77.5940 as Longitude, 12.9730 as Latitude],
            [77.5940 as Longitude, 12.9710 as Latitude],
          ],
        ],
      },
    });

    // 2. Obstacle
    await session.dispatch({
      type: "obstacle/add",
      label: "Concrete Firewall",
      material: "concrete",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.5945 as Longitude, 12.9715 as Latitude],
            [77.5955 as Longitude, 12.9715 as Latitude],
            [77.5955 as Longitude, 12.9725 as Latitude],
            [77.5945 as Longitude, 12.9725 as Latitude],
            [77.5945 as Longitude, 12.9715 as Latitude],
          ],
        ],
      },
    });

    // 3. Devices
    await session.dispatch({
      type: "device/add",
      catalogItemId: routerItem.id,
      position: makeGeoPoint(77.5946, 12.9716),
      name: "Edge Router",
    });
    await session.dispatch({
      type: "device/add",
      catalogItemId: switchItem.id,
      position: makeGeoPoint(77.5952, 12.9722),
      name: "Core Switch",
    });

    const currentAgg = useDesignStore.getState().aggregate!;
    const [devRtr, devSw] = Object.values(currentAgg.devicesById) as [Device, Device];

    // 4. Link
    await session.dispatch({
      type: "link/add",
      sourceDeviceId: devRtr.id,
      targetDeviceId: devSw.id,
      medium: "fiber",
    });

    // 5. Logical layout
    await session.dispatch({
      type: "layout/set",
      positions: {
        [devRtr.id]: { coordinateSpace: "logical", x: 100, y: 200 },
        [devSw.id]: { coordinateSpace: "logical", x: 400, y: 200 },
      },
    });

    // Close session to simulate tab close / navigation away
    await session.close();
    useDesignStore.getState().reset();
    expect(useDesignStore.getState().aggregate).toBeNull();

    // Reopen session in a "fresh" profile from IndexedDB
    const freshSession = new DefaultDesignSession(repos);
    const restoredAgg = await freshSession.open(baselineDesignId);

    // Verify EVERYTHING is restored from IndexedDB
    expect(restoredAgg.project.id).toBe(projectId);
    expect(restoredAgg.project.name).toBe("Persistence Reload Project");
    expect(restoredAgg.region.boundary).not.toBeNull();
    expect(Object.keys(restoredAgg.obstaclesById)).toHaveLength(1);
    expect((Object.values(restoredAgg.obstaclesById)[0] as Obstacle).material).toBe("concrete");
    expect(Object.keys(restoredAgg.devicesById)).toHaveLength(2);
    expect(Object.keys(restoredAgg.linksById)).toHaveLength(1);
    expect((Object.values(restoredAgg.linksById)[0] as Link).medium).toBe("fiber");
    expect(restoredAgg.design.logicalLayout[devRtr.id]).toEqual({
      coordinateSpace: "logical",
      x: 100,
      y: 200,
    });
    expect(restoredAgg.design.logicalLayout[devSw.id]).toEqual({
      coordinateSpace: "logical",
      x: 400,
      y: 200,
    });
    expect(useDesignStore.getState().saveStatus).toBe("saved");
  });
});

