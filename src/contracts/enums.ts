/**
 * Enumerations and string union types.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §2
 */

export type DeviceType = "router" | "switch" | "accessPoint" | "server";
export type LinkMedium = "copper" | "fiber" | "wireless";
export type LinkInstallationMethod = "indoor" | "underground" | "aerial";
export type ObstacleMaterial = "glass" | "drywall" | "brick" | "concrete" | "custom";
export type AnalysisType = "cost" | "coverage" | "simulation";
export type AnalysisStatus =
  | "notCalculated"
  | "running"
  | "current"
  | "outOfDate"
  | "cancelled"
  | "failed";
export type SignalClass = "excellent" | "good" | "fair" | "weak" | "deadZone";
export type PriceProvenance = "sample" | "userEntered";
export type CatalogOrigin = "builtIn" | "custom";
export type SubnetAllocationStatus = "notAllocated" | "current" | "outOfDate" | "unallocated";
export type TopologyTemplateKind = "star" | "tree";
export type WorkerTaskKind = "coverage.compute" | "simulation.run";
