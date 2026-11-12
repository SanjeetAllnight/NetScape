# NetScape — Developer Handover Document

**Welcome to NetScape!** This document provides incoming engineers with a complete, practical, and verified technical briefing to understand, run, develop, and extend NetScape without requiring a verbal walkthrough.

---

## 1. Project Overview

**NetScape** is a desktop-first, local-first engineering workstation designed for planning, designing, and validating campus and enterprise computer network infrastructure. It unifies five historically fragmented engineering workflows into a single offline-capable browser application:

1. **Geographical CAD / GIS Mapping:** Metric-accurate site layout, device placement, obstacle drafting with material-based RF attenuation, and cable routing.
2. **Logical Topology Modeling:** Hierarchical node-link diagrams with independent presentation coordinates.
3. **IPv4 Addressing & VLSM:** Deterministic subnet allocation conforming to RFC 1878 with space-wastage tracking.
4. **Financial Estimation (BOM & TCO):** Capital expenditure (CAPEX), operational expenditure (OPEX), and multi-year Total Cost of Ownership (TCO) modeling.
5. **Wireless RF Propagation & Network Simulation:** 2D log-distance path loss heatmaps and Dijkstra shortest-path reachability and bottleneck analysis.

### Primary Purpose & Product Philosophy
- **Zero Backend Required:** Runs 100% in the client browser. No cloud databases, external servers, or user accounts are required to store or compute network designs.
- **Transparent Engineering Estimates:** NetScape is an engineering planning and teaching workstation, not a physical network controller or site survey sniffer. All model outputs carry `isEstimate: true` and disclose their baseline assumptions.
- **One Model, Multiple Projections:** The geographical map and the logical topology are two distinct visual projections of the same underlying domain aggregate. Neither view owns or corrupts the domain truth.

---

## 2. Technology Stack

| Layer / Responsibility | Technology / Library | Version | Description & Role |
| :--- | :--- | :--- | :--- |
| **Runtime & Tooling** | [Node.js](https://nodejs.org/) | `>=24.x` (v26 tested) | Development and build execution runtime |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | `~5.7.2` | Strict typing across all domain and application boundaries |
| **Build & Bundler** | [Vite](https://vitejs.dev/) | `^6.0.7` | Fast HMR dev server and Rollup production bundler |
| **UI Framework** | [React](https://react.dev/) / [React DOM](https://react.dev/) | `^18.3.1` | View rendering and reactive UI components |
| **Routing** | [React Router DOM](https://reactrouter.com/) | `^6.28.0` | Client-side URL hash routing (`createHashRouter`) |
| **Styling & Icons** | [Tailwind CSS](https://tailwindcss.com/) / [Lucide React](https://lucide.dev/) | `^3.4.17` / `^0.474.0` | Dark-first engineering workstation theme and iconography |
| **Geographic Mapping** | [Leaflet](https://leafletjs.com/) | `^1.9.4` | Interactive 2D map canvas with tile layers and vector overlays |
| **Spatial Drawing** | [@geoman-io/leaflet-geoman-free](https://geoman.io/) | `^2.20.5` | Polygon editing for planning boundaries and building obstacles |
| **Cartographic Projections** | [proj4](https://trac.osgeo.org/proj4/) | `^2.22.0` | Conformal Azimuthal Equidistant (AEQD) metric coordinate frame |
| **Spatial Geometry** | [@turf/boolean-point-in-polygon](https://turfjs.org/) | `^7.4.0` | Boundary containment and point-in-polygon validation |
| **Logical Topology Graph** | [@xyflow/react](https://reactflow.dev/) (ReactFlow) | `^12.12.1` | Interactive, draggable hierarchical network graph canvas |
| **Local Persistence** | [Dexie.js](https://dexie.org/) | `^4.4.7` | IndexedDB abstraction with ACID transactions and schema indexing |
| **State Management** | [Zustand](https://github.com/pmndrs/zustand) | `^5.0.3` | Lightweight transient UI state and disposable session projections |
| **Multithreading** | Web Workers API | Native | Background worker threads for coverage and simulation computations |
| **Report Generation** | [jsPDF](https://github.com/parallax/jsPDF) / [jspdf-autotable](https://github.com/simonbengtsson/jsPDF-AutoTable) | `^4.2.1` / `^5.0.9` | Client-side vector and tabular A4 PDF generation |
| **Offline PWA** | [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) / [workbox-window](https://developer.chrome.com/docs/workbox/) | `^0.21.1` / `^7.3.0` | App-shell service worker caching and offline update prompts |
| **Testing Engine** | [Vitest](https://vitest.dev/) / [Testing Library](https://testing-library.com/) | `^2.1.8` / `^16.1.0` | Unit, integration, vector, and component testing |
| **In-Memory Storage Mock** | [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB) | `^6.0.0` | Headless IndexedDB test environment |
| **Architectural Linting** | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) | `^16.9.0` | Strict validation of layered module import rules |

---

## 3. Project Structure

The project strictly follows a layered architectural separation:

```
NetScape/
├── docs/                               # Authoritative canonical project documentation
│   ├── SYSTEM_ARCHITECTURE.md          # Architecture specification (v1.3 baseline)
│   ├── DATA_MODEL_AND_CONTRACTS.md     # Frozen data contracts and engine schemas (v1.2)
│   ├── DEVELOPMENT_ROADMAP.md          # Roadmap and phase breakdown (Phases 0–4)
│   ├── DEVELOPMENT_CONTRACTS.md        # Process, ownership, and merge gate rules
│   ├── UI_UX_SPECIFICATION.md          # User interface design rules and layouts
│   ├── DEMO_GUIDE.md                   # 9-step viva demonstration walkthrough script
│   ├── RELEASE_NOTES.md                # Release candidate specifications (v1.0.0-rc1)
│   └── PHASE_*_COMPLETION_REPORT.md    # Formal verification reports for Phases 1 to 4
│
├── public/                             # Static PWA assets, icons, and web manifest
├── dist/                               # Production build bundle output (from `npm run build`)
│
├── src/                                # Application source code
│   ├── app/                            # Root application bootstrap
│   │   ├── AppShell.tsx                # Top-level shell with nav header, offline status, update toast
│   │   ├── router.tsx                  # React Router HashRouter routing configuration
│   │   ├── main.tsx                    # Main browser entry point
│   │   └── NotFound.tsx                # 404 fallback view
│   │
│   ├── contracts/                      # Frozen TypeScript interfaces and data contracts (NO internal imports)
│   │   ├── domain.ts                   # Core entities (Project, Design, Device, Link, Subnet, Obstacle)
│   │   ├── storage.ts                  # Repository interfaces and transaction specifications
│   │   ├── engines.ts                  # Engine inputs, outputs, options, and hash contracts
│   │   ├── workers.ts                  # Web Worker request/response RPC protocols
│   │   └── services.ts                 # Application service interfaces
│   │
│   ├── kernel/                         # Foundational utilities (imports ONLY contracts)
│   │   ├── branded.ts                  # Nominal ID type guards (DeviceId, LinkId, etc.)
│   │   └── rounding.ts                 # Precision rounding and float safety helpers
│   │
│   ├── domain/                         # Pure domain logic and aggregate manipulation
│   │   ├── commands/applyCommand.ts    # Pure command reducer implementing 18 domain actions
│   │   ├── geo/localFrame.ts           # Conformal AEQD metric projection and distance math
│   │   ├── catalog/resolveDevice.ts    # Hardware catalogue item resolution
│   │   ├── inputBuilders/              # Pure builders transforming domain entities to engine inputs
│   │   └── comparison/compareDesigns.ts# Structural and metric difference engine between two designs
│   │
│   ├── engines/                        # Pure computational engines (imports ONLY contracts & kernel)
│   │   ├── ip/                         # RFC 1878 IPv4 & VLSM allocation engine
│   │   ├── cost/                       # CAPEX, OPEX, and TCO calculation engine
│   │   ├── coverage/                   # 2D log-distance path loss and obstacle wall loss engine
│   │   └── simulation/                 # Dijkstra shortest-path reachability and latency engine
│   │
│   ├── storage/                        # Persistence layer (IndexedDB via Dexie)
│   │   ├── database.ts                 # NetScapeDatabase Dexie v1 schema (11 tables)
│   │   ├── seed.ts                     # Hardware catalogue seeder
│   │   └── repositories/               # Concrete Dexie repository implementations
│   │
│   ├── workers/                        # Web Worker threads and client RPC bridge
│   │   ├── coverage.worker.ts          # Background coverage rasterization worker
│   │   ├── simulation.worker.ts        # Background graph simulation worker
│   │   └── WorkerClient.ts             # Cooperative cancellation and timeout-managed client
│   │
│   ├── application/                    # Application orchestration and session coordination
│   │   ├── container.ts                # Dependency injection container
│   │   ├── hashService.ts              # Web Crypto SHA-256 deterministic input hasher
│   │   ├── analysisCoordinator.ts      # Cache-aware analysis executor and freshness manager
│   │   ├── session/                    # Serialized command queue and DesignSession implementation
│   │   └── services/                   # ProjectService, AddressingService, ReportService
│   │
│   ├── stores/                         # Zustand stores (transient UI and disposable projections)
│   │   ├── designStore.ts              # Active design aggregate, revision, and save status
│   │   ├── editorStore.ts              # Active tool, selection, viewport, and link-drafting state
│   │   ├── analysisStore.ts            # Cached engine results and background worker progress
│   │   └── prefsStore.ts               # Local user preferences (grid snap, metric/imperial, dark theme)
│   │
│   ├── services/                       # External service adapters
│   │   ├── geocoding/                  # Nominatim geocoder with 1 req/sec rate limiting and offline fallback
│   │   └── map/TileSourceConfig.ts     # OpenStreetMap and CartoDB Dark Matter tile source providers
│   │
│   ├── features/                       # UI feature modules (views, docks, inspectors, modals)
│   │   ├── projects/                   # Projects dashboard, creation modal, and demo loader
│   │   ├── map/                        # Leaflet MapCanvas, controls, and raster overlay
│   │   ├── designer/                   # DevicePalette, DeviceInspector, LinkInspector, modals
│   │   ├── topology/                   # ReactFlow logical network diagram canvas
│   │   ├── addressing/                 # Subnet planning and VLSM allocation workstation
│   │   ├── cost/                       # BOM summary, TCO breakdown, and SVG cost distribution chart
│   │   ├── coverage/                   # Right contextual dock for RF parameter tuning and execution
│   │   ├── simulation/                 # Path reachability, bottleneck analysis, and failure injection
│   │   ├── comparison/                 # Side-by-side design comparison workspace
│   │   ├── reports/                    # 9-section report preview, canvas schematics, and A4 PDF export
│   │   └── shell/                      # Header navigation, offline indicator, and update toast
│   │
│   ├── demo/                           # Reference demonstration fixtures
│   │   └── demoProject.ts              # Deterministic IISc Science Quad campus project fixture
│   │
│   └── components/, hooks/, lib/       # Shared UI primitives, custom hooks, and Tailwind helpers
│
└── tests/                              # Automated test suite
    ├── vectors/                        # Canonical mathematical test vectors (RFC 1878, Dijkstra, RF)
    ├── fixtures/                       # Test data structures
    ├── support/                        # In-memory storage and PWA registration mocks
    ├── unit/                           # Unit tests for domain, storage, engines, workers, features
    ├── integration/                    # Multi-component integration tests (vertical slice, analyses)
    └── e2e/                            # Placeholder for future browser end-to-end tests (currently empty)
```

---

## 4. Current Project Status

### Phase Completion Summary
- **Phase 0 — Setup & Environment:** Completed. Repository infrastructure, tooling, strict TypeScript settings, test runner, and dependency-cruiser validation established.
- **Phase 1 — Parallel Core Implementation:** Completed. Pure domain commands, AEQD projection math, Dexie schema and repositories, all 4 computational engines, Web Worker bridge, and canonical test vectors verified.
- **Phase 2 — Application, Map & Topology Vertical Slice:** Completed. Bidirectional synchronization between Leaflet map workspace, device/link authoring, obstacle drawing, and ReactFlow logical topology.
- **Phase 3 — Analysis Modules & Design Comparison:** Completed. IPv4/VLSM planner, Cost/TCO estimator, Coverage raster overlay, Dijkstra simulation with failure injection, and multi-design comparison.
- **Phase 4 — Reporting, Offline Hardening & Release Preparation:** Completed. 9-section engineering report with pure 2D canvas schematics, local A4 PDF download, PWA offline caching, storage safety recovery (`clearDerivedCache`), and deterministic DEMO project fixture.

### Git Repository State
- **Current Branch:** `main` (both `main` and `integration` point to the identical release commit `c3b12de`).
- **Latest Commit:** `c3b12ded41a3cdfd87558f03544f375df82d8915` (`c3b12de`)  
  *Subject:* `F` (clean working tree following Phase 4 completion commits `e7e67e1` *"MVP Build complete"* and `bdcf170` *"feat(phase4): complete engineering reports, offline pwa, hardening, and release preparation"*).
- **Working-Tree Status:** **Clean** (only untracked `HANDOVER.md` present; no uncommitted changes to codebase).

---

## 5. How to Run

### Prerequisites
- **Node.js:** `v24.x LTS` or higher (`.nvmrc` specifies `24.22.2`; tested and working on `v26.13.0`).
- **npm:** `v11.x` or higher (tested on `12.2.1`).
- **Browser:** Chromium-based browser (Chrome/Edge/Brave `115+`), Firefox `115+`, or Safari `16.4+`.

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start local development server (with HMR)
npm run dev
# Server starts at http://localhost:5173

# 3. Run full verification suite (typecheck, lint, vitest tests, dependency rules)
npm run check

# 4. Build for production (TypeScript compile + Vite build)
npm run build
# Output written to dist/

# 5. Run full build & verification pipeline
npm run check:full

# 6. Preview production build locally
npm run preview
# Preview server starts at http://localhost:4173

# 7. Run individual checks
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run (161 unit & integration tests)
npm run deps:check   # depcruise src --config .dependency-cruiser.cjs
```

---

## 6. Core Features Breakdown

### 6.1 Geographical Map Workspace
- **True Metric Coordinate Frame:** Projects WGS84 coordinates into an Azimuthal Equidistant (AEQD) Euclidean plane centered at the project origin. Link lengths and RF distances are calculated in true meters, completely avoiding Web Mercator distortion.
- **Interactive Equipment Placement:** Drag-and-drop or click-to-place Routers, Switches, Access Points, and Servers.
- **Physical Link Authoring:** Connect devices with single-mode fiber, multi-mode fiber, Cat6 copper, or point-to-point wireless. Medium rules and port capacities are validated.
- **Obstacle Polygons:** Draw custom building footprints using Geoman. Obstacles carry material-specific RF attenuation (concrete: 14 dB, brick: 8 dB, drywall: 4 dB, glass: 2 dB).
- **Graceful Offline Map Fallback:** If internet access is lost or tile servers fail, the map seamlessly falls back to a neutral dark engineering grid canvas without blocking edits.

### 6.2 Logical Topology Editor
- **Dual-View Independence:** View devices and links in a hierarchical, interactive node-link graph powered by ReactFlow.
- **Zero Coordinate Corruption:** Moving nodes in the logical topology updates presentation coordinates only; geographical GPS positions and metric cable lengths remain untouched.

### 6.3 IPv4 Addressing & VLSM Subsystem
- **RFC 1878 Conformance:** Configurable parent CIDR block (e.g., `10.0.0.0/16`). Allocates subnets in descending host requirement order to minimize address wastage.
- **Utilization Cards:** Real-time visibility into requested hosts, assigned addresses, wasted addresses, and subnet count.
- **Invalidation Tracking:** Any topology or subnet modification invalidates the current allocation, marking it out of date.

### 6.4 Bill of Materials & Cost Analysis
- **CAPEX, OPEX & TCO:** Deterministic calculation of hardware costs, cabling costs, termination labour, civil conduit installation, and continuous energy consumption over 1 to 10 years.
- **Partial-Estimate Semantics:** Incomplete configurations display *"Not configured / incomplete"* while preserving known subtotals (never fabricating ₹0).
- **SVG Distribution Chart:** Zero-dependency SVG stacked distribution bar chart visualizing category breakdowns.

### 6.5 Wireless Coverage & RF Propagation
- **2D Log-Distance Path Loss Model:** Computes free-space path loss combined with cumulative obstacle wall boundary crossing penalties.
- **Web Worker Offloading:** 40×40 and 100×100 raster grids are computed off-main-thread with cooperative cancellation and real-time progress reporting.
- **Raster Heatmap Overlay:** Heatmap is rendered to an off-screen HTML5 `<canvas>` and projected directly onto Leaflet via `L.imageOverlay`.
- **5-Class Signal Distribution:** Classifies signal into Excellent (> -65 dBm), Good (-65 to -75 dBm), Fair (-75 to -85 dBm), Poor (-85 to -95 dBm), and Dead Zones (< -95 dBm).

### 6.6 Network Simulation & Failure Scenarios
- **Dijkstra Shortest-Path Forwarding:** Graph-theoretic routing calculating end-to-end paths, bottleneck link bandwidth, and latency breakdowns (propagation + transmission + hop processing delays).
- **Failure Injection:** Interactively sever links or take down nodes to test network resilience, reachability, and disconnected subnets.

### 6.7 Design Comparison
- **Objective Multi-Design Deltas:** Side-by-side comparison between baseline and alternate designs within the same project. Highlights differences in inventory, cable runs, budget, coverage, and network throughput with direction-aware badges (*better*, *worse*, *neutral*).

### 6.8 Engineering Reports & PDF Export
- **9-Section IEEE/Enterprise Format:**
  1. Cover & Project Summary
  2. Equipment Inventory & Interconnects Table
  3. Schematic Geographical Figure
  4. Logical Topology Schematic
  5. IPv4 Subnet Allocation & IP Plan
  6. Bill of Materials & Cost Breakdown
  7. Wireless Coverage Assessment
  8. Network Performance & Simulation Assessment
  9. Engineering Assumptions & Disclaimers
- **Synthetic Vector Schematics:** Figures 2, 3, and 4 are drawn directly from domain geometry using HTML5 2D canvas renderers; live Leaflet map tiles are **never** screenshotted.
- **Freshness Transparency:** Each analysis section displays a status pill (`[Current]`, `[Computed on an earlier version]`, or `[Not computed]`), eliminating ambiguity regarding data staleness.

### 6.9 Deterministic DEMO Project Fixture
- Available directly from the projects dashboard via the **"Load Demo Project"** button.
- Instantiates a reference IISc Science Quad campus network complete with boundary, obstacles, 6 devices, 5 links, 3 subnets, and pre-computed cost, coverage, and simulation analyses.

---

## 7. Architecture Rules & Invariants

Incoming engineers must preserve these foundational architectural rules:

1. **Local-First Authority:** Dexie/IndexedDB is the sole source of truth for persisted data. Zustand stores hold only transient UI state and disposable session projections.
2. **Commit-Then-Project Pattern:** Every user edit must dispatch a command to `DesignSession`, which writes to Dexie inside an atomic transaction, updates revision numbers, and then projects the resulting aggregate into Zustand.
3. **Sacred Authored Data:** User-authored projects, designs, devices, links, subnets, and obstacles are **sacred and must never be deleted** to free up disk space.
4. **Quota Pressure Recovery:** The `clearDerivedCache` routine purges only reproducible analysis caches (`analysisCache`) and binary raster blobs (`analysisBlobs`). It leaves 100% of authored data intact.
5. **Optimistic Concurrency Protection:** Multi-tab editing is guarded by revision expectations. If another tab commits a change, concurrent commits are rejected with a typed `StorageError` (`REVISION_CONFLICT`).
6. **Pure Computational Engines:** All code in `src/engines/` must be 100% pure TypeScript. Zero imports of React, DOM, Dexie, Zustand, `Date.now()`, or `Math.random()`.
7. **Metric Plane Isolation:** Engines never consume WGS84 latitude/longitude or Web Mercator pixels. All spatial projections happen in `domain/inputBuilders` using the project's local AEQD frame in meters.
8. **Cache Keying by Input Hash:** Derived analysis results are keyed by a deterministic SHA-256 hash of their inputs, never by timestamps. When design geometry or parameters change, the hash changes, and the cache automatically reflects staleness.
9. **Architectural Dependency Boundaries:** Enforced automatically by `.dependency-cruiser.cjs`:
   - `src/contracts/` cannot import any other internal directory.
   - `src/kernel/` can only import `src/contracts/`.
   - `src/domain/` cannot import engines, storage, workers, stores, services, or UI.
   - `src/engines/` can only import `src/contracts/` and `src/kernel/`.
   - `src/storage/` can only import `src/contracts/`.
   - `src/features/` cannot import storage, workers, or engines directly (must go through application services and Zustand stores).

---

## 8. Known Limitations & Verification Status

### Distinction Between Automated Tests and Browser Verification
- **Automated Test Evidence (Verified):**
  - **161 unit & integration tests** across 23 test files pass 100% in Vitest (`npm run test`).
  - Tests run in a headless Node environment with `jsdom` and `fake-indexeddb`.
  - Full domain command logic, Dexie repository ACID operations, all 4 analysis engines, input builders, worker client protocols, report model assembly, and demo fixture generation are completely verified by automated tests.
- **Independent Browser Verification (Manual Viva Walkthrough):**
  - Real browser behaviors (interactive Leaflet map panning/zooming, Geoman polygon drawing, Web Worker thread spawning, off-screen canvas rendering, PDF file blob downloading, and Service Worker offline caching) have been verified manually in Chrome, Edge, and Firefox using the 9-step script in [DEMO_GUIDE.md](file:///home/sanjeet/Projects/NetScape/docs/DEMO_GUIDE.md).
  - `tests/e2e/` is currently unpopulated (no automated Playwright/Cypress suite exists yet). Automated end-to-end browser verification remains an open engineering item.

### Documented Non-Blocking Linter Warnings
- Running `npm run lint` reports **0 errors and 4 warnings** in [MapCanvas.tsx](file:///home/sanjeet/Projects/NetScape/src/features/map/MapCanvas.tsx):
  - Lines 227, 439, 483, 562: `react-hooks/exhaustive-deps` warning regarding `aggregate` and `viewport` dependencies in Leaflet container initialization hooks. These are intentionally constrained to prevent infinite re-rendering loops during map interactions.

### Production Bundle Chunk Warning
- Running `npm run build` notes that `dist/assets/index-ByNHr2Xd.js` is ~1.16 MB (exceeds Rollup's default 500 kB advisory limit). Vendor chunks (`vendor-pdf`, `vendor-leaflet`, `vendor-db`, `vendor-icons`) are already split, but top-level routes currently load synchronously.

### Explicitly Deferred MVP Features (Do Not Build Without Prior RFC)
- User authentication, login accounts, and multi-tenant databases.
- Cloud synchronization or remote REST/GraphQL backends.
- Automatic OpenStreetMap building footprint auto-import (all obstacles must be drawn or loaded from fixtures).
- 3D RF ray-tracing, multipath reflections, Fresnel zone clearance, and co-channel interference modeling.
- Packet-level discrete-event simulation (ns-3), dynamic routing protocols (OSPF/BGP), and M/M/1 queuing.
- Real-time distributor pricing API lookups.
- Bulk offline map tile pack scraping (prohibited by OSM Tile Usage Policy).

---

## 9. Important Documentation Reference

Before modifying the codebase, consult these canonical documents:

| Document | Path | Purpose |
| :--- | :--- | :--- |
| **System Architecture** | [SYSTEM_ARCHITECTURE.md](file:///home/sanjeet/Projects/NetScape/docs/SYSTEM_ARCHITECTURE.md) | Authoritative architecture v1.3: layers, data flow scenarios, and invariants |
| **Data Model & Contracts** | [DATA_MODEL_AND_CONTRACTS.md](file:///home/sanjeet/Projects/NetScape/docs/DATA_MODEL_AND_CONTRACTS.md) | Frozen data contracts v1.2: database schemas, command shapes, engine I/O |
| **Development Contracts** | [DEVELOPMENT_CONTRACTS.md](file:///home/sanjeet/Projects/NetScape/docs/DEVELOPMENT_CONTRACTS.md) | Module ownership rules, import restrictions, and integration gate criteria |
| **Development Roadmap** | [DEVELOPMENT_ROADMAP.md](file:///home/sanjeet/Projects/NetScape/docs/DEVELOPMENT_ROADMAP.md) | Historical phase breakdown (Phases 0–4) and milestone scopes |
| **UI/UX Specification** | [UI_UX_SPECIFICATION.md](file:///home/sanjeet/Projects/NetScape/docs/UI_UX_SPECIFICATION.md) | Workspace layouts, color palettes, visual hierarchies, and interaction patterns |
| **Viva Demo Guide** | [DEMO_GUIDE.md](file:///home/sanjeet/Projects/NetScape/docs/DEMO_GUIDE.md) | Step-by-step 9-stage examination script with anticipated Q&A |
| **Release Notes** | [RELEASE_NOTES.md](file:///home/sanjeet/Projects/NetScape/docs/RELEASE_NOTES.md) | v1.0.0-rc1 system requirements, compatibility, and scope limits |
| **Phase 4 Completion Report** | [PHASE_4_COMPLETION_REPORT.md](file:///home/sanjeet/Projects/NetScape/docs/PHASE_4_COMPLETION_REPORT.md) | Detailed verification log for reporting, offline PWA, and hardening |

---

## 10. Next Steps for Incoming Teammate

Follow this priority list to get started:

### Priority 1: Environment Sanity Check (First 30 Minutes)
1. Run `npm install` and verify dependencies resolve cleanly.
2. Run `npm run check:full` and confirm that all 161 tests pass, 0 typecheck errors occur, and 0 dependency violations exist.
3. Start the local preview server (`npm run preview`) and open `http://localhost:4173`.
4. Click **"Load Demo Project"** and verify that the IISc Science Quad campus loads cleanly.

### Priority 2: Familiarization via Viva Walkthrough (Day 1)
1. Open [DEMO_GUIDE.md](file:///home/sanjeet/Projects/NetScape/docs/DEMO_GUIDE.md).
2. Step through all 9 demonstration stages in your browser (Map Workspace -> Device Placement -> Topology -> VLSM -> Cost -> Coverage -> Simulation -> Comparison -> PDF Report).
3. Open Chrome DevTools, toggle **Network -> Offline**, and verify that the application operates fully without internet.

### Priority 3: Automated End-to-End (E2E) Browser Testing (High Value)
- Configure [Playwright](https://playwright.dev/) in `tests/e2e/` to automate the manual verification checklist:
  - Automate loading the demo project.
  - Automate drawing an obstacle and placing a device.
  - Automate verifying coverage worker calculation and PDF download blob creation in a live browser.

### Priority 4: Route-Level Code Splitting (Bundle Optimization)
- In `src/app/router.tsx`, convert heavy feature views (`ReportView`, `SimulationView`, `ComparisonView`, `MapWorkspaceView`) to use dynamic `React.lazy()` imports.
- This will reduce the primary `dist/assets/index-*.js` chunk from ~1.16 MB to under Rollup's 500 kB threshold.

### Priority 5: MapCanvas Linter Cleanliness
- Review the 4 React Hook `useEffect` dependency warnings in [MapCanvas.tsx](file:///home/sanjeet/Projects/NetScape/src/features/map/MapCanvas.tsx#L227) and refactor the hook dependencies using `useRef` or callback memoization so `npm run lint` reports 0 warnings.

### Priority 6: Post-MVP Feature Explorations
- Evaluate implementing an offline project JSON export/import feature to allow transferring designs between different browsers without cloud accounts.
- Implement undo/redo UI controls over the existing `designSession` command journal.
