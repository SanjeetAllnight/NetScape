import { describe, it, expect } from "vitest";
import {
  DATABASE_NAME,
  DATABASE_VERSION,
  WORKER_PROTOCOL_VERSION,
  DESIGN_LIMITS,
  COVERAGE_LIMITS,
  GEOGRAPHY_LIMITS,
  SIMULATION_DEFAULTS,
  COST_DEFAULTS,
  COVERAGE_DEFAULTS,
  ENGINE_IDS,
  ENGINE_VERSIONS,
  NO_SIGNAL_RSSI_DBM,
  OUTSIDE_COVERAGE_MASK_INDEX,
  NO_SERVING_AP_INDEX,
  BUILTIN_CATALOG_SEED,
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_BASELINE_DESIGN_NAME,
} from "@/contracts";

import {
  canonicalJson,
  roundToDecimals,
  quantizeRssiDbm,
  compareIdentifiers,
  isValidPrefixedId,
  BinaryHeap,
} from "@/kernel";

describe("Shared Contracts and Constants (Frozen v1.2)", () => {
  it("exports exact database and worker constants", () => {
    expect(DATABASE_NAME).toBe("netscape");
    expect(DATABASE_VERSION).toBe(1);
    expect(WORKER_PROTOCOL_VERSION).toBe(1);
  });

  it("exports exact design and coverage limits", () => {
    expect(DESIGN_LIMITS.maxDevices).toBe(500);
    expect(DESIGN_LIMITS.maxLinks).toBe(1000);
    expect(COVERAGE_LIMITS.maxAccessPoints).toBe(100);
    expect(COVERAGE_LIMITS.maxGridCells).toBe(1_000_000);
    expect(GEOGRAPHY_LIMITS.maxPlanningExtentM).toBe(20_000);
  });

  it("exports exact numerical defaults and sentinel indices", () => {
    expect(COST_DEFAULTS.currency).toBe("INR");
    expect(COST_DEFAULTS.cableSlackPct).toBe(15);
    expect(COST_DEFAULTS.devicePowerDutyRatio).toBe(1);
    expect(SIMULATION_DEFAULTS.perHostDemandMbps).toBe(5);
    expect(SIMULATION_DEFAULTS.routingWeight).toBe(1);
    expect(COVERAGE_DEFAULTS.referenceLossDb).toBe(40.0442);
    expect(COVERAGE_DEFAULTS.referenceReceiverGainDbi).toBe(0);
    expect(NO_SIGNAL_RSSI_DBM).toBe(-127);
    expect(OUTSIDE_COVERAGE_MASK_INDEX).toBe(254);
    expect(NO_SERVING_AP_INDEX).toBe(255);
    expect(DEFAULT_BASELINE_DESIGN_NAME).toBe("Baseline");
    expect(ENGINE_IDS.ip).toBe("netscape.ip");
    expect(ENGINE_VERSIONS.ip).toBe(1);
  });

  it("exports the four approved synthetic built-in catalogue items", () => {
    expect(BUILTIN_CATALOG_SEED).toHaveLength(4);
    const types = BUILTIN_CATALOG_SEED.map((item) => item.type);
    expect(types).toEqual(["router", "switch", "accessPoint", "server"]);
    for (const item of BUILTIN_CATALOG_SEED) {
      expect(item.origin).toBe("builtIn");
      expect(item.priceProvenance).toBe("sample");
      expect(item.unitPrice.currency).toBe("INR");
    }
  });

  it("exports unlinked deep default project settings", () => {
    expect(DEFAULT_PROJECT_SETTINGS.cost.currency).toBe("INR");
    expect(DEFAULT_PROJECT_SETTINGS.coverage.frequencyMhz).toBe(2400);
    expect(DEFAULT_PROJECT_SETTINGS.simulation.perHostDemandMbps).toBe(5);
  });
});

describe("Kernel Primitives", () => {
  describe("canonicalJson", () => {
    it("sorts object keys lexically", () => {
      const a = { z: 1, a: 2, m: { b: 3, a: 4 } };
      expect(canonicalJson(a)).toBe('{"a":2,"m":{"a":4,"b":3},"z":1}');
    });

    it("normalizes -0 to 0", () => {
      expect(canonicalJson({ val: -0 })).toBe('{"val":0}');
    });

    it("throws on non-finite numbers", () => {
      expect(() => canonicalJson({ val: NaN })).toThrow(/non-finite/);
      expect(() => canonicalJson({ val: Infinity })).toThrow(/non-finite/);
    });

    it("throws on undefined property", () => {
      expect(() => canonicalJson({ val: undefined })).toThrow(/undefined/);
    });
  });

  describe("rounding and quantization", () => {
    it("rounds decimals deterministically", () => {
      expect(roundToDecimals(40.0442, 2)).toBe(40.04);
      expect(roundToDecimals(13193.004, 2)).toBe(13193.0);
      expect(roundToDecimals(1.005, 2)).toBe(1.01);
    });

    it("quantizes RSSI dBm with -127 reserved for no-signal", () => {
      expect(quantizeRssiDbm(-127)).toBe(-127);
      expect(quantizeRssiDbm(-130)).toBe(-127);
      expect(quantizeRssiDbm(-75.4)).toBe(-75);
      expect(quantizeRssiDbm(-75.6)).toBe(-76);
      expect(quantizeRssiDbm(-126.2)).toBe(-126);
      expect(quantizeRssiDbm(200)).toBe(127);
    });
  });

  describe("identifiers", () => {
    it("compares identifiers deterministically", () => {
      expect(compareIdentifiers("dev_a", "dev_b")).toBe(-1);
      expect(compareIdentifiers("dev_b", "dev_a")).toBe(1);
      expect(compareIdentifiers("dev_a", "dev_a")).toBe(0);
    });

    it("validates prefix and UUID v4 structure", () => {
      const valid = "dev_550e8400-e29b-41d4-a716-446655440000";
      expect(isValidPrefixedId(valid, "dev_")).toBe(true);
      expect(isValidPrefixedId(valid, "prj_")).toBe(false);
      expect(isValidPrefixedId("dev_invalid-uuid", "dev_")).toBe(false);
    });
  });

  describe("BinaryHeap", () => {
    it("maintains min-heap property", () => {
      const heap = new BinaryHeap<number>((a, b) => a - b);
      heap.push(10);
      heap.push(3);
      heap.push(7);
      heap.push(1);

      expect(heap.size).toBe(4);
      expect(heap.pop()).toBe(1);
      expect(heap.pop()).toBe(3);
      expect(heap.pop()).toBe(7);
      expect(heap.pop()).toBe(10);
      expect(heap.isEmpty()).toBe(true);
    });
  });
});
