/**
 * Pure WorkerClient implementation with cooperative cancellation and hard-timeout fallback.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §16.3
 */

import type {
  WorkerClient,
  WorkerRunHandle,
  WorkerTaskMap,
  WorkerRequest,
  WorkerResponse,
  WorkerProgressMessage,
  WorkerCancelMessage,
} from "@/contracts/workers";
import type { WorkerTaskKind } from "@/contracts/enums";
import type { DesignStamp } from "@/contracts/engines";
import { NetScapeError } from "@/contracts/errors";

export type WorkerFactory = (kind: WorkerTaskKind) => Worker;

interface ActiveRequest<K extends WorkerTaskKind = WorkerTaskKind> {
  kind: K;
  requestId: string;
  resolve: (output: WorkerTaskMap[K]["output"]) => void;
  reject: (reason: unknown) => void;
  onProgress?: (message: WorkerProgressMessage) => void;
  cancelTimeoutId?: ReturnType<typeof setTimeout>;
}

export function defaultBrowserWorkerFactory(kind: WorkerTaskKind): Worker {
  if (kind === "coverage.compute") {
    return new Worker(new URL("./coverage.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  if (kind === "simulation.run") {
    return new Worker(new URL("./simulation.worker.ts", import.meta.url), {
      type: "module",
    });
  }
  throw new RangeError(`Unsupported worker kind: ${kind}`);
}

export class DefaultWorkerClient implements WorkerClient {
  private readonly factory: WorkerFactory;
  private readonly workers = new Map<WorkerTaskKind, Worker>();
  private readonly activeRequests = new Map<string, ActiveRequest>();

  constructor(factory: WorkerFactory = defaultBrowserWorkerFactory) {
    this.factory = factory;
  }

  private getOrCreateWorker(kind: WorkerTaskKind): Worker {
    let worker = this.workers.get(kind);
    if (!worker) {
      worker = this.factory(kind);
      this.attachWorkerHandlers(kind, worker);
      this.workers.set(kind, worker);
    }
    return worker;
  }

  private attachWorkerHandlers(kind: WorkerTaskKind, worker: Worker): void {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      if (!msg || msg.protocolVersion !== 1) {
        return;
      }

      const active = this.activeRequests.get(msg.requestId);
      if (!active) {
        return;
      }

      if (msg.type === "progress") {
        active.onProgress?.(msg);
        return;
      }

      // Terminal messages (success, cancelled, failure)
      if (active.cancelTimeoutId !== undefined) {
        clearTimeout(active.cancelTimeoutId);
      }
      this.activeRequests.delete(msg.requestId);

      if (msg.type === "success") {
        active.resolve(msg.result);
      } else if (msg.type === "cancelled") {
        active.reject(new NetScapeError("WORKER_CANCELLED", "Worker task was cancelled"));
      } else if (msg.type === "failure") {
        active.reject(
          new NetScapeError(msg.error.code, msg.error.message, {
            details: msg.error.details ?? undefined,
          })
        );
      }
    };

    worker.onerror = (err) => {
      // Worker crashed or threw an uncaught error
      this.workers.delete(kind);
      worker.terminate();

      // Reject all active requests on this kind
      for (const [reqId, active] of this.activeRequests.entries()) {
        if (active.kind === kind) {
          if (active.cancelTimeoutId !== undefined) {
            clearTimeout(active.cancelTimeoutId);
          }
          this.activeRequests.delete(reqId);
          active.reject(
            new NetScapeError(
              "WORKER_FAILED",
              `Worker crashed: ${err instanceof ErrorEvent ? err.message : "Unknown worker error"}`
            )
          );
        }
      }
    };
  }

  run<K extends WorkerTaskKind>(
    kind: K,
    payload: WorkerTaskMap[K]["input"],
    stamp: DesignStamp,
    onProgress?: (message: WorkerProgressMessage) => void
  ): WorkerRunHandle<K> {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const taskId = `task_${kind}_${stamp.designId}`;

    const worker = this.getOrCreateWorker(kind);

    let resolvePromise!: (output: WorkerTaskMap[K]["output"]) => void;
    let rejectPromise!: (reason: unknown) => void;

    const promise = new Promise<WorkerTaskMap[K]["output"]>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const activeReq: ActiveRequest<K> = {
      kind,
      requestId,
      resolve: resolvePromise,
      reject: rejectPromise,
      onProgress,
    };

    this.activeRequests.set(requestId, activeReq as unknown as ActiveRequest);

    const request: WorkerRequest<K> = {
      protocolVersion: 1,
      requestId,
      taskId,
      kind,
      payload,
      stamp,
    };

    worker.postMessage(request);

    return {
      requestId,
      result: promise,
    };
  }

  async cancel(requestId: string): Promise<void> {
    const active = this.activeRequests.get(requestId);
    if (!active) {
      return;
    }

    const worker = this.workers.get(active.kind);
    if (!worker) {
      return;
    }

    // 1. Cooperative cancellation message
    const cancelMsg: WorkerCancelMessage = {
      protocolVersion: 1,
      requestId,
      type: "cancel",
    };
    worker.postMessage(cancelMsg);

    // 2. Hard timeout fallback: 500 ms
    active.cancelTimeoutId = setTimeout(() => {
      if (this.activeRequests.has(requestId)) {
        this.activeRequests.delete(requestId);
        this.workers.delete(active.kind);
        worker.terminate();

        active.reject(
          new NetScapeError(
            "WORKER_CANCELLED",
            "Worker task did not respond to cancellation within 500ms; hard terminated."
          )
        );
      }
    }, 500);
  }

  dispose(): void {
    for (const [reqId, active] of this.activeRequests.entries()) {
      if (active.cancelTimeoutId !== undefined) {
        clearTimeout(active.cancelTimeoutId);
      }
      active.reject(new NetScapeError("WORKER_CANCELLED", "WorkerClient was disposed"));
      this.activeRequests.delete(reqId);
    }

    for (const worker of this.workers.values()) {
      worker.terminate();
    }
    this.workers.clear();
  }
}
