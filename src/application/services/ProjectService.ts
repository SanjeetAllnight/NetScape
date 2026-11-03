/**
 * Project Service implementation.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.1, §17.4
 *
 * Provides transactional project creation, deep duplication with ID remapping,
 * settings updates, region updates, and design lifecycle operations.
 */

import type {
  ProjectService,
  CreateProjectInput,
  DuplicateProjectInput,
  ProjectWorkspaceSummary,
} from "@/contracts/services";
import type {
  ProjectId,
  DesignId,
  MapRegionId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  EpochMs,
} from "@/contracts/primitives";
import type {
  Project,
  MapRegion,
  Design,
  ProjectSettings,
} from "@/contracts/domain";
import type {
  Repositories,
  AppPreferences,
  ProjectDuplicationBundle,
} from "@/contracts/storage";
import type { DeepPartial } from "@/contracts/commands";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import { createProjectFrame } from "@/domain/geo/localFrame";
import { useProjectStore } from "@/stores/projectStore";
import { usePrefsStore } from "@/stores/prefsStore";

function mergeDeep<T extends Record<string, any>>(target: T, source: Record<string, any>): T {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val !== undefined) {
      if (val !== null && typeof val === "object" && !Array.isArray(val)) {
        output[key as keyof T] = mergeDeep(target[key] ?? {}, val);
      } else {
        output[key as keyof T] = val;
      }
    }
  }
  return output;
}

export class DefaultProjectService implements ProjectService {
  constructor(private readonly repos: Repositories) {}

  async listProjects(): Promise<Project[]> {
    return this.repos.projects.list();
  }

  async getProject(projectId: ProjectId): Promise<Project | null> {
    return this.repos.projects.get(projectId);
  }

  async listDesigns(projectId: ProjectId): Promise<Design[]> {
    return this.repos.designs.listByProject(projectId);
  }

  async openProject(projectId: ProjectId): Promise<ProjectWorkspaceSummary> {
    const project = await this.repos.projects.get(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const now = Date.now() as EpochMs;
    await this.repos.projects.markOpened(projectId, now);
    project.lastOpenedAt = now;

    const designs = await this.repos.designs.listByProject(projectId);
    const baseline = designs.find((d) => d.isBaseline) ?? designs[0];
    if (!baseline) {
      throw new Error(`Project '${projectId}' has no baseline design`);
    }

    useProjectStore.getState().setSession(project, designs, baseline.id);

    return {
      project,
      designs,
      baselineDesignId: baseline.id,
    };
  }

  async createProject(
    input: CreateProjectInput
  ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }> {
    const now = Date.now() as EpochMs;
    const projectId = `proj_${crypto.randomUUID()}` as ProjectId;
    const regionId = `reg_${crypto.randomUUID()}` as MapRegionId;
    const baselineDesignId = `des_${crypto.randomUUID()}` as DesignId;

    const frame = createProjectFrame(input.initialRegion.center);

    const project: Project = {
      id: projectId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      regionId,
      settings: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
      frame,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    const region: MapRegion = {
      id: regionId,
      projectId,
      label: input.initialRegion.label.trim(),
      center: input.initialRegion.center,
      bbox: input.initialRegion.bbox,
      boundary: null,
      createdAt: now,
      updatedAt: now,
    };

    const baseline: Design = {
      id: baselineDesignId,
      projectId,
      parentDesignId: null,
      name: "Baseline Design",
      notes: null,
      isBaseline: true,
      revision: 1,
      logicalLayout: {},
      addressing: {
        parentCidr: null,
        allocationStatus: "notAllocated",
        lastAllocatedAt: null,
      },
      simulationSetup: {
        flows: [],
        failureScenarios: [],
      },
      createdAt: now,
      updatedAt: now,
    };

    await this.repos.projects.createWithBaseline({
      project,
      region,
      baseline,
    });

    return {
      projectId,
      baselineDesignId,
    };
  }

  async duplicateProject(
    input: DuplicateProjectInput
  ): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }> {
    const sourceProject = await this.repos.projects.get(input.sourceProjectId);
    if (!sourceProject) {
      throw new Error(`Source project '${input.sourceProjectId}' not found`);
    }

    const sourceDesigns = await this.repos.designs.listByProject(input.sourceProjectId);
    const sourceObstacles = await this.repos.obstacles.listByProject(input.sourceProjectId);

    const now = Date.now() as EpochMs;
    const newProjectId = `proj_${crypto.randomUUID()}` as ProjectId;
    const newRegionId = `reg_${crypto.randomUUID()}` as MapRegionId;

    const newProject: Project = {
      ...sourceProject,
      id: newProjectId,
      regionId: newRegionId,
      name: input.name?.trim() || `${sourceProject.name} (Copy)`,
      revision: 1,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: now,
    };

    // Load source region
    const aggregates = await Promise.all(
      sourceDesigns.map((d) => this.repos.designs.loadAggregate(d.id))
    );
    const sourceRegion = aggregates[0]?.region;
    if (!sourceRegion) {
      throw new Error(`Source region not found for project '${input.sourceProjectId}'`);
    }

    const newRegion: MapRegion = {
      ...sourceRegion,
      id: newRegionId,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    };

    // Remap designs and their contents
    const designIdMap = new Map<DesignId, DesignId>();
    const newDesigns: Design[] = [];
    let newBaselineDesignId: DesignId | null = null;

    for (const d of sourceDesigns) {
      const nid = `des_${crypto.randomUUID()}` as DesignId;
      designIdMap.set(d.id, nid);
      if (d.isBaseline) {
        newBaselineDesignId = nid;
      }
      newDesigns.push({
        ...d,
        id: nid,
        projectId: newProjectId,
        parentDesignId: d.parentDesignId ? designIdMap.get(d.parentDesignId) ?? null : null,
        revision: 1,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (!newBaselineDesignId && newDesigns.length > 0) {
      newDesigns[0]!.isBaseline = true;
      newBaselineDesignId = newDesigns[0]!.id;
    }

    // Remap devices, links, subnets per design
    const newDevices: any[] = [];
    const newLinks: any[] = [];
    const newSubnets: any[] = [];

    for (const agg of aggregates) {
      const oldDesignId = agg.design.id;
      const targetDesignId = designIdMap.get(oldDesignId)!;

      const devIdMap = new Map<DeviceId, DeviceId>();
      const linkIdMap = new Map<LinkId, LinkId>();

      for (const dev of Object.values(agg.devicesById)) {
        const nid = `dev_${crypto.randomUUID()}` as DeviceId;
        devIdMap.set(dev.id, nid);
        newDevices.push({
          ...dev,
          id: nid,
          designId: targetDesignId,
          createdAt: now,
          updatedAt: now,
        });
      }

      for (const link of Object.values(agg.linksById)) {
        const nid = `link_${crypto.randomUUID()}` as LinkId;
        linkIdMap.set(link.id, nid);
        newLinks.push({
          ...link,
          id: nid,
          designId: targetDesignId,
          sourceDeviceId: devIdMap.get(link.sourceDeviceId) ?? link.sourceDeviceId,
          targetDeviceId: devIdMap.get(link.targetDeviceId) ?? link.targetDeviceId,
          createdAt: now,
          updatedAt: now,
        });
      }

      for (const sub of Object.values(agg.subnetsById)) {
        const nid = `sub_${crypto.randomUUID()}` as SubnetId;
        newSubnets.push({
          ...sub,
          id: nid,
          designId: targetDesignId,
          servedByDeviceId: sub.servedByDeviceId ? devIdMap.get(sub.servedByDeviceId) ?? null : null,
          linkId: sub.linkId ? linkIdMap.get(sub.linkId) ?? null : null,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // Remap obstacles
    const newObstacles = sourceObstacles.map((obs) => ({
      ...obs,
      id: `obs_${crypto.randomUUID()}` as ObstacleId,
      projectId: newProjectId,
      createdAt: now,
      updatedAt: now,
    }));

    const bundle: ProjectDuplicationBundle = {
      project: newProject,
      region: newRegion,
      designs: newDesigns,
      devices: newDevices,
      links: newLinks,
      subnets: newSubnets,
      obstacles: newObstacles,
    };

    await this.repos.projects.duplicateWithContents(bundle);

    return {
      projectId: newProjectId,
      baselineDesignId: newBaselineDesignId!,
    };
  }

  async renameProject(projectId: ProjectId, name: string): Promise<Project> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Project name cannot be empty");
    }
    const updated = await this.repos.projects.rename(projectId, trimmed, Date.now() as EpochMs);
    const current = useProjectStore.getState().project;
    if (current && current.id === projectId) {
      useProjectStore.getState().setSession(updated, useProjectStore.getState().designs, useProjectStore.getState().activeDesignId!);
    }
    return updated;
  }

  async deleteProject(projectId: ProjectId): Promise<void> {
    const project = await this.repos.projects.get(projectId);
    if (!project) return;
    await this.repos.projects.delete(projectId, project.revision);
    const current = useProjectStore.getState().project;
    if (current && current.id === projectId) {
      useProjectStore.getState().reset();
    }
  }

  async updateProjectSettings(
    projectId: ProjectId,
    patch: DeepPartial<ProjectSettings>
  ): Promise<Project> {
    const project = await this.repos.projects.get(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    const merged = mergeDeep(project.settings, patch);
    const updated = await this.repos.projects.updateSettings(
      projectId,
      merged,
      project.revision,
      Date.now() as EpochMs
    );

    const current = useProjectStore.getState().project;
    if (current && current.id === projectId) {
      useProjectStore.getState().setSession(updated, useProjectStore.getState().designs, useProjectStore.getState().activeDesignId!);
    }
    return updated;
  }

  async setProjectRegion(
    projectId: ProjectId,
    patch: Partial<Pick<MapRegion, "label" | "center" | "bbox" | "boundary">>
  ): Promise<void> {
    const project = await this.repos.projects.get(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }

    // Load current region via design aggregate
    const designs = await this.repos.designs.listByProject(projectId);
    if (designs.length === 0) {
      throw new Error(`No designs found for project '${projectId}'`);
    }

    const agg = await this.repos.designs.loadAggregate(designs[0]!.id);
    const updatedRegion: MapRegion = {
      ...agg.region,
      ...patch,
      updatedAt: Date.now() as EpochMs,
    };

    await this.repos.projects.updateRegion(updatedRegion, project.revision);
  }

  async duplicateDesign(designId: DesignId, name?: string): Promise<DesignId> {
    const design = await this.repos.designs.get(designId);
    if (!design) {
      throw new Error(`Design '${designId}' not found`);
    }

    const newDesignId = `des_${crypto.randomUUID()}` as DesignId;
    const newName = name?.trim() || `${design.name} (Copy)`;

    const idGen = {
      device: () => `dev_${crypto.randomUUID()}` as DeviceId,
      link: () => `link_${crypto.randomUUID()}` as LinkId,
      subnet: () => `sub_${crypto.randomUUID()}` as SubnetId,
      obstacle: () => `obs_${crypto.randomUUID()}` as ObstacleId,
      flow: () => `flow_${crypto.randomUUID()}` as never,
      failureScenario: () => `fail_${crypto.randomUUID()}` as never,
    };

    await this.repos.designs.duplicate(
      designId,
      newDesignId,
      idGen,
      newName,
      Date.now() as EpochMs
    );

    // Refresh designs in projectStore
    const designs = await this.repos.designs.listByProject(design.projectId);
    const proj = useProjectStore.getState().project;
    if (proj && proj.id === design.projectId) {
      useProjectStore.getState().setSession(proj, designs, useProjectStore.getState().activeDesignId!);
    }

    return newDesignId;
  }

  async renameDesign(designId: DesignId, name: string): Promise<Design> {
    const design = await this.repos.designs.get(designId);
    if (!design) {
      throw new Error(`Design '${designId}' not found`);
    }
    const updatedDesign: Design = {
      ...design,
      name: name.trim(),
      updatedAt: Date.now() as EpochMs,
    };
    await this.repos.designs.commit(
      {
        project: null,
        region: null,
        design: updatedDesign,
        upsertDevices: [],
        deleteDeviceIds: [],
        upsertLinks: [],
        deleteLinkIds: [],
        upsertSubnets: [],
        deleteSubnetIds: [],
        upsertObstacles: [],
        deleteObstacleIds: [],
        affectedAnalysisTypes: [],
        validationIssues: [],
      },
      {
        projectRevision: 1, // unused when project is null
        designRevision: design.revision,
      }
    );
    return updatedDesign;
  }

  async deleteDesign(
    designId: DesignId,
    replacementBaselineId?: DesignId
  ): Promise<void> {
    const design = await this.repos.designs.get(designId);
    if (!design) return;

    const project = await this.repos.projects.get(design.projectId);
    if (!project) return;

    await this.repos.designs.delete(
      designId,
      replacementBaselineId ?? null,
      project.revision
    );
  }

  async setBaseline(projectId: ProjectId, designId: DesignId): Promise<void> {
    const project = await this.repos.projects.get(projectId);
    if (!project) {
      throw new Error(`Project '${projectId}' not found`);
    }
    await this.repos.designs.setBaseline(
      projectId,
      designId,
      project.revision,
      Date.now() as EpochMs
    );
  }

  async setAppPreference<K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K]
  ): Promise<void> {
    usePrefsStore.getState().updatePreference(key, value);
  }
}
