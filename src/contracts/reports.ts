/**
 * Report model and section status contracts.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §18.2
 */

import type { EpochMs } from "./primitives";
import type {
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  ProjectSettings,
} from "./domain";
import type {
  AnalysisRecord,
  AnalysisResult,
  CostEstimate,
  CoverageResult,
  SimulationResult,
} from "./engines";

export type ReportSectionStatus = "current" | "missing" | "outOfDate";

export interface ReportAnalysisSection<T extends AnalysisResult = AnalysisResult> {
  status: ReportSectionStatus;
  record: AnalysisRecord | null;
  result: T | null;
}

export interface ReportModel {
  generatedAt: EpochMs;
  project: Project;
  region: MapRegion;
  design: Design;
  devices: Device[];
  links: Link[];
  subnets: Subnet[];
  obstacles: Obstacle[];
  cost: ReportAnalysisSection<CostEstimate>;
  coverage: ReportAnalysisSection<CoverageResult>;
  simulation: ReportAnalysisSection<SimulationResult>;
  assumptions: ProjectSettings;
  disclaimers: string[];
}

