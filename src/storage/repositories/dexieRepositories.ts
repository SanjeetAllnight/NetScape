/**
 * Production Dexie Repositories implementation for NetScape.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §9, §17.1
 *
 * Implements transaction atomicity, cascade referential integrity, optimistic concurrency
 * revision checks, duplication with reference remapping, and bounded derived cache pruning.
 */

import Dexie from "dexie";
import type { NetScapeDatabase } from "../database";
import type {
  Repositories,
  ProjectRepository,
  DesignRepository,
  DeviceRepository,
  LinkRepository,
  SubnetRepository,
  ObstacleRepository,
  CatalogRepository,
  AnalysisRepository,
  RevisionExpectation,
  ProjectDuplicationBundle,
} from "@/contracts/storage";
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
  LogicalPoint,
} from "@/contracts/primitives";
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
  SimulationSetup,
} from "@/contracts/domain";
import type { DesignChangeSet } from "@/contracts/commands";
import type { AnalysisRecord, AnalysisBlob } from "@/contracts/engines";
import type { DeviceType, AnalysisType } from "@/contracts/enums";
import { StorageError } from "@/contracts/errors";
import { seedBuiltinCatalog } from "../seed";

export class DexieRepositories implements Repositories {
  constructor(private readonly db: NetScapeDatabase) {}

  /* -------------------------------------------------------------------------- */
  /*                             Project Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly projects: ProjectRepository = {
    list: async (): Promise<Project[]> => {
      return this.db.projects.toArray();
    },

    get: async (projectId: ProjectId): Promise<Project | null> => {
      const p = await this.db.projects.get(projectId);
      return p ?? null;
    },

    createWithBaseline: async (input: {
      project: Project;
      region: MapRegion;
      baseline: Design;
    }): Promise<void> => {
      await this.db.transaction(
        "rw",
        [this.db.projects, this.db.mapRegions, this.db.designs],
        async () => {
          const existing = await this.db.projects.get(input.project.id);
          if (existing) {
            throw new StorageError(
              "STORAGE_WRITE_FAILED",
              `Project '${input.project.id}' already exists`
            );
          }
          await this.db.projects.put(input.project);
          await this.db.mapRegions.put(input.region);
          await this.db.designs.put(input.baseline);
        }
      );
    },

    duplicateWithContents: async (
      input: ProjectDuplicationBundle
    ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }> => {
      return this.db.transaction(
        "rw",
        [
          this.db.projects,
          this.db.mapRegions,
          this.db.designs,
          this.db.devices,
          this.db.links,
          this.db.subnets,
          this.db.obstacles,
        ],
        async () => {
          await this.db.projects.put(input.project);
          await this.db.mapRegions.put(input.region);
          await this.db.designs.bulkPut(input.designs);
          if (input.devices.length > 0) await this.db.devices.bulkPut(input.devices);
          if (input.links.length > 0) await this.db.links.bulkPut(input.links);
          if (input.subnets.length > 0) await this.db.subnets.bulkPut(input.subnets);
          if (input.obstacles.length > 0) await this.db.obstacles.bulkPut(input.obstacles);

          const baseline = input.designs.find((d) => d.isBaseline) ?? input.designs[0];
          if (!baseline) {
            throw new StorageError("STORAGE_WRITE_FAILED", "No baseline design in duplication bundle");
          }
          return {
            projectId: input.project.id,
            baselineDesignId: baseline.id,
          };
        }
      );
    },

    rename: async (projectId: ProjectId, name: string, updatedAt: EpochMs): Promise<Project> => {
      return this.db.transaction("rw", this.db.projects, async () => {
        const p = await this.db.projects.get(projectId);
        if (!p) {
          throw new StorageError("STORAGE_WRITE_FAILED", `Project '${projectId}' not found`);
        }
        p.name = name.trim();
        p.revision += 1;
        p.updatedAt = updatedAt;
        await this.db.projects.put(p);
        return p;
      });
    },

    updateSettings: async (
      projectId: ProjectId,
      settings: ProjectSettings,
      expectedRevision: number,
      updatedAt: EpochMs
    ): Promise<Project> => {
      return this.db.transaction("rw", this.db.projects, async () => {
        const p = await this.db.projects.get(projectId);
        if (!p) {
          throw new StorageError("STORAGE_WRITE_FAILED", `Project '${projectId}' not found`);
        }
        if (p.revision !== expectedRevision) {
          throw new StorageError(
            "REVISION_CONFLICT",
            `Project revision conflict: expected ${expectedRevision}, found ${p.revision}`
          );
        }
        p.settings = settings;
        p.revision += 1;
        p.updatedAt = updatedAt;
        await this.db.projects.put(p);
        return p;
      });
    },

    updateRegion: async (region: MapRegion, expectedProjectRevision: number): Promise<void> => {
      await this.db.transaction("rw", [this.db.projects, this.db.mapRegions], async () => {
        const p = await this.db.projects.get(region.projectId);
        if (!p) {
          throw new StorageError("STORAGE_WRITE_FAILED", `Project '${region.projectId}' not found`);
        }
        if (p.revision !== expectedProjectRevision) {
          throw new StorageError(
            "REVISION_CONFLICT",
            `Project revision conflict: expected ${expectedProjectRevision}, found ${p.revision}`
          );
        }
        p.revision += 1;
        p.updatedAt = region.updatedAt;
        await this.db.projects.put(p);
        await this.db.mapRegions.put(region);
      });
    },

    delete: async (projectId: ProjectId, expectedRevision: number): Promise<void> => {
      await this.db.transaction(
        "rw",
        [
          this.db.projects,
          this.db.mapRegions,
          this.db.designs,
          this.db.devices,
          this.db.links,
          this.db.subnets,
          this.db.obstacles,
          this.db.analysisCache,
          this.db.analysisBlobs,
        ],
        async () => {
          const p = await this.db.projects.get(projectId);
          if (!p) return;
          if (p.revision !== expectedRevision) {
            throw new StorageError(
              "REVISION_CONFLICT",
              `Project revision conflict: expected ${expectedRevision}, found ${p.revision}`
            );
          }

          const projectDesigns = await this.db.designs.where("projectId").equals(projectId).toArray();
          for (const d of projectDesigns) {
            await this.db.devices.where("designId").equals(d.id).delete();
            await this.db.links.where("designId").equals(d.id).delete();
            await this.db.subnets.where("designId").equals(d.id).delete();
            await this.db.analysisCache.where("designId").equals(d.id).delete();
            await this.db.analysisBlobs.where("designId").equals(d.id).delete();
          }

          await this.db.designs.where("projectId").equals(projectId).delete();
          await this.db.obstacles.where("projectId").equals(projectId).delete();
          await this.db.mapRegions.where("projectId").equals(projectId).delete();
          await this.db.projects.delete(projectId);
        }
      );
    },

    markOpened: async (projectId: ProjectId, at: EpochMs): Promise<void> => {
      await this.db.projects.update(projectId, { lastOpenedAt: at });
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Design Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly designs: DesignRepository = {
    listByProject: async (projectId: ProjectId): Promise<Design[]> => {
      return this.db.designs.where("projectId").equals(projectId).toArray();
    },

    get: async (designId: DesignId): Promise<Design | null> => {
      const d = await this.db.designs.get(designId);
      return d ?? null;
    },

    loadAggregate: async (designId: DesignId): Promise<DesignAggregate> => {
      const design = await this.db.designs.get(designId);
      if (!design) {
        throw new StorageError("STORAGE_READ_FAILED", `Design '${designId}' not found`);
      }

      const project = await this.db.projects.get(design.projectId);
      if (!project) {
        throw new StorageError("STORAGE_READ_FAILED", `Project '${design.projectId}' for design '${designId}' not found`);
      }

      const region = await this.db.mapRegions.get(project.regionId);
      if (!region) {
        throw new StorageError("STORAGE_READ_FAILED", `Region '${project.regionId}' for project '${project.id}' not found`);
      }

      const [devices, links, subnets, obstacles] = await Promise.all([
        this.db.devices.where("designId").equals(designId).toArray(),
        this.db.links.where("designId").equals(designId).toArray(),
        this.db.subnets.where("designId").equals(designId).toArray(),
        this.db.obstacles.where("projectId").equals(project.id).toArray(),
      ]);

      const devicesById: Record<DeviceId, Device> = {};
      const catalogItemIds = new Set<CatalogItemId>();
      for (const dev of devices) {
        devicesById[dev.id] = dev;
        catalogItemIds.add(dev.catalogItemId);
      }

      const linksById: Record<LinkId, Link> = {};
      for (const l of links) linksById[l.id] = l;

      const subnetsById: Record<SubnetId, Subnet> = {};
      for (const s of subnets) subnetsById[s.id] = s;

      const obstaclesById: Record<ObstacleId, Obstacle> = {};
      for (const o of obstacles) obstaclesById[o.id] = o;

      const catalogItems = await this.db.deviceCatalog.toArray();
      const catalogById: Record<CatalogItemId, DeviceCatalogItem> = {};
      for (const cat of catalogItems) {
        catalogById[cat.id] = cat;
      }

      return {
        project,
        region,
        design,
        devicesById,
        linksById,
        subnetsById,
        obstaclesById,
        catalogById,
      };
    },

    commit: async (changeSet: DesignChangeSet, expected: RevisionExpectation): Promise<void> => {
      await this.db.transaction(
        "rw",
        [
          this.db.projects,
          this.db.mapRegions,
          this.db.designs,
          this.db.devices,
          this.db.links,
          this.db.subnets,
          this.db.obstacles,
        ],
        async () => {
          // Check design revision
          const storedDesign = await this.db.designs.get(changeSet.design.id);
          if (!storedDesign) {
            throw new StorageError("STORAGE_WRITE_FAILED", `Design '${changeSet.design.id}' not found`);
          }
          if (storedDesign.revision !== expected.designRevision) {
            throw new StorageError(
              "REVISION_CONFLICT",
              `Design revision conflict: expected ${expected.designRevision}, found ${storedDesign.revision}`
            );
          }

          // Check project revision if project change is present
          if (changeSet.project) {
            const storedProject = await this.db.projects.get(changeSet.project.id);
            if (!storedProject) {
              throw new StorageError("STORAGE_WRITE_FAILED", `Project '${changeSet.project.id}' not found`);
            }
            if (storedProject.revision !== expected.projectRevision) {
              throw new StorageError(
                "REVISION_CONFLICT",
                `Project revision conflict: expected ${expected.projectRevision}, found ${storedProject.revision}`
              );
            }
            await this.db.projects.put(changeSet.project);
          }

          if (changeSet.region) {
            await this.db.mapRegions.put(changeSet.region);
          }

          await this.db.designs.put(changeSet.design);

          if (changeSet.upsertDevices.length > 0) {
            await this.db.devices.bulkPut(changeSet.upsertDevices);
          }
          if (changeSet.deleteDeviceIds.length > 0) {
            await this.db.devices.bulkDelete(changeSet.deleteDeviceIds);
          }

          if (changeSet.upsertLinks.length > 0) {
            await this.db.links.bulkPut(changeSet.upsertLinks);
          }
          if (changeSet.deleteLinkIds.length > 0) {
            await this.db.links.bulkDelete(changeSet.deleteLinkIds);
          }

          if (changeSet.upsertSubnets.length > 0) {
            await this.db.subnets.bulkPut(changeSet.upsertSubnets);
          }
          if (changeSet.deleteSubnetIds.length > 0) {
            await this.db.subnets.bulkDelete(changeSet.deleteSubnetIds);
          }

          if (changeSet.upsertObstacles.length > 0) {
            await this.db.obstacles.bulkPut(changeSet.upsertObstacles);
          }
          if (changeSet.deleteObstacleIds.length > 0) {
            await this.db.obstacles.bulkDelete(changeSet.deleteObstacleIds);
          }
        }
      );
    },

    duplicate: async (
      sourceDesignId: DesignId,
      newDesignId: DesignId,
      ids: IdGenerator,
      name: string,
      at: EpochMs
    ): Promise<DesignId> => {
      return this.db.transaction(
        "rw",
        [this.db.designs, this.db.devices, this.db.links, this.db.subnets],
        async () => {
          const source = await this.db.designs.get(sourceDesignId);
          if (!source) {
            throw new StorageError("STORAGE_WRITE_FAILED", `Source design '${sourceDesignId}' not found`);
          }

          const [sourceDevices, sourceLinks, sourceSubnets] = await Promise.all([
            this.db.devices.where("designId").equals(sourceDesignId).toArray(),
            this.db.links.where("designId").equals(sourceDesignId).toArray(),
            this.db.subnets.where("designId").equals(sourceDesignId).toArray(),
          ]);

          // Remap IDs
          const devMap = new Map<DeviceId, DeviceId>();
          const newDevices: Device[] = sourceDevices.map((d) => {
            const newId = ids.device();
            devMap.set(d.id, newId);
            return {
              ...d,
              id: newId,
              designId: newDesignId,
              createdAt: at,
              updatedAt: at,
            };
          });

          const linkMap = new Map<LinkId, LinkId>();
          const newLinks: Link[] = sourceLinks.map((l) => {
            const newId = ids.link();
            linkMap.set(l.id, newId);
            const newSource = devMap.get(l.sourceDeviceId) ?? l.sourceDeviceId;
            const newTarget = devMap.get(l.targetDeviceId) ?? l.targetDeviceId;
            return {
              ...l,
              id: newId,
              designId: newDesignId,
              sourceDeviceId: newSource,
              targetDeviceId: newTarget,
              createdAt: at,
              updatedAt: at,
            };
          });

          const subnetMap = new Map<SubnetId, SubnetId>();
          const newSubnets: Subnet[] = sourceSubnets.map((s) => {
            const newId = ids.subnet();
            subnetMap.set(s.id, newId);
            const newDev = s.servedByDeviceId ? devMap.get(s.servedByDeviceId) ?? null : null;
            const newLink = s.linkId ? linkMap.get(s.linkId) ?? null : null;
            return {
              ...s,
              id: newId,
              designId: newDesignId,
              servedByDeviceId: newDev,
              linkId: newLink,
              createdAt: at,
              updatedAt: at,
            };
          });

          // Remap layout
          const newLayout: Record<DeviceId, LogicalPoint> = {};
          for (const [oldDevId, pos] of Object.entries(source.logicalLayout)) {
            const remappedDevId = devMap.get(oldDevId as DeviceId);
            if (remappedDevId) {
              newLayout[remappedDevId] = pos;
            }
          }

          // Remap simulation setup
          const newSimulation: SimulationSetup = {
            flows: source.simulationSetup.flows.map((f) => ({
              ...f,
              id: ids.flow(),
              sourceSubnetId: subnetMap.get(f.sourceSubnetId) ?? f.sourceSubnetId,
              destinationDeviceId: devMap.get(f.destinationDeviceId) ?? f.destinationDeviceId,
            })),
            failureScenarios: source.simulationSetup.failureScenarios.map((sc) => ({
              id: ids.failureScenario(),
              name: sc.name,
              failedDeviceIds: sc.failedDeviceIds.map((id) => devMap.get(id) ?? id),
              failedLinkIds: sc.failedLinkIds.map((id) => linkMap.get(id) ?? id),
            })),
          };

          const newDesign: Design = {
            id: newDesignId,
            projectId: source.projectId,
            parentDesignId: sourceDesignId,
            name: name.trim() || `${source.name} (Copy)`,
            notes: source.notes,
            isBaseline: false, // Copies are never baseline
            revision: 1,
            logicalLayout: newLayout,
            addressing: JSON.parse(JSON.stringify(source.addressing)),
            simulationSetup: newSimulation,
            createdAt: at,
            updatedAt: at,
          };

          await this.db.designs.put(newDesign);
          if (newDevices.length > 0) await this.db.devices.bulkPut(newDevices);
          if (newLinks.length > 0) await this.db.links.bulkPut(newLinks);
          if (newSubnets.length > 0) await this.db.subnets.bulkPut(newSubnets);

          // Note: Analysis cache and blobs are intentionally NOT duplicated
          return newDesignId;
        }
      );
    },

    setBaseline: async (
      projectId: ProjectId,
      designId: DesignId,
      expectedProjectRevision: number,
      at: EpochMs
    ): Promise<void> => {
      await this.db.transaction("rw", [this.db.projects, this.db.designs], async () => {
        const p = await this.db.projects.get(projectId);
        if (!p) throw new StorageError("STORAGE_WRITE_FAILED", `Project '${projectId}' not found`);
        if (p.revision !== expectedProjectRevision) {
          throw new StorageError("REVISION_CONFLICT", "Project revision conflict");
        }

        const projectDesigns = await this.db.designs.where("projectId").equals(projectId).toArray();
        const target = projectDesigns.find((d) => d.id === designId);
        if (!target) throw new StorageError("STORAGE_WRITE_FAILED", `Design '${designId}' not found in project`);

        for (const d of projectDesigns) {
          const shouldBeBaseline = d.id === designId;
          if (d.isBaseline !== shouldBeBaseline) {
            d.isBaseline = shouldBeBaseline;
            d.updatedAt = at;
            await this.db.designs.put(d);
          }
        }

        p.revision += 1;
        p.updatedAt = at;
        await this.db.projects.put(p);
      });
    },

    delete: async (
      designId: DesignId,
      replacementBaselineId: DesignId | null,
      expectedProjectRevision: number
    ): Promise<void> => {
      await this.db.transaction(
        "rw",
        [
          this.db.projects,
          this.db.designs,
          this.db.devices,
          this.db.links,
          this.db.subnets,
          this.db.analysisCache,
          this.db.analysisBlobs,
        ],
        async () => {
          const design = await this.db.designs.get(designId);
          if (!design) return;

          const p = await this.db.projects.get(design.projectId);
          if (!p) throw new StorageError("STORAGE_WRITE_FAILED", "Project not found");
          if (p.revision !== expectedProjectRevision) {
            throw new StorageError("REVISION_CONFLICT", "Project revision conflict");
          }

          const allDesigns = await this.db.designs.where("projectId").equals(p.id).toArray();
          if (design.isBaseline) {
            if (!replacementBaselineId) {
              throw new StorageError(
                "STORAGE_WRITE_FAILED",
                "Cannot delete baseline design without specifying replacement baseline"
              );
            }
            const replacement = allDesigns.find((d) => d.id === replacementBaselineId);
            if (!replacement) {
              throw new StorageError("STORAGE_WRITE_FAILED", "Replacement baseline design not found");
            }
            replacement.isBaseline = true;
            await this.db.designs.put(replacement);
          }

          // Delete design and its contents
          await this.db.devices.where("designId").equals(designId).delete();
          await this.db.links.where("designId").equals(designId).delete();
          await this.db.subnets.where("designId").equals(designId).delete();
          await this.db.analysisCache.where("designId").equals(designId).delete();
          await this.db.analysisBlobs.where("designId").equals(designId).delete();
          await this.db.designs.delete(designId);

          p.revision += 1;
          await this.db.projects.put(p);
        }
      );
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Device Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly devices: DeviceRepository = {
    listByDesign: async (designId: DesignId): Promise<Device[]> => {
      return this.db.devices.where("designId").equals(designId).toArray();
    },

    listByCatalogItem: async (catalogItemId: CatalogItemId): Promise<Device[]> => {
      return this.db.devices.where("catalogItemId").equals(catalogItemId).toArray();
    },

    get: async (deviceId: DeviceId): Promise<Device | null> => {
      const d = await this.db.devices.get(deviceId);
      return d ?? null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                               Link Repository                              */
  /* -------------------------------------------------------------------------- */
  public readonly links: LinkRepository = {
    listByDesign: async (designId: DesignId): Promise<Link[]> => {
      return this.db.links.where("designId").equals(designId).toArray();
    },

    get: async (linkId: LinkId): Promise<Link | null> => {
      const l = await this.db.links.get(linkId);
      return l ?? null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Subnet Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly subnets: SubnetRepository = {
    listByDesign: async (designId: DesignId): Promise<Subnet[]> => {
      return this.db.subnets.where("designId").equals(designId).toArray();
    },

    get: async (subnetId: SubnetId): Promise<Subnet | null> => {
      const s = await this.db.subnets.get(subnetId);
      return s ?? null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                             Obstacle Repository                            */
  /* -------------------------------------------------------------------------- */
  public readonly obstacles: ObstacleRepository = {
    listByProject: async (projectId: ProjectId): Promise<Obstacle[]> => {
      return this.db.obstacles.where("projectId").equals(projectId).toArray();
    },

    get: async (obstacleId: ObstacleId): Promise<Obstacle | null> => {
      const o = await this.db.obstacles.get(obstacleId);
      return o ?? null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                             Catalog Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly catalog: CatalogRepository = {
    list: async (filters?: { type?: DeviceType; query?: string }): Promise<DeviceCatalogItem[]> => {
      let collection = this.db.deviceCatalog.toCollection();
      if (filters?.type) {
        collection = this.db.deviceCatalog.where("type").equals(filters.type);
      }
      let items = await collection.toArray();
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        items = items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            item.brand?.toLowerCase().includes(q) ||
            item.model?.toLowerCase().includes(q)
        );
      }
      return items;
    },

    get: async (catalogItemId: CatalogItemId): Promise<DeviceCatalogItem | null> => {
      const item = await this.db.deviceCatalog.get(catalogItemId);
      return item ?? null;
    },

    createCustom: async (item: DeviceCatalogItem): Promise<void> => {
      if (item.origin !== "custom") {
        throw new StorageError(
          "STORAGE_WRITE_FAILED",
          "createCustom can only be used for custom catalog items"
        );
      }
      await this.db.deviceCatalog.put(item);
    },

    updateCustom: async (item: DeviceCatalogItem): Promise<void> => {
      const existing = await this.db.deviceCatalog.get(item.id);
      if (!existing) {
        throw new StorageError("STORAGE_WRITE_FAILED", `Catalog item '${item.id}' not found`);
      }
      if (existing.origin !== "custom") {
        throw new StorageError(
          "STORAGE_WRITE_FAILED",
          "Cannot update built-in catalog item definition via updateCustom"
        );
      }
      await this.db.deviceCatalog.put(item);
    },

    deleteCustom: async (catalogItemId: CatalogItemId): Promise<void> => {
      const existing = await this.db.deviceCatalog.get(catalogItemId);
      if (!existing) return;
      if (existing.origin !== "custom") {
        throw new StorageError(
          "STORAGE_WRITE_FAILED",
          "Cannot delete built-in catalog item"
        );
      }

      // Check if referenced
      const refCount = await this.db.devices.where("catalogItemId").equals(catalogItemId).count();
      if (refCount > 0) {
        throw new StorageError(
          "REFERENTIAL_INTEGRITY_FAILED",
          `Cannot delete catalog item '${catalogItemId}' referenced by ${refCount} device(s)`
        );
      }

      await this.db.deviceCatalog.delete(catalogItemId);
    },

    seedBuiltIns: async (_version: number, _items: DeviceCatalogItem[]): Promise<void> => {
      await seedBuiltinCatalog(this.db);
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                             Analysis Repository                            */
  /* -------------------------------------------------------------------------- */
  public readonly analyses: AnalysisRepository = {
    findByHash: async (
      designId: DesignId,
      type: AnalysisType,
      inputHash: InputHash
    ): Promise<AnalysisRecord | null> => {
      const record = await this.db.analysisCache
        .where("[designId+type+inputHash]")
        .equals([designId, type, inputHash])
        .first();
      return record ?? null;
    },

    getLatest: async (designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null> => {
      const record = await this.db.analysisCache
        .where("[designId+type+computedAt]")
        .between([designId, type, Dexie.minKey], [designId, type, Dexie.maxKey])
        .last();
      return record ?? null;
    },

    getBlob: async (blobId: AnalysisBlobId): Promise<AnalysisBlob | null> => {
      const blob = await this.db.analysisBlobs.get(blobId);
      return blob ?? null;
    },

    put: async (record: AnalysisRecord, blob?: AnalysisBlob): Promise<void> => {
      await this.db.transaction("rw", [this.db.analysisCache, this.db.analysisBlobs], async () => {
        await this.db.analysisCache.put(record);
        if (blob) {
          await this.db.analysisBlobs.put(blob);
        }
      });
    },

    deleteRecord: async (analysisId: AnalysisId): Promise<void> => {
      await this.db.transaction("rw", [this.db.analysisCache, this.db.analysisBlobs], async () => {
        const record = await this.db.analysisCache.get(analysisId);
        if (!record) return;
        await this.db.analysisCache.delete(analysisId);
        await this.db.analysisBlobs.where("analysisId").equals(analysisId).delete();
      });
    },

    clearDerivedCache: async (
      projectId?: ProjectId
    ): Promise<{ deletedRecords: number; deletedBlobs: number }> => {
      return this.db.transaction("rw", [this.db.analysisCache, this.db.analysisBlobs], async () => {
        if (!projectId) {
          const recCount = await this.db.analysisCache.count();
          const blobCount = await this.db.analysisBlobs.count();
          await this.db.analysisCache.clear();
          await this.db.analysisBlobs.clear();
          return { deletedRecords: recCount, deletedBlobs: blobCount };
        }

        const projectDesigns = await this.db.designs.where("projectId").equals(projectId).toArray();
        let deletedRecords = 0;
        let deletedBlobs = 0;

        for (const d of projectDesigns) {
          const r = await this.db.analysisCache.where("designId").equals(d.id).delete();
          const b = await this.db.analysisBlobs.where("designId").equals(d.id).delete();
          deletedRecords += r;
          deletedBlobs += b;
        }

        return { deletedRecords, deletedBlobs };
      });
    },

    prune: async (maxPerDesignAndType: number = 5): Promise<{ deletedRecords: number; deletedBlobs: number }> => {
      return this.db.transaction("rw", [this.db.analysisCache, this.db.analysisBlobs], async () => {
        let deletedRecords = 0;
        let deletedBlobs = 0;

        const allRecords = await this.db.analysisCache.toArray();
        const grouped = new Map<string, AnalysisRecord[]>();

        for (const r of allRecords) {
          const key = `${r.designId}:${r.type}`;
          const list = grouped.get(key) ?? [];
          list.push(r);
          grouped.set(key, list);
        }

        for (const records of grouped.values()) {
          if (records.length > maxPerDesignAndType) {
            // Sort ascending by computedAt
            records.sort((a, b) => a.computedAt - b.computedAt);
            const toRemove = records.slice(0, records.length - maxPerDesignAndType);

            for (const r of toRemove) {
              await this.db.analysisCache.delete(r.id);
              deletedRecords += 1;
              const b = await this.db.analysisBlobs.where("analysisId").equals(r.id).delete();
              deletedBlobs += b;
            }
          }
        }

        return { deletedRecords, deletedBlobs };
      });
    },
  };
}
