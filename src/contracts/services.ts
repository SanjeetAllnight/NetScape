/**
 * Application services, geocoding, events, and coordination contracts.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17
 */

import type {
  ProjectId,
  DesignId,
  CatalogItemId,
  EpochMs,
  InputHash,
  GeoPoint,
  BoundingBox,
  IPv4Cidr,
} from "./primitives";

import type { DeviceType, AnalysisType, SubnetAllocationStatus } from "./enums";
import type { Project, Design, Subnet, DeviceCatalogItem, ProjectSettings, MapRegion } from "./domain";
import type { AppPreferences } from "./storage";
import type { DesignChangeSet, DispatchResult, DeepPartial } from "./commands";
import type { AnalysisRecord, AnalysisBlob, VlsmEngineOutput } from "./engines";

export interface GeocodeResult {
  providerId: string;
  label: string;
  center: GeoPoint;
  bbox: BoundingBox;
}

export interface GeocodingService {
  search(
    query: string,
    options?: { signal?: AbortSignal; limit?: number; viewbox?: BoundingBox }
  ): Promise<GeocodeResult[]>;
}

export interface TileSourceConfig {
  urlTemplate: string;
  attribution: string;
  maxZoom: number;
  minZoom: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  initialRegion: {
    label: string;
    center: GeoPoint;
    bbox: BoundingBox | null;
  };
}

export interface DuplicateProjectInput {
  sourceProjectId: ProjectId;
  name?: string;
}

export interface ProjectWorkspaceSummary {
  project: Project;
  designs: Design[];
  baselineDesignId: DesignId;
}

export interface ProjectService {
  listProjects(): Promise<Project[]>;
  getProject(projectId: ProjectId): Promise<Project | null>;
  listDesigns(projectId: ProjectId): Promise<Design[]>;
  openProject(projectId: ProjectId): Promise<ProjectWorkspaceSummary>; // marks lastOpenedAt after successful read
  createProject(
    input: CreateProjectInput
  ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }>;
  duplicateProject(
    input: DuplicateProjectInput
  ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }>;
  renameProject(projectId: ProjectId, name: string): Promise<Project>;
  deleteProject(projectId: ProjectId): Promise<void>;
  updateProjectSettings(
    projectId: ProjectId,
    patch: DeepPartial<ProjectSettings>
  ): Promise<Project>;
  setProjectRegion(
    projectId: ProjectId,
    patch: Partial<Pick<MapRegion, "label" | "center" | "bbox" | "boundary">>
  ): Promise<void>;
  duplicateDesign(designId: DesignId, name?: string): Promise<DesignId>;
  renameDesign(designId: DesignId, name: string): Promise<Design>;
  deleteDesign(designId: DesignId, replacementBaselineId?: DesignId): Promise<void>;
  setBaseline(projectId: ProjectId, designId: DesignId): Promise<void>;
  setAppPreference<K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ): Promise<void>;
}

export interface AddressingSnapshot {
  designId: DesignId;
  parentCidr: IPv4Cidr | null;
  allocationStatus: SubnetAllocationStatus;
  subnets: Subnet[];
  preview: VlsmEngineOutput | null;
  isPreviewCurrent: boolean;
}

export interface AddressingService {
  getSnapshot(designId: DesignId): Promise<AddressingSnapshot>;
  setParentCidr(designId: DesignId, parentCidr: IPv4Cidr | null): Promise<DispatchResult>;
  allocate(designId: DesignId): Promise<VlsmEngineOutput>;
}

export type CreateCustomCatalogItemInput = Omit<
  DeviceCatalogItem,
  "id" | "origin" | "builtInCatalogVersion" | "createdAt" | "updatedAt" | "priceUpdatedAt"
> & { priceUpdatedAt?: EpochMs | null };

export interface CatalogService {
  listItems(filters?: { type?: DeviceType; query?: string }): Promise<DeviceCatalogItem[]>;
  getItem(catalogItemId: CatalogItemId): Promise<DeviceCatalogItem | null>;
  createCustomItem(input: CreateCustomCatalogItemInput): Promise<DeviceCatalogItem>;
  updateCustomItem(
    catalogItemId: CatalogItemId,
    patch: Partial<Omit<CreateCustomCatalogItemInput, "type">>
  ): Promise<DeviceCatalogItem>;
  deleteCustomItem(catalogItemId: CatalogItemId): Promise<void>;
}

export interface MapWorkspaceService {
  searchLocations(
    query: string,
    options?: { signal?: AbortSignal; limit?: number; viewbox?: BoundingBox }
  ): Promise<GeocodeResult[]>;
  getTileSourceConfig(): TileSourceConfig;
}

export interface ProjectDataChangedEvent {
  projectId: ProjectId;
  projectRevision: number;
  source: "settings" | "region" | "obstacles";
}

export interface CatalogItemChangedEvent {
  catalogItemId: CatalogItemId;
  action: "created" | "updated" | "deleted";
}

export interface ApplicationDataEvents {
  onProjectDataChanged(listener: (event: ProjectDataChangedEvent) => void): () => void;
  onCatalogItemChanged(listener: (event: CatalogItemChangedEvent) => void): () => void;
}

export interface AnalysisFreshnessEntry {
  type: AnalysisType;
  status: "notCalculated" | "current" | "outOfDate";
  currentInputHash: InputHash;
  record: AnalysisRecord | null;
}

export interface AnalysisInspection {
  designId: DesignId;
  byType: Record<AnalysisType, AnalysisFreshnessEntry>;
}

export interface DesignCommittedEvent {
  projectId: ProjectId;
  designId: DesignId;
  changeSet: DesignChangeSet;
  projectRevision: number;
  designRevision: number;
}

export interface DesignEvents {
  on(event: "committed", listener: (payload: DesignCommittedEvent) => void): () => void;
  on(event: "opened", listener: (payload: { designId: DesignId }) => void): () => void;
  on(event: "closed", listener: (payload: { designId: DesignId }) => void): () => void;
}

export interface AnalysisRunProgress {
  type: AnalysisType;
  designId: DesignId;
  fraction: number;
  phase: string;
}

export interface AnalysisRunResult {
  record: AnalysisRecord;
  cacheHit: boolean;
  freshness: "current" | "outOfDate";
}

export interface AnalysisCoordinator {
  inspect(designId: DesignId): Promise<AnalysisInspection>; // read-only freshness inspection; never runs engines
  refreshProject(projectId: ProjectId): Promise<void>; // rehash all designs; no calculations
  refreshCatalogItem(catalogItemId: CatalogItemId): Promise<void>; // rehash only designs referencing the item
  run(type: "cost", designId: DesignId): Promise<AnalysisRunResult>;
  run(type: "coverage", designId: DesignId): Promise<AnalysisRunResult>;
  run(type: "simulation", designId: DesignId): Promise<AnalysisRunResult>;
  cancel(type: "coverage" | "simulation", designId: DesignId): Promise<void>;
  getLatest(designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null>;
  getCoverageBlob(
    record: Extract<AnalysisRecord, { type: "coverage" }>
  ): Promise<AnalysisBlob | null>;
}
