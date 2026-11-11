/**
 * Dependency Injection Application Container.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17
 *
 * Instantiates repositories, worker client, hash service, session manager,
 * design session, project service, geocoding service, and analysis coordinator.
 */

import type { Repositories } from "@/contracts/storage";
import type { WorkerClient } from "@/contracts/workers";
import type { HashService } from "@/contracts/engines";
import type {
  AnalysisCoordinator,
  ProjectService,
  GeocodingService,
  TileSourceConfig,
} from "@/contracts/services";
import { NetScapeDatabase } from "@/storage/database";
import { DexieRepositories } from "@/storage/repositories/dexieRepositories";
import { DefaultWorkerClient, type WorkerFactory } from "@/workers/WorkerClient";
import { WebCryptoHashService } from "@/application/hashService";
import { SessionManager, DefaultDesignSession } from "@/application/session";
import { DefaultProjectService } from "@/application/services/ProjectService";
import { DefaultAddressingService } from "@/application/services/AddressingService";
import { DefaultReportService, type ReportService } from "@/application/services/ReportService";
import { NominatimGeocodingService } from "@/services/geocoding/NominatimGeocodingService";
import { OSM_TILE_SOURCE } from "@/services/map/TileSourceConfig";
import { DefaultAnalysisCoordinator } from "@/application/analysisCoordinator";

export interface ApplicationContainer {
  readonly db: NetScapeDatabase;
  readonly repos: Repositories;
  readonly workerClient: WorkerClient;
  readonly hashService: HashService;
  readonly sessionManager: SessionManager;
  readonly designSession: DefaultDesignSession;
  readonly projectService: ProjectService;
  readonly addressingService: DefaultAddressingService;
  readonly reportService: ReportService;
  readonly geocodingService: GeocodingService;
  readonly tileSourceConfig: TileSourceConfig;
  readonly analysisCoordinator: AnalysisCoordinator;
  dispose(): void;
}

export interface ContainerOptions {
  db?: NetScapeDatabase;
  repos?: Repositories;
  workerFactory?: WorkerFactory;
  hashService?: HashService;
  geocodingService?: GeocodingService;
  tileSourceConfig?: TileSourceConfig;
}

export function createApplicationContainer(options: ContainerOptions = {}): ApplicationContainer {
  const db = options.db ?? new NetScapeDatabase();
  const repos = options.repos ?? new DexieRepositories(db);
  const workerClient = new DefaultWorkerClient(options.workerFactory);
  const hashService = options.hashService ?? new WebCryptoHashService();
  const sessionManager = new SessionManager();
  const designSession = new DefaultDesignSession(repos);
  const projectService = new DefaultProjectService(repos);
  const addressingService = new DefaultAddressingService(repos, designSession);
  const geocodingService = options.geocodingService ?? new NominatimGeocodingService();
  const tileSourceConfig = options.tileSourceConfig ?? OSM_TILE_SOURCE;
  const analysisCoordinator = new DefaultAnalysisCoordinator(repos, workerClient, hashService);
  const reportService = new DefaultReportService(repos, analysisCoordinator);

  return {
    db,
    repos,
    workerClient,
    hashService,
    sessionManager,
    designSession,
    projectService,
    addressingService,
    reportService,
    geocodingService,
    tileSourceConfig,
    analysisCoordinator,
    dispose() {
      workerClient.dispose();
      db.close();
    },
  };
}

let defaultContainer: ApplicationContainer | null = null;

export function getApplicationContainer(): ApplicationContainer {
  if (!defaultContainer) {
    defaultContainer = createApplicationContainer();
  }
  return defaultContainer;
}

export function setApplicationContainer(container: ApplicationContainer | null): void {
  defaultContainer = container;
}
