import { describe, it, expect } from "vitest";
import {
  calculateFsplDb,
  calculatePathLossDb,
  classifyRssi,
  segmentsIntersect,
  computeCoverage,
} from "@/engines/coverage/coverageEngine";
import {
  RF_01_VECTOR,
  RF_02_VECTOR,
  RF_03_VECTOR,
  RF_04_VECTOR,
  RF_05_VECTOR,
  RF_06_VECTOR,
} from "../../vectors/rf.vectors";
import { roundToDecimals } from "@/kernel/rounding";
import type { Vec2, DeviceId, DesignId } from "@/contracts/primitives";
import type { CoverageEngineInput, RunContext } from "@/contracts/engines";

describe("Coverage Engine (P1-04)", () => {
  describe("Normative RF Vectors", () => {
    it("matches RF-01 FSPL at 2.4 GHz and 1 m", () => {
      const fspl = calculateFsplDb(RF_01_VECTOR.dKm, RF_01_VECTOR.fMhz);
      expect(Math.abs(fspl - RF_01_VECTOR.expectedFsplDb)).toBeLessThanOrEqual(
        RF_01_VECTOR.toleranceDb
      );
      expect(roundToDecimals(fspl, 2)).toBe(RF_01_VECTOR.expectedRoundedDb);
    });

    it("matches RF-02 Log-distance at 10 m", () => {
      const pl = calculatePathLossDb(
        RF_02_VECTOR.dM,
        RF_02_VECTOR.d0M,
        RF_02_VECTOR.referenceLossDb,
        RF_02_VECTOR.n
      );
      expect(Math.abs(pl - RF_02_VECTOR.expectedPathLossDb)).toBeLessThanOrEqual(
        RF_02_VECTOR.toleranceDb
      );
    });

    it("matches RF-03 Received power without wall loss", () => {
      const prx =
        RF_03_VECTOR.ptxDbm +
        RF_03_VECTOR.gtxDbi +
        RF_03_VECTOR.grxDbi -
        RF_03_VECTOR.pathLossDb -
        RF_03_VECTOR.wallLossDb;
      expect(Math.abs(prx - RF_03_VECTOR.expectedPrxDbm)).toBeLessThanOrEqual(
        RF_03_VECTOR.toleranceDb
      );
    });

    it("matches RF-04 Wall crossing calculation", () => {
      for (const item of RF_04_VECTOR.cases) {
        const totalLoss = item.crossings * RF_04_VECTOR.lossDbPerCrossing;
        expect(totalLoss).toBe(item.expectedLossDb);
      }
    });

    it("matches RF-05 RSSI class boundaries", () => {
      const thresholds = {
        excellentMin: -55,
        goodMin: -67,
        fairMin: -75,
        weakMin: -85,
      };

      for (const c of RF_05_VECTOR.cases) {
        const actual = classifyRssi(c.rssiDbm, thresholds);
        expect(actual).toBe(c.expectedClass);
      }
    });

    it("matches RF-06 class counts and coverage percent logic", () => {
      const thresholds = {
        excellentMin: -55,
        goodMin: -67,
        fairMin: -75,
        weakMin: -85,
      };

      let covered = 0;
      const classCounts = {
        excellent: 0,
        good: 0,
        fair: 0,
        weak: 0,
        deadZone: 0,
      };

      for (const rssi of RF_06_VECTOR.includedCellsBestRssiDbm) {
        if (rssi >= RF_06_VECTOR.minimumAcceptableRssiDbm) {
          covered++;
        }
        const cls = classifyRssi(rssi, thresholds);
        classCounts[cls]++;
      }

      expect(covered).toBe(RF_06_VECTOR.expectedCoveredCellCount);
      expect((covered / RF_06_VECTOR.includedCellsBestRssiDbm.length) * 100).toBe(
        RF_06_VECTOR.expectedCoveragePercent
      );
      expect(classCounts).toEqual(RF_06_VECTOR.expectedClassCounts);
    });
  });

  describe("Geometry helpers", () => {
    it("detects segment intersection correctly", () => {
      const p1: Vec2 = { coordinateSpace: "projectMetric", x: 0, y: 0 };
      const p2: Vec2 = { coordinateSpace: "projectMetric", x: 10, y: 10 };

      const q1: Vec2 = { coordinateSpace: "projectMetric", x: 0, y: 10 };
      const q2: Vec2 = { coordinateSpace: "projectMetric", x: 10, y: 0 };

      expect(segmentsIntersect(p1, p2, q1, q2)).toBe(true);

      const q3: Vec2 = { coordinateSpace: "projectMetric", x: 15, y: 0 };
      const q4: Vec2 = { coordinateSpace: "projectMetric", x: 15, y: 10 };
      expect(segmentsIntersect(p1, p2, q3, q4)).toBe(false);
    });
  });

  describe("computeCoverage execution", () => {
    const dummyContext: RunContext = {
      shouldCancel: () => false,
      reportProgress: () => {},
      yieldToEventLoop: async () => {},
    };

    it("computes coverage raster, sentinel values, and dead zone components", async () => {
      // 20m x 20m square
      const boundaryM: Vec2[][] = [
        [
          { coordinateSpace: "projectMetric", x: 0, y: 0 },
          { coordinateSpace: "projectMetric", x: 20, y: 0 },
          { coordinateSpace: "projectMetric", x: 20, y: 20 },
          { coordinateSpace: "projectMetric", x: 0, y: 20 },
          { coordinateSpace: "projectMetric", x: 0, y: 0 },
        ],
      ];

      const input: CoverageEngineInput = {
        designId: "des-1" as DesignId,
        boundaryM,
        accessPoints: [
          {
            deviceId: "dev-ap1" as DeviceId,
            positionM: { coordinateSpace: "projectMetric", x: 2, y: 2 },
            txPowerDbm: 20,
            antennaGainDbi: 2,
          },
        ],
        obstacles: [],
        settings: {
          model: "logDistance",
          frequencyMhz: 2400,
          referenceDistanceM: 1,
          referenceLossDb: 40.0442,
          pathLossExponent: 3.0,
          minimumAcceptableRssiDbm: -75,
          gridResolutionM: 2, // 10x10 = 100 cells
          signalThresholdsDbm: {
            excellentMin: -55,
            goodMin: -67,
            fairMin: -75,
            weakMin: -85,
          },
          wallLossDbPerCrossing: {
            concrete: 12,
            brick: 8,
            glass: 3,
            drywall: 4,
          },
        },
        receiverAntennaGainDbi: 0,
      };

      const output = await computeCoverage(input, dummyContext);

      expect(output.result.isEstimate).toBe(true);
      expect(output.result.grid.width).toBe(10);
      expect(output.result.grid.height).toBe(10);
      expect(output.result.includedCellCount).toBeGreaterThan(0);
      expect(output.rssiDbm.length).toBe(100);
      expect(output.servingIndex.length).toBe(100);

      // Verify cell close to AP is excellent
      expect(output.rssiDbm[0]).toBeGreaterThanOrEqual(-55);

      // Verify dead zones
      expect(Array.isArray(output.result.deadZones)).toBe(true);
    });

    it("respects cooperative cancellation via RunContext", async () => {
      const boundaryM: Vec2[][] = [
        [
          { coordinateSpace: "projectMetric", x: 0, y: 0 },
          { coordinateSpace: "projectMetric", x: 20, y: 0 },
          { coordinateSpace: "projectMetric", x: 20, y: 20 },
          { coordinateSpace: "projectMetric", x: 0, y: 20 },
        ],
      ];

      const cancelContext: RunContext = {
        shouldCancel: () => true, // immediately cancelled
        reportProgress: () => {},
        yieldToEventLoop: async () => {},
      };

      const input: CoverageEngineInput = {
        designId: "des-cancel" as DesignId,
        boundaryM,
        accessPoints: [],
        obstacles: [],
        settings: {
          model: "logDistance",
          frequencyMhz: 2400,
          referenceDistanceM: 1,
          referenceLossDb: 40.0442,
          pathLossExponent: 3.0,
          minimumAcceptableRssiDbm: -75,
          gridResolutionM: 1,
          signalThresholdsDbm: {
            excellentMin: -55,
            goodMin: -67,
            fairMin: -75,
            weakMin: -85,
          },
          wallLossDbPerCrossing: {
            concrete: 12,
            brick: 8,
            glass: 3,
            drywall: 4,
          },
        },
        receiverAntennaGainDbi: 0,
      };

      await expect(computeCoverage(input, cancelContext)).rejects.toThrow(/cancelled/i);
    });
  });
});
