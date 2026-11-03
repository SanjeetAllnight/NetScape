/**
 * Normative test vector types and specifications.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19
 */

import type { IPv4Address, DeviceId, LinkId, FlowId, Money } from "./primitives";
import type { SignalClass } from "./enums";

export interface IpFactExpected {
  network: IPv4Address;
  broadcast: IPv4Address;
  totalAddresses: number;
  usableHosts: number;
  firstUsable: IPv4Address;
  lastUsable: IPv4Address;
}

export interface DijkstraVectorExpected {
  nodePath: DeviceId[];
  linkPath: LinkId[];
  totalRoutingWeight: number;
  hopCount: number;
}

export interface RfVectorExpected {
  fsplDb?: number;
  fsplRoundedDb?: number;
  pathLossDb?: number;
  prxDbm?: number;
  wallLossDb?: number;
  signalClass?: SignalClass;
  toleranceDb?: number;
  gridCounts?: {
    includedCellCount: number;
    coveredCellCount: number;
    coveragePercent: number;
    classCounts: Record<SignalClass, number>;
  };
}

export interface CostVectorExpected {
  purchasedCopperLengthM: number;
  copperCost: Money;
  directCapexSubtotal: Money;
  contingency: Money;
  capexBeforeTax: Money;
  annualEnergyKwh: number;
  annualEnergyCost: Money;
  annualMaintenance: Money;
  annualReplacementReserve: Money;
  annualOpex: Money;
  tco: Money;
  toleranceMoney: number;
}

export interface SimulationVectorExpected {
  latency?: {
    propagationMs: number;
    transmissionMs: number;
    processingMs: number;
    totalMs: number;
    toleranceMs: number;
  };
  bottleneck?: {
    flowId: FlowId;
    bottleneckCapacityMbps: number;
    deliveredRateMbps: number;
    bottleneckUtilizationRatio: number;
  };
  equalShare?: {
    flowDeliveredRatesMbps: Record<FlowId, number>;
    aggregateDeliveredMbps: number;
    sharedLinkUtilizationRatio: number;
  };
}
