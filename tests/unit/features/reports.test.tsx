import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "fake-indexeddb/auto";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { seedBuiltinCatalog } from "@/storage/seed";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultDesignSession } from "@/application/session/DesignSession";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";
import { DefaultReportService } from "@/application/services/ReportService";
import {
  setApplicationContainer,
  type ApplicationContainer,
} from "@/application/container";
import {
  buildCostEngineInput,
  buildCoverageEngineInput,
  buildSimulationEngineInput,
} from "@/domain/inputBuilders";
import { ReportView } from "@/features/reports/ReportView";
import { generateEngineeringReportPdf } from "@/features/reports/pdfGenerator";
import { makeGeoPoint, makeLonLat } from "@/domain/geo/localFrame";
import type {
  CostEstimate,
  CoverageResult,
  SimulationResult,
  AnalysisRecord,
  AnalysisBlob,
} from "@/contracts/engines";
import type {
  EpochMs,
  AnalysisId,
  AnalysisBlobId,
  GeoPolygon,
} from "@/contracts/primitives";

describe("Phase 4 Stage B — Engineering Report and PDF Generation (P4-01)", () => {
  let db: NetScapeDatabase;
  let repos: DexieRepositories;
  let projectService: DefaultProjectService;
  let session: DefaultDesignSession;
  let coordinator: DefaultAnalysisCoordinator;
  let reportService: DefaultReportService;
  let container: ApplicationContainer;

  const ROUTER_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440001" as never;
  const SWITCH_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440002" as never;
  const AP_CAT_ID = "cat_550e8400-e29b-41d4-a716-446655440003" as never;

  beforeEach(async () => {
    db = new NetScapeDatabase(`test-p4-reports-${Date.now()}-${Math.random()}`);
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
    reportService = new DefaultReportService(repos, coordinator);

    container = {
      db,
      repos,
      workerClient: dummyWorkerClient as never,
      hashService,
      sessionManager: {} as never,
      designSession: session,
      projectService,
      addressingService: {} as never,
      reportService,
      geocodingService: {} as never,
      tileSourceConfig: {} as never,
      analysisCoordinator: coordinator,
      dispose: () => db.close(),
    };

    setApplicationContainer(container);
  });

  afterEach(() => {
    setApplicationContainer(null);
    db.close();
  });

  describe("P4-01A: ReportService — Model Assembly and Freshness", () => {
    it("assembles complete report model with current analyses without recalculating", async () => {
      // 1. Create project with boundary and devices
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "Campus High-Speed Network",
        initialRegion: {
          label: "Engineering Block",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);

      // Add boundary
      const boundary: GeoPolygon = {
        type: "Polygon",
        coordinates: [
          [
            makeLonLat(77.594, 12.971),
            makeLonLat(77.595, 12.971),
            makeLonLat(77.595, 12.972),
            makeLonLat(77.594, 12.972),
            makeLonLat(77.594, 12.971),
          ],
        ],
      };
      await session.dispatch({
        type: "region/setBoundary",
        boundary,
      });

      // Add 2 devices
      const r1 = await session.dispatch({
        type: "device/add",
        catalogItemId: ROUTER_CAT_ID,
        position: makeGeoPoint(77.5942, 12.9712),
        name: "Core Gateway",
      });
      expect(r1.status).toBe("committed");

      const r2 = await session.dispatch({
        type: "device/add",
        catalogItemId: AP_CAT_ID,
        position: makeGeoPoint(77.5948, 12.9718),
        name: "Lab Access Point",
      });
      expect(r2.status).toBe("committed");

      const aggAfterDevs = session.getAggregate()!;
      const devIds = Object.keys(aggAfterDevs.devicesById);
      expect(devIds.length).toBe(2);

      // Add link between them
      const rLink = await session.dispatch({
        type: "link/add",
        sourceDeviceId: devIds[0] as never,
        targetDeviceId: devIds[1] as never,
        medium: "copper",
        installationMethod: "indoor",
        capacityMbps: 1000,
      });
      expect(rLink.status).toBe("committed");

      // Add subnet
      const rSub = await session.dispatch({
        type: "subnet/add",
        name: "Management LAN",
        hostsRequired: 50,
      });
      expect(rSub.status).toBe("committed");

      // Calculate matching input hashes for current design aggregate
      const agg = await repos.designs.loadAggregate(baselineDesignId);
      expect(agg).not.toBeNull();

      const costInput = buildCostEngineInput(agg!);
      const costHash = await container.hashService.hashCanonical(costInput);
      const mockCost: CostEstimate = {
        isEstimate: true,
        currency: "INR",
        completeness: "complete",
        capex: {
          knownSubtotal: { amount: 120000, currency: "INR" },
          total: { amount: 120000, currency: "INR" },
          completeness: "complete",
        },
        annualOpex: {
          knownSubtotal: { amount: 20000, currency: "INR" },
          total: { amount: 20000, currency: "INR" },
          completeness: "complete",
        },
        tco: {
          knownSubtotal: { amount: 220000, currency: "INR" },
          total: { amount: 220000, currency: "INR" },
          completeness: "complete",
        },
        tcoHorizonYears: 5,
        byCategory: {},
        lineItems: [],
        issues: [],
        assumptions: {
          settings: agg!.project.settings.cost,
          devicePowerDutyRatio: 1,
        },
      };

      const costRec: AnalysisRecord = {
        id: "ana_cost_1" as AnalysisId,
        projectId,
        designId: baselineDesignId,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash: costHash,
        parameters: { type: "cost", settings: agg!.project.settings.cost },
        isEstimate: true,
        computedAt: Date.now() as EpochMs,
        result: mockCost,
      };
      await repos.analyses.put(costRec);

      const covInput = buildCoverageEngineInput(agg!);
      const covHash = await container.hashService.hashCanonical(covInput);
      const blobId = "blob_cov_1" as AnalysisBlobId;
      const mockCovBlob: AnalysisBlob = {
        id: blobId,
        analysisId: "ana_cov_1" as AnalysisId,
        projectId,
        designId: baselineDesignId,
        width: 10,
        height: 10,
        rssiDbm: new Int8Array(100).fill(-65),
        servingIndex: new Uint8Array(100).fill(0),
        servingAccessPointIds: [devIds[1] as never],
        createdAt: Date.now() as EpochMs,
      };

      const mockCov: CoverageResult = {
        isEstimate: true,
        model: "logDistance",
        coveragePercent: 92.5,
        minimumAcceptableRssiDbm: -75,
        includedCellCount: 100,
        coveredCellCount: 92,
        classCounts: [
          { class: "excellent", cellCount: 50, areaM2: 200 },
          { class: "good", cellCount: 42, areaM2: 170 },
        ],
        deadZones: [],
        grid: {
          blobId,
          width: 10,
          height: 10,
          cellSizeM: 1,
          topLeftLocalM: { x: 0, y: 0, coordinateSpace: "projectMetric" },
          totalIncludedCells: 100,
          rasterEncoding: "int8-rssi-dBm",
          servingIndexEncoding: "uint8-access-point-index-with-mask-sentinels",
          noSignalRssiDbm: -127,
          outsideMaskIndex: 254,
          noServingIndex: 255,
        },
        parameters: agg!.project.settings.coverage,
        referenceReceiverGainDbi: 0,
        limitationNotes: [],
      };

      const covRec: AnalysisRecord = {
        id: "ana_cov_1" as AnalysisId,
        projectId,
        designId: baselineDesignId,
        type: "coverage",
        engineId: "coverage",
        engineVersion: 1,
        inputHash: covHash,
        parameters: { type: "coverage", settings: agg!.project.settings.coverage },
        isEstimate: true,
        computedAt: Date.now() as EpochMs,
        result: mockCov,
      };
      await repos.analyses.put(covRec, mockCovBlob);

      const simInput = buildSimulationEngineInput(agg!);
      const simHash = await container.hashService.hashCanonical(simInput);
      const mockSim: SimulationResult = {
        isEstimate: true,
        routingAlgorithm: "dijkstra",
        graphModel: "undirected",
        baselineMetrics: {
          totalFlowCount: 1,
          reachableFlowCount: 1,
          unreachableFlowCount: 0,
          incompleteFlowCount: 0,
          completeness: "complete",
          aggregateOfferedDemandMbps: 100,
          aggregateDeliveredRateMbps: 100,
          meanReachableLatencyMs: 0.851,
          maxReachableLatencyMs: 0.851,
          latencyFlowCount: 1,
          linkUtilization: [],
        },
        baselineFlows: [
          {
            flowId: "flow-1" as never,
            sourceSubnetId: "sub-1" as never,
            sourceDeviceId: devIds[0] as never,
            destinationDeviceId: devIds[1] as never,
            reachable: true,
            unreachableReason: null,
            throughputCompleteness: "complete",
            pathDeviceIds: [devIds[0] as never, devIds[1] as never],
            pathLinkIds: ["link-1" as never],
            hopCount: 1,
            offeredDemandMbps: 100,
            bottleneckCapacityMbps: 1000,
            deliveredRateMbps: 100,
            latency: {
              propagationMs: 0.001,
              transmissionMs: 0.8,
              processingMs: 0.05,
              queueingMs: null,
              totalMs: 0.851,
            },
            issues: [],
          },
        ],
        scenarios: [],
        assumptions: agg!.project.settings.simulation,
        limitations: [],
      };

      const simRec: AnalysisRecord = {
        id: "ana_sim_1" as AnalysisId,
        projectId,
        designId: baselineDesignId,
        type: "simulation",
        engineId: "simulation",
        engineVersion: 1,
        inputHash: simHash,
        parameters: {
          type: "simulation",
          settings: agg!.project.settings.simulation,
          setup: { flows: [], failureScenarios: [] },
        },
        isEstimate: true,
        computedAt: Date.now() as EpochMs,
        result: mockSim,
      };
      await repos.analyses.put(simRec);

      // 2. Build report model
      const report = await reportService.buildReportModel(projectId, baselineDesignId);

      // Verify sections and freshness
      expect(report.project.name).toBe("Campus High-Speed Network");
      expect(report.devices.length).toBe(2);
      expect(report.links.length).toBe(1);
      expect(report.subnets.length).toBe(1);

      expect(report.cost.status).toBe("current");
      expect(report.coverage.status).toBe("current");
      expect(report.simulation.status).toBe("current");

      expect(report.cost.result?.tco.total?.amount).toBe(220000);
      expect(report.coverage.result?.coveragePercent).toBe(92.5);
      expect(report.simulation.result?.baselineMetrics.totalFlowCount).toBe(1);

      // Verify getCoverageBlob
      const blob = await reportService.getCoverageBlob(baselineDesignId);
      expect(blob).not.toBeNull();
      expect(blob?.id).toBe(blobId);
    });

    it("identifies missing analyses and does not silently recalculate them", async () => {
      // Create empty design without any analyses stored
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "Uncomputed Project",
        initialRegion: {
          label: "Site Alpha",
          center: makeGeoPoint(77.5, 12.9),
          bbox: null,
        },
      });

      const report = await reportService.buildReportModel(projectId, baselineDesignId);

      // Expect analyses to be reported as missing, not silently computed
      expect(report.coverage.status).toBe("missing");
      expect(report.cost.status).toBe("missing");
      expect(report.simulation.status).toBe("missing");
      expect(report.coverage.result).toBeNull();
      expect(report.cost.result).toBeNull();
      expect(report.simulation.result).toBeNull();

      // Repositories should still have zero analysis records
      const costRec = await repos.analyses.getLatest(baselineDesignId, "cost");
      expect(costRec).toBeNull();
    });

    it("identifies stale analyses when design is mutated after calculation", async () => {
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "Stale Analysis Test",
        initialRegion: {
          label: "Site Beta",
          center: makeGeoPoint(77.5, 12.9),
          bbox: null,
        },
      });

      const proj = await repos.projects.get(projectId);

      // Save an analysis record with an old revision / mismatching input hash
      const staleRec: AnalysisRecord = {
        id: "ana_stale_1" as AnalysisId,
        projectId,
        designId: baselineDesignId,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash: "old_obsolete_hash" as never,
        parameters: { type: "cost", settings: proj!.settings.cost },
        isEstimate: true,
        computedAt: (Date.now() - 50000) as EpochMs,
        result: {
          isEstimate: true,
          currency: "INR",
          completeness: "complete",
          capex: {
            knownSubtotal: { amount: 10000, currency: "INR" },
            total: { amount: 10000, currency: "INR" },
            completeness: "complete",
          },
          annualOpex: {
            knownSubtotal: { amount: 1000, currency: "INR" },
            total: { amount: 1000, currency: "INR" },
            completeness: "complete",
          },
          tco: {
            knownSubtotal: { amount: 13000, currency: "INR" },
            total: { amount: 13000, currency: "INR" },
            completeness: "complete",
          },
          tcoHorizonYears: 3,
          byCategory: {},
          lineItems: [],
          issues: [],
          assumptions: {
            settings: proj!.settings.cost,
            devicePowerDutyRatio: 1,
          },
        },
      };

      await repos.analyses.put(staleRec);

      const report = await reportService.buildReportModel(projectId, baselineDesignId);

      // Must be marked outOfDate, NOT current or missing
      expect(report.cost.status).toBe("outOfDate");
      expect(report.cost.result?.tco.total?.amount).toBe(13000);

      // Must not have silently overwritten the record
      const stored = await repos.analyses.getLatest(baselineDesignId, "cost");
      expect(stored?.inputHash).toBe("old_obsolete_hash");
    });
  });

  describe("P4-01B: PDF Generator", () => {
    it("generates a valid PDF Blob with all 9 sections without Leaflet map capture", async () => {
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "PDF Generator Campus Test",
        initialRegion: {
          label: "Central Quad",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      await session.open(baselineDesignId);
      const res = await session.dispatch({
        type: "device/add",
        catalogItemId: SWITCH_CAT_ID,
        position: makeGeoPoint(77.5946, 12.9716),
        name: "Switch 1",
      });
      expect(res.status).toBe("committed");

      const report = await reportService.buildReportModel(projectId, baselineDesignId);
      const pdfBlob = await generateEngineeringReportPdf(report, null);

      expect(pdfBlob).toBeInstanceOf(Blob);
      expect(pdfBlob.type).toBe("application/pdf");
      expect(pdfBlob.size).toBeGreaterThan(1000);
    });
  });

  describe("P4-01C: ReportView Component", () => {
    it("renders all 9 approved sections with TOC rail, badges and disclaimers", async () => {
      const { projectId, baselineDesignId } = await projectService.createProject({
        name: "Full Report Preview Test",
        initialRegion: {
          label: "Admin Block",
          center: makeGeoPoint(77.5946, 12.9716),
          bbox: null,
        },
      });

      render(
        <MemoryRouter initialEntries={[`/projects/${projectId}/designs/${baselineDesignId}/report`]}>
          <Routes>
            <Route
              path="/projects/:projectId/designs/:designId/report"
              element={<ReportView />}
            />
          </Routes>
        </MemoryRouter>
      );

      // Loading state
      expect(screen.getByText(/Assembling report preview from local data\.\.\./i)).toBeInTheDocument();

      // Wait for report preview to render
      await waitFor(() => {
        expect(screen.getByText("Report Contents")).toBeInTheDocument();
      });

      // Verify Table of Contents rail
      expect(screen.getByText("Cover & Summary")).toBeInTheDocument();
      expect(screen.getByText("Equipment Inventory")).toBeInTheDocument();
      expect(screen.getByText("Geographical Figure")).toBeInTheDocument();
      expect(screen.getByText("Logical Topology")).toBeInTheDocument();
      expect(screen.getByText("IPv4 Addressing Plan")).toBeInTheDocument();
      expect(screen.getByText("Cost Estimation")).toBeInTheDocument();
      expect(screen.getByText("Wireless Coverage")).toBeInTheDocument();
      expect(screen.getByText("Network Simulation")).toBeInTheDocument();
      expect(screen.getByText("Assumptions & Disclaimers")).toBeInTheDocument();

      // Verify 9 document sections
      expect(screen.getByText("Full Report Preview Test")).toBeInTheDocument();
      expect(screen.getByText("1. Equipment Inventory & Interconnects")).toBeInTheDocument();
      expect(screen.getByText("2. Schematic Geographical Figure")).toBeInTheDocument();
      expect(screen.getByText("3. Logical Topology Figure")).toBeInTheDocument();
      expect(screen.getByText("4. IPv4 Addressing & VLSM Plan")).toBeInTheDocument();
      expect(screen.getByText("5. Cost Estimation")).toBeInTheDocument();
      expect(screen.getByText("6. Wireless Coverage Analysis")).toBeInTheDocument();
      expect(screen.getByText("7. Network Simulation & Failure Scenarios")).toBeInTheDocument();
      expect(screen.getByText("8. Engineering Assumptions & Disclaimers")).toBeInTheDocument();

      // Since analyses were not computed, verify missing badges/disclaimers
      expect(screen.getByText(/Wireless coverage has not been computed for this design/i)).toBeInTheDocument();
      expect(screen.getByText(/Simulation has not been computed for this design/i)).toBeInTheDocument();
      expect(screen.getByText(/Cost analysis has not been calculated for this design/i)).toBeInTheDocument();

      // Verify Download button exists
      const downloadBtn = screen.getByRole("button", { name: /Download PDF/i });
      expect(downloadBtn).toBeInTheDocument();

      // Click Download button
      fireEvent.click(downloadBtn);

      await waitFor(() => {
        expect(screen.queryByText(/Generating PDF\.\.\./i)).not.toBeInTheDocument();
      });
    });
  });
});
