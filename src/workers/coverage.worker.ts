/**
 * Web Worker for Wireless Coverage Raster Computation.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §16
 */

/// <reference lib="webworker" />

import type {
  WorkerRequest,
  WorkerCancelMessage,
  WorkerProgressMessage,
  WorkerSuccessMessage,
  WorkerFailureMessage,
  WorkerCancelledMessage,
} from "@/contracts/workers";
import type { RunContext } from "@/contracts/engines";
import { computeCoverage } from "@/engines/coverage/coverageEngine";

let currentRequestId: string | null = null;
let isCancelled = false;

self.onmessage = async (
  event: MessageEvent<WorkerRequest<"coverage.compute"> | WorkerCancelMessage>
) => {
  const msg = event.data;
  if (!msg || msg.protocolVersion !== 1) {
    return;
  }

  if ("type" in msg && msg.type === "cancel") {
    if (msg.requestId === currentRequestId) {
      isCancelled = true;
    }
    return;
  }

  if (!("kind" in msg) || msg.kind !== "coverage.compute") {
    return;
  }

  currentRequestId = msg.requestId;
  isCancelled = false;

  const runContext: RunContext = {
    shouldCancel: () => isCancelled,
    reportProgress: (fraction: number, phase: string) => {
      const progressMsg: WorkerProgressMessage = {
        protocolVersion: 1,
        requestId: msg.requestId,
        type: "progress",
        fraction: Math.max(0, Math.min(1, fraction)),
        phase,
      };
      self.postMessage(progressMsg);
    },
    yieldToEventLoop: () => new Promise((resolve) => setTimeout(resolve, 0)),
  };

  try {
    const output = await computeCoverage(msg.payload, runContext);

    if (isCancelled) {
      const cancelMsg: WorkerCancelledMessage = {
        protocolVersion: 1,
        requestId: msg.requestId,
        type: "cancelled",
      };
      self.postMessage(cancelMsg);
      return;
    }

    const successMsg: WorkerSuccessMessage<"coverage.compute"> = {
      protocolVersion: 1,
      requestId: msg.requestId,
      type: "success",
      result: output,
    };

    // Transfer large Int8Array and Uint8Array buffers to the main thread with zero copy
    self.postMessage(successMsg, [output.rssiDbm.buffer, output.servingIndex.buffer]);
  } catch (err: unknown) {
    if (isCancelled || (err instanceof Error && err.message.includes("cancelled"))) {
      const cancelMsg: WorkerCancelledMessage = {
        protocolVersion: 1,
        requestId: msg.requestId,
        type: "cancelled",
      };
      self.postMessage(cancelMsg);
    } else {
      const failureMsg: WorkerFailureMessage = {
        protocolVersion: 1,
        requestId: msg.requestId,
        type: "failure",
        error: {
          name: err instanceof Error ? err.name : "CoverageWorkerError",
          code: "WORKER_FAILED",
          message: err instanceof Error ? err.message : String(err),
          details: null,
          recoverable: false,
        },
      };
      self.postMessage(failureMsg);
    }
  } finally {
    if (currentRequestId === msg.requestId) {
      currentRequestId = null;
    }
  }
};
