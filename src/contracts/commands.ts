/**
 * Design commands, change sets, aggregate, and session dispatch contracts.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §7
 */

import type {
  CatalogItemId,
  DeviceId,
  DesignId,
  LinkId,
  SubnetId,
  ObstacleId,
  FlowId,
  FailureScenarioId,
  EpochMs,
  GeoPoint,
  GeoPolygon,
  BoundingBox,
  LogicalPoint,
  IPv4Cidr,
} from "./primitives";

import type {
  LinkMedium,
  LinkInstallationMethod,
  ObstacleMaterial,
  AnalysisType,
} from "./enums";

import type {
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  ProjectSettings,
  DeviceOverrides,
  SimulationSetup,
  DesignAggregate,
} from "./domain";

export type { DesignAggregate };

import type { ValidationIssue } from "./errors";
import type { VlsmSubnetAllocation } from "./engines";

export interface CommandStamp {
  commandId: string;
  committedAt: EpochMs; // injected by application layer
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface DevicePatch {
  name?: string;
  hostname?: string | null;
  notes?: string | null;
  catalogItemId?: CatalogItemId;
  overrides?: DeviceOverrides;
}

export interface LinkPatch {
  medium?: LinkMedium;
  installationMethod?: LinkInstallationMethod | null;
  capacityMbps?: number | null;
  routingWeight?: number;
  lengthOverrideM?: number | null;
}

export interface SubnetPatch {
  name?: string;
  hostsRequired?: number;
  servedByDeviceId?: DeviceId | null;
  linkId?: LinkId | null;
}

export interface ObstaclePatch {
  label?: string;
  geometry?: GeoPolygon;
  material?: ObstacleMaterial;
  lossDbPerCrossing?: number;
}

export type TopologyTemplateRequest =
  | {
      kind: "star";
      rootDeviceId: DeviceId;
      memberDeviceIds: DeviceId[];
      medium: LinkMedium;
    }
  | {
      kind: "tree";
      rootDeviceId: DeviceId;
      parentByDeviceId: Record<DeviceId, DeviceId>;
      medium: LinkMedium;
    };

export type DesignCommand =
  | { type: "project/update"; patch: { name?: string; description?: string | null } }
  | { type: "project/settingsUpdate"; patch: DeepPartial<ProjectSettings> }
  | {
      type: "region/update";
      patch: { label?: string; center?: GeoPoint; bbox?: BoundingBox | null };
    }
  | { type: "region/setBoundary"; boundary: GeoPolygon | null }
  | { type: "device/add"; catalogItemId: CatalogItemId; position: GeoPoint; name?: string }
  | { type: "device/update"; deviceId: DeviceId; patch: DevicePatch }
  | { type: "device/move"; deviceId: DeviceId; position: GeoPoint }
  | { type: "device/delete"; deviceId: DeviceId }
  | {
      type: "link/add";
      sourceDeviceId: DeviceId;
      targetDeviceId: DeviceId;
      medium: LinkMedium;
      installationMethod?: LinkInstallationMethod | null;
      capacityMbps?: number | null;
      routingWeight?: number;
    }
  | { type: "link/update"; linkId: LinkId; patch: LinkPatch }
  | { type: "link/delete"; linkId: LinkId }
  | {
      type: "subnet/add";
      name: string;
      hostsRequired: number;
      servedByDeviceId?: DeviceId | null;
      linkId?: LinkId | null;
    }
  | { type: "subnet/update"; subnetId: SubnetId; patch: SubnetPatch }
  | { type: "subnet/delete"; subnetId: SubnetId }
  | { type: "addressing/setParentCidr"; parentCidr: IPv4Cidr | null }
  | {
      type: "addressing/applyAllocation";
      allocations: VlsmSubnetAllocation[];
      parentCidr: IPv4Cidr;
      allocatedAt: EpochMs;
    }
  | {
      type: "obstacle/add";
      label?: string;
      geometry: GeoPolygon;
      material: ObstacleMaterial;
      lossDbPerCrossing?: number;
    }
  | { type: "obstacle/update"; obstacleId: ObstacleId; patch: ObstaclePatch }
  | { type: "obstacle/delete"; obstacleId: ObstacleId }
  | { type: "layout/set"; positions: Record<DeviceId, LogicalPoint> }
  | { type: "simulation/setup"; setup: SimulationSetup }
  | { type: "template/apply"; template: TopologyTemplateRequest };

export interface GeneratedCommandIds {
  device?: DeviceId[];
  link?: LinkId[];
  subnet?: SubnetId[];
  obstacle?: ObstacleId[];
  flow?: FlowId[];
  failureScenario?: FailureScenarioId[];
}

export interface PreparedDesignCommand {
  command: DesignCommand;
  stamp: CommandStamp;
  generatedIds: GeneratedCommandIds;
}

export interface DesignChangeSet {
  project: Project | null;
  region: MapRegion | null;
  design: Design;
  upsertDevices: Device[];
  deleteDeviceIds: DeviceId[];
  upsertLinks: Link[];
  deleteLinkIds: LinkId[];
  upsertSubnets: Subnet[];
  deleteSubnetIds: SubnetId[];
  upsertObstacles: Obstacle[];
  deleteObstacleIds: ObstacleId[];
  affectedAnalysisTypes: AnalysisType[];
  validationIssues: ValidationIssue[]; // warnings only on success; errors cause rejection
}

export type ApplyCommandResult =
  | { ok: true; changeSet: DesignChangeSet; nextAggregate: DesignAggregate }
  | { ok: false; issues: ValidationIssue[] };

export interface DispatchSuccess {
  status: "committed";
  designRevision: number;
  projectRevision: number;
  changeSet: DesignChangeSet;
  warnings: ValidationIssue[];
}

export interface DispatchRejected {
  status: "rejected";
  issues: ValidationIssue[];
}

export type DispatchResult = DispatchSuccess | DispatchRejected;

export interface DesignSession {
  open(designId: DesignId): Promise<DesignAggregate>;
  dispatch(command: DesignCommand): Promise<DispatchResult>;
  close(): Promise<void>;
  flushPendingDrafts(): Promise<void>;
}
