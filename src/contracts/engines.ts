/**
 * Analysis records, engine inputs, outputs, and pure engine contracts.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §10, §11, §12, §13, §14, §15, §16
 */

import type {
  AnalysisId,
  AnalysisBlobId,
  ProjectId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  FlowId,
  FailureScenarioId,
  EpochMs,
  InputHash,
  IPv4Address,
  IPv4Cidr,
  Money,
  Vec2,
  MetricBounds,
} from "./primitives";

import type {
  AnalysisType,
  DeviceType,
  LinkMedium,
  LinkInstallationMethod,
  SignalClass,
  PriceProvenance,
} from "./enums";

import type {
  CostSettings,
  CoverageSettings,
  SimulationSettings,
  SimulationSetup,
  DesignAggregate,
} from "./domain";

export interface RunContext {
  shouldCancel(): boolean;
  reportProgress(fraction: number, phase: string): void;
  yieldToEventLoop(): Promise<void>;
}

export interface DesignStamp {
  projectId: ProjectId;
  designId: DesignId;
  projectRevision: number;
  designRevision: number;
  inputHash: InputHash;
}

export interface HashService {
  hashCanonical(value: unknown): Promise<InputHash>;
}

export interface AnalysisHashInput<T> {
  engineId: string;
  engineVersion: number;
  input: T;
}

/* -------------------------------------------------------------------------- */
/*                                  Coverage                                  */
/* -------------------------------------------------------------------------- */

export interface AnalysisBlob {
  id: AnalysisBlobId;
  analysisId: AnalysisId;
  projectId: ProjectId;
  designId: DesignId;
  width: number; // columns
  height: number; // rows
  rssiDbm: Int8Array; // row-major, NO_SIGNAL_RSSI_DBM means no AP signal
  servingIndex: Uint8Array; // row-major; 0..AP count-1; 254 outside mask; 255 no serving AP
  servingAccessPointIds: DeviceId[]; // index → stable DeviceId mapping
  createdAt: EpochMs;
}

export interface CoverageGrid {
  blobId: AnalysisBlobId;
  width: number;
  height: number;
  cellSizeM: number;
  topLeftLocalM: Vec2; // top-left corner of the raster in project metric frame
  totalIncludedCells: number; // cells inside polygon mask
  rasterEncoding: "int8-rssi-dBm";
  servingIndexEncoding: "uint8-access-point-index-with-mask-sentinels";
  noSignalRssiDbm: -127;
  outsideMaskIndex: 254;
  noServingIndex: 255;
}

export interface SignalClassCount {
  class: SignalClass;
  cellCount: number;
  areaM2: number;
}

export interface DeadZone {
  id: string; // deterministic ID derived from raster component index, not random
  centroidLocalM: Vec2;
  boundsLocalM: MetricBounds;
  areaM2: number;
  cellCount: number;
  worstRssiDbm: number;
}

export interface CoverageResult {
  isEstimate: true;
  model: "logDistance";
  coveragePercent: number; // 0..100 for configured minimum acceptable RSSI
  minimumAcceptableRssiDbm: number;
  includedCellCount: number;
  coveredCellCount: number;
  classCounts: SignalClassCount[];
  deadZones: DeadZone[];
  grid: CoverageGrid;
  parameters: CoverageSettings;
  referenceReceiverGainDbi: 0; // fixed reference-client gain; disclosed, not configurable
  limitationNotes: string[];
}

export interface CoverageAccessPointInput {
  deviceId: DeviceId;
  positionM: Vec2;
  txPowerDbm: number;
  antennaGainDbi: number;
}

export interface CoverageObstacleInput {
  obstacleId: ObstacleId;
  polygonM: Vec2[][];
  lossDbPerCrossing: number;
}

export interface CoverageEngineInput {
  designId: DesignId;
  boundaryM: Vec2[][];
  accessPoints: CoverageAccessPointInput[]; // max 100
  obstacles: CoverageObstacleInput[]; // max 5,000 boundary segments total
  settings: CoverageSettings;
  receiverAntennaGainDbi: 0; // fixed reference-client gain; included in the hashed input
}

export interface CoverageWorkerOutput {
  result: Omit<CoverageResult, "grid"> & {
    grid: Omit<CoverageGrid, "blobId">;
  };
  rssiDbm: Int8Array;
  servingIndex: Uint8Array;
  servingAccessPointIds: DeviceId[];
}

export interface CoverageEngine {
  compute(input: CoverageEngineInput, context: RunContext): Promise<CoverageWorkerOutput>;
}

/* -------------------------------------------------------------------------- */
/*                                    Cost                                    */
/* -------------------------------------------------------------------------- */

export type CostCategory =
  | "hardware"
  | "cabling"
  | "termination"
  | "civilWork"
  | "labour"
  | "licence"
  | "energy"
  | "maintenance"
  | "support"
  | "replacementReserve"
  | "contingency"
  | "tax";

export type CostCompleteness = "complete" | "partial";

export interface CostLineItem {
  id: string;
  category: CostCategory;
  label: string;
  quantity: number;
  unit: "device" | "m" | "termination" | "year" | "kWh" | "item";
  unitPrice: Money | null;
  amount: Money | null;
  provenance: PriceProvenance | "projectAssumption" | "derived" | "missing";
  sourceEntityId: DeviceId | LinkId | null;
  note: string | null;
}

export interface CostBucket {
  knownSubtotal: Money;
  total: Money | null; // null when required input missing
  completeness: CostCompleteness;
}

export interface CostIssue {
  code:
    | "MISSING_DEVICE_PRICE"
    | "MISSING_CABLE_PRICE"
    | "MISSING_TERMINATION_RATE"
    | "MISSING_TARIFF"
    | "MISSING_LABOUR_RATE"
    | "MISSING_CIVIL_RATE"
    | "MISSING_SOFTWARE_LICENCE_COST"
    | "MISSING_INSTALLATION_METHOD"
    | "MISSING_LIFESPAN"
    | "MISSING_POWER_SPEC"
    | "SUPPORT_NOT_CONFIGURED"
    | "TAX_EXCLUDED";
  message: string;
  sourceEntityId: DeviceId | LinkId | null;
}

export interface CostEstimate {
  isEstimate: true;
  currency: "INR";
  completeness: CostCompleteness;
  capex: CostBucket;
  annualOpex: CostBucket;
  tco: CostBucket;
  tcoHorizonYears: number;
  byCategory: Partial<Record<CostCategory, Money>>;
  lineItems: CostLineItem[];
  issues: CostIssue[];
  assumptions: {
    settings: CostSettings;
    devicePowerDutyRatio: 1; // fixed 100% continuous nameplate draw; disclose in UI/report
  };
}

export interface CostDeviceInput {
  deviceId: DeviceId;
  type: DeviceType;
  unitPrice: Money | null;
  priceProvenance: PriceProvenance | null;
  powerW: number | null;
  lifespanYears: number | null;
}

export interface CostLinkInput {
  linkId: LinkId;
  medium: LinkMedium;
  lengthM: number; // derived in domain builder
  installationMethod: LinkInstallationMethod | null;
}

export interface CostEngineInput {
  currency: "INR";
  devices: CostDeviceInput[];
  links: CostLinkInput[];
  settings: CostSettings;
  devicePowerDutyRatio: 1; // fixed assumption included in the canonical input hash
}

export interface CostEngine {
  estimate(input: CostEngineInput): CostEstimate;
}

/* -------------------------------------------------------------------------- */
/*                                 Simulation                                 */
/* -------------------------------------------------------------------------- */

export interface LatencyBreakdown {
  propagationMs: number;
  transmissionMs: number;
  processingMs: number;
  totalMs: number;
  queueingMs: null; // queueing model is not run in this contract
}

export interface LinkUtilization {
  linkId: LinkId;
  capacityMbps: number;
  offeredLoadMbps: number;
  deliveredLoadMbps: number;
  utilizationRatio: number; // deliveredLoad / capacity, may exceed 1 only if invalid input; normally <=1
  isCongested: boolean;
}

export type SimulationUnreachableReason =
  | "sourceFailed"
  | "destinationFailed"
  | "noPath"
  | "missingServingDevice";
export type SimulationThroughputCompleteness = "complete" | "missingCapacity" | "notApplicable";

export interface SimulationIssue {
  code: "MISSING_LINK_CAPACITY";
  message: string;
  linkId: LinkId;
}

export interface SimulationFlowResult {
  flowId: FlowId;
  sourceSubnetId: SubnetId;
  sourceDeviceId: DeviceId | null;
  destinationDeviceId: DeviceId;
  reachable: boolean; // graph reachability only; independent of capacity completeness
  unreachableReason: SimulationUnreachableReason | null;
  throughputCompleteness: SimulationThroughputCompleteness;
  pathDeviceIds: DeviceId[];
  pathLinkIds: LinkId[];
  hopCount: number;
  offeredDemandMbps: number;
  bottleneckCapacityMbps: number | null;
  deliveredRateMbps: number | null; // null if a reachable path lacks capacity input; 0 if unreachable
  latency: LatencyBreakdown | null; // null if unreachable or a path capacity needed for transmission delay is missing
  issues: SimulationIssue[];
}

export interface NetworkMetrics {
  totalFlowCount: number;
  reachableFlowCount: number;
  unreachableFlowCount: number;
  incompleteFlowCount: number;
  completeness: "complete" | "partial";
  aggregateOfferedDemandMbps: number;
  aggregateDeliveredRateMbps: number; // sum of known rates; completeness explains omitted unknown rates
  meanReachableLatencyMs: number | null; // arithmetic mean among reachable flows with a computed latency
  latencyFlowCount: number;
  maxReachableLatencyMs: number | null;
  linkUtilization: LinkUtilization[];
}

export type ScenarioMetricKey =
  | "reachableFlowCount"
  | "unreachableFlowCount"
  | "aggregateDeliveredRateMbps"
  | "meanReachableLatencyMs";

export interface ScenarioMetricDelta {
  key: ScenarioMetricKey;
  baselineValue: number | null;
  scenarioValue: number | null;
  deltaScenarioMinusBaseline: number | null;
  percentageChange: number | null; // null when baseline is null or zero
}

export interface FlowScenarioDelta {
  flowId: FlowId;
  baselineReachable: boolean;
  scenarioReachable: boolean;
  reachabilityChanged: boolean;
  baselineDeliveredRateMbps: number | null;
  scenarioDeliveredRateMbps: number | null;
  deliveredRateDeltaMbps: number | null;
  baselineLatencyMs: number | null;
  scenarioLatencyMs: number | null;
  latencyDeltaMs: number | null;
}

export interface ScenarioComparison {
  scenarioId: FailureScenarioId;
  metrics: ScenarioMetricDelta[];
  flows: FlowScenarioDelta[];
}

export interface FailureScenarioResult {
  scenarioId: FailureScenarioId;
  name: string;
  failedDeviceIds: DeviceId[];
  failedLinkIds: LinkId[];
  metrics: NetworkMetrics;
  flowResults: SimulationFlowResult[];
  comparisonToBaseline: ScenarioComparison;
}

export interface SimulationResult {
  isEstimate: true;
  routingAlgorithm: "dijkstra";
  graphModel: "undirected";
  baselineMetrics: NetworkMetrics;
  baselineFlows: SimulationFlowResult[];
  scenarios: FailureScenarioResult[];
  assumptions: SimulationSettings;
  limitations: string[];
}

export interface SimulationNodeInput {
  deviceId: DeviceId;
  type: DeviceType;
  processingDelayMs: number | null;
}

export interface SimulationEdgeInput {
  linkId: LinkId;
  sourceDeviceId: DeviceId;
  targetDeviceId: DeviceId;
  medium: LinkMedium;
  lengthM: number;
  capacityMbps: number | null;
  routingWeight: number;
}

export interface SimulationFlowInput {
  flowId: FlowId;
  subnetId: SubnetId;
  sourceDeviceId: DeviceId | null;
  destinationDeviceId: DeviceId;
  demandMbps: number; // finite and > 0
}

export interface SimulationScenarioInput {
  scenarioId: FailureScenarioId;
  name: string;
  failedDeviceIds: DeviceId[];
  failedLinkIds: LinkId[];
}

export interface SimulationEngineInput {
  nodes: SimulationNodeInput[];
  edges: SimulationEdgeInput[];
  flows: SimulationFlowInput[];
  scenarios: SimulationScenarioInput[];
  settings: SimulationSettings;
}

export interface SimulationWorkerOutput {
  result: SimulationResult;
}

export interface SimulationEngine {
  run(input: SimulationEngineInput, context: RunContext): Promise<SimulationWorkerOutput>;
}

/* -------------------------------------------------------------------------- */
/*                                IPv4 / VLSM                                 */
/* -------------------------------------------------------------------------- */

export interface VlsmSubnetRequirement {
  subnetId: SubnetId;
  name: string;
  hostsRequired: number;
}

export interface VlsmEngineInput {
  parentCidr: IPv4Cidr;
  subnets: VlsmSubnetRequirement[];
}

export interface VlsmSubnetAllocation {
  subnetId: SubnetId;
  cidr: IPv4Cidr;
  networkAddress: IPv4Address;
  broadcastAddress: IPv4Address;
  firstUsableAddress: IPv4Address;
  lastUsableAddress: IPv4Address;
  allocatedAddressCount: number;
  usableHostCapacity: number;
  hostsRequired: number;
  wastedUsableHosts: number;
}

export interface UnallocatedSubnet {
  subnetId: SubnetId;
  reason: "INSUFFICIENT_SPACE";
  hostsRequired: number;
  requiredPrefix: number;
}

export interface VlsmEngineOutput {
  parentCidr: IPv4Cidr;
  allocations: VlsmSubnetAllocation[];
  unallocated: UnallocatedSubnet[];
  remainingAddressSpace: IPv4Cidr[];
  totalAllocatedAddresses: number;
  totalWastedUsableHosts: number;
  isComplete: boolean;
}

export interface ParsedIPv4Cidr {
  address: IPv4Address;
  prefix: number;
  networkAddress: IPv4Address;
  broadcastAddress: IPv4Address;
  totalAddresses: number;
  usableHostCount: number;
}

export interface IpEngine {
  parseCidr(cidr: string): ParsedIPv4Cidr;
  allocateVlsm(input: VlsmEngineInput): VlsmEngineOutput;
}

/* -------------------------------------------------------------------------- */
/*                              Analysis Envelope                             */
/* -------------------------------------------------------------------------- */

export interface AnalysisRecordBase {
  id: AnalysisId;
  projectId: ProjectId;
  designId: DesignId;
  type: AnalysisType;
  engineId: string;
  engineVersion: number;
  inputHash: InputHash;
  parameters: AnalysisParameters;
  isEstimate: true;
  computedAt: EpochMs;
}

export type AnalysisParameters =
  | { type: "cost"; settings: CostSettings }
  | { type: "coverage"; settings: CoverageSettings }
  | { type: "simulation"; settings: SimulationSettings; setup: SimulationSetup };

export type AnalysisRecord =
  | (AnalysisRecordBase & {
      type: "cost";
      parameters: Extract<AnalysisParameters, { type: "cost" }>;
      result: CostEstimate;
    })
  | (AnalysisRecordBase & {
      type: "coverage";
      parameters: Extract<AnalysisParameters, { type: "coverage" }>;
      result: CoverageResult;
    })
  | (AnalysisRecordBase & {
      type: "simulation";
      parameters: Extract<AnalysisParameters, { type: "simulation" }>;
      result: SimulationResult;
    });

export type AnalysisResult = CostEstimate | CoverageResult | SimulationResult;

export interface AnalysisInputBuilders {
  buildCostInput(aggregate: DesignAggregate): CostEngineInput;
  buildCoverageInput(aggregate: DesignAggregate): CoverageEngineInput;
  buildSimulationInput(aggregate: DesignAggregate): SimulationEngineInput;
  buildVlsmInput(aggregate: DesignAggregate): VlsmEngineInput;
}
