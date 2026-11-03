import { describe, it, expect } from "vitest";
import { computeCoverage } from "@/engines/coverage/coverageEngine";
import type { Vec2, DeviceId, ObstacleId, DesignId } from "@/contracts/primitives";
import type { CoverageEngineInput, RunContext } from "@/contracts/engines";

describe("Coverage Raster Benchmark (Phase 1 Gate)", () => {
  it("computes a 10,000-cell representative grid within interactive bounds (< 1000 ms)", async () => {
    // 100m x 100m area with 1m grid resolution = 10,000 cells
    const boundaryM: Vec2[][] = [
      [
        { coordinateSpace: "projectMetric", x: 0, y: 0 },
        { coordinateSpace: "projectMetric", x: 100, y: 0 },
        { coordinateSpace: "projectMetric", x: 100, y: 100 },
        { coordinateSpace: "projectMetric", x: 0, y: 100 },
        { coordinateSpace: "projectMetric", x: 0, y: 0 },
      ],
    ];

    const accessPoints = [
      {
        deviceId: "ap-nw" as DeviceId,
        positionM: { coordinateSpace: "projectMetric", x: 25, y: 75 } as Vec2,
        txPowerDbm: 20,
        antennaGainDbi: 2,
      },
      {
        deviceId: "ap-ne" as DeviceId,
        positionM: { coordinateSpace: "projectMetric", x: 75, y: 75 } as Vec2,
        txPowerDbm: 20,
        antennaGainDbi: 2,
      },
      {
        deviceId: "ap-sw" as DeviceId,
        positionM: { coordinateSpace: "projectMetric", x: 25, y: 25 } as Vec2,
        txPowerDbm: 20,
        antennaGainDbi: 2,
      },
      {
        deviceId: "ap-se" as DeviceId,
        positionM: { coordinateSpace: "projectMetric", x: 75, y: 25 } as Vec2,
        txPowerDbm: 20,
        antennaGainDbi: 2,
      },
    ];

    const obstacles = [
      {
        obstacleId: "obs-wall1" as ObstacleId,
        polygonM: [
          [
            { coordinateSpace: "projectMetric" as const, x: 45, y: 10 },
            { coordinateSpace: "projectMetric" as const, x: 55, y: 10 },
            { coordinateSpace: "projectMetric" as const, x: 55, y: 90 },
            { coordinateSpace: "projectMetric" as const, x: 45, y: 90 },
            { coordinateSpace: "projectMetric" as const, x: 45, y: 10 },
          ],
        ],
        lossDbPerCrossing: 12, // Concrete
      },
    ];

    const input: CoverageEngineInput = {
      designId: "des-bench" as DesignId,
      boundaryM,
      accessPoints,
      obstacles,
      settings: {
        model: "logDistance",
        frequencyMhz: 2400,
        referenceDistanceM: 1,
        referenceLossDb: 40.0442,
        pathLossExponent: 3.0,
        minimumAcceptableRssiDbm: -75,
        gridResolutionM: 1, // 100x100 = 10,000 cells
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

    const runContext: RunContext = {
      shouldCancel: () => false,
      reportProgress: () => {},
      yieldToEventLoop: async () => {},
    };

    const startTime = performance.now();
    const output = await computeCoverage(input, runContext);
    const durationMs = performance.now() - startTime;

    // Output stats for evidence reporting
    console.log(
      `[BENCHMARK] Coverage calculation: ${output.result.includedCellCount} cells computed in ${durationMs.toFixed(2)} ms (${(output.result.includedCellCount / (durationMs / 1000)).toFixed(0)} cells/sec)`
    );

    expect(output.result.grid.width).toBe(100);
    expect(output.result.grid.height).toBe(100);
    expect(output.result.includedCellCount).toBe(10000);
    expect(output.result.coveragePercent).toBeGreaterThan(0);
    // Standard interactive threshold is under 1,000ms for 10k cells
    expect(durationMs).toBeLessThan(1000);
  });
});
