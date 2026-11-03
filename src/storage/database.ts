/**
 * Production Dexie IndexedDB database instance for NetScape.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §9.2
 */

import Dexie, { type EntityTable } from "dexie";
import { DATABASE_NAME, DATABASE_VERSION } from "@/contracts/constants";
import type {
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  DeviceCatalogItem,
} from "@/contracts/domain";
import type { AnalysisRecord, AnalysisBlob } from "@/contracts/engines";
import type { AppMetaRecord } from "@/contracts/storage";

export class NetScapeDatabase extends Dexie {
  projects!: EntityTable<Project, "id">;
  designs!: EntityTable<Design, "id">;
  devices!: EntityTable<Device, "id">;
  links!: EntityTable<Link, "id">;
  subnets!: EntityTable<Subnet, "id">;
  obstacles!: EntityTable<Obstacle, "id">;
  deviceCatalog!: EntityTable<DeviceCatalogItem, "id">;
  analysisCache!: EntityTable<AnalysisRecord, "id">;
  analysisBlobs!: EntityTable<AnalysisBlob, "id">;
  mapRegions!: EntityTable<MapRegion, "id">;
  appMeta!: EntityTable<AppMetaRecord, "key">;

  constructor(databaseName: string = DATABASE_NAME) {
    super(databaseName);

    this.version(DATABASE_VERSION).stores({
      projects: "&id, name, lastOpenedAt, updatedAt, regionId",
      designs: "&id, projectId, parentDesignId, createdAt, updatedAt",
      devices: "&id, designId, catalogItemId, type, name, updatedAt",
      links: "&id, designId, sourceDeviceId, targetDeviceId, medium, updatedAt",
      subnets: "&id, designId, name, servedByDeviceId, linkId, updatedAt",
      obstacles: "&id, projectId, material, updatedAt",
      deviceCatalog: "&id, type, origin, label, updatedAt",
      analysisCache:
        "&id, designId, type, inputHash, computedAt, [designId+type+inputHash], [designId+type+computedAt]",
      analysisBlobs: "&id, analysisId, designId",
      mapRegions: "&id, &projectId, updatedAt",
      appMeta: "&key",
    });
  }
}

let defaultDbInstance: NetScapeDatabase | null = null;

export function getDatabase(): NetScapeDatabase {
  if (!defaultDbInstance) {
    defaultDbInstance = new NetScapeDatabase();
  }
  return defaultDbInstance;
}

