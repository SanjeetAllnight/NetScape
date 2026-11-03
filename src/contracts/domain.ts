/**
 * Core domain entities, settings, and catalogue models.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §3
 */

import type {
  ProjectId,
  DesignId,
  MapRegionId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  CatalogItemId,
  FlowId,
  FailureScenarioId,
  EpochMs,
  IPv4Cidr,
  Money,
  GeoPoint,
  GeoPolygon,
  GeoLineString,
  BoundingBox,
  LogicalPoint,
  Vec2,
} from "./primitives";

import type {
  DeviceType,
  LinkMedium,
  LinkInstallationMethod,
  ObstacleMaterial,
  PriceProvenance,
  CatalogOrigin,
  SubnetAllocationStatus,
} from "./enums";

export interface ProjectFrame {
  kind: "azimuthalEquidistant";
  origin: GeoPoint; // immutable WGS84 centre captured at project creation
  units: "m";
  definition: string; // canonical proj4 +proj=aeqd definition stored for reproducibility
}

export interface MapRegion {
  id: MapRegionId;
  projectId: ProjectId;
  label: string;
  center: GeoPoint;
  bbox: BoundingBox | null;
  boundary: GeoPolygon | null;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface CostPricing {
  copperPerM: Money | null; // ₹/m
  fiberPerM: Money | null; // ₹/m
  copperTerminationPerEnd: Money | null; // ₹/termination
  fiberTerminationPerEnd: Money | null; // ₹/fibre termination end
  trenchingPerM: Money | null; // ₹/m of underground link
  aerialMountingPerM: Money | null; // ₹/m of aerial link
  installationLabourPerDevice: Money | null; // ₹/device
  installationLabourPerM: Money | null; // ₹/m
  softwareLicencesOneTime: Money | null; // ₹ one-time
}

export interface CostSettings {
  currency: "INR";
  cableSlackPct: number; // 0..100; approved default 15
  tcoHorizonYears: number; // integer 1..50; approved default 5
  electricityTariffPerKwh: Money | null; // ₹/kWh; null means unknown/incomplete when device energy applies
  maintenanceRatePctPerYear: number; // 0..100; approved default 7.5
  contingencyRatePct: number; // 0..100; approved default 12.5
  taxRatePct: number | null; // null explicitly means pre-tax / tax not included; not incomplete
  annualSupportCost: Money | null; // ₹/year; null means unknown/incomplete; explicit ₹0 means no support charge assumed
  pricing: CostPricing;
}

export interface CoverageSettings {
  model: "logDistance";
  frequencyMhz: number; // MHz; approved default 2400
  referenceDistanceM: number; // m; approved default 1
  referenceLossDb: number; // dB; approved default 40.0442 (FSPL at 2.4 GHz / 1 m)
  pathLossExponent: number; // dimensionless; approved default 3.0
  minimumAcceptableRssiDbm: number; // dBm; approved default -75
  gridResolutionM: number; // m; locked initial 5
  signalThresholdsDbm: {
    excellentMin: number; // dBm, inclusive
    goodMin: number; // dBm, inclusive
    fairMin: number; // dBm, inclusive
    weakMin: number; // dBm, inclusive
  };
  wallLossDbPerCrossing: Record<Exclude<ObstacleMaterial, "custom">, number>;
}

export interface SimulationSettings {
  perHostDemandMbps: number; // Mbps per configured subnet host; locked initial 5
  propagationSpeedMps: 200_000_000; // fixed MVP nominal speed
  averagePacketSizeBytes: number; // approved default 1500; used for transmission delay
  processingDelayMsPerHop: number; // approved default 1 ms
  queueingModel: "none"; // MVP: no M/M/1 calculation
}

export interface ProjectSettings {
  cost: CostSettings;
  coverage: CoverageSettings;
  simulation: SimulationSettings;
}

export interface Project {
  id: ProjectId;
  name: string;
  description: string | null;
  regionId: MapRegionId;
  frame: ProjectFrame;
  settings: ProjectSettings;
  revision: number; // integer >= 1; increments on project-level changes
  createdAt: EpochMs;
  updatedAt: EpochMs;
  lastOpenedAt: EpochMs | null;
}

export interface SimulationFlow {
  id: FlowId;
  name: string;
  sourceSubnetId: SubnetId;
  destinationDeviceId: DeviceId; // must reference a Server in this design
  demandMbpsOverride: number | null; // null => hostsRequired × perHostDemandMbps
  enabled: boolean;
}

export interface FailureScenario {
  id: FailureScenarioId;
  name: string;
  failedDeviceIds: DeviceId[];
  failedLinkIds: LinkId[];
}

export interface SimulationSetup {
  flows: SimulationFlow[]; // empty => derive defaults from subnet/server relationships
  failureScenarios: FailureScenario[];
}

export interface DesignAddressing {
  parentCidr: IPv4Cidr | null;
  allocationStatus: SubnetAllocationStatus;
  lastAllocatedAt: EpochMs | null;
}

export interface Design {
  id: DesignId;
  projectId: ProjectId;
  name: string;
  notes: string | null;
  isBaseline: boolean;
  parentDesignId: DesignId | null; // source design when duplicated; otherwise null
  revision: number; // integer >= 1
  logicalLayout: Record<DeviceId, LogicalPoint>;
  addressing: DesignAddressing;
  simulationSetup: SimulationSetup;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface DevicePortCounts {
  copperEthernet: number; // physical copper interfaces
  fiber: number; // physical fibre interfaces
  wireless: number; // wireless interfaces; not an RF client model
}

export interface CommonDeviceSpecs {
  ports: DevicePortCounts;
  capacityMbps: number | null; // supported aggregate interface/capacity assumption
  processingDelayMs: number | null; // optional device processing assumption; null uses project simulation setting
}

export interface RouterSpecs extends CommonDeviceSpecs {
  type: "router";
  routingCapacityMbps: number | null;
}

export interface SwitchSpecs extends CommonDeviceSpecs {
  type: "switch";
  switchingCapacityMbps: number | null;
}

export interface AccessPointSpecs extends CommonDeviceSpecs {
  type: "accessPoint";
  radio: {
    txPowerDbm: number;
    antennaGainDbi: number;
  };
}

export interface ServerSpecs extends CommonDeviceSpecs {
  type: "server";
  serviceCapacityMbps: number | null;
}

export type DeviceSpecifications = RouterSpecs | SwitchSpecs | AccessPointSpecs | ServerSpecs;

export interface DeviceCatalogItem {
  id: CatalogItemId;
  type: DeviceType;
  label: string;
  brand: string | null;
  model: string | null;
  specs: DeviceSpecifications;
  powerW: number | null; // watts
  lifespanYears: number | null; // years; used for replacement reserve
  unitPrice: Money | null; // null means no price supplied
  priceProvenance: PriceProvenance | null;
  priceUpdatedAt: EpochMs | null;
  origin: CatalogOrigin;
  builtInCatalogVersion: number | null; // required for built-in, null for custom
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface BuiltinCatalogSeedDefinition {
  id: CatalogItemId;
  type: DeviceType;
  label: string;
  brand: null;
  model: null;
  specs: DeviceSpecifications;
  powerW: number;
  lifespanYears: number;
  unitPrice: Money;
  priceProvenance: "sample";
  origin: "builtIn";
  builtInCatalogVersion: 1;
}

export interface DeviceOverrides {
  powerW?: number | null; // W; null explicitly clears inherited power data
  lifespanYears?: number | null; // years
  unitPrice?: Money | null; // ₹; null explicitly clears inherited price
  capacityMbps?: number | null; // Mbps
  ports?: Partial<DevicePortCounts>;
  routingCapacityMbps?: number | null; // router only, Mbps
  switchingCapacityMbps?: number | null; // switch only, Mbps
  serviceCapacityMbps?: number | null; // server only, Mbps
  radio?: Partial<AccessPointSpecs["radio"]>; // AP only
  processingDelayMs?: number | null; // ms; optional device-specific sim assumption
}

export interface Device {
  id: DeviceId;
  designId: DesignId;
  catalogItemId: CatalogItemId;
  type: DeviceType; // immutable; must match catalog item type
  name: string; // required, non-empty after trim
  hostname: string | null;
  notes: string | null;
  position: GeoPoint; // WGS84 GeoJSON Point
  overrides: DeviceOverrides; // sparse; empty object when none
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface ResolvedDevice {
  id: DeviceId;
  designId: DesignId;
  catalogItemId: CatalogItemId;
  type: DeviceType;
  name: string;
  positionLocalM: Vec2;
  specs: DeviceSpecifications;
  powerW: number | null;
  lifespanYears: number | null;
  unitPrice: Money | null;
  priceProvenance: PriceProvenance | null;
}

export interface Link {
  id: LinkId;
  designId: DesignId;
  sourceDeviceId: DeviceId;
  targetDeviceId: DeviceId;
  medium: LinkMedium;
  installationMethod: LinkInstallationMethod | null;
  geometry: GeoLineString; // WGS84, endpoints follow source/target device positions
  capacityMbps: number | null; // Mbps; required for simulation to provide throughput
  routingWeight: number; // non-negative; default 1 (one hop)
  lengthOverrideM: number | null; // user override in metres; computed length is never stored
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface ResolvedLink {
  id: LinkId;
  sourceDeviceId: DeviceId;
  targetDeviceId: DeviceId;
  medium: LinkMedium;
  installationMethod: LinkInstallationMethod | null;
  lengthM: number; // derived from geometry in local project frame, or validated override
  capacityMbps: number | null;
  routingWeight: number;
}

export interface Subnet {
  id: SubnetId;
  designId: DesignId;
  name: string;
  hostsRequired: number; // integer >= 1; numeric host requirement, not device nodes
  servedByDeviceId: DeviceId | null; // device used as the subnet's graph attachment
  linkId: LinkId | null; // optional link association; cleared when the link is deleted
  allocatedCidr: IPv4Cidr | null;
  usableHostCapacity: number | null; // count; filled by successful VLSM allocation
  wastedUsableHosts: number | null; // usableHostCapacity - hostsRequired
  allocationStatus: SubnetAllocationStatus;
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface Obstacle {
  id: ObstacleId;
  projectId: ProjectId;
  label: string;
  geometry: GeoPolygon;
  material: ObstacleMaterial;
  lossDbPerCrossing: number; // fixed dB per polygon-boundary crossing
  source: "manual"; // OSM/building import is deferred
  createdAt: EpochMs;
  updatedAt: EpochMs;
}

export interface LocalFrameTransform {
  toLocal(point: GeoPoint): Vec2;
  toGeo(point: Vec2): GeoPoint;
  polygonToLocal(polygon: GeoPolygon): Vec2[][];
  lineToLocal(line: GeoLineString): Vec2[];
}

export interface DesignAggregate {
  project: Project;
  region: MapRegion;
  design: Design;
  devicesById: Record<DeviceId, Device>;
  linksById: Record<LinkId, Link>;
  subnetsById: Record<SubnetId, Subnet>;
  obstaclesById: Record<ObstacleId, Obstacle>;
  catalogById: Record<CatalogItemId, DeviceCatalogItem>;
}
