/**
 * Normative simulation latency and throughput test vectors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19.5
 */

import type { FlowId } from "@/contracts/primitives";

export const SIM_04_VECTOR = {
  id: "SIM-04" as const,
  path: ["A", "B", "C"],
  hops: 2,
  intermediateDevices: 1,
  linkLengthsM: [1000, 1000],
  linkCapacitiesMbps: [10, 10],
  packetSizeBytes: 1500,
  processingDelayPerHopMs: 1,
  propagationSpeedMps: 200_000_000,
  expected: {
    propagationMs: 0.01,
    transmissionMs: 2.4,
    processingMs: 1.0,
    totalMs: 3.41,
    toleranceMs: 0.001,
    queueingMs: null,
  },
};

export const SIM_05_VECTOR = {
  id: "SIM-05" as const,
  offeredDemandMbps: 25,
  linkCapacitiesMbps: [100, 20, 50],
  expected: {
    bottleneckCapacityMbps: 20,
    deliveredRateMbps: 20,
    bottleneckLinkUtilizationRatio: 1.0, // 100%
  },
};

export const SIM_06_VECTOR = {
  id: "SIM-06" as const,
  flows: [
    { flowId: "flw_1" as FlowId, offeredDemandMbps: 20 },
    { flowId: "flw_2" as FlowId, offeredDemandMbps: 20 },
  ],
  sharedLinkCapacityMbps: 30,
  expected: {
    equalSharePerFlowMbps: 15,
    deliveredRatePerFlowMbps: 15,
    aggregateDeliveredMbps: 30,
    linkUtilizationRatio: 1.0, // 100%
  },
};
