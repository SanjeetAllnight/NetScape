import { describe, it, expect } from "vitest";
import "fake-indexeddb/auto";
import { WebCryptoHashService } from "@/application/hashService";
import { SessionManager } from "@/application/session";
import { createApplicationContainer } from "@/application/container";
import { useProjectStore } from "@/stores/projectStore";
import { NetScapeDatabase } from "@/storage/database";
import type { Project, Design } from "@/contracts/domain";
import type { ProjectId, DesignId, MapRegionId, EpochMs } from "@/contracts/primitives";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import { createProjectFrame, makeGeoPoint } from "@/domain/geo/localFrame";

describe("Application Composition Skeleton", () => {
  const origin = makeGeoPoint(77.5946, 12.9716);

  const mockProject: Project = {
    id: "p1" as ProjectId,
    name: "Application Test Project",
    description: null,
    regionId: "r1" as MapRegionId,
    settings: DEFAULT_PROJECT_SETTINGS,
    frame: createProjectFrame(origin),
    revision: 1,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
    lastOpenedAt: 1000 as EpochMs,
  };

  const mockDesign: Design = {
    id: "d1" as DesignId,
    projectId: "p1" as ProjectId,
    name: "Baseline",
    notes: null,
    isBaseline: true,
    parentDesignId: null,
    revision: 1,
    logicalLayout: {},
    addressing: { parentCidr: null, allocationStatus: "notAllocated", lastAllocatedAt: null },
    simulationSetup: { flows: [], failureScenarios: [] },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  it("computes deterministic SHA-256 hashes via WebCryptoHashService", async () => {
    const hashService = new WebCryptoHashService();
    const dataA = { b: 2, a: 1 };
    const dataB = { a: 1, b: 2 };

    const hashA = await hashService.hashCanonical(dataA);
    const hashB = await hashService.hashCanonical(dataB);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("manages session lifecycle via SessionManager", () => {
    const session = new SessionManager();
    expect(session.getState().activeProjectId).toBeNull();

    let notificationCount = 0;
    const unsub = session.subscribe(() => {
      notificationCount++;
    });

    session.setSession(mockProject, [mockDesign], mockDesign.id);
    expect(session.getState().activeProjectId).toBe(mockProject.id);
    expect(session.getState().activeDesignId).toBe(mockDesign.id);
    expect(notificationCount).toBe(1);

    session.setActiveDesign("d2" as DesignId);
    expect(session.getState().activeDesignId).toBe("d2");
    expect(notificationCount).toBe(2);

    session.clear();
    expect(session.getState().activeProjectId).toBeNull();
    expect(notificationCount).toBe(3);

    unsub();
  });

  it("creates application container with all dependencies wired", () => {
    const db = new NetScapeDatabase("app-test-db");
    const container = createApplicationContainer({ db });

    expect(container.db).toBe(db);
    expect(container.repos).toBeDefined();
    expect(container.workerClient).toBeDefined();
    expect(container.hashService).toBeDefined();
    expect(container.sessionManager).toBeDefined();
    expect(container.analysisCoordinator).toBeDefined();

    container.dispose();
  });

  it("updates and resets Zustand projectStore", () => {
    const store = useProjectStore.getState();
    expect(store.activeProjectId).toBeNull();

    store.setSession(mockProject, [mockDesign], mockDesign.id);
    expect(useProjectStore.getState().activeProjectId).toBe(mockProject.id);
    expect(useProjectStore.getState().project?.name).toBe(mockProject.name);

    store.setLoading(true);
    expect(useProjectStore.getState().isLoading).toBe(true);

    store.setError("Failed to open");
    expect(useProjectStore.getState().error).toBe("Failed to open");

    store.reset();
    expect(useProjectStore.getState().activeProjectId).toBeNull();
    expect(useProjectStore.getState().error).toBeNull();
  });
});

