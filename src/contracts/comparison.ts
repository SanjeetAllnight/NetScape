/**
 * Design comparison models and structural diff contracts.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §18.1
 */

import type { ProjectId, DesignId, CatalogItemId, GeoPoint } from "./primitives";
import type {
  DeviceType,
  LinkMedium,
  LinkInstallationMethod,
  AnalysisType,
} from "./enums";

export type ComparisonDirection = "higherIsBetter" | "lowerIsBetter" | "informational";

export interface MetricComparison {
  key: string;
  label: string;
  unit: "INR" | "%" | "ms" | "Mbps" | "count" | "m" | null;
  valueA: number | null;
  valueB: number | null;
  deltaBMinusA: number | null;
  direction: ComparisonDirection;
  betterDesign: "A" | "B" | "tie" | "notComparable";
}

export interface StructuralDeviceGroup {
  catalogItemId: CatalogItemId;
  type: DeviceType;
  position: GeoPoint;
  countA: number;
  countB: number;
  deltaBMinusA: number;
}

export interface StructuralEndpointSignature {
  catalogItemId: CatalogItemId;
  type: DeviceType;
  position: GeoPoint;
}

export interface StructuralLinkGroup {
  medium: LinkMedium;
  installationMethod: LinkInstallationMethod | null;
  endpointA: StructuralEndpointSignature;
  endpointB: StructuralEndpointSignature; // endpoints are canonically ordered for an undirected link diff
  countA: number;
  countB: number;
  deltaBMinusA: number;
}

export interface StructuralDesignDiff {
  devices: StructuralDeviceGroup[]; // grouped by catalog item + exact geographic position, never by remapped IDs
  links: StructuralLinkGroup[]; // grouped by medium + canonical endpoint signatures
  deviceCountA: number;
  deviceCountB: number;
  linkCountA: number;
  linkCountB: number;
}

export interface DesignComparison {
  projectId: ProjectId;
  designA: { id: DesignId; name: string; isBaseline: boolean };
  designB: { id: DesignId; name: string; isBaseline: boolean };
  structuralDiff: StructuralDesignDiff;
  metrics: MetricComparison[];
  freshness: Record<
    AnalysisType,
    { a: "current" | "outOfDate" | "missing"; b: "current" | "outOfDate" | "missing" }
  >;
}

