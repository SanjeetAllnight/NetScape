import { describe, it, expect } from "vitest";
import {
  createProjectFrame,
  createLocalFrame,
  deriveLinkLengthM,
  checkPlanningExtent,
  isPointInBoundary,
  makeGeoPoint,
} from "@/domain/geo/localFrame";
import type { GeoPoint, GeoPolygon, DeviceId, LinkId, DesignId, Longitude, Latitude, CatalogItemId, EpochMs } from "@/contracts/primitives";
import type { Device, Link } from "@/contracts/domain";

describe("Local AEQD Frame & Transforms", () => {
  const origin: GeoPoint = makeGeoPoint(77.5946, 12.9716); // Bangalore
  const frame = createProjectFrame(origin);
  const localFrame = createLocalFrame(origin);

  it("projects the origin to (0, 0) metres", () => {
    const local = localFrame.toLocal(origin);
    expect(local.x).toBeCloseTo(0, 2);
    expect(local.y).toBeCloseTo(0, 2);
  });

  it("converts a point to local metres and round-trips back to geographic coordinates", () => {
    const pt: GeoPoint = makeGeoPoint(77.6000, 12.9750);
    const local = localFrame.toLocal(pt);
    expect(local.x).toBeGreaterThan(500); // ~585m east
    expect(local.y).toBeGreaterThan(300); // ~376m north

    const roundTrip = localFrame.toGeo(local);
    expect(roundTrip.coordinates[0]).toBeCloseTo(pt.coordinates[0], 5);
    expect(roundTrip.coordinates[1]).toBeCloseTo(pt.coordinates[1], 5);
  });

  it("checks planning boundary extent correctly (<= 20,000m limit)", () => {
    // 500m square polygon around origin
    const smallPoly: GeoPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [77.590 as Longitude, 12.970 as Latitude],
          [77.600 as Longitude, 12.970 as Latitude],
          [77.600 as Longitude, 12.980 as Latitude],
          [77.590 as Longitude, 12.980 as Latitude],
          [77.590 as Longitude, 12.970 as Latitude],
        ],
      ],
    };
    const smallResult = checkPlanningExtent(smallPoly, frame);
    expect(smallResult.ok).toBe(true);
    expect(smallResult.diagonalM).toBeLessThan(20000);

    // Huge polygon (> 30 km)
    const hugePoly: GeoPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [77.0 as Longitude, 12.5 as Latitude],
          [78.0 as Longitude, 12.5 as Latitude],
          [78.0 as Longitude, 13.5 as Latitude],
          [77.0 as Longitude, 13.5 as Latitude],
          [77.0 as Longitude, 12.5 as Latitude],
        ],
      ],
    };
    const hugeResult = checkPlanningExtent(hugePoly, frame);
    expect(hugeResult.ok).toBe(false);
    expect(hugeResult.diagonalM).toBeGreaterThan(20000);
  });

  it("derives link length correctly from device coordinates and overrides", () => {
    const dev1: Device = {
      id: "dev-1" as DeviceId,
      designId: "des-1" as DesignId,
      catalogItemId: "cat-1" as CatalogItemId,
      type: "router",
      name: "R1",
      hostname: null,
      position: makeGeoPoint(77.5946, 12.9716),
      overrides: {},
      notes: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const dev2: Device = {
      id: "dev-2" as DeviceId,
      designId: "des-1" as DesignId,
      catalogItemId: "cat-1" as CatalogItemId,
      type: "switch",
      name: "SW1",
      hostname: null,
      position: makeGeoPoint(77.6000, 12.9716), // approx 585m east
      overrides: {},
      notes: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };
    const devicesById: Record<DeviceId, Device> = {
      [dev1.id]: dev1,
      [dev2.id]: dev2,
    };

    const link: Link = {
      id: "link-1" as LinkId,
      designId: "des-1" as DesignId,
      sourceDeviceId: dev1.id,
      targetDeviceId: dev2.id,
      medium: "copper",
      installationMethod: null,
      geometry: {
        type: "LineString",
        coordinates: [dev1.position.coordinates, dev2.position.coordinates],
      },
      capacityMbps: 1000,
      routingWeight: 1,
      lengthOverrideM: null,
      createdAt: 1000 as EpochMs,
      updatedAt: 1000 as EpochMs,
    };

    const length = deriveLinkLengthM(link, devicesById, frame);
    expect(length).toBeCloseTo(585.88, 1);

    // With user override
    const linkWithOverride: Link = {
      ...link,
      lengthOverrideM: 42.5,
    };
    expect(deriveLinkLengthM(linkWithOverride, devicesById, frame)).toBe(42.5);
  });

  it("checks point inside boundary polygon", () => {
    const boundary: GeoPolygon = {
      type: "Polygon",
      coordinates: [
        [
          [77.590 as Longitude, 12.970 as Latitude],
          [77.600 as Longitude, 12.970 as Latitude],
          [77.600 as Longitude, 12.980 as Latitude],
          [77.590 as Longitude, 12.980 as Latitude],
          [77.590 as Longitude, 12.970 as Latitude],
        ],
      ],
    };

    const insidePt: GeoPoint = makeGeoPoint(77.595, 12.975);
    const outsidePt: GeoPoint = makeGeoPoint(77.610, 12.975);

    expect(isPointInBoundary(insidePt, boundary)).toBe(true);
    expect(isPointInBoundary(outsidePt, boundary)).toBe(false);
    expect(isPointInBoundary(outsidePt, null)).toBe(true); // null boundary permits any point
  });
});
