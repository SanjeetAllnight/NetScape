/**
 * Validation issues and typed application errors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §8
 */

export type ValidationSeverity = "error" | "warning";

export type ValidationIssueCode =
  | "REQUIRED"
  | "INVALID_FORMAT"
  | "OUT_OF_RANGE"
  | "DUPLICATE_NAME"
  | "INVALID_GEOMETRY"
  | "SELF_INTERSECTION"
  | "AREA_TOO_LARGE"
  | "DEVICE_OUTSIDE_BOUNDARY"
  | "DEVICE_LIMIT_EXCEEDED"
  | "LINK_LIMIT_EXCEEDED"
  | "LINK_ENDPOINT_MISSING"
  | "LINK_SELF_CONNECTION"
  | "LINK_DUPLICATE"
  | "LINK_MEDIUM_INCOMPATIBLE"
  | "PORT_BUDGET_EXCEEDED"
  | "LINK_EXCEEDS_MAX_LENGTH"
  | "CATALOG_ITEM_MISSING"
  | "CATALOG_TYPE_MISMATCH"
  | "CATALOG_ITEM_IN_USE"
  | "INVALID_CIDR"
  | "HOST_REQUIREMENT_INVALID"
  | "SUBNET_REFERENCE_MISSING"
  | "ALLOCATION_OUT_OF_DATE"
  | "ALLOCATION_OVERLAP"
  | "INSUFFICIENT_ADDRESS_SPACE"
  | "OBSTACLE_LIMIT_EXCEEDED"
  | "COVERAGE_AP_LIMIT_EXCEEDED"
  | "COVERAGE_GRID_LIMIT_EXCEEDED"
  | "COVERAGE_BOUNDARY_REQUIRED"
  | "COVERAGE_ACCESS_POINT_REQUIRED"
  | "SIMULATION_FLOW_INVALID"
  | "SIMULATION_SCENARIO_INVALID"
  | "MISSING_COST_INPUT"
  | "MISSING_DEVICE_PRICE"
  | "MISSING_POWER_SPEC";

export interface ValidationIssue {
  code: ValidationIssueCode;
  severity: ValidationSeverity;
  message: string;
  path: string; // field path, e.g. "devices.dev_x.position"
  entityType:
    | "project"
    | "region"
    | "design"
    | "device"
    | "link"
    | "subnet"
    | "obstacle"
    | "catalog"
    | "analysis"
    | "simulation";
  entityId: string | null;
  relatedEntityIds: string[];
}

export type NetScapeErrorCode =
  | "VALIDATION_FAILED"
  | "REVISION_CONFLICT"
  | "QUOTA_EXCEEDED"
  | "DATABASE_UNAVAILABLE"
  | "DATABASE_BLOCKED"
  | "DATABASE_VERSION_CHANGE"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "REFERENTIAL_INTEGRITY_FAILED"
  | "WORKER_FAILED"
  | "WORKER_PROTOCOL_ERROR"
  | "WORKER_CANCELLED"
  | "WORKER_TIMEOUT"
  | "ENGINE_INPUT_INVALID"
  | "ENGINE_LIMIT_EXCEEDED"
  | "SERVICE_UNAVAILABLE"
  | "GEOCODER_RATE_LIMITED"
  | "PDF_GENERATION_FAILED"
  | "UNKNOWN_ERROR";

export interface NetScapeErrorOptions {
  cause?: unknown;
  details?: Record<string, unknown>;
  recoverable?: boolean;
}

export class NetScapeError extends Error {
  readonly code: NetScapeErrorCode;
  readonly details: Record<string, unknown> | null;
  readonly recoverable: boolean;

  constructor(code: NetScapeErrorCode, message: string, options?: NetScapeErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = "NetScapeError";
    this.code = code;
    this.details = options?.details ?? null;
    this.recoverable = options?.recoverable ?? false;
  }
}

export class EngineInputError extends NetScapeError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("ENGINE_INPUT_INVALID", message, { details });
    this.name = "EngineInputError";
  }
}

export class StorageError extends NetScapeError {
  constructor(
    code: Extract<
      NetScapeErrorCode,
      | "REVISION_CONFLICT"
      | "QUOTA_EXCEEDED"
      | "DATABASE_UNAVAILABLE"
      | "DATABASE_BLOCKED"
      | "DATABASE_VERSION_CHANGE"
      | "STORAGE_READ_FAILED"
      | "STORAGE_WRITE_FAILED"
      | "REFERENTIAL_INTEGRITY_FAILED"
    >,
    message: string,
    options?: NetScapeErrorOptions
  ) {
    super(code, message, options);
    this.name = "StorageError";
  }
}

export class ServiceError extends NetScapeError {
  constructor(
    code: Extract<
      NetScapeErrorCode,
      "SERVICE_UNAVAILABLE" | "GEOCODER_RATE_LIMITED" | "PDF_GENERATION_FAILED"
    >,
    message: string,
    options?: NetScapeErrorOptions
  ) {
    super(code, message, options);
    this.name = "ServiceError";
  }
}

