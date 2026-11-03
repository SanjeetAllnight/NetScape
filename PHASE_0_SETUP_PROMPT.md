# NetScape — Antigravity Phase 0 Setup Prompt

**Execution mode:** Controlled sequential setup  
**Phase:** 0 — Foundations only  
**Agent limit:** Five roles total; only Agent 1 and then Agent 2 perform implementation work in Phase 0  
**Canonical baseline:** Six frozen documents in `docs/`  
**Do not begin Phase 1 during this task.**

---

## ROLE AND MISSION

Act as the **NetScape Integration Lead / Platform Engineer (Agent 1)** and execute Phase 0 of the approved NetScape development roadmap.

You are responsible for creating a clean, reproducible development foundation in the **existing NetScape workspace**. This is a controlled setup task, not permission to start building the full product.

Work in the exact order defined below:

1. Inspect the workspace and verify the six canonical project documents.
2. Complete **P0-01: Repository and toolchain**.
3. Complete **P0-02: Target repository structure**.
4. Run the Agent 1 scaffold gate and record evidence.
5. Only after that gate passes, perform the sequential Agent 2 work: **P0-03: Shared contracts and kernel skeleton** and **P0-04: Repository test seam**.
6. Run the complete Phase 0 exit gate, review the result, and report what is ready for Phase 1.

If Antigravity supports specialist delegation, use no more than the five existing roles from `AGENT_TASKS.md`. Do not spawn extra agents. Agent 1 remains the only merge/integration authority. Agent 2 may work only after the Agent 1 scaffold gate passes. Agents 3, 4 and 5 are review-only in Phase 0; they must not implement feature screens, engines, workers or reports.

If separate subagents/worktrees are unavailable, perform the Agent 2 stage sequentially after P0-01/P0-02 are complete. Never allow two agents to edit the same working directory concurrently.

## 1. READ AND VERIFY THE CANONICAL DOCUMENTS FIRST

Read all six documents completely before changing source files:

1. `docs/SYSTEM_ARCHITECTURE.md` — architecture v1.3.
2. `docs/UI_UX_SPECIFICATION.md` — selected and reconciled UI/UX specification.
3. `docs/DATA_MODEL_AND_CONTRACTS.md` — frozen contract v1.2.
4. `docs/DEVELOPMENT_CONTRACTS.md` — frozen development contract v1.2.
5. `docs/DEVELOPMENT_ROADMAP.md` — roadmap v1.2.
6. `docs/AGENT_TASKS.md` — approved five-agent ownership baseline.

The six documents are the source of truth. The precedence and conflict rules inside them are binding. Do not reinterpret settled decisions for convenience.

### Document integrity rules

- Confirm that all six files exist under the canonical `docs/` directory and that their titles/versions match the list above.
- The supplied project bundle is expected to contain these files. If a file is missing, truncated, empty, or has a materially different version/content, **stop before scaffolding** and report the discrepancy.
- Do not invent a missing document, regenerate one from memory, or silently use an older duplicate.
- Preserve any existing root-level Markdown documents, project files, `.git` history, and user work. Do not delete, rename, overwrite or move user files as a shortcut.
- If root-level documents duplicate the canonical `docs/` files, leave them untouched and use `docs/` as the canonical implementation reference. Report any content mismatch; do not silently reconcile it.
- Do not redraft or modify the six frozen specifications during Phase 0. If a real contradiction is discovered, stop the affected task and submit a change request through `DEVELOPMENT_CONTRACTS.md`.

At the end of this review, state that the six documents were read and list their versions. Do not proceed if the canonical document check fails.

## 2. NON-NEGOTIABLE PROJECT BASELINE

### Product

NetScape is a desktop-first, local-first map-based network infrastructure planning workstation for a college DCCN project. Its MVP includes a map workspace, device/network designer, logical topology, IPv4/VLSM, cost estimation, wireless coverage estimation, simplified network simulation, design comparison and PDF reporting.

The full MVP is **not** being implemented in Phase 0.

### Locked technology stack

Do not replace or casually expand this stack:

- Node.js 24 LTS and npm.
- React + TypeScript + Vite.
- React Router with `createHashRouter`.
- Tailwind CSS + shadcn/ui conventions.
- Lucide React.
- Zustand.
- Leaflet + React-Leaflet + Leaflet-Geoman Free.
- React Flow (`@xyflow/react`).
- Turf.js + proj4.
- Recharts.
- Dexie + IndexedDB.
- Native Web Workers.
- vite-plugin-pwa + Workbox.
- jsPDF + html2canvas.
- Vitest + React Testing Library.

It is acceptable to install feature-specific locked-stack dependencies only when the relevant implementation phase first needs them. Do not install the entire future stack merely to make Phase 0 appear complete. Agent 1 owns `package.json` and `package-lock.json`; no other agent edits them.

Permitted test/tooling additions from the frozen architecture include `fake-indexeddb`, `jsdom`, Testing Library helpers, ESLint import-boundary tooling, dependency-cruiser and Prettier. Any other dependency must follow the change-control rules.

### Architectural invariants

- Single repository and one Vite application. No monorepo.
- No backend in the MVP. Do not create FastAPI, PostgreSQL, PostGIS, Docker, Redis or cloud infrastructure.
- Dexie/IndexedDB is the only production authority for authored saved data.
- Zustand is transient UI state plus a disposable projection; do not enable Zustand `persist` for design data.
- Design edits follow validate/apply command → Dexie transaction → update Zustand projection only after successful commit.
- Map and topology are two views of the same Device/Link records and stable IDs.
- Geographic `GeoPoint` and logical `LogicalPoint` are distinct types.
- Engineering engines are pure TypeScript; they do not import React, DOM, Dexie or Zustand.
- `domain/` and `engines/` are sibling layers; neither imports the other.
- Engines receive local metric coordinates, never raw longitude/latitude.
- Only Coverage and Simulation use Web Workers. IP and Cost are synchronous pure TypeScript engines.
- PWA service worker precaches the app shell/static assets only. Do not add a generic Workbox CacheFirst rule, prefetch or offline download for public OpenStreetMap tiles.
- No real geocoder/tile requests are required in Phase 0.
- The approved numerical defaults, sample catalogue, power-duty assumption, port matrix and installation rules are frozen in `DATA_MODEL_AND_CONTRACTS.md`. Do not ask the user to choose them again.

## 3. PHASE 0 EXECUTION BOUNDARY

Phase 0 is a foundation and compile-time contract phase. Its tasks are P0-01 through P0-04 in `DEVELOPMENT_ROADMAP.md`.

### Included

- Repository/toolchain initialization and verification.
- TypeScript strict configuration and path aliases.
- Tailwind setup and shadcn/ui conventions.
- Minimal React application shell and hash-router route skeleton.
- PWA shell/update configuration, without tile caching.
- ESLint, Prettier, Vitest, React Testing Library, jsdom and test-only fake-indexeddb setup.
- Dependency/import boundary enforcement and cycle detection.
- Architecture-approved directory structure.
- Canonical shared type exports, enums, branded IDs, constants and typed error contracts.
- Small pure kernel primitives specified as shared by the frozen contracts.
- Canonical test-vector/fixture formats and starter vectors.
- Test-only in-memory repository fake/test seam, including commit/transaction failure semantics.
- A minimal README for local setup and available scripts.

### Explicitly excluded

Do not implement any of the following in Phase 0:

- Functional Projects dashboard, project creation, project duplication or project persistence flows.
- Real Leaflet map, location search, tile provider integration, Geoman tools or map drawing.
- Device palette, device placement, link creation, inspector, topology templates or React Flow screen.
- Functional Addressing/VLSM UI or IP allocation engine implementation.
- Cost engine/UI or catalogue screens/seed operations.
- Coverage algorithms, heatmap, raster pipeline or coverage UI.
- Simulation algorithms, worker entries, worker client or simulation UI.
- PDF report generation, comparison UI or analytics dashboards.
- Production Dexie database/schema/repositories/migrations.
- Domain command reducer, full command cascades, project-local geo conversion/input builders or full domain services.
- Worker protocol runtime or worker implementation beyond shared compile-time protocol types/skeletons explicitly required by the frozen contract.
- Authentication, accounts, cloud sync, backend, external data ingestion or any deferred feature.

Do not add disabled buttons, empty future-feature sections, fake sample project data or “coming soon” dashboards. Phase 0 needs only enough UI to prove that the application and router boot.

## 4. STAGE A — AGENT 1: P0-01 REPOSITORY AND TOOLCHAIN

### 4.1 Inspect before changing

- Inspect current workspace path, files, `package.json`, `package-lock.json`, `tsconfig`, Vite config, Git status/branch and installed Node/npm versions.
- Confirm Node major version is 24. If the active runtime is not Node 24, do not silently change system Node or use an incompatible version; report the environment and use the approved project runtime mechanism if already configured.
- If a repository/toolchain already exists, audit and adapt it. Do not recreate it.
- If there is no Vite app, initialize the Vite React TypeScript app in the **current NetScape project root**, not in a nested `netscape/netscape` folder. Since the workspace contains documentation, do not use a force scaffold command that overwrites existing files. If the scaffold tool refuses a non-empty directory, scaffold in a temporary sibling directory, copy only non-conflicting app/toolchain files into the current root, verify the result, and remove only that temporary scaffold directory.
- Preserve `.git`, all six canonical docs, screenshots and other user-supplied files.

### 4.2 Package and scripts

Agent 1 alone owns dependency installation and the package lockfile.

Install only the packages required to boot the Phase 0 shell and run its checks. The initial Phase 0 dependency set should cover:

- React, React DOM, React Router, Zustand and Lucide React.
- Vite and the React Vite plugin.
- TypeScript and the Tailwind integration selected for the compatible current stable Tailwind/shadcn convention.
- vite-plugin-pwa / Workbox integration for app-shell precache and update prompting.
- Vitest, React Testing Library, jest-dom, user-event and jsdom.
- fake-indexeddb for future Dexie tests; do not add Dexie production storage implementation yet.
- ESLint, TypeScript ESLint, React Hooks/Refresh linting, Prettier and an approved dependency-boundary/cycle checker.

Do not install Leaflet, Geoman, React Flow, Turf, proj4, Recharts, Dexie, jsPDF or html2canvas until the phase that first implements those modules, unless a specific Phase 0 contract/type check requires a package. Those packages remain part of the locked later MVP stack; deferring their installation now does not change the stack.

Create and verify these scripts (names are normative):

- `dev`
- `build`
- `preview`
- `typecheck`
- `lint`
- `test`
- `deps:check`
- `check`
- `check:full`

`check` must run typecheck, lint, unit/component tests and dependency-boundary checks. `check:full` must run `check` plus the production build. Tests must exit non-zero on failure. Avoid scripts that merely echo success.

### 4.3 TypeScript and aliases

- Enable `strict: true`.
- Enable `noUncheckedIndexedAccess: true` where compatible with the frozen contracts; if it exposes a contract bug, report it rather than weakening strictness silently.
- Use the approved `@/*` source alias consistently in both TypeScript and Vite.
- Use modern Vite/bundler module resolution and type-only imports where appropriate.
- Avoid `any`; do not disable strict checks to make the first build green.
- Keep browser-only APIs out of Node-tested pure modules.

### 4.4 Styling and UI conventions

- Configure Tailwind and shadcn/ui conventions under `src/components/ui/` and the approved aliases. Do not generate a large component library in Phase 0.
- Establish the fixed brand CSS variables:
  - Midnight Black `#02070A`
  - Electric Blue `#0297DE`
  - Cantaloupe Orange `#FC734D`
- Use restrained dark neutral supporting surfaces and readable text. Do not invent new brand accents.
- Define the approved typography fallbacks in global CSS (Noto Sans/system sans; Noto Sans Mono/ui-monospace for technical values).
- Add Lucide React as the only icon system.
- Do not build actual feature layouts or detailed screen components.

### 4.5 Router and minimal shell

- Configure `createHashRouter`, not `BrowserRouter` or `createBrowserRouter`.
- Add the route skeleton from `SYSTEM_ARCHITECTURE.md`:
  - `/`
  - `/catalog`
  - `/settings`
  - `/projects/:projectId`
  - `/projects/:projectId/designs`
  - `/projects/:projectId/designs/:designId/map`
  - `/projects/:projectId/designs/:designId/topology`
  - `/projects/:projectId/designs/:designId/addressing`
  - `/projects/:projectId/designs/:designId/cost`
  - `/projects/:projectId/designs/:designId/simulation`
  - `/projects/:projectId/designs/:designId/report`
  - `/projects/:projectId/compare`
- Coverage is a panel in the map workspace, not a separate route.
- Phase 0 route components may be simple named placeholders stating that the relevant approved MVP module is not implemented yet. They must not contain inert controls, invented sample data or feature logic.
- Add a minimal application shell with NetScape identity, a simple navigation frame and a visible Phase 0 status message. It must boot without Dexie, backend calls, maps or feature mock data.
- Add a route-level not-found state and a basic error boundary.
- Do not implement project redirect logic that depends on a project service that does not yet exist; preserve its intended route contract and add the redirect when the project service is implemented.

### 4.6 PWA

- Configure vite-plugin-pwa and Workbox for application-shell/static-asset precache and prompt-style updates (`registerType: "prompt"`).
- Do not add tile caching/prefetch, region downloads or offline basemap features. Do not send Nominatim/geocoding requests.
- Ensure the app shell can boot from the service-worker precache after a successful first install/load.
- Make the manifest/install configuration valid with local icons or simple project-owned SVG icons if required.
- Do not claim offline project editing in Phase 0 because project persistence is not implemented yet. The UI should not overstate capabilities.

### 4.7 Lint, boundaries, testing, CI

Configure the dependency rules from `DEVELOPMENT_CONTRACTS.md` §3. At minimum, mechanically check:

- No import cycles across architectural modules.
- `features/**` cannot import `storage/**`, `workers/**`, `services/**` adapters or `engines/**` directly.
- `engines/**` imports only `contracts/**`, `kernel/**` and permitted standard APIs.
- `domain/**` cannot import `engines/**`, React, Zustand, Dexie, workers or service adapters.
- `workers/**` cannot import React, DOM, Dexie, Zustand, storage or services.
- Storage and application boundaries match the approved matrix.

Configure Vitest with React Testing Library and jsdom for UI tests. Keep `fake-indexeddb` test-only. Do not add tests that depend on real network services.

If a GitHub remote is already configured, add a minimal CI workflow that runs `npm ci`, `npm run check` and `npm run build`. Do not create a public remote, push code, add secrets or assume GitHub credentials exist.

### 4.8 Git handling

Follow `DEVELOPMENT_CONTRACTS.md` §8:

- Inspect the current branch and working tree first.
- Never discard user changes.
- `main` remains stable; Agent 1 works on the approved integration branch/workflow.
- If there is no Git repository, initialize one without deleting files, create the stable default branch and the integration working branch according to the development contract.
- Do not force-push, rewrite history or push to a remote without explicit user instruction.
- Make small commits only if the repository state and branch rules allow it; report commits and working-tree status.

## 5. AGENT 1 SCAFFOLD GATE — MUST PASS BEFORE AGENT 2

Before starting Agent 2, prove all of the following:

1. Current project root contains one Vite React TypeScript application; no nested duplicate project was created.
2. All six canonical docs remain present and unchanged under `docs/`.
3. `package-lock.json` exists and matches `package.json`.
4. Node/npm versions are reported; Node major is 24.
5. `npm run typecheck` passes.
6. `npm run lint` passes.
7. `npm test` passes with at least one real test proving the harness runs.
8. `npm run deps:check` passes and checks actual source paths.
9. `npm run build` passes.
10. The hash-router shell starts and all route skeletons resolve.
11. No backend, external service, real tile request, geocoder request or feature-level mock data is needed to boot.
12. No forbidden imports or cycles are present.

Provide command output summaries and exact pass/fail status. If any gate fails, fix it before moving to Agent 2. Do not waive or relabel a failed gate as complete.

## 6. STAGE B — AGENT 2: P0-03 SHARED CONTRACTS AND KERNEL SKELETON

Start this stage only after Agent 1's scaffold gate passes. Agent 2 owns the paths assigned in `AGENT_TASKS.md`; Agent 1 remains the integration/merge authority.

### 6.1 Contract code exports

Implement the frozen data-contract definitions in source code, preserving exact names, discriminants, semantics and units from `docs/DATA_MODEL_AND_CONTRACTS.md`.

Organize exports under `src/contracts/` (with small focused modules and a stable barrel), including:

- Branded IDs and ID prefixes.
- Primitive numeric, money, geographic and logical coordinate types.
- Domain entities and enums.
- Project/design settings and frozen constants/default types.
- Validation issue and typed error contracts.
- Design command/change-set contracts.
- Repository interfaces.
- Application-service/event contracts.
- Engine input/output contracts.
- Analysis/cache/blob contracts.
- Worker protocol messages and task maps.
- Comparison and report model contracts.
- Normative test-vector types.

The source Markdown contract is normative. Do not rename fields, narrow/expand unions, introduce convenience aliases with different semantics or create local feature-specific copies. Use type-only imports where appropriate. Avoid runtime dependency on UI/engine/storage code.

Do not turn this task into implementing `applyCommand`, complete validation/cascades, project services, the real analysis coordinator or any engine.

### 6.2 Kernel skeleton and small pure primitives

Create the approved `src/kernel/` module structure. Implement only the small generic, pure primitives explicitly required by the frozen architecture/contracts and Phase 0 roadmap, such as:

- Canonical JSON normalization/serialization needed for deterministic hash input representation (no Web Crypto SHA-256 in kernel).
- Deterministic rounding/quantization helpers where their exact behaviour is frozen in the contracts.
- Stable identifier comparison helpers.
- Minimal generic graph heap/geometry primitive only if its contract and normative tests are defined at this stage.

Keep the asynchronous SHA-256 digest in the application/hash service boundary when that service is implemented. Do not import `crypto.subtle` into engines or kernel.

Do not implement full FSPL/log-distance coverage, VLSM allocation, CAPEX/OPEX calculation, Dijkstra routing, obstacle intersection pipeline, project AEQD workflows or other Phase 1 engine/domain functionality in Phase 0. A kernel helper may have a focused test; full engineering algorithms remain later-phase work.

### 6.3 Canonical fixtures and vectors

- Create the normative vector/fixture directory structure specified by the contracts.
- Represent each vector with stable IDs/names, input, expected output, units, tolerances and any rounding notes required by the contract.
- Add the approved deterministic starting vectors from the data contract for IP/VLSM, FSPL/log-distance, cost, Dijkstra and simulation latency/throughput.
- These are canonical test data for later engine implementations. Do not create dummy engine implementations just to execute them now.
- Add Phase 0 tests validating fixture shape, importability and any kernel helper behaviour that is implemented.
- Agent 2 owns canonical expected values. Agent 4 may later propose vector changes with mathematical evidence; it must not edit canonical fixtures unilaterally.

### 6.4 No production domain/storage implementation

During Phase 0, do not implement:

- Production Dexie database classes, table/index definitions or migrations.
- Production repositories.
- `applyCommand`, project/design command cascades or project creation/duplication services.
- Engine implementations or workers.
- Full geo/input builders or comparison algorithms.

These are Phase 1 and later deliverables. Phase 0 defines the compile-time seams only, plus a test-only repository fake in P0-04.

## 7. STAGE C — AGENT 2: P0-04 IN-MEMORY REPOSITORY TEST SEAM

Create the test-only fake repository implementation described in `DATA_MODEL_AND_CONTRACTS.md` and `DEVELOPMENT_CONTRACTS.md`.

Requirements:

- It must satisfy the same public repository interfaces consumed by application/domain tests.
- Place it under `tests/` (fixtures/support) rather than `src/storage/` production code.
- It must not be imported by production application bundles.
- It must model the observable contract semantics needed for tests: atomic multi-table commits, no partial mutation on failure, expected revision checks, uniqueness/baseline invariants where those are part of the repository contract, and referential consistency for tested operations.
- Add deterministic test controls for a forced transaction/commit failure and revision conflict.
- Add tests proving rollback/no partial mutation when a commit fails and that the fake rejects stale revisions as specified.
- Do not create an in-memory production persistence fallback. If IndexedDB is unavailable in production, the app must follow the architecture's blocking storage error behaviour when that implementation arrives.

The fake need not implement unneeded features beyond the frozen interfaces and Phase 0 test requirements. Do not create a second application data model.

## 8. AGENT 2 COMPLETION GATE

Before integrating Agent 2's branch/work package, verify:

1. Every normative contract category has a corresponding canonical TypeScript export.
2. Type names, field names, units, discriminants and branded IDs match the Markdown contract.
3. No feature or engine has defined duplicate entities.
4. Kernel code is pure and respects layer boundaries.
5. Canonical fixture/vector files compile and preserve expected values from the frozen data contract.
6. No full engineering algorithm or product feature was implemented early.
7. The in-memory repository fake is test-only and matches the declared interfaces.
8. Commit-failure and revision-conflict tests pass.
9. `npm run typecheck`, `npm run lint`, `npm test`, `npm run deps:check` and `npm run build` all pass after integration.

Agent 1 reviews the handoff, resolves merge conflicts, integrates it, runs all checks and records the gate evidence. Agents 3–5 may review contracts/exports and report consumer gaps, but they do not begin their Phase 1 implementations.

## 9. FINAL PHASE 0 ACCEPTANCE GATE

Phase 0 is complete only when all of the following are true:

- The canonical docs are present, unchanged and referenced by the repository README.
- A clean checkout can run `npm ci` successfully.
- `npm run typecheck` passes.
- `npm run lint` passes.
- `npm test` passes.
- `npm run deps:check` passes.
- `npm run build` passes.
- The minimal hash-router shell boots with no feature mock data or backend.
- The approved directory structure exists.
- Shared contract exports compile and correspond to the frozen source definitions.
- The pure kernel skeleton has passing tests.
- Canonical vectors/fixtures exist and compile.
- Test-only in-memory repository fake demonstrates commit atomicity/failure and revision-conflict semantics.
- No production Dexie schema/repositories, domain command system, engineering engine, worker implementation or Phase 1 product feature was prematurely added.
- The six existing specifications remain unchanged; implementation discrepancies are reported rather than silently “fixed” inside them.

Do not begin Phase 1 automatically after passing this gate. Report Phase 0 completion and wait for explicit project-owner acceptance before the parallel-core phase starts.

## 10. REQUIRED FINAL REPORT

At completion, produce a concise but evidence-based report with:

1. **Workspace inspection:** current root, Git status/branch, Node/npm versions, existing files preserved.
2. **Document verification:** six canonical filenames and versions verified.
3. **Phase 0 tasks:** P0-01, P0-02, P0-03 and P0-04 status.
4. **Agent activity:** which roles implemented work; confirm no more than five roles and that Agents 3–5 were review-only.
5. **Files created/modified:** grouped by toolchain, app shell, contracts, kernel, fixtures and test seam.
6. **Dependencies:** added packages with a brief reason; identify any postponed feature dependencies.
7. **Checks:** exact commands run and pass/fail results; report build and tests separately.
8. **Git:** branch/worktree, commits if any, merge status and remaining working-tree changes. Never claim a push unless one actually occurred.
9. **Scope verification:** explicitly confirm no feature/engine/backend implementation from Phase 1+ was started.
10. **Remaining issues:** exact blockers or unresolved items, with owning agent and affected file/path. Do not conceal failed tests or incomplete tasks.
11. **Recommendation:** state whether Phase 0 is ready for project-owner acceptance. Do not declare Phase 1 started.

## FINAL INSTRUCTION

Follow the approved roadmap and contracts exactly. Complete Phase 0 sequentially, validate every gate, preserve the user's workspace, and stop at the Phase 0 boundary. **The goal is a reproducible foundation—not a partially built product.**
