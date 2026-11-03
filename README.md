# NetScape

> Smart Map-Based Network Infrastructure Planning Workstation

NetScape is a desktop-first, local-first map-based network infrastructure planning workstation for a college Data Communication and Computer Networks (DCCN) project. It runs entirely in the browser with no backend service, persisting project data in IndexedDB (Dexie) and executing heavy computations (coverage and simulation) in native Web Workers.

## Canonical Project Specifications

The authoritative project baseline consists of six frozen specifications in the `docs/` directory:

1. [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md) — System Architecture (v1.3)
2. [`docs/UI_UX_SPECIFICATION.md`](docs/UI_UX_SPECIFICATION.md) — UI/UX Specification (aligned to v1.3)
3. [`docs/DATA_MODEL_AND_CONTRACTS.md`](docs/DATA_MODEL_AND_CONTRACTS.md) — Data Model and Contracts (v1.2)
4. [`docs/DEVELOPMENT_CONTRACTS.md`](docs/DEVELOPMENT_CONTRACTS.md) — Development Contracts & Workflow (v1.2)
5. [`docs/DEVELOPMENT_ROADMAP.md`](docs/DEVELOPMENT_ROADMAP.md) — Development Roadmap (v1.2)
6. [`docs/AGENT_TASKS.md`](docs/AGENT_TASKS.md) — Multi-Agent Role Assignments & Ownership

## Prerequisites

- **Node.js:** Node 24 LTS (`v24.x`)
- **Package Manager:** npm

## Local Setup

```bash
# Install dependencies from locked manifest
npm ci

# Start local development server with Vite
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

## Available Verification Scripts

The following normative scripts are configured to enforce code quality, architectural boundaries, and test integrity:

- `npm run typecheck` — Runs TypeScript compiler checks without emitting output (`tsc --noEmit`).
- `npm run lint` — Runs ESLint across TypeScript and TSX files.
- `npm test` — Executes automated unit and component test suites with Vitest.
- `npm run deps:check` — Mechanically checks architectural layer boundaries and circular dependency rules with `dependency-cruiser`.
- `npm run check` — Comprehensive static and test gate running `typecheck`, `lint`, `test`, and `deps:check`.
- `npm run check:full` — Full validation gate running `check` followed by the production `build`.

## Phase 0 Foundation Status

Phase 0 establishes the single Vite React TypeScript repository, strict typing, Tailwind CSS + shadcn conventions with locked brand colours, hash-router route skeleton, PWA precache configuration, Vitest + React Testing Library harness, dependency-boundary checks, shared contract exports, and test-only repository fake seams. Full MVP features and persistence will be implemented in Phase 1+.
