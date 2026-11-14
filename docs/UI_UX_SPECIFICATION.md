# NetScape — UI/UX Specification

**Document:** `UI_UX_SPECIFICATION.md`  
**Product:** NetScape — Smart Map-Based Network Infrastructure Planning Platform  
**Specification type:** Text-only product design and implementation specification  
**Target:** Desktop-first React + TypeScript application  
**Design baseline:** Concept A — Integrated Engineering Workbench: Carbon `#121218`, Dark Slate `#242430`, Electric Violet `#A78BFA`, Soft White `#EAEAF2` (Superseding legacy prototype tokens)  
**Architecture authority:** `SYSTEM_ARCHITECTURE.md`, MVP architecture baseline v1.3  
**Product brief:** `NetScape_Project_Plan_Updated.docx`

---

## 0. Document Authority and Scope Reconciliation

This document defines the UI structure, navigation, interaction model, visual system and user-facing states for the NetScape MVP. It is a design and implementation contract for the application interface. It does not replace the system architecture, domain model, engine contracts or development contracts.

### 0.1 Source precedence

Use the following precedence when implementing the interface:

1. `SYSTEM_ARCHITECTURE.md` v1.3 owns system behaviour, architecture and locked MVP defaults.
2. `DATA_MODEL_AND_CONTRACTS.md`, once frozen, owns exact entity shapes, field names, enums, commands and engine/worker contracts.
3. `DEVELOPMENT_CONTRACTS.md`, once frozen, owns file ownership, import boundaries, agent workflow and integration gates.
4. `NetScape_Project_Plan_Updated.docx` supplies the product intent and DCCN use cases, but earlier ideas in it do not override the reviewed architecture baseline.
5. This document owns the UI's information hierarchy, screen composition, control behaviour and user-facing presentation, provided those decisions do not contradict the sources above.

If a required UI behaviour depends on a field or enum that is not yet frozen in the companion contracts, do not invent a new model field. Use the closest approved model concept and raise the contract gap before implementation.

### 0.2 Important resolutions

| Original plan idea or potential interpretation | MVP decision used by this specification |
|---|---|
| Offline maps / download this area | Not in MVP. Editing saved projects works offline; basemap tiles are best-effort and may be absent. Never add a tile-download control for the public OSM raster endpoint. |
| OSM building import / Overpass | Deferred. The user creates and edits obstacle polygons manually. Do not show an import button or an empty future import panel. |
| Terrain, elevation, 3-D or multi-floor coverage | Deferred. Coverage v1 uses the approved log-distance model and fixed wall-loss crossings only. |
| Automatic AP placement, network optimization or design recommendations | Deferred. Users place and connect equipment manually; Star and Tree templates are the only topology templates. |
| Packet animation / packet-level simulation | Not part of the approved simulation model. Show paths, flow outcomes and before/after scenario comparisons; do not animate packets or imply packet-level fidelity. |
| OSPF, RIP or configurable routing protocols | Deferred. The MVP uses an undirected connectivity graph and Dijkstra with non-negative link weights; default weight is one per hop. |
| Immediate background recalculation for every edit | Manual analysis runs by default. Cost is explicitly calculated through the coordinator/cache path. Coverage may optionally auto-recalculate when enabled in application preferences; that preference defaults off. Simulation is run explicitly. |
| Live Leaflet screenshot in the report | Not allowed. Reports use generated schematic geographical and logical figures with no live basemap. |
| Live supplier prices / procurement | Not supported. Four vendor-neutral built-in catalogue items and project cost assumptions use synthetic illustrative INR values, clearly labelled as samples/assumptions rather than vendor quotes. |
| IPv6 / real endpoint devices | Not in MVP. IPv4 CIDR/VLSM only; subnet host counts are numeric requirements, not individually placed endpoint nodes. |

### 0.3 Product positioning

NetScape is an engineering planning and teaching workstation. It is not a general-purpose SaaS dashboard, network controller, packet analyzer, RF survey instrument, procurement system or substitute for a professional site survey.

Every computed cost, coverage and simulation output must communicate its assumptions and estimate status. The interface must help a user understand *what was modelled*, *what input was used*, *whether the result is current*, and *what action is available next*.

---

# 1. Product Design Principles

## 1.1 Core principles

1. **Canvas first.** The geographical map is the primary work surface. The interface should make drawing, placing, connecting and inspecting network elements the dominant activities.
2. **Engineering clarity over decoration.** Dense technical information is acceptable when aligned, labelled and scannable. Avoid ornamental panels, oversized statistics and decorative charts.
3. **One design, multiple projections.** The map and logical topology are two views of the same saved `Device` and `Link` records. Neither view owns a separate network model.
4. **Predictable tools.** A tool has one active state, one visible cursor/interaction mode and one way to exit. Do not combine selection, placement and connection gestures ambiguously.
5. **Context before navigation.** Show relevant device, link, obstacle or analysis properties beside the work surface. Move to a dedicated route only when the task needs a full page or a substantial table.
6. **Immediate, honest feedback.** Every committed edit has a visible persistence state. Every analysis has a visible run, freshness and failure state.
7. **No silent assumptions.** Show units, input assumptions, model limitations, illustrative prices and stale-result labels where a decision could be misread.
8. **Offline honesty.** A saved design remains editable offline. Location search and basemap tiles may not be available. The interface must distinguish those capabilities clearly.
9. **Progressive disclosure.** Keep the common actions visible. Put advanced but approved parameters behind an expandable section rather than displaying every numeric field at once.
10. **Low-friction engineering workflow.** Prefer direct manipulation, dense tables and keyboard-accessible tool controls over multi-step forms for routine edits.

## 1.2 Design characteristics

| Characteristic | Required behaviour |
|---|---|
| Information density | Medium-high. Use compact rows, short labels, aligned numeric columns and grouped properties. Do not compress text to unreadable sizes. |
| Navigation | Stable global navigation plus project-specific navigation. Current project, design and view remain identifiable. |
| Surfaces | Flat, dark, restrained surfaces separated by subtle borders. Use cards only for a real grouping or summary. |
| Feedback | Inline field validation for inputs; compact toast for completed or failed actions; persistent banners only for app-wide conditions. |
| Charts | Use only where they explain a real relationship: CAPEX breakdown, comparison deltas, RSSI distribution or simulation outcomes. |
| Empty space | The central canvas may be visually open because it is a working surface. Other screens should use deliberate tables and panels, not large empty hero areas. |
| Motion | No decorative animation. Use short, functional transitions only for opening/closing panels, changing routes and revealing progress. Respect reduced-motion preferences. |
| Destructive actions | Confirm deletion and show exactly what dependent records will be removed or detached. Never imply undo/redo exists. |

## 1.3 Main user journey

The default journey is:

1. Create a project and identify a real geographical area.
2. Open the generated baseline design.
3. Draw the planning boundary and any required manual obstacles.
4. Place routers, switches, access points and servers on the map.
5. Create wired or wireless connections where the approved link contract permits them.
6. Inspect and correct device/link properties and design validation issues.
7. Switch to logical topology to organise the same devices and connections into a readable network diagram.
8. Create IPv4 subnets and allocate address blocks with VLSM.
9. Calculate the cost estimate.
10. Configure and run wireless coverage analysis.
11. Configure flows and failure scenarios, then run the simplified network simulation.
12. Duplicate the design to explore a different architecture and compare it with the baseline.
13. Preview and download a PDF report.

The UI should make this journey discoverable, but it must not force users through a locked wizard. Experienced users can move directly to any available workspace route.

---

# 2. Visual System

## 2.1 Approved Visual Identity — Concept A: Integrated Engineering Workbench

The visual identity of NetScape embodies a focused, professional engineering environment: **Carbon & Electric Violet**. The aesthetic replaces low-contrast blue tones with deep, authoritative carbon surfaces, structured slate planes, and high-precision Electric Violet accents.

### Core Palette Tokens

| Token | CSS Variable | Hex | Role |
|---|---|---|---|
| `carbon-deep` | `--color-carbon-deep` | `#0B0B10` | Deepest canvas background, embedded diagram wells, and sunken panels. |
| `carbon` | `--color-carbon` | `#121218` | Primary application and editor work surface background. |
| `slate-dark` | `--color-slate-dark` | `#1A1A24` | Primary elevated surfaces: header bars, tab rails, tool rails, and cards. |
| `slate-surface` | `--color-slate-surface` | `#242430` | Interactive panels, inspector bodies, modal containers, and inputs. |
| `slate-elevated` | `--color-slate-elevated` | `#30303D` | Dropdowns, popovers, active card borders, and hover states. |
| `slate-muted` | `--color-slate-muted` | `#858596` | Secondary labels, units, non-interactive metadata, and breadcrumbs. |
| `violet` | `--color-violet` | `#A78BFA` | **Primary brand & interaction accent**: active nav, selected entities, primary buttons, focus rings. |
| `violet-hover` | `--color-violet-hover` | `#B9A4FF` | Interactive hover state for violet actions and focus outlines. |
| `violet-tint` | `--color-violet-tint` | `rgba(167, 139, 250, 0.12)` | Subtle selection background fills, active nav pills, and table row highlights. |

### Semantic Colours

Semantic colors convey analytical meaning and must never conflict with or mimic brand violet:

| Token | Hex | Role / Meaning |
|---|---|---|
| `status.success` | `#10B981` (Emerald) | Saved state, valid topology, reachable flows, 100% test passing, positive comparison delta. |
| `status.warning` / `status.stale` | `#F59E0B` (Amber) | Validation warnings, near-capacity links, out-of-date analysis cache, offline status pill. |
| `status.error` | `#EF4444` (Rose) | Storage write failures, validation errors, unreachable flows, calculation exceptions. |
| `status.info` | `#38BDF8` (Sky Blue) | Informational badges, secondary comparison design B, active progress. |

### Contrast and Hierarchy Guidelines

- Dark Carbon surfaces (`#121218`) provide high contrast with Soft White primary text (`#EAEAF2`).
- Violet (`#A78BFA`) delivers a 6.2:1 contrast ratio against Carbon backgrounds, exceeding WCAG AA requirements for normal text and graphical UI components.
- Subdued hairline borders (`#2A2A38` subtle, `#3D3D4E` strong) delineate dense panels without heavy visual noise or ornamental drop shadows.
- Map canvas features a dark CAD-style engineering grid (`radial-gradient(#2A2A38 1px, transparent 1px)`) when offline or before basemap tiles load.

## 2.5 Typography

Use a compact, technically legible type system. Recommended families:

- **UI and body:** Noto Sans, with a dependable system sans-serif fallback.
- **Numerical and technical values:** Noto Sans Mono or an equivalent tabular monospace family.

Do not use a display face for headings. Avoid ultra-light weights. Use tabular numerals for IP addresses, CIDR blocks, prices, distances, RSSI, latency, throughput and table columns so values align.

| Style | Size / line height | Weight | Typical use |
|---|---:|---:|---|
| Page heading | 20 / 28 px | 600 | Project/design/module title. |
| Panel heading | 15 / 22 px | 600 | Inspector section and dock title. |
| Body | 14 / 20 px | 400 | Main interface text and form labels. |
| Compact body | 13 / 18 px | 400–500 | Dense table rows, menu items and helper text. |
| Metadata | 12 / 16 px | 400 | Status, units, timestamps, secondary details. |
| Numeric value | 13–14 / 20 px | 500 | Technical values; use tabular numerals. |
| Button label | 13 / 18 px | 600 | Primary and secondary actions. |

Avoid body text below 12 px. Do not use all-caps for paragraphs or long labels. Short section labels may use uppercase only where it improves scanning.

## 2.6 Spacing, shape and icon rules

- Use a 4 px base spacing scale: 4, 8, 12, 16, 20, 24 and 32 px.
- Default control height: 32 px for dense toolbars and tables; 36 px for primary form controls; 40 px for prominent modal actions.
- Default panel padding: 16 px; dense inspector sections may use 12 px.
- Use 1 px borders. Use 4–6 px corner radii for buttons and inputs, 6–8 px for larger panels/dialogs. Do not use pill-shaped controls as the default.
- Use Lucide icons consistently at 16 px for dense controls and 18 px for primary toolbar actions. Icon-only controls require a tooltip and accessible name.
- Keep icon stroke weight consistent. Do not mix filled and outline icon systems arbitrarily.
- Avoid large shadows, gradients, blurred glass surfaces and glow effects.

---

# 3. Information Architecture

## 3.1 Global structure

NetScape has two contexts:

- **Application context:** project list, device catalog and application settings.
- **Project/design context:** one project containing one or more alternative designs. Each design has map, topology, addressing, cost, simulation and report views.

The project is the container for the geographical region, obstacles and project-level settings. The design contains the alternative network arrangement, devices, links, subnets, logical layout and simulation setup. Map and topology are different views of the same design records.

## 3.2 Route structure

Use the routes defined by the approved architecture and its `createHashRouter` decision. Do not invent a second navigation system.

| Route | Screen | Primary purpose |
|---|---|---|
| `/` | Projects | Find, create, open, duplicate or delete a project. |
| `/catalog` | Device catalog | Browse built-in catalogue items and manage custom items. |
| `/settings` | Application settings | Set global UI preferences and review offline/privacy information. |
| `/projects/:projectId` | Redirect | Redirect to that project's baseline design workspace. |
| `/projects/:projectId/designs` | Project designs | View designs, duplicate a design, set baseline and start comparison. |
| `/projects/:projectId/designs/:designId/map` | Map workspace | Geographical planning, device placement, boundaries, obstacles, connections and coverage overlay. |
| `/projects/:projectId/designs/:designId/topology` | Logical topology | Arrange and inspect the same devices and links as a network diagram. |
| `/projects/:projectId/designs/:designId/addressing` | IP addressing | Configure IPv4 subnet requirements and review VLSM allocations. |
| `/projects/:projectId/designs/:designId/cost` | Cost analysis | Calculate and inspect CAPEX, OPEX and TCO. |
| `/projects/:projectId/designs/:designId/simulation` | Network simulation | Configure flows/failures and inspect simplified routing outcomes. |
| `/projects/:projectId/designs/:designId/report` | Report preview | Review the report contents and download a PDF. |
| `/projects/:projectId/compare?a=:designId&b=:designId` | Design comparison | Compare two saved designs, defaulting the first selection to the baseline. |

Coverage is not a separate top-level route in the MVP. Its configuration, run state and results are presented in the map workspace's right-side dock, and its raster is rendered as an optional map overlay.

## 3.3 Navigation Hierarchy & Workspace Grouping

NetScape groups project routes into four engineering stages that match the infrastructure planning lifecycle:

1. **DESIGN**
   - **Map** (`.../map`): Geographical canvas, obstacle authoring, device placement, boundary management, connection drawing, and live RF signal overlay.
   - **Topology** (`.../topology`): Pure logical network diagram (ReactFlow) showing device hierarchy, link types, ports, and parent relationships with layout persistence.
   - **Split View**: Synchronized side-by-side view combining geographical map (left) and logical topology (right) with unified selection and viewport sync.

2. **PLAN**
   - **Addressing** (`.../addressing`): IPv4 subnet requirements, CIDR validation, and deterministic VLSM address allocations.
   - **Cost** (`.../cost`): CAPEX, annual OPEX, and multi-year TCO estimation with currency formatting (INR ₹) and interactive category breakdowns.

3. **ANALYSE**
   - **Coverage** (Integrated dock in Map): Best-server RSSI calculation, 5-class RF raster visualization, dead-zone perimeter reporting, and log-distance parameters.
   - **Simulation** (`.../simulation`): Simplified Dijkstra network reachability, bottleneck link analysis, latency modeling, and node/link failure scenario comparison.

4. **DELIVER**
   - **Compare** (`/projects/:projectId/compare`): Side-by-side structural diff, CAPEX/OPEX deltas, RF coverage comparison, and simulation trade-off analysis.
   - **Report** (`.../report`): Comprehensive engineering document preview and client-side vector PDF generation with schematic figures and readiness checklists.

## 3.4 Persistent Context

Whenever the user is inside a project, the Workbench Header displays:

- Project name breadcrumb.
- Active design name and baseline status.
- Design switcher and duplication action.
- Autosave persistence state (`Saved`, `Saving…`, `Save error`).
- Network connectivity state (`Online` / `Offline`).
- Global command palette trigger (`Ctrl/Cmd + K`).

The active project's design selector is one click away without returning to the projects list.

---

# 4. Workbench Shell Architecture

The Integrated Engineering Workbench shell provides a persistent, cohesive environment across all workspaces:

## 4.1 Two-Row Workbench Header (`WorkbenchHeader.tsx`)
- **Top Row (Application Bar - 44px)**:
  - NetScape brand icon and project breadcrumb.
  - Active design selector dropdown with baseline indicator and one-click duplication.
  - Centered Command Palette quick trigger (`Ctrl/Cmd + K`).
  - Real-time persistence status (`Saved`, `Saving...`, `Save error`).
  - Network connectivity badge (`Online` / `Offline`).
  - Project Engineering Settings modal trigger.
- **Bottom Row (Grouped Workspace Bar - 40px)**:
  - Labeled workspace groups: DESIGN, PLAN, ANALYSE, DELIVER.
  - High-visibility Electric Violet active indicators and hover states.
  - Real-time stale status warning dots on Cost, Coverage, and Simulation when upstream design changes occur.

## 4.2 Bottom Analysis Status Strip (`AnalysisStatusStrip.tsx`)
A persistent 36px bottom status bar rendered across design and analysis screens:
- Real-time analysis status pills for Cost, Coverage, and Simulation (Current / Stale / Not Run / Running).
- Intelligent, contextual "Next Action" recommendation (e.g. "Coverage stale — recalculate RF propagation", "Cost estimate not generated").
- Expandable details drawer showing breakdown metrics, run timestamps, and direct calculation triggers.

## 4.3 Shared Workbench Inspector (`WorkbenchInspector.tsx`)
A unified right-hand inspection drawer (320px) shared across Map and Topology:
- Tabbed interface supporting **Device**, **Link**, and **Coverage** inspection.
- Device inspection: Type, name, catalog item, position (Lat/Lng or Local X/Y), IP configuration, and connected links.
- Link inspection: Medium (copper, fiber, wireless), endpoints, length, bandwidth capacity, and attenuation.
- Coverage tab: Direct parameter tuning, calculation dispatch, and signal raster controls without modal popups.

## 4.4 Command Palette (`CommandPalette.tsx`)
- Accessible via keyboard shortcut `Ctrl+K` or `Cmd+K` anywhere in the application.
- Quick navigation across all 8 workspace views.
- Direct execution of common actions: Calculate Cost, Run Coverage, Open Settings, Load Demo Project, Export PDF.
- Search filtering, keyboard arrow navigation, Enter selection, and Escape dismissal.
- **Save failed:** persistent visible error state until resolved; explain that the latest edit was not committed. The previous committed projection remains visible.
- **Offline:** small header badge. It is informational, not a full-width alert unless the current action needs the network.
- **Update available:** non-blocking banner with “Reload” action. Never force a reload during active editing or computation.
- **Basemap unavailable:** shown inside the map surface, not as an application-wide blocking error.

## 4.4 Global empty state

On first run, the Projects page displays a compact empty state: “No projects yet”, one sentence explaining that projects are stored locally, and a primary “Create project” action. Do not show sample project statistics or a fake activity feed. A sample/demo project may only be provided if it is explicit authored seed data and is clearly labelled as a sample; it is not required by this specification.

---

# 5. Screen-by-Screen Specifications

## 5.1 Projects screen (`/`)

### Purpose

The landing screen is a project file browser, not a conventional analytics dashboard. It gives users a direct path to their saved work.

### Layout and hierarchy

- Page heading: “Projects”.
- Primary action aligned top-right: “New project”.
- Below the heading: a single compact search field and sort control.
- Main region: a dense table/list of projects, sorted by `lastOpenedAt` descending.
- No KPI cards, revenue-style charts, welcome hero or unrelated usage summaries.

Recommended table columns:

| Column | Content |
|---|---|
| Project | Name and optional short description. |
| Area | Saved region label or “Area not defined”. |
| Designs | Number of designs. |
| Baseline | Baseline design name. |
| Last opened | Human-readable date/time. |
| Actions | Open, duplicate project, rename and delete in an overflow menu. |

Row click opens the project baseline workspace. The action menu must not trigger row navigation accidentally. Project duplication must be visibly distinct from design duplication and creates a fully independent project copy.

### Primary actions

- **New project:** opens the project creation flow.
- **Open project:** opens the baseline design. If there is no baseline due to corrupted data, show a recovery error instead of silently picking a design.
- **Duplicate project:** creates an independent local deep copy of the region, obstacles, project settings and all designs in one transaction; remaps all project/design/entity IDs and internal references; retains catalogue references; preserves one baseline; and does not copy analysis caches/blobs. Ask for a new project name before committing.
- **Rename:** inline or modal edit, committed immediately.
- **Delete:** confirmation dialog names the project and explains that all its designs and project-level data will be deleted. No undo is implied.

### Search and sort

Search filters project names and saved region labels locally. It must not trigger geocoding. Sort choices should remain simple: recently opened, name and recently modified if the stored data supports it.

### States

- **Empty:** “No projects yet” + New project.
- **Loading:** compact list skeleton, not full-screen spinner.
- **Storage unavailable:** blocking error explaining that NetScape cannot safely open or save local projects in this browser session.
- **Read error:** retry action; do not show an empty state that could be mistaken for deleted data.
- **Offline:** normal project list; no warning is needed unless a user tries location search.

## 5.2 Project creation and geographical area selection

### Purpose

Create the local project, establish its initial geographical context and create the first baseline design in one action.

### Layout

Use a focused modal or two-column wizard, maximum width about 760 px. Keep it short; this is not a long onboarding flow.

**Left/primary form region (about 58% width):**

1. Project name (required).
2. Optional short description if supported by the project model.
3. Location search field with explicit Search action and Enter submission.
4. Search result list with place label and location summary.

**Right/secondary region (about 42% width):**

- Small map preview of the selected result or current map view.
- Selected area label and approximate map extent.
- Clear message that the planning boundary will be drawn after project creation.

### Behaviour

1. User enters project name.
2. User submits a location query. No autocomplete or as-you-type network requests.
3. Geocoding results appear in a selectable list. Selecting a result moves the preview map to its bounding box.
4. “Use this area” records the selected region context. If the user is already viewing a useful map area, the architecture permits using the current view instead of searching.
5. User selects “Create project”.
6. Project, region, immutable project frame, default project settings and baseline design are created transactionally. Navigate directly to the baseline design's map route.
7. If no polygon boundary exists yet, show a one-time inline task prompt in the map workspace: “Define planning boundary” with the polygon drawing tool action.

### Search constraints and offline behaviour

- Geocoding is explicit user-submitted search only.
- Respect the approved public Nominatim limit of at most one request per second; prevent duplicate requests with the service cache.
- Do not send project names, device labels, network details or other private project content as search text.
- When offline, disable location search and explain why. The user may use a valid current map view only if one exists; otherwise a new geographic search must wait for connectivity.
- Never display a fake successful search result when the geocoder is unavailable.

### Validation and errors

- Project name is required and must be trimmed.
- Search error: keep the query visible and provide Retry.
- No results: “No matching locations found.”
- Service unavailable: “Location search requires an internet connection. You can continue editing existing projects offline.”
- Project creation failure: keep the dialog open and preserve entered values; do not navigate to a project that was not committed.

## 5.3 Project designs screen (`/projects/:projectId/designs`)

### Purpose

Manage alternative network designs inside one project, identify the baseline and initiate comparisons.

### Layout

- Header with project name, area label and “Back to workspace”.
- Design table taking the main content width.
- Baseline row clearly identified with a restrained Electric Blue marker and “Baseline” label.
- Actions above the table: “Duplicate design” and “Compare”.

Suggested columns:

| Column | Content |
|---|---|
| Design | Name, optional notes. |
| Baseline | Baseline marker. |
| Devices / links | Structural counts. |
| Updated | Last modified timestamp. |
| Actions | Open, duplicate, set baseline, rename, delete. |

### Behaviour

- Opening a design opens its last-used/default map route; do not open an unrelated module.
- “Duplicate design” asks for a name, then duplicates the design with new entity IDs and remapped references. It does not copy analysis cache records.
- “Set baseline” asks for confirmation and preserves the invariant of exactly one baseline per project.
- “Compare” requires two designs. Preselect the baseline as design A and the most recently modified non-baseline design as B when possible.
- If only one design exists, comparison is unavailable with a clear explanation; do not show a non-functional compare screen.

### States

- **One design:** show baseline and a clear Duplicate design action.
- **No designs:** treat as a data-integrity error; a new project should always have a baseline design.
- **Duplicate failure:** preserve source and show typed failure message.
- **Offline:** all design-management actions remain local and usable.

## 5.4 Main network planning workspace — map (`…/map`)

This is the highest-priority screen. Its detailed specification is in Section 6. The workspace combines the global project context, device palette, geographical canvas, contextual inspector and analysis dock. The map is the primary working surface; surrounding UI must not consume more area than the task requires.

## 5.5 Logical topology workspace (`…/topology`)

Detailed in Section 7. It uses React Flow to render the same saved devices and links as the map, while persisting only abstract node layout positions when users arrange the diagram.

## 5.6 IPv4 addressing and VLSM (`…/addressing`)

### Purpose

Define subnet host requirements and allocate IPv4 address blocks within a parent network using VLSM.

### Layout

- Page heading and design context.
- Top configuration strip: parent IPv4 CIDR, validation status and “Allocate addresses” action.
- Main region: subnet allocation table, taking roughly 70% width.
- Right summary rail, roughly 30% width: total requested hosts, allocated address space, unused space/wastage and unallocated subnet count.
- Use a table rather than a set of oversized subnet cards.

### Table columns

| Column | Content |
|---|---|
| Subnet | User-defined subnet name. |
| Hosts required | Numeric host requirement. |
| Serving device | Optional device association, selected from existing devices. |
| Allocated CIDR | Resulting IPv4 network/prefix. |
| Usable capacity | Number of usable host addresses, if supplied by the engine result. |
| Wastage | Unused host capacity or address count, using the engine's exact definition. |
| Status | Allocated, unallocated or needs attention. |
| Actions | Edit or remove subnet. |

Do not fabricate exact network/broadcast/first-host/last-host values if the frozen engine contract does not provide them. If they are provided, show them in a row expansion or details inspector rather than widening the main table indefinitely.

### Primary actions

- Set parent network CIDR.
- Add subnet requirement.
- Edit subnet name and host count.
- Associate a subnet with a device when relevant.
- Allocate/recalculate VLSM.
- Review unallocated entries and reasons.

### Interaction rules

- Allocation sorts requirements by descending host need as defined by the engine. Do not ask the user to manually order the rows to influence the allocation.
- The parent CIDR and subnet requirements are authored inputs. The resulting allocation is saved as authored subnet data after validation.
- A changed host count or parent CIDR marks the displayed allocation as needing recalculation until the user runs allocation again.
- Show field-level errors for invalid CIDR and non-positive/invalid host counts.
- Keep IPv4 terminology visible; do not add IPv6 tabs or a future protocol selector.

### States

- **Empty:** explain that the user should enter a parent network and add subnet host requirements.
- **Unallocated:** show the specific reason, such as insufficient parent address space, rather than only a red icon.
- **Loading/calculating:** allocation is synchronous and small; use a short in-button progress state if needed, not a worker-style progress panel.
- **Invalid input:** preserve the user's draft and show field-level errors.
- **Offline:** fully usable.

## 5.7 Cost analysis (`…/cost`)

### Purpose

Estimate the network design's CAPEX, annual OPEX and total cost of ownership from its resolved device catalogue values, cable/link lengths and project-level assumptions.

### Layout

- Header with design name and freshness state.
- Summary row with three aligned numeric columns: CAPEX, OPEX/year and TCO for the configured horizon.
- Main left area (about 65%): cost breakdown table grouped by hardware, cabling/media, installation/civil work, labour and other supported categories.
- Right area (about 35%): one restrained breakdown chart and assumptions panel.
- Primary action: “Calculate estimate” / “Recalculate” depending on state.

Do not fill the top of the page with multiple decorative statistic cards. Treat the three totals as a compact technical summary.

### Required information

- Project currency: INR.
- CAPEX breakdown from devices, cable/fibre lengths and supported installation/civil/labour/pricing inputs.
- Annual OPEX including supported energy, tariff, maintenance/support and replacement assumptions.
- TCO horizon and total.
- Price provenance: sample or user-edited, with last-updated metadata where available.
- Clearly visible estimate disclaimer.
- Disclose the fixed 100% device nameplate power-duty ratio used for annual energy cost.
- Label initial device catalogue prices and seeded project pricing/tariff/labour/civil assumptions as illustrative defaults, not supplier quotes.
- Show a null required price/rate as “Not configured / incomplete”; show explicit ₹0 as a known zero-cost assumption. Tax rate `null` means “Tax not included” and does not make the pre-tax estimate incomplete.

### Interactions

- Cost is calculated on demand through the analysis coordinator/cache path; do not silently recompute on every keystroke or design edit.
- “Calculate estimate” checks cache first, then runs the synchronous pure cost engine if needed.
- Project-level cost assumptions are edited through Project Settings, not through per-design overrides. State clearly that changing them affects all designs in the project.
- If the design changes after calculation, keep the old result visible but badge it “Out of date”. Provide a recalculation action.
- Any seeded catalogue price must display “Sample price” or equivalent. Never label it a market quote.
- The chart must have a textual legend and data table alternative. Do not use colour-only category identification.

### States

- **Not calculated:** show the calculation action and explain which inputs feed the estimate.
- **Current:** display totals and breakdown.
- **Out of date:** retain prior result with a clear stale label; do not imply it describes the current design.
- **Missing price/spec:** identify affected catalogue items and show whether the engine used a valid fallback or blocked calculation. Never invent a price.
- **Calculation error:** preserve inputs and show retry.
- **Offline:** cost calculation works locally with the stored catalogue and project assumptions.

## 5.8 Wireless coverage analysis (map workspace right dock)

### Purpose

Estimate best-server received signal strength over the planning boundary, classify coverage and identify weak/dead zones.

### Layout

Coverage is a docked panel, not a new route. It sits in the map workspace's right contextual dock. The map remains visible so the user can configure, calculate and inspect the overlay without navigating away.

Panel sections:

1. Coverage status and freshness.
2. Parameters (common fields visible; advanced model parameters collapsible).
3. “Run coverage” action and progress/cancel state.
4. Results summary: coverage percentage at selected threshold, signal-class area/cell counts and dead-zone list.
5. Overlay controls: visibility, opacity and dead-zone display.
6. Model and estimate disclaimer.

### Parameters and defaults

- Log-distance path-loss model.
- Configurable reference loss and path-loss exponent.
- Frequency parameter only as supported by the frozen coverage contract.
- Fixed editable wall loss per polygon-boundary crossing, seeded with 2.4 GHz reference estimates; the MVP does not apply frequency scaling to wall loss.
- Grid resolution defaults to 5 m. The UI may recommend 2–3 m for small areas or coarser resolution for large areas, but must not change the user's setting silently.
- RSSI class thresholds are configurable. Show the active thresholds beside the legend.
- Coverage result is based on the strongest/best-server AP at each grid cell.

### Result presentation

Use a map image/raster overlay; do not represent the raster using thousands of individual vector shapes or a point-density heat plugin. Include a visible legend for Excellent, Good, Fair, Weak and Dead zone classes. Initial project-plan reference thresholds are −55, −67, −75 and −85 dBm; display the exact configured threshold ranges in the panel.

Show:

- Coverage percentage at the selected minimum acceptable RSSI.
- Dead-zone count/list with location or selectable map focus where available.
- Optional RSSI histogram if it adds explanatory value and is supported by the result.
- The model parameters and input context used for the run.

Do not show SINR, channel assignment, interference, multi-floor propagation, detailed simultaneous-client capacity or terrain effects in the MVP.

### Interactions

- User explicitly presses “Run coverage” by default.
- Progress shows phase and percentage where supplied by the worker; user can cancel.
- When a result is published, turn on the overlay only if the user requested it or it was already visible; do not unexpectedly obscure the planning map.
- The overlay can be toggled and its opacity adjusted without rerunning the engine.
- If an AP, boundary, obstacle or coverage setting changes, mark the result Out of date using input-hash freshness. Do not erase the previous raster immediately; keep it available only with the stale label.
- Optional auto-recalculate coverage is a global preference, defaults off and must never trigger during a drag gesture.
- If there is no boundary, AP or valid input, explain the exact prerequisite and link to the appropriate action.

### States

- **No result:** parameters and run action visible; map remains usable.
- **Running:** progress, phase and Cancel; do not freeze map interactions unnecessarily.
- **Completed:** results and optional overlay.
- **Out of date:** stale label and “Run coverage” action.
- **Cancelled:** return to idle without presenting partial results as completed.
- **Worker failure:** keep project intact; show retry.
- **Limit exceeded:** explain which configured cap was exceeded (AP count, grid cells, obstacle segments or extent); offer a user-controlled coarser resolution where relevant.
- **Offline:** calculation works offline when required project data is already saved. No fresh building data is fetched because building import is deferred.

## 5.9 Network simulation (`…/simulation`)

### Purpose

Evaluate simplified network reachability, paths, latency and throughput assumptions under baseline and user-defined node/link failure scenarios.

### Layout

Use a full workspace page with three vertical regions:

- **Left configuration rail (about 28%):** flows, traffic assumptions and failure scenarios.
- **Centre results region (about 48%):** baseline/scenario summary and comparison charts.
- **Right detail rail (about 24%):** selected flow path, path metrics and explanatory assumptions.

At smaller desktop widths, the detail rail becomes a drawer. Do not compress all three regions into unreadable columns.

### Configuration

- Flows are configured from the simulation setup. Default flows may be auto-derived from LAN subnets with a `servedByDeviceId` to server devices, according to the architecture.
- Per-host demand defaults to the illustrative 5 Mbps value. Label it as an assumption and allow editing through project-level simulation settings.
- The model also assumes a 1500-byte average packet size and 1 ms processing delay per intermediate forwarding device by default. Display both in a read-only assumptions disclosure; do not add queueing controls.
- Failure scenarios select devices and/or links to disable. Each scenario must have a meaningful name or a generated label that the user can edit if the contract supports it.
- The graph is simplified and undirected. Dijkstra uses non-negative link routing weights; the default is one per hop.
- Do not expose OSPF/RIP protocol selectors, packet-size controls or queueing controls. The MVP uses the frozen 1500-byte assumption and has no queueing model.

### Results

For each flow and scenario, show the supported measures:

- Reachable / unreachable.
- Computed path, rendered as a highlighted device/link path where possible.
- Offered demand.
- Bottleneck capacity.
- Estimated delivered rate, including the documented equal-share rule where flows share a link.
- Link utilisation.
- Latency and the components/assumptions applied by the engine.

MVP queueing is explicitly not modelled. Show latency as propagation + transmission + processing only and disclose the 1500-byte packet-size and 1 ms per-intermediate-hop processing assumptions. Do not show M/M/1 controls, queue delay, packet loss or queue stability.

### Interactions

- User configures flows/scenarios and explicitly selects “Run simulation”.
- Simulation runs in its own worker and reports progress per scenario.
- The result compares baseline against each configured scenario.
- Selecting a flow highlights its path in the result diagram; selecting a failed device/link highlights the failure context.
- Users can inspect unreachable flows and rerouted paths in a result table.
- Editing simulation inputs or relevant design records marks the displayed result Out of date.
- Do not show packet animation. A path highlight or scenario state transition is sufficient and accurate for this model.

### States

- **No configured flow:** explain how flows are derived from subnet/server relationships or allow the user to define supported flows.
- **No scenarios:** baseline-only simulation may run; show that no failure scenarios are configured.
- **Running:** progress by scenario and Cancel.
- **Completed:** baseline and scenario comparison.
- **Out of date:** result remains viewable with an explicit stale label.
- **Unreachable:** show the affected flow and reason; do not treat it as an application error.
- **Worker failure/cancel:** retain the project and any previous complete result; never present partial output as final.
- **Offline:** fully usable because the engine runs locally.

## 5.10 Design comparison (`/projects/:projectId/compare`)

### Purpose

Compare two independently saved designs in the same project and identify structural and analytical trade-offs.

### Layout

- Header with project name and two design selectors.
- Main content uses two aligned design columns plus a narrow metric-label column, or a compact metric table with A/B columns and delta column. Prefer the metric table for exact values.
- Section order: design structure, cost, coverage, simulation, freshness/assumptions.
- A modest number of summary metrics; avoid a dashboard full of unrelated charts.

### Required comparison content

- Design A and Design B names; identify the baseline.
- Device and link structural differences, grouped by device/catalog item and position where supported.
- CAPEX, OPEX and TCO.
- Coverage percentage and dead-zone summary.
- Simulation metrics such as reachability, latency and estimated delivered rate where records exist.
- Delta and direction labels appropriate to the metric: lower cost may be favourable, higher coverage/reachability may be favourable, lower latency may be favourable. Do not use one generic “better” rule for every field.

### Behaviour

- Design A defaults to baseline. Design B defaults to the selected alternative.
- Only latest cached analysis records are read. Missing/stale records are not silently recomputed.
- For each missing or stale analysis, show a targeted “Run analysis for Design A/B” action. A design may be analysed without opening its workspace, using the approved coordinator/service path.
- Comparison is read-only. To modify a design, open that design.
- Duplicated designs have independent entity IDs and their analysis caches are not copied.

### States

- **Only one design:** explain that a duplicate is required before comparing.
- **Missing analysis:** show “Not calculated” and the relevant run action.
- **Stale analysis:** show “Out of date”; keep old values visually de-emphasised and explicitly labelled.
- **Current analysis:** show aligned comparison values and deltas.
- **Design deleted/invalid selector:** prompt the user to choose another existing design.
- **Offline:** comparison works with locally stored design data and cached results; missing results can be calculated locally.

## 5.11 PDF report preview (`…/report`)

### Purpose

Let the user inspect which project/design information will be included before generating a locally downloadable PDF.

### Layout

- Header: “Report preview”, project/design name and “Download PDF” primary action.
- Left contents rail with section anchors.
- Main preview with document-like pages/sections rather than dashboard cards.
- A compact report status strip showing which analysis sections are current, missing or stale.

### MVP report sections

1. Cover and project/design summary.
2. Design overview with device and link tables.
3. Schematic geographical figure.
4. Logical topology figure.
5. IPv4 addressing plan.
6. Cost breakdown and chart.
7. Coverage figure, statistics and dead-zone list.
8. Simulation baseline and failure-scenario results.
9. Assumptions, input parameters and estimate disclaimers.

### Behaviour

- Report model is assembled from current design data and latest stored analysis records.
- If an analysis has no record, render “Not computed”. If a record is stale, render “Computed on an earlier version of the design”. Never silently recalculate during report generation.
- The cost assumptions disclosure includes the fixed 100% device power-duty ratio. Simulation assumptions include 1500-byte average packet size, 1 ms per intermediate forwarding device and no queueing model.
- The geographical figure is generated from design data by a dedicated schematic renderer. Do not screenshot the live Leaflet map, request live tiles or imply that the PDF includes a basemap.
- The PDF is generated on demand and downloaded. The report file is not required to be persisted in IndexedDB.
- Preview must show estimate flags and parameters so the reader can understand model limitations.

### States

- **Ready:** preview populated and Download PDF enabled.
- **Partial:** sections with unavailable analyses are explicitly marked.
- **Generating:** show progress/disabled duplicate clicks while the PDF is assembled.
- **Failure:** retain preview; show an error and Retry action.
- **Offline:** PDF generation remains available because figures are schematic and data is local.

## 5.12 Device catalog (`/catalog`)

### Purpose

Browse supported equipment and manage custom catalogue entries used when placing devices.

### Layout

- Heading “Device catalog” with a single primary “Add custom item” action.
- Filter row: device type and local text search.
- Main table grouped or filterable by Router, Switch, Access Point and Server.
- Detail/editor panel appears on row selection; avoid opening a full-screen editor for a small number of fields.

### Table fields

- Brand/model or item label.
- Device type.
- Relevant supported specifications (ports, capacities, radio data or power only when present in the catalogue contract).
- Unit price and currency.
- Price provenance (`Sample` or user-entered) and last-updated metadata.
- Built-in/custom indicator.

### Rules and interactions

- Built-in catalogue records are immutable and read-only.
- Custom records can be created and edited through the approved custom item editor.
- A custom item cannot be deleted while referenced by a device. Explain which design/device uses it.
- A device stores a catalogue reference plus sparse overrides. Editing an individual device override must not silently edit the catalogue record.
- A catalogue price/specification change may invalidate dependent cost, coverage or simulation results. Show a confirmation/impact note before saving a change that affects existing designs, where feasible.
- Seeded generic catalogue entries are vendor-neutral synthetic examples; do not invent brands or real model numbers. Their specifications and prices are illustrative, not current supplier quotes. Display “Sample item” and “Sample price” explicitly.
- Cable specifications are code-level registry values in the MVP. Do not add a cable catalogue editor or custom cable type UI.

### States

- **Empty custom catalogue:** built-in entries remain visible; “Add custom item” available.
- **Loading:** table skeleton.
- **Invalid custom item:** field-level validation.
- **Referenced item deletion:** blocked with dependency explanation.
- **Offline:** browsing and editing stored catalogue entries works locally.

## 5.13 Application settings (`/settings`)

### Purpose

Manage small application-wide preferences and explain the app's local/offline behaviour. Project-level engineering assumptions remain in project settings, not global preferences.

### Layout

Use a simple settings page with a narrow section navigation and vertically stacked groups. No KPI cards or complex dashboard.

### Application preferences

- Unit display preferences, limited to units supported by the application.
- Optional `autoRecalculateCoverage` toggle, default off. Explain that enabling it may trigger coverage after relevant completed edits, but never during a drag.
- Any other preference only if it exists in the frozen `appMeta` contract. Do not invent persisted preferences merely to fill the page.

### About, privacy and offline section

Explain plainly:

- Project/design data is stored locally in browser IndexedDB.
- NetScape MVP has no account system, cloud sync or backend.
- Location search sends the submitted query to the geocoding provider.
- Map viewing requests tiles from the selected tile provider.
- Project contents, device details and analysis data are not sent to third-party services.
- Local browser storage is not encrypted secure storage; users should not store credentials or highly sensitive network secrets in notes/device properties.
- Offline editing and local calculations remain available after the app has loaded and its service worker has installed. Location search requires connectivity; basemap tiles are best-effort.

### States

- Settings read/write failure: show a field-level or page-level message and keep the last committed preference.
- Offline: settings remain available locally.
- App update available: use the global non-blocking prompt pattern.

## 5.14 Project settings

Project settings are accessed from the project context menu or a clearly labelled project settings action. They are distinct from global application settings.

The settings page groups project-wide assumptions:

- Cost: currency (locked default INR), pricing, tariffs, slack, labour/civil-work assumptions, maintenance and TCO horizon, limited to fields in the approved project settings contract.
- Coverage: approved path-loss parameters, frequency, grid resolution, RSSI thresholds and wall-loss material values.
- Simulation: approved traffic/latency assumptions, including the illustrative default 5 Mbps per configured host.

All engineering settings are project-level in the MVP and apply to all designs in the project. No per-design overrides. Every group must show an “Applies to all designs in this project” note. Save settings immediately through the approved project service and update relevant stale-result states based on input hashes.

---

# 6. Main Workspace Specification — Map View

## 6.1 Desktop geometry

Target the desktop workstation first. At a 1440 px-wide desktop viewport, use the following initial proportions. They are design targets, not hard-coded absolute constraints; allow the map canvas to absorb remaining width.

| Region | Target width / height | Behaviour |
|---|---:|---|
| Global rail | 56 px wide | Fixed; collapsible only on smaller desktops. |
| Workspace section rail | 56–64 px wide | Fixed; icons with tooltips or compact labels. |
| Device/tool palette | 232–256 px wide | Docked left of map; collapsible to 48 px icon strip. |
| Map canvas | Flexible; target at least 560 px wide | Primary work area; receives the majority of available width. |
| Right inspector/dock | 304–336 px wide | Docked right; changes content based on selection and active panel; collapsible. |
| Header | 52–56 px high | Fixed at top of workspace. |
| Bottom dock | 160–220 px expanded; 32 px collapsed header | Optional contextual information, validation and analysis summary; resizable within a bounded range. |

The map canvas must never be squeezed below a usable working width on a supported desktop screen. If width is constrained, collapse the left palette first, then collapse the right inspector into a drawer. Do not let panels cover the map without a clear open/close affordance.

## 6.2 Workspace region hierarchy

**Top header**  
Contains project/design context, baseline indicator, save state, online/offline status and overflow actions.

**Workspace rail**  
Contains Map, Topology, Addressing, Cost, Simulation and Report navigation. The active module is marked with Electric Blue and a secondary active indicator. Coverage is accessed through the map's right dock, not this rail as a separate route.

**Left device/tool palette**  
Contains selection and drawing tools, device catalogue categories and topology templates. This panel is for *creating and selecting tools*, not for showing device properties.

**Central map canvas**  
Contains the basemap (when available), planning boundary, obstacle polygons, device markers, link polylines and optional coverage overlay. All authored geometry is rendered from the saved design projection.

**Right inspector/dock**  
Displays selected device, link or obstacle properties. When nothing is selected, it shows contextual map/coverage controls and a short workflow hint. The Coverage panel is a named panel within this dock.

**Bottom dock**  
Contains compact validation issues, recent action feedback and current analysis status where needed. It is secondary to the map and collapsed by default when the viewport is short. It must not duplicate every field from the inspector.

## 6.3 Header and project controls

The map workspace header contains:

- Project name and breadcrumb.
- Design selector and baseline badge.
- Current view label (“Map”).
- Save indicator (`Saving…`, `Saved`, `Save failed`).
- Online/offline badge.
- Project/design overflow menu.

Actions in overflow:

- Project designs.
- Project settings.
- Duplicate current design.
- Rename design.
- Close workspace / return to Projects.

Do not put a manual Save action, share button, invite button, cloud sync status or undo/redo controls in the header.

## 6.4 Workspace navigation rail

Use one icon and label/tooltip for each destination:

1. Map.
2. Topology.
3. Addressing.
4. Cost.
5. Simulation.
6. Report.

The rail changes the child route, preserving project and design identity. Switching Map ↔ Topology unmounts the previous view as required by the architecture. Keep the map viewport in the editor UI state and restore it when returning to the map route. Selection is shared between both views.

## 6.5 Left palette: tools and devices

Organise the palette into two visually separated groups.

### A. Work tools

| Tool | Behaviour |
|---|---|
| Select | Default mode. Select devices, links, obstacles and boundary geometry. |
| Draw boundary | Activates polygon drawing for the project's planning boundary. Only shown when the map is active. |
| Draw obstacle | Activates manual obstacle polygon drawing. Obstacles belong to the project and affect all designs in that project. |
| Create link | Activates the two-click connection workflow. User must choose/confirm the supported medium and then select source and target devices. |
| Pan / inspect | Allows map navigation without selecting or placing an item. If Leaflet's normal drag pan is sufficient, do not create a redundant tool. |

Only one mutually exclusive authoring tool can be active at a time. Use an obvious active background/border and cursor change. Escape returns to Select and cancels incomplete placement/link drafts.

### B. Device palette

Show supported categories:

- Routers.
- Switches.
- Access points.
- Servers.

Expanding a category reveals catalogue entries with concise name/model and one or two useful identifying specifications. Use compact rows, not large product cards. A search field filters the local catalogue only.

Selecting an item enters placement mode. The user clicks the map to place it. The tool remains active for repeated placement until Escape or another tool is selected. After a successful placement, select the newly created device and open its inspector so the user can immediately review its properties.

Do not permit a device to be created on the topology canvas without a geographic position. A “Place device on map” action from the topology route should navigate to the map and activate the selected catalogue item for placement.

### C. Topology templates

Expose only Star and Tree. Use a compact “Templates” section below the device palette, with a wizard/dialog for selection and preview.

MVP template behaviour:

- Preview the expected structure before commit.
- Require a valid root device and compatible existing devices/connection types, following the frozen template contract.
- For Tree, let the user assign exactly one parent device to each selected non-root device; the root has no parent. The parent selector must only offer devices in the selected template set and must prevent self-parenting.
- Validate that the parent map is connected and acyclic before enabling Preview/Apply.
- Clearly list the exact parent→child links that will be created, including their selected medium and any installation/port requirements.
- Commit the template as one logical user action through the approved domain command/service.
- If there are not enough compatible existing devices, explain the prerequisite and offer to return to device placement.
- Do not show Bus, Mesh, Hybrid or automatic optimisation templates.

If the final domain contract defines a different template instantiation rule, the contract wins; the preview must still show the exact resulting changes before committing.

## 6.6 Central geographical map canvas

### Map contents and drawing order

Render in this visual order, from lowest to highest:

1. Basemap tiles, when reachable.
2. Project planning boundary.
3. Project-level obstacle polygons.
4. Coverage raster overlay, when enabled.
5. Link polylines.
6. Device markers and labels.
7. Selection/hover/focus outlines and temporary link-draft feedback.

The coverage overlay must not obscure device markers, links or the planning boundary. Selected and active items must remain visible above heatmap colours.

### Map controls

A compact map toolbar sits at the upper edge of the canvas:

- Search location field + explicit Search action.
- Draw boundary shortcut.
- Draw obstacle shortcut.
- Select tool shortcut.
- Zoom controls and “Fit project area”.
- Optional layer/coverage visibility control if not already visible in the right dock.

Do not add a general-purpose layer manager for non-existent layers. No map style picker is required in the MVP unless already present in the approved service config.

A small lower map status line may show cursor coordinates and scale when available. Coordinates must be labelled as display coordinates and must not be presented as engineering measurements. Distances and areas displayed in analysis derive from the approved local metric frame, never Leaflet's Web Mercator ruler.

### Offline and basemap behaviour

- Map canvas remains interactive with zero tiles.
- When tiles are unavailable, render a neutral canvas background and show “Basemap unavailable offline” or “Basemap unavailable” in a compact overlay.
- Continue to render boundaries, obstacles, devices, links and locally stored coverage overlays.
- Location search is disabled while offline or while the geocoder is unavailable; show a tooltip/message rather than a fake search state.
- Do not offer bulk tile download, offline region download or “cached map” status as an MVP promise.
- Always show required basemap attribution when tiles are shown.

### Geographical boundary workflow

1. User activates Draw boundary.
2. Leaflet-Geoman captures the polygon gesture.
3. On creation, the temporary layer is removed and the GeoJSON geometry is dispatched through the approved command.
4. After a successful Dexie commit, the boundary is rendered declaratively from the design projection.
5. Validation checks polygon validity, distinct vertices, self-intersection, positive area and the 20 km planning extent guard.
6. The boundary can be edited/deleted through the same commit-first flow; the temporary Leaflet layer is never the source of truth.

If a project has no boundary, show a compact first-task prompt. Boundary geometry is project/region data, not a separate free-floating design overlay.

### Manual obstacle workflow

- User activates Draw obstacle, sketches a polygon and commits it.
- Select an obstacle to edit its material and fixed loss value using the approved material table.
- Label the section “Project obstacle — applies to every design in this project”.
- Obstacle creation, edit and deletion are committed to IndexedDB before the display changes.
- Obstacles are manual in the MVP. Do not show OSM import, building detection or automatic wall extraction.

### Device placement workflow

1. User selects a catalogue item in the palette.
2. The palette row becomes active and the map cursor indicates placement.
3. User clicks the intended geographical location.
4. App dispatches `device/add` with the catalogue reference and geographic position.
5. After the commit, the marker appears and the new device is selected.
6. The inspector shows the new device's resolved catalogue specifications and editable fields/overrides.
7. If the device is outside the planning boundary, show a non-blocking warning; allow it to remain unless the approved validator says otherwise.

Device marker drag updates only on `dragend`, producing one command/commit. Do not write a database transaction on every pointer-move frame. Moving a device updates the endpoint coordinates of connected link geometry through the approved command/cascade.

### Device marker rules

- Use a consistent icon silhouette for each type: router, switch, AP, server.
- Use a compact label beside or below the icon. Truncate long labels visually but preserve the full accessible name.
- Selection uses a clear Electric Blue outline, not a large glow.
- Hover shows a small tooltip: name, type and one useful identifier if present.
- Device type is immutable after creation. Changing model/catalog item is allowed only within the same device type.
- Device status in this design is based on authored/validation/simulation state; do not imply live hardware connectivity.

### Link creation workflow

Map creation is a custom two-click tool, not Geoman:

1. Activate Create link and select an approved link medium.
2. Click the source device. Show a temporary source highlight and “Select destination device”.
3. Click a distinct compatible target device.
4. Validate device existence, allowed device pair, no duplicate/parallel link where prohibited, medium compatibility and port budget.
5. Commit the link through `designSession`; clear the draft only after the command resolves.
6. Render the straight endpoint-to-endpoint LineString from the committed design projection.
7. Display derived length and any maximum cable length warning in the inspector.

Escape or a canvas cancel action clears the draft. If a target is invalid, retain the source selection and explain why the target cannot be used.

The map link is straight in the MVP; users cannot add editable intermediate waypoints. Engineering link length is derived in the project metric frame, not from on-screen map pixels.

## 6.7 Contextual inspector and right dock

The right panel is context-sensitive. Keep a stable panel header and switch the content body based on the current selection or panel mode.

### Priority order

1. One selected device → Device inspector.
2. One selected link → Link inspector.
3. One selected obstacle → Obstacle inspector.
4. Multiple selected items (only if multi-selection is supported) → selection summary and safe bulk actions only.
5. No selection + Coverage open → Coverage panel.
6. No selection + no active analysis panel → map context/help panel.

If the user selects an item while Coverage is open, do not lose the coverage run/results. Provide a small panel tab/header switch between “Properties” and “Coverage” so both remain one click away. Do not display the full inspector and full coverage form simultaneously in a 320 px panel.

### Device inspector

Sections:

- Identity: name/label, hostname where supported, notes.
- Catalogue: selected catalogue item, device type (read-only), relevant resolved specifications.
- Overrides: only editable override fields supported by the device contract.
- Network association: IP/subnet association only where supported by the current model.
- Validation: warnings/errors associated with this device.
- Actions: duplicate if supported by the domain model; delete.

Rules:

- Form inputs hold local draft state while typing.
- Commit on blur or after a 300 ms debounce, using the approved command.
- Show `Saving…` during commit. Do not mark the projection as saved until Dexie commits successfully.
- Type is immutable. A catalogue item change must retain the same device type; unsupported overrides are cleared according to the domain reducer.
- Delete confirmation explains that connected links will be removed and subnet associations cleared as defined by the approved cascade.

### Link inspector

Show:

- Source and target device names.
- Medium (`copper`, `fiber`, `wireless`) and the compatible source/target port capability.
- For wired links, installation method (`indoor`, `underground`, `aerial`). A wired link may remain unclassified (`null`), but Cost must show the estimate as incomplete until classified. Wireless links have no installation method.
- Derived length in metres; distinguish a user override from computed length if the contract supports the override.
- Copper maximum segment length warning at 100 m; do not invent a fibre maximum.
- Supported capacity and routing weight properties.
- Port-use status at both endpoints (used/available) when the device specification exposes port counts.
- Validation issues.
- Delete action.

Do not provide a cable-specification editor; cable specifications are a code-level registry. Do not invent link fields that are not in the contracts.

### Obstacle inspector

Show:

- Obstacle material.
- Fixed wall loss in dB per polygon-boundary crossing.
- Project-level scope note.
- Validation issues.
- Delete action.

No height, floor count, terrain or 3-D controls in the MVP.

### No-selection context panel

When nothing is selected, show a concise next-action hint relevant to the active map state, such as “Choose a device to place it” or “Select an item to inspect its properties.” A compact project summary may show boundary status and device counts, but should not turn into a dashboard of arbitrary statistics.

## 6.8 Bottom dock

The bottom dock is for secondary context, not a second full inspector. Provide three restrained tabs:

1. **Validation:** current design/project validation issues grouped by Error and Warning; selecting an issue focuses the associated item on the map when possible.
2. **Analysis status:** latest cost, coverage and simulation freshness/run status with direct navigation or open-panel actions.
3. **Activity:** a small current-session event list only if the application already emits meaningful local events. Do not invent an audit log or persistent collaboration timeline.

The dock is collapsed by default on short viewports. When expanded, it should not exceed about 220 px on a standard desktop. Remember its transient open/closed state in `editorStore.panelLayout` only if supported by the existing UI state contract.

## 6.9 Status indicators and notifications

Use these distinct signals:

- **Persistence:** `Editing` for an uncommitted local field draft, `Saving…` for a submitted commit, `Saved` after successful Dexie transaction, `Save failed` after failure.
- **Analysis:** `Not calculated`, `Running`, `Current`, `Out of date`, `Cancelled`, `Failed`.
- **Connectivity:** `Online` or `Offline`.
- **Basemap:** `Available` or `Unavailable` inside the map.
- **Validation:** `Error` blocks the relevant commit/run; `Warning` allows it but is visible.

Toasts are short-lived and reserved for completed actions or non-blocking failures. Persistent conditions (save failed, stale analysis, offline map search) stay visible in the relevant region. Do not stack multiple toasts for every low-level state transition.

---

# 7. Logical Topology Workspace

## 7.1 Purpose and mental model

The topology view is a logical arrangement of the same design. It is not a second network model and must not invent independent device or link records.

React Flow responsibilities:

- Render nodes from device records.
- Render edges from link records.
- Use `device.id` as node ID and `link.id` as edge ID.
- Persist abstract canvas positions to `Design.logicalLayout` only.
- Dispatch the same approved connection command as the map view.

React Flow must not become authoritative for link records or geographic positions.

## 7.2 Layout

Use the same workspace header, section rail, left tool/device palette and right inspector as the map view. The central canvas becomes a dark neutral topology board with a subtle unobtrusive grid. The bottom dock remains available.

Suggested canvas controls at top-right:

- Fit view.
- Zoom in/out.
- Auto-arrange.
- Toggle minimap only if the graph is large enough to justify it.

Avoid decorative node shadows, oversized device cards and animated connection flow effects.

## 7.3 Node and edge presentation

- Node card: device-type icon, device name, type, one useful short attribute.
- Ports/handles: visible on hover/focus, with clear connection affordance.
- Edge: medium label or capacity label only where useful; avoid labelling every edge with many values.
- Selected node/edge: Electric Blue outline and matching inspector selection.
- Validation issue: semantic warning/error marker plus text in inspector/validation dock.
- Failed device/link in a displayed simulation scenario: use semantic error styling and a text label; do not permanently mutate the authored device appearance.

## 7.4 Interactions

- Selecting a node updates shared selection and the right inspector.
- Selecting an edge updates shared link selection and inspector.
- Dragging a node is a local canvas gesture; commit `layout/set` once on node drag stop.
- Auto-arrange calls the deterministic layout helper and commits the resulting positions.
- Layout changes do not invalidate cost, coverage, simulation or VLSM calculations.
- Creating a link through React Flow dispatches the same `link/add` command as the map. The edge appears only after the commit.
- To add a new device, use “Place device on map”; a logical node cannot be created without a geographic position.
- Shared selection persists when switching between map and topology routes.

## 7.5 States

- **Empty topology:** explain that devices must first be placed on the map; show a “Go to map and place devices” action.
- **Single node/no edges:** render the node and a compact hint that links can be created from its connection handles.
- **Dense topology:** fit view and auto-arrange remain visible; node labels may truncate but remain accessible.
- **Commit failure:** keep the last committed topology and show Save failed; do not display a dragged layout as saved.
- **Offline:** fully functional.

---

# 8. Interaction and Behaviour Contracts

## 8.1 Persistence model

Autosave is the only save model in the MVP.

- Dexie/IndexedDB is the saved-data authority.
- An edit is validated and committed through the application/domain command path.
- Only after the Dexie transaction succeeds is the Zustand projection updated.
- Zustand is a disposable projection and transient UI state store, not a second database.
- Failed commits leave the projection unchanged and must never be presented as saved.

### Draft and commit timing

| Interaction | Commit timing |
|---|---|
| Text/number input | Local component draft; commit on blur or after 300 ms debounce. |
| Marker drag | One commit on `dragend`, not every pointer move. |
| React Flow node drag | One layout commit on `onNodeDragStop`. |
| Link creation | Commit after the destination device is chosen and validation passes. |
| Boundary/obstacle draw/edit | Commit once after the Geoman event is converted to GeoJSON. |
| Multi-field dialog | Commit once when the user confirms. |
| Route change | Flush pending field drafts before unmounting the current route. |

A commit queue serialises writes per design. On a revision conflict, stop further writes in that session and offer “Reload design”. Do not auto-merge concurrent edits.

## 8.2 Selection model

- One shared selection model across map and topology.
- Selection is transient; it is not authored design data.
- Selecting a new object updates the right inspector.
- Escape clears an active gesture before it clears selection; if no gesture is active, Escape clears selection or closes the topmost popover/dialog according to normal keyboard convention.
- Clicking blank canvas returns to no selection unless the user is in a placement/link/drawing gesture.
- The selection indicator must remain visible when the coverage overlay is active.

## 8.3 Keyboard and tool behaviour

Minimum keyboard behaviour:

| Key | Behaviour |
|---|---|
| `Esc` | Cancel active placement/link/drawing draft; otherwise close topmost popover/dialog or clear selection. |
| `Delete` / `Backspace` | Request deletion of selected authored item only when focus is not inside an input/editor. Confirmation required for destructive cascade. |
| `Enter` | Submit location search or confirm the currently focused primary form action. |
| `Tab` / `Shift+Tab` | Predictable traversal through header, workspace rail, palette, canvas toolbar, inspector and dock. |
| Arrow keys | Operate focused controls and table navigation where supported; do not hijack browser scrolling globally. |

Do not define undocumented global shortcuts that conflict with browser or input behaviour. Tool buttons must be keyboard reachable. The map must expose equivalent toolbar actions so drawing/placement does not depend exclusively on pointer gestures.

## 8.4 Creating a project

The successful path is: project name → choose geocoded region or valid current view → create. Project, region, frame, defaults and baseline design are committed transactionally. Navigate only after success. If boundary is absent, prompt for it in the map workspace; do not force the user to complete all geometry before the project exists.

## 8.5 Placing devices

Use palette selection followed by map click. Each placement receives a geographic coordinate. After commit, the new item is selected and inspected. Repeated placements are supported until Escape or another tool is activated. A placement warning outside the planning boundary is non-blocking unless the domain validator specifically marks it as an error.

## 8.6 Connecting devices

Use the explicit two-click map workflow or React Flow connect gesture. The same domain command validates and persists both. Draft connections are temporary UI state only. Do not display an edge as permanently created until commit succeeds.

## 8.7 Editing properties

Use local component drafts and commit on blur/debounce. Show validation adjacent to the relevant field. Preserve user-entered drafts if a commit fails. Changing catalogue reference within the same device type is allowed; device type itself is immutable.

## 8.8 Switching map/topology

Use route navigation. Keep map viewport and shared selection in transient editor state. Preserve the same IDs and design projection. Logical layout edits do not alter geographical placement or invalidate analysis.

## 8.9 Running analysis

Analysis state has the common lifecycle:

`Not calculated → Running → Current`  
`Current → Out of date` when the current input hash changes  
`Running → Cancelled` when cancellation completes  
`Running → Failed` on typed worker/engine failure

- Show the input context and assumptions in the relevant panel.
- Show progress only when the coordinator/worker provides it.
- Provide Cancel for worker computations.
- A cancelled or failed run must not be presented as a successful saved analysis.
- Old results may remain visible only with a visible Out of date label.
- Do not use raw revision equality to decide freshness; the architecture defines freshness by current input hash.

## 8.10 Comparing alternatives

Duplicate the baseline, edit the duplicate independently, then compare. Ensure the user understands that each design has independent authored records and that cached analyses are not copied. Show missing/stale data honestly. Keep comparison read-only.

## 8.11 Error and recovery behaviour

| Failure | Required UX |
|---|---|
| IndexedDB unavailable/blocked | Blocking storage error; do not pretend the app can safely save. Do not silently fall back to volatile-only editing. |
| Quota exceeded | Reject commit, preserve previous committed projection, explain that saved data was not changed, offer “Clear analysis cache”. Never delete authored data automatically. |
| Revision conflict | Stop current write session, preserve last committed projection, offer reload/reopen. No automatic merge. |
| Worker crash/failure | Preserve project, mark run failed, provide Retry; recreate worker as required by architecture. |
| Worker cancellation | Return to idle/cancelled; do not save partial results as complete. |
| Stale worker result | Cache only for its input hash; do not publish it as current. Keep stale state clear. |
| Geocoder unavailable | Disable search or show retry; project editing remains functional. |
| Tile provider unavailable | Keep the map canvas and authored layers; show basemap unavailable. |
| Invalid geometry/input | Field-level `ValidationIssue`; block invalid commit/run. Warnings remain visible but non-blocking. |
| PDF generation failure | Keep project unchanged, retain preview, allow retry. |
| Service-worker update | Non-blocking prompt; never force reload during edit or computation. |
| Referenced custom catalogue item deleted | Block deletion and explain the dependency. |

---

# 9. Component Inventory and Design Conventions

The inventory below defines functional components. It is not a mandate to create one source file per row. Components should be grouped according to the approved feature/module structure.

| Component | Responsibility | Main locations |
|---|---|---|
| `AppShell` | Global header, route outlet, global navigation, toast/banner layers. | `app/`, `features/shell/` |
| `GlobalNav` | Projects, Catalog, Settings navigation. | shell |
| `WorkspaceHeader` | Project/design context, save state, online state and menu. | shell/workspace |
| `WorkspaceRail` | Map, Topology, Addressing, Cost, Simulation, Report navigation. | shell/workspace |
| `ProjectList` | Local project table, search, sort and row actions. | projects |
| `ProjectCreateDialog` | Project name and geographical context selection. | projects |
| `DesignList` | Design table, baseline, duplicate and compare actions. | projects |
| `DesignerPalette` | Work tools, device catalogue picker and Star/Tree templates. | designer |
| `MapWorkspace` | Leaflet map composition and tool event handling. | map |
| `MapSearch` | Explicit user-submitted geocoder search. | map |
| `BoundaryLayer` | Declarative committed boundary rendering. | map |
| `ObstacleLayer` | Declarative committed obstacle rendering. | map |
| `DeviceMarker` | Device icon, label, selection and drag-end behaviour. | map |
| `LinkPolyline` | Committed link rendering and selection. | map |
| `CoverageOverlay` | Raster overlay and opacity/visibility controls. | map/coverage |
| `TopologyView` | React Flow projection of devices/links and logical layout. | topology |
| `Inspector` | Contextual device/link/obstacle property editor. | designer |
| `CoveragePanel` | Coverage settings, run state, results and overlay controls. | coverage |
| `ValidationPanel` | Validation issues and map/topology focus actions. | designer/shell |
| `AnalysisStatus` | Analysis lifecycle and freshness labels. | shared UI |
| `AddressingTable` | IPv4 subnet requirements and VLSM allocations. | addressing |
| `CostBreakdown` | CAPEX/OPEX/TCO totals, table and chart. | cost |
| `SimulationSetup` | Flow and failure scenario configuration. | simulation |
| `SimulationResults` | Baseline/scenario results and path details. | simulation |
| `DesignComparison` | Aligned metrics, deltas and structural differences. | comparison |
| `ReportPreview` | Report sections, availability states and download action. | reports |
| `CatalogTable` | Built-in/custom catalogue rows and filters. | shell/catalog |
| `CatalogItemEditor` | Custom catalogue item editor. | shell/catalog |
| `ApplicationSettings` | Global preferences and offline/privacy explanation. | shell/settings |
| `ProjectSettings` | Project-wide cost, coverage and simulation assumptions. | project settings |
| `ConfirmDialog` | Destructive or consequential confirmation. | shared UI |
| `Toast` | Compact temporary feedback. | shared UI |
| `OfflineBanner` | Network-dependent action explanation when appropriate. | shell |
| `UpdatePrompt` | Service-worker update prompt. | shell |
| `EmptyState` | Useful next action for empty routes/panels. | shared UI |
| `InlineError` | Field-level/section-level validation and service errors. | shared UI |

## 9.1 Tables

Tables are first-class engineering UI, not secondary report elements.

- Align numeric values to the right; use tabular numerals.
- Keep units visible in headers or values.
- Use sticky headers for long tables where useful.
- Use subtle row dividers instead of a boxed grid around every cell.
- Keep row heights around 36–40 px for dense data, with larger rows only where content needs them.
- Selected rows use a restrained neutral surface plus an Electric Blue edge/marker.
- Validation messages appear in the row or inspector, not as unexplained colour fills.
- Avoid horizontal scrolling for the primary information set. Put secondary fields in a row details panel.
- Do not use arbitrary rounded cards to display each table row.

## 9.2 Forms

- Labels are persistent and sit above or beside fields; do not rely on placeholder text as a label.
- Units are part of the field label or a fixed suffix, not buried in help text.
- Numeric inputs use appropriate minimum/maximum constraints and sensible precision.
- Invalid fields show a message and error state. Warnings use different styling from blocking errors.
- For derived/read-only values, use read-only text aligned with inputs rather than disabled input styling.
- Keep advanced parameters in a clearly labelled disclosure section.

## 9.3 Buttons and action hierarchy

- One primary action per page/dialog region.
- Secondary actions use neutral surfaces and borders.
- Destructive actions use semantic error styling and explicit verbs (“Delete project”, “Remove link”).
- Icon-only buttons require tooltips and accessible names.
- Do not use a button for navigation when a link/route control is appropriate.
- No inert controls, fake toggles, decorative segmented controls or disabled future-feature buttons.

## 9.4 Dialogs and popovers

Use dialogs for tasks requiring focused input or confirmation: create project, duplicate design, template preview/commit, delete project/design/device/link and custom catalogue item creation. Use popovers for compact menus and secondary options. Keep dialog content bounded and keyboard focus contained. A dialog should always have a clear close/cancel route.

## 9.5 Charts

Use Recharts only for approved analytical visualisations. Every chart requires:

- Title and the question it answers.
- Axis labels and units.
- Legend and accessible data summary/table.
- Current/stale status when based on a cached analysis.
- No decorative gradients, animation or unexplained colour coding.

Charts should support the table or summary, not replace the exact values.

---

# 10. Responsive Behaviour

NetScape is a desktop-first engineering tool. Smaller screens should remain usable for inspection and limited editing, but the design must not pretend that a narrow phone display is equivalent to a full network-planning workstation.

## 10.1 Large desktop: 1440 px and above

- Full global/workspace rails.
- Left device palette docked.
- Map/topology canvas receives the largest share of width.
- Right inspector/coverage dock docked.
- Bottom dock available.
- Comparison can show both designs side by side.

## 10.2 Standard desktop: 1200–1439 px

- Workspace rail remains visible.
- Device palette may reduce to 216 px.
- Right panel reduces to about 296 px.
- Bottom dock collapses by default if vertical height is limited.
- Main map should remain at least about 520 px wide.

## 10.3 Compact desktop/tablet landscape: 900–1199 px

- Global navigation collapses to icons.
- Workspace section rail collapses to icons with tooltips.
- Device palette becomes a collapsible drawer or 48 px icon strip.
- Right inspector becomes a slide-over drawer; it should not permanently consume canvas width.
- Bottom dock is collapsed by default.
- Comparison changes from parallel columns to a metric table with a design selector or stacked sections.

## 10.4 Narrow tablet/mobile: below 900 px

- Use a single primary pane at a time: map/topology/addressing/cost/simulation/report.
- Palette and inspector are drawers, never side-by-side with a narrow map.
- Important map actions remain accessible from a compact toolbar and drawer.
- Addressing and cost tables may scroll horizontally only as a last resort; keep essential columns pinned or move secondary columns into row details.
- Do not build a separate mobile-only network editor or alternate design model.
- Provide a clear message when precise editing is impractical: “For detailed network planning, use a wider screen.” This is an advisory, not a hard block for viewing.

## 10.5 Responsive invariants

- Preserve the same routes and data model at every viewport.
- Never hide save failure, analysis staleness or validation errors behind a hover-only UI.
- Drawer open/close state is transient UI state.
- Keep keyboard navigation and focus management functional when panels become drawers.

---

# 11. Accessibility and Usability

The architecture's baseline accessibility requirement is modest, but the interface should implement these minimums consistently.

## 11.1 Contrast and visual state

- Meet WCAG AA contrast for normal text and essential controls wherever practical.
- Never communicate saved/error/stale/selected state with colour alone.
- Focus outlines must be visible on dark surfaces and must not be removed for visual cleanliness.
- Disabled controls need a readable explanation when their unavailability is not obvious.
- Keep map heatmap legend text readable against the panel and map backgrounds.

## 11.2 Keyboard access

- Every palette tool, navigation item, inspector field, dialog action and analysis control must be keyboard reachable.
- Toolbars should expose button semantics and accessible names.
- Provide a keyboard-accessible alternative to map drawing/placement where feasible through selecting a tool and activating the map at a focused coordinate/feature. At minimum, all tool activation and cancellation must be keyboard accessible; pointer-only gestures must not be the sole way to access core routes or settings.
- Avoid keyboard shortcuts that trigger while a text field is focused.
- Manage focus after dialogs close and after route navigation.

## 11.3 Screen reader and labels

- Use semantic headings in route order.
- Inputs have persistent labels and associated help/error text.
- Icon-only controls have accessible names.
- Tables use real header cells and clear row labels.
- Map and topology selections announce the selected device/link name and type in an accessible status region where appropriate.
- Chart information is available in text/table form.

## 11.4 Motion and cognitive load

- Respect `prefers-reduced-motion`.
- Avoid pulsing device markers, animated network traffic, flashing heatmaps or auto-scrolling results.
- Keep one primary action per panel.
- Use consistent names for the same entity across map, topology, inspector, comparison and report.
- Keep units and precision consistent throughout the application.

## 11.5 Safety of user data

- Treat local browser data as not encrypted secure storage.
- Explain that device notes/labels should not contain credentials or highly sensitive network secrets.
- Render user-provided strings as text; never inject as raw HTML.
- Do not put private project data in geocoder queries, external requests or telemetry.
- Do not add analytics or remote error reporting in the MVP.

---

# 12. MVP-Specific Design Limitations

This section is an explicit guardrail for the implementation agent. Do not add controls, routes, disabled features or empty placeholders for deferred scope.

| Area | Included in MVP | Must not appear as an MVP feature |
|---|---|---|
| Accounts | None. | Sign in, sign up, user profile, roles, invitations. |
| Collaboration | Single-browser local projects. | Team workspaces, comments, shared editing, cloud sync. |
| Backend | None. | FastAPI, PostgreSQL/PostGIS, server jobs or cloud backup. |
| Map | Leaflet/React-Leaflet, standard raster basemap, manual boundary and obstacle drawing. | Offline tile-region downloads, bulk OSM prefetch, OSM building import, terrain/elevation layers. |
| Network design | Routers, switches, APs and servers; manual placement and links. | Auto-placement, automatic topology optimisation, auto device recommendations. |
| Topology templates | Star and Tree. | Bus, Mesh, Hybrid or arbitrary template marketplace. |
| Links | Approved link media and their supported properties. | Editable cable catalogue or unsupported physical link types. |
| Addressing | IPv4 CIDR/VLSM. | IPv6 and protocol configuration. |
| Cost | CAPEX/OPEX/TCO using editable sample prices and project assumptions. | Live vendor quotes, shopping/procurement or guaranteed pricing. |
| Coverage | Log-distance estimate, best-server RSSI, grid heatmap, fixed wall loss, configurable thresholds and dead zones. | Terrain, floors, 3-D antennas, shadow-fading Monte Carlo default, SINR/interference, channel planning, detailed client capacity, auto AP optimisation. |
| Simulation | Simplified undirected graph, Dijkstra, flows, basic node/link failure scenarios, path/latency/throughput estimates. | ns-3, packet-level simulation, animated packets, TCP/UDP details, OSPF/RIP implementations, failure prediction. |
| Reports | On-demand downloadable PDF with schematic figures and stored analysis records. | Live basemap screenshots, cloud report storage, report sharing service. |
| Persistence | Dexie/IndexedDB, autosave, offline editing after first load/service-worker installation. | Manual Save workflow, cloud sync, automatic data-loss recovery claims, import/export JSON. |
| Editing history | Commit-then-project and explicit failure handling. | Undo/redo controls or history timeline. |
| Settings | Small application preferences and project-wide engineering settings. | Per-design parameter overrides. |

## 12.1 Limits to communicate

The UI must surface these limits only when relevant to the user's current action, not as a wall of legal text:

- Planning extent guard: 20 km from the immutable project-frame origin/approved extent; show a blocking coverage validation issue when the limit is exceeded.
- Design limits: 500 devices and 1,000 links.
- Coverage limits: 100 APs, up to 1,000,000 grid cells and 5,000 obstacle segments.
- A coarse grid may be suggested when the user exceeds a coverage computation budget; never silently change the selected resolution.
- Basemap tiles are best-effort. The app shell and saved project editing work offline after first load and service-worker installation.
- Coverage and simulation outputs are model estimates, not measurements.
- Sample catalogue prices are illustrative placeholders, not vendor quotes.
- Local IndexedDB is not encrypted secure storage.

## 12.2 Words and labels to use carefully

Use:

- “Estimate” for cost, coverage, latency and throughput results.
- “Out of date” for cached result whose input hash no longer matches current inputs.
- “Saved” only after a successful Dexie commit.
- “Basemap unavailable” when tile requests fail or the user is offline.
- “Simulation” with an explicit simplified-model note.
- “Sample price” for seeded catalogue values.

Do not use:

- “Live network status” for a static design.
- “Measured coverage” for modelled RSSI.
- “Optimised network” for a manually designed Star/Tree topology.
- “Packet delivery” when only a graph-level flow result exists.
- “Cloud backup”, “sync complete” or “team project” in the MVP.

---

# 13. Implementation Handoff Rules

These instructions translate the UX decisions into the existing architecture without redesigning it.

## 13.1 Route and state ownership

- Use the approved hash-router route structure.
- Route changes determine the active major view/module.
- Map viewport, selection, active tool, link draft, panel layout and overlay settings belong to transient editor UI state as defined in the architecture.
- Project/design/device/link/subnet/obstacle/logical layout/settings are authored domain records stored in Dexie.
- Analysis run state and published current/stale analysis belong to the analysis coordinator/store contract.
- Do not use Zustand persistence middleware as a second database.

## 13.2 Rendering ownership

- Leaflet owns map rendering and pointer events only.
- Leaflet-Geoman is used for boundary/obstacle gestures; emitted GeoJSON is dispatched as a domain command. The temporary Geoman layer is removed and the committed projection re-renders the geometry.
- Device markers and link lines are declarative React-Leaflet projections.
- React Flow owns logical rendering, gestures and transient node positions; only final layout positions are committed at drag stop.
- React Flow edges are derived from `Link` records and must not be independently persisted.
- The coverage raster is rendered as an image overlay; do not create thousands of vector features.

## 13.3 Data consistency

- Map and topology use the same `DeviceId` and `LinkId` identities.
- Device geographic position is WGS84 GeoJSON. Logical canvas coordinates are a separate type and must never be conflated with geographic coordinates.
- Logical layout changes must not invalidate engineering analyses.
- Device moves update connected link endpoints through the approved command/cascade.
- Every design edit follows command validation → Dexie transaction → Zustand projection update.
- Do not write the design projection before the Dexie transaction succeeds.

## 13.4 Analysis presentation

- Use input-hash freshness, not timestamps or raw revision equality.
- Cost runs synchronously on the main thread via the coordinator/cache path.
- Coverage and simulation run in Web Workers.
- Only the latest run for an analysis/design may be published as the current result.
- A completed run with old inputs may be cached for its own hash but must not appear as current.
- Do not invent progress percentages; display only worker-provided progress.

## 13.5 Feature and module mapping

Follow the existing architecture modules and repository layout:

- `features/shell/` and `features/projects/`: app shell, projects, catalog, settings and shared navigation.
- `features/map/`: Leaflet canvas, search, boundary/obstacle geometry, device markers, links, overlay and tool modes; use `MapWorkspaceService` for place search and tile-source configuration.
- `features/designer/`: palette, inspector, template wizard and validation.
- `features/topology/`: React Flow projection and logical layout.
- `features/addressing/`: IPv4/VLSM tables; call `AddressingService` and never import the IP engine directly.
- `features/cost/`: settings summary and estimate UI.
- `features/coverage/`: coverage panel, map overlay controls and dead-zone list.
- `features/simulation/`: flow/failure setup and results.
- `features/comparison/`: side-by-side comparison.
- `features/reports/`: preview and PDF generation.

Do not let UI features import Dexie, workers or geocoding/tile service adapters directly. Use the approved application services and stores.

## 13.6 Required interaction acceptance checks

The UX is not complete until these flows work end to end:

1. Create project → baseline design created → map opens.
2. Search location online → choose result → map fits the result.
3. Draw boundary → commit → reload → boundary is present.
4. Place device → commit → reload → exact device is present.
5. Move device → connected link endpoints move and the change persists.
6. Create link on map → same link appears in topology.
7. Create link in topology → same link appears on map after route change.
8. Change logical node layout → positions persist but engineering results do not become stale solely because of layout.
9. Edit device/link/obstacle → inspector reflects committed projection; failure leaves previous saved state.
10. Run VLSM → allocation and host requirements persist.
11. Calculate cost → values use INR and mark sample prices as illustrative.
12. Run coverage → progress/cancel/result/overlay/freshness states behave correctly.
13. Run simulation → baseline and failure scenarios show path/reachability and estimate metrics accurately.
14. Duplicate design → independent IDs and baseline invariant remain valid.
15. Compare designs → missing/stale analyses are explicit and targeted run actions work.
16. Generate PDF offline → schematic figures are included without basemap tiles.
17. Open/edit saved project offline → local data and analysis work; geocoder explains unavailability.
18. Trigger storage quota/worker/geocoder/tile/report errors in tests → user-authored data remains safe and the right error state appears.

---

# 14. Final Design Direction

NetScape should feel like a focused engineering workstation: a compact control frame around a large geographical or logical work surface, technical values presented in disciplined tables, and analysis tools exposed only when relevant. The dark palette is restrained; Electric Blue indicates interaction and selection; Cantaloupe Orange is rare contextual emphasis. The user should always know which project and design they are editing, which tool is active, whether the latest change is saved, whether an analysis is current, and what the model actually represents.

Do not turn the product into a generic SaaS dashboard. Do not add decorative features to make empty screens look busy. Do not invent capabilities to make the product appear more sophisticated. Build the smallest coherent interface that fully supports the approved NetScape MVP.
