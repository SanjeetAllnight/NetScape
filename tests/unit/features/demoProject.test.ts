import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";
import { DefaultReportService } from "@/application/services/ReportService";
import { loadDemoProject } from "@/demo/demoProject";
import type { CostEstimate, CoverageResult, SimulationResult } from "@/contracts/engines";

describe("Phase 4 Stage D — Demo Project Fixture (P4-05)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let coordinator: DefaultAnalysisCoordinator;
  let reportService: DefaultReportService;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-demo-project-${Date.now()}-${Math.random()}`);
    repos = new DexieRepositories(db);
    await seedBuiltinCatalog(db);

    projectService = new DefaultProjectService(repos);

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
    reportService = new DefaultReportService(repos, coordinator);
  });

  afterEach(() => {
    db.close();
  });

  it("loads the pre-configured DEMO campus project fixture with complete inventory and analyses", async () => {
    // 1. Load the demo project
    const { projectId, baselineDesignId } = await loadDemoProject(projectService, repos);

    expect(projectId).toBeDefined();
    expect(baselineDesignId).toBeDefined();

    // 2. Verify project details
    const project = await repos.projects.get(projectId);
    expect(project).not.toBeNull();
    expect(project?.name).toBe("DEMO: Engineering Campus Workstation");
    expect(project?.description).toContain("reference network design");

    // 3. Verify design aggregate entities
    const aggregate = await repos.designs.loadAggregate(baselineDesignId);
    expect(aggregate).not.toBeNull();

    // 6 devices: Router, Main Switch, Acad Switch, Quad AP, Lib AP, Server
    const devices = Object.values(aggregate!.devicesById);
    expect(devices.length).toBe(6);
    expect(devices.map((d) => d.type).sort()).toEqual([
      "accessPoint",
      "accessPoint",
      "router",
      "server",
      "switch",
      "switch",
    ]);

    // 5 links
    const links = Object.values(aggregate!.linksById);
    expect(links.length).toBe(5);

    // 3 subnets
    const subnets = Object.values(aggregate!.subnetsById);
    expect(subnets.length).toBe(3);
    expect(subnets.map((s) => s.name).sort()).toEqual([
      "Academic Block Wired LAN",
      "Campus High-Density Wi-Fi",
      "Infrastructure Management LAN",
    ]);

    // 2 obstacles
    const obstacles = Object.values(aggregate!.obstaclesById);
    expect(obstacles.length).toBe(2);
    expect(obstacles.map((o) => o.label).sort()).toEqual([
      "Administrative Wing",
      "Central Library Building",
    ]);

    // Planning boundary
    expect(aggregate!.region.boundary).not.toBeNull();
    expect(aggregate!.region.boundary?.coordinates[0]?.length).toBe(5);

    // Logical layout positions for all devices
    for (const d of devices) {
      expect(aggregate!.design.logicalLayout[d.id]).toBeDefined();
    }

    // 4. Verify pre-calculated analysis records
    const costRec = await repos.analyses.getLatest(baselineDesignId, "cost");
    expect(costRec).not.toBeNull();
    const costResult = costRec!.result as CostEstimate;
    expect(costResult.tco.total?.amount).toBe(296500);
    expect(costResult.lineItems.length).toBe(5);

    const covRec = await repos.analyses.getLatest(baselineDesignId, "coverage");
    expect(covRec).not.toBeNull();
    const covResult = covRec!.result as CoverageResult;
    expect(covResult.coveragePercent).toBe(88.4);
    expect(covResult.deadZones.length).toBe(1);

    const covBlob = await repos.analyses.getBlob(covResult.grid.blobId);
    expect(covBlob).not.toBeNull();
    expect(covBlob?.width).toBe(30);
    expect(covBlob?.height).toBe(25);

    const simRec = await repos.analyses.getLatest(baselineDesignId, "simulation");
    expect(simRec).not.toBeNull();
    const simResult = simRec!.result as SimulationResult;
    expect(simResult.baselineMetrics.totalFlowCount).toBe(3);
    expect(simResult.scenarios.length).toBe(1);
    expect(simResult.scenarios[0]?.name).toBe("Main to Academic Fiber Cut");

    // 5. Verify ReportModel compiles immediately with all analyses
    const reportModel = await reportService.buildReportModel(projectId, baselineDesignId);
    expect(reportModel.project.name).toBe("DEMO: Engineering Campus Workstation");
    expect(reportModel.devices.length).toBe(6);
    expect(reportModel.links.length).toBe(5);
    expect(reportModel.subnets.length).toBe(3);
    expect(reportModel.obstacles.length).toBe(2);
    expect(reportModel.cost.result).not.toBeNull();
    expect(reportModel.coverage.result).not.toBeNull();
    expect(reportModel.simulation.result).not.toBeNull();
  });
});