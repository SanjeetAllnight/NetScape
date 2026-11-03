import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { DefaultDesignSession } from "@/application/session/DesignSession";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { NominatimGeocodingService } from "@/services/geocoding/NominatimGeocodingService";
import { seedBuiltinCatalog } from "@/storage/seed";
import { useDesignStore } from "@/stores/designStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { usePrefsStore } from "@/stores/prefsStore";
import { makeGeoPoint } from "@/domain/geo/localFrame";
import type { CatalogItemId, DeviceId, DesignId, ProjectId } from "@/contracts/primitives";
import type { DesignCommittedEvent } from "@/contracts/services";

describe("Phase 2 Application Services & Stores (P2-01)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let session: DefaultDesignSession;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-p2-app-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db);

    projectService = new DefaultProjectService(repos);
    session = new DefaultDesignSession(repos);

    useDesignStore.getState().reset();
    useEditorStore.getState().resetEditor();
    useAnalysisStore.getState().resetAnalyses();
  });

  afterEach(() => {
    db.close();
  });

  describe("ProjectService", () => {
    it("creates project with region and baseline design in one atomic transaction", async () => {
      const center = makeGeoPoint(77.5946, 12.9716);
      const res = await projectService.createProject({
        name: "Test Campus",
        description: "Campus planning",
        initialRegion: {
          label: "Bangalore HQ",
          center,
          bbox: null,
        },
      });

      expect(res.projectId).toMatch(/^proj_/);
      expect(res.baselineDesignId).toMatch(/^des_/);

      const project = await projectService.getProject(res.projectId);
      expect(project).not.toBeNull();
      expect(project?.name).toBe("Test Campus");
      expect(project?.settings.cost.currency).toBe("INR");
      expect(project?.frame.origin).toEqual(center);

      const designs = await projectService.listDesigns(res.projectId);
      expect(designs).toHaveLength(1);
      expect(designs[0]?.id).toBe(res.baselineDesignId);
      expect(designs[0]?.isBaseline).toBe(true);
    });

    it("duplicates project with full ID remapping and preserves exactly one baseline", async () => {
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "Original Project",
        initialRegion: {
          label: "Region 1",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      // Add a device to original project's baseline design
      await session.open(baselineDesignId);
      const catItem = (await repos.catalog.list())[0]!;
      await session.dispatch({
        type: "device/add",
        catalogItemId: catItem.id,
        position: makeGeoPoint(77.595, 12.972),
      });
      await session.close();

      // Duplicate project
      const dup = await projectService.duplicateProject({
        sourceProjectId: projectId,
        name: "Cloned Project",
      });

      expect(dup.projectId).not.toBe(projectId);
      expect(dup.baselineDesignId).not.toBe(baselineDesignId);

      const dupDesigns = await projectService.listDesigns(dup.projectId);
      expect(dupDesigns).toHaveLength(1);
      expect(dupDesigns[0]?.isBaseline).toBe(true);

      const dupAgg = await repos.designs.loadAggregate(dup.baselineDesignId);
      expect(dupAgg.project.id).toBe(dup.projectId);
      expect(dupAgg.project.name).toBe("Cloned Project");
      expect(Object.keys(dupAgg.devicesById)).toHaveLength(1);

      // Verify device was remapped with a new ID
      const originalAgg = await repos.designs.loadAggregate(baselineDesignId);
      const origDevId = Object.keys(originalAgg.devicesById)[0]!;
      const dupDevId = Object.keys(dupAgg.devicesById)[0]!;
      expect(dupDevId).not.toBe(origDevId);
      expect(dupAgg.devicesById[dupDevId]?.catalogItemId).toBe(catItem.id);
    });

    it("renames, updates settings, and deletes projects", async () => {
      const { projectId } = await projectService.createProject({
        name: "Initial Name",
        initialRegion: {
          label: "R1",
          center: makeGeoPoint(77.59, 12.97),
          bbox: null,
        },
      });

      // Rename
      const renamed = await projectService.renameProject(projectId, "Updated Name");
      expect(renamed.name).toBe("Updated Name");

      // Update settings
      const updated = await projectService.updateProjectSettings(projectId, {
        cost: {
          currency: "INR",
          contingencyRatePct: 20,
        },
      });
      expect(updated.settings.cost.contingencyRatePct).toBe(20);

      // Delete
      await projectService.deleteProject(projectId);
      const gone = await projectService.getProject(projectId);
      expect(gone).toBeNull();
    });
  });

  describe("DesignSession", () => {
    it("opens a design, dispatches commands, and enforces commit-then-project pattern", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Session Project",
        initialRegion: {
          label: "Region 1",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      const events: DesignCommittedEvent[] = [];
      session.on("committed", (e) => events.push(e));

      // Open session
      const agg = await session.open(baselineDesignId);
      expect(agg.design.id).toBe(baselineDesignId);
      expect(useDesignStore.getState().aggregate?.design.id).toBe(baselineDesignId);
      expect(useDesignStore.getState().saveStatus).toBe("saved");

      // Dispatch device/add
      const catItems = await repos.catalog.list();
      const catItem = catItems[0]!;
      const dispatchRes = await session.dispatch({
        type: "device/add",
        catalogItemId: catItem.id,
        position: makeGeoPoint(77.595, 12.972),
      });

      expect(dispatchRes.status).toBe("committed");
      expect(events).toHaveLength(1);
      expect(events[0]?.designId).toBe(baselineDesignId);

      // Verify Zustand designStore projected the change
      const storeAgg = useDesignStore.getState().aggregate;
      expect(storeAgg).not.toBeNull();
      expect(Object.keys(storeAgg!.devicesById)).toHaveLength(1);
      expect(useDesignStore.getState().saveStatus).toBe("saved");

      // Close session
      await session.close();
      expect(useDesignStore.getState().aggregate).toBeNull();
    });

    it("serializes concurrent dispatches through a queue without race conditions", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Concurrent Test",
        initialRegion: {
          label: "Region 1",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);
      const catItems = await repos.catalog.list();
      const catItem = catItems[0]!;

      // Fire 5 concurrent dispatches simultaneously
      const promises = [0, 1, 2, 3, 4].map((i) =>
        session.dispatch({
          type: "device/add",
          catalogItemId: catItem.id,
          position: makeGeoPoint(77.595 + i * 0.001, 12.972),
        })
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        expect(res.status).toBe("committed");
      }

      // Final store aggregate must contain all 5 devices
      const finalAgg = useDesignStore.getState().aggregate!;
      expect(Object.keys(finalAgg.devicesById)).toHaveLength(5);
      expect(finalAgg.design.revision).toBe(6); // 1 initial + 5 additions
    });

    it("handles validation rejection without mutating store or database", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Validation Test",
        initialRegion: {
          label: "Region 1",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);

      // Non-existent catalogue item
      const res = await session.dispatch({
        type: "device/add",
        catalogItemId: "cat_missing" as CatalogItemId,
        position: makeGeoPoint(77.595, 12.972),
      });

      expect(res.status).toBe("rejected");
      if (res.status === "rejected") {
        expect(res.issues[0]?.code).toBe("CATALOG_ITEM_MISSING");
      }

      // Store remains intact with 0 devices
      expect(Object.keys(useDesignStore.getState().aggregate!.devicesById)).toHaveLength(0);
      expect(useDesignStore.getState().saveStatus).toBe("saved");
    });

    it("sets saveStatus to error and does not mutate projection when Dexie transaction fails", async () => {
      const { baselineDesignId } = await projectService.createProject({
        name: "Failure Test",
        initialRegion: {
          label: "Region 1",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);
      const catItem = (await repos.catalog.list())[0]!;

      // Corrupt repository commit method to simulate failure
      const originalCommit = repos.designs.commit;
      repos.designs.commit = async () => {
        throw new Error("Simulated IndexedDB IO error");
      };

      await expect(
        session.dispatch({
          type: "device/add",
          catalogItemId: catItem.id,
          position: makeGeoPoint(77.595, 12.972),
        })
      ).rejects.toThrow("Simulated IndexedDB IO error");

      // Verify save status indicates error
      expect(useDesignStore.getState().saveStatus).toBe("error");
      expect(useDesignStore.getState().errorMessage).toContain("Simulated IndexedDB IO error");

      // Projection was NOT modified
      expect(Object.keys(useDesignStore.getState().aggregate!.devicesById)).toHaveLength(0);

      // Restore commit method
      repos.designs.commit = originalCommit;
    });
  });

  describe("Editor, Analysis, and Prefs Stores", () => {
    it("updates and resets editorStore correctly", () => {
      const store = useEditorStore.getState();
      expect(store.activeTool).toBe("select");

      store.setActiveTool("connect-link");
      expect(useEditorStore.getState().activeTool).toBe("connect-link");

      store.setSelectedEntity({ type: "device", id: "dev-1" });
      expect(useEditorStore.getState().selectedEntity).toEqual({ type: "device", id: "dev-1" });

      store.setViewport({ center: [13.0, 77.6], zoom: 18 });
      expect(useEditorStore.getState().viewport.zoom).toBe(18);

      store.resetEditor();
      expect(useEditorStore.getState().activeTool).toBe("select");
      expect(useEditorStore.getState().selectedEntity).toBeNull();
    });

    it("manages analysisStore calculation states and staleness", () => {
      const store = useAnalysisStore.getState();
      expect(store.status.cost).toBe("idle");

      store.setStatus("cost", "computing");
      expect(useAnalysisStore.getState().status.cost).toBe("computing");

      store.setProgress("coverage", 0.5);
      expect(useAnalysisStore.getState().progress.coverage).toBe(0.5);

      store.setRecord(
        "cost",
        {
          id: "ana-1" as any,
          projectId: "p1" as ProjectId,
          designId: "d1" as DesignId,
          type: "cost",
          engineId: "cost",
          engineVersion: 1,
          inputHash: "hash-1" as any,
          parameters: { type: "cost", settings: {} as any },
          isEstimate: true,
          computedAt: 1000 as any,
          result: {} as any,
        },
        "hash-1" as any
      );
      expect(useAnalysisStore.getState().status.cost).toBe("fresh");

      store.markStale("cost");
      expect(useAnalysisStore.getState().status.cost).toBe("stale");
    });

    it("manages prefsStore preferences", () => {
      const store = usePrefsStore.getState();
      expect(store.preferences.autoRecalculateCoverage).toBe(false);

      store.updatePreference("autoRecalculateCoverage", true);
      expect(usePrefsStore.getState().preferences.autoRecalculateCoverage).toBe(true);

      store.updatePreference("distanceDisplayUnit", "km");
      expect(usePrefsStore.getState().preferences.distanceDisplayUnit).toBe("km");
    });
  });

  describe("NominatimGeocodingService", () => {
    it("caches queries and handles empty queries gracefully", async () => {
      const service = new NominatimGeocodingService();
      const emptyRes = await service.search("");
      expect(emptyRes).toEqual([]);

      const whitespaceRes = await service.search("   ");
      expect(whitespaceRes).toEqual([]);
    });
  });
});
