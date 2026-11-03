/**
 * Storage records, preferences, duplication bundles, and repository interfaces.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §9, §17.1
 */

import type {
  ProjectId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  CatalogItemId,
  AnalysisId,
  AnalysisBlobId,
  EpochMs,
  InputHash,
  IdGenerator,
} from "./primitives";

import type { DeviceType, AnalysisType } from "./enums";

import type {
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  DeviceCatalogItem,
  ProjectSettings,
  DesignAggregate,
} from "./domain";

import type { DesignChangeSet } from "./commands";
import type { AnalysisRecord, AnalysisBlob } from "./engines";

export interface AppMetaRecord {
  key: string;
  value: AppPreferenceValue;
  updatedAt: EpochMs;
}

export interface AppPreferences {
  autoRecalculateCoverage: boolean; // default false
  distanceDisplayUnit: "m" | "km"; // default "m"
  areaDisplayUnit: "m2" | "km2"; // default "m2"
}

export type AppPreferenceValue = boolean | string | number;

export interface RevisionExpectation {
  projectRevision: number;
  designRevision: number;
}

export interface ProjectDuplicationBundle {
  project: Project; // new ProjectId and regionId; source settings/frame copied
  region: MapRegion; // new MapRegionId and projectId
  designs: Design[]; // new DesignIds; exactly one copied baseline remains baseline
  devices: Device[]; // all design IDs and entity IDs remapped
  links: Link[]; // link IDs and endpoint IDs remapped
  subnets: Subnet[]; // IDs and servedBy/link references remapped
  obstacles: Obstacle[]; // obstacle IDs and projectId remapped
}

export interface ProjectRepository {
  list(): Promise<Project[]>;
  get(projectId: ProjectId): Promise<Project | null>;
  createWithBaseline(input: {
    project: Project;
    region: MapRegion;
    baseline: Design;
  }): Promise<void>;
  duplicateWithContents(
    input: ProjectDuplicationBundle
  ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }>;
  rename(projectId: ProjectId, name: string, updatedAt: EpochMs): Promise<Project>;
  updateSettings(
    projectId: ProjectId,
    settings: ProjectSettings,
    expectedRevision: number,
    updatedAt: EpochMs
  ): Promise<Project>;
  updateRegion(region: MapRegion, expectedProjectRevision: number): Promise<void>;
  delete(projectId: ProjectId, expectedRevision: number): Promise<void>;
  markOpened(projectId: ProjectId, at: EpochMs): Promise<void>;
}

export interface DesignRepository {
  listByProject(projectId: ProjectId): Promise<Design[]>;
  get(designId: DesignId): Promise<Design | null>;
  loadAggregate(designId: DesignId): Promise<DesignAggregate>;
  commit(changeSet: DesignChangeSet, expected: RevisionExpectation): Promise<void>;
  duplicate(
    designId: DesignId,
    newDesignId: DesignId,
    ids: IdGenerator,
    name: string,
    at: EpochMs
  ): Promise<DesignId>;
  setBaseline(
    projectId: ProjectId,
    designId: DesignId,
    expectedProjectRevision: number,
    at: EpochMs
  ): Promise<void>;
  delete(
    designId: DesignId,
    replacementBaselineId: DesignId | null,
    expectedProjectRevision: number
  ): Promise<void>;
}

export interface DeviceRepository {
  listByDesign(designId: DesignId): Promise<Device[]>;
  listByCatalogItem(catalogItemId: CatalogItemId): Promise<Device[]>; // used to find designs affected by catalogue edits
  get(deviceId: DeviceId): Promise<Device | null>;
}

export interface LinkRepository {
  listByDesign(designId: DesignId): Promise<Link[]>;
  get(linkId: LinkId): Promise<Link | null>;
}

export interface SubnetRepository {
  listByDesign(designId: DesignId): Promise<Subnet[]>;
  get(subnetId: SubnetId): Promise<Subnet | null>;
}

export interface ObstacleRepository {
  listByProject(projectId: ProjectId): Promise<Obstacle[]>;
  get(obstacleId: ObstacleId): Promise<Obstacle | null>;
}

export interface CatalogRepository {
  list(filters?: { type?: DeviceType; query?: string }): Promise<DeviceCatalogItem[]>;
  get(catalogItemId: CatalogItemId): Promise<DeviceCatalogItem | null>;
  createCustom(item: DeviceCatalogItem): Promise<void>;
  updateCustom(item: DeviceCatalogItem): Promise<void>;
  deleteCustom(catalogItemId: CatalogItemId): Promise<void>; // rejects if referenced
  seedBuiltIns(version: number, items: DeviceCatalogItem[]): Promise<void>;
}

export interface AnalysisRepository {
  findByHash(
    designId: DesignId,
    type: AnalysisType,
    inputHash: InputHash
  ): Promise<AnalysisRecord | null>;
  getLatest(designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null>;
  getBlob(blobId: AnalysisBlobId): Promise<AnalysisBlob | null>;
  put(record: AnalysisRecord, blob?: AnalysisBlob): Promise<void>;
  deleteRecord(analysisId: AnalysisId): Promise<void>;
  clearDerivedCache(projectId?: ProjectId): Promise<{ deletedRecords: number; deletedBlobs: number }>;
  prune(maxPerDesignAndType: number): Promise<{ deletedRecords: number; deletedBlobs: number }>;
}

export interface Repositories {
  projects: ProjectRepository;
  designs: DesignRepository;
  devices: DeviceRepository;
  links: LinkRepository;
  subnets: SubnetRepository;
  obstacles: ObstacleRepository;
  catalog: CatalogRepository;
  analyses: AnalysisRepository;
}
