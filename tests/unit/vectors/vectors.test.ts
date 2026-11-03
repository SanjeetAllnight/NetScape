import { describe, it, expect } from "vitest";
import {
  IP_01_VECTOR,
  IP_02_VECTOR,
  IP_03_VECTOR,
  IP_04_VECTOR,
  IP_05_VECTOR,
  IP_06_VECTOR,
  SIM_01_VECTOR,
  SIM_02_VECTOR,
  SIM_03_VECTOR,
  RF_01_VECTOR,
  RF_02_VECTOR,
  RF_03_VECTOR,
  RF_04_VECTOR,
  RF_05_VECTOR,
  RF_06_VECTOR,
  COST_01_VECTOR,
  SIM_04_VECTOR,
  SIM_05_VECTOR,
  SIM_06_VECTOR,
} from "../../vectors";

describe("Normative Test Vectors Integrity (Contracts §19)", () => {
  describe("IPv4 and VLSM vectors", () => {
    it("preserves IP-01 basic CIDR facts", () => {
      expect(IP_01_VECTOR.input).toBe("192.168.10.0/24");
      expect(IP_01_VECTOR.expected.network).toBe("192.168.10.0");
      expect(IP_01_VECTOR.expected.broadcast).toBe("192.168.10.255");
      expect(IP_01_VECTOR.expected.usableHosts).toBe(254);
      expect(IP_01_VECTOR.expected.totalAddresses).toBe(256);
    });

    it("preserves IP-02 deterministic VLSM allocation", () => {
      expect(IP_02_VECTOR.parentCidr).toBe("192.168.10.0/24");
      expect(IP_02_VECTOR.expectedAllocations).toHaveLength(4);
      expect(IP_02_VECTOR.expectedAllocations[0]?.cidr).toBe("192.168.10.0/25");
      expect(IP_02_VECTOR.expectedAllocations[1]?.cidr).toBe("192.168.10.128/26");
      expect(IP_02_VECTOR.expectedAllocations[2]?.cidr).toBe("192.168.10.192/27");
      expect(IP_02_VECTOR.expectedAllocations[3]?.cidr).toBe("192.168.10.224/28");
      expect(IP_02_VECTOR.expectedRemaining).toEqual(["192.168.10.240/28"]);
      expect(IP_02_VECTOR.expectedTotalAllocatedAddresses).toBe(240);
      expect(IP_02_VECTOR.expectedTotalWastedUsableHosts).toBe(52);
    });

    it("preserves IP-03 insufficient address space", () => {
      expect(IP_03_VECTOR.expectedUnallocated[0]?.reason).toBe("INSUFFICIENT_SPACE");
      expect(IP_03_VECTOR.expectedIsComplete).toBe(false);
    });

    it("preserves IP-04 invalid network alignment", () => {
      expect(IP_04_VECTOR.invalidParentCidr).toBe("192.168.10.1/24");
      expect(IP_04_VECTOR.expectedErrorCode).toBe("INVALID_CIDR");
    });

    it("preserves IP-05 host boundaries and IP-06 /31-/32 parse boundaries", () => {
      expect(IP_05_VECTOR.cases[0]?.expectedPrefix).toBe(30);
      expect(IP_06_VECTOR.prefixes[0]?.expectedUsable).toBe(0);
    });
  });

  describe("Dijkstra vectors", () => {
    it("preserves SIM-01 shortest path", () => {
      expect(SIM_01_VECTOR.expected.totalRoutingWeight).toBe(4);
      expect(SIM_01_VECTOR.expected.hopCount).toBe(3);
    });

    it("preserves SIM-02 tie break order", () => {
      expect(SIM_02_VECTOR.expectedTotalWeight).toBe(2);
      expect(SIM_02_VECTOR.expectedPath[1]).toBe("dev_00000000-0000-4000-8000-00000000000b");
    });

    it("preserves SIM-03 failure scenario outcomes", () => {
      expect(SIM_03_VECTOR.scenarios[0]?.expectedTotalWeight).toBe(6);
      expect(SIM_03_VECTOR.scenarios[1]?.expectedTotalWeight).toBe(5);
      expect(SIM_03_VECTOR.scenarios[2]?.expectedNoPath).toBe(true);
    });
  });

  describe("RF and coverage vectors", () => {
    it("preserves RF-01 FSPL and RF-02 log distance", () => {
      expect(RF_01_VECTOR.expectedFsplDb).toBe(40.0442);
      expect(RF_01_VECTOR.expectedRoundedDb).toBe(40.04);
      expect(RF_02_VECTOR.expectedPathLossDb).toBe(70.0442);
    });

    it("preserves RF-03 received power and RF-04 wall loss", () => {
      expect(RF_03_VECTOR.expectedPrxDbm).toBe(-48.0442);
      expect(RF_04_VECTOR.cases[1]?.expectedLossDb).toBe(16);
    });

    it("preserves RF-05 class thresholds and RF-06 small grid", () => {
      expect(RF_05_VECTOR.cases[0]?.expectedClass).toBe("excellent");
      expect(RF_05_VECTOR.cases[7]?.expectedClass).toBe("deadZone");
      expect(RF_06_VECTOR.expectedCoveragePercent).toBe(50);
      expect(RF_06_VECTOR.expectedClassCounts.excellent).toBe(1);
    });
  });

  describe("Cost vectors", () => {
    it("preserves COST-01 arithmetic", () => {
      expect(COST_01_VECTOR.expected.purchasedCopperLengthM).toBe(110);
      expect(COST_01_VECTOR.expected.copperCost.amount).toBe(1100);
      expect(COST_01_VECTOR.expected.directCapexSubtotal.amount).toBe(3100);
      expect(COST_01_VECTOR.expected.contingency.amount).toBe(310);
      expect(COST_01_VECTOR.expected.capexBeforeTax.amount).toBe(3410);
      expect(COST_01_VECTOR.expected.annualEnergyKwh).toBe(175.2);
      expect(COST_01_VECTOR.expected.annualEnergyCost.amount).toBe(1401.6);
      expect(COST_01_VECTOR.expected.annualMaintenance.amount).toBe(155);
      expect(COST_01_VECTOR.expected.annualReplacementReserve.amount).toBe(400);
      expect(COST_01_VECTOR.expected.annualOpex.amount).toBe(1956.6);
      expect(COST_01_VECTOR.expected.tco.amount).toBe(13193);
    });
  });

  describe("Simulation vectors", () => {
    it("preserves SIM-04 latency breakdown", () => {
      expect(SIM_04_VECTOR.expected.totalMs).toBe(3.41);
      expect(SIM_04_VECTOR.expected.propagationMs).toBe(0.01);
      expect(SIM_04_VECTOR.expected.transmissionMs).toBe(2.4);
      expect(SIM_04_VECTOR.expected.processingMs).toBe(1.0);
    });

    it("preserves SIM-05 bottleneck and SIM-06 equal share", () => {
      expect(SIM_05_VECTOR.expected.bottleneckCapacityMbps).toBe(20);
      expect(SIM_05_VECTOR.expected.bottleneckLinkUtilizationRatio).toBe(1.0);
      expect(SIM_06_VECTOR.expected.equalSharePerFlowMbps).toBe(15);
      expect(SIM_06_VECTOR.expected.aggregateDeliveredMbps).toBe(30);
    });
  });
});

