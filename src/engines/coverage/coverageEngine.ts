/**
 * Pure deterministic Metric-space Wireless Coverage Engine.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §10.2, §10.4, §19.3
 *
 * Implements:
 * - Log-distance path loss with d < d0 clamping to d0
 * - FSPL reference calculations
 * - Metric obstacle polygon wall crossing attenuation
 * - Rasterization within arbitrary boundary polygon mask
 * - Sentinels: 254 (outside mask), 255 (no serving AP), -127 (no signal)
 * - Deterministic RSSI classification and coverage percentage
 * - 8-neighbour connected-component dead zone identification
 * - Cooperative cancellation and progress reporting via RunContext
 */

import type { DeviceId, MetricBounds, Vec2 } from "@/contracts/primitives";
import type { SignalClass } from "@/contracts/enums";
import type {
  CoverageEngineInput,
  CoverageWorkerOutput,
  SignalClassCount,
  DeadZone,
  RunContext,
  CoverageEngine,
} from "@/contracts/engines";
import { EngineInputError } from "@/contracts/errors";
import { quantizeRssiDbm, roundToDecimals } from "@/kernel/rounding";
import { NO_SIGNAL_RSSI_DBM, GEOGRAPHY_LIMITS } from "@/contracts/constants";

/**
 * Standard FSPL formula in dB:
 * FSPL(dB) = 20 * log10(d_km) + 20 * log10(f_MHz) + 32.44
 */
export function calculateFsplDb(distanceKm: number, frequencyMhz: number): number {
  if (distanceKm <= 0 || frequencyMhz <= 0) {
    throw new RangeError("Distance and frequency must be strictly positive");
  }
  return 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMhz) + 32.44;
}

/**
 * Log-distance path loss:
 * For d >= d0: PL(d) = PL(d0) + 10 * n * log10(d / d0)
 * For d < d0: clamp to d0 => PL(d0)
 */
export function calculatePathLossDb(
  distanceM: number,
  referenceDistanceM: number,
  referenceLossDb: number,
  pathLossExponent: number
): number {
  const d = Math.max(distanceM, referenceDistanceM);
  return referenceLossDb + 10 * pathLossExponent * Math.log10(d / referenceDistanceM);
}

function ccw(p1: Vec2, p2: Vec2, p3: Vec2): number {
  return (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
}

/**
 * Checks if line segment (p1 -> p2) strictly intersects segment (q1 -> q2).
 */
export function segmentsIntersect(p1: Vec2, p2: Vec2, q1: Vec2, q2: Vec2): boolean {
  if (
    Math.max(p1.x, p2.x) < Math.min(q1.x, q2.x) - 1e-7 ||
    Math.min(p1.x, p2.x) > Math.max(q1.x, q2.x) + 1e-7 ||
    Math.max(p1.y, p2.y) < Math.min(q1.y, q2.y) - 1e-7 ||
    Math.min(p1.y, p2.y) > Math.max(q1.y, q2.y) + 1e-7
  ) {
    return false;
  }

  const cp1 = ccw(p1, p2, q1);
  const cp2 = ccw(p1, p2, q2);
  const cp3 = ccw(q1, q2, p1);
  const cp4 = ccw(q1, q2, p2);

  const signsP = (cp1 > 1e-7 && cp2 < -1e-7) || (cp1 < -1e-7 && cp2 > 1e-7);
  const signsQ = (cp3 > 1e-7 && cp4 < -1e-7) || (cp3 < -1e-7 && cp4 > 1e-7);

  return signsP && signsQ;
}

/**
 * Point-in-polygon ray-casting test for a metric coordinate in a polygon with optional holes.
 */
export function isPointInPolygonM(pt: Vec2, rings: Vec2[][]): boolean {
  const outer = rings[0];
  if (!outer || outer.length < 3) {
    return false;
  }

  // Check outer ring
  let inside = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const pi = outer[i];
    const pj = outer[j];
    if (!pi || !pj) continue;

    const intersect =
      pi.y > pt.y !== pj.y > pt.y &&
      pt.x < ((pj.x - pi.x) * (pt.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersect) {
      inside = !inside;
    }
  }

  if (!inside) {
    return false;
  }

  // Check holes (if inside any hole, point is outside)
  for (let h = 1; h < rings.length; h++) {
    const hole = rings[h];
    if (!hole || hole.length < 3) continue;

    let inHole = false;
    for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
      const pi = hole[i];
      const pj = hole[j];
      if (!pi || !pj) continue;

      const intersect =
        pi.y > pt.y !== pj.y > pt.y &&
        pt.x < ((pj.x - pi.x) * (pt.y - pi.y)) / (pj.y - pi.y) + pi.x;
      if (intersect) {
        inHole = !inHole;
      }
    }
    if (inHole) {
      return false;
    }
  }

  return true;
}

export function classifyRssi(
  rssiDbm: number,
  thresholds: {
    excellentMin: number;
    goodMin: number;
    fairMin: number;
    weakMin: number;
  }
): SignalClass {
  if (rssiDbm >= thresholds.excellentMin) {
    return "excellent";
  }
  if (rssiDbm >= thresholds.goodMin) {
    return "good";
  }
  if (rssiDbm >= thresholds.fairMin) {
    return "fair";
  }
  if (rssiDbm >= thresholds.weakMin) {
    return "weak";
  }
  return "deadZone";
}

export async function computeCoverage(
  input: CoverageEngineInput,
  context: RunContext
): Promise<CoverageWorkerOutput> {
  const { boundaryM, accessPoints, obstacles, settings } = input;

  if (!boundaryM || boundaryM.length === 0 || !boundaryM[0] || boundaryM[0].length < 3) {
    throw new EngineInputError("Coverage computation requires a valid closed boundary polygon");
  }

  const outerRing = boundaryM[0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pt of outerRing) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  const diagonal = Math.hypot(maxX - minX, maxY - minY);
  if (diagonal > GEOGRAPHY_LIMITS.maxPlanningExtentM) {
    throw new EngineInputError(
      `AREA_TOO_LARGE: Boundary diagonal ${Math.round(diagonal)}m exceeds maximum allowed ${GEOGRAPHY_LIMITS.maxPlanningExtentM}m`
    );
  }

  for (const ap of accessPoints) {
    const dist = Math.hypot(ap.positionM.x, ap.positionM.y);
    if (dist > GEOGRAPHY_LIMITS.maxPlanningExtentM) {
      throw new EngineInputError(
        `AREA_TOO_LARGE: Access point '${ap.deviceId}' distance ${Math.round(dist)}m exceeds maximum allowed ${GEOGRAPHY_LIMITS.maxPlanningExtentM}m`
      );
    }
  }

  const cellSize = settings.gridResolutionM;
  if (cellSize <= 0) {
    throw new EngineInputError(`Invalid gridResolutionM: ${cellSize}`);
  }

  const width = Math.max(1, Math.ceil((maxX - minX) / cellSize));
  const height = Math.max(1, Math.ceil((maxY - minY) / cellSize));
  const totalCells = width * height;

  if (totalCells > 1_000_000) {
    throw new EngineInputError(
      `Grid resolution exceeds 1,000,000 cell limit: ${width}x${height} = ${totalCells} cells`
    );
  }

  const rssiDbm = new Int8Array(totalCells);
  const servingIndex = new Uint8Array(totalCells);

  const OUTSIDE_MASK = 254;
  const NO_SERVING = 255;

  const sortedAps = [...accessPoints].sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  const servingAccessPointIds: DeviceId[] = sortedAps.map((ap) => ap.deviceId);

  let includedCellCount = 0;
  let coveredCellCount = 0;

  const classCountsMap: Record<SignalClass, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    weak: 0,
    deadZone: 0,
  };

  const deadZoneGrid = new Uint8Array(totalCells); // 1 if dead zone inside polygon
  const unquantizedBestRssi = new Float32Array(totalCells);

  const d0 = settings.referenceDistanceM;
  const pl0 = settings.referenceLossDb;
  const n = settings.pathLossExponent;
  const minAcceptable = settings.minimumAcceptableRssiDbm;

  let lastYieldTime = Date.now();

  for (let row = 0; row < height; row++) {
    if (context.shouldCancel()) {
      throw new Error("Worker cancelled");
    }

    const now = Date.now();
    if (now - lastYieldTime > 25) {
      context.reportProgress(row / height, "Computing coverage raster...");
      await context.yieldToEventLoop();
      lastYieldTime = Date.now();
    }

    const cellY = minY + (row + 0.5) * cellSize;

    for (let col = 0; col < width; col++) {
      const idx = row * width + col;
      const cellX = minX + (col + 0.5) * cellSize;
      const cellPt: Vec2 = { coordinateSpace: "projectMetric", x: cellX, y: cellY };

      if (!isPointInPolygonM(cellPt, boundaryM)) {
        servingIndex[idx] = OUTSIDE_MASK;
        rssiDbm[idx] = NO_SIGNAL_RSSI_DBM;
        unquantizedBestRssi[idx] = NO_SIGNAL_RSSI_DBM;
        continue;
      }

      includedCellCount++;

      if (sortedAps.length === 0) {
        servingIndex[idx] = NO_SERVING;
        rssiDbm[idx] = NO_SIGNAL_RSSI_DBM;
        unquantizedBestRssi[idx] = NO_SIGNAL_RSSI_DBM;
        classCountsMap.deadZone++;
        deadZoneGrid[idx] = 1;
        continue;
      }

      let bestRssi = -Infinity;
      let bestApIdx = -1;

      for (let a = 0; a < sortedAps.length; a++) {
        const ap = sortedAps[a];
        if (!ap) continue;

        const dist = Math.hypot(cellX - ap.positionM.x, cellY - ap.positionM.y);
        const pl = calculatePathLossDb(dist, d0, pl0, n);

        // Wall loss
        let wallLoss = 0;
        for (const obs of obstacles) {
          for (const ring of obs.polygonM) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
              const q1 = ring[i];
              const q2 = ring[j];
              if (!q1 || !q2) continue;

              if (segmentsIntersect(ap.positionM, cellPt, q1, q2)) {
                wallLoss += obs.lossDbPerCrossing;
              }
            }
          }
        }

        const prx = ap.txPowerDbm + ap.antennaGainDbi + 0 - pl - wallLoss;

        if (prx > bestRssi) {
          bestRssi = prx;
          bestApIdx = a;
        }
      }

      unquantizedBestRssi[idx] = bestRssi;
      servingIndex[idx] = bestApIdx >= 0 ? bestApIdx : NO_SERVING;
      rssiDbm[idx] = quantizeRssiDbm(bestRssi);

      if (bestRssi >= minAcceptable) {
        coveredCellCount++;
      }

      const signalClass = classifyRssi(bestRssi, settings.signalThresholdsDbm);
      classCountsMap[signalClass]++;

      if (signalClass === "deadZone") {
        deadZoneGrid[idx] = 1;
      }
    }
  }

  if (includedCellCount === 0) {
    throw new EngineInputError("Boundary polygon contains zero raster grid cells");
  }

  // 8-neighbour connected component analysis for dead zones
  const visited = new Uint8Array(totalCells);
  const deadZones: DeadZone[] = [];
  const cellArea = cellSize * cellSize;

  const neighbourOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ];

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const startIdx = row * width + col;
      if (deadZoneGrid[startIdx] !== 1 || visited[startIdx] === 1) {
        continue;
      }

      // BFS to find all connected dead zone cells
      const queue: [number, number][] = [[row, col]];
      visited[startIdx] = 1;

      let componentCellCount = 0;
      let sumX = 0;
      let sumY = 0;
      let compMinX = Infinity;
      let compMinY = Infinity;
      let compMaxX = -Infinity;
      let compMaxY = -Infinity;
      let worstRssi = Infinity;

      let head = 0;
      while (head < queue.length) {
        const item = queue[head++];
        if (!item) break;
        const [r, c] = item;
        const curIdx = r * width + c;

        componentCellCount++;
        const curX = minX + (c + 0.5) * cellSize;
        const curY = minY + (r + 0.5) * cellSize;

        sumX += curX;
        sumY += curY;
        if (curX - cellSize / 2 < compMinX) compMinX = curX - cellSize / 2;
        if (curY - cellSize / 2 < compMinY) compMinY = curY - cellSize / 2;
        if (curX + cellSize / 2 > compMaxX) compMaxX = curX + cellSize / 2;
        if (curY + cellSize / 2 > compMaxY) compMaxY = curY + cellSize / 2;

        const rssi = unquantizedBestRssi[curIdx] ?? NO_SIGNAL_RSSI_DBM;
        if (rssi < worstRssi) {
          worstRssi = rssi;
        }

        for (const [dr, dc] of neighbourOffsets) {
          if (dr === undefined || dc === undefined) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
            const nIdx = nr * width + nc;
            if (deadZoneGrid[nIdx] === 1 && visited[nIdx] === 0) {
              visited[nIdx] = 1;
              queue.push([nr, nc]);
            }
          }
        }
      }

      const id = `deadzone-${deadZones.length + 1}`;
      const centroid: Vec2 = {
        coordinateSpace: "projectMetric",
        x: roundToDecimals(sumX / componentCellCount, 2),
        y: roundToDecimals(sumY / componentCellCount, 2),
      };
      const bounds: MetricBounds = {
        minX: roundToDecimals(compMinX, 2),
        minY: roundToDecimals(compMinY, 2),
        maxX: roundToDecimals(compMaxX, 2),
        maxY: roundToDecimals(compMaxY, 2),
      };

      deadZones.push({
        id,
        centroidLocalM: centroid,
        boundsLocalM: bounds,
        areaM2: roundToDecimals(componentCellCount * cellArea, 2),
        cellCount: componentCellCount,
        worstRssiDbm: roundToDecimals(worstRssi, 2),
      });
    }
  }

  const classCounts: SignalClassCount[] = [
    { class: "excellent", cellCount: classCountsMap.excellent, areaM2: classCountsMap.excellent * cellArea },
    { class: "good", cellCount: classCountsMap.good, areaM2: classCountsMap.good * cellArea },
    { class: "fair", cellCount: classCountsMap.fair, areaM2: classCountsMap.fair * cellArea },
    { class: "weak", cellCount: classCountsMap.weak, areaM2: classCountsMap.weak * cellArea },
    { class: "deadZone", cellCount: classCountsMap.deadZone, areaM2: classCountsMap.deadZone * cellArea },
  ];

  const coveragePercent = roundToDecimals(
    (coveredCellCount / includedCellCount) * 100,
    2
  );

  const limitationNotes: string[] = [
    "Log-distance path-loss approximation; does not account for diffraction, multipath, interference, or 3D floor structures.",
    "Reference client antenna gain is fixed at 0 dBi.",
    "Wall attenuation applies discrete obstacle loss per boundary crossing.",
  ];

  return {
    result: {
      isEstimate: true,
      model: "logDistance",
      coveragePercent,
      minimumAcceptableRssiDbm: minAcceptable,
      includedCellCount,
      coveredCellCount,
      classCounts,
      deadZones,
      parameters: settings,
      referenceReceiverGainDbi: 0,
      limitationNotes,
      grid: {
        width,
        height,
        cellSizeM: cellSize,
        topLeftLocalM: {
          coordinateSpace: "projectMetric",
          x: roundToDecimals(minX, 2),
          y: roundToDecimals(maxY, 2), // top-left is minX, maxY in standard 2D cartesian
        },
        totalIncludedCells: includedCellCount,
        rasterEncoding: "int8-rssi-dBm",
        servingIndexEncoding: "uint8-access-point-index-with-mask-sentinels",
        noSignalRssiDbm: -127,
        outsideMaskIndex: 254,
        noServingIndex: 255,
      },
    },
    rssiDbm,
    servingIndex,
    servingAccessPointIds,
  };
}

export const defaultCoverageEngine: CoverageEngine = {
  compute: computeCoverage,
};
