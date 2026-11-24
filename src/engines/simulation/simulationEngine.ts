/**
 * Pure deterministic Network Simulation Engine.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §10.5, §19.2, §19.5
 *
 * Implements:
 * - Undirected graph representation of network topology
 * - Dijkstra shortest-path with deterministic lexicographic tie-breaking (SIM-01, SIM-02)
 * - Failure injection for devices and links (SIM-03)
 * - Delay components: propagation, transmission, intermediate-hop processing (SIM-04)
 * - Bottleneck capacity and equal-share flow rate allocation (SIM-05, SIM-06)
 * - Link utilization and capacity congestion indicators
 * - Scenario delta comparisons against baseline
 */

import type { DeviceId, LinkId, FlowId } from "@/contracts/primitives";
import type {
  SimulationEngineInput,
  SimulationNodeInput,
  SimulationEdgeInput,
  SimulationFlowInput,
  SimulationResult,
  SimulationFlowResult,
  SimulationWorkerOutput,
  NetworkMetrics,
  LinkUtilization,
  FailureScenarioResult,
  ScenarioComparison,
  ScenarioMetricDelta,
  FlowScenarioDelta,
  LatencyBreakdown,
  SimulationIssue,
  RunContext,
  SimulationEngine,
} from "@/contracts/engines";
import { BinaryHeap } from "@/kernel/heap";
import { roundToDecimals } from "@/kernel/rounding";

interface GraphEdge {
  linkId: LinkId;
  targetId: DeviceId;
  capacityMbps: number | null;
  routingWeight: number;
  lengthM: number;
}

interface DijkstraState {
  nodeId: DeviceId;
  dist: number;
  nodePath: DeviceId[];
  linkPath: LinkId[];
}

function comparePaths(
  distA: number,
  pathA: DeviceId[],
  linksA: LinkId[],
  distB: number,
  pathB: DeviceId[],
  linksB: LinkId[]
): number {
  if (distA !== distB) {
    return distA - distB;
  }
  // Compare node paths element by element
  const minNodes = Math.min(pathA.length, pathB.length);
  for (let i = 0; i < minNodes; i++) {
    const na = pathA[i];
    const nb = pathB[i];
    if (na && nb && na !== nb) {
      return na.localeCompare(nb);
    }
  }
  if (pathA.length !== pathB.length) {
    return pathA.length - pathB.length;
  }
  // Compare link paths element by element
  const minLinks = Math.min(linksA.length, linksB.length);
  for (let i = 0; i < minLinks; i++) {
    const la = linksA[i];
    const lb = linksB[i];
    if (la && lb && la !== lb) {
      return la.localeCompare(lb);
    }
  }
  return linksA.length - linksB.length;
}

export function findShortestPath(
  source: DeviceId,
  destination: DeviceId,
  adj: Map<DeviceId, GraphEdge[]>
): { found: boolean; pathNodes: DeviceId[]; pathLinks: LinkId[]; totalWeight: number } {
  if (source === destination) {
    return { found: true, pathNodes: [source], pathLinks: [], totalWeight: 0 };
  }

  // Best distance and best path to each node
  const bestDist = new Map<DeviceId, number>();
  const bestNodePath = new Map<DeviceId, DeviceId[]>();
  const bestLinkPath = new Map<DeviceId, LinkId[]>();

  bestDist.set(source, 0);
  bestNodePath.set(source, [source]);
  bestLinkPath.set(source, []);

  const heap = new BinaryHeap<DijkstraState>((a, b) =>
    comparePaths(a.dist, a.nodePath, a.linkPath, b.dist, b.nodePath, b.linkPath)
  );

  heap.push({
    nodeId: source,
    dist: 0,
    nodePath: [source],
    linkPath: [],
  });

  while (!heap.isEmpty()) {
    const current = heap.pop();
    if (!current) break;

    const recordedDist = bestDist.get(current.nodeId);
    if (recordedDist !== undefined && current.dist > recordedDist) {
      continue;
    }

    if (current.nodeId === destination) {
      return {
        found: true,
        pathNodes: current.nodePath,
        pathLinks: current.linkPath,
        totalWeight: current.dist,
      };
    }

    const neighbors = adj.get(current.nodeId) ?? [];
    // Sort neighbors by target ID and link ID for deterministic exploration
    const sortedNeighbors = [...neighbors].sort((a, b) => {
      const cmp = a.targetId.localeCompare(b.targetId);
      return cmp !== 0 ? cmp : a.linkId.localeCompare(b.linkId);
    });

    for (const edge of sortedNeighbors) {
      const nextNode = edge.targetId;
      const nextDist = current.dist + edge.routingWeight;
      const nextNodePath = [...current.nodePath, nextNode];
      const nextLinkPath = [...current.linkPath, edge.linkId];

      const currentBestDist = bestDist.get(nextNode);
      const currentBestNodePath = bestNodePath.get(nextNode);
      const currentBestLinkPath = bestLinkPath.get(nextNode);

      const isBetter =
        currentBestDist === undefined ||
        comparePaths(
          nextDist,
          nextNodePath,
          nextLinkPath,
          currentBestDist,
          currentBestNodePath ?? [],
          currentBestLinkPath ?? []
        ) < 0;

      if (isBetter) {
        bestDist.set(nextNode, nextDist);
        bestNodePath.set(nextNode, nextNodePath);
        bestLinkPath.set(nextNode, nextLinkPath);
        heap.push({
          nodeId: nextNode,
          dist: nextDist,
          nodePath: nextNodePath,
          linkPath: nextLinkPath,
        });
      }
    }
  }

  return { found: false, pathNodes: [], pathLinks: [], totalWeight: Infinity };
}

interface RunGraphResult {
  metrics: NetworkMetrics;
  flowResults: SimulationFlowResult[];
}

function runSingleSimulation(
  nodes: SimulationNodeInput[],
  edges: SimulationEdgeInput[],
  flows: SimulationFlowInput[],
  settings: SimulationEngineInput["settings"],
  failedDevices: Set<DeviceId>,
  failedLinks: Set<LinkId>
): RunGraphResult {
  // Build adjacency list for undirected graph excluding failed elements
  const activeNodes = new Map<DeviceId, SimulationNodeInput>();
  for (const n of nodes) {
    if (!failedDevices.has(n.deviceId)) {
      activeNodes.set(n.deviceId, n);
    }
  }

  const adj = new Map<DeviceId, GraphEdge[]>();
  for (const id of activeNodes.keys()) {
    adj.set(id, []);
  }

  const activeEdges = new Map<LinkId, SimulationEdgeInput>();
  for (const e of edges) {
    if (
      !failedLinks.has(e.linkId) &&
      activeNodes.has(e.sourceDeviceId) &&
      activeNodes.has(e.targetDeviceId)
    ) {
      activeEdges.set(e.linkId, e);
      adj.get(e.sourceDeviceId)?.push({
        linkId: e.linkId,
        targetId: e.targetDeviceId,
        capacityMbps: e.capacityMbps,
        routingWeight: e.routingWeight ?? 1,
        lengthM: e.lengthM,
      });
      adj.get(e.targetDeviceId)?.push({
        linkId: e.linkId,
        targetId: e.sourceDeviceId,
        capacityMbps: e.capacityMbps,
        routingWeight: e.routingWeight ?? 1,
        lengthM: e.lengthM,
      });
    }
  }

  // Route each flow
  interface RouteInfo {
    flow: SimulationFlowInput;
    reachable: boolean;
    unreachableReason: SimulationFlowResult["unreachableReason"];
    pathNodes: DeviceId[];
    pathLinks: LinkId[];
    hasMissingCapacity: boolean;
    issues: SimulationIssue[];
  }

  const routes: RouteInfo[] = [];

  for (const flow of flows) {
    if (!flow.sourceDeviceId) {
      routes.push({
        flow,
        reachable: false,
        unreachableReason: "missingServingDevice",
        pathNodes: [],
        pathLinks: [],
        hasMissingCapacity: false,
        issues: [],
      });
      continue;
    }

    if (failedDevices.has(flow.sourceDeviceId)) {
      routes.push({
        flow,
        reachable: false,
        unreachableReason: "sourceFailed",
        pathNodes: [],
        pathLinks: [],
        hasMissingCapacity: false,
        issues: [],
      });
      continue;
    }

    if (!activeNodes.has(flow.sourceDeviceId)) {
      routes.push({
        flow,
        reachable: false,
        unreachableReason: "missingServingDevice",
        pathNodes: [],
        pathLinks: [],
        hasMissingCapacity: false,
        issues: [],
      });
      continue;
    }

    if (failedDevices.has(flow.destinationDeviceId)) {
      routes.push({
        flow,
        reachable: false,
        unreachableReason: "destinationFailed",
        pathNodes: [],
        pathLinks: [],
        hasMissingCapacity: false,
        issues: [],
      });
      continue;
    }

    const pathResult = findShortestPath(flow.sourceDeviceId, flow.destinationDeviceId, adj);
    if (!pathResult.found) {
      routes.push({
        flow,
        reachable: false,
        unreachableReason: "noPath",
        pathNodes: [],
        pathLinks: [],
        hasMissingCapacity: false,
        issues: [],
      });
      continue;
    }

    // Check link capacity completeness on path
    const issues: SimulationIssue[] = [];
    let hasMissing = false;
    for (const lid of pathResult.pathLinks) {
      const edge = activeEdges.get(lid);
      if (edge && edge.capacityMbps === null) {
        hasMissing = true;
        issues.push({
          code: "MISSING_LINK_CAPACITY",
          message: `Link ${lid} is missing capacity configuration`,
          linkId: lid,
        });
      }
    }

    routes.push({
      flow,
      reachable: true,
      unreachableReason: null,
      pathNodes: pathResult.pathNodes,
      pathLinks: pathResult.pathLinks,
      hasMissingCapacity: hasMissing,
      issues,
    });
  }

  // Count flows traversing each active link for equal-share calculation
  const linkFlowCount = new Map<LinkId, number>();
  for (const lid of activeEdges.keys()) {
    linkFlowCount.set(lid, 0);
  }

  for (const r of routes) {
    if (r.reachable && !r.hasMissingCapacity) {
      for (const lid of r.pathLinks) {
        linkFlowCount.set(lid, (linkFlowCount.get(lid) ?? 0) + 1);
      }
    }
  }

  // Compute flow results
  const flowResults: SimulationFlowResult[] = [];
  const linkDeliveredLoad = new Map<LinkId, number>();
  const linkOfferedLoad = new Map<LinkId, number>();
  for (const lid of activeEdges.keys()) {
    linkDeliveredLoad.set(lid, 0);
    linkOfferedLoad.set(lid, 0);
  }

  for (const r of routes) {
    const f = r.flow;
    const demand = f.demandMbps;

    if (!r.reachable) {
      flowResults.push({
        flowId: f.flowId,
        sourceSubnetId: f.subnetId,
        sourceDeviceId: f.sourceDeviceId,
        destinationDeviceId: f.destinationDeviceId,
        reachable: false,
        unreachableReason: r.unreachableReason,
        throughputCompleteness: "notApplicable",
        pathDeviceIds: [],
        pathLinkIds: [],
        hopCount: 0,
        offeredDemandMbps: demand,
        bottleneckCapacityMbps: null,
        deliveredRateMbps: 0,
        latency: null,
        issues: [],
      });
      continue;
    }

    for (const lid of r.pathLinks) {
      linkOfferedLoad.set(lid, (linkOfferedLoad.get(lid) ?? 0) + demand);
    }

    if (r.hasMissingCapacity) {
      flowResults.push({
        flowId: f.flowId,
        sourceSubnetId: f.subnetId,
        sourceDeviceId: f.sourceDeviceId,
        destinationDeviceId: f.destinationDeviceId,
        reachable: true,
        unreachableReason: null,
        throughputCompleteness: "missingCapacity",
        pathDeviceIds: r.pathNodes,
        pathLinkIds: r.pathLinks,
        hopCount: r.pathLinks.length,
        offeredDemandMbps: demand,
        bottleneckCapacityMbps: null,
        deliveredRateMbps: null,
        latency: null,
        issues: r.issues,
      });
      continue;
    }

    // Compute equal share across path links
    let minEqualShare = demand;
    let minCapacity = Infinity;

    for (const lid of r.pathLinks) {
      const edge = activeEdges.get(lid);
      const cap = edge?.capacityMbps ?? 0;
      if (cap < minCapacity) {
        minCapacity = cap;
      }
      const count = linkFlowCount.get(lid) ?? 1;
      const share = cap / count;
      if (share < minEqualShare) {
        minEqualShare = share;
      }
    }

    const deliveredRate = Math.min(demand, minEqualShare);
    for (const lid of r.pathLinks) {
      linkDeliveredLoad.set(lid, (linkDeliveredLoad.get(lid) ?? 0) + deliveredRate);
    }

    // Latency calculation: propagation + transmission + processing
    // Propagation: lengthM / propagationSpeedMps * 1000
    // Transmission: averagePacketSizeBytes * 8 / (capacityMbps * 1,000,000) * 1000
    // Processing: intermediate nodes only
    let propagationMs = 0;
    let transmissionMs = 0;
    let processingMs = 0;

    for (const lid of r.pathLinks) {
      const edge = activeEdges.get(lid);
      if (edge && edge.capacityMbps !== null && edge.capacityMbps > 0) {
        propagationMs += (edge.lengthM / settings.propagationSpeedMps) * 1000;
        transmissionMs +=
          ((settings.averagePacketSizeBytes * 8) / (edge.capacityMbps * 1_000_000)) * 1000;
      }
    }

    // Intermediate devices: r.pathNodes[1 .. length - 2]
    for (let i = 1; i < r.pathNodes.length - 1; i++) {
      const devId = r.pathNodes[i];
      if (devId) {
        const devNode = activeNodes.get(devId);
        const delay = devNode?.processingDelayMs ?? settings.processingDelayMsPerHop;
        processingMs += delay;
      }
    }

    const totalMs = roundToDecimals(propagationMs + transmissionMs + processingMs, 4);

    const latency: LatencyBreakdown = {
      propagationMs: roundToDecimals(propagationMs, 4),
      transmissionMs: roundToDecimals(transmissionMs, 4),
      processingMs: roundToDecimals(processingMs, 4),
      totalMs,
      queueingMs: null,
    };

    flowResults.push({
      flowId: f.flowId,
      sourceSubnetId: f.subnetId,
      sourceDeviceId: f.sourceDeviceId,
      destinationDeviceId: f.destinationDeviceId,
      reachable: true,
      unreachableReason: null,
      throughputCompleteness: "complete",
      pathDeviceIds: r.pathNodes,
      pathLinkIds: r.pathLinks,
      hopCount: r.pathLinks.length,
      offeredDemandMbps: demand,
      bottleneckCapacityMbps: minCapacity === Infinity ? null : minCapacity,
      deliveredRateMbps: roundToDecimals(deliveredRate, 2),
      latency,
      issues: [],
    });
  }

  // Compute link utilizations
  const linkUtilization: LinkUtilization[] = [];
  for (const [lid, edge] of activeEdges.entries()) {
    const cap = edge.capacityMbps ?? 0;
    const delivered = linkDeliveredLoad.get(lid) ?? 0;
    const offered = linkOfferedLoad.get(lid) ?? 0;
    const ratio = cap > 0 ? delivered / cap : 0;
    linkUtilization.push({
      linkId: lid,
      capacityMbps: cap,
      offeredLoadMbps: roundToDecimals(offered, 2),
      deliveredLoadMbps: roundToDecimals(delivered, 2),
      utilizationRatio: roundToDecimals(ratio, 4),
      isCongested: ratio >= 1,
    });
  }

  // Network Metrics
  const totalFlowCount = flowResults.length;
  let reachableFlowCount = 0;
  let unreachableFlowCount = 0;
  let incompleteFlowCount = 0;
  let aggregateOfferedDemand = 0;
  let aggregateDeliveredRate = 0;
  let latencySum = 0;
  let latencyFlowCount = 0;
  let maxLatency: number | null = null;

  for (const fr of flowResults) {
    aggregateOfferedDemand += fr.offeredDemandMbps;
    if (fr.reachable) {
      reachableFlowCount++;
      if (fr.throughputCompleteness === "missingCapacity") {
        incompleteFlowCount++;
      } else if (fr.deliveredRateMbps !== null) {
        aggregateDeliveredRate += fr.deliveredRateMbps;
      }
      if (fr.latency !== null) {
        latencyFlowCount++;
        latencySum += fr.latency.totalMs;
        if (maxLatency === null || fr.latency.totalMs > maxLatency) {
          maxLatency = fr.latency.totalMs;
        }
      }
    } else {
      unreachableFlowCount++;
    }
  }

  const meanLatency =
    latencyFlowCount > 0 ? roundToDecimals(latencySum / latencyFlowCount, 4) : null;

  const metrics: NetworkMetrics = {
    totalFlowCount,
    reachableFlowCount,
    unreachableFlowCount,
    incompleteFlowCount,
    completeness: incompleteFlowCount > 0 ? "partial" : "complete",
    aggregateOfferedDemandMbps: roundToDecimals(aggregateOfferedDemand, 2),
    aggregateDeliveredRateMbps: roundToDecimals(aggregateDeliveredRate, 2),
    meanReachableLatencyMs: meanLatency,
    latencyFlowCount,
    maxReachableLatencyMs: maxLatency !== null ? roundToDecimals(maxLatency, 4) : null,
    linkUtilization,
  };

  return { metrics, flowResults };
}

export async function simulate(
  input: SimulationEngineInput,
  context: RunContext
): Promise<SimulationWorkerOutput> {
  const { nodes, edges, flows, scenarios, settings } = input;

  // 1. Run baseline simulation (zero failures)
  context.reportProgress(0.1, "Simulating baseline topology...");
  if (context.shouldCancel()) {
    throw new Error("Worker cancelled");
  }

  const emptySetDevices = new Set<DeviceId>();
  const emptySetLinks = new Set<LinkId>();
  const baseline = runSingleSimulation(
    nodes,
    edges,
    flows,
    settings,
    emptySetDevices,
    emptySetLinks
  );

  // 2. Run each failure scenario
  const scenarioResults: FailureScenarioResult[] = [];
  const totalScenarios = scenarios.length;

  for (let s = 0; s < totalScenarios; s++) {
    if (context.shouldCancel()) {
      throw new Error("Worker cancelled");
    }

    const sc = scenarios[s];
    if (!sc) continue;

    context.reportProgress(
      0.1 + ((s + 1) / (totalScenarios + 1)) * 0.8,
      `Simulating scenario: ${sc.name}`
    );
    await context.yieldToEventLoop();

    const failedDevs = new Set<DeviceId>(sc.failedDeviceIds);
    const failedLnks = new Set<LinkId>(sc.failedLinkIds);

    const scRun = runSingleSimulation(nodes, edges, flows, settings, failedDevs, failedLnks);

    // Compute delta metrics against baseline
    const calcDelta = (
      key: "reachableFlowCount" | "unreachableFlowCount" | "aggregateDeliveredRateMbps" | "meanReachableLatencyMs",
      baseVal: number | null,
      scVal: number | null
    ): ScenarioMetricDelta => {
      const delta = baseVal !== null && scVal !== null ? roundToDecimals(scVal - baseVal, 4) : null;
      const pct =
        baseVal !== null && baseVal !== 0 && delta !== null
          ? roundToDecimals((delta / baseVal) * 100, 2)
          : null;
      return {
        key,
        baselineValue: baseVal,
        scenarioValue: scVal,
        deltaScenarioMinusBaseline: delta,
        percentageChange: pct,
      };
    };

    const metricDeltas: ScenarioMetricDelta[] = [
      calcDelta(
        "reachableFlowCount",
        baseline.metrics.reachableFlowCount,
        scRun.metrics.reachableFlowCount
      ),
      calcDelta(
        "unreachableFlowCount",
        baseline.metrics.unreachableFlowCount,
        scRun.metrics.unreachableFlowCount
      ),
      calcDelta(
        "aggregateDeliveredRateMbps",
        baseline.metrics.aggregateDeliveredRateMbps,
        scRun.metrics.aggregateDeliveredRateMbps
      ),
      calcDelta(
        "meanReachableLatencyMs",
        baseline.metrics.meanReachableLatencyMs,
        scRun.metrics.meanReachableLatencyMs
      ),
    ];

    // Compute flow scenario deltas
    const flowDeltas: FlowScenarioDelta[] = [];
    const baseFlowMap = new Map<FlowId, SimulationFlowResult>();
    for (const bf of baseline.flowResults) {
      baseFlowMap.set(bf.flowId, bf);
    }

    for (const sf of scRun.flowResults) {
      const bf = baseFlowMap.get(sf.flowId);
      const bReach = bf?.reachable ?? false;
      const sReach = sf.reachable;
      const bRate = bf?.deliveredRateMbps ?? null;
      const sRate = sf.deliveredRateMbps;
      const bLat = bf?.latency?.totalMs ?? null;
      const sLat = sf.latency?.totalMs ?? null;

      flowDeltas.push({
        flowId: sf.flowId,
        baselineReachable: bReach,
        scenarioReachable: sReach,
        reachabilityChanged: bReach !== sReach,
        baselineDeliveredRateMbps: bRate,
        scenarioDeliveredRateMbps: sRate,
        deliveredRateDeltaMbps:
          bRate !== null && sRate !== null ? roundToDecimals(sRate - bRate, 2) : null,
        baselineLatencyMs: bLat,
        scenarioLatencyMs: sLat,
        latencyDeltaMs:
          bLat !== null && sLat !== null ? roundToDecimals(sLat - bLat, 4) : null,
      });
    }

    const comparisonToBaseline: ScenarioComparison = {
      scenarioId: sc.scenarioId,
      metrics: metricDeltas,
      flows: flowDeltas,
    };

    scenarioResults.push({
      scenarioId: sc.scenarioId,
      name: sc.name,
      failedDeviceIds: sc.failedDeviceIds,
      failedLinkIds: sc.failedLinkIds,
      metrics: scRun.metrics,
      flowResults: scRun.flowResults,
      comparisonToBaseline,
    });
  }

  context.reportProgress(1.0, "Simulation complete");

  const limitations = [
    "Dijkstra static shortest-path routing; dynamic routing protocols, BGP/OSPF convergence, and packet switching are not modeled.",
    "Link capacity is the only throughput bottleneck enforced; device internal bus/forwarding limits are not enforced as separate bottlenecks.",
    "Equal-share link bandwidth allocation without max-min redistribution.",
    "Queueing delay and packet loss are excluded from this MVP model.",
  ];

  const result: SimulationResult = {
    isEstimate: true,
    routingAlgorithm: "dijkstra",
    graphModel: "undirected",
    baselineMetrics: baseline.metrics,
    baselineFlows: baseline.flowResults,
    scenarios: scenarioResults,
    assumptions: settings,
    limitations,
  };

  return { result };
}

export const defaultSimulationEngine: SimulationEngine = {
  run: simulate,
};
