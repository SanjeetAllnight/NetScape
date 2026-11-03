import { describe, it, expect, vi } from "vitest";
import { DefaultWorkerClient } from "@/workers/WorkerClient";
import type {
  WorkerRequest,
  WorkerResponse,
  WorkerProgressMessage,
  WorkerFailureMessage,
} from "@/contracts/workers";
import type { CoverageEngineInput, DesignStamp } from "@/contracts/engines";
import type { DesignId, ProjectId, InputHash } from "@/contracts/primitives";

class MockWorker implements Worker {
  onmessage: ((this: Worker, ev: MessageEvent) => unknown) | null = null;
  onerror: ((this: AbstractWorker, ev: ErrorEvent) => unknown) | null = null;
  onmessageerror: ((this: Worker, ev: MessageEvent) => unknown) | null = null;

  postedMessages: unknown[] = [];
  terminated = false;

  postMessage(message: unknown): void {
    this.postedMessages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return true;
  }

  // Test helper to simulate receiving a message from worker
  simulateMessage(msg: WorkerResponse): void {
    if (this.onmessage) {
      this.onmessage({ data: msg } as MessageEvent);
    }
  }

  simulateError(errorMsg: string): void {
    if (this.onerror) {
      this.onerror({ message: errorMsg } as ErrorEvent);
    }
  }
}

describe("WorkerClient Runtime (P1-06)", () => {
  const dummyStamp: DesignStamp = {
    projectId: "p1" as ProjectId,
    designId: "d1" as DesignId,
    projectRevision: 1,
    designRevision: 1,
    inputHash: "hash-dummy" as InputHash,
  };

  const dummyCoverageInput = {} as CoverageEngineInput;

  it("dispatches request, handles progress, and resolves on success", async () => {
    let mockWorkerInstance!: MockWorker;
    const client = new DefaultWorkerClient((_kind) => {
      mockWorkerInstance = new MockWorker();
      return mockWorkerInstance;
    });

    const progressReports: WorkerProgressMessage[] = [];
    const handle = client.run(
      "coverage.compute",
      dummyCoverageInput,
      dummyStamp,
      (p) => progressReports.push(p)
    );

    expect(mockWorkerInstance.postedMessages).toHaveLength(1);
    const sentReq = mockWorkerInstance.postedMessages[0] as WorkerRequest<"coverage.compute">;
    expect(sentReq.requestId).toBe(handle.requestId);
    expect(sentReq.kind).toBe("coverage.compute");

    // Simulate progress
    mockWorkerInstance.simulateMessage({
      protocolVersion: 1,
      requestId: handle.requestId,
      type: "progress",
      fraction: 0.5,
      phase: "Computing raster...",
    });

    expect(progressReports).toHaveLength(1);
    expect(progressReports[0]?.fraction).toBe(0.5);

    // Simulate success
    const mockOutput = { result: {} as never, rssiDbm: new Int8Array(1), servingIndex: new Uint8Array(1), servingAccessPointIds: [] };
    mockWorkerInstance.simulateMessage({
      protocolVersion: 1,
      requestId: handle.requestId,
      type: "success",
      result: mockOutput,
    });

    const result = await handle.result;
    expect(result).toBe(mockOutput);
  });

  it("handles cooperative cancellation", async () => {
    let mockWorkerInstance!: MockWorker;
    const client = new DefaultWorkerClient(() => {
      mockWorkerInstance = new MockWorker();
      return mockWorkerInstance;
    });

    const handle = client.run("coverage.compute", dummyCoverageInput, dummyStamp);

    // Cancel the request
    await client.cancel(handle.requestId);

    expect(mockWorkerInstance.postedMessages).toHaveLength(2);
    expect(mockWorkerInstance.postedMessages[1]).toEqual({
      protocolVersion: 1,
      requestId: handle.requestId,
      type: "cancel",
    });

    // Simulate cooperative cancellation response from worker
    mockWorkerInstance.simulateMessage({
      protocolVersion: 1,
      requestId: handle.requestId,
      type: "cancelled",
    });

    await expect(handle.result).rejects.toThrow(/cancelled/i);
  });

  it("hard terminates worker after 500ms timeout if cancellation is unacknowledged", async () => {
    vi.useFakeTimers();

    let mockWorkerInstance!: MockWorker;
    const client = new DefaultWorkerClient(() => {
      mockWorkerInstance = new MockWorker();
      return mockWorkerInstance;
    });

    const handle = client.run("coverage.compute", dummyCoverageInput, dummyStamp);

    await client.cancel(handle.requestId);

    // Fast-forward 500ms without worker responding
    vi.advanceTimersByTime(501);

    expect(mockWorkerInstance.terminated).toBe(true);
    await expect(handle.result).rejects.toThrow(/hard terminated/i);

    vi.useRealTimers();
  });

  it("handles worker crash with typed failure and cleans up state", async () => {
    let mockWorkerInstance!: MockWorker;
    const client = new DefaultWorkerClient(() => {
      mockWorkerInstance = new MockWorker();
      return mockWorkerInstance;
    });

    const handle = client.run("coverage.compute", dummyCoverageInput, dummyStamp);

    mockWorkerInstance.simulateError("Out of memory in worker");

    expect(mockWorkerInstance.terminated).toBe(true);
    await expect(handle.result).rejects.toThrow(/worker crashed/i);
  });

  it("rejects with NetScapeError on worker failure message", async () => {
    let mockWorkerInstance!: MockWorker;
    const client = new DefaultWorkerClient(() => {
      mockWorkerInstance = new MockWorker();
      return mockWorkerInstance;
    });

    const handle = client.run("coverage.compute", dummyCoverageInput, dummyStamp);

    const failMsg: WorkerFailureMessage = {
      protocolVersion: 1,
      requestId: handle.requestId,
      type: "failure",
      error: {
        name: "EngineInputError",
        code: "ENGINE_INPUT_INVALID",
        message: "Grid resolution exceeds maximum allowed cells",
        details: null,
        recoverable: false,
      },
    };

    mockWorkerInstance.simulateMessage(failMsg);

    await expect(handle.result).rejects.toThrow(/grid resolution exceeds/i);
  });
});
