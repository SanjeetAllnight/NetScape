/**
 * Project-local azimuthal-equidistant (AEQD) engineering coordinate frame and transforms.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §6
 *
 * All engineering calculations use Euclidean 2D metric coordinates derived from
 * this local AEQD projection. Proj4 is used strictly within this boundary.
 */

import proj4 from "proj4";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import type {
  GeoPoint,
  GeoPolygon,
  GeoLineString,
  Vec2,
  DeviceId,
  Longitude,
  Latitude,
  LonLat,
} from "@/contracts/primitives";
import type { ProjectFrame, Device, Link } from "@/contracts/domain";
import { roundToDecimals } from "@/kernel/rounding";

export interface LocalFrameTransform {
  toLocal(point: GeoPoint): Vec2;
  toGeo(point: Vec2): GeoPoint;
  polygonToLocal(polygon: GeoPolygon): Vec2[][];
  lineToLocal(line: GeoLineString): Vec2[];
}

export function createAeqdDefinition(origin: GeoPoint): string {
  const [lng, lat] = origin.coordinates;
  return `+proj=aeqd +lat_0=${lat} +lon_0=${lng} +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs`;
}

export function createProjectFrame(origin: GeoPoint): ProjectFrame {
  return {
    kind: "azimuthalEquidistant",
    origin,
    units: "m",
    definition: createAeqdDefinition(origin),
  };
}

export function createLocalFrame(origin: GeoPoint): LocalFrameTransform {
  const def = createAeqdDefinition(origin);
  const converter = proj4(def);

  return {
    toLocal(point: GeoPoint): Vec2 {
      const [x, y] = converter.forward(point.coordinates);
      return {
        coordinateSpace: "projectMetric",
        x: roundToDecimals(x, 4),
        y: roundToDecimals(y, 4),
      };
    },
    toGeo(point: Vec2): GeoPoint {
      const [lng, lat] = converter.inverse([point.x, point.y]);
      return {
        type: "Point",
        coordinates: [
          roundToDecimals(lng, 7) as Longitude,
          roundToDecimals(lat, 7) as Latitude,
        ],
      };
    },
    polygonToLocal(polygon: GeoPolygon): Vec2[][] {
      return polygon.coordinates.map((ring) =>
        ring.map((coord) => {
          const [x, y] = converter.forward(coord);
          return {
            coordinateSpace: "projectMetric",
            x: roundToDecimals(x, 4),
            y: roundToDecimals(y, 4),
          };
        })
      );
    },
    lineToLocal(line: GeoLineString): Vec2[] {
      return line.coordinates.map((coord) => {
        const [x, y] = converter.forward(coord);
        return {
          coordinateSpace: "projectMetric",
          x: roundToDecimals(x, 4),
          y: roundToDecimals(y, 4),
        };
      });
    },
  };
}

export function geoPointToLocal(point: GeoPoint, frame: ProjectFrame): Vec2 {
  const [x, y] = proj4(frame.definition, point.coordinates);
  return {
    coordinateSpace: "projectMetric",
    x: roundToDecimals(x, 4),
    y: roundToDecimals(y, 4),
  };
}

export function localPointToGeo(point: Vec2, frame: ProjectFrame): GeoPoint {
  const [lng, lat] = proj4(frame.definition).inverse([point.x, point.y]);
  return {
    type: "Point",
    coordinates: [
      roundToDecimals(lng, 7) as Longitude,
      roundToDecimals(lat, 7) as Latitude,
    ],
  };
}

export function geoPolygonToLocal(
  polygon: GeoPolygon,
  frame: ProjectFrame
): Vec2[][] {
  const converter = proj4(frame.definition);
  return polygon.coordinates.map((ring) =>
    ring.map((coord) => {
      const [x, y] = converter.forward(coord);
      return {
        coordinateSpace: "projectMetric",
        x: roundToDecimals(x, 4),
        y: roundToDecimals(y, 4),
      };
    })
  );
}

export function geoLineStringToLocal(
  line: GeoLineString,
  frame: ProjectFrame
): Vec2[] {
  const converter = proj4(frame.definition);
  return line.coordinates.map((coord) => {
    const [x, y] = converter.forward(coord);
    return {
      coordinateSpace: "projectMetric",
      x: roundToDecimals(x, 4),
      y: roundToDecimals(y, 4),
    };
  });
}

/**
 * Derives link length in metres.
 * If lengthOverrideM is provided, returns that.
 * Otherwise computes Euclidean metric distance between device endpoints in project frame.
 */
export function deriveLinkLengthM(
  link: Link,
  devicesById: Record<DeviceId, Device>,
  frame: ProjectFrame
): number {
  if (link.lengthOverrideM != null && link.lengthOverrideM > 0) {
    return roundToDecimals(link.lengthOverrideM, 2);
  }

  const source = devicesById[link.sourceDeviceId];
  const target = devicesById[link.targetDeviceId];
  if (!source || !target) {
    return 0;
  }

  const p1 = geoPointToLocal(source.position, frame);
  const p2 = geoPointToLocal(target.position, frame);
  const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  return roundToDecimals(distance, 2);
}

/**
 * Checks whether a boundary polygon's bounding-box diagonal in local frame is <= 20,000 m.
 */
export function checkPlanningExtent(
  polygon: GeoPolygon,
  frame: ProjectFrame
): { ok: boolean; diagonalM: number } {
  const localRings = geoPolygonToLocal(polygon, frame);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const ring of localRings) {
    for (const pt of ring) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  if (!Number.isFinite(minX)) {
    return { ok: false, diagonalM: 0 };
  }

  const diagonalM = roundToDecimals(Math.hypot(maxX - minX, maxY - minY), 2);
  return {
    ok: diagonalM <= 20000,
    diagonalM,
  };
}

/**
 * Checks if a geographic point lies inside a boundary polygon.
 * If boundary is null, returns true.
 */
export function isPointInBoundary(
  point: GeoPoint,
  boundary: GeoPolygon | null
): boolean {
  if (!boundary) return true;
  const pt = turfPoint(point.coordinates);
  return booleanPointInPolygon(pt, boundary);
}

export function makeGeoPoint(lng: number, lat: number): GeoPoint {
  return {
    type: "Point",
    coordinates: [lng as Longitude, lat as Latitude],
  };
}

export function makeLonLat(lng: number, lat: number): LonLat {
  return [lng as Longitude, lat as Latitude];
}
