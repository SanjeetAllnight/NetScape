/**
 * Normative Dijkstra and failure simulation test vectors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19.2
 */

import type { DeviceId, LinkId } from "@/contracts/primitives";
import type { DijkstraVectorExpected } from "@/contracts/vectors";

export const SIM_01_VECTOR = {
  id: "SIM-01" as const,
  edges: [
    { source: "A", target: "B", weight: 1, linkId: "lnk_ab" },
    { source: "A", target: "C", weight: 4, linkId: "lnk_ac" },
    { source: "B", target: "C", weight: 2, linkId: "lnk_bc" },
    { source: "C", target: "D", weight: 1, linkId: "lnk_cd" },
    { source: "B", target: "D", weight: 5, linkId: "lnk_bd" },
  ],
  start: "A",
  goal: "D",
  expected: {
    nodePath: ["A", "B", "C", "D"] as unknown as DeviceId[],
    linkPath: ["lnk_ab", "lnk_bc", "lnk_cd"] as unknown as LinkId[],
    totalRoutingWeight: 4,
    hopCount: 3,
  } satisfies DijkstraVectorExpected,
};

export const SIM_02_VECTOR = {
  id: "SIM-02" as const,
  nodes: {
    A: "dev_00000000-0000-4000-8000-00000000000a" as DeviceId,
    B: "dev_00000000-0000-4000-8000-00000000000b" as DeviceId,
    C: "dev_00000000-0000-4000-8000-00000000000c" as DeviceId,
    D: "dev_00000000-0000-4000-8000-00000000000d" as DeviceId,
  },
  links: {
    AB: "lnk_00000000-0000-4000-8000-0000000000ab" as LinkId,
    AC: "lnk_00000000-0000-4000-8000-0000000000ac" as LinkId,
    BD: "lnk_00000000-0000-4000-8000-0000000000bd" as LinkId,
    CD: "lnk_00000000-0000-4000-8000-0000000000cd" as LinkId,
  },
  expectedPath: [
    "dev_00000000-0000-4000-8000-00000000000a" as DeviceId,
    "dev_00000000-0000-4000-8000-00000000000b" as DeviceId,
    "dev_00000000-0000-4000-8000-00000000000d" as DeviceId,
  ],
  expectedLinkPath: [
    "lnk_00000000-0000-4000-8000-0000000000ab" as LinkId,
    "lnk_00000000-0000-4000-8000-0000000000bd" as LinkId,
  ],
  expectedTotalWeight: 2,
};

export const SIM_03_VECTOR = {
  id: "SIM-03" as const,
  baseGraph: SIM_01_VECTOR.edges,
  scenarios: [
    {
      name: "Failed link BC",
      failedLinks: ["lnk_bc"],
      failedNodes: [],
      expectedNodePath: ["A", "B", "D"],
      expectedLinkPath: ["lnk_ab", "lnk_bd"],
      expectedTotalWeight: 6,
    },
    {
      name: "Failed node B",
      failedLinks: [],
      failedNodes: ["B"],
      expectedNodePath: ["A", "C", "D"],
      expectedLinkPath: ["lnk_ac", "lnk_cd"],
      expectedTotalWeight: 5,
      expectedHopCount: 2,
    },
    {
      name: "Failed links AB, AC, CD",
      failedLinks: ["lnk_ab", "lnk_ac", "lnk_cd"],
      failedNodes: [],
      expectedNoPath: true,
    },
  ],
};

