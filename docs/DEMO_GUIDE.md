# NetScape — Demonstration & Viva Walkthrough Guide

**Document Version:** 1.0.0  
**Phase:** 4 — Reporting, Hardening & Release Preparation  
**Target Audience:** DCCN Course Examiners, Technical Evaluators, Peer Reviewers  
**Target Environment:** Local workstation (Chrome, Edge, Firefox, Safari) • Standalone PWA  

---

## 1. Executive Summary & Workstation Overview

**NetScape** is a local-first, map-based computer network infrastructure planning workstation built for network engineers, campus planners, and systems architects. It solves the fragmentation between geographical CAD maps, logical network diagrams, IP address calculators, RF heatmaps, and cost estimation spreadsheets by unifying them into an integrated, offline-capable engineering suite.

### Key Architectural Strengths to Highlight
1. **Local-First & Zero Backend:** All data resides in the user's browser via IndexedDB (Dexie.js). No account, login, or remote backend server required.
2. **Deterministic Engineering Engines:** IPv4/VLSM, Cost/TCO, 2D RF Log-Distance Coverage, and Dijkstra Network Simulation run purely client-side with zero probabilistic hallucinations.
3. **Dedicated Web Worker Offloading:** Heavy matrix computations (raster coverage and path finding) run on background threads with cooperative cancellation, preserving a smooth 60 FPS UI.
4. **Synthetic Vector Schematic Reporting:** PDF generation synthesizes vector schematics directly from domain coordinates; it **never** captures lossy raster screenshots of the live Leaflet map.

---

## 2. Pre-Flight Preparation & Environment Setup

### Prerequisites
- Node.js `v24.x LTS` and npm `11.x`
- Chromium-based browser (Chrome, Edge, Brave) or Firefox / Safari

### Launching the Application
```bash
# 1. Clone repository and navigate to root
cd /home/sanjeet/Projects/NetScape

# 2. Start local production preview server
npm run preview
# Open URL (typically http://localhost:4173) in your browser
```

### Demonstrating Offline Capability
1. Open Developer Tools (`F12` or `Ctrl+Shift+I`).
2. Navigate to the **Network** tab.
3. In the throttling dropdown, select **Offline**.
4. Observe the **"Offline — local mode"** pill in the top header.
5. All local editing, calculations, simulation, comparison, and PDF generation continue to function seamlessly without any network requests.

---

## 3. Step-by-Step Viva Demonstration Script (9 Steps)

### Step 1: Projects Dashboard & Demo Project Loading
- **Action:** Open the root URL (`#/`). In the empty or existing projects dashboard, click the **"Load Demo Project"** button (marked with the blue Sparkles icon).
- **Observation:** The workstation automatically populates the deterministic reference campus project: *"DEMO: Engineering Campus Workstation"* (IISc Science Quad) and navigates straight into the design map workspace.
- **Talking Points:**
  - *"NetScape avoids blank-canvas friction by providing a reproducible, real-world educational campus network model with pre-populated devices, links, obstacles, subnets, and analyses."*
  - *"Notice the storage status indicator: 'Saved to browser'. Every authored mutation is atomically committed to IndexedDB."*

---

### Step 2: Geographic Map Workspace & Coordinate Projection
- **Action:** Inspect the Map Workspace. Zoom in on the central quad.
- **Observation:**
  - **Planning Boundary:** Blue dashed polygon enclosing the 120m × 100m campus quad.
  - **Physical Obstacles:** Solid polygons for the *"Central Library Building"* (concrete, 14 dB loss) and *"Administrative Wing"* (brick, 8 dB loss).
  - **Network Equipment:** 6 physical devices placed in realistic campus locations:
    - *Gateway Core Router* (Server room)
    - *Campus Intranet Server*
    - *Main Distribution Switch*
    - *Academic Block Switch*
    - *Science Quad Access Point* (outdoor Wi-Fi)
    - *Library Wing Access Point* (indoor Wi-Fi)
  - **Interconnect Links:** Single-mode fiber cables (purple) and Cat6A copper links (cyan).
- **Talking Points:**
  - *"NetScape uses an Azimuthal Equidistant (AEQD) projection centered on the project origin. This converts WGS84 spherical coordinates into a conformal Cartesian metric frame, ensuring true Euclidean distance (meters) and obstacle intersection testing without planar distortion."*

---

### Step 3: Dual-View Independence — Logical Topology Workspace
- **Action:** In the top header tabs, click **"Topology"**. Drag the *Academic Block Switch* or *Library AP* node to a new position. Switch back to **"Map"**, then return to **"Topology"**.
- **Observation:**
  - The logical view displays the exact same devices and links in a hierarchical tree layout powered by ReactFlow.
  - Moving a node in the logical view updates its visual position in the diagram, but **does not** change its geographical GPS coordinates on the map or invalidate RF coverage analyses.
- **Talking Points:**
  - *"A critical design principle of NetScape is Dual-View Separation. Physical location dictates RF propagation, cable run lengths, and wall crossings. Logical topology dictates subnet domains, VLANs, and forwarding trees. Users can freely lay out clean schematics without corrupting physical real-world coordinates."*

---

### Step 4: IPv4 Addressing & VLSM Subnet Allocation
- **Action:** Click the **"Addressing"** tab. Inspect the Parent Network (`10.10.0.0/16`) and Subnet table.
- **Observation:**
  - **Infrastructure Management LAN:** 14 hosts required → Allocated CIDR `10.10.1.0/28` (14 usable hosts, 0 wasted, 100% efficiency).
  - **Academic Block Wired LAN:** 100 hosts required → Allocated CIDR `10.10.2.0/25` (126 usable hosts, 26 wasted).
  - **Campus High-Density Wi-Fi:** 500 hosts required → Allocated CIDR `10.10.4.0/23` (510 usable hosts, 10 wasted).
  - Address space utilization and fragmentation metrics are clearly summarized.
- **Talking Points:**
  - *"NetScape implements a pure RFC 1878 VLSM allocation algorithm. It sorts subnet demands in descending host order to minimize fragmentation and computes bitmask boundaries deterministically."*

---

### Step 5: Bill of Materials & Cost Analysis (CAPEX, OPEX, TCO)
- **Action:** Click the **"Cost"** tab.
- **Observation:**
  - **CAPEX Breakdown:** Hardware equipment (₹88,000), cabling infrastructure (₹26,000), and civil installation labour (₹40,000) totaling ₹1,54,000.
  - **Annual OPEX:** Continuous power draw based on device wattage and local electricity tariff (₹8/kWh), plus vendor maintenance contracts totaling ₹28,500/year.
  - **5-Year TCO:** ₹2,96,500 total cost of ownership.
  - Line-item table breaks down unit rates, quantities, and price provenances.
- **Talking Points:**
  - *"All financial projections use standard Indian Rupee (INR) defaults with transparent assumptions: 100% continuous nameplate power duty cycle and user-editable tariff rates. NetScape clearly labels all figures as engineering estimates, avoiding procurement ambiguity."*

---

### Step 6: Wireless Coverage Heatmap & RF Path Loss Engine
- **Action:** Return to the **"Map"** view. Toggle the **"Coverage"** overlay layer.
- **Observation:**
  - A color-coded signal intensity raster (40×40 grid, 2m cell resolution) renders smoothly over the campus quad.
  - Signal classes are rendered across 5 standard tiers:
    - Excellent (> -65 dBm, Emerald)
    - Good (-65 to -75 dBm, Cyan)
    - Fair (-75 to -85 dBm, Amber)
    - Weak (-85 to -95 dBm, Red)
    - Dead Zone (< -95 dBm, Magenta/Black)
  - Notice the shadow/dead zone behind the concrete Library Building caused by the 14 dB wall crossing penalty.
- **Talking Points:**
  - *"The wireless engine implements a 2D log-distance path loss model with multi-wall crossing attenuation. Grid computations run inside a background Web Worker, maintaining a responsive UI even when calculating tens of thousands of cells."*

---

### Step 7: Network Simulation & Failure Scenario Analysis
- **Action:** Click the **"Simulation"** tab. Inspect the baseline metrics. Under Scenarios, inspect the *"Main to Academic Fiber Cut"* failure scenario.
- **Observation:**
  - **Baseline:** 3 flows offering 350 Mbps demand. 100% reachability, mean latency 0.88 ms (propagation, transmission, and hop processing delays).
  - **Failure Scenario:** The underground fiber between Main Switch and Academic Switch is severed.
  - Flows to the Academic LAN and Library AP become unreachable, while Quad Wi-Fi and Core Management traffic continue uninterrupted.
  - The impact is immediately highlighted with red warning badges and bottleneck indicators.
- **Talking Points:**
  - *"NetScape models forwarding behavior using graph-theoretic Dijkstra shortest-path algorithms. It computes deterministic per-flow latency breakdowns and isolates failure domains without resorting to unrealistic toy packet animations."*

---

### Step 8: Read-Only Design Comparison
- **Action:** Navigate back to the Project Overview and click **"Compare Designs"**. Compare *Baseline Design* with an alternate design (or duplicate the baseline to compare).
- **Observation:**
  - A side-by-side comparison matrix summarizes inventory count deltas, total link distance, CAPEX differences, coverage ratio changes, and simulation reachability.
- **Talking Points:**
  - *"Network architects frequently evaluate tradeoffs between budget and redundancy. NetScape's design comparison provides an objective, side-by-side engineering delta view without modifying either design."*

---

### Step 9: Engineering Report Preview & Local PDF Download
- **Action:** Click the **"Report"** tab in the workspace header.
- **Observation:**
  - Complete preview layout featuring:
    - Left Table of Contents navigation rail (Cover, Inventory, Geo Schematic, Logical Topology, Addressing, Cost, Coverage, Simulation, Assumptions).
    - Status badges indicating whether each analysis is `[Current]`, `[Out of Date]`, or `[Not Computed]`.
    - Pure vector schematics for the Geographic layout, Topology graph, and Coverage heatmap.
  - Click **"Download PDF"**.
  - Open the generated PDF in any standard PDF viewer.
- **Talking Points:**
  - *"The PDF is generated entirely in the browser using jsPDF and custom 2D canvas drawing routines. Notice that the geographical figure is an architecturally clean vector schematic—not a raster screenshot of OpenStreetMap tiles. Stale or missing analyses are explicitly disclaimed, ensuring professional engineering integrity."*

---

## 4. Key Defense Answers & Technical Justifications

| Examiner Question | Technical Defense / Architecture Rationale |
| :--- | :--- |
| **Why not store files in cloud / Firebase?** | NetScape is designed for mission-critical and defense/campus environments where network plans contain sensitive infrastructure layouts. A local-first Dexie/IndexedDB storage model ensures zero data leakage, immediate offline availability, and zero infrastructure operating costs. |
| **Why 2D log-distance instead of 3D ray-tracing?** | Full 3D ray-tracing requires detailed BIM CAD models and GPU shaders, which are unavailable in a web browser. A 2D log-distance model with wall crossing loss provides 90%+ engineering planning utility with sub-50ms execution times. |
| **Why not use Leaflet canvas screenshots for the PDF?** | Screenshots capture raster tile artifacts, zoom-dependent UI controls, and third-party copyright issues. NetScape's synthetic schematic renderer draws directly from the conformal project coordinate frame, producing high-resolution, vector-crisp engineering figures suitable for print. |
| **How does NetScape prevent data loss when browser storage is full?** | NetScape enforces a strict storage hierarchy. Authored project entities (projects, designs, devices, links) are sacred and **never** purged. When quota pressure occurs, the `clearDerivedCache` API removes only reproducible analysis caches and binary blobs. |
| **Why Dijkstra instead of dynamic OSPF/BGP simulation?** | NetScape is an infrastructure planning workstation, not a protocol state-machine emulator (like GNS3 or Packet Tracer). Dijkstra models steady-state reachability, shortest-path latency, and capacity bottlenecks with 100% mathematical determinism. |
