/**
 * Test-only in-memory repository fake.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §9.4, §17.1; DEVELOPMENT_CONTRACTS.md §7.1
 *
 * Implements the exact Repositories interface with observable transaction semantics:
 * - Atomic multi-table commits.
 * - No partial mutation on failure / rollback to snapshot.
 * - Concurrency revision conflict checks.
 * - Exactly-one-baseline invariant enforcement.
 * - Test controls for simulating transaction failures.
 *
 * THIS MODULE IS TEST-ONLY. It must not be imported by production application bundles.
 */

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
  MapRegionId,
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

import type { DeviceType, AnalysisType } from "@/contracts/enums";

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
} from "@/contracts/domain";

import type { DesignChangeSet } from "@/contracts/commands";
import type { AnalysisRecord, AnalysisBlob, CoverageResult } from "@/contracts/engines";
import { StorageError } from "@/contracts/errors";

export class InMemoryRepositories implements Repositories {
  // Underlying in-memory table storage
  public readonly projectsTable = new Map<ProjectId, Project>();
  public readonly regionsTable = new Map<MapRegionId, MapRegion>();
  public readonly designsTable = new Map<DesignId, Design>();
  public readonly devicesTable = new Map<DeviceId, Device>();
  public readonly linksTable = new Map<LinkId, Link>();
  public readonly subnetsTable = new Map<SubnetId, Subnet>();
  public readonly obstaclesTable = new Map<ObstacleId, Obstacle>();
  public readonly catalogTable = new Map<CatalogItemId, DeviceCatalogItem>();
  public readonly analysisCacheTable = new Map<AnalysisId, AnalysisRecord>();
  public readonly analysisBlobsTable = new Map<AnalysisBlobId, AnalysisBlob>();

  // Deterministic test controls
  private failNextCommit = false;
  private failNextCommitReason = "Forced transaction failure in test harness";
  private simulateRevisionConflict = false;

  public setFailNextCommit(fail: boolean, reason?: string): void {
    this.failNextCommit = fail;
    if (reason) this.failNextCommitReason = reason;
  }

  public setSimulateRevisionConflict(conflict: boolean): void {
    this.simulateRevisionConflict = conflict;
  }

  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj)) as T;
  }

  /* -------------------------------------------------------------------------- */
  /*                             Project Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly projects: ProjectRepository = {
    list: async (): Promise<Project[]> => {
      return Array.from(this.projectsTable.values()).map((p) => this.deepClone(p));
    },

    get: async (projectId: ProjectId): Promise<Project | null> => {
      const p = this.projectsTable.get(projectId);
      return p ? this.deepClone(p) : null;
    },

    createWithBaseline: async (input: {
      project: Project;
      region: MapRegion;
      baseline: Design;
    }): Promise<void> => {
      if (this.failNextCommit) {
        this.failNextCommit = false;
        throw new StorageError("STORAGE_WRITE_FAILED", this.failNextCommitReason);
      }
      this.projectsTable.set(input.project.id, this.deepClone(input.project));
      this.regionsTable.set(input.region.id, this.deepClone(input.region));
      this.designsTable.set(input.baseline.id, this.deepClone(input.baseline));
    },

    duplicateWithContents: async (
      input: ProjectDuplicationBundle
    ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }> => {
      if (this.failNextCommit) {
        this.failNextCommit = false;
        throw new StorageError("STORAGE_WRITE_FAILED", this.failNextCommitReason);
      }

      this.projectsTable.set(input.project.id, this.deepClone(input.project));
      this.regionsTable.set(input.region.id, this.deepClone(input.region));

      let baselineDesignId: DesignId | null = null;
      for (const d of input.designs) {
        this.designsTable.set(d.id, this.deepClone(d));
        if (d.isBaseline) baselineDesignId = d.id;
      }

      if (!baselineDesignId) {
        throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", "No baseline design in duplicated project bundle");
      }

      for (const dev of input.devices) this.devicesTable.set(dev.id, this.deepClone(dev));
      for (const lnk of input.links) this.linksTable.set(lnk.id, this.deepClone(lnk));
      for (const snt of input.subnets) this.subnetsTable.set(snt.id, this.deepClone(snt));
      for (const obs of input.obstacles) this.obstaclesTable.set(obs.id, this.deepClone(obs));

      return { projectId: input.project.id, baselineDesignId };
    },

    rename: async (projectId: ProjectId, name: string, updatedAt: EpochMs): Promise<Project> => {
      const project = this.projectsTable.get(projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${projectId} not found`);
      const updated = { ...project, name, updatedAt, revision: project.revision + 1 };
      this.projectsTable.set(projectId, updated);
      return this.deepClone(updated);
    },

    updateSettings: async (
      projectId: ProjectId,
      settings: ProjectSettings,
      expectedRevision: number,
      updatedAt: EpochMs
    ): Promise<Project> => {
      const project = this.projectsTable.get(projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${projectId} not found`);
      if (project.revision !== expectedRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch: expected ${expectedRevision}, found ${project.revision}`);
      }
      const updated = { ...project, settings: this.deepClone(settings), updatedAt, revision: project.revision + 1 };
      this.projectsTable.set(projectId, updated);
      return this.deepClone(updated);
    },

    updateRegion: async (region: MapRegion, expectedProjectRevision: number): Promise<void> => {
      const project = this.projectsTable.get(region.projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${region.projectId} not found`);
      if (project.revision !== expectedProjectRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch: expected ${expectedProjectRevision}, found ${project.revision}`);
      }
      this.regionsTable.set(region.id, this.deepClone(region));
      project.revision += 1;
    },

    delete: async (projectId: ProjectId, expectedRevision: number): Promise<void> => {
      const project = this.projectsTable.get(projectId);
      if (!project) return;
      if (project.revision !== expectedRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch`);
      }

      // Atomic cascade
      this.projectsTable.delete(projectId);
      for (const [id, r] of this.regionsTable.entries()) {
        if (r.projectId === projectId) this.regionsTable.delete(id);
      }
      const designIdsToDelete: DesignId[] = [];
      for (const [id, d] of this.designsTable.entries()) {
        if (d.projectId === projectId) designIdsToDelete.push(id);
      }
      for (const did of designIdsToDelete) {
        this.designsTable.delete(did);
        for (const [id, dev] of this.devicesTable.entries()) if (dev.designId === did) this.devicesTable.delete(id);
        for (const [id, lnk] of this.linksTable.entries()) if (lnk.designId === did) this.linksTable.delete(id);
        for (const [id, snt] of this.subnetsTable.entries()) if (snt.designId === did) this.subnetsTable.delete(id);
        for (const [id, ana] of this.analysisCacheTable.entries()) if (ana.designId === did) this.analysisCacheTable.delete(id);
        for (const [id, blb] of this.analysisBlobsTable.entries()) if (blb.designId === did) this.analysisBlobsTable.delete(id);
      }
      for (const [id, obs] of this.obstaclesTable.entries()) {
        if (obs.projectId === projectId) this.obstaclesTable.delete(id);
      }
    },

    markOpened: async (projectId: ProjectId, at: EpochMs): Promise<void> => {
      const project = this.projectsTable.get(projectId);
      if (project) {
        project.lastOpenedAt = at;
      }
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Design Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly designs: DesignRepository = {
    listByProject: async (projectId: ProjectId): Promise<Design[]> => {
      const list: Design[] = [];
      for (const d of this.designsTable.values()) {
        if (d.projectId === projectId) list.push(this.deepClone(d));
      }
      return list;
    },

    get: async (designId: DesignId): Promise<Design | null> => {
      const d = this.designsTable.get(designId);
      return d ? this.deepClone(d) : null;
    },

    loadAggregate: async (designId: DesignId): Promise<DesignAggregate> => {
      const design = this.designsTable.get(designId);
      if (!design) throw new StorageError("STORAGE_READ_FAILED", `Design ${designId} not found`);

      const project = this.projectsTable.get(design.projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${design.projectId} not found`);

      const region = this.regionsTable.get(project.regionId);
      if (!region) throw new StorageError("STORAGE_READ_FAILED", `Region ${project.regionId} not found`);

      const devicesById: Record<DeviceId, Device> = {};
      for (const dev of this.devicesTable.values()) {
        if (dev.designId === designId) devicesById[dev.id] = this.deepClone(dev);
      }

      const linksById: Record<LinkId, Link> = {};
      for (const lnk of this.linksTable.values()) {
        if (lnk.designId === designId) linksById[lnk.id] = this.deepClone(lnk);
      }

      const subnetsById: Record<SubnetId, Subnet> = {};
      for (const snt of this.subnetsTable.values()) {
        if (snt.designId === designId) subnetsById[snt.id] = this.deepClone(snt);
      }

      const obstaclesById: Record<ObstacleId, Obstacle> = {};
      for (const obs of this.obstaclesTable.values()) {
        if (obs.projectId === design.projectId) obstaclesById[obs.id] = this.deepClone(obs);
      }

      const catalogById: Record<CatalogItemId, DeviceCatalogItem> = {};
      for (const item of this.catalogTable.values()) {
        catalogById[item.id] = this.deepClone(item);
      }

      return {
        project: this.deepClone(project),
        region: this.deepClone(region),
        design: this.deepClone(design),
        devicesById,
        linksById,
        subnetsById,
        obstaclesById,
        catalogById,
      };
    },

    commit: async (changeSet: DesignChangeSet, expected: RevisionExpectation): Promise<void> => {
      // 1. Forced transaction failure check
      if (this.failNextCommit) {
        this.failNextCommit = false;
        throw new StorageError("STORAGE_WRITE_FAILED", this.failNextCommitReason);
      }

      // 2. Concurrency revision check
      if (this.simulateRevisionConflict) {
        this.simulateRevisionConflict = false;
        throw new StorageError("REVISION_CONFLICT", "Revision conflict forced by test control");
      }

      const currentDesign = this.designsTable.get(changeSet.design.id);
      if (!currentDesign) {
        throw new StorageError("STORAGE_READ_FAILED", `Design ${changeSet.design.id} not found`);
      }
      if (currentDesign.revision !== expected.designRevision) {
        throw new StorageError("REVISION_CONFLICT", `Design revision mismatch: expected ${expected.designRevision}, found ${currentDesign.revision}`);
      }

      const currentProject = this.projectsTable.get(currentDesign.projectId);
      if (!currentProject) {
        throw new StorageError("STORAGE_READ_FAILED", `Project ${currentDesign.projectId} not found`);
      }
      if (currentProject.revision !== expected.projectRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch: expected ${expected.projectRevision}, found ${currentProject.revision}`);
      }

      // 3. Snapshot for atomic rollback
      const snapshot = {
        project: this.deepClone(currentProject),
        design: this.deepClone(currentDesign),
        devices: new Map(this.devicesTable),
        links: new Map(this.linksTable),
        subnets: new Map(this.subnetsTable),
        obstacles: new Map(this.obstaclesTable),
      };

      try {
        // Apply changes
        if (changeSet.project) {
          const nextProj = { ...changeSet.project, revision: currentProject.revision + 1 };
          this.projectsTable.set(nextProj.id, nextProj);
        }

        const nextDesign = { ...changeSet.design, revision: currentDesign.revision + 1 };
        this.designsTable.set(nextDesign.id, nextDesign);

        for (const id of changeSet.deleteDeviceIds) this.devicesTable.delete(id);
        for (const dev of changeSet.upsertDevices) this.devicesTable.set(dev.id, this.deepClone(dev));

        for (const id of changeSet.deleteLinkIds) this.linksTable.delete(id);
        for (const lnk of changeSet.upsertLinks) this.linksTable.set(lnk.id, this.deepClone(lnk));

        for (const id of changeSet.deleteSubnetIds) this.subnetsTable.delete(id);
        for (const snt of changeSet.upsertSubnets) this.subnetsTable.set(snt.id, this.deepClone(snt));

        for (const id of changeSet.deleteObstacleIds) this.obstaclesTable.delete(id);
        for (const obs of changeSet.upsertObstacles) this.obstaclesTable.set(obs.id, this.deepClone(obs));

        // Referential integrity check
        for (const dev of this.devicesTable.values()) {
          if (dev.designId === nextDesign.id && !this.catalogTable.has(dev.catalogItemId)) {
            throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", `Catalog item ${dev.catalogItemId} does not exist`);
          }
        }
        for (const lnk of this.linksTable.values()) {
          if (lnk.designId === nextDesign.id) {
            if (!this.devicesTable.has(lnk.sourceDeviceId) || !this.devicesTable.has(lnk.targetDeviceId)) {
              throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", `Link ${lnk.id} endpoints do not exist`);
            }
          }
        }
      } catch (err) {
        // Rollback snapshot on failure
        this.projectsTable.set(snapshot.project.id, snapshot.project);
        this.designsTable.set(snapshot.design.id, snapshot.design);
        this.devicesTable.clear();
        for (const [k, v] of snapshot.devices) this.devicesTable.set(k, v);
        this.linksTable.clear();
        for (const [k, v] of snapshot.links) this.linksTable.set(k, v);
        this.subnetsTable.clear();
        for (const [k, v] of snapshot.subnets) this.subnetsTable.set(k, v);
        this.obstaclesTable.clear();
        for (const [k, v] of snapshot.obstacles) this.obstaclesTable.set(k, v);
        throw err;
      }
    },

    duplicate: async (
      designId: DesignId,
      newDesignId: DesignId,
      ids: IdGenerator,
      name: string,
      at: EpochMs
    ): Promise<DesignId> => {
      const source = this.designsTable.get(designId);
      if (!source) throw new StorageError("STORAGE_READ_FAILED", `Source design ${designId} not found`);

      const devMap = new Map<DeviceId, DeviceId>();
      const lnkMap = new Map<LinkId, LinkId>();
      const sntMap = new Map<SubnetId, SubnetId>();

      for (const dev of this.devicesTable.values()) {
        if (dev.designId === designId) {
          const newId = ids.device();
          devMap.set(dev.id, newId);
          this.devicesTable.set(newId, {
            ...this.deepClone(dev),
            id: newId,
            designId: newDesignId,
            createdAt: at,
            updatedAt: at,
          });
        }
      }

      for (const lnk of this.linksTable.values()) {
        if (lnk.designId === designId) {
          const newId = ids.link();
          lnkMap.set(lnk.id, newId);
          const newSrc = devMap.get(lnk.sourceDeviceId);
          const newTgt = devMap.get(lnk.targetDeviceId);
          if (!newSrc || !newTgt) throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", "Failed remapping link endpoints");
          this.linksTable.set(newId, {
            ...this.deepClone(lnk),
            id: newId,
            designId: newDesignId,
            sourceDeviceId: newSrc,
            targetDeviceId: newTgt,
            createdAt: at,
            updatedAt: at,
          });
        }
      }

      for (const snt of this.subnetsTable.values()) {
        if (snt.designId === designId) {
          const newId = ids.subnet();
          sntMap.set(snt.id, newId);
          const newServedBy = snt.servedByDeviceId ? devMap.get(snt.servedByDeviceId) ?? null : null;
          const newLinkId = snt.linkId ? lnkMap.get(snt.linkId) ?? null : null;
          this.subnetsTable.set(newId, {
            ...this.deepClone(snt),
            id: newId,
            designId: newDesignId,
            servedByDeviceId: newServedBy,
            linkId: newLinkId,
            createdAt: at,
            updatedAt: at,
          });
        }
      }

      const remappedLayout: Record<DeviceId, LogicalPoint> = {};
      for (const [oldId, point] of Object.entries(source.logicalLayout)) {
        const newId = devMap.get(oldId as DeviceId);
        if (newId) remappedLayout[newId] = point;
      }

      const newDesign: Design = {
        ...this.deepClone(source),
        id: newDesignId,
        parentDesignId: source.id,
        name,
        isBaseline: false,
        revision: 1,
        logicalLayout: remappedLayout,
        createdAt: at,
        updatedAt: at,
      };

      this.designsTable.set(newDesignId, newDesign);
      return newDesignId;
    },

    setBaseline: async (
      projectId: ProjectId,
      designId: DesignId,
      expectedProjectRevision: number,
      at: EpochMs
    ): Promise<void> => {
      const project = this.projectsTable.get(projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${projectId} not found`);
      if (project.revision !== expectedProjectRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch`);
      }

      const targetDesign = this.designsTable.get(designId);
      if (!targetDesign || targetDesign.projectId !== projectId) {
        throw new StorageError("STORAGE_READ_FAILED", `Design ${designId} does not belong to project ${projectId}`);
      }

      for (const d of this.designsTable.values()) {
        if (d.projectId === projectId) {
          d.isBaseline = d.id === designId;
          d.updatedAt = at;
        }
      }
      project.revision += 1;
      project.updatedAt = at;
    },

    delete: async (
      designId: DesignId,
      replacementBaselineId: DesignId | null,
      expectedProjectRevision: number
    ): Promise<void> => {
      const design = this.designsTable.get(designId);
      if (!design) return;

      const project = this.projectsTable.get(design.projectId);
      if (!project) throw new StorageError("STORAGE_READ_FAILED", `Project ${design.projectId} not found`);
      if (project.revision !== expectedProjectRevision) {
        throw new StorageError("REVISION_CONFLICT", `Project revision mismatch`);
      }

      if (design.isBaseline) {
        if (!replacementBaselineId) {
          throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", "Cannot delete baseline design without replacement");
        }
        const rep = this.designsTable.get(replacementBaselineId);
        if (!rep || rep.projectId !== design.projectId) {
          throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", "Replacement baseline design does not exist");
        }
        rep.isBaseline = true;
      }

      this.designsTable.delete(designId);
      for (const [id, dev] of this.devicesTable.entries()) if (dev.designId === designId) this.devicesTable.delete(id);
      for (const [id, lnk] of this.linksTable.entries()) if (lnk.designId === designId) this.linksTable.delete(id);
      for (const [id, snt] of this.subnetsTable.entries()) if (snt.designId === designId) this.subnetsTable.delete(id);
      for (const [id, ana] of this.analysisCacheTable.entries()) if (ana.designId === designId) this.analysisCacheTable.delete(id);
      for (const [id, blb] of this.analysisBlobsTable.entries()) if (blb.designId === designId) this.analysisBlobsTable.delete(id);
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Device Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly devices: DeviceRepository = {
    listByDesign: async (designId: DesignId): Promise<Device[]> => {
      const list: Device[] = [];
      for (const d of this.devicesTable.values()) {
        if (d.designId === designId) list.push(this.deepClone(d));
      }
      return list;
    },

    listByCatalogItem: async (catalogItemId: CatalogItemId): Promise<Device[]> => {
      const list: Device[] = [];
      for (const d of this.devicesTable.values()) {
        if (d.catalogItemId === catalogItemId) list.push(this.deepClone(d));
      }
      return list;
    },

    get: async (deviceId: DeviceId): Promise<Device | null> => {
      const d = this.devicesTable.get(deviceId);
      return d ? this.deepClone(d) : null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                               Link Repository                              */
  /* -------------------------------------------------------------------------- */
  public readonly links: LinkRepository = {
    listByDesign: async (designId: DesignId): Promise<Link[]> => {
      const list: Link[] = [];
      for (const l of this.linksTable.values()) {
        if (l.designId === designId) list.push(this.deepClone(l));
      }
      return list;
    },

    get: async (linkId: LinkId): Promise<Link | null> => {
      const l = this.linksTable.get(linkId);
      return l ? this.deepClone(l) : null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Subnet Repository                             */
  /* -------------------------------------------------------------------------- */
  public readonly subnets: SubnetRepository = {
    listByDesign: async (designId: DesignId): Promise<Subnet[]> => {
      const list: Subnet[] = [];
      for (const s of this.subnetsTable.values()) {
        if (s.designId === designId) list.push(this.deepClone(s));
      }
      return list;
    },

    get: async (subnetId: SubnetId): Promise<Subnet | null> => {
      const s = this.subnetsTable.get(subnetId);
      return s ? this.deepClone(s) : null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                             Obstacle Repository                            */
  /* -------------------------------------------------------------------------- */
  public readonly obstacles: ObstacleRepository = {
    listByProject: async (projectId: ProjectId): Promise<Obstacle[]> => {
      const list: Obstacle[] = [];
      for (const o of this.obstaclesTable.values()) {
        if (o.projectId === projectId) list.push(this.deepClone(o));
      }
      return list;
    },

    get: async (obstacleId: ObstacleId): Promise<Obstacle | null> => {
      const o = this.obstaclesTable.get(obstacleId);
      return o ? this.deepClone(o) : null;
    },
  };

  /* -------------------------------------------------------------------------- */
  /*                              Catalog Repository                            */
  /* -------------------------------------------------------------------------- */
  public readonly catalog: CatalogRepository = {
    list: async (filters?: { type?: DeviceType; query?: string }): Promise<DeviceCatalogItem[]> => {
      let items = Array.from(this.catalogTable.values());
      if (filters?.type) {
        items = items.filter((i) => i.type === filters.type);
      }
      if (filters?.query) {
        const q = filters.query.toLowerCase();
        items = items.filter((i) => i.label.toLowerCase().includes(q));
      }
      return items.map((i) => this.deepClone(i));
    },

    get: async (catalogItemId: CatalogItemId): Promise<DeviceCatalogItem | null> => {
      const item = this.catalogTable.get(catalogItemId);
      return item ? this.deepClone(item) : null;
    },

    createCustom: async (item: DeviceCatalogItem): Promise<void> => {
      this.catalogTable.set(item.id, this.deepClone(item));
    },

    updateCustom: async (item: DeviceCatalogItem): Promise<void> => {
      const existing = this.catalogTable.get(item.id);
      if (!existing || existing.origin !== "custom") {
        throw new StorageError("STORAGE_WRITE_FAILED", "Can only update custom catalog items");
      }
      this.catalogTable.set(item.id, this.deepClone(item));
    },

    deleteCustom: async (catalogItemId: CatalogItemId): Promise<void> => {
      const existing = this.catalogTable.get(catalogItemId);
      if (!existing || existing.origin !== "custom") {
        throw new StorageError("STORAGE_WRITE_FAILED", "Cannot delete built-in catalog item");
      }
      for (const dev of this.devicesTable.values()) {
        if (dev.catalogItemId === catalogItemId) {
          throw new StorageError("REFERENTIAL_INTEGRITY_FAILED", "Cannot delete catalog item currently in use by devices");
        }
      }
      this.catalogTable.delete(catalogItemId);
    },

    seedBuiltIns: async (_version: number, items: DeviceCatalogItem[]): Promise<void> => {
      for (const item of items) {
        this.catalogTable.set(item.id, this.deepClone(item));
      }
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
      for (const rec of this.analysisCacheTable.values()) {
        if (rec.designId === designId && rec.type === type && rec.inputHash === inputHash) {
          return this.deepClone(rec);
        }
      }
      return null;
    },

    getLatest: async (designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null> => {
      let latest: AnalysisRecord | null = null;
      for (const rec of this.analysisCacheTable.values()) {
        if (rec.designId === designId && rec.type === type) {
          if (!latest || rec.computedAt > latest.computedAt) {
            latest = rec;
          }
        }
      }
      return latest ? this.deepClone(latest) : null;
    },

    getBlob: async (blobId: AnalysisBlobId): Promise<AnalysisBlob | null> => {
      const blob = this.analysisBlobsTable.get(blobId);
      return blob ? this.deepClone(blob) : null;
    },

    put: async (record: AnalysisRecord, blob?: AnalysisBlob): Promise<void> => {
      this.analysisCacheTable.set(record.id, this.deepClone(record));
      if (blob) {
        this.analysisBlobsTable.set(blob.id, this.deepClone(blob));
      }
    },

    deleteRecord: async (analysisId: AnalysisId): Promise<void> => {
      const rec = this.analysisCacheTable.get(analysisId);
      if (rec) {
        this.analysisCacheTable.delete(analysisId);
        // Clean blob if unreferenced
        for (const [blobId, b] of this.analysisBlobsTable.entries()) {
          if (b.analysisId === analysisId) {
            let referenced = false;
            for (const r of this.analysisCacheTable.values()) {
              if (r.type === "coverage" && (r.result as CoverageResult).grid?.blobId === blobId) {
                referenced = true;
                break;
              }
            }
            if (!referenced) this.analysisBlobsTable.delete(blobId);
          }
        }
      }
    },

    clearDerivedCache: async (projectId?: ProjectId): Promise<{ deletedRecords: number; deletedBlobs: number }> => {
      let deletedRecords = 0;
      let deletedBlobs = 0;
      for (const [id, rec] of Array.from(this.analysisCacheTable.entries())) {
        if (!projectId || rec.projectId === projectId) {
          this.analysisCacheTable.delete(id);
          deletedRecords++;
        }
      }
      for (const [id, blob] of Array.from(this.analysisBlobsTable.entries())) {
        if (!projectId || blob.projectId === projectId) {
          this.analysisBlobsTable.delete(id);
          deletedBlobs++;
        }
      }
      return { deletedRecords, deletedBlobs };
    },

    prune: async (maxPerDesignAndType: number): Promise<{ deletedRecords: number; deletedBlobs: number }> => {
      const grouped = new Map<string, AnalysisRecord[]>();
      for (const rec of this.analysisCacheTable.values()) {
        const key = `${rec.designId}:${rec.type}`;
        const list = grouped.get(key) ?? [];
        list.push(rec);
        grouped.set(key, list);
      }

      let deletedRecords = 0;
      let deletedBlobs = 0;

      for (const list of grouped.values()) {
        if (list.length > maxPerDesignAndType) {
          list.sort((a, b) => b.computedAt - a.computedAt);
          const toRemove = list.slice(maxPerDesignAndType);
          for (const rec of toRemove) {
            this.analysisCacheTable.delete(rec.id);
            deletedRecords++;
          }
        }
      }

      // Remove unreferenced blobs
      for (const [blobId, blob] of Array.from(this.analysisBlobsTable.entries())) {
        if (!this.analysisCacheTable.has(blob.analysisId)) {
          this.analysisBlobsTable.delete(blobId);
          deletedBlobs++;
        }
      }

      return { deletedRecords, deletedBlobs };
    },
  };
}
