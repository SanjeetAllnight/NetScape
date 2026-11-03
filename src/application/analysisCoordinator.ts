/**
 * Analysis Coordinator service.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.7
 *
 * Coordinates:
 * - Read-only freshness inspection (never triggers engines)
 * - Worker execution for coverage and simulation
 * - Synchronous engine execution for cost
 * - Input hashing strictly outside Dexie transactions
 * - Analysis cache retention and blob retrieval
 */

import type {
  AnalysisCoordinator,
  AnalysisInspection,
  AnalysisFreshnessEntry,
  AnalysisRunResult,
} from "@/contracts/services";
import type { DesignId, ProjectId, CatalogItemId, AnalysisId, EpochMs } from "@/contracts/primitives";
import type { AnalysisType } from "@/contracts/enums";
import type {
  AnalysisRecord,
  AnalysisBlob,
  HashService,
  DesignStamp,
} from "@/contracts/engines";
import type { Repositories } from "@/contracts/storage";
import type { WorkerClient } from "@/contracts/workers";
import {
  buildCostEngineInput,
  buildCoverageEngineInput,
  buildSimulationEngineInput,
} from "@/domain/inputBuilders";
import { defaultCostEngine } from "@/engines/cost";
import { EngineInputError } from "@/contracts/errors";

export class DefaultAnalysisCoordinator implements AnalysisCoordinator {
  constructor(
    private readonly repos: Repositories,
    private readonly workerClient: WorkerClient,
    private readonly hashService: HashService
  ) {}

  async inspect(designId: DesignId): Promise<AnalysisInspection> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new EngineInputError(`Design aggregate not found for inspection: ${designId}`);
    }

    const inspectType = async (type: AnalysisType): Promise<AnalysisFreshnessEntry> => {
      let inputToHash: unknown;
      if (type === "cost") {
        inputToHash = buildCostEngineInput(aggregate);
      } else if (type === "coverage") {
        inputToHash = buildCoverageEngineInput(aggregate);
      } else {
        inputToHash = buildSimulationEngineInput(aggregate);
      }

      const currentInputHash = await this.hashService.hashCanonical(inputToHash);
      const cached = await this.repos.analyses.findByHash(designId, type, currentInputHash);

      if (cached) {
        return {
          type,
          status: "current",
          currentInputHash,
          record: cached,
        };
      }

      const latest = await this.repos.analyses.getLatest(designId, type);
      if (latest) {
        return {
          type,
          status: "outOfDate",
          currentInputHash,
          record: latest,
        };
      }

      return {
        type,
        status: "notCalculated",
        currentInputHash,
        record: null,
      };
    };

    const [cost, coverage, simulation] = await Promise.all([
      inspectType("cost"),
      inspectType("coverage"),
      inspectType("simulation"),
    ]);

    return {
      designId,
      byType: {
        cost,
        coverage,
        simulation,
      },
    };
  }

  async refreshProject(_projectId: ProjectId): Promise<void> {
    // Read-only freshness inspection handles lazy re-computation; no-op in skeleton
  }

  async refreshCatalogItem(_catalogItemId: CatalogItemId): Promise<void> {
    // Lazy freshness inspection; no-op in skeleton
  }

  async run(type: "cost" | "coverage" | "simulation", designId: DesignId): Promise<AnalysisRunResult> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new EngineInputError(`Design not found: ${designId}`);
    }

    if (type === "cost") {
      const input = buildCostEngineInput(aggregate);
      const inputHash = await this.hashService.hashCanonical(input);

      const cached = await this.repos.analyses.findByHash(designId, "cost", inputHash);
      if (cached) {
        return { record: cached, cacheHit: true, freshness: "current" };
      }

      const result = defaultCostEngine.estimate(input);
      const record: AnalysisRecord = {
        id: `ana_cost_${Date.now()}` as AnalysisId,
        projectId: aggregate.project.id,
        designId,
        type: "cost",
        engineId: "cost",
        engineVersion: 1,
        inputHash,
        parameters: { type: "cost", settings: aggregate.project.settings.cost },
        isEstimate: true,
        computedAt: Date.now() as EpochMs,
        result,
      };

      await this.repos.analyses.put(record);
      return { record, cacheHit: false, freshness: "current" };
    }

    if (type === "coverage") {
      const input = buildCoverageEngineInput(aggregate);
      const inputHash = await this.hashService.hashCanonical(input);

      const cached = await this.repos.analyses.findByHash(designId, "coverage", inputHash);
      if (cached) {
        return { record: cached, cacheHit: true, freshness: "current" };
      }

      const stamp: DesignStamp = {
        projectId: aggregate.project.id,
        designId,
        projectRevision: aggregate.project.revision,
        designRevision: aggregate.design.revision,
        inputHash,
      };

      const handle = this.workerClient.run("coverage.compute", input, stamp);
      const workerOutput = await handle.result;

      const record: AnalysisRecord = {
        id: `ana_cov_${Date.now()}` as AnalysisId,
        projectId: aggregate.project.id,
        designId,
        type: "coverage",
        engineId: "coverage",
        engineVersion: 1,
        inputHash,
        parameters: { type: "coverage", settings: aggregate.project.settings.coverage },
        isEstimate: true,
        computedAt: Date.now() as EpochMs,
        result: {
          ...workerOutput.result,
          grid: {
            ...workerOutput.result.grid,
            blobId: `blob_cov_${Date.now()}` as never,
          },
        },
      };

      await this.repos.analyses.put(record);
      return { record, cacheHit: false, freshness: "current" };
    }

    // Simulation
    const input = buildSimulationEngineInput(aggregate);
    const inputHash = await this.hashService.hashCanonical(input);

    const cached = await this.repos.analyses.findByHash(designId, "simulation", inputHash);
    if (cached) {
      return { record: cached, cacheHit: true, freshness: "current" };
    }

    const stamp: DesignStamp = {
      projectId: aggregate.project.id,
      designId,
      projectRevision: aggregate.project.revision,
      designRevision: aggregate.design.revision,
      inputHash,
    };

    const handle = this.workerClient.run("simulation.run", input, stamp);
    const workerOutput = await handle.result;

    const record: AnalysisRecord = {
      id: `ana_sim_${Date.now()}` as AnalysisId,
      projectId: aggregate.project.id,
      designId,
      type: "simulation",
      engineId: "simulation",
      engineVersion: 1,
      inputHash,
      parameters: {
        type: "simulation",
        settings: aggregate.project.settings.simulation,
        setup: aggregate.design.simulationSetup,
      },
      isEstimate: true,
      computedAt: Date.now() as EpochMs,
      result: workerOutput.result,
    };

    await this.repos.analyses.put(record);
    return { record, cacheHit: false, freshness: "current" };
  }

  async cancel(_type: "coverage" | "simulation", _designId: DesignId): Promise<void> {
    // Cancellation is managed by active request ID in WorkerClient
  }

  async getLatest(designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null> {
    return this.repos.analyses.getLatest(designId, type);
  }

  async getCoverageBlob(
    record: Extract<AnalysisRecord, { type: "coverage" }>
  ): Promise<AnalysisBlob | null> {
    return this.repos.analyses.getBlob(record.result.grid.blobId);
  }
}
