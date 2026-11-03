/**
 * Web Worker for Network Simulation & Failure Scenario Analysis.
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
import { simulate } from "@/engines/simulation/simulationEngine";

let currentRequestId: string | null = null;
let isCancelled = false;

self.onmessage = async (
  event: MessageEvent<WorkerRequest<"simulation.run"> | WorkerCancelMessage>
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

  if (!("kind" in msg) || msg.kind !== "simulation.run") {
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
    const output = await simulate(msg.payload, runContext);

    if (isCancelled) {
      const cancelMsg: WorkerCancelledMessage = {
        protocolVersion: 1,
        requestId: msg.requestId,
        type: "cancelled",
      };
      self.postMessage(cancelMsg);
      return;
    }

    const successMsg: WorkerSuccessMessage<"simulation.run"> = {
      protocolVersion: 1,
      requestId: msg.requestId,
      type: "success",
      result: output,
    };

    self.postMessage(successMsg);
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
          name: err instanceof Error ? err.name : "SimulationWorkerError",
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
