# NetScape — Development Contracts

**Document:** `DEVELOPMENT_CONTRACTS.md`  
**Contract version:** 1.2 — frozen implementation baseline  
**Product:** NetScape — Smart Map-Based Network Infrastructure Planning Platform  
**Architecture baseline:** `SYSTEM_ARCHITECTURE.md`, MVP v1.3  
**Companion contract:** `DATA_MODEL_AND_CONTRACTS.md`, contract v1.2  
**Team limit:** Five Antigravity agents total, including the Integration Lead  
**Approval:** Project owner delegated final preflight reconciliation and Phase 0 preparation on 2026-11-04. Semantic changes after this baseline follow §4.

---

## 0. Purpose and binding authority

This document defines the implementation workflow, agent ownership, permitted module dependencies, shared-contract change process, coding conventions, testing rules, integration procedure and definition of done for the NetScape MVP. It exists to make five-agent development safe and predictable. It does not change the product, architecture, engineering models or approved delivery phases.

The companion documents have separate responsibilities:

| Document | Owns | Must not be used to override |
|---|---|---|
| `SYSTEM_ARCHITECTURE.md` | System behaviour, technical stack, architectural layering, storage and worker behaviour, MVP boundaries, fixed technical defaults and ADRs | Nothing lower in this table may silently replace it. |
| `UI_UX_SPECIFICATION.md` | Screen composition, navigation, interaction behaviour, labels, visual system and user-facing states | Architecture or the frozen data contracts. |
| `DATA_MODEL_AND_CONTRACTS.md` | Exact TypeScript entity shapes, enums, IDs, units, commands, change sets, Dexie schema, repositories, engine inputs/outputs, worker messages, errors and test vectors | Architecture behaviour or approved MVP boundaries. |
| `DEVELOPMENT_ROADMAP.md` | Phase sequence, dependencies, delivery milestones, acceptance gates and implementation schedule | Architecture and frozen contracts. |
| `AGENT_TASKS.md` | The five role definitions, primary ownership paths, responsibilities and agent-level acceptance criteria | The ownership model may not be casually redistributed. |
| `NetScape_Project_Plan_Updated.docx` | Original product vision, DCCN context, engineering concepts, feasibility and original MVP intent | Later architecture resolutions and scope exclusions. |
| This document | How agents collaborate, how code is owned/reviewed, and how work is tested and integrated | Any of the documents above. |

### 0.1 Conflict rule

When a conflict is discovered:

1. Stop the affected implementation before creating a local workaround.
2. Identify the exact source sections, types, commands, modules and downstream consumers affected.
3. Apply the source precedence above. Do not treat the newest file as automatically authoritative.
4. If the conflict is not resolvable from existing approved material, raise a decision request to the Integration Lead and project owner.
5. Update the authoritative source and every dependent companion document before implementation resumes.
6. Record the decision in the relevant document/ADR and increment the affected contract or engine version as required.

No agent may silently add a runtime dependency, entity field, command, worker task, persisted table, calculation assumption, route, feature or architectural layer.

### 0.2 Document lifecycle and status

Both companion contracts are **frozen implementation baselines** for Phase 0/1. The project owner delegated final preflight approval on 2026-11-04. Therefore:

- `DATA_MODEL_AND_CONTRACTS.md` becomes the canonical contract for exact data shapes and shared APIs.
- `DEVELOPMENT_CONTRACTS.md` becomes the canonical workflow and ownership contract.
- Agent 1 records the approved contract revision in the integration branch and communicates it to all agents.
- No Phase 1 parallel implementation starts while either contract has unresolved issues that block its interfaces.

The contract version printed at the top of each document is independent of `DATABASE_VERSION`, `WORKER_PROTOCOL_VERSION` and the per-engine version constants.

---

# 1. Team structure and responsibilities

Exactly five roles are available. Do not create a sixth agent. If an assignment is too large, split it into sequential work packages under the same role and preserve the existing owner.

| Agent | Role | Accountability | Primary owned areas |
|---|---|---|---|
| **Agent 1** | Integration Lead / Platform Engineer | Overall integration, platform, application orchestration, shared release coordination and phase acceptance | Root configuration, `app/`, `application/`, `stores/`, shell/project UI, services, shared UI primitives, integration/e2e tests |
| **Agent 2** | Core Domain & Persistence Engineer | Canonical data model, pure domain rules, kernel utilities and IndexedDB persistence | `contracts/`, `kernel/`, `domain/`, `storage/`, canonical fixtures/vectors |
| **Agent 3** | Geographical Workspace & Designer Engineer | Map interactions, device/link designer, inspector and logical topology view | `features/map/`, `features/designer/`, `features/topology/` |
| **Agent 4** | Engineering Engines & Workers Engineer | Mathematical engines and the two worker implementations | `engines/`, `workers/` |
| **Agent 5** | Analysis Experience & Reporting Engineer | Addressing/cost/coverage/simulation experiences, comparison and PDF report UI | `features/addressing/`, `cost/`, `coverage/`, `simulation/`, `comparison/`, `reports/` |

Agent 1 is the only agent permitted to merge specialist work into the shared integration branch. Agent 1 coordinates the shared contracts and is accountable for their release readiness; Agent 2 is the technical owner/editor of the canonical data model, pure domain contracts and repository interfaces. This division preserves the `AGENT_TASKS.md` ownership model while ensuring there is one final integration authority.

The project owner remains the product and architecture decision-maker. Agent 1 may recommend changes but cannot approve its own scope or architecture expansion.

## 1.1 Agent 1 — Integration Lead / Platform Engineer

**Mission:** maintain one reproducible, coherent application; coordinate dependencies; own application orchestration; review all specialist handoffs; integrate changes and certify phase gates.

**Owned paths:**

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
.github/workflows/**
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
src/pwa/**
public/icons/**
tests/integration/**
tests/e2e/**
```

**Responsibilities:**

- Bootstrap the single Vite + React + TypeScript repository using Node.js 24 LTS and npm. Phase 0 is sequential: Agent 1 owns P0-01/P0-02 and the scaffold gate; Agent 2 begins P0-03/P0-04 only after that gate passes.
- Own the package manifest and lockfile. Review, install and pin all dependencies; specialists request additions rather than editing package files.
- Configure strict TypeScript, linting, formatting, route handling, UI primitives, dependency boundaries and the required scripts.
- Implement the application shell, `createHashRouter`, route error boundaries, global loading/error states, offline banner and PWA update prompt.
- Own `designSession`, `projectService`, `catalogService`, `addressingService`, `mapWorkspaceService`, `analysisCoordinator`, `designEvents`, application data-change events and repository composition/injection.
- Implement project duplication workflow; Agent 2 implements atomic repository deep-copy and ID/reference remapping.
- Reconcile analysis freshness across all affected designs after project settings/region/obstacle or catalogue changes. Reconciliation rehashes; it never triggers an automatic analysis run.
- Create and own Zustand stores: `editorStore`, `designStore`, `analysisStore` and `prefsStore`.
- Enforce commit-then-project; serialize design commands; reject revision conflicts without updating the committed projection.
- Own the analysis lifecycle: domain input-builder invocation, canonical hashing, cache lookup, synchronous IP/Cost invocation, Coverage/Simulation worker dispatch, cancellation, stale-result checks and analysis-store publication.
- Own top-level project and design flows: list/open/create/duplicate/rename/delete projects; list/duplicate/rename/delete designs; set baseline; project settings; app preferences; device catalogue screen.
- Own geocoding and tile service adapters behind `MapWorkspaceService`; features call the application API and never call Nominatim/tile adapters directly.
- Expose `AddressingService` as the only feature-facing path to VLSM and `CatalogService` for catalogue CRUD.
- Expose `MapWorkspaceService` for explicit location search and tile-source configuration; features must not call geocoding/tile adapters.
- Expose `ProjectService` read APIs (`listProjects`, `getProject`, `listDesigns`, `openProject`) so features never query repositories directly.
- Expose `AnalysisCoordinator.inspect` for comparison/report freshness checks without triggering a calculation.
- Own integration tests, end-to-end tests, master branch status and phase sign-off evidence.
- Maintain approved ADRs and update documentation after owner approval.

**Project duplication resolution:** Architecture §7.1 and §7.3 explicitly include project duplication. Agent 1 implements the `ProjectService.duplicateProject` workflow and Projects-screen action. Agent 2 owns atomic repository deep-copy and ID/reference remapping. Roadmap and Agent Tasks already reflect this split; no ownership transfer is implied.

**Does not own:** `contracts/`, `kernel/`, `domain/`, `storage/` (Agent 2); `engines/`, `workers/` (Agent 4); map/designer/topology features (Agent 3); analysis/report features (Agent 5).

## 1.2 Agent 2 — Core Domain & Persistence Engineer

**Mission:** make one canonical and deterministic representation of authored engineering data and enforce its integrity from commands through IndexedDB.

**Owned paths:**

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

**Responsibilities:**

- Maintain the frozen `DATA_MODEL_AND_CONTRACTS.md` with Agent 1 and Agent 4 reviewing consumer interfaces. Any semantic change follows the shared-contract change process and requires project-owner approval before implementation.
- Define branded/prefixed IDs, enums, field types, units, defaults, GeoJSON types, engine input/output types, error/validation structures and worker payload types.
- Own canonical `contracts/` exports and kernel primitives shared by domain and engines.
- Implement `applyCommand` as a pure, deterministic reducer; validate commands, create change sets and execute same-command cascades.
- Implement WGS84 ↔ project-local AEQD conversion through the single approved `proj4` boundary; provide the pure domain helpers used by map, topology, analysis builders and reports.
- Resolve catalogue item specifications and sparse overrides through the one `resolveDevice` path.
- Build validated, resolved, metric analysis inputs. Domain must not import the engine implementation.
- Own design and project comparison structural-diff logic as pure domain functions where specified by the architecture/contracts.
- Implement Dexie schema/versioning, table indexes, repositories, transaction boundaries, revision checks, create/duplicate/delete operations, exactly-one-baseline invariant and referential integrity.
- Implement full project duplication as one transaction, remapping project/region/design/device/link/subnet/obstacle IDs and all internal references; preserve exactly one baseline, reuse app-wide catalogue references, and omit analysis records/blobs.
- Implement `DeviceRepository.listByCatalogItem()` for catalogue-change freshness reconciliation.
- Implement built-in catalogue seeding/versioning and custom catalogue protections.
- Store coverage raster typed arrays in `analysisBlobs`; keep ordinary analysis records small.
- Implement bounded derived-cache retention without deleting authored data.
- Handle storage unavailable/blocked, quota exceeded, `versionchange` and multi-tab revision conflicts.
- Maintain canonical test fixtures and vectors; approve any vector change after mathematical/contract review.
- Provide a test repository seam/fake matching the observable repository semantics; it must not become a second production persistence path.

**Does not own:** stores/application orchestration (Agent 1), React UI (Agents 3/5), formulas in `engines/` or worker runtime/client (Agent 4).

## 1.3 Agent 3 — Geographical Workspace & Designer Engineer

**Mission:** deliver the map-first network editing experience and the React Flow projection over the same committed Device/Link records.

**Owned paths:**

```text
src/features/map/**
src/features/designer/**
src/features/topology/**
tests/unit/features/map/**
tests/unit/features/designer/**
tests/unit/features/topology/**
```

**Responsibilities:**

- Implement the map workspace from `UI_UX_SPECIFICATION.md`: toolbar, basemap, viewport controls, boundary/obstacle tools, device palette, link creation and contextual inspector. Use `MapWorkspaceService` for location search and tile configuration; do not import service adapters.
- Integrate React-Leaflet using the tile configuration supplied through Agent 1's service/application boundary.
- Use Leaflet-Geoman Free for boundary/obstacle create/edit gestures only. On Geoman events, extract GeoJSON, remove the temporary imperative layer, dispatch the approved command and render again from committed projection.
- Render committed project boundary, project-level obstacles, device markers, link LineStrings and the agreed coverage overlay surface.
- Implement explicit location search submission; no autocomplete or direct Nominatim calls.
- Implement device placement/repeated placement and commit a marker move only on drag end.
- Implement two-click connection creation; keep draft state in `editorStore`, allow Escape to cancel, and submit the same `link/add` command that topology uses.
- Implement Device/Link/Obstacle inspectors with local form draft state and approved commands. Do not write to stores as a shortcut for persistence.
- Implement Star and Tree templates through the frozen template command contract and show the explicit template preview before applying.
- Implement React Flow nodes/edges derived from `Device` and `Link`; node ID is `device.id`, edge ID is `link.id`.
- Save logical canvas positions only as `LogicalPoint`; commit a layout change once at drag stop. Do not treat React Flow state as network data.
- Preserve shared selection and map viewport across the map/topology route change.
- Coordinate with Agent 5 on the coverage raster overlay component boundary; Agent 3 owns Leaflet/map rendering, Agent 5 owns the coverage settings and analysis result UI.

**Does not own:** entity definitions, domain commands, persistence, project services/stores, engine calculations, worker protocols or analytical result screens.

## 1.4 Agent 4 — Engineering Engines & Workers Engineer

**Mission:** implement pure TypeScript algorithms against the frozen mathematical contracts and own the two dedicated workers.

**Owned paths:**

```text
src/engines/**
src/workers/**
tests/unit/engines/**
tests/unit/workers/**
```

**Responsibilities:**

- Implement IPv4/CIDR parsing and deterministic VLSM allocation against the normative vectors.
- Implement CAPEX, annual OPEX and TCO as a synchronous pure TypeScript function using only `CostEngineInput` and the approved null/zero completeness rules.
- Implement FSPL reference, log-distance path loss (including the `d < d0` clamp), received power with the fixed 0 dBi reference-client gain, fixed obstacle crossing loss, best-server selection, distinct outside-mask (`254`) and no-serving-AP (`255`) raster sentinels, RSSI quantization/classes, coverage percentage and dead-zone grouping.
- Implement the approved simplified undirected graph and Dijkstra routing, deterministic tie-breaking, prevalidated configured traffic flows, failure scenarios, link-only bottleneck capacity, equal-share delivery estimate, reachability and supported latency components. Do not enforce device catalogue capacities as node bottlenecks.
- Implement scenario-to-baseline metric and flow deltas required by the UI/report.
- Implement the common typed worker protocol/runtime and the Coverage and Simulation worker entries only.
- Implement request IDs, task IDs, protocol version, progress, success/failure/cancelled messages and serializable error DTOs.
- Implement cooperative cancellation and the specified hard-terminate fallback through `WorkerClient`.
- Transfer coverage typed-array buffers once; the worker must not access arrays after transfer.
- Benchmark the agreed coverage performance fixture on the target laptop; report measured results, not assumed compliance.
- Keep all calculations free of React, DOM, Dexie, Zustand, storage, geocoding, clock reads and uncontrolled randomness.

**Does not own:** domain input construction, kernel primitives, canonical vectors, analysis cache/hashing/coordinator, result UI, map overlays or PDF generation.

## 1.5 Agent 5 — Analysis Experience & Reporting Engineer

**Mission:** present the approved engine outputs and saved analysis records as useful, honest engineering workflows; do not implement the math again.

**Owned paths:**

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

**Responsibilities:**

- Build the IPv4 parent CIDR, subnet requirement, VLSM action/result table, wastage summary and unallocated states through `AddressingService`; do not import `IpEngine`, domain input builders or repository interfaces directly.
- Build the cost page with CAPEX, annual OPEX, TCO, category breakdown, cost assumptions, sample-price provenance and incomplete input explanations.
- Build coverage controls/results inside the map workspace right dock; do not add a new coverage route. Use the shared CoverageSettings and `AnalysisCoordinator` API.
- Present progress/cancellation only when supplied by the worker; show coverage percentage, RSSI classes/legend, dead-zone list, estimate disclaimer and stale state. Treat raster serving index `254` as transparent outside-mask and `255` as an in-boundary cell with no serving AP.
- Coordinate with Agent 3 on the raster overlay interface; do not create a second map or thousands of vector cell shapes.
- Build simulation flow/failure configuration from the typed setup model and present baseline/scenario reachability, paths, hop counts, throughput completeness, bottleneck, delivered rate, supported latency components and scenario deltas.
- Build comparison as a read-only comparison of two designs using structural groups and latest analysis records. Show per-analysis missing/current/out-of-date state and targeted run actions; never calculate a universal winner across unlike metrics.
- Build report preview and the PDF consumer using the approved `ReportModel`, jsPDF and schematic figures. Do not capture live Leaflet or depend on basemap tiles.
- Never silently recalculate a missing/stale analysis while generating the report.
- Make report generation and all user-facing analysis available offline when their saved local data and app shell are present.

**Does not own:** formulas, domain entity types, repository access, worker calls, analysis hashing or Zustand store definitions.

---

# 2. Repository structure and file ownership

Use one repository and one Vite application. Do not create a monorepo, a backend app, a Python service or a second frontend. The target structure is the approved architecture layout; files may be added inside owned modules when required but agents must not invent competing root structures.

```text
netscape/
├── docs/
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── UI_UX_SPECIFICATION.md
│   ├── DATA_MODEL_AND_CONTRACTS.md
│   ├── DEVELOPMENT_CONTRACTS.md
│   ├── DEVELOPMENT_ROADMAP.md
│   └── AGENT_TASKS.md
├── public/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── router/
│   │   ├── layout/
│   │   └── providers/
│   ├── features/
│   │   ├── shell/
│   │   ├── projects/
│   │   ├── map/
│   │   ├── designer/
│   │   ├── topology/
│   │   ├── addressing/
│   │   ├── cost/
│   │   ├── coverage/
│   │   ├── simulation/
│   │   ├── comparison/
│   │   └── reports/
│   ├── application/
│   │   ├── designSession/
│   │   ├── analysisCoordinator/
│   │   ├── projectService/
│   │   ├── events/
│   │   └── hashService.ts
│   ├── stores/
│   ├── domain/
│   │   ├── commands/
│   │   ├── validation/
│   │   ├── inputBuilders/
│   │   ├── geo/
│   │   ├── topology/
│   │   ├── catalog/
│   │   └── comparison/
│   ├── engines/
│   │   ├── ip/
│   │   ├── cost/
│   │   ├── coverage/
│   │   └── simulation/
│   ├── kernel/
│   ├── contracts/
│   ├── workers/
│   ├── storage/
│   ├── services/
│   │   ├── geocoding/
│   │   └── maps/
│   ├── components/
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   └── main.tsx
├── tests/
│   ├── fixtures/
│   ├── vectors/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

### 2.1 Ownership matrix

| Path/resource | Primary owner | Permitted contributors | Protected rule |
|---|---|---|---|
| `package.json`, `package-lock.json` | Agent 1 | None edit directly; all may request changes | Only Agent 1 runs dependency changes and updates the lockfile. |
| `vite.config.ts`, `tsconfig*.json`, ESLint/Prettier config, `index.html`, `.gitignore`, CI | Agent 1 | Other agents propose changes | One toolchain configuration; no local feature-level config forks. |
| `src/contracts/**` | Agent 2 | Agent 1/4 review; Agents 3/5 consume | Canonical types only; no local duplicate models. |
| `src/kernel/**` | Agent 2 | Agent 4 may request shared primitives | Pure, reusable low-level numeric/serialization helpers. |
| `src/domain/**` | Agent 2 | Agent 1/3/4/5 consume; Agent 4 reviews input contracts | Pure commands, validators, input builders, topology and comparison helpers. |
| `src/storage/**` | Agent 2 | Agent 1 consumes repository interfaces | Dexie and repositories only; no UI/application service logic. |
| `src/engines/**`, `src/workers/**` | Agent 4 | Agent 2 reviews contract/vector changes; Agent 1 consumes WorkerClient | Algorithms and worker infrastructure only. |
| `src/application/**` | Agent 1 | Other agents consume public APIs | Side-effect orchestration; includes `AddressingService`, `CatalogService`, `MapWorkspaceService` and cross-design analysis freshness reconciliation. |
| `src/stores/**` | Agent 1 | Feature agents request selector/action changes | Only the store owner changes store shape/actions. |
| `src/services/**` | Agent 1 | Other agents consume typed adapters | Geocoding and tile provider boundaries; no direct feature fetch. |
| `src/app/**`, `src/features/shell/**`, `src/features/projects/**` | Agent 1 | Other agents request route/layout integration | Shell and project workflow are centrally controlled. |
| `src/features/map/**`, `designer/**`, `topology/**` | Agent 3 | Agent 5 coordinates the coverage layer API | Agent 3 owns the geographical canvas and topology surface. |
| `src/features/addressing/**`, `cost/**`, `coverage/**`, `simulation/**`, `comparison/**`, `reports/**` | Agent 5 | Agent 3 coordinates map overlay interface | Analytical screens/panels; no engine or storage logic. |
| `src/components/ui/**`, `src/hooks/**`, `src/lib/**`, `src/pwa/**`, `public/icons/**` | Agent 1 | Specialists request common additions | Shared primitives/assets/configuration are not forked inside features. |
| `tests/fixtures/**`, `tests/vectors/**` | Agent 2 | Agent 4 proposes mathematical vector changes; all consumers review | Agent 2 owns canonical shared test data. |
| `tests/unit/domain/**`, `tests/unit/storage/**` | Agent 2 | Agent 1 may add integration-level coverage | Core/domain/storage tests follow their owned module. |
| `tests/unit/engines/**`, `tests/unit/workers/**` | Agent 4 | Agent 2 supplies fixtures/vectors | Engine and worker tests are authored with the implementation. |
| `tests/unit/features/map/**`, `designer/**`, `topology/**` | Agent 3 | Agent 1 may add cross-module tests | UI unit tests stay beside the owning feature. |
| `tests/unit/features/addressing/**`, `cost/**`, `coverage/**`, `simulation/**`, `comparison/**`, `reports/**` | Agent 5 | Agent 1 may add integration coverage | Analysis/report feature tests stay with the owning feature. |
| `tests/integration/**`, `tests/e2e/**` | Agent 1 | All specialists provide scenarios and fix their modules | Agent 1 owns end-to-end harness and acceptance run. |
| `docs/**` | Project owner; Agent 1 is document steward | Agent 2 authors data contract; all agents propose reviewed edits | Only approved changes are merged; source authority is preserved. |

No two agents may edit the same owned file concurrently. When a shared interface is required, the requester submits the need to the file owner; the owner makes the change after review and approval. A task spanning multiple owned areas must be split into coordinated work packages, not solved by overlapping folder ownership.

### 2.2 Shared/protected files

The following resources are protected once Preflight begins:

- `DATA_MODEL_AND_CONTRACTS.md` and `src/contracts/**`.
- `src/kernel/**` canonical primitives and `tests/vectors/**` canonical expected values.
- Worker envelopes/task maps in `src/contracts/**` and worker protocol implementation in `src/workers/**`.
- Repository interfaces in the data contract and implementations under `src/storage/**`.
- Zustand store shapes/actions under `src/stores/**`.
- Application service signatures in the data contract and implementations under `src/application/**`.
- Global route tree and application shell under `src/app/**`.
- Package manifest and lockfile.

A consumer may request a change but may not create a local shadow interface or cast around the missing field.

---

# 3. Dependency and import restrictions

Dependencies point toward the pure contracts/core. UI components do not reach into infrastructure. The architecture's rule that `domain/` and `engines/` are siblings is absolute.

## 3.1 Dependency matrix

Legend: **Yes** = permitted import; **No** = forbidden; **Limited** = only the stated public/pure surface.

| Importing layer ↓ / Imported layer → | contracts | kernel | domain | engines | storage | workers | stores | application | services | features | app / UI primitives |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `contracts/` | — | No | No | No | No | No | No | No | No | No | No |
| `kernel/` | Yes | — | No | No | No | No | No | No | No | No | No |
| `domain/` | Yes | Yes | — | **No** | No | No | No | No | No | No | No |
| `engines/` | Yes | Yes | **No** | — | No | No | No | No | No | No | No |
| `storage/` | Yes | **No** | No | No | — | No | No | No | No | No | No |
| `workers/` | Yes | Yes | No | Yes | No | — | No | No | No | No | No |
| `stores/` | Yes | Limited | Limited to pure selectors/helpers only | No | No | No | — | No | No | No | No |
| `services/` | Yes | No | No | No | No | No | No | No | — | No | No |
| `application/` | Yes | Limited | Yes | Yes | Yes via repositories | Yes via WorkerClient | Yes (own stores) | — | Yes | No | No |
| `features/` | Yes | No | Limited to pure selectors/helpers/converters | **No** | **No** | **No** | Yes | Yes | **No direct adapter imports** | Limited to shared UI primitives/hooks |
| `app/` | Yes | No | No | No | No | No | Yes | Limited to app bootstrap/orchestration | No | Yes | Yes |
| `components/ui/`, `hooks/` | No product model imports by default | No | No | No | No | No | No | No | No | No | React/shadcn/Lucide and generic UI utilities only |

The `storage/` row is strict: repository code imports only `contracts/` and Dexie. It does not import `domain/`, `kernel/`, `engines/` or `application/`; persist plain contract-shaped records and use the existing repository boundary.

`application/` is the composition/orchestration layer. It is the only normal application layer allowed to connect domain commands, engines, repositories, workers, services and the stores' designated write APIs.

## 3.2 Concrete permitted imports

```ts
// Allowed: a feature uses an approved application service and reads a store projection.
import { useDesignStore } from "@/stores/designStore";
import { useDesignSession } from "@/application/designSession";
import type { Device } from "@/contracts/domain";

// Allowed: a domain input builder uses shared contracts and metric/geospatial helpers.
import type { CoverageEngineInput } from "@/contracts/engines";
import { geoPolygonToLocal } from "@/domain/geo/localFrame";

// Allowed: an engine uses contracts and a pure kernel primitive.
import type { CoverageEngineInput, CoverageResult } from "@/contracts/engines";
import { segmentPolygonCrossings } from "@/kernel/geometry";

// Allowed: application orchestration connects repositories and WorkerClient.
import { getRepositories } from "@/application/repositories";
import { WorkerClient } from "@/workers/client";
```

The examples illustrate dependency direction only. Actual export paths must match the frozen repository module exports; agents must not invent alternate export barrels to make an example compile.

## 3.3 Forbidden imports and patterns

```ts
// Forbidden in React feature files:
import Dexie from "dexie";
import { db } from "@/storage/database";
import { coverageEngine } from "@/engines/coverage";
import { WorkerClient } from "@/workers/client";
import { NominatimGeocodingService } from "@/services/geocoding";

// Forbidden in engine/domain/kernel modules:
import React from "react";
import { useStore } from "zustand";
import { db } from "@/storage/database";
import { useDesignStore } from "@/stores/designStore";

// Forbidden in worker entries/handlers:
import React from "react";
import { db } from "@/storage/database";
import { useDesignStore } from "@/stores/designStore";
import { useMap } from "react-leaflet";
```

Also prohibited:

- Circular imports or feature-to-feature imports that create an implicit API. Shared UI belongs in `components/ui/`; pure shared behaviour belongs in the appropriate lower-level owner module.
- Direct engineering calculations in React components/selectors. Components format and present result values; engines calculate them.
- A duplicate `Device`, `Link`, `Subnet`, `ProjectSettings`, `AnalysisRecord` or worker payload definition inside a feature folder.
- Direct Dexie reads/writes from features, hooks, stores or app components.
- Direct `fetch` calls in UI features. Use the approved service/application boundary.
- React Flow nodes/edges or Leaflet layers becoming saved-data authorities.
- A second Zustand store, local persistence mechanism or feature-specific storage cache for authored project data.
- `Zustand persist` for the design projection. Store state remains disposable and rehydrated from Dexie.
- Raw `longitude/latitude` entering an engine or a Leaflet/Web Mercator measurement being used for cost/coverage/simulation/report calculations.
- Importing `domain/` into `engines/` or `engines/` into `domain/`.
- `Date.now()`, `Math.random()` or `crypto.randomUUID()` inside pure domain reducers, kernel functions or engines.
- Web Worker code importing React, DOM, Dexie, Zustand, service adapters or UI modules.
- Runtime dependency injection frameworks, extra UI kits, validation packages, graph packages or date/ID libraries without the explicit change-control process.

## 3.4 Enforcement

Agent 1 configures the lint/dependency-boundary checks in Phase 0. At minimum, the repository must detect:

- Cycles across module boundaries.
- `features/**` importing `storage/**`, `workers/**`, `services/**` or `engines/**`.
- `engines/**` importing anything other than `contracts/**` and `kernel/**` plus allowed standard TypeScript APIs.
- `domain/**` importing `engines/**`, React, Zustand, Dexie, workers or service adapters.
- `workers/**` importing React, DOM, Dexie, Zustand, storage or services.

A type-only import does not make a forbidden dependency acceptable. The boundary is architectural, not merely a runtime bundle-size concern.

---

# 4. Shared-contract ownership and change control

## 4.1 Ownership

| Contract/resource | Technical editor | Reviewer(s) | Final approval / release authority |
|---|---|---|---|
| `DATA_MODEL_AND_CONTRACTS.md`, `src/contracts/**` | Agent 2 | Agent 1, Agent 4; Agent 3/5 for consumer needs | Project owner approves; Agent 1 merges/releases |
| `src/kernel/**`, canonical vectors | Agent 2 | Agent 4 for numerical consumers; Agent 1 for integration | Agent 2 maintains after project-owner approval of semantic changes |
| `src/workers/**` protocol implementation | Agent 4 | Agent 1 and Agent 2 | Agent 1 integration acceptance after protocol contract is frozen |
| `src/application/**`, `src/stores/**` signatures | Agent 1 | relevant specialist consumer(s) | Project owner for cross-cutting semantics; Agent 1 merges |
| `DEVELOPMENT_CONTRACTS.md` | Agent 1 with Agent 2 review | All agent owners | Project owner approves; Agent 1 maintains as steward |
| Architecture/UI/roadmap/agent assignment docs | Project owner / Agent 1 steward | Affected specialist owners | Project owner approves; Agent 1 merges |

Agent 1 remains accountable for making the shared contracts available to the team; Agent 2 owns the technical content of the canonical data/domain/storage contracts. Agents 3, 4 and 5 consume those definitions and submit gaps through this process.

## 4.2 Required change request

A contract change request must contain:

```text
CHANGE ID:
REQUESTING AGENT:
PROBLEM / USER OR TECHNICAL NEED:
CURRENT CONTRACT AND SOURCE SECTION:
PROPOSED CHANGE:
AFFECTED TYPES / FIELDS / ENUMS / COMMANDS / TABLES / WORKER TASKS:
AFFECTED MODULES AND AGENTS:
ARCHITECTURE IMPACT:
MIGRATION / BACKWARD-COMPATIBILITY IMPACT:
TEST VECTORS / FAILURE CASES TO ADD OR UPDATE:
UI / REPORT IMPACT:
SCOPE OR SCHEDULE IMPACT:
REQUESTED APPROVAL:
```

The requesting agent must stop the dependent implementation and must not create a local substitute while the request is pending.

## 4.3 Review sequence

1. Requester identifies the missing or incorrect behaviour and exact consumers.
2. Agent 1 checks the architecture, MVP scope, UI and roadmap impact.
3. Agent 2 edits `DATA_MODEL_AND_CONTRACTS.md` and canonical TypeScript contracts when the change concerns domain/data/storage/engine interfaces. Agent 4 reviews calculation and worker impacts. Agents 3 and 5 review visible controls/result impacts.
4. If architecture changes, Agent 1 prepares the ADR/source-document amendment and obtains project-owner approval before changing the lower-level contract.
5. Agent 2 updates normative vectors/fixtures. Every affected agent updates its consumer tests and implementation branch against the same contract revision.
6. Agent 1 records the new contract revision and merges the change. Dependent work resumes only after all affected agents confirm the same revision.

## 4.4 Versioning rules

Use semantic intent, not file modification timestamps:

- **Patch:** wording, examples, typo or clarification that does not change code-visible semantics.
- **Minor:** additive, backwards-compatible optional contract or output metadata that does not change existing behaviour.
- **Major:** required-field changes, renamed/removed fields, enum changes that alter validation, command/worker protocol incompatibility, persisted record meaning changes or engine output semantics changes.

Regardless of document contract version:

- Bump `DATABASE_VERSION` and add a Dexie migration when the stored schema/indexes or serialized record meaning requires it. Never mutate the meaning of a deployed field in place.
- Bump an `ENGINE_VERSIONS` entry when that engine's output semantics or canonical input interpretation changes. Old cache entries must then miss by hash/version.
- Bump `WORKER_PROTOCOL_VERSION` only when the request/response envelope or task protocol is incompatible; update both worker entries and client/tests together.
- Update test vectors whenever a contract or calculation semantic changes. Do not change an expected value merely to make an implementation pass; first verify the mathematics and source assumptions.

No change is considered approved until the document and the implementation contract revision agree on the same definitions.

---

# 5. Git and parallel-development workflow

Use one Git repository and, where Antigravity supports it, one Git worktree per active agent. This is intentionally simpler than a multi-repository or monorepo workflow.

## 5.1 Branch layout

```text
main                         # protected stable/release branch
integration                  # Agent 1's integration branch
agent-2-domain-persistence   # Agent 2 worktree/branch
agent-3-workspace-ui         # Agent 3 worktree/branch
agent-4-engines-workers      # Agent 4 worktree/branch
agent-5-analysis-reporting   # Agent 5 worktree/branch
```

Rules:

- Agent 1 alone owns `integration` and is the only agent who merges specialist work into it.
- `main` is not a working branch. Agent 1 promotes a phase/release-ready integration state to `main` after the relevant gate and project-owner approval.
- Each specialist branch starts from the latest accepted `integration` commit.
- One worktree/working directory per agent. Never let multiple agents edit the same working tree concurrently.
- Each task should produce a small, reviewable commit series. Do not combine unrelated modules or speculative refactors into one handoff.
- Specialists do not merge directly into one another's branches. Cross-agent dependencies are met through frozen interfaces and Agent 1's integration branch.
- Rebase or merge the latest integration branch into a specialist branch before handoff when it has materially changed. Resolve conflicts in the files' owning agent's worktree; Agent 1 controls the final merge.
- Do not commit generated build output, local databases, temporary analysis rasters, browser profiles, environment secrets or private network data.

## 5.2 Task assignment template

Every assigned work package must specify:

```text
TASK ID:
OBJECTIVE:
ACCOUNTABLE AGENT:
EXACT OWNED PATHS:
CONTRACT REVISION:
SOURCE DOCUMENTS / SECTIONS:
UPSTREAM DEPENDENCIES:
EXPECTED PUBLIC API OR UI SURFACE:
ACCEPTANCE CRITERIA:
REQUIRED TESTS:
EXPLICIT EXCLUSIONS:
HANDOFF DESTINATION:
```

A work package may have contributors but exactly one accountable owner. Ownership never becomes shared merely because another agent reviews the work.

## 5.3 Dependency installation and lockfile

- Only Agent 1 edits `package.json` or `package-lock.json` and performs dependency installation/update commands.
- Specialists submit a dependency request with package name, runtime vs. test-only classification, reason, existing-stack alternative considered and bundle/security impact.
- Use only the locked stack and explicitly permitted tooling additions in Architecture §4.2 and Roadmap §2.
- Do not introduce extra runtime dependencies for convenience. Do not install a substitute for an approved library.
- After an approved dependency change, Agent 1 commits both manifest and lockfile; every agent uses `npm ci` to reproduce the exact dependency graph.

---

# 6. Coding and implementation conventions

These rules are intentionally practical. They standardize interfaces and behaviour without forcing unnecessary abstraction.

## 6.1 TypeScript

- Enable `strict: true`; keep the project type-safe. Enable `noUncheckedIndexedAccess` where compatible with the frozen contracts and current code, and resolve resulting checks rather than suppressing them globally.
- Do not use `any` for domain, worker, repository, engine or UI model payloads. Prefer `unknown` at untrusted boundaries and narrow/validate it.
- Keep branded IDs branded across public APIs. Validate prefixes and UUID v4 form when records enter storage; do not cast arbitrary strings to IDs without a validator.
- Use discriminated unions for device types, analysis records, commands, errors and worker messages.
- Keep timestamps as `EpochMs` integer epoch milliseconds. Do not persist JavaScript `Date` objects or locale-formatted strings.
- Keep units explicit in names and docs: `lengthM`, `areaM2`, `txPowerDbm`, `frequencyMhz`, `capacityMbps`, `latencyMs`, `powerW`, `perHostDemandMbps`.
- Use `null` only where the contract gives it a defined meaning. Do not replace missing values with `0`, empty string or `undefined`.
- Do not widen exact types into arbitrary object dictionaries. `DeepPartial<ProjectSettings>` remains restricted to the declared contract keys and must be validated at runtime.
- Prefer named exported interfaces/types for public module contracts; keep implementation-only helpers unexported.

## 6.2 Naming and file organisation

- Types and interfaces: `PascalCase`.
- Functions, variables and store actions: `camelCase`.
- React components: `PascalCase`.
- Utility/service/engine files: descriptive `camelCase.ts` names consistent with the architecture (`localFrame.ts`, `analysisCoordinator.ts`). Component files may use `PascalCase.tsx`.
- Unit tests: `*.test.ts` or `*.test.tsx`, adjacent to the owned module's test folder.
- Worker entries retain the architecture's names: `coverage.worker.ts` and `simulation.worker.ts`.
- Avoid default exports for shared service/engine/domain APIs; use named exports so consumers can trace symbols.
- Keep public barrel exports small and acyclic. Do not create a barrel that re-exports every layer and hides dependency violations.

## 6.3 Pure logic and side effects

- `contracts/`, `kernel/`, `domain/` and `engines/` must keep the purity/import constraints in §3.
- Domain commands validate and calculate change sets; they do not write to Dexie, mutate Zustand or perform I/O.
- Engines compute from explicit typed inputs; they do not read current settings from stores, query the browser, fetch data, access storage or call the clock/random generator.
- IDs and timestamps are generated/injected in the application layer before pure commands execute.
- Async SHA-256 hashing is performed in `application/hashService.ts`, not in engines or kernel.
- Do not add an abstraction unless it has a concrete consumer and stable responsibility. Do not build speculative extension points for deferred backend/cloud functionality.

## 6.4 React components and UI

- Components own presentation, interaction state and short-lived form drafts. They do not own engineering models or persistent project state.
- Read authored records through `designStore`'s committed projection and invoke edits through `DesignSession`/`ProjectService` APIs.
- Do not optimistically render an authored change as committed before the Dexie transaction succeeds. Temporary drag/link/drawing feedback is allowed, but the committed view must be restored from the store on failure.
- A high-frequency marker or React Flow node drag dispatches one command at drag end, never on every pointer movement.
- Form drafts commit on blur or the approved debounce and are flushed before in-app route changes.
- Follow the exact route/navigation and interaction hierarchy in `UI_UX_SPECIFICATION.md`.
- Preserve the locked colours `#02070A`, `#0297DE` and `#FC734D`; do not add a light theme or user-defined theme in the MVP.
- Use semantic labels, keyboard-reachable controls and text alongside status colours. No decorative glassmorphism, glow, gratuitous chart or placeholder route.
- Render user-provided text as text. Do not inject labels/notes into raw HTML.

## 6.5 Persistence, Zustand and application services

- Dexie/IndexedDB is the sole authority for saved authored data and cached analysis records.
- Every authored edit follows: command → pure domain validation/reducer → one Dexie transaction → Zustand projection update → committed event.
- A failed validation or transaction does not update the design projection and must not show `Saved`.
- Only `application/designSession` writes `designStore`.
- Only `application/analysisCoordinator` writes `analysisStore`.
- Preferences are written through `projectService` to `appMeta`; do not use Zustand `persist` middleware.
- Components and features do not import Dexie or repositories.
- Never await a non-Dexie promise (hashing, geocoding, worker, PDF, fetch) inside a Dexie transaction.
- Do not store coverage rasters in Project/Design/AnalysisRecord. Large typed arrays use `analysisBlobs`.
- Derived cache may be evicted within its retention policy; authored projects, designs, devices, links, subnets and obstacles may never be automatically evicted.

## 6.6 Engineering calculations and analysis presentation

- Use the exact engine API, constants, equations, output semantics and normative vectors in `DATA_MODEL_AND_CONTRACTS.md`.
- Cost/IP stay synchronous pure TypeScript invoked through the analysis coordinator. Coverage/Simulation run only in their respective native Web Workers.
- Analysis inputs are built from fully resolved records. A UI component must not resolve catalogue overrides, calculate local metric distance, hash inputs or decide freshness itself.
- Hashes include `engineId`, `engineVersion` and canonical fully resolved inputs. Use the approved canonicalization rules.
- Layout-only changes must not stale analysis. A stale result may be displayed only with the explicit “Out of date” state.
- No automatic analysis on every edit. Manual runs are the default. Optional coverage auto-recalculation is disabled by default and must not run during a drag gesture.
- All modelled cost, coverage, throughput and latency values are estimates. Display the assumptions and limits. Never imply field measurement, real network telemetry, packet-level fidelity or real vendor quote.
- Valid outcomes such as an unallocated subnet, unreachable flow or missing-price partial estimate are data/results, not generic application crashes.

## 6.7 Geography, map services and offline

- Persist GeoJSON coordinates in WGS84/EPSG:4326 as `[longitude, latitude]`.
- The immutable project AEQD frame is the only engineering metric conversion path. Turf.js is permitted for geometry/topology helpers, but Turf distance/length/area/along, Leaflet measurements and Web Mercator coordinates are not engineering measurements.
- Geoman is a temporary geometry gesture layer. After `pm:create` / `pm:update`, extract geometry, remove the temporary layer, dispatch the command and render only after commit.
- The map and logical topology are projections of one design. React Flow stores only abstract logical layout positions; its nodes/edges use DeviceId/LinkId and are derived from the committed domain projection.
- Geocoding uses explicit user-submitted searches only, no autocomplete or background/bulk requests. Follow the public Nominatim rate limit, attribution and privacy constraints in the architecture/service contract. Do not submit private project content as search text.
- Public OSM tiles are best-effort. Do not prefetch, bulk-download or add an app-managed offline cache/region-download flow for the public tile endpoint.
- The PWA precaches the application shell/static assets only. Saved local projects and Coverage/Simulation are editable/runnable offline after first successful app load and service-worker installation. Do not claim the basemap or location search is available offline.

## 6.8 Error handling and logging

- Use the typed error families and stable codes from `DATA_MODEL_AND_CONTRACTS.md`.
- Expected validation findings are `ValidationIssue[]` with `error` or `warning` severity; do not throw for a normal user correction case.
- Worker protocol errors must cross the boundary as serializable DTOs, not cloned `Error` instances.
- UI error messages must state what failed, whether authored data was saved, and the safe next action. Never imply a failed commit succeeded.
- Use the thin `lib/logger.ts` wrapper for developer logging. No analytics, telemetry or remote error reporting is in the MVP.
- Do not persist stack traces or secrets in project data. Never log geocoder queries together with private design context.

## 6.9 Formatting and comments

- Run the repository Prettier and ESLint configuration; do not reformat files outside the task's ownership without coordinating with the owner.
- Keep comments focused on non-obvious constraints, units, formulas, cancellation boundaries and architectural invariants.
- Public contracts require meaningful field comments for non-obvious units/null semantics; ordinary obvious code does not need line-by-line commentary.
- Do not add broad lint suppressions. A local suppression requires a reason and Agent 1 review.

---

# 7. Testing and quality gates

A feature is not complete because its route renders or a development server starts. Test the behaviour defined by the contract, including failure paths.

## 7.1 Required test layers and ownership

| Test layer | Minimum coverage | Primary owner |
|---|---|---|
| Contract/type tests | ID prefixes, branded types at boundaries, enum restrictions, units/null validation, discriminated unions, worker protocol serialization | Agent 2 for shared contracts; Agent 4 for worker envelopes; Agent 1 for app-facing service integration |
| Kernel/domain unit tests | Geometry helpers, canonical JSON, deterministic ID-independent reducer behaviour, command validation, cascades, revision increments, local-frame transforms, topology layout, structural comparison | Agent 2 |
| Storage tests | Dexie v1 schema/indexes, migrations, create project, duplicate project/design, baseline invariant, transaction rollback, cascades, catalog seeding, cache/blob pruning, quota and versionchange/revision conflict | Agent 2 |
| Engine unit/vector tests | IP/VLSM, cost completeness and math, FSPL/log-distance/wall loss/grid summary, Dijkstra/ties/failures, throughput, latency and scenario deltas | Agent 4; Agent 2 maintains normative vectors |
| Worker tests | Request/response protocol, task IDs, malformed input, progress, cancellation, hard terminate, crash/recreation, transferables, stale/superseded result behaviour | Agent 4 |
| Workspace component tests | Map tool mode, Geoman event-to-command handoff, device placement/move commit timing, link draft/cancel/validation, inspector drafts, React Flow shared IDs/layout commit | Agent 3 |
| Analysis/report component tests | Parent CIDR and VLSM table, cost incomplete states, coverage progress/legend/stale state, simulation scenario deltas, comparison missing/stale states, report preview/download error | Agent 5 |
| Integration tests | Project service + Dexie repository + design session + stores; commit-then-project; shared map/topology identity; coordinator/cache/workers; report assembly | Agent 1, with specialist fixes |
| End-to-end/manual acceptance | Full MVP journeys, reload persistence, project/design duplicate, offline editing/runs, PDF download, error recovery and demo | Agent 1; all agents own their defects |

### 7.1.1 Required failure-path tests

At minimum verify:

- IndexedDB blocked/unavailable: the UI does not claim data is saved and does not switch silently to volatile mode.
- Quota exceeded: transaction rolls back, Zustand projection remains on the last committed state, and only analysis cache is offered for cleanup.
- Revision conflict: writes stop for that session and user gets a reload/reopen path; no automatic merge.
- Invalid boundary/obstacle geometry: blocking validation is shown and invalid geometry is not committed.
- Device/link delete cascades: no dangling link, subnet association, layout entry or simulation failure reference remains.
- Geoman event: temporary imperative layer is removed and the committed projection becomes the rendering source.
- Worker cancelled/crashed/malformed response: no partial success record is persisted; worker is recreated according to contract.
- Design modified during a worker run: the old result can be cached under its own hash but is never shown as current for the new inputs.
- Geocoder offline/rate limited: explicit error; existing project editing remains possible.
- Basemap unavailable: authored geometry is still visible on the neutral map canvas.
- PDF generation fails: project records stay intact and a retry is offered.
- Service-worker update arrives during editing: no forced reload; user chooses when to reload.

### 7.1.2 Required mathematical fixture families

Use the actual input/output vectors in `DATA_MODEL_AND_CONTRACTS.md`. Ensure fixture coverage includes:

- IPv4 dotted-decimal parsing, network/broadcast, host boundaries, canonical network alignment, VLSM block sizing/alignment, sorted allocation, insufficient pool and free CIDR remainder.
- Dijkstra shortest path, deterministic equal-cost tie, no path, failed node, failed link and changed path after failure.
- FSPL at 2.4 GHz / 1 m, log-distance at 10 m, received power with fixed 0 dBi receiver assumption, multiple fixed wall crossings, RSSI boundaries and a small grid with exact class/coverage counts.
- CAPEX/OPEX/TCO with cable slack, two termination ends, explicit zeros, maintenance, power/tariff and replacement reserve; partial cases for each missing required input.
- Propagation/transmission/processing latency, missing-capacity output, path bottleneck and multiple flows sharing a link with deterministic equal-share estimates.

Floating outputs must use the stated tolerances and deterministic rounding helper. IP addresses, allocation order, IDs supplied in fixtures, counts and status enums require exact equality. Never use screenshots as proof of algorithmic correctness.

## 7.2 Required repository commands

The following commands must exist and pass from a clean checkout:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run deps:check
npm run build
npm run check
```

`check` must run the required static checks and automated tests (`typecheck`, `lint`, `test`, and dependency-boundary checks). `build` remains a separate mandatory production gate and may be included in an additional `check:full` command if Agent 1 chooses; do not remove the separate build acceptance requirement.

Only Agent 1 changes script definitions. Specialists must report exact commands and results for their owned test suites; Agent 1 runs the repository-wide suite before integration acceptance.

---

# 8. Integration protocol

This procedure applies to every work package. It is deliberately small enough for a college project and strict enough to prevent integration churn.

## 8.1 Task assignment

Agent 1 assigns a task ID, one accountable owner, exact paths, frozen contract revision, upstream dependencies, exclusions and acceptance tests. The owner confirms the worktree/branch and does not edit another agent's primary paths.

## 8.2 Contract verification before coding

The owner reads the relevant parts of:

1. `SYSTEM_ARCHITECTURE.md`.
2. `UI_UX_SPECIFICATION.md` for UI work.
3. `DATA_MODEL_AND_CONTRACTS.md` for types, commands, storage, worker or result contracts.
4. `DEVELOPMENT_ROADMAP.md` for the phase work package and exit gate.
5. `AGENT_TASKS.md` and this document for ownership and integration.

The owner confirms the exact exported types/functions before coding. If the interface is absent, ambiguous or contradictory, use the change-control process in §4. Do not create placeholder fields or invented function signatures.

## 8.3 Implementation and local verification

The owner:

1. Implements only the assigned work package and paths.
2. Uses approved APIs and does not alter protected files.
3. Adds unit/contract/failure-path tests alongside the work.
4. Runs relevant tests and all applicable static checks.
5. Reviews the diff for accidental extra files, secret data, generated artifacts, import-boundary violations and scope expansion.
6. Verifies that all temporary UI state is reconciled with the committed store after success/failure.
7. Documents any incomplete behaviour honestly.

## 8.4 Specialist handoff

Before merge, the agent supplies this exact completion report (from `AGENT_TASKS.md`):

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

Every public API change must cite its contract section and revision. If there were no API changes, say so. If a dependency is requested, do not edit the manifest; provide the justification to Agent 1.

## 8.5 Integration review and merge

Agent 1 reviews:

- Ownership: changed paths belong to the submitting agent or an approved shared-file change.
- Contract conformity: no copied local types, altered enums or unapproved payloads.
- Purity/import boundaries: no circular dependencies or upward imports.
- Data integrity: no second persistence path or optimistic committed UI state.
- Test evidence: new tests exist and relevant commands passed.
- Scope: no deferred feature, placeholder route or speculative feature has slipped in.
- Usability: UI follows the selected design specification and communicates stale/error/offline/estimate states accurately.

If accepted, Agent 1 merges that specialist branch into `integration` and runs targeted regressions. Merge only one specialist branch at a time. After a merge, Agent 1 communicates the commit/revision and any changed consumer contract to affected agents. The specialist branch is not considered integrated until the integration branch passes.

## 8.6 Integration regression

After every meaningful merge, Agent 1 runs the smallest affected integration suite. At each phase gate, run the full required command set plus the phase-specific scenarios. Agent 1 records the merged commit, checks, known limitations and pass/fail status in the project task board or phase log.

## 8.7 Phase acceptance

Agent 1 recommends a phase pass only when all phase exit conditions in `DEVELOPMENT_ROADMAP.md` are met. The project owner accepts the gate. A screen that renders with mocked records does not satisfy a persistence/integration gate. A mathematically plausible number without a passing normative vector does not satisfy an engine gate.

---

# 9. Parallel schedule and dependency controls

The maximum team size remains five agents. The roadmap's sequence is binding; parallelism is permitted only after prerequisite contracts/interfaces have been frozen.

| Stage | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|---|---|---|---|---|---|
| **Preflight / P** | Coordinate sources, ownership, integration plan and approvals | Author/finalize data model, commands, schemas and vectors | Review map/topology UX and report missing contracts | Review engine/worker inputs, outputs and math vectors | Review analysis/report surfaces against result contracts |
| **Phase 0 — sequential foundation** | Repository, package setup, routes, test/lint/boundary config, app shell skeleton | Frozen contract exports, kernel skeleton, vectors/fixtures, repository fake interface | Prepare implementation plan; no competing data models | Review contracts and prepare engine/worker test harness; no algorithm coding before contracts frozen | Prepare screen/component plan using frozen output types; no invented mocks beyond approved fixtures |
| **Phase 1 — parallel cores** | Application/store/service contracts and composition skeleton | Domain, validation, input builders, Dexie and repositories | UI scaffolding may start only against frozen contracts/fixtures | IP/Cost/Coverage/Simulation engines and worker runtime/client | Presentational skeletons may start against frozen UI/data contracts and fixtures |
| **Phase 2 — app/workspace vertical slice** | Project/design service flow, stores, route shell and integration | Domain/persistence fixes and create/duplicate/edit transaction support | Map, designer, inspector and topology vertical slice | Engine/worker integration fixes | Addressing/cost UI foundations and analysis dock integration planning |
| **Phase 3 — analysis experience** | Coordinator, cache/freshness integration and analysis route APIs | Input-builder, storage and comparison support | Coverage map overlay integration surface and map/topology regression | Engine vectors, performance and worker cancellation/recovery fixes | VLSM/cost/coverage/simulation UI and design comparison |
| **Phase 4 — reports/hardening** | PWA, integration, recovery UX, regression, release and demo | Migrations/quota/relational integrity fixes | Workspace polish and map interaction regression | Performance, worker cancellation/crash and numeric regression | PDF report, assumptions/disclaimers, analysis/comparison/report regression |

### 9.1 Safe parallelism rules

- Agent 2 and Agent 4 may implement in parallel only after the public types, engine inputs/outputs, worker task map and normative vectors are frozen.
- Agent 3 and Agent 5 may scaffold UI only after both UI and data/result contracts are frozen. Fixtures must use the canonical types; they may not invent temporary competing entities.
- Agent 3 owns the Leaflet overlay/rendering surface. Agent 5 owns coverage parameters, run/results panel and dead-zone list. Agree the prop/data contract before either side implements the integration.
- Agent 1 may create application/store skeletons in parallel only when its public APIs are agreed with Agent 2/4. It does not duplicate their contracts.
- No agent may claim ownership of another agent's folders because a dependency is late. Use a sequential work package or an explicit handoff negotiated by Agent 1 and the owner.
- Keep at most one active task per specialist branch at a time unless the owner can prove the tasks are disjoint.

---

# 10. Conflict, failure and recovery procedure

| Situation | Required action | Decision/repair owner | Merge policy |
|---|---|---|---|
| Two agents need to edit the same shared file | Stop both edits; agree a single requester and owner; submit a contract/task change request | File owner, coordinated by Agent 1 | No merge until one canonical edit is reviewed |
| A feature needs a field/enum not in the data contract | Stop dependent UI/engine work; submit request with consumers and tests; do not cast around or store it locally | Agent 2 edits; Agent 1 assesses; project owner approves semantic change | No dependent merge until contract revision and consumers align |
| A code change contradicts architecture | Pause affected implementation; cite conflicting sections; propose the smallest compliant correction or formal ADR | Agent 1 + project owner; Agent 2 updates contract if data shape changes | Block merge until resolved |
| An engine fails a normative vector | Verify vector against equation/source assumptions; inspect units, rounding and input builder; repair implementation first | Agent 4 with Agent 2 reviewing vector | No engine merge with unresolved mismatch; vector changes require proof and approval |
| A normative vector appears mathematically wrong | Recalculate independently and document equation/units/tolerance; propose a vector change through §4 | Agent 2 owns vector, Agent 4 reviews, owner approves semantic change | Do not edit expected value solely to match implementation |
| A worker crashes/cancels or returns an old result | Keep authored data; do not persist partial success; apply cancellation/stale policy; expose retry/error state | Agent 4 fixes worker; Agent 1 fixes coordinator; Agent 5 fixes presentation if needed | Block phase gate if stale result can appear current or authored data can be lost |
| A commit/revision/quota error occurs | Do not update design projection; retain last committed state; offer contract-approved recovery action | Agent 2 repository; Agent 1 service/store/UI integration | Block merge if failed commit is displayed as saved or data is removed |
| An agent cannot complete its task in the assigned phase | Submit partial handoff and exact blocker; Agent 1 splits the remaining work into sequential tasks under the same role or adjusts order within roadmap dependencies | Agent 1 with project owner for scope/schedule decisions | Partial work merges only if it compiles, is isolated and does not block integration; feature is not marked done |
| Integration checks fail after merge | Agent 1 stops further merges, records regression and assigns failing module to its owner | Agent 1 coordinates; owning specialist repairs | Do not merge additional branches until integration returns green |
| Specialist work is incomplete or incompatible | Return the branch with explicit failing criteria; do not patch another agent's module except a minimal integration adapter agreed with its owner | Specialist owner repairs; Agent 1 verifies | Reject merge until API, tests and handoff align |
| A merge conflict touches another agent's owned code | Notify the owner; owner resolves in their worktree; Agent 1 reviews final diff | File owner + Agent 1 | No forced overwrite or unilateral conflict resolution |
| A deferred feature is proposed | Record it as deferred; request formal scope change only if it is essential to an MVP acceptance criterion | Project owner decides; Agent 1 records | Do not implement or add placeholder UI while unapproved |

No failure is resolved by silently widening an interface, disabling a test/lint rule, suppressing a TypeScript error, removing an acceptance check or changing a mathematical vector without review.

---

# 11. Antigravity operating instructions

The following block may be supplied to every agent at task start. Agent 1 adds the agent-specific role/path/task data; the shared instructions remain unchanged.

```text
You are one specialist in the five-agent NetScape MVP team. Read the approved
SYSTEM_ARCHITECTURE.md, UI_UX_SPECIFICATION.md where relevant,
DATA_MODEL_AND_CONTRACTS.md, DEVELOPMENT_ROADMAP.md, AGENT_TASKS.md and
DEVELOPMENT_CONTRACTS.md before editing code.

Use only your assigned owned paths. The frozen contracts are the sole source
for entities, commands, repository APIs, engine inputs/outputs and worker
messages. Do not invent fields, types, defaults, algorithms, routes, stores,
services or dependencies. Do not create a local duplicate of a shared type.

Preserve the browser-only, local-first MVP and the approved dependency
boundaries. Do not add deferred features, backend services or new runtime
packages. If a required contract is missing or contradictory, stop that part
of the work and submit a contract change request; do not work around it.

Write tests for successful, invalid and failure paths. Run all applicable
checks. Never claim a feature works unless you have run the relevant test or
verified the exact workflow. Never report a file as complete merely because
it was created or the route renders.

Before handoff, provide TASK, SUMMARY, FILES CHANGED, PUBLIC API / CONTRACTS
USED, TESTS ADDED, COMMANDS RUN, RESULTS, KNOWN LIMITATIONS, DEPENDENCY
CHANGES REQUESTED and FOLLOW-UP / BLOCKERS. Report unresolved issues honestly.
```

---

# 12. Definition of done

## 12.1 Individual task

A task is done only when:

- The stated objective and acceptance criteria are met in the assigned files.
- It uses the current frozen contract revision and no local duplicate types.
- Relevant tests cover success, validation and failure behaviour.
- TypeScript/lint/import boundaries pass for the changed modules.
- No unapproved dependency, scope expansion, unrelated refactor or generated artifact is included.
- The specialist completion report is complete.
- Agent 1 has reviewed and integrated the work.

## 12.2 Module

A module is done only when:

- Its public API is documented and matches the shared contract.
- It can be used by its consumer without importing implementation internals or a competing service/store.
- Its error, loading, empty, stale and offline states are handled where relevant.
- Its unit/contract tests pass.
- Its dependency boundaries pass.
- It is integrated against the real approved repositories/services/engines rather than only local mock data.

## 12.3 Phase

A phase is done only when the exact exit gate in `DEVELOPMENT_ROADMAP.md` is met. In particular:

- Phase 0 requires a clean reproducible install, routes/shell, shared contracts, kernel/vector skeleton, repository test seam and all foundational checks.
- Phase 1 requires isolated core/domain/storage/engine/worker tests and normative vector compliance.
- Phase 2 requires the complete project → device placement/edit → link creation → map/topology consistency → reload persistence vertical slice.
- Phase 3 requires each analysis experience integrated with the coordinator, current/stale states and tests.
- Phase 4 requires local PDF generation, honest offline behaviour, recovery tests, performance evidence and full regression.

## 12.4 Complete MVP

The complete MVP is done only when all roadmap release acceptance checks pass, including:

- Local projects, project duplication, multiple designs, baseline and design duplication behave correctly.
- Boundary/obstacle drawing, device placement, links, inspectors, Star/Tree templates and map/topology shared identities work and persist.
- IPv4/VLSM, cost, coverage v1, simplified simulation/failure scenarios and comparison match the normative contracts.
- PDF sections and assumptions are accurate; figures are schematic and do not depend on basemap tiles.
- Saved projects edit offline; Coverage and Simulation run locally offline after application/service-worker installation.
- Geocoder and basemap unavailability do not prevent editing saved work.
- Quota, failed commits, revision conflicts, worker failure/cancellation and PDF failure preserve authored data.
- All repository commands and production build pass from a clean checkout.
- The interface respects the selected UI/UX spec and locked palette.
- No deferred feature has been implemented or stubbed as an apparent MVP capability.
- The project owner has accepted the release/demo checklist and the team has documented known limitations.

---

# 13. Preflight and phase entry checklist

**Preflight P-01 through P-06 is complete and approved on 2026-11-04.** The project owner delegated final contract reconciliation and permission to begin Phase 0. The canonical documents are frozen at the versions listed below. Phase 0 may start; Phase 1 parallel feature/engine implementation may not begin until Phase 0 acceptance is recorded.

| Preflight task | Status | Evidence |
|---|---|---|
| P-01 — Canonical filenames and repository documentation set | Complete | Six canonical files are listed in the roadmap and supplied to the Antigravity project. |
| P-02 — Data model and API contracts | Complete | `DATA_MODEL_AND_CONTRACTS.md` v1.2 includes entities, commands, repositories, application services, engines, workers, defaults and test vectors. |
| P-03 — Development contracts | Complete | This v1.2 document defines five-agent ownership, boundaries, change control, Git workflow and gates. |
| P-04 — Cross-document reconciliation | Complete | Architecture v1.3, selected UI/UX spec, roadmap and agent assignments have been aligned with the frozen contracts. |
| P-05 — MVP defaults and assumptions | Complete | Coverage, cost, simulation, catalogue seed, port compatibility, installation and null/zero semantics are frozen. |
| P-06 — Owner approval to start Phase 0 | Complete | Project owner delegated final reconciliation and Phase 0 commencement on 2026-11-04. |

### 13.1 Frozen document set

- `SYSTEM_ARCHITECTURE.md` — architecture v1.3.
- `UI_UX_SPECIFICATION.md` — selected first specification, reconciled to architecture v1.3.
- `DATA_MODEL_AND_CONTRACTS.md` — contract v1.2.
- `DEVELOPMENT_CONTRACTS.md` — contract v1.2.
- `DEVELOPMENT_ROADMAP.md` — roadmap v1.2.
- `AGENT_TASKS.md` — five-agent ownership baseline, synchronized with contracts v1.2.

### 13.2 Phase 0 entry rule

Phase 0 begins with Agent 1 only. Agent 1 completes the repository/toolchain scaffold and passes the P0-01/P0-02 gate before Agent 2 starts shared code contracts/kernel/test seam (P0-03/P0-04). Agents 3, 4 and 5 may review contracts and identify integration risks but must not begin feature or engine implementations during Phase 0. Phase 1 work is blocked until the project owner accepts the complete Phase 0 gate.

## Final operating rule

Preflight P-06 is recorded as passed. The team may begin Phase 0 under the sequential entry rule in §13.2; Phase 1 remains gated by Phase 0 acceptance.
