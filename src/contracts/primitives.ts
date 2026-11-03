/**
 * Branded identifier and scalar primitive types.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §1
 */

export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type ProjectId = Brand<string, "ProjectId">;
export type DesignId = Brand<string, "DesignId">;
export type MapRegionId = Brand<string, "MapRegionId">;
export type DeviceId = Brand<string, "DeviceId">;
export type LinkId = Brand<string, "LinkId">;
export type SubnetId = Brand<string, "SubnetId">;
export type ObstacleId = Brand<string, "ObstacleId">;
export type CatalogItemId = Brand<string, "CatalogItemId">;
export type AnalysisId = Brand<string, "AnalysisId">;
export type AnalysisBlobId = Brand<string, "AnalysisBlobId">;
export type FlowId = Brand<string, "FlowId">;
export type FailureScenarioId = Brand<string, "FailureScenarioId">;
export type EpochMs = Brand<number, "EpochMs">;
export type InputHash = Brand<string, "InputHash">; // lower-case 64-character SHA-256 hex
export type IPv4Address = Brand<string, "IPv4Address">; // canonical dotted decimal
export type IPv4Cidr = Brand<string, "IPv4Cidr">; // canonical network-address/prefix
export type PercentRatio = Brand<number, "PercentRatio">; // 0..1
export type PositiveInt = Brand<number, "PositiveInt">;

export interface IdGenerator {
  project(): ProjectId;
  design(): DesignId;
  mapRegion(): MapRegionId;
  device(): DeviceId;
  link(): LinkId;
  subnet(): SubnetId;
  obstacle(): ObstacleId;
  catalogItem(): CatalogItemId;
  analysis(): AnalysisId;
  analysisBlob(): AnalysisBlobId;
  flow(): FlowId;
  failureScenario(): FailureScenarioId;
}

export interface Clock {
  now(): EpochMs;
}

export type CurrencyCode = "INR";

export interface Money {
  amount: number; // >= 0, INR units (₹), finite
  currency: CurrencyCode; // MVP: "INR" only
}

export type Longitude = Brand<number, "Longitude">; // -180..180 degrees
export type Latitude = Brand<number, "Latitude">; // -90..90 degrees

/** GeoJSON Point, always [longitude, latitude] in WGS84 / EPSG:4326. */
export interface GeoPoint {
  type: "Point";
  coordinates: [Longitude, Latitude];
}

export type LonLat = [Longitude, Latitude];

/** GeoJSON Polygon. coordinates[0] is the exterior ring; later rings are holes. */
export interface GeoPolygon {
  type: "Polygon";
  coordinates: LonLat[][];
}

/** GeoJSON LineString used by Link.geometry. */
export interface GeoLineString {
  type: "LineString";
  coordinates: LonLat[];
}

/** WGS84 bbox in [west, south, east, north] order, degrees. */
export type BoundingBox = [Longitude, Latitude, Longitude, Latitude];

/** Abstract React Flow coordinate. Never pass to a geospatial/engineering function. */
export interface LogicalPoint {
  coordinateSpace: "logical";
  x: number; // abstract canvas px
  y: number; // abstract canvas px
}

/** Project-local metric coordinate, east/north metres. */
export interface Vec2 {
  coordinateSpace: "projectMetric";
  x: number; // east metres
  y: number; // north metres
}

export interface MetricBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

