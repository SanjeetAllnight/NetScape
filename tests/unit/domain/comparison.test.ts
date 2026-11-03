import { describe, it, expect } from "vitest";
import { computeStructuralDiff, compareMetric } from "@/domain/comparison/compareDesigns";
import type { DesignAggregate, Device, Link, Design } from "@/contracts/domain";
import type { DeviceId, LinkId, DesignId, CatalogItemId, EpochMs, ProjectId, MapRegionId } from "@/contracts/primitives";
import { createProjectFrame, makeGeoPoint } from "@/domain/geo/localFrame";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";

describe("Domain Design Comparison & Structural Diff", () => {
  const origin = makeGeoPoint(77.5946, 12.9716);
  const project = {
    id: "p1" as ProjectId,
    name: "Project 1",
    description: null,
    regionId: "r1" as MapRegionId,
    settings: DEFAULT_PROJECT_SETTINGS,
    frame: createProjectFrame(origin),
    revision: 1,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
    lastOpenedAt: 1000 as EpochMs,
  };

  const region = {
    id: "r1" as MapRegionId,
    projectId: "p1" as ProjectId,
    label: "Region 1",
    center: origin,
    bbox: null,
    boundary: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const designA: Design = {
    id: "dA" as DesignId,
    projectId: "p1" as ProjectId,
    parentDesignId: null,
    name: "Option A",
    notes: null,
    isBaseline: true,
    revision: 1,
    logicalLayout: {},
    addressing: { parentCidr: null, allocationStatus: "notAllocated", lastAllocatedAt: null },
    simulationSetup: { flows: [], failureScenarios: [] },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const designB: Design = {
    ...designA,
    id: "dB" as DesignId,
    name: "Option B",
    isBaseline: false,
  };

  const devA1: Device = {
    id: "dev-A1" as DeviceId,
    designId: designA.id,
    catalogItemId: "cat-sw" as CatalogItemId,
    type: "switch",
    name: "SW 1",
    hostname: null,
    position: makeGeoPoint(77.595, 12.972),
    overrides: {},
    notes: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const devA2: Device = {
    id: "dev-A2" as DeviceId,
    designId: designA.id,
    catalogItemId: "cat-rt" as CatalogItemId,
    type: "router",
    name: "RT 1",
    hostname: null,
    position: makeGeoPoint(77.596, 12.972),
    overrides: {},
    notes: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  // Design B: remapped IDs for devA1, devA2, plus a new switch at a new position
  const devB1: Device = {
    ...devA1,
    id: "dev-B1" as DeviceId,
    designId: designB.id,
  };

  const devB2: Device = {
    ...devA2,
    id: "dev-B2" as DeviceId,
    designId: designB.id,
  };

  const devB3: Device = {
    id: "dev-B3" as DeviceId,
    designId: designB.id,
    catalogItemId: "cat-sw" as CatalogItemId,
    type: "switch",
    name: "SW 2",
    hostname: null,
    position: makeGeoPoint(77.597, 12.973), // extra switch
    overrides: {},
    notes: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const linkA: Link = {
    id: "link-A1" as LinkId,
    designId: designA.id,
    sourceDeviceId: devA1.id,
    targetDeviceId: devA2.id,
    medium: "copper",
    installationMethod: null,
    geometry: { type: "LineString", coordinates: [devA1.position.coordinates, devA2.position.coordinates] },
    capacityMbps: 1000,
    routingWeight: 1,
    lengthOverrideM: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const linkB: Link = {
    id: "link-B1" as LinkId,
    designId: designB.id,
    sourceDeviceId: devB1.id,
    targetDeviceId: devB2.id,
    medium: "copper",
    installationMethod: null,
    geometry: { type: "LineString", coordinates: [devB1.position.coordinates, devB2.position.coordinates] },
    capacityMbps: 1000,
    routingWeight: 1,
    lengthOverrideM: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const aggA: DesignAggregate = {
    project,
    region,
    design: designA,
    devicesById: { [devA1.id]: devA1, [devA2.id]: devA2 },
    linksById: { [linkA.id]: linkA },
    subnetsById: {},
    obstaclesById: {},
    catalogById: {},
  };

  const aggB: DesignAggregate = {
    project,
    region,
    design: designB,
    devicesById: { [devB1.id]: devB1, [devB2.id]: devB2, [devB3.id]: devB3 },
    linksById: { [linkB.id]: linkB },
    subnetsById: {},
    obstaclesById: {},
    catalogById: {},
  };

  it("computes structural diff by content rather than entity IDs", () => {
    const diff = computeStructuralDiff(aggA, aggB);
    expect(diff.deviceCountA).toBe(2);
    expect(diff.deviceCountB).toBe(3);
    expect(diff.linkCountA).toBe(1);
    expect(diff.linkCountB).toBe(1);

    // devA1 and devB1 match by catalogItemId + position
    const matchingGroup = diff.devices.find((g) => g.position.coordinates[0] === devA1.position.coordinates[0]);
    expect(matchingGroup).toBeDefined();
    expect(matchingGroup?.countA).toBe(1);
    expect(matchingGroup?.countB).toBe(1);
    expect(matchingGroup?.deltaBMinusA).toBe(0);

    // devB3 is added in B
    const newGroup = diff.devices.find((g) => g.position.coordinates[0] === devB3.position.coordinates[0]);
    expect(newGroup?.countA).toBe(0);
    expect(newGroup?.countB).toBe(1);
    expect(newGroup?.deltaBMinusA).toBe(1);

    // linkA and linkB match by medium and endpoint signatures
    expect(diff.links).toHaveLength(1);
    expect(diff.links[0]?.countA).toBe(1);
    expect(diff.links[0]?.countB).toBe(1);
    expect(diff.links[0]?.deltaBMinusA).toBe(0);
  });

  it("evaluates metric comparisons with directional preferences", () => {
    // Cost: lower is better
    const costComp = compareMetric("cost", "Total Cost", "INR", 100000, 80000, "lowerIsBetter");
    expect(costComp.deltaBMinusA).toBe(-20000);
    expect(costComp.betterDesign).toBe("B"); // B is cheaper

    // Coverage: higher is better
    const covComp = compareMetric("coverage", "Coverage %", "%", 85, 70, "higherIsBetter");
    expect(covComp.deltaBMinusA).toBe(-15);
    expect(covComp.betterDesign).toBe("A"); // A has higher coverage

    // Tie
    const tieComp = compareMetric("devices", "Device Count", "count", 5, 5, "higherIsBetter");
    expect(tieComp.betterDesign).toBe("tie");
  });
});
