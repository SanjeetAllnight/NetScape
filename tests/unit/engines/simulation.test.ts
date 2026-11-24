import { describe, it, expect } from "vitest";
import { findShortestPath, simulate } from "@/engines/simulation/simulationEngine";
import {
  SIM_01_VECTOR,
  SIM_02_VECTOR,
} from "../../vectors/dijkstra.vectors";
import {
  SIM_04_VECTOR,
  SIM_05_VECTOR,
  SIM_06_VECTOR,
} from "../../vectors/simulation.vectors";
import type { DeviceId, LinkId, FlowId, SubnetId, FailureScenarioId } from "@/contracts/primitives";
import type {
  SimulationEngineInput,
  RunContext,
} from "@/contracts/engines";

describe("Simulation Engine (P1-05)", () => {
  const dummyContext: RunContext = {
    shouldCancel: () => false,
    reportProgress: () => {},
    yieldToEventLoop: async () => {},
  };

  describe("Dijkstra & Graph Vectors", () => {
    it("matches normative SIM-01 shortest path", () => {
      const adj = new Map();
      adj.set("A", [
        { linkId: "lnk_ab", targetId: "B", capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: "lnk_ac", targetId: "C", capacityMbps: 100, routingWeight: 4, lengthM: 100 },
      ]);
      adj.set("B", [
        { linkId: "lnk_ab", targetId: "A", capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: "lnk_bc", targetId: "C", capacityMbps: 100, routingWeight: 2, lengthM: 100 },
        { linkId: "lnk_bd", targetId: "D", capacityMbps: 100, routingWeight: 5, lengthM: 100 },
      ]);
      adj.set("C", [
        { linkId: "lnk_ac", targetId: "A", capacityMbps: 100, routingWeight: 4, lengthM: 100 },
        { linkId: "lnk_bc", targetId: "B", capacityMbps: 100, routingWeight: 2, lengthM: 100 },
        { linkId: "lnk_cd", targetId: "D", capacityMbps: 100, routingWeight: 1, lengthM: 100 },
      ]);
      adj.set("D", [
        { linkId: "lnk_cd", targetId: "C", capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: "lnk_bd", targetId: "B", capacityMbps: 100, routingWeight: 5, lengthM: 100 },
      ]);

      const res = findShortestPath("A" as DeviceId, "D" as DeviceId, adj);
      expect(res.found).toBe(true);
      expect(res.totalWeight).toBe(SIM_01_VECTOR.expected.totalRoutingWeight);
      expect(res.pathNodes).toEqual(SIM_01_VECTOR.expected.nodePath);
      expect(res.pathLinks).toEqual(SIM_01_VECTOR.expected.linkPath);
      expect(res.pathLinks.length).toBe(SIM_01_VECTOR.expected.hopCount);
    });

    it("matches normative SIM-02 stable equal-cost tie-breaking", () => {
      const { nodes, links } = SIM_02_VECTOR;
      const adj = new Map();
      adj.set(nodes.A, [
        { linkId: links.AB, targetId: nodes.B, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: links.AC, targetId: nodes.C, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
      ]);
      adj.set(nodes.B, [
        { linkId: links.AB, targetId: nodes.A, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: links.BD, targetId: nodes.D, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
      ]);
      adj.set(nodes.C, [
        { linkId: links.AC, targetId: nodes.A, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: links.CD, targetId: nodes.D, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
      ]);
      adj.set(nodes.D, [
        { linkId: links.BD, targetId: nodes.B, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
        { linkId: links.CD, targetId: nodes.C, capacityMbps: 100, routingWeight: 1, lengthM: 100 },
      ]);

      const res = findShortestPath(nodes.A, nodes.D, adj);
      expect(res.found).toBe(true);
      expect(res.pathNodes).toEqual(SIM_02_VECTOR.expectedPath);
      expect(res.pathLinks).toEqual(SIM_02_VECTOR.expectedLinkPath);
      expect(res.totalWeight).toBe(SIM_02_VECTOR.expectedTotalWeight);
    });

    it("matches normative SIM-03 failure injection scenarios", async () => {
      const nodes = [
        { deviceId: "A" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "B" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "C" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "D" as DeviceId, type: "server" as const, processingDelayMs: null },
      ];

      const edges = [
        { linkId: "lnk_ab" as LinkId, sourceDeviceId: "A" as DeviceId, targetDeviceId: "B" as DeviceId, medium: "copper" as const, lengthM: 100, capacityMbps: 100, routingWeight: 1 },
        { linkId: "lnk_ac" as LinkId, sourceDeviceId: "A" as DeviceId, targetDeviceId: "C" as DeviceId, medium: "copper" as const, lengthM: 100, capacityMbps: 100, routingWeight: 4 },
        { linkId: "lnk_bc" as LinkId, sourceDeviceId: "B" as DeviceId, targetDeviceId: "C" as DeviceId, medium: "copper" as const, lengthM: 100, capacityMbps: 100, routingWeight: 2 },
        { linkId: "lnk_cd" as LinkId, sourceDeviceId: "C" as DeviceId, targetDeviceId: "D" as DeviceId, medium: "copper" as const, lengthM: 100, capacityMbps: 100, routingWeight: 1 },
        { linkId: "lnk_bd" as LinkId, sourceDeviceId: "B" as DeviceId, targetDeviceId: "D" as DeviceId, medium: "copper" as const, lengthM: 100, capacityMbps: 100, routingWeight: 5 },
      ];

      const flows = [
        {
          flowId: "flw-1" as FlowId,
          subnetId: "snt-1" as SubnetId,
          sourceDeviceId: "A" as DeviceId,
          destinationDeviceId: "D" as DeviceId,
          demandMbps: 10,
        },
      ];

      const scenarios = [
        {
          scenarioId: "sc-1" as FailureScenarioId,
          name: "Failed link CD",
          failedDeviceIds: [] as DeviceId[],
          failedLinkIds: ["lnk_cd" as LinkId],
        },
        {
          scenarioId: "sc-2" as FailureScenarioId,
          name: "Failed node B",
          failedDeviceIds: ["B" as DeviceId],
          failedLinkIds: [] as LinkId[],
        },
        {
          scenarioId: "sc-3" as FailureScenarioId,
          name: "Failed links AB, AC, CD",
          failedDeviceIds: [] as DeviceId[],
          failedLinkIds: ["lnk_ab" as LinkId, "lnk_ac" as LinkId, "lnk_cd" as LinkId],
        },
        {
          scenarioId: "sc-4" as FailureScenarioId,
          name: "Failed link BC",
          failedDeviceIds: [] as DeviceId[],
          failedLinkIds: ["lnk_bc" as LinkId],
        },
      ];

      const input: SimulationEngineInput = {
        nodes,
        edges,
        flows,
        scenarios,
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: 1500,
          processingDelayMsPerHop: 1,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);
      const scResults = out.result.scenarios;

      // Scenario 1: Failed link CD -> shortest path routes via A-B-D (weight 6)
      const sc1Flow = scResults[0]?.flowResults[0];
      expect(sc1Flow?.reachable).toBe(true);
      expect(sc1Flow?.pathDeviceIds).toEqual(["A", "B", "D"]);
      expect(sc1Flow?.pathLinkIds).toEqual(["lnk_ab", "lnk_bd"]);

      // Scenario 2: Failed node B -> shortest path routes via A-C-D (weight 5, hops 2)
      const sc2Flow = scResults[1]?.flowResults[0];
      expect(sc2Flow?.reachable).toBe(true);
      expect(sc2Flow?.pathDeviceIds).toEqual(["A", "C", "D"]);
      expect(sc2Flow?.pathLinkIds).toEqual(["lnk_ac", "lnk_cd"]);
      expect(sc2Flow?.hopCount).toBe(2);

      // Scenario 3: Failed links AB, AC, CD -> noPath
      const sc3Flow = scResults[2]?.flowResults[0];
      expect(sc3Flow?.reachable).toBe(false);
      expect(sc3Flow?.unreachableReason).toBe("noPath");

      // Scenario 4: Failed link BC -> Dijkstra correctly routes via shortest path A-C-D (weight 5 < 6)
      const sc4Flow = scResults[3]?.flowResults[0];
      expect(sc4Flow?.reachable).toBe(true);
      expect(sc4Flow?.pathDeviceIds).toEqual(["A", "C", "D"]);
      expect(sc4Flow?.pathLinkIds).toEqual(["lnk_ac", "lnk_cd"]);
    });
  });

  describe("Latency and Throughput Vectors", () => {
    it("matches normative SIM-04 latency breakdown components", async () => {
      const nodes = [
        { deviceId: "A" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "B" as DeviceId, type: "router" as const, processingDelayMs: 1.0 }, // 1ms intermediate
        { deviceId: "C" as DeviceId, type: "server" as const, processingDelayMs: null },
      ];

      const edges = [
        {
          linkId: "lnk_ab" as LinkId,
          sourceDeviceId: "A" as DeviceId,
          targetDeviceId: "B" as DeviceId,
          medium: "copper" as const,
          lengthM: SIM_04_VECTOR.linkLengthsM[0]!,
          capacityMbps: SIM_04_VECTOR.linkCapacitiesMbps[0]!,
          routingWeight: 1,
        },
        {
          linkId: "lnk_bc" as LinkId,
          sourceDeviceId: "B" as DeviceId,
          targetDeviceId: "C" as DeviceId,
          medium: "copper" as const,
          lengthM: SIM_04_VECTOR.linkLengthsM[1]!,
          capacityMbps: SIM_04_VECTOR.linkCapacitiesMbps[1]!,
          routingWeight: 1,
        },
      ];

      const flows = [
        {
          flowId: "flw-1" as FlowId,
          subnetId: "snt-1" as SubnetId,
          sourceDeviceId: "A" as DeviceId,
          destinationDeviceId: "C" as DeviceId,
          demandMbps: 10,
        },
      ];

      const input: SimulationEngineInput = {
        nodes,
        edges,
        flows,
        scenarios: [],
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: SIM_04_VECTOR.packetSizeBytes,
          processingDelayMsPerHop: SIM_04_VECTOR.processingDelayPerHopMs,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);
      const flow = out.result.baselineFlows[0];
      expect(flow?.reachable).toBe(true);
      expect(flow?.latency).toBeDefined();

      const lat = flow!.latency!;
      expect(Math.abs(lat.propagationMs - SIM_04_VECTOR.expected.propagationMs)).toBeLessThanOrEqual(
        SIM_04_VECTOR.expected.toleranceMs
      );
      expect(Math.abs(lat.transmissionMs - SIM_04_VECTOR.expected.transmissionMs)).toBeLessThanOrEqual(
        SIM_04_VECTOR.expected.toleranceMs
      );
      expect(Math.abs(lat.processingMs - SIM_04_VECTOR.expected.processingMs)).toBeLessThanOrEqual(
        SIM_04_VECTOR.expected.toleranceMs
      );
      expect(Math.abs(lat.totalMs - SIM_04_VECTOR.expected.totalMs)).toBeLessThanOrEqual(
        SIM_04_VECTOR.expected.toleranceMs
      );
      expect(lat.queueingMs).toBeNull();
    });

    it("matches normative SIM-05 single-flow bottleneck", async () => {
      const nodes = [
        { deviceId: "A" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "B" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "C" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "D" as DeviceId, type: "server" as const, processingDelayMs: null },
      ];

      const edges = [
        { linkId: "l1" as LinkId, sourceDeviceId: "A" as DeviceId, targetDeviceId: "B" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: SIM_05_VECTOR.linkCapacitiesMbps[0]!, routingWeight: 1 },
        { linkId: "l2" as LinkId, sourceDeviceId: "B" as DeviceId, targetDeviceId: "C" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: SIM_05_VECTOR.linkCapacitiesMbps[1]!, routingWeight: 1 },
        { linkId: "l3" as LinkId, sourceDeviceId: "C" as DeviceId, targetDeviceId: "D" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: SIM_05_VECTOR.linkCapacitiesMbps[2]!, routingWeight: 1 },
      ];

      const flows = [
        {
          flowId: "flw-1" as FlowId,
          subnetId: "snt-1" as SubnetId,
          sourceDeviceId: "A" as DeviceId,
          destinationDeviceId: "D" as DeviceId,
          demandMbps: SIM_05_VECTOR.offeredDemandMbps,
        },
      ];

      const input: SimulationEngineInput = {
        nodes,
        edges,
        flows,
        scenarios: [],
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: 1500,
          processingDelayMsPerHop: 1,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);
      const flow = out.result.baselineFlows[0];
      expect(flow?.bottleneckCapacityMbps).toBe(SIM_05_VECTOR.expected.bottleneckCapacityMbps);
      expect(flow?.deliveredRateMbps).toBe(SIM_05_VECTOR.expected.deliveredRateMbps);

      const bottleneckLink = out.result.baselineMetrics.linkUtilization.find((l) => l.linkId === "l2");
      expect(bottleneckLink?.utilizationRatio).toBe(SIM_05_VECTOR.expected.bottleneckLinkUtilizationRatio);
      expect(bottleneckLink?.isCongested).toBe(true);
    });

    it("matches normative SIM-06 equal-share two flows", async () => {
      // S1 and S2 both connect to Shared via link "l_shared"
      // Node R connects to Server D via shared link
      const graphNodes = [
        { deviceId: "S1" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "S2" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "R" as DeviceId, type: "router" as const, processingDelayMs: null },
        { deviceId: "D" as DeviceId, type: "server" as const, processingDelayMs: null },
      ];

      const edges = [
        { linkId: "l_s1" as LinkId, sourceDeviceId: "S1" as DeviceId, targetDeviceId: "R" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: 100, routingWeight: 1 },
        { linkId: "l_s2" as LinkId, sourceDeviceId: "S2" as DeviceId, targetDeviceId: "R" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: 100, routingWeight: 1 },
        { linkId: "l_shared" as LinkId, sourceDeviceId: "R" as DeviceId, targetDeviceId: "D" as DeviceId, medium: "copper" as const, lengthM: 10, capacityMbps: SIM_06_VECTOR.sharedLinkCapacityMbps, routingWeight: 1 },
      ];

      const flows = [
        {
          flowId: SIM_06_VECTOR.flows[0]!.flowId,
          subnetId: "snt-1" as SubnetId,
          sourceDeviceId: "S1" as DeviceId,
          destinationDeviceId: "D" as DeviceId,
          demandMbps: SIM_06_VECTOR.flows[0]!.offeredDemandMbps,
        },
        {
          flowId: SIM_06_VECTOR.flows[1]!.flowId,
          subnetId: "snt-2" as SubnetId,
          sourceDeviceId: "S2" as DeviceId,
          destinationDeviceId: "D" as DeviceId,
          demandMbps: SIM_06_VECTOR.flows[1]!.offeredDemandMbps,
        },
      ];

      const input: SimulationEngineInput = {
        nodes: graphNodes,
        edges,
        flows,
        scenarios: [],
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: 1500,
          processingDelayMsPerHop: 1,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);
      const f1 = out.result.baselineFlows.find((f) => f.flowId === "flw_1");
      const f2 = out.result.baselineFlows.find((f) => f.flowId === "flw_2");

      expect(f1?.deliveredRateMbps).toBe(SIM_06_VECTOR.expected.deliveredRatePerFlowMbps);
      expect(f2?.deliveredRateMbps).toBe(SIM_06_VECTOR.expected.deliveredRatePerFlowMbps);

      expect(out.result.baselineMetrics.aggregateDeliveredRateMbps).toBe(
        SIM_06_VECTOR.expected.aggregateDeliveredMbps
      );

      const sharedLink = out.result.baselineMetrics.linkUtilization.find((l) => l.linkId === "l_shared");
      expect(sharedLink?.utilizationRatio).toBe(SIM_06_VECTOR.expected.linkUtilizationRatio);
      expect(sharedLink?.isCongested).toBe(true);
    });

    it("explicitly marks flows with null sourceDeviceId as unreachable (missingServingDevice)", async () => {
      const input: SimulationEngineInput = {
        nodes: [
          { deviceId: "sw_core" as DeviceId, type: "switch", processingDelayMs: 0.5 },
          { deviceId: "srv_6" as DeviceId, type: "server", processingDelayMs: null },
        ],
        edges: [
          {
            linkId: "lnk_1" as LinkId,
            sourceDeviceId: "sw_core" as DeviceId,
            targetDeviceId: "srv_6" as DeviceId,
            medium: "copper",
            lengthM: 50,
            capacityMbps: 1000,
            routingWeight: 1,
          },
        ],
        flows: [
          {
            flowId: "flw_unmapped" as FlowId,
            subnetId: "sub_mech" as SubnetId,
            sourceDeviceId: null,
            destinationDeviceId: "srv_6" as DeviceId,
            demandMbps: 50,
          },
        ],
        scenarios: [],
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: 1500,
          processingDelayMsPerHop: 1,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);
      const flow = out.result.baselineFlows[0];
      expect(flow?.reachable).toBe(false);
      expect(flow?.unreachableReason).toBe("missingServingDevice");
      expect(flow?.pathDeviceIds).toEqual([]);
      expect(flow?.hopCount).toBe(0);
      expect(flow?.deliveredRateMbps).toBe(0);
      expect(flow?.latency).toBeNull();
      expect(out.result.baselineMetrics.reachableFlowCount).toBe(0);
      expect(out.result.baselineMetrics.unreachableFlowCount).toBe(1);
    });

    it("changes reachability and routing when disabling a core switch that a flow depends on", async () => {
      const input: SimulationEngineInput = {
        nodes: [
          { deviceId: "sw_mech" as DeviceId, type: "switch", processingDelayMs: 0.5 },
          { deviceId: "sw_core" as DeviceId, type: "switch", processingDelayMs: 0.5 },
          { deviceId: "sw_backup" as DeviceId, type: "switch", processingDelayMs: 1.5 },
          { deviceId: "srv_6" as DeviceId, type: "server", processingDelayMs: null },
        ],
        edges: [
          {
            linkId: "lnk_mech_core" as LinkId,
            sourceDeviceId: "sw_mech" as DeviceId,
            targetDeviceId: "sw_core" as DeviceId,
            medium: "fiber",
            lengthM: 100,
            capacityMbps: 1000,
            routingWeight: 1,
          },
          {
            linkId: "lnk_core_srv" as LinkId,
            sourceDeviceId: "sw_core" as DeviceId,
            targetDeviceId: "srv_6" as DeviceId,
            medium: "fiber",
            lengthM: 50,
            capacityMbps: 1000,
            routingWeight: 1,
          },
          {
            linkId: "lnk_mech_backup" as LinkId,
            sourceDeviceId: "sw_mech" as DeviceId,
            targetDeviceId: "sw_backup" as DeviceId,
            medium: "copper",
            lengthM: 150,
            capacityMbps: 100,
            routingWeight: 5,
          },
          {
            linkId: "lnk_backup_srv" as LinkId,
            sourceDeviceId: "sw_backup" as DeviceId,
            targetDeviceId: "srv_6" as DeviceId,
            medium: "copper",
            lengthM: 150,
            capacityMbps: 100,
            routingWeight: 5,
          },
        ],
        flows: [
          {
            flowId: "flw_mech" as FlowId,
            subnetId: "sub_mech" as SubnetId,
            sourceDeviceId: "sw_mech" as DeviceId,
            destinationDeviceId: "srv_6" as DeviceId,
            demandMbps: 50,
          },
        ],
        scenarios: [
          {
            scenarioId: "scen_core_down" as never,
            name: "Core Switch Failure",
            failedDeviceIds: ["sw_core" as DeviceId],
            failedLinkIds: [],
          },
          {
            scenarioId: "scen_both_down" as never,
            name: "Core + Backup Failure",
            failedDeviceIds: ["sw_core" as DeviceId, "sw_backup" as DeviceId],
            failedLinkIds: [],
          },
        ],
        settings: {
          perHostDemandMbps: 5,
          propagationSpeedMps: 200_000_000,
          averagePacketSizeBytes: 1500,
          processingDelayMsPerHop: 1,
          queueingModel: "none",
        },
      };

      const out = await simulate(input, dummyContext);

      // Baseline routes via sw_core
      const baseFlow = out.result.baselineFlows[0]!;
      expect(baseFlow.reachable).toBe(true);
      expect(baseFlow.pathDeviceIds).toEqual(["sw_mech", "sw_core", "srv_6"]);
      expect(baseFlow.hopCount).toBe(2);
      expect(baseFlow.bottleneckCapacityMbps).toBe(1000);

      // Core Switch Failure reroutes via sw_backup with higher latency and lower bottleneck
      const coreFail = out.result.scenarios[0]!;
      const coreFailFlow = coreFail.flowResults[0]!;
      expect(coreFailFlow.reachable).toBe(true);
      expect(coreFailFlow.pathDeviceIds).toEqual(["sw_mech", "sw_backup", "srv_6"]);
      expect(coreFailFlow.bottleneckCapacityMbps).toBe(100);
      expect(coreFailFlow.latency!.totalMs).toBeGreaterThan(baseFlow.latency!.totalMs);

      // Core + Backup Failure makes flow unreachable
      const bothFail = out.result.scenarios[1]!;
      const bothFailFlow = bothFail.flowResults[0]!;
      expect(bothFailFlow.reachable).toBe(false);
      expect(bothFailFlow.unreachableReason).toBe("noPath");
      expect(bothFailFlow.deliveredRateMbps).toBe(0);
      expect(bothFail.metrics.reachableFlowCount).toBe(0);
      expect(bothFail.metrics.unreachableFlowCount).toBe(1);
    });
  });
});
