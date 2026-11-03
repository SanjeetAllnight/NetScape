# NetScape — Phase 2 Gate 0 Audit & Reconciliation Report

**Document:** `docs/PHASE_2_GATE_0_AUDIT.md`  
**Phase:** 2 — Application, Map and Topology Vertical Slice  
**Authority:** Agent 1 (Integration Lead / Platform Engineer)  
**Date:** 2026-11-04  
**Status:** PASSED & RECONCILED  

---

## 1. Executive Summary

Prior to beginning Phase 2 user-facing and application-level implementation, Gate 0 mandates a formal reconciliation audit between the Phase 1 implementation state, the Phase 1 completion notes, and the frozen specification baseline (`docs/DATA_MODEL_AND_CONTRACTS.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/DEVELOPMENT_ROADMAP.md`).

All four discrepancies highlighted in the Phase 2 prompt were audited and reconciled:

1. **Dexie Object-Store Names (§9.2):** Fully verified. All eleven object stores match `DATA_MODEL_AND_CONTRACTS.md §9.2` verbatim.
2. **Design Limits (`DESIGN_LIMITS` §3.4):** Verified `DESIGN_LIMITS` (500 devices, 1000 links). Reconciled `src/domain/commands/applyCommand.ts` to enforce `LINK_LIMIT_EXCEEDED` on link creation alongside `DEVICE_LIMIT_EXCEEDED`.
3. **Geography & Planning Extent Semantics (§6.2):** Verified and reinforced 20,000 m planning extent boundary in `buildCoverageEngineInput` and `computeCoverage`. Placed devices beyond 20 km block coverage with `AREA_TOO_LARGE` without blocking inspection or non-coverage calculations.
4. **Catalog Seed Integrity (§3.5, §9.2):** Verified `seedBuiltinCatalog` seeds only the 4 synthetic vendor-neutral items with `priceProvenance: "sample"` without overwriting custom user items.

---

## 2. Item-by-Item Reconciliation Audit

### Item 1: Dexie Object-Store Names

- **Contract Specification (`DATA_MODEL_AND_CONTRACTS.md §9.2`):**
  Exactly eleven stores: `projects`, `designs`, `devices`, `links`, `subnets`, `obstacles`, `deviceCatalog`, `analysisCache`, `analysisBlobs`, `mapRegions`, `appMeta`.
- **Audit Findings:**
  - `src/storage/database.ts` declares exactly these eleven stores and indexes.
  - No occurrence of legacy or draft names (`projectObstacles`, `catalogItems`) exists in the schema or repository queries.
  - `src/storage/repositories/dexieRepositories.ts` operates strictly against `this.db.obstacles` and `this.db.deviceCatalog`.
- **Verdict:** **CONFORMS**. No schema changes or data migrations required.

### Item 2: Design Limits (`DESIGN_LIMITS`)

- **Contract Specification (`DATA_MODEL_AND_CONTRACTS.md §3.4`, `src/contracts/constants.ts`):**
  `maxDevices: 500`, `maxLinks: 1000`.
- **Audit Findings:**
  - `src/contracts/constants.ts` defines `DESIGN_LIMITS = { maxDevices: 500, maxLinks: 1000 }`.
  - While Phase 1 completion report text mentioned 1,000 / 2,000 in narrative prose, the constants file had 500 / 1000.
  - In `src/domain/commands/applyCommand.ts`, `device/add` enforced `DEVICE_LIMIT_EXCEEDED` at 500 devices.
  - However, `link/add` was missing an explicit count guard for `LINK_LIMIT_EXCEEDED` at 1000 links.
- **Resolution:**
  - Added `LINK_LIMIT_EXCEEDED` check to `case "link/add"` in `src/domain/commands/applyCommand.ts`.
  - Added unit test in `tests/unit/domain/applyCommand.test.ts` verifying both 500 device and 1000 link ceiling enforcement.
- **Verdict:** **RECONCILED & PASSING**.

### Item 3: Geography and Planning Extent Semantics

- **Contract Specification (`DATA_MODEL_AND_CONTRACTS.md §6.2`, `GEOGRAPHY_LIMITS`):**
  - Boundary bounding-box diagonal in local frame $\le 20,000$ m.
  - Placed devices must be within 20,000 m of immutable project-frame origin for coverage computations.
  - Projects outside the guard may still be viewed and edited; affected coverage is blocked with `AREA_TOO_LARGE`.
- **Audit Findings:**
  - `applyCommand.ts` already guarded boundary setting with `AREA_TOO_LARGE` via `checkPlanningExtent`.
  - `buildCoverageEngineInput` and `computeCoverage` needed explicit checks ensuring access point distance from origin $\le 20,000$ m and boundary diagonal $\le 20,000$ m, throwing `EngineInputError("AREA_TOO_LARGE: ...")`.
- **Resolution:**
  - Updated `src/domain/inputBuilders/index.ts` to validate boundary diagonal and AP distance $\le 20,000$ m against `GEOGRAPHY_LIMITS.maxPlanningExtentM`.
  - Updated `src/engines/coverage/coverageEngine.ts` to guard against boundary diagonal and AP coordinates exceeding 20 km.
  - Added unit tests in `tests/unit/domain/inputBuilders.test.ts` and `tests/unit/engines/coverage.test.ts` confirming coverage fails with `AREA_TOO_LARGE` while cost and inspection proceed unhindered.
- **Verdict:** **RECONCILED & PASSING**.

### Item 4: Catalog Seed Integrity

- **Contract Specification (`DATA_MODEL_AND_CONTRACTS.md §3.5`, `src/storage/seed.ts`):**
  - Exactly 4 synthetic vendor-neutral items: router, switch, access point, server.
  - Stable UUID IDs, `priceProvenance: "sample"`, `brand: null`, `model: null`, `origin: "builtIn"`.
  - Reseeding must preserve user-created items (`origin: "custom"`).
- **Audit Findings:**
  - `src/contracts/constants.ts` defines `BUILTIN_CATALOG_SEED` with the exact 4 items, vendor-neutral labels, and `priceProvenance: "sample"`.
  - `src/storage/seed.ts` iterates over `BUILTIN_CATALOG_SEED`, upserting `builtIn` items while leaving `custom` items intact.
  - Verified by `tests/unit/storage/dexieRepositories.test.ts` ("seeds built-in catalog items and preserves custom items during reseeding").
- **Verdict:** **CONFORMS & PASSING**.

---

## 3. Verification Evidence

- **Unit Test Suite:** 16 test files, 105 passed (100%), 0 failed.
- **Typecheck:** Clean (`tsc --noEmit`).
- **Lint:** Clean (`eslint .`).
- **Dependency Cruising:** Clean (`depcruise src --config .dependency-cruiser.cjs --output-type err`).
- **Build:** Clean (`tsc -b && vite build`).

## 4. Gate 0 Resolution Sign-off

Gate 0 is formally **PASSED**. Phase 2 execution may proceed to Stage B: Work Package P2-01 (Application Services & Stores).

