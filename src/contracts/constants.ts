/**
 * Locked limits, engine constants, cable specifications, and seed definitions.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §2, §3.2, §3.5
 */

import type { CatalogItemId } from "./primitives";
import type { BuiltinCatalogSeedDefinition, ProjectSettings } from "./domain";

export const DATABASE_NAME = "netscape" as const;
export const DATABASE_VERSION = 1 as const;
export const WORKER_PROTOCOL_VERSION = 1 as const;

export const DESIGN_LIMITS = {
  maxDevices: 500,
  maxLinks: 1000,
} as const;

export const COVERAGE_LIMITS = {
  maxAccessPoints: 100,
  maxGridCells: 1_000_000,
  maxObstacleSegments: 5_000,
  defaultGridResolutionM: 5,
  targetCells: 250_000,
  targetAccessPoints: 10,
  targetObstacleSegments: 200,
  targetRuntimeMs: 5_000,
} as const;

export const GEOGRAPHY_LIMITS = {
  maxPlanningExtentM: 20_000,
} as const;

export const SIMULATION_DEFAULTS = {
  perHostDemandMbps: 5,
  routingWeight: 1,
  propagationSpeedMps: 200_000_000,
} as const;

export const COST_DEFAULTS = {
  currency: "INR" as const,
  cableSlackPct: 15,
  annualMaintenanceRatePct: 7.5,
  contingencyRatePct: 12.5,
  tcoHorizonYears: 5,
  devicePowerDutyRatio: 1, // fixed 100% continuous nameplate draw; not user-editable
} as const;

export const COVERAGE_DEFAULTS = {
  frequencyMhz: 2400,
  referenceReceiverGainDbi: 0, // fixed reference-client assumption; not a user-editable project setting
  referenceDistanceM: 1,
  referenceLossDb: 40.0442,
  pathLossExponent: 3,
  minimumAcceptableRssiDbm: -75,
  gridResolutionM: 5,
  signalThresholdsDbm: {
    excellentMin: -55,
    goodMin: -67,
    fairMin: -75,
    weakMin: -85,
  },
  wallLossDbPerCrossing: {
    glass: 3,
    drywall: 3,
    brick: 8,
    concrete: 12.5,
  },
} as const;

export const SIMULATION_ASSUMPTIONS = {
  averagePacketSizeBytes: 1500,
  processingDelayMsPerHop: 1,
  queueingModel: "none" as const,
} as const;

export const ENGINE_IDS = {
  ip: "netscape.ip",
  cost: "netscape.cost",
  coverage: "netscape.coverage",
  simulation: "netscape.simulation",
} as const;

/** Bump an engine version whenever its results or input semantics change. */
export const ENGINE_VERSIONS = {
  ip: 1,
  cost: 1,
  coverage: 1,
  simulation: 1,
} as const;

export const NO_SIGNAL_RSSI_DBM = -127;
export const OUTSIDE_COVERAGE_MASK_INDEX = 254;
export const NO_SERVING_AP_INDEX = 255;

export interface CableSpec {
  medium: "copper" | "fiber";
  label: string;
  maxSegmentLengthM: number | null;
  attenuationDbPerKm?: number | null;
  referenceWavelengthNm?: number | null;
}

export const CABLE_SPECS: Readonly<Record<"copper" | "fiber", CableSpec>> = {
  copper: {
    medium: "copper",
    label: "Ethernet copper (Cat5e/Cat6 reference)",
    maxSegmentLengthM: 100,
    attenuationDbPerKm: null,
    referenceWavelengthNm: null,
  },
  fiber: {
    medium: "fiber",
    label: "Single-mode fibre (1310 nm reference)",
    maxSegmentLengthM: null,
    attenuationDbPerKm: 0.35,
    referenceWavelengthNm: 1310,
  },
};

export const DEFAULT_BASELINE_DESIGN_NAME = "Baseline" as const;

export const BUILTIN_CATALOG_VERSION = 1 as const;

export const BUILTIN_CATALOG_SEED: readonly BuiltinCatalogSeedDefinition[] = [
  {
    id: "cat_550e8400-e29b-41d4-a716-446655440001" as CatalogItemId,
    type: "router",
    label: "Illustrative Router — 4 Copper / 1 Fibre / 1 Wireless",
    brand: null,
    model: null,
    specs: {
      type: "router",
      ports: { copperEthernet: 4, fiber: 1, wireless: 1 },
      capacityMbps: 1000,
      processingDelayMs: null,
      routingCapacityMbps: 1000,
    },
    powerW: 15,
    lifespanYears: 5,
    unitPrice: { amount: 8000, currency: "INR" },
    priceProvenance: "sample",
    origin: "builtIn",
    builtInCatalogVersion: 1,
  },
  {
    id: "cat_550e8400-e29b-41d4-a716-446655440002" as CatalogItemId,
    type: "switch",
    label: "Illustrative Switch — 24 Copper / 2 Fibre",
    brand: null,
    model: null,
    specs: {
      type: "switch",
      ports: { copperEthernet: 24, fiber: 2, wireless: 0 },
      capacityMbps: 24000,
      processingDelayMs: null,
      switchingCapacityMbps: 24000,
    },
    powerW: 35,
    lifespanYears: 5,
    unitPrice: { amount: 6000, currency: "INR" },
    priceProvenance: "sample",
    origin: "builtIn",
    builtInCatalogVersion: 1,
  },
  {
    id: "cat_550e8400-e29b-41d4-a716-446655440003" as CatalogItemId,
    type: "accessPoint",
    label: "Illustrative Wi-Fi Access Point — Dual-band Reference",
    brand: null,
    model: null,
    specs: {
      type: "accessPoint",
      ports: { copperEthernet: 1, fiber: 0, wireless: 1 },
      capacityMbps: 1200,
      processingDelayMs: null,
      radio: { txPowerDbm: 20, antennaGainDbi: 3 },
    },
    powerW: 12,
    lifespanYears: 4,
    unitPrice: { amount: 4500, currency: "INR" },
    priceProvenance: "sample",
    origin: "builtIn",
    builtInCatalogVersion: 1,
  },
  {
    id: "cat_550e8400-e29b-41d4-a716-446655440004" as CatalogItemId,
    type: "server",
    label: "Illustrative Server — 2 Copper",
    brand: null,
    model: null,
    specs: {
      type: "server",
      ports: { copperEthernet: 2, fiber: 0, wireless: 0 },
      capacityMbps: 1000,
      processingDelayMs: null,
      serviceCapacityMbps: 1000,
    },
    powerW: 150,
    lifespanYears: 5,
    unitPrice: { amount: 45000, currency: "INR" },
    priceProvenance: "sample",
    origin: "builtIn",
    builtInCatalogVersion: 1,
  },
] as const;

/** Canonical defaults copied into each newly created Project; never share a mutable object reference. */
export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  cost: {
    currency: "INR",
    cableSlackPct: COST_DEFAULTS.cableSlackPct,
    tcoHorizonYears: COST_DEFAULTS.tcoHorizonYears,
    electricityTariffPerKwh: { amount: 8, currency: "INR" },
    maintenanceRatePctPerYear: COST_DEFAULTS.annualMaintenanceRatePct,
    contingencyRatePct: COST_DEFAULTS.contingencyRatePct,
    taxRatePct: null,
    annualSupportCost: { amount: 0, currency: "INR" },
    pricing: {
      copperPerM: { amount: 35, currency: "INR" },
      fiberPerM: { amount: 80, currency: "INR" },
      copperTerminationPerEnd: { amount: 100, currency: "INR" },
      fiberTerminationPerEnd: { amount: 250, currency: "INR" },
      trenchingPerM: { amount: 150, currency: "INR" },
      aerialMountingPerM: { amount: 75, currency: "INR" },
      installationLabourPerDevice: { amount: 500, currency: "INR" },
      installationLabourPerM: { amount: 15, currency: "INR" },
      softwareLicencesOneTime: { amount: 0, currency: "INR" },
    },
  },
  coverage: {
    model: "logDistance",
    frequencyMhz: COVERAGE_DEFAULTS.frequencyMhz,
    referenceDistanceM: COVERAGE_DEFAULTS.referenceDistanceM,
    referenceLossDb: COVERAGE_DEFAULTS.referenceLossDb,
    pathLossExponent: COVERAGE_DEFAULTS.pathLossExponent,
    minimumAcceptableRssiDbm: COVERAGE_DEFAULTS.minimumAcceptableRssiDbm,
    gridResolutionM: COVERAGE_DEFAULTS.gridResolutionM,
    signalThresholdsDbm: { ...COVERAGE_DEFAULTS.signalThresholdsDbm },
    wallLossDbPerCrossing: { ...COVERAGE_DEFAULTS.wallLossDbPerCrossing },
  },
  simulation: {
    perHostDemandMbps: SIMULATION_DEFAULTS.perHostDemandMbps,
    propagationSpeedMps: SIMULATION_DEFAULTS.propagationSpeedMps,
    averagePacketSizeBytes: SIMULATION_ASSUMPTIONS.averagePacketSizeBytes,
    processingDelayMsPerHop: SIMULATION_ASSUMPTIONS.processingDelayMsPerHop,
    queueingModel: "none",
  },
};
