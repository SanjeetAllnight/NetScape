# NetScape — Agent Assignments and Work Ownership

**Document:** `AGENT_TASKS.md`  
**Project:** NetScape — Smart Map-Based Network Infrastructure Planning Platform  
**Applies to:** Antigravity multi-agent development  
**Maximum team size:** Five agents total (one Integration Lead + four specialist agents)  
**Status:** Approved five-agent ownership baseline; synchronized with contracts v1.2

---

## 0. Purpose and Rules

This document assigns clear ownership so up to five Antigravity agents can work in parallel without creating conflicting architectures, duplicate domain models or overlapping edits.

**Use exactly five roles at most.** Do not spawn additional agents for individual features. If an agent's work is too large, split its work into sequential work packages under the same role rather than creating a sixth agent.

### 0.1 Team shape

| Agent | Role | Primary responsibility |
|---|---|---|
| Agent 1 | **Integration Lead / Platform Engineer** | Owns repository foundation, app shell, application orchestration, stores, global services and final integration. |
| Agent 2 | **Core Domain & Persistence Engineer** | Owns shared contracts, pure domain logic, kernel primitives and Dexie/IndexedDB persistence. |
| Agent 3 | **Geographical Workspace & Designer Engineer** | Owns Leaflet map, map interaction, device designer, contextual inspector and React Flow topology UI. |
| Agent 4 | **Engineering Engines & Workers Engineer** | Owns IP, cost, coverage and simulation engines plus typed worker infrastructure. |
| Agent 5 | **Analysis Experience & Reporting Engineer** | Owns VLSM/cost/coverage/simulation UI, comparison UI and PDF reporting. |

Agent 1 is the coordinating/merging agent. The project owner (the user) remains the product decision-maker and approves scope/architecture changes. The five-agent limit includes Agent 1.

### 0.2 Authority order

1. Approved `SYSTEM_ARCHITECTURE.md` (architecture baseline v1.3).
2. Selected `UI_UX_SPECIFICATION.md`.
3. Frozen `DATA_MODEL_AND_CONTRACTS.md` v1.2.
4. Frozen `DEVELOPMENT_CONTRACTS.md` v1.2.
5. `DEVELOPMENT_ROADMAP.md`.
6. This task/ownership document.

No agent may override a higher-authority document by interpretation or convenience.

### 0.3 Before agents begin

Preflight P-01 through P-06 is complete and recorded in `DEVELOPMENT_ROADMAP.md`. Phase 0 now begins sequentially: Agent 1 scaffolds the repository/toolchain; after the scaffold gate passes, Agent 2 adds contracts/kernel/test seams. Agents 3–5 review only and do not start feature or engine implementation until Phase 1.

---

# 1. Agent 1 — Integration Lead / Platform Engineer

**Primary / Coordinator**

## Mission

Own the application platform and ensure every agent's work becomes one coherent, runnable product. This agent coordinates dependencies, controls shared integration points, maintains the repository and is the only agent who merges specialist work into the integration branch.

## Owns these paths

```text
package.json
package-lock.json
vite.config.ts
tsconfig*.json
index.html
eslint.config.*
.prettierrc*
.prettierignore
.gitignore
.github/workflows/*                 # if GitHub CI is used
src/main.tsx
src/app/**
src/application/**
src/stores/**
src/features/shell/**
src/features/projects/**
src/services/**
src/components/ui/**
src/hooks/**
src/lib/**
src/pwa/**                             # if separated from app config
```

Also owns the integration test harness and final end-to-end suite under:

```text
tests/integration/**
tests/e2e/**
```

The Core Domain Agent owns `src/storage/**`; do not overlap that folder.

## Responsibilities

### Platform and Phase 0

- Bootstrap the Vite/React/TypeScript repository on Node 24 LTS and npm.
- Install/configure only the approved runtime stack and architecture-approved test/tooling additions.
- Maintain `package-lock.json`; all dependency additions/updates go through this agent.
- Set up strict TypeScript, linting, formatting, route skeleton and import-boundary checks.
- Establish `createHashRouter` and the approved route tree.
- Establish global shadcn/ui/Tailwind conventions and the shared primitive layer.
- Add project-wide scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `deps:check`, `check`.
- Add a CI workflow when the repository is connected to GitHub; local checks remain mandatory.
- Implement app bootstrap, global shell, route error boundaries, loading states and update/offline banners.

### Application and stores

- Implement `designSession`, `projectService`, `catalogService`, `addressingService`, `mapWorkspaceService`, `analysisCoordinator`, `designEvents`, application data-change events and repository composition/injection.
- Own project duplication as an application workflow; coordinate the atomic repository deep-copy/ID-remapping implementation with Agent 2.
- Own cross-project analysis freshness orchestration: rehash every affected design after project settings/region/obstacle or catalogue changes without automatically running engines.
- Own Zustand store creation and write ownership: `editorStore`, `designStore`, `analysisStore`, `prefsStore`.
- Enforce commit-then-project: call domain validation/reducer, persist through repositories, then update the projection only after successful commit.
- Implement serialized design commit queues and revision-conflict handling.
- Implement analysis input hashing at the application boundary, cache lookup, worker/main-thread dispatch, cancellation, stale-result policy and store publication.
- Ensure cost and IP engines run synchronously through the coordinator; coverage and simulation use workers.
- Own top-level project flows: Projects screen, create/open/rename/delete, design list and baseline/duplicate commands through the approved services.
- Own catalogue/settings screens and service adapters for geocoding and tile configuration; feature agents consume `CatalogService` and `MapWorkspaceService` rather than importing adapters directly.
- Expose `AddressingService` to Agent 5 so VLSM UI never imports the IP engine or repository directly.
- Expose `ProjectService` read APIs and `AnalysisCoordinator.inspect` so feature UIs never query repositories or infer analysis freshness themselves.
- Reconcile project/catalogue changes across all affected designs by input hash only; do not automatically run calculations.
- Keep public external service calls out of features; features call approved application/service interfaces.

### Integration and delivery

- Maintain the master integration branch and phase status.
- Review agent handoffs, run full checks and resolve cross-module integration defects.
- Own integration/e2e tests and final demo readiness.
- Maintain decisions/ADR updates when approved; do not unilaterally change architecture.

**Project duplication:** Agent 1 owns `ProjectService.duplicateProject` and the Projects-screen flow. Agent 2 owns the atomic repository deep copy and reference remapping.

## Explicitly does not own

- `src/contracts/**`, `src/kernel/**`, `src/domain/**`, `src/storage/**` — Agent 2.
- `src/engines/**`, `src/workers/**` — Agent 4.
- `src/features/map/**`, `src/features/designer/**`, `src/features/topology/**` — Agent 3.
- `src/features/addressing/**`, `cost/**`, `coverage/**`, `simulation/**`, `comparison/**`, `reports/**` — Agent 5.

## Key dependencies

- Agent 2: frozen contracts, domain command API and repository interface.
- Agent 4: engine APIs and worker client/protocol.
- Agent 3: workspace events, selectors and interaction requirements.
- Agent 5: analysis coordinator/store contract and module-level service APIs.

## Acceptance criteria

- Fresh clone passes install, typecheck, lint, tests, dependency check and production build.
- Project/design state is loaded from Dexie and projected into Zustand only after commit.
- All application services and stores have typed APIs that feature agents can consume without importing infrastructure directly.
- Routing matches the approved architecture and selected UI specification.
- Full integration tests verify project creation, editing, analysis, comparison, report and offline workflows.

---

# 2. Agent 2 — Core Domain & Persistence Engineer

## Mission

Own the canonical data model and the pure domain/persistence foundation. This agent prevents every other agent from inventing a different representation of projects, designs, devices, links or analysis records.

## Owns these paths

```text
src/contracts/**
src/kernel/**
src/domain/**
src/storage/**
tests/fixtures/**
tests/vectors/**
tests/unit/domain/**
tests/unit/storage/**
```

The exact model and contracts are frozen in `DATA_MODEL_AND_CONTRACTS.md` v1.2. This agent maintains the canonical definitions; any semantic change follows the shared-contract change process and requires project-owner approval before implementation.

## Responsibilities

### Contract finalization (Preflight record — complete)

- Complete `DATA_MODEL_AND_CONTRACTS.md` with concrete TypeScript definitions and examples.
- Define branded/prefixed IDs, enums, timestamps, units, geometry types and shared error/validation contracts.
- Define Project, MapRegion/Region, Design, Device, DeviceCatalogItem, Link, Subnet, Obstacle, ProjectSettings, AnalysisRecord, AnalysisBlob metadata, simulation setup and comparison/report model contracts as required by architecture.
- Define the DesignCommand and DesignChangeSet API, repository interfaces, engine input/output shapes and worker task payload types with Agent 4/Agent 1 review.
- Define canonical test-vector format and publish vectors before engine implementations are treated as complete.

### Pure domain layer

- Implement command validation and `applyCommand` as pure logic.
- Implement required cascades for deleting devices/links and clearing dependent references.
- Implement project-local coordinate frame helpers and WGS84 ↔ local metric conversion via proj4.
- Implement resolved catalogue/device specifications and supported override semantics.
- Implement geographic validation helpers and design/project input builders.
- Implement topology selectors/layout helpers and comparison/structural-diff pure functions.
- Ensure logical layout is excluded from engineering-analysis input hashes.
- Keep `domain/` independent from engines and infrastructure.

### Persistence layer

- Implement Dexie database, first schema version, indexes and migrations.
- Implement repositories and transaction boundaries for all authored entities.
- Enforce relational integrity, cascade rules, revisions and exactly-one-baseline invariant inside transactions.
- Implement create-project transaction, design duplication and project duplication with complete ID/reference remapping. Project duplication is one transaction over project, region, obstacles, all designs, devices, links and subnets; retain app-wide catalogue references and omit analysis caches/blobs.
- Implement `DeviceRepository.listByCatalogItem()` so Agent 1 can identify all designs affected by catalogue edits.
- Implement built-in catalogue versioning/seeding and custom catalogue protection.
- Store coverage raster typed arrays in a separate analysis blob table.
- Implement bounded derived-cache retention without evicting authored user data.
- Handle quota, database blocked/versionchange and multi-tab conflict paths.
- Build the test repository fake/seam to match repository interface semantics.

## Explicitly does not own

- Zustand stores or application orchestration — Agent 1.
- React screens, Leaflet layers or React Flow components — Agents 3 and 5.
- Engineering formula implementation in `src/engines/**` — Agent 4.
- Worker runtime/client files — Agent 4.

## Key dependencies

- Agent 1: repository bootstrap, type/lint/test configuration and agreed interfaces for application composition.
- Agent 4: engine contract review; keep engine input types and kernel boundaries stable.
- Agent 3/5: UI contract questions must be resolved through the frozen model; do not add fields merely to satisfy an unreviewed screen assumption.

## Acceptance criteria

- Domain logic is pure and deterministic with no browser/React/Dexie imports.
- Every command and cascade has tests, including invalid and failed paths.
- Repository writes are transactional and preserve referential integrity.
- Design duplication remaps all dependent references and does not copy analysis cache.
- Failed commits do not cause the app projection to advance.
- Geographic and logical coordinates cannot be confused at type level.
- Normative domain/storage vectors pass.

---

# 3. Agent 3 — Geographical Workspace & Designer Engineer

## Mission

Build the core visual network-design workspace: the map, manual geometry tools, device designer, contextual inspector and logical topology. Both views must edit and display the same saved design records.

## Owns these paths

```text
src/features/map/**
src/features/designer/**
src/features/topology/**
tests/unit/features/map/**
tests/unit/features/designer/**
tests/unit/features/topology/**
```

Do not create new root-level entity types, persistence adapters, application services or duplicate state stores inside these feature folders.

## Responsibilities

### Map workspace

- Implement the canvas-first map workspace per `UI_UX_SPECIFICATION.md`.
- Integrate React-Leaflet and the approved map tile configuration supplied through a service/application boundary.
- Render project boundary, project-level obstacles, committed device markers, committed link lines and optional coverage overlay slot.
- Integrate Leaflet-Geoman Free for boundary and obstacle drawing only.
- On Geoman create/edit, convert temporary geometry to GeoJSON, remove the temporary layer and dispatch the approved command. Re-render only from committed projection.
- Implement map toolbar, explicit location search UI, zoom/fit controls, viewport preservation and basemap-unavailable state.
- Implement device placement mode, repeated placements, marker selection and one commit on drag end.
- Implement two-click link creation with medium selection, draft state, Escape cancellation and typed validation feedback.
- Never use Leaflet/Web Mercator display distance as an engineering measurement.

### Network designer and inspector

- Implement device palette for routers, switches, APs and servers.
- Implement approved Star/Tree template preview and invocation through the agreed command/service.
- Implement contextual inspector for device/link/obstacle properties using local draft state and approved commands.
- Implement validation issue focus and safe destructive confirmation.
- Reflect saved/failed commit state from Agent 1's application services/stores; never optimistically mark data as committed.
- Use the approved catalog and `resolveDevice` contract; do not duplicate resolved spec logic.

### Logical topology

- Implement React Flow nodes from `Device` records and edges from `Link` records.
- Use `device.id` as node ID and `link.id` as edge ID.
- Use only abstract `Design.logicalLayout` positions for React Flow.
- Persist layout once on `onNodeDragStop` via the approved command.
- Use the same link-creation command as the map.
- Preserve selection across map/topology route changes using shared UI state from Agent 1.
- Confirm layout-only changes do not stale analyses.

## Explicitly does not own

- Domain or data model definitions — Agent 2.
- Dexie access or persistence transactions — Agent 2 through repository/application boundaries.
- Zustand store definitions — Agent 1.
- Engine calculations or worker protocols — Agent 4.
- Coverage/cost/simulation analytical result screens — Agent 5 (Agent 3 supplies the map overlay integration surface only).

## Key dependencies

- Agent 1: `designSession` command API, `designStore` selectors/projection, `editorStore` selection/tool state, navigation and service interfaces.
- Agent 2: device/link/obstacle/geometry contracts, command types, validation issue types and topology helpers.
- Agent 5: agreed coverage overlay contract and shared UI requirements for the right dock.

## Acceptance criteria

- A device placed on the map appears in topology with the same ID and properties.
- A link created in either view appears in the other after route switch.
- Marker drag and topology drag commit once at gesture end.
- Failed commit leaves the last committed geometry/layout rendered.
- Temporary Geoman layers are removed after the event; saved geometry is the rendered authority.
- Map viewport and selection restore correctly on view changes.
- No unsupported devices, map imports, layer managers or topology templates appear.

---

# 4. Agent 4 — Engineering Engines & Workers Engineer

## Mission

Implement the mathematically correct, deterministic TypeScript algorithms and the two background workers that execute the heavier coverage and simulation tasks. This agent owns the computation layer, not the interface.

## Owns these paths

```text
src/engines/**
src/workers/**
tests/unit/engines/**
tests/unit/workers/**
```

Agent 2 owns `src/kernel/**` and the canonical vector files. If an engine needs a shared primitive, request it from Agent 2 rather than creating a competing utility.

## Responsibilities

### IP engine

- IPv4 parsing/validation, CIDR/network arithmetic, usable host calculations and deterministic VLSM allocation.
- Correct alignment, parent-range boundaries, overlap and insufficient-space handling.
- Explicit output units/count meanings and deterministic ordering.
- Test against canonical textbook vectors.

### Cost engine

- CAPEX, annual OPEX and TCO using only fields in the frozen contract.
- Device prices/specs, copper/fibre lengths and slack, supported termination/splice/civil/labour, taxes/contingency, electricity, maintenance/support and replacement reserve as defined by approved inputs.
- Preserve currency and sample-price provenance in result data.
- Return structured breakdowns and missing/invalid input outcomes; never invent vendor prices.

### Coverage engine

- FSPL reference and log-distance path-loss calculations.
- Metric grid evaluation and polygon masking through prepared metric inputs.
- Best-server RSSI per grid cell.
- Fixed wall/material loss for each obstacle polygon-boundary crossing.
- Configurable classes/thresholds, coverage percent and dead-zone information.
- Deterministic rounding/quantisation and worker progress checkpoints.
- Performance guardrails and spatial pruning against approved caps.

### Simulation engine

- Build the approved undirected graph and implement Dijkstra with deterministic tie-breaking.
- Baseline route/reachability and configured failed-node/failed-link scenarios.
- Compute supported path bottlenecks, equal-share delivered-rate estimates and utilisation.
- Compute only the frozen propagation, transmission and processing latency components. Queueing/M/M/1, packet loss and queue stability are not MVP features.
- Return structured path, reachability and before/after metrics.
- Do not implement packet-level simulation, Bellman-Ford, OSPF/RIP or failure prediction.

### Worker infrastructure

- Implement the common typed protocol and runtime for coverage and simulation workers.
- Implement task/request IDs, protocol version, progress, result, failure and cancellation messages.
- Implement cooperative cancellation with event-loop yielding and hard-terminate fallback.
- Use transferable coverage buffers and respect ownership after transfer.
- Keep worker entry points thin; actual algorithms remain pure engine functions.
- Test worker crashes, cancellation, malformed requests, stale stamps and transferables.

## Explicitly does not own

- UI, charts, map overlay panels or React components — Agents 3 and 5.
- Analysis coordinator, cache orchestration or Zustand stores — Agent 1.
- Canonical entities, domain input builders or storage records — Agent 2.

## Key dependencies

- Agent 2: frozen contracts, kernel primitives, metric engine inputs and normative vectors.
- Agent 1: worker client consumption/analysis coordinator integration.
- Agent 5: result presentation needs; outputs must not be changed to fit a chart without contract review.

## Acceptance criteria

- All engines are pure TypeScript and run in Vitest without a browser.
- Inputs/outputs use explicit units and typed result/error contracts.
- Canonical mathematical vectors pass with declared tolerances.
- Coverage and simulation execute in their dedicated workers.
- Progress is truthful, cancellation works, and partial outputs are never persisted as completed analyses.
- Engine complexity/performance limits are measured against approved fixtures.

---

# 5. Agent 5 — Analysis Experience & Reporting Engineer

## Mission

Build the user-facing analysis modules and report experience, consuming the approved engine and coordinator contracts. This agent presents the calculations; it does not reimplement them.

## Owns these paths

```text
src/features/addressing/**
src/features/cost/**
src/features/coverage/**
src/features/simulation/**
src/features/comparison/**
src/features/reports/**
tests/unit/features/addressing/**
tests/unit/features/cost/**
tests/unit/features/coverage/**
tests/unit/features/simulation/**
tests/unit/features/comparison/**
tests/unit/features/reports/**
```

Agent 3 owns the map canvas and the reusable map overlay rendering boundary. Agent 5 owns coverage controls/results and coordinates the overlay API with Agent 3; it does not create a second Leaflet map.

## Responsibilities

### Addressing/VLSM experience

- Build parent IPv4 CIDR setup, subnet requirements, VLSM allocation action and result table.
- Display only fields and allocation details provided by the approved engine/data contract.
- Support unallocated cases and clear reasons; show host capacity/wastage accurately.
- Keep endpoint hosts as numeric requirements, not individual device nodes.
- Do not introduce IPv6 or uncontracted VLAN/interface management.

### Cost experience

- Build the cost page with CAPEX, annual OPEX and TCO summaries, itemized breakdown and chart.
- Expose project-level assumptions only; no per-design overrides.
- Use the analysis coordinator to run cost through cache + synchronous pure engine.
- Clearly show INR default, sample price provenance, formula assumptions and estimate labels.
- Display missing price/spec and stale states honestly.

### Coverage experience

- Build the Coverage panel in the map workspace right dock; do not create a separate route.
- Expose only approved propagation inputs, resolution, thresholds, AP inclusion, overlay visibility/opacity and model disclaimer.
- Run/cancel through Agent 1's analysis coordinator and Agent 4's worker client.
- Present worker progress only when supplied.
- Present coverage percentage, signal classes, RSSI legend, dead-zone list and stale/current status.
- Coordinate with Agent 3 on raster overlay display; do not render cells as thousands of individual vectors.

### Simulation experience

- Build flow/failure setup and run controls based on approved simulation setup types.
- Present baseline and failure scenarios, path/hop lists, reachable/unreachable state, bottleneck/delivered-rate estimate, utilisation and supported latency components.
- Show simplified-model and traffic-demand assumptions.
- Distinguish a valid unreachable route from an engine/application error.
- Do not create packet animations or protocol configuration screens.

### Comparison experience

- Build a read-only two-design comparison view.
- Present structural counts/differences and latest available cost, coverage and simulation records.
- Show missing/stale records and targeted run actions.
- Do not auto-run all analyses silently or rank all outcomes with one generic good/bad metric rule.

### PDF reporting

- Build report preview and `ReportModel` consumer UI.
- Compose report sections and tables using jsPDF and approved table support.
- Coordinate schematic geographical and logical figure renderer with domain/map contracts.
- Do not screenshot the live Leaflet map or depend on basemap tiles.
- Never silently recompute a missing/stale analysis while generating a report.
- Support offline PDF generation and download.

## Explicitly does not own

- Algorithm implementation — Agent 4.
- Analysis cache, worker dispatch, input hashing or store ownership — Agent 1.
- Domain entities, command types or Dexie access — Agent 2.
- Primary Leaflet map, device placement or React Flow topology rendering — Agent 3.

## Key dependencies

- Agent 1: module routes/layout, `analysisCoordinator` public API, `analysisStore` selectors and project settings services.
- Agent 2: contracts for subnet, cost, analysis, comparison and report model.
- Agent 4: engine result types/semantics and tested outputs.
- Agent 3: right-dock contract and coverage raster overlay API.

## Acceptance criteria

- Each analysis screen consumes typed coordinator/engine output; no duplicate formulas are implemented in UI code.
- Every number includes the correct unit, currency or assumption context.
- Current/stale/running/cancelled/failed states are clear and accurate.
- Design comparison is read-only and handles missing/stale results.
- PDF generation is local, works without basemap tiles and includes estimate disclaimers.

---

# 6. Shared File Ownership Matrix

| Path / resource | Owner | Rules for other agents |
|---|---|---|
| `package.json`, `package-lock.json`, Vite/TS/lint config | Agent 1 | Request dependency/config changes; do not edit directly |
| `src/contracts/**` | Agent 2 | Consume only; contract change requires review and approval |
| `src/kernel/**` | Agent 2 | Request shared primitive; do not duplicate it in engines/domain |
| `src/domain/**` | Agent 2 | Consume public APIs; submit domain gaps through change request |
| `src/storage/**` | Agent 2 | No feature-level Dexie imports or direct table access |
| `src/application/**` | Agent 1 | Features call published service APIs only |
| `src/stores/**` | Agent 1 | Only the designated owner may add/change store state/actions |
| `src/services/**` | Agent 1 | Features do not call adapters directly |
| `src/app/**`, `src/features/shell/**`, `src/features/projects/**` | Agent 1 | Shared layout/route changes via Agent 1 |
| `src/components/ui/**` | Agent 1 | Request shared primitive changes; no private fork of common buttons/tables |
| `src/features/map/**`, `designer/**`, `topology/**` | Agent 3 | No domain/persistence reimplementation |
| `src/engines/**`, `src/workers/**` | Agent 4 | Use frozen input/output contracts |
| `src/features/addressing/**`, `cost/**`, `coverage/**`, `simulation/**`, `comparison/**`, `reports/**` | Agent 5 | No formula implementation or direct storage/worker imports |
| `tests/vectors/**`, `tests/fixtures/**` | Agent 2 | Engine agents may propose vector additions; Agent 2 owns canonical vector changes |
| `tests/unit/**` | Feature/core owner by path | Each owner writes its own unit tests |
| `tests/integration/**`, `tests/e2e/**` | Agent 1 | Specialists provide test cases and fix failures in their modules |
| `docs/**` | Project owner / Agent 1 as document steward | Agents may propose changes; only approved documentation updates are merged |
| `public/icons/**`, PWA config | Agent 1 | Shared branding/assets are centrally reviewed |

No two agents may edit the same owned file concurrently. If a cross-cutting change is needed, the file owner makes the change after agreeing the interface with the requester.

---

# 7. Agent Execution Schedule

| Stage | Agent 1 — Platform | Agent 2 — Core/Data | Agent 3 — Workspace UI | Agent 4 — Engines/Workers | Agent 5 — Analysis UI |
|---|---|---|---|---|---|
| Preflight | Coordinate and review all contracts | Draft/finalize data contracts and model | Review map/topology interaction requirements; report model gaps | Review and finalize engine/worker contracts and vectors | Review analysis/report requirements; report missing output needs |
| Phase 0 | Own scaffold, scripts, routing skeleton, CI/check | Contracts, kernel skeleton, fixtures, repository fake interface | No separate feature implementation; prepare map/topology component/task plan | Review worker/engine contracts; prepare test harness against frozen interfaces | Prepare analysis/report component plan using frozen result shapes |
| Phase 1 | Application/store/service skeleton and composition | Domain, validation, input builders, Dexie/repositories | UI shells/prototypes may begin with fixtures after contract freeze; no duplicate models | IP/cost/coverage/simulation engines and worker runtime | Screen skeletons and table layouts may begin with fixtures after contract freeze |
| Phase 2 | Project flow, design session, stores, route integration | Persistence/domain support and integration fixes | Map, designer, inspector, topology complete | Core engine/worker integration support | Addressing/cost UI foundations; align analysis panel contracts |
| Phase 3 | Analysis coordinator, cache/freshness integration | Domain input builders, comparison, storage fixes | Map coverage-overlay integration support | Complete engine/worker vectors, performance and worker fixes | Addressing, cost, coverage, simulation and comparison UI |
| Phase 4 | PWA, integration, regression, release | Storage migration/quota/recovery fixes | Workspace polish and map/topology regression fixes | Performance, worker cancellation/crash/recovery fixes | Reports/PDF, analysis polish, comparison/report regression |

### 7.1 Safe parallelism

- Maximum five agents including Agent 1.
- Agent 1 acts as integrator and does not duplicate another agent's module implementation.
- Agents 2 and 4 may work in parallel after the public type contracts and input/output contracts have been frozen.
- Agents 3 and 5 may scaffold presentational structure with fixtures after UI and data contracts are frozen; they must not invent persistent fields or local replacement stores.
- Agent 3 and Agent 5 coordinate the coverage overlay boundary before implementing the panel/overlay integration.
- Agent 1 integrates only after each specialist submits a complete handoff and its isolated checks pass.

---

# 8. Worktree, Branch and Merge Protocol

## 8.1 Repository strategy

Use one Git repository and one branch/worktree per active agent. Suggested names:

```text
main                         # protected / stable
integration                  # Agent 1's integration branch
agent-2-domain-persistence   # Agent 2 worktree
agent-3-workspace-ui         # Agent 3 worktree
agent-4-engines-workers      # Agent 4 worktree
agent-5-analysis-reporting   # Agent 5 worktree
```

If the Antigravity setup supports Git worktrees, use separate worktrees. Otherwise use separate branches and ensure only one agent edits a given worktree at a time. Never let multiple agents concurrently modify the same working directory.

## 8.2 Task handoff format

Every task assigned to an agent must state:

1. Task ID and objective.
2. Exact allowed file/folder ownership.
3. Contract/document references.
4. Dependencies and required upstream merge/commit.
5. Acceptance criteria and tests required.
6. Explicit exclusions.
7. Expected handoff: changed files, public APIs, tests/commands run, output, known gaps and decisions needed.

## 8.3 Specialist completion report

Before requesting merge, the agent reports:

```text
TASK:
SUMMARY:
FILES CHANGED:
PUBLIC API / CONTRACTS USED:
TESTS ADDED:
COMMANDS RUN:
RESULTS:
KNOWN LIMITATIONS:
DEPENDENCY CHANGES REQUESTED:
FOLLOW-UP / BLOCKERS:
```

## 8.4 Merge gates

Agent 1 merges a specialist branch only when:

- It changes only owned files or has an approved shared-file change.
- The agent's unit and contract tests pass.
- TypeScript strict checks pass.
- Import/dependency rules pass.
- No duplicate types or alternate persistence paths were added.
- A concise handoff report is supplied.
- The integration branch passes relevant tests after merge.

Do not merge multiple large agent branches at once. Merge in small batches and run checks between them.

## 8.5 Shared contract change protocol

After `DATA_MODEL_AND_CONTRACTS.md` is frozen:

1. Agent identifies the missing/incorrect contract and stops before implementing a local workaround.
2. Agent submits a change request to Agent 1 and Agent 2 with affected consumers and tests.
3. Agent 1 assesses architectural impact; Agent 2 edits the canonical contract and vectors after project-owner approval.
4. All affected agents update against the same contract revision.
5. Agent 1 merges the change and records the revision/decision before feature work resumes.

No agent may add a field, enum value, command or worker message solely for its own UI convenience.

---

# 9. Agent-Level Definition of Done

An agent's assignment is complete only when:

- All assigned work packages meet the roadmap phase gate.
- Their owned modules compile and pass unit/contract tests.
- No forbidden cross-layer imports, cycles or duplicated data model exist.
- Public functions and UI-facing contracts are documented sufficiently for consumers.
- Failure, loading, empty and stale states relevant to the module are handled.
- The module is integrated into the shared application and works with real repositories/services, not only local fixtures.
- Handoff report is complete and Agent 1 accepts the integration.

An agent does not mark its task complete merely because its isolated page or worker can run independently.

---

# 10. First Assignments After This Plan Is Approved

Do not launch all five agents to build features immediately. Start with this controlled sequence:

### Step 1 — Preflight is complete

The six canonical documents have been reconciled and frozen. Do not redraft them during Phase 0. If the repository copy differs from the supplied baseline, preserve the existing files, report the discrepancy and ask Agent 1/project owner before overwriting or merging.

Canonical versions: Architecture v1.3, Data Model v1.2, Development Contracts v1.2, Roadmap v1.2, selected UI/UX Specification and five-agent Agent Tasks baseline.

### Step 2 — Phase 0 foundation (sequential)

- Agent 1 initializes the repository, toolchain, route skeleton, lint/test/build scripts, dependency boundaries and minimal app shell.
- After Agent 1's scaffold gate passes, Agent 2 adds canonical contracts/exports, pure kernel skeleton, normative vector fixtures and the repository test seam.
- Agent 1 integrates and runs the full Phase 0 acceptance gate.
- Agents 3, 4 and 5 review the scaffold and validate their expected import/test surfaces, but do not begin feature/engine implementations in Phase 0.

### Step 3 — Phase 1 starts only after Phase 0 acceptance

Once the project owner accepts Phase 0, the existing Phase 1 parallel-core schedule begins. Maintain the five-agent maximum throughout.

---

# 11. Explicit Stop Conditions

Any agent must stop and request an integration decision when:

- A task requires changing a frozen shared type or engine/worker payload.
- Two authoritative documents appear to contradict each other.
- A requested feature is outside the MVP list.
- A dependency outside the locked stack is needed.
- A module would need to import against the architecture's layer rules.
- A save or analysis operation would require bypassing the repository/coordinator.
- A UI element implies a capability not actually implemented by the engine.
- A calculation cannot be verified against a known vector or documented assumption.

The correct response is to surface the issue, not silently build a workaround.

---

## 12. Final Assignment Principle

Five coordinated agents are enough for this MVP. Agent 1 integrates and controls shared interfaces; Agent 2 owns data/domain/persistence; Agent 3 owns the map and logical network workspace; Agent 4 owns the mathematical engines and workers; Agent 5 owns analysis screens, comparison and reports. Work is parallel only after contracts are frozen, and every feature is complete only after it is integrated, tested and accepted through the roadmap gate.
