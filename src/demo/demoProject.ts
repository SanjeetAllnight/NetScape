/**
 * Reproducible DEMO Project Fixture.
 * Authoritative source: docs/SYSTEM_ARCHITECTURE.md §16.3, Phase 4 P4-05
 *
 * Pre-configured reference design representing an educational campus network.
 * Includes campus boundary, physical obstacles, hierarchical devices, wired &
 * wireless interconnects, VLSM subnets, and pre-calculated analysis records.
 * Conspicuously labeled DEMO; never auto-injected without explicit user action.
 */

import type { Repositories } from "@/contracts/storage";
import type { ProjectService } from "@/contracts/services";
import { makeGeoPoint, makeLonLat } from "@/domain/geo/localFrame";
import { BUILTIN_CATALOG_SEED } from "@/contracts/constants";
import type {
  ProjectId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  AnalysisId,
  AnalysisBlobId,
  FlowId,
  FailureScenarioId,
  EpochMs,
  IPv4Cidr,
  GeoPolygon,
} from "@/contracts/primitives";
import type {
  Device,
  Link,
  Subnet,
  Obstacle,
} from "@/contracts/domain";
import type { DesignChangeSet } from "@/contracts/commands";
import type {
  CostEstimate,
  CoverageResult,
  SimulationResult,
  AnalysisRecord,
  AnalysisBlob,
} from "@/contracts/engines";

export async function loadDemoProject(
  projectService: ProjectService,
  repos: Repositories
): Promise<{ projectId: ProjectId; baselineDesignId: DesignId }> {
  const centerLng = 77.5665;
  const centerLat = 13.0165;

  // 1. Create project with IISc Bangalore Campus coordinates
  const { projectId, baselineDesignId } = await projectService.createProject({
    name: "DEMO: Engineering Campus Workstation",
    description:
      "Pre-configured reference network design for demonstration. Features campus boundary, physical obstacles, hierarchical switching, dual-band Wi-Fi, VLSM subnets, and pre-calculated analyses.",
    initialRegion: {
      label: "IISc Science Quad",
      center: makeGeoPoint(centerLng, centerLat),
      bbox: null,
    },
  });

  const now = Date.now() as EpochMs;

  // 2. Planning boundary (120m x 100m Quad)
  const boundary: GeoPolygon = {
    type: "Polygon",
    coordinates: [
      [
        makeLonLat(centerLng - 0.0006, centerLat - 0.0004),
        makeLonLat(centerLng + 0.0006, centerLat - 0.0004),
        makeLonLat(centerLng + 0.0006, centerLat + 0.0004),
        makeLonLat(centerLng - 0.0006, centerLat + 0.0004),
        makeLonLat(centerLng - 0.0006, centerLat - 0.0004),
      ],
    ],
  };

  // 3. Obstacles (Library Building & Administrative Wing)
  const obsLibrary: Obstacle = {
    id: `obs_demo_lib_${Date.now()}` as ObstacleId,
    projectId,
    label: "Central Library Building",
    material: "concrete",
    lossDbPerCrossing: 14,
    source: "manual",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          makeLonLat(centerLng + 0.0001, centerLat + 0.0001),
          makeLonLat(centerLng + 0.0004, centerLat + 0.0001),
          makeLonLat(centerLng + 0.0004, centerLat + 0.0003),
          makeLonLat(centerLng + 0.0001, centerLat + 0.0003),
          makeLonLat(centerLng + 0.0001, centerLat + 0.0001),
        ],
      ],
    },
    createdAt: now,
    updatedAt: now,
  };

  const obsAdmin: Obstacle = {
    id: `obs_demo_admin_${Date.now()}` as ObstacleId,
    projectId,
    label: "Administrative Wing",
    material: "brick",
    lossDbPerCrossing: 8,
    source: "manual",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          makeLonLat(centerLng - 0.0005, centerLat - 0.0003),
          makeLonLat(centerLng - 0.0002, centerLat - 0.0003),
          makeLonLat(centerLng - 0.0002, centerLat - 0.0001),
          makeLonLat(centerLng - 0.0005, centerLat - 0.0001),
          makeLonLat(centerLng - 0.0005, centerLat - 0.0003),
        ],
      ],
    },
    createdAt: now,
    updatedAt: now,
  };

  // 4. Catalog references
  const routerCat = BUILTIN_CATALOG_SEED[0]!;
  const switchCat = BUILTIN_CATALOG_SEED[1]!;
  const apCat = BUILTIN_CATALOG_SEED[2]!;
  const serverCat = BUILTIN_CATALOG_SEED[3]!;

  // 5. Hardware Devices
  const devRouter: Device = {
    id: `dev_rtr_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: routerCat.id,
    type: "router",
    name: "Gateway Core Router",
    hostname: "gw-core.campus.iisc.ac.in",
    notes: "Main edge router with BGP uplink",
    position: makeGeoPoint(centerLng - 0.0001, centerLat + 0.0002),
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };

  const devMainSwitch: Device = {
    id: `dev_sw_main_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: switchCat.id,
    type: "switch",
    name: "Main Distribution Switch",
    hostname: "sw-dist-01.campus.iisc.ac.in",
    notes: "24-port Gigabit distribution switch",
    position: makeGeoPoint(centerLng - 0.0001, centerLat),
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };

  const devAcadSwitch: Device = {
    id: `dev_sw_acad_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: switchCat.id,
    type: "switch",
    name: "Academic Block Switch",
    hostname: "sw-acad-01.campus.iisc.ac.in",
    notes: "Academic building access switch",
    position: makeGeoPoint(centerLng + 0.0003, centerLat),
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };

  const devQuadAp: Device = {
    id: `dev_ap_quad_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: apCat.id,
    type: "accessPoint",
    name: "Science Quad Access Point",
    hostname: "ap-quad.campus.iisc.ac.in",
    notes: "Outdoor high-gain AP",
    position: makeGeoPoint(centerLng - 0.0003, centerLat - 0.0001),
    overrides: { radio: { txPowerDbm: 20 } },
    createdAt: now,
    updatedAt: now,
  };

  const devLibAp: Device = {
    id: `dev_ap_lib_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: apCat.id,
    type: "accessPoint",
    name: "Library Wing Access Point",
    hostname: "ap-lib.campus.iisc.ac.in",
    notes: "Indoor dual-band AP",
    position: makeGeoPoint(centerLng + 0.00025, centerLat + 0.0002),
    overrides: { radio: { txPowerDbm: 18 } },
    createdAt: now,
    updatedAt: now,
  };

  const devServer: Device = {
    id: `dev_srv_${Date.now()}` as DeviceId,
    designId: baselineDesignId,
    catalogItemId: serverCat.id,
    type: "server",
    name: "Campus Intranet Server",
    hostname: "srv-app01.campus.iisc.ac.in",
    notes: "DNS, DHCP and intranet portal host",
    position: makeGeoPoint(centerLng - 0.0003, centerLat + 0.0002),
    overrides: {},
    createdAt: now,
    updatedAt: now,
  };

  const devices = [
    devRouter,
    devMainSwitch,
    devAcadSwitch,
    devQuadAp,
    devLibAp,
    devServer,
  ];

  // 6. Network Links
  const linkRtrToMain: Link = {
    id: `link_rtr_main_${Date.now()}` as LinkId,
    designId: baselineDesignId,
    sourceDeviceId: devRouter.id,
    targetDeviceId: devMainSwitch.id,
    medium: "fiber",
    installationMethod: "indoor",
    geometry: {
      type: "LineString",
      coordinates: [devRouter.position.coordinates, devMainSwitch.position.coordinates],
    },
    lengthOverrideM: null,
    capacityMbps: 10000,
    routingWeight: 1,
    createdAt: now,
    updatedAt: now,
  };

  const linkMainToAcad: Link = {
    id: `link_main_acad_${Date.now()}` as LinkId,
    designId: baselineDesignId,
    sourceDeviceId: devMainSwitch.id,
    targetDeviceId: devAcadSwitch.id,
    medium: "fiber",
    installationMethod: "underground",
    geometry: {
      type: "LineString",
      coordinates: [devMainSwitch.position.coordinates, devAcadSwitch.position.coordinates],
    },
    lengthOverrideM: null,
    capacityMbps: 10000,
    routingWeight: 1,
    createdAt: now,
    updatedAt: now,
  };

  const linkMainToQuadAp: Link = {
    id: `link_main_quadap_${Date.now()}` as LinkId,
    designId: baselineDesignId,
    sourceDeviceId: devMainSwitch.id,
    targetDeviceId: devQuadAp.id,
    medium: "copper",
    installationMethod: "underground",
    geometry: {
      type: "LineString",
      coordinates: [devMainSwitch.position.coordinates, devQuadAp.position.coordinates],
    },
    lengthOverrideM: null,
    capacityMbps: 1000,
    routingWeight: 1,
    createdAt: now,
    updatedAt: now,
  };

  const linkAcadToLibAp: Link = {
    id: `link_acad_libap_${Date.now()}` as LinkId,
    designId: baselineDesignId,
    sourceDeviceId: devAcadSwitch.id,
    targetDeviceId: devLibAp.id,
    medium: "copper",
    installationMethod: "indoor",
    geometry: {
      type: "LineString",
      coordinates: [devAcadSwitch.position.coordinates, devLibAp.position.coordinates],
    },
    lengthOverrideM: null,
    capacityMbps: 1000,
    routingWeight: 1,
    createdAt: now,
    updatedAt: now,
  };

  const linkRtrToServer: Link = {
    id: `link_rtr_srv_${Date.now()}` as LinkId,
    designId: baselineDesignId,
    sourceDeviceId: devRouter.id,
    targetDeviceId: devServer.id,
    medium: "copper",
    installationMethod: "indoor",
    geometry: {
      type: "LineString",
      coordinates: [devRouter.position.coordinates, devServer.position.coordinates],
    },
    lengthOverrideM: null,
    capacityMbps: 1000,
    routingWeight: 1,
    createdAt: now,
    updatedAt: now,
  };

  const links = [
    linkRtrToMain,
    linkMainToAcad,
    linkMainToQuadAp,
    linkAcadToLibAp,
    linkRtrToServer,
  ];

  // 7. Subnets & IP Plan
  const subMgmt: Subnet = {
    id: `sub_mgmt_${Date.now()}` as SubnetId,
    designId: baselineDesignId,
    name: "Infrastructure Management LAN",
    hostsRequired: 14,
    servedByDeviceId: devRouter.id,
    linkId: null,
    allocatedCidr: "10.10.1.0/28" as IPv4Cidr,
    usableHostCapacity: 14,
    wastedUsableHosts: 0,
    allocationStatus: "current",
    createdAt: now,
    updatedAt: now,
  };

  const subAcad: Subnet = {
    id: `sub_acad_${Date.now()}` as SubnetId,
    designId: baselineDesignId,
    name: "Academic Block Wired LAN",
    hostsRequired: 100,
    servedByDeviceId: devAcadSwitch.id,
    linkId: null,
    allocatedCidr: "10.10.2.0/25" as IPv4Cidr,
    usableHostCapacity: 126,
    wastedUsableHosts: 26,
    allocationStatus: "current",
    createdAt: now,
    updatedAt: now,
  };

  const subWifi: Subnet = {
    id: `sub_wifi_${Date.now()}` as SubnetId,
    designId: baselineDesignId,
    name: "Campus High-Density Wi-Fi",
    hostsRequired: 500,
    servedByDeviceId: devMainSwitch.id,
    linkId: null,
    allocatedCidr: "10.10.4.0/23" as IPv4Cidr,
    usableHostCapacity: 510,
    wastedUsableHosts: 10,
    allocationStatus: "current",
    createdAt: now,
    updatedAt: now,
  };

  const subnets = [subMgmt, subAcad, subWifi];

  // 8. Logical Topology Layout (Top-down hierarchical tree)
  const logicalLayout = {
    [devRouter.id]: { x: 300, y: 50, coordinateSpace: "logical" as const },
    [devServer.id]: { x: 100, y: 50, coordinateSpace: "logical" as const },
    [devMainSwitch.id]: { x: 300, y: 160, coordinateSpace: "logical" as const },
    [devAcadSwitch.id]: { x: 500, y: 160, coordinateSpace: "logical" as const },
    [devQuadAp.id]: { x: 200, y: 280, coordinateSpace: "logical" as const },
    [devLibAp.id]: { x: 500, y: 280, coordinateSpace: "logical" as const },
  };

  // Commit all baseline entities in single batch
  const initialAgg = (await repos.designs.loadAggregate(baselineDesignId))!;
  const changeSet: DesignChangeSet = {
    project: null,
    region: {
      ...initialAgg.region,
      boundary,
    },
    design: {
      ...initialAgg.design,
      logicalLayout,
      addressing: {
        parentCidr: "10.10.0.0/16" as IPv4Cidr,
        allocationStatus: "current",
        lastAllocatedAt: now,
      },
    },
    upsertDevices: devices,
    deleteDeviceIds: [],
    upsertLinks: links,
    deleteLinkIds: [],
    upsertSubnets: subnets,
    deleteSubnetIds: [],
    upsertObstacles: [obsLibrary, obsAdmin],
    deleteObstacleIds: [],
    affectedAnalysisTypes: ["cost", "coverage", "simulation"],
    validationIssues: [],
  };

  await repos.designs.commit(changeSet, {
    projectRevision: initialAgg.project.revision,
    designRevision: initialAgg.design.revision,
  });

  // 9. Pre-calculate Analysis Inputs and Save Cached Records
  const agg = (await repos.designs.loadAggregate(baselineDesignId))!;

  // Cost Engine Record
  const costHash = `hash_cost_demo_${Date.now()}` as never;
  const mockCost: CostEstimate = {
    isEstimate: true,
    currency: "INR",
    completeness: "complete",
    capex: {
      knownSubtotal: { amount: 154000, currency: "INR" },
      total: { amount: 154000, currency: "INR" },
      completeness: "complete",
    },
    annualOpex: {
      knownSubtotal: { amount: 28500, currency: "INR" },
      total: { amount: 28500, currency: "INR" },
      completeness: "complete",
    },
    tco: {
      knownSubtotal: { amount: 296500, currency: "INR" },
      total: { amount: 296500, currency: "INR" },
      completeness: "complete",
    },
    tcoHorizonYears: 5,
    byCategory: {
      hardware: { amount: 88000, currency: "INR" },
      cabling: { amount: 26000, currency: "INR" },
      labour: { amount: 40000, currency: "INR" },
      energy: { amount: 14500, currency: "INR" },
      maintenance: { amount: 14000, currency: "INR" },
    },
    lineItems: [
      {
        id: "item_1",
        category: "hardware",
        label: "Gateway Core Router (1U Rackmount)",
        quantity: 1,
        unit: "device",
        unitPrice: { amount: 8000, currency: "INR" },
        amount: { amount: 8000, currency: "INR" },
        provenance: "sample",
        sourceEntityId: devRouter.id,
        note: null,
      },
      {
        id: "item_2",
        category: "hardware",
        label: "EdgeSwitch 24 (24 Copper, 2 Fiber)",
        quantity: 2,
        unit: "device",
        unitPrice: { amount: 6000, currency: "INR" },
        amount: { amount: 12000, currency: "INR" },
        provenance: "sample",
        sourceEntityId: devMainSwitch.id,
        note: null,
      },
      {
        id: "item_3",
        category: "hardware",
        label: "AirWave Pro Dual-Band AP",
        quantity: 2,
        unit: "device",
        unitPrice: { amount: 4500, currency: "INR" },
        amount: { amount: 9000, currency: "INR" },
        provenance: "sample",
        sourceEntityId: devQuadAp.id,
        note: null,
      },
      {
        id: "item_4",
        category: "cabling",
        label: "Single-mode Fiber Optic Interconnect",
        quantity: 180,
        unit: "m",
        unitPrice: { amount: 80, currency: "INR" },
        amount: { amount: 14400, currency: "INR" },
        provenance: "sample",
        sourceEntityId: linkMainToAcad.id,
        note: null,
      },
      {
        id: "item_5",
        category: "cabling",
        label: "Category 6A Shielded Twisted Pair Cable",
        quantity: 140,
        unit: "m",
        unitPrice: { amount: 40, currency: "INR" },
        amount: { amount: 5600, currency: "INR" },
        provenance: "sample",
        sourceEntityId: linkMainToQuadAp.id,
        note: null,
      },
    ],
    issues: [],
    assumptions: {
      settings: agg.project.settings.cost,
      devicePowerDutyRatio: 1,
    },
  };

  const costRec: AnalysisRecord = {
    id: `ana_cost_demo_${Date.now()}` as AnalysisId,
    projectId,
    designId: baselineDesignId,
    type: "cost",
    engineId: "cost",
    engineVersion: 1,
    inputHash: costHash,
    parameters: { type: "cost", settings: agg.project.settings.cost },
    isEstimate: true,
    computedAt: now,
    result: mockCost,
  };
  await repos.analyses.put(costRec);

  // Coverage Engine Record & Heatmap Blob
  const covHash = `hash_cov_demo_${Date.now()}` as never;
  const blobId = `blob_cov_demo_${Date.now()}` as AnalysisBlobId;
  const rasterW = 30;
  const rasterH = 25;
  const cellCount = rasterW * rasterH;

  const rssiArray = new Int8Array(cellCount);
  const servingIdx = new Uint8Array(cellCount);

  for (let r = 0; r < rasterH; r++) {
    for (let c = 0; c < rasterW; c++) {
      const idx = r * rasterW + c;
      const distToAp1 = Math.hypot(c - 8, r - 12);
      const distToAp2 = Math.hypot(c - 22, r - 6);

      let signal = -50 - Math.min(distToAp1, distToAp2) * 2.5;
      if (c > 18 && c < 26 && r > 12 && r < 18) {
        signal -= 18;
      }

      rssiArray[idx] = Math.round(Math.max(-100, Math.min(-40, signal)));
      servingIdx[idx] = distToAp1 < distToAp2 ? 0 : 1;
    }
  }

  const covBlob: AnalysisBlob = {
    id: blobId,
    analysisId: `ana_cov_demo_${Date.now()}` as AnalysisId,
    projectId,
    designId: baselineDesignId,
    width: rasterW,
    height: rasterH,
    rssiDbm: rssiArray,
    servingIndex: servingIdx,
    servingAccessPointIds: [devQuadAp.id, devLibAp.id],
    createdAt: now,
  };

  const mockCov: CoverageResult = {
    isEstimate: true,
    model: "logDistance",
    coveragePercent: 88.4,
    minimumAcceptableRssiDbm: -75,
    includedCellCount: cellCount,
    coveredCellCount: Math.round(cellCount * 0.884),
    classCounts: [
      { class: "excellent", cellCount: 280, areaM2: 1120 },
      { class: "good", cellCount: 260, areaM2: 1040 },
      { class: "fair", cellCount: 123, areaM2: 492 },
      { class: "weak", cellCount: 52, areaM2: 208 },
      { class: "deadZone", cellCount: 35, areaM2: 140 },
    ],
    deadZones: [
      {
        id: "dz_1",
        centroidLocalM: { x: 22, y: 15, coordinateSpace: "projectMetric" },
        boundsLocalM: { minX: 18, maxX: 26, minY: 12, maxY: 18 },
        areaM2: 140,
        cellCount: 35,
        worstRssiDbm: -92,
      },
    ],
    grid: {
      blobId,
      width: rasterW,
      height: rasterH,
      cellSizeM: 2,
      topLeftLocalM: { x: -60, y: 50, coordinateSpace: "projectMetric" },
      totalIncludedCells: cellCount,
      rasterEncoding: "int8-rssi-dBm",
      servingIndexEncoding: "uint8-access-point-index-with-mask-sentinels",
      noSignalRssiDbm: -127,
      outsideMaskIndex: 254,
      noServingIndex: 255,
    },
    parameters: agg.project.settings.coverage,
    referenceReceiverGainDbi: 0,
    limitationNotes: [
      "2D empirical log-distance path loss approximation.",
      "Concrete building models apply 14 dB transmission attenuation.",
    ],
  };

  const covRec: AnalysisRecord = {
    id: `ana_cov_demo_${Date.now()}` as AnalysisId,
    projectId,
    designId: baselineDesignId,
    type: "coverage",
    engineId: "coverage",
    engineVersion: 1,
    inputHash: covHash,
    parameters: { type: "coverage", settings: agg.project.settings.coverage },
    isEstimate: true,
    computedAt: now,
    result: mockCov,
  };
  await repos.analyses.put(covRec, covBlob);

  // Simulation Engine Record with 1 Failure Scenario
  const simHash = `hash_sim_demo_${Date.now()}` as never;
  const failureScenarioId = `sc_acad_fiber_cut_${Date.now()}` as FailureScenarioId;

  const mockSim: SimulationResult = {
    isEstimate: true,
    routingAlgorithm: "dijkstra",
    graphModel: "undirected",
    baselineMetrics: {
      totalFlowCount: 3,
      reachableFlowCount: 3,
      unreachableFlowCount: 0,
      incompleteFlowCount: 0,
      completeness: "complete",
      aggregateOfferedDemandMbps: 350,
      aggregateDeliveredRateMbps: 350,
      meanReachableLatencyMs: 0.88,
      maxReachableLatencyMs: 1.15,
      latencyFlowCount: 3,
      linkUtilization: [
        {
          linkId: linkRtrToMain.id,
          capacityMbps: 10000,
          offeredLoadMbps: 350,
          deliveredLoadMbps: 350,
          utilizationRatio: 0.035,
          isCongested: false,
        },
        {
          linkId: linkMainToAcad.id,
          capacityMbps: 10000,
          offeredLoadMbps: 150,
          deliveredLoadMbps: 150,
          utilizationRatio: 0.015,
          isCongested: false,
        },
      ],
    },
    baselineFlows: [
      {
        flowId: `flow_mgmt_${Date.now()}` as FlowId,
        sourceSubnetId: subMgmt.id,
        sourceDeviceId: devRouter.id,
        destinationDeviceId: devMainSwitch.id,
        reachable: true,
        unreachableReason: null,
        throughputCompleteness: "complete",
        pathDeviceIds: [devRouter.id, devMainSwitch.id],
        pathLinkIds: [linkRtrToMain.id],
        hopCount: 1,
        offeredDemandMbps: 20,
        bottleneckCapacityMbps: 10000,
        deliveredRateMbps: 20,
        latency: {
          propagationMs: 0.001,
          transmissionMs: 0.05,
          processingMs: 0.05,
          queueingMs: null,
          totalMs: 0.101,
        },
        issues: [],
      },
      {
        flowId: `flow_acad_${Date.now()}` as FlowId,
        sourceSubnetId: subAcad.id,
        sourceDeviceId: devAcadSwitch.id,
        destinationDeviceId: devServer.id,
        reachable: true,
        unreachableReason: null,
        throughputCompleteness: "complete",
        pathDeviceIds: [devAcadSwitch.id, devMainSwitch.id, devRouter.id, devServer.id],
        pathLinkIds: [linkMainToAcad.id, linkRtrToMain.id, linkRtrToServer.id],
        hopCount: 3,
        offeredDemandMbps: 150,
        bottleneckCapacityMbps: 1000,
        deliveredRateMbps: 150,
        latency: {
          propagationMs: 0.003,
          transmissionMs: 0.8,
          processingMs: 0.15,
          queueingMs: null,
          totalMs: 0.953,
        },
        issues: [],
      },
      {
        flowId: `flow_wifi_${Date.now()}` as FlowId,
        sourceSubnetId: subWifi.id,
        sourceDeviceId: devMainSwitch.id,
        destinationDeviceId: devServer.id,
        reachable: true,
        unreachableReason: null,
        throughputCompleteness: "complete",
        pathDeviceIds: [devMainSwitch.id, devRouter.id, devServer.id],
        pathLinkIds: [linkRtrToMain.id, linkRtrToServer.id],
        hopCount: 2,
        offeredDemandMbps: 180,
        bottleneckCapacityMbps: 1000,
        deliveredRateMbps: 180,
        latency: {
          propagationMs: 0.002,
          transmissionMs: 0.65,
          processingMs: 0.1,
          queueingMs: null,
          totalMs: 0.752,
        },
        issues: [],
      },
    ],
    scenarios: [
      {
        scenarioId: failureScenarioId,
        name: "Main to Academic Fiber Cut",
        failedDeviceIds: [],
        failedLinkIds: [linkMainToAcad.id],
        metrics: {
          totalFlowCount: 3,
          reachableFlowCount: 2,
          unreachableFlowCount: 1,
          incompleteFlowCount: 0,
          completeness: "complete",
          aggregateOfferedDemandMbps: 350,
          aggregateDeliveredRateMbps: 200,
          meanReachableLatencyMs: 0.42,
          maxReachableLatencyMs: 0.752,
          latencyFlowCount: 2,
          linkUtilization: [],
        },
        flowResults: [],
        comparisonToBaseline: {
          scenarioId: failureScenarioId,
          metrics: [],
          flows: [],
        },
      },
    ],
    assumptions: agg.project.settings.simulation,
    limitations: [
      "Shortest-path Dijkstra forwarding without M/M/1 queuing model.",
      "Fixed 100% offered demand delivery up to bottleneck link capacity.",
    ],
  };

  const simRec: AnalysisRecord = {
    id: `ana_sim_demo_${Date.now()}` as AnalysisId,
    projectId,
    designId: baselineDesignId,
    type: "simulation",
    engineId: "simulation",
    engineVersion: 1,
    inputHash: simHash,
    parameters: {
      type: "simulation",
      settings: agg.project.settings.simulation,
      setup: {
        flows: [],
        failureScenarios: [
          {
            id: failureScenarioId,
            name: "Main to Academic Fiber Cut",
            failedDeviceIds: [],
            failedLinkIds: [linkMainToAcad.id],
          },
        ],
      },
    },
    isEstimate: true,
    computedAt: now,
    result: mockSim,
  };
  await repos.analyses.put(simRec);

  return { projectId, baselineDesignId };
}
