/**
 * Web Worker task maps, message envelopes, and WorkerClient interface.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §16
 */

import type { WorkerTaskKind } from "./enums";
import type { NetScapeErrorCode } from "./errors";
import type {
  CoverageEngineInput,
  CoverageWorkerOutput,
  SimulationEngineInput,
  SimulationWorkerOutput,
  DesignStamp,
} from "./engines";

export interface WorkerTaskMap {
  "coverage.compute": {
    input: CoverageEngineInput;
    output: CoverageWorkerOutput;
  };
  "simulation.run": {
    input: SimulationEngineInput;
    output: SimulationWorkerOutput;
  };
}

export interface WorkerRequest<K extends WorkerTaskKind = WorkerTaskKind> {
  protocolVersion: 1;
  requestId: string;
  taskId: string;
  kind: K;
  payload: WorkerTaskMap[K]["input"];
  stamp: DesignStamp;
}

export interface WorkerProgressMessage {
  protocolVersion: 1;
  requestId: string;
  type: "progress";
  fraction: number; // 0..1
  phase: string;
}

export interface WorkerSuccessMessage<K extends WorkerTaskKind = WorkerTaskKind> {
  protocolVersion: 1;
  requestId: string;
  type: "success";
  result: WorkerTaskMap[K]["output"];
}

export interface SerializedWorkerError {
  name: string;
  code: NetScapeErrorCode;
  message: string;
  details: Record<string, unknown> | null;
  recoverable: boolean;
}

export interface WorkerFailureMessage {
  protocolVersion: 1;
  requestId: string;
  type: "failure";
  error: SerializedWorkerError;
}

export interface WorkerCancelledMessage {
  protocolVersion: 1;
  requestId: string;
  type: "cancelled";
}

export interface WorkerCancelMessage {
  protocolVersion: 1;
  requestId: string;
  type: "cancel";
}

export type WorkerResponse<K extends WorkerTaskKind = WorkerTaskKind> =
  | WorkerProgressMessage
  | WorkerSuccessMessage<K>
  | WorkerFailureMessage
  | WorkerCancelledMessage;

export interface WorkerRunHandle<K extends WorkerTaskKind> {
  requestId: string;
  result: Promise<WorkerTaskMap[K]["output"]>;
}

export interface WorkerClient {
  run<K extends WorkerTaskKind>(
    kind: K,
    payload: WorkerTaskMap[K]["input"],
    stamp: DesignStamp,
    onProgress?: (message: WorkerProgressMessage) => void
  ): WorkerRunHandle<K>;
  cancel(requestId: string): Promise<void>;
  dispose(): void;
}

