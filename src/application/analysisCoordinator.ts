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
 * - Ephemeral projection publication to useAnalysisStore
 */

import type {
  AnalysisCoordinator,
  AnalysisInspection,
  AnalysisFreshnessEntry,
  AnalysisRunResult,
} from "@/contracts/services";
import type { DesignId, ProjectId, CatalogItemId, AnalysisId, AnalysisBlobId, EpochMs } from "@/contracts/primitives";
import type { AnalysisType } from "@/contracts/enums";
import type {
  AnalysisRecord,
  AnalysisBlob,
  HashService,
  DesignStamp,
} from "@/contracts/engines";
import type { Repositories } from "@/contracts/storage";
import type { WorkerClient, WorkerProgressMessage } from "@/contracts/workers";
import {
  buildCostEngineInput,
  buildCoverageEngineInput,
  buildSimulationEngineInput,
} from "@/domain/inputBuilders";
import { defaultCostEngine } from "@/engines/cost";
import { EngineInputError } from "@/contracts/errors";
import { useAnalysisStore } from "@/stores/analysisStore";

export class DefaultAnalysisCoordinator implements AnalysisCoordinator {
  private readonly activeRequests = new Map<string, string>();

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
        useAnalysisStore.getState().setRecord(type, cached, currentInputHash);
        if (type === "coverage") {
          const covRecord = cached as Extract<AnalysisRecord, { type: "coverage" }>;
          const blob = await this.repos.analyses.getBlob(covRecord.result.grid.blobId);
          if (blob) {
            useAnalysisStore.getState().setCoverageBlob(blob);
          }
        }
        return {
          type,
          status: "current",
          currentInputHash,
          record: cached,
        };
      }

      const latest = await this.repos.analyses.getLatest(designId, type);
      if (latest) {
        useAnalysisStore.getState().setRecord(type, latest, currentInputHash);
        useAnalysisStore.getState().markStale(type);
        if (type === "coverage") {
          const covRecord = latest as Extract<AnalysisRecord, { type: "coverage" }>;
          const blob = await this.repos.analyses.getBlob(covRecord.result.grid.blobId);
          if (blob) {
            useAnalysisStore.getState().setCoverageBlob(blob);
          }
        }
        return {
          type,
          status: "outOfDate",
          currentInputHash,
          record: latest,
        };
      }

      useAnalysisStore.getState().setRecord(type, null, currentInputHash);
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
    // Read-only freshness inspection handles lazy re-computation
  }

  async refreshCatalogItem(_catalogItemId: CatalogItemId): Promise<void> {
    // Lazy freshness inspection handles catalog item changes
  }

  async run(type: "cost" | "coverage" | "simulation", designId: DesignId): Promise<AnalysisRunResult> {
    const aggregate = await this.repos.designs.loadAggregate(designId);
    if (!aggregate) {
      throw new EngineInputError(`Design not found: ${designId}`);
    }

    useAnalysisStore.getState().setStatus(type, "computing");
    useAnalysisStore.getState().setProgress(type, 0);

    try {
      if (type === "cost") {
        const input = buildCostEngineInput(aggregate);
        const inputHash = await this.hashService.hashCanonical(input);

        const cached = await this.repos.analyses.findByHash(designId, "cost", inputHash);
        if (cached) {
          useAnalysisStore.getState().setRecord("cost", cached, inputHash);
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
        useAnalysisStore.getState().setRecord("cost", record, inputHash);
        return { record, cacheHit: false, freshness: "current" };
      }

      if (type === "coverage") {
        const input = buildCoverageEngineInput(aggregate);
        const inputHash = await this.hashService.hashCanonical(input);

        const cached = await this.repos.analyses.findByHash(designId, "coverage", inputHash);
        if (cached) {
          const covRecord = cached as Extract<AnalysisRecord, { type: "coverage" }>;
          const blob = await this.repos.analyses.getBlob(covRecord.result.grid.blobId);
          useAnalysisStore.getState().setRecord("coverage", cached, inputHash);
          if (blob) {
            useAnalysisStore.getState().setCoverageBlob(blob);
          }
          return { record: cached, cacheHit: true, freshness: "current" };
        }

        const stamp: DesignStamp = {
          projectId: aggregate.project.id,
          designId,
          projectRevision: aggregate.project.revision,
          designRevision: aggregate.design.revision,
          inputHash,
        };

        const handleKey = `${designId}:coverage`;
        const handle = this.workerClient.run(
          "coverage.compute",
          input,
          stamp,
          (progress: WorkerProgressMessage) => {
            useAnalysisStore.getState().setProgress("coverage", progress.fraction);
          }
        );
        this.activeRequests.set(handleKey, handle.requestId);

        let workerOutput;
        try {
          workerOutput = await handle.result;
        } finally {
          this.activeRequests.delete(handleKey);
        }

        const now = Date.now() as EpochMs;
        const blobId = `blob_cov_${now}_${Math.random().toString(36).slice(2, 7)}` as AnalysisBlobId;
        const analysisId = `ana_cov_${now}` as AnalysisId;

        const blob: AnalysisBlob = {
          id: blobId,
          analysisId,
          projectId: aggregate.project.id,
          designId,
          width: workerOutput.result.grid.width,
          height: workerOutput.result.grid.height,
          rssiDbm: workerOutput.rssiDbm,
          servingIndex: workerOutput.servingIndex,
          servingAccessPointIds: workerOutput.servingAccessPointIds,
          createdAt: now,
        };

        const record: AnalysisRecord = {
          id: analysisId,
          projectId: aggregate.project.id,
          designId,
          type: "coverage",
          engineId: "coverage",
          engineVersion: 1,
          inputHash,
          parameters: { type: "coverage", settings: aggregate.project.settings.coverage },
          isEstimate: true,
          computedAt: now,
          result: {
            ...workerOutput.result,
            grid: {
              ...workerOutput.result.grid,
              blobId,
            },
          },
        };

        await this.repos.analyses.put(record, blob);
        useAnalysisStore.getState().setRecord("coverage", record, inputHash);
        useAnalysisStore.getState().setCoverageBlob(blob);
        return { record, cacheHit: false, freshness: "current" };
      }

      // Simulation
      const input = buildSimulationEngineInput(aggregate);
      const inputHash = await this.hashService.hashCanonical(input);

      const cached = await this.repos.analyses.findByHash(designId, "simulation", inputHash);
      if (cached) {
        useAnalysisStore.getState().setRecord("simulation", cached, inputHash);
        return { record: cached, cacheHit: true, freshness: "current" };
      }

      const stamp: DesignStamp = {
        projectId: aggregate.project.id,
        designId,
        projectRevision: aggregate.project.revision,
        designRevision: aggregate.design.revision,
        inputHash,
      };

      const handleKey = `${designId}:simulation`;
      const handle = this.workerClient.run(
        "simulation.run",
        input,
        stamp,
        (progress: WorkerProgressMessage) => {
          useAnalysisStore.getState().setProgress("simulation", progress.fraction);
        }
      );
      this.activeRequests.set(handleKey, handle.requestId);

      let workerOutput;
      try {
        workerOutput = await handle.result;
      } finally {
        this.activeRequests.delete(handleKey);
      }

      const now = Date.now() as EpochMs;
      const record: AnalysisRecord = {
        id: `ana_sim_${now}` as AnalysisId,
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
        computedAt: now,
        result: workerOutput.result,
      };

      await this.repos.analyses.put(record);
      useAnalysisStore.getState().setRecord("simulation", record, inputHash);
      return { record, cacheHit: false, freshness: "current" };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      useAnalysisStore.getState().setError(type, errMsg);
      throw err;
    }
  }

  async cancel(type: "coverage" | "simulation", designId: DesignId): Promise<void> {
    const handleKey = `${designId}:${type}`;
    const requestId = this.activeRequests.get(handleKey);
    if (requestId) {
      await this.workerClient.cancel(requestId);
      this.activeRequests.delete(handleKey);
      useAnalysisStore.getState().setStatus(type, "idle");
    }
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
