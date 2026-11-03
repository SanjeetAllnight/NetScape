# NetScape — Phase 1 Execution Plan

**Document:** `PHASE_1_EXECUTION_PLAN.md`  
**Phase:** 1 — Parallel Core Implementation  
**Execution Mode:** Controlled parallel implementation, one integration authority  
**Integration Authority:** Agent 1 (Integration Lead / Platform Engineer)  
**Date:** 2026-11-04  

---

## 1. Phase 0 Baseline Verification

- **Workspace Path:** `/home/sanjeet/Projects/NetScape`
- **Integration Branch:** `integration` (at accepted commit `f6f8cd8` / `743d0db`)
- **Runtime:** Node.js 24 LTS (`v24.22.2`), npm `11.19.1`
- **Working Tree State:** Clean, zero uncommitted changes
- **Baseline Verification:** `npm run check:full` passed cleanly (0 type errors, 0 lint errors, 44/44 unit tests passed, 0 dependency violations, production Vite + PWA build succeeded).
- **Canonical Document Baseline Confirmed:**
  1. `docs/SYSTEM_ARCHITECTURE.md` (v1.3 frozen)
  2. `docs/UI_UX_SPECIFICATION.md` (aligned to v1.3)
  3. `docs/DATA_MODEL_AND_CONTRACTS.md` (v1.2 frozen)
  4. `docs/DEVELOPMENT_CONTRACTS.md` (v1.2 frozen)
  5. `docs/DEVELOPMENT_ROADMAP.md` (v1.2 frozen)
  6. `docs/AGENT_TASKS.md` (5-agent baseline)

---

## 2. Gate A Interface-Readiness Review

A joint contract-readiness review was performed across the frozen contracts in `src/contracts/` against the roadmap and agent responsibilities:

1. **Public Domain Commands & Reducer APIs (`src/contracts/commands.ts`):**
   - Reducer contract: `applyCommand(aggregate: DesignAggregate, prepared: PreparedDesignCommand): ApplyCommandResult`.
   - Change set: `DesignChangeSet` with granular upsert/delete collections for devices, links, subnets, obstacles, and affected analysis types.
   - All 18 canonical command shapes and patches are completely declared.
   - Status: **Ready; 0 blockers.**

2. **Repository Interfaces & Dexie Schemas (`src/contracts/storage.ts`):**
   - 11 canonical tables matching v1 Dexie schema: `projects`, `designs`, `devices`, `links`, `subnets`, `obstacles`, `deviceCatalog`, `analysisCache`, `analysisBlobs`, `mapRegions`, `appMeta`.
   - Transactional semantics: atomic project creation (project + mapRegion + baseline design), design duplication with ID/reference remapping, optimistic revision checking (`REVISION_CONFLICT`), and bounded cache eviction.
   - Status: **Ready; 0 blockers.**

3. **Engines Input/Output Contracts (`src/contracts/engines.ts`):**
   - IP/VLSM: pure synchronous `allocateVlsm` and `parseCidr`.
   - Cost: pure synchronous `estimate` (CAPEX, OPEX, TCO, currency INR, missing price handling).
   - Coverage: pure metric-space `CoverageEngineInput` / `CoverageWorkerOutput` (boundary in metres, APs, obstacles, path loss, cell sentinels 254/255).
   - Simulation: pure metric-space `SimulationEngineInput` / `SimulationWorkerOutput` (undirected graph, Dijkstra, reachability, bottlenecks, equal-share rate, latency components without queueing).
   - Status: **Ready; 0 blockers.**

4. **Worker Protocol & Tasks (`src/contracts/workers.ts`):**
   - Protocol version: `1`.
   - Supported tasks: `coverage.compute` and `simulation.run`.
   - Envelopes: `WorkerRequest`, `WorkerProgressMessage`, `WorkerSuccessMessage`, `WorkerFailureMessage`, `WorkerCancelledMessage`, `WorkerCancelMessage`.
   - Status: **Ready; 0 blockers.**

5. **Canonical Vector Alignment (`tests/vectors/`):**
   - Normative test vectors for IP-01..06, COST-01, RF-01..06, SIM-01..06 are established and verified in Phase 0.
   - Status: **Ready; 0 blockers.**

6. **Consumer-Readiness Reviews (Agents 3 & 5):**
   - Agent 3 (Map & Designer) confirmed domain command signatures, local frame conversions, and logical layout contracts satisfy upcoming Phase 2 map/designer needs.
   - Agent 5 (Analysis & Reports) confirmed engine output structures, analysis records, and blob separations satisfy upcoming Phase 3 reporting and visualization requirements.

---

## 3. Work Packages, Ownership, and Branch Strategy

To ensure zero concurrent working-directory conflicts while preserving full agent ownership, execution proceeds in controlled sequential work packages with dedicated specialist branches:

| Package | Task Description | Owner | Branch | Target Paths |
|---|---|---|---|---|
| **P1-01** | Domain & Command Layer | Agent 2 | `agent-2-domain-persistence` | `src/domain/**`, `tests/unit/domain/**` |
| **P1-02** | Dexie Storage & Repositories | Agent 2 | `agent-2-domain-persistence` | `src/storage/**`, `tests/unit/storage/**` |
| **P1-03** | IP & Cost Engines | Agent 4 | `agent-4-engines-workers` | `src/engines/ip/**`, `src/engines/cost/**`, `tests/unit/engines/**` |
| **P1-04** | Coverage Engine | Agent 4 | `agent-4-engines-workers` | `src/engines/coverage/**` |
| **P1-05** | Simulation Engine | Agent 4 | `agent-4-engines-workers` | `src/engines/simulation/**` |
| **P1-06** | Worker Runtime & Client | Agent 4 | `agent-4-engines-workers` | `src/workers/**`, `tests/unit/workers/**` |
| **P1-Integration** | Application Composition Skeleton & Integration | Agent 1 | `integration` | `src/application/**`, `src/stores/**`, integration gates, final report |

---

## 4. Dependencies Requested & Installed

Agent 1 (Package Owner) has approved and installed the following locked-stack dependencies:
- `dexie` (`^4.0.11`): Local persistence engine.
- `proj4` (`^2.15.0`) & `@types/proj4` (`^2.5.5`): Local AEQD frame conversion.
- `@turf/boolean-point-in-polygon` (`^7.2.0`) & `@turf/helpers` (`^7.2.0`): Geometric boundary validation (note: `@turf/distance` and `@turf/length` remain strictly banned).

No unauthorized or deferred packages were introduced.

---

## 5. Review & Integration Checkpoints

- **Checkpoint 1 (Agent 2 handoff):**
  - Verify P1-01 (pure command reducer, cascades, local frame transforms, input builders, comparison) and P1-02 (real Dexie tables, transactions, seeding, pruning).
  - Run `npm test tests/unit/domain tests/unit/storage`.
  - Merge `agent-2-domain-persistence` into `integration`.
- **Checkpoint 2 (Agent 4 handoff):**
  - Verify P1-03 (IP & Cost vectors), P1-04 (RF-01..06 vectors), P1-05 (SIM-01..06 vectors), and P1-06 (WorkerClient, cancellation, buffer transfer).
  - Run `npm test tests/unit/engines tests/unit/workers`.
  - Run coverage benchmark fixture.
  - Merge `agent-4-engines-workers` into `integration`.
- **Checkpoint 3 (Agent 1 final exit gate):**
  - Implement application composition skeleton (`src/application/**`, `src/stores/**`).
  - Run full suite: `npm run check:full` (`typecheck`, `lint`, `test`, `deps:check`, `build`).
  - Publish `docs/PHASE_1_COMPLETION_REPORT.md`.

