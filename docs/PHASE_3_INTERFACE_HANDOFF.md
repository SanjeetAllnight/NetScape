# Phase 3 Interface Handoff — Consumer API Specifications

**NetScape — Smart Map-Based Network Infrastructure Planning Workstation**  
**Role:** Agent 1 — Integration Lead / Platform Engineer  
**Document:** `docs/PHASE_3_INTERFACE_HANDOFF.md`  
**Date:** 2026-11-11  
**Authority:** Aligned with `DATA_MODEL_AND_CONTRACTS.md` v1.2 and `SYSTEM_ARCHITECTURE.md` v1.3  

---

## 1. Domain & Persistence Interface Handoff (Agent 2)

### 1.1 Authored Subnet Requirements & VLSM Allocation Persistence
Subnets are first-class entities in the `subnets` table and members of `DesignAggregate.subnetsById`.
- **Command Flow:** All writes go through `DesignSession.dispatch(command)`:
  - `subnet/add`:
    ```ts
    {
      type: "subnet/add";
      name: string;
      hostsRequired: number; // 1..65534
      servedByDeviceId?: DeviceId | null;
      linkId?: LinkId | null;
    }
    ```
  - `subnet/update`:
    ```ts
    {
      type: "subnet/update";
      subnetId: SubnetId;
      patch: {
        name?: string;
        hostsRequired?: number; // automatically transitions allocationStatus to "outOfDate"
        servedByDeviceId?: DeviceId | null;
        linkId?: LinkId | null;
      };
    }
    ```
  - `subnet/delete`:
    ```ts
    {
      type: "subnet/delete";
      subnetId: SubnetId;
    }
    ```
  - `addressing/setParentCidr`:
    ```ts
    {
      type: "addressing/setParentCidr";
      parentCidr: IPv4Cidr | null; // automatically resets allocations to "notAllocated"
    }
    ```
  - `addressing/applyAllocation`:
    ```ts
    {
      type: "addressing/applyAllocation";
      parentCidr: IPv4Cidr;
      allocations: VlsmSubnetAllocation[];
    }
    ```
- **Read APIs:**
  - `useDesignStore.getState().aggregate.subnetsById`: reactive access to current subnets.
  - `useDesignStore.getState().aggregate.design.addressing`: current parent CIDR and allocation status.

### 1.2 Analysis Repository & Blob Storage Semantics
The `AnalysisRepository` interface in `src/contracts/storage.ts` provides:
```ts
export interface AnalysisRepository {
  findByHash(designId: DesignId, type: AnalysisType, inputHash: InputHash): Promise<AnalysisRecord | null>;
  getLatest(designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null>;
  getBlob(blobId: AnalysisBlobId): Promise<AnalysisBlob | null>;
  put(record: AnalysisRecord, blob?: AnalysisBlob): Promise<void>;
  deleteRecord(analysisId: AnalysisId): Promise<void>;
  clearDerivedCache(projectId?: ProjectId): Promise<{ deletedRecords: number; deletedBlobs: number }>;
  prune(maxPerDesignAndType: number): Promise<{ deletedRecords: number; deletedBlobs: number }>;
}
```
- **Separation invariant:** Typed-array rasters for coverage live exclusively in `analysisBlobs` (`AnalysisBlob.rssiDbm` and `AnalysisBlob.servingIndex`). `AnalysisRecord` stores only lightweight grid metadata and `blobId: AnalysisBlobId`. Authored project/design tables are never touched during cache eviction or pruning.

---

## 2. Engineering Engines & Workers Interface Handoff (Agent 4)

### 2.1 Pure Synchronous Engines
- **IPv4 / VLSM Engine (`src/engines/ip/ipEngine.ts`):**
  ```ts
  export function allocateVlsm(input: VlsmEngineInput): VlsmEngineOutput;
  ```
  Synchronous execution on the main thread via application input builder `buildVlsmEngineInput(designId)`.
- **Cost Engine (`src/engines/cost/costEngine.ts`):**
  ```ts
  export function estimateCost(input: CostEngineInput): CostEstimate;
  ```
  Synchronous execution through `AnalysisCoordinator.run("cost", designId)`.

### 2.2 Worker Tasks & WorkerClient Protocol
- **Coverage Worker (`coverage.compute`):**
  - Input: `CoverageEngineInput` (built via `buildCoverageEngineInput(aggregate)`).
  - Output: `CoverageWorkerOutput` (contains `result: Omit<CoverageResult, "grid"> & { grid: Omit<CoverageGrid, "blobId"> }`, `rssiDbm: Int8Array`, `servingIndex: Uint8Array`, `servingAccessPointIds: DeviceId[]`).
  - Sentinels:
    - `rssiDbm`: `-127` = no signal.
    - `servingIndex`: `0..N-1` = serving AP index, `254` = outside planning mask, `255` = inside mask with no serving AP.
- **Simulation Worker (`simulation.run`):**
  - Input: `SimulationEngineInput` (built via `buildSimulationEngineInput(aggregate)`).
  - Output: `SimulationWorkerOutput` (contains `baseline: SimulationScenarioResult`, `scenarios: SimulationScenarioResult[]`).
  - Measures: Reachability, bottleneck capacity, delivered rate, utilization, latency (propagation + transmission + processing; queueing is `null`).
- **WorkerClient Control:**
  - `run(kind, payload, stamp, onProgress)` returns `WorkerTaskHandle<K>` with `result: Promise<output>` and `cancel()`.
  - Cooperative cancellation via `worker.cancel` message; hard fallback terminates worker after 500 ms and re-spawns.

---

## 3. Application Orchestration Interface Handoff (Agent 1)

### 3.1 Concrete AnalysisCoordinator API
```ts
export interface AnalysisCoordinator {
  inspect(designId: DesignId): Promise<AnalysisInspection>;
  refreshProject(projectId: ProjectId): Promise<void>;
  refreshCatalogItem(catalogItemId: CatalogItemId): Promise<void>;
  run(type: "cost" | "coverage" | "simulation", designId: DesignId): Promise<AnalysisRunResult>;
  cancel(type: "coverage" | "simulation", designId: DesignId): Promise<void>;
  getLatest(designId: DesignId, type: AnalysisType): Promise<AnalysisRecord | null>;
  getCoverageBlob(record: Extract<AnalysisRecord, { type: "coverage" }>): Promise<AnalysisBlob | null>;
}
```

### 3.2 Zustand Analysis Store (`useAnalysisStore`)
```ts
export interface AnalysisStoreState {
  records: Record<AnalysisType, AnalysisRecord | null>;
  hashes: Record<AnalysisType, InputHash | null>;
  status: Record<AnalysisType, "idle" | "computing" | "stale" | "fresh" | "error">;
  progress: Record<AnalysisType, number>;
  errors: Record<AnalysisType, string | null>;
  coverageBlob: AnalysisBlob | null; // Cached coverage raster blob for active design

  setRecord: (type: AnalysisType, record: AnalysisRecord | null, hash: InputHash | null, blob?: AnalysisBlob | null) => void;
  setStatus: (type: AnalysisType, status: AnalysisStatus) => void;
  setProgress: (type: AnalysisType, progress: number) => void;
  setError: (type: AnalysisType, error: string | null) => void;
  markStale: (type: AnalysisType) => void;
  resetAnalyses: () => void;
}
```

---

## 4. Coverage Overlay Interface Handoff (Agents 3 & 5)

### 4.1 Data & Transform Responsibilities
- **Agent 5 (Analysis UI):** Provides the user controls (Run, Cancel, Opacity slider, Visibility toggle, Show Dead Zones checkbox, Legend). Updates ephemeral UI state in `useEditorStore` or local dock state.
- **Agent 3 (Map Canvas & Overlay):**
  - Owns the Leaflet image overlay layer inside `MapCanvas`.
  - Converts the `AnalysisBlob` (`rssiDbm` `Int8Array`, `width`, `height`) and `CoverageGrid` metadata into an off-screen HTML `<canvas>` element:
    - Sentinel `254` (outside mask): `rgba(0, 0, 0, 0)` (fully transparent).
    - Sentinel `255` (inside mask, no AP): `rgba(239, 68, 68, 0.4)` (dead zone red highlight when enabled, else transparent).
    - RSSI values classified by project thresholds:
      - Excellent ($\ge -55$ dBm): `#10b981` (emerald green).
      - Good ($\ge -67$ dBm): `#3b82f6` (blue).
      - Fair ($\ge -75$ dBm): `#f59e0b` (amber).
      - Weak ($\ge -85$ dBm): `#f97316` (orange).
      - Dead Zone ($< -85$ dBm or no signal): `#ef4444` (red).
  - Uses `L.imageOverlay(dataUrl, bounds, { opacity, interactive: false })` positioned at the geographic bounding box of the grid.
  - Automatically cleans up the overlay when design changes, when visibility is toggled off, or when component unmounts.

---

## 5. UI Presentation Contract (Agent 5)

- Agent 5 consumes only canonical engine inputs, outputs, and `AnalysisRecord` data.
- It must not fabricate metrics, invent view-local entity types, or bypass `AnalysisCoordinator`.
- If an input requirement changes, mark the displayed result as "Out of date" with explicit stale visual badges.
- Cost prices are labeled as "Sample price / illustrative" where provenance is synthetic catalogue defaults.
- All calculations work offline with locally saved IndexedDB inputs.

