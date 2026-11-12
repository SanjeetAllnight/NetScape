# NetScape — Release Notes (v1.0.0-rc1)

**Release:** NetScape MVP Release Candidate 1  
**Build Target:** Desktop-First Local-First Engineering Workstation  
**Date:** November 2026  
**License:** MIT (Academic & Engineering Demonstration)  

---

## 1. Product Overview

**NetScape** is a desktop-first, local-first engineering workstation designed for planning, designing, and validating campus and enterprise computer network infrastructure. It bridges the gap between geographical site maps, logical network diagrams, IP address calculators, RF propagation models, and equipment cost estimation.

With NetScape, network architects can plan physical cable runs, place wireless access points, lay out logical subnets, estimate multi-year Total Cost of Ownership (TCO), simulate failure scenarios, and generate production-ready engineering reports—all within a modern, zero-backend, browser-native application.

---

## 2. System Requirements & Compatibility

### Supported Browsers
| Browser | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Google Chrome / Chromium** | 115+ | 120+ | Recommended for optimal Web Worker and Canvas performance |
| **Microsoft Edge** | 115+ | 120+ | Full Chromium feature parity |
| **Mozilla Firefox** | 115+ (ESR) | 125+ | Fully supported |
| **Apple Safari** | 16.4+ | 17+ | Requires IndexedDB and Web Workers enabled |

### Hardware Recommendations
- **Display Resolution:** Minimum 1280 × 720 (Recommended: 1920 × 1080 or higher for dual-view workspace)
- **Memory (RAM):** Minimum 4 GB (Recommended: 8 GB for large coverage heatmaps)
- **Storage:** ~50 MB local IndexedDB allocation for 50+ projects with analysis blobs

---

## 3. Major Features by Module

### 3.1 Project & Workspace Management
- **Local-First Persistence:** Zero-cloud architecture. Projects, map regions, designs, devices, links, obstacles, and subnets are stored directly in browser IndexedDB via Dexie.js.
- **Atomic Project Lifecycle:** One-click project creation with conformal Azimuthal Equidistant (AEQD) projection frame.
- **Design Branching & Duplication:** Deep-clone any network design with topology reference remapping and independent revision tracking.
- **Deterministic DEMO Project Fixture:** One-click loading of a reference IISc Science Quad campus network, complete with boundary, obstacles, devices, subnets, and pre-computed analyses.

### 3.2 Geographical Map Workspace
- **True Metric Coordinate Frame:** Projects WGS84 latitude/longitude to a local Euclidean plane centered on the project origin, enabling true metric distance measurements without planar distortion.
- **Interactive Device Placement:** Place, move, inspect, and delete Gateway Routers, Distribution Switches, Access Switches, Access Points, and Servers.
- **Wired & Wireless Link Authoring:** Connect devices with single-mode fiber, multi-mode fiber, twisted-pair copper, and point-to-point wireless links with configurable port capacities.
- **Physical Obstacle Definition:** Draw custom building polygons with material-specific attenuation characteristics (concrete: 14 dB, brick: 8 dB, drywall: 4 dB).
- **Graceful Offline Map Fallback:** When internet connectivity is absent or tile servers are unreachable, the map cleanly transitions to a neutral engineering grid canvas without interrupting editing.

### 3.3 Logical Topology Editor
- **Dual-View Independence:** View and rearrange network devices and interconnects in a hierarchical node-link graph powered by ReactFlow.
- **Zero Coordinate Corruption:** Moving nodes in the logical topology updates presentation coordinates without altering geographical GPS positions or invalidating spatial engineering analyses.

### 3.4 IPv4 Addressing & VLSM Engine
- **Deterministic Subnet Allocation:** Allocates CIDR blocks according to RFC 1878 VLSM principles, sorting subnet requirements in descending host capacity order to minimize space wastage.
- **Address Space Utilization Metrics:** Real-time visibility into address space efficiency, assigned host counts, and unused host capacity.

### 3.5 Bill of Materials & Cost Analysis Engine
- **Comprehensive Financial Projection:** Deterministic calculation of Capital Expenditure (CAPEX), Annual Operational Expenditure (OPEX), and Total Cost of Ownership (TCO) across 1 to 10 year horizons.
- **Detailed Line-Item Breakdown:** Itemizes equipment unit rates, cabling length pricing, termination labour, civil conduit installation, and continuous power consumption.
- **Transparent Assumptions:** Discloses 100% continuous nameplate power draw and editable electricity tariffs (INR ₹8/kWh default).

### 3.6 Wireless Coverage & RF Propagation
- **2D Log-Distance Path Loss Model:** Computes realistic RF signal attenuation including distance-based path loss and multi-wall boundary penetration penalties.
- **Dedicated Web Worker Offloading:** 40×40 and 100×100 raster cell computations execute in background threads with cooperative cancellation, maintaining a 60 FPS UI.
- **5-Class Signal Distribution:** Classifies coverage from Excellent (> -65 dBm) down to Dead Zones (< -95 dBm) with clear metric area calculations.

### 3.7 Network Simulation & Failure Scenarios
- **Dijkstra Shortest-Path Forwarding:** Graph-theoretic routing simulation identifying bottleneck links and calculating flow latencies across propagation, transmission, and hop processing delays.
- **Failure Scenario Injection:** Test resilience by severing links or failing core nodes to assess traffic reachability, disconnected subnets, and rerouting feasibility.

### 3.8 Design Comparison
- **Objective Delta Analysis:** Side-by-side read-only inspection of two designs within a project, highlighting inventory counts, cable run lengths, budget deltas, coverage ratios, and simulation throughput.

### 3.9 Engineering Report Preview & Local PDF Download
- **9-Section Standard Report:** Complete document preview and downloadable A4 PDF adhering strictly to IEEE/enterprise documentation standards:
  1. Cover & Project/Design Summary
  2. Equipment Inventory & Interconnects Table
  3. Schematic Geographical Figure
  4. Logical Topology Schematic
  5. IPv4 Subnet Allocation & IP Plan
  6. Bill of Materials & Cost Breakdown
  7. Wireless Coverage Assessment
  8. Network Performance & Simulation Assessment
  9. Engineering Assumptions & Disclaimers
- **Synthetic Vector Schematics:** Figures are drawn directly from domain geometry via 2D canvas renderers; live Leaflet map tiles are never screenshotted.
- **Freshness Transparency:** Analysis sections explicitly display status badges (`[Current]`, `[Computed on an earlier version]`, or `[Not computed]`), preventing stale data ambiguity.

---

## 4. Architectural Fidelity Boundaries & Intentional Scope Limits

To maintain production reliability, mathematical rigor, and zero-hallucination execution, NetScape enforces clear engineering boundaries:

| Dimension | In Scope (Implemented) | Intentional Boundary / Out of Scope |
| :--- | :--- | :--- |
| **RF Propagation** | 2D log-distance path loss with polygon boundary crossing loss | 3D ray-tracing, multipath reflections, Fresnel zone clearance, and co-channel interference planning |
| **Network Simulation** | Deterministic Dijkstra shortest-path reachability, bottleneck capacity, and latency breakdown | Packet-level discrete-event simulation, M/M/1 queuing dynamics, and OSPF/BGP/RIP state-machine emulation |
| **Pricing & Costing** | Deterministic calculations based on vendor-neutral illustrative sample catalog in INR | Real-time distributor API lookups, automated tax localization, and procurement guarantees |
| **Map Rendering** | Local AEQD conformal metric projection, offline grid canvas fallback | Bulk offline tile scraping (forbade by OSM Tile Usage Policy) |
| **Storage & Sync** | Browser IndexedDB with revision conflict detection and `clearDerivedCache` | Cloud synchronization, user logins, and multi-tenant databases |

---

## 5. Storage Safety & Error Recovery Guarantees

1. **Sacred Authored Data:** User-authored projects, designs, devices, links, subnets, and obstacles are **never** deleted to free up storage space.
2. **Quota Pressure Recovery:** The `clearDerivedCache` routine purges only reproducible analysis caches and binary heatmap blobs, freeing up to 90% of database storage while leaving every project intact.
3. **Multi-Tab Conflict Protection:** If two browser tabs edit the same design concurrently, optimistic concurrency revision checks detect the conflict and reject the second commit with a `StorageError`, preventing silent data overwrites.
4. **Non-Blocking Service Worker Updates:** When a new application version is deployed, a gentle update toast prompts the user with *"Update Now"* or *"Later"*. Updates are never forced during active editing, calculation, or PDF generation.

---

## 6. Verification Evidence Summary

- **Total Unit & Integration Tests:** 161 tests across 23 test files (100% passing).
- **TypeScript Typecheck:** 0 errors (`tsc --noEmit` clean).
- **ESLint Cleanliness:** 0 errors (4 documented non-blocking Leaflet container hook warnings).
- **Dependency Cruiser:** 125 modules, 460 dependencies cruised, 0 architecture boundary violations.
- **Production Build:** 19 precached PWA assets, optimized vendor chunk splitting (`vendor-pdf`, `vendor-leaflet`, `vendor-db`, `vendor-icons`).

