/**
 * Dependency Injection Application Container.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17
 *
 * Instantiates repositories, worker client, hash service, session manager, and analysis coordinator.
 */

import type { Repositories } from "@/contracts/storage";
import type { WorkerClient } from "@/contracts/workers";
import type { HashService } from "@/contracts/engines";
import type { AnalysisCoordinator } from "@/contracts/services";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { DefaultWorkerClient, type WorkerFactory } from "@/workers/WorkerClient";
import { WebCryptoHashService } from "@/application/hashService";
import { SessionManager } from "@/application/session";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";

export interface ApplicationContainer {
  readonly db: NetScapeDatabase;
  readonly repos: Repositories;
  readonly workerClient: WorkerClient;
  readonly hashService: HashService;
  readonly sessionManager: SessionManager;
  readonly analysisCoordinator: AnalysisCoordinator;
  dispose(): void;
}

export interface ContainerOptions {
  db?: NetScapeDatabase;
  workerFactory?: WorkerFactory;
  hashService?: HashService;
}

export function createApplicationContainer(options: ContainerOptions = {}): ApplicationContainer {
  const db = options.db ?? new NetScapeDatabase();
  const repos = new DexieRepositories(db);
  const workerClient = new DefaultWorkerClient(options.workerFactory);
  const hashService = options.hashService ?? new WebCryptoHashService();
  const sessionManager = new SessionManager();
  const analysisCoordinator = new DefaultAnalysisCoordinator(repos, workerClient, hashService);

  return {
    db,
    repos,
    workerClient,
    hashService,
    sessionManager,
    analysisCoordinator,
    dispose() {
      workerClient.dispose();
      db.close();
    },
  };
}

