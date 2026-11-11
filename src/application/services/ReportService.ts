import type { ReportModel, ReportAnalysisSection } from "@/contracts/reports";
import type { ProjectId, DesignId, EpochMs } from "@/contracts/primitives";
import type { Repositories } from "@/contracts/storage";
import type { AnalysisCoordinator } from "@/contracts/services";
import type {
  AnalysisBlob,
  CostEstimate,
  CoverageResult,
  SimulationResult,
  AnalysisRecord,
} from "@/contracts/engines";

export interface ReportService {
  buildReportModel(projectId: ProjectId, designId: DesignId): Promise<ReportModel>;
  getCoverageBlob(designId: DesignId): Promise<AnalysisBlob | null>;
}

export class DefaultReportService implements ReportService {
  constructor(
    private readonly repos: Repositories,
    private readonly coordinator: AnalysisCoordinator
  ) {}

  async buildReportModel(projectId: ProjectId, designId: DesignId): Promise<ReportModel> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new Error(`Design aggregate not found for design '${designId}'`);
    }

    if (aggregate.project.id !== projectId) {
      throw new Error(`Design '${designId}' does not belong to project '${projectId}'`);
    }

    const { project, region, design } = aggregate;
    const inspection = await this.coordinator.inspect(designId);

    const mapStatus = (status: "current" | "notCalculated" | "outOfDate", hasRecord: boolean): "current" | "missing" | "outOfDate" => {
      if (!hasRecord || status === "notCalculated") return "missing";
      return status;
    };

    const costRecord = inspection.byType.cost.record;
    const costSection: ReportAnalysisSection<CostEstimate> = {
      status: mapStatus(inspection.byType.cost.status, !!costRecord),
      record: costRecord,
      result: (costRecord?.result as CostEstimate) ?? null,
    };

    const coverageRecord = inspection.byType.coverage.record;
    const coverageSection: ReportAnalysisSection<CoverageResult> = {
      status: mapStatus(inspection.byType.coverage.status, !!coverageRecord),
      record: coverageRecord,
      result: (coverageRecord?.result as CoverageResult) ?? null,
    };

    const simRecord = inspection.byType.simulation.record;
    const simulationSection: ReportAnalysisSection<SimulationResult> = {
      status: mapStatus(inspection.byType.simulation.status, !!simRecord),
      record: simRecord,
      result: (simRecord?.result as SimulationResult) ?? null,
    };

    return {
      generatedAt: Date.now() as EpochMs,
      project,
      region,
      design,
      devices: Object.values(aggregate.devicesById),
      links: Object.values(aggregate.linksById),
      subnets: Object.values(aggregate.subnetsById),
      obstacles: Object.values(aggregate.obstaclesById),
      cost: costSection,
      coverage: coverageSection,
      simulation: simulationSection,
      assumptions: project.settings,
      disclaimers: [
        "Values shown are engineering estimates based on project assumptions and editable sample prices. No supplier quotation or procurement guarantee is implied.",
        "Coverage results are 2D log-distance path loss simulations with fixed wall crossing losses. Actual field RF performance requires on-site validation.",
        "Simulation throughput and delay estimates model reachability, bottleneck capacity, and deterministic propagation/transmission/processing delay. Queueing delay, packet loss, and queue stability are not modeled.",
        "Prices and currency amounts are displayed in INR based on generic vendor-neutral illustrative defaults.",
      ],
    };
  }

  async getCoverageBlob(designId: DesignId): Promise<AnalysisBlob | null> {
    const inspection = await this.coordinator.inspect(designId);
    const rec = inspection.byType.coverage.record;
    if (!rec) return null;
    const covRec = rec as Extract<AnalysisRecord, { type: "coverage" }>;
    return this.repos.analyses.getBlob(covRec.result.grid.blobId);
  }
}
