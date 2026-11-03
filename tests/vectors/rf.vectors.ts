/**
 * Normative FSPL, log-distance, and wireless coverage test vectors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19.3
 */

import type { SignalClass } from "@/contracts/enums";

export const RF_01_VECTOR = {
  id: "RF-01" as const,
  dKm: 0.001,
  fMhz: 2400,
  expectedFsplDb: 40.0442,
  expectedRoundedDb: 40.04,
  toleranceDb: 0.01,
};

export const RF_02_VECTOR = {
  id: "RF-02" as const,
  referenceLossDb: 40.0442,
  d0M: 1,
  dM: 10,
  n: 3,
  expectedPathLossDb: 70.0442,
  toleranceDb: 0.01,
};

export const RF_03_VECTOR = {
  id: "RF-03" as const,
  ptxDbm: 20,
  gtxDbi: 2,
  grxDbi: 0,
  pathLossDb: 70.0442,
  wallLossDb: 0,
  expectedPrxDbm: -48.0442,
  toleranceDb: 0.01,
};

export const RF_04_VECTOR = {
  id: "RF-04" as const,
  material: "brick" as const,
  lossDbPerCrossing: 8,
  cases: [
    { crossings: 1, expectedLossDb: 8 },
    { crossings: 2, expectedLossDb: 16 },
  ],
};

export const RF_05_VECTOR = {
  id: "RF-05" as const,
  cases: [
    { rssiDbm: -55, expectedClass: "excellent" as SignalClass },
    { rssiDbm: -55.1, expectedClass: "good" as SignalClass },
    { rssiDbm: -67, expectedClass: "good" as SignalClass },
    { rssiDbm: -67.1, expectedClass: "fair" as SignalClass },
    { rssiDbm: -75, expectedClass: "fair" as SignalClass },
    { rssiDbm: -75.1, expectedClass: "weak" as SignalClass },
    { rssiDbm: -85, expectedClass: "weak" as SignalClass },
    { rssiDbm: -85.1, expectedClass: "deadZone" as SignalClass },
  ],
};

export const RF_06_VECTOR = {
  id: "RF-06" as const,
  includedCellsBestRssiDbm: [-50, -60, -80, -90],
  minimumAcceptableRssiDbm: -75,
  expectedIncludedCellCount: 4,
  expectedCoveredCellCount: 2,
  expectedCoveragePercent: 50,
  expectedClassCounts: {
    excellent: 1,
    good: 1,
    fair: 0,
    weak: 1,
    deadZone: 1,
  } as Record<SignalClass, number>,
};
