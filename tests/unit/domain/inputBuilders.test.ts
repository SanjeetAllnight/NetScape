import { describe, it, expect } from "vitest";
import {
  buildCostEngineInput,
  buildCoverageEngineInput,
  buildSimulationEngineInput,
  buildVlsmEngineInput,
} from "@/domain/inputBuilders";
import type {
  DesignAggregate,
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  DeviceCatalogItem,
  RouterSpecs,
} from "@/contracts/domain";
import type {
  ProjectId,
  MapRegionId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  CatalogItemId,
  EpochMs,
  Longitude,
  Latitude,
  IPv4Cidr,
  FlowId,
} from "@/contracts/primitives";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import { createProjectFrame, makeGeoPoint } from "@/domain/geo/localFrame";

describe("Domain Input Builders", () => {
  const origin = makeGeoPoint(77.5946, 12.9716);
  const project: Project = {
    id: "p1" as ProjectId,
    name: "Input Builder Project",
    description: null,
    regionId: "r1" as MapRegionId,
    settings: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
    frame: createProjectFrame(origin),
    revision: 1,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
    lastOpenedAt: 1000 as EpochMs,
  };

  const region: MapRegion = {
    id: "r1" as MapRegionId,
    projectId: "p1" as ProjectId,
    label: "Region 1",
    center: origin,
    bbox: null,
    boundary: {
      type: "Polygon",
      coordinates: [
        [
          [77.59 as Longitude, 12.97 as Latitude],
          [77.60 as Longitude, 12.97 as Latitude],
          [77.60 as Longitude, 12.98 as Latitude],
          [77.59 as Longitude, 12.98 as Latitude],
          [77.59 as Longitude, 12.97 as Latitude],
        ],
      ],
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const apCatalogItem: DeviceCatalogItem = {
    id: "cat-ap" as CatalogItemId,
    type: "accessPoint",
    origin: "builtIn",
    builtInCatalogVersion: 1,
    label: "WiFi 6 Access Point",
    brand: "Aruba",
    model: "AP-515",
    powerW: 20,
    lifespanYears: 5,
    unitPrice: { amount: 25000, currency: "INR" },
    priceProvenance: "sample",
    priceUpdatedAt: 1000 as EpochMs,
    specs: {
      type: "accessPoint",
      ports: { copperEthernet: 1, fiber: 0, wireless: 1 },
      capacityMbps: 1200,
      processingDelayMs: 1.0,
      radio: {
        txPowerDbm: 20,
        antennaGainDbi: 4,
      },
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const routerCatalogItem: DeviceCatalogItem = {
    id: "cat-rt" as CatalogItemId,
    type: "router",
    origin: "builtIn",
    builtInCatalogVersion: 1,
    label: "Router",
    brand: "Cisco",
    model: "4451",
    powerW: 100,
    lifespanYears: 7,
    unitPrice: { amount: 80000, currency: "INR" },
    priceProvenance: "sample",
    priceUpdatedAt: 1000 as EpochMs,
    specs: {
      type: "router",
      capacityMbps: 2000,
      routingCapacityMbps: 2000,
      processingDelayMs: 0.5,
      ports: { copperEthernet: 4, fiber: 0, wireless: 0 },
    } satisfies RouterSpecs,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const devAp: Device = {
    id: "dev-ap1" as DeviceId,
    designId: "d1" as DesignId,
    catalogItemId: apCatalogItem.id,
    type: "accessPoint",
    name: "AP North",
    hostname: null,
    position: makeGeoPoint(77.595, 12.972),
    overrides: {},
    notes: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const devRt: Device = {
    id: "dev-rt1" as DeviceId,
    designId: "d1" as DesignId,
    catalogItemId: routerCatalogItem.id,
    type: "router",
    name: "Router Core",
    hostname: null,
    position: makeGeoPoint(77.5946, 12.9716),
    overrides: {},
    notes: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const link: Link = {
    id: "link-1" as LinkId,
    designId: "d1" as DesignId,
    sourceDeviceId: devRt.id,
    targetDeviceId: devAp.id,
    medium: "copper",
    installationMethod: "indoor",
    geometry: {
      type: "LineString",
      coordinates: [devRt.position.coordinates, devAp.position.coordinates],
    },
    capacityMbps: 1000,
    routingWeight: 1,
    lengthOverrideM: null,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const subnet: Subnet = {
    id: "sub-1" as SubnetId,
    designId: "d1" as DesignId,
    name: "Staff WiFi",
    hostsRequired: 60,
    servedByDeviceId: devAp.id,
    linkId: link.id,
    allocatedCidr: null,
    usableHostCapacity: null,
    wastedUsableHosts: null,
    allocationStatus: "notAllocated",
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const obstacle: Obstacle = {
    id: "obs-1" as ObstacleId,
    projectId: "p1" as ProjectId,
    label: "Brick Wall",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [77.5948 as Longitude, 12.9718 as Latitude],
          [77.5949 as Longitude, 12.9718 as Latitude],
          [77.5949 as Longitude, 12.9719 as Latitude],
          [77.5948 as Longitude, 12.9719 as Latitude],
          [77.5948 as Longitude, 12.9718 as Latitude],
        ],
      ],
    },
    material: "brick",
    lossDbPerCrossing: 10,
    source: "manual",
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const design: Design = {
    id: "d1" as DesignId,
    projectId: "p1" as ProjectId,
    parentDesignId: null,
    name: "Design 1",
    notes: null,
    isBaseline: true,
    revision: 1,
    logicalLayout: {},
    addressing: {
      parentCidr: "10.0.0.0/16" as IPv4Cidr,
      allocationStatus: "notAllocated",
      lastAllocatedAt: null,
    },
    simulationSetup: {
      flows: [
        {
          id: "flow-1" as FlowId,
          name: "Flow 1",
          sourceSubnetId: subnet.id,
          destinationDeviceId: devRt.id,
          demandMbpsOverride: 50,
          enabled: true,
        },
      ],
      failureScenarios: [],
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const aggregate: DesignAggregate = {
    project,
    region,
    design,
    devicesById: { [devAp.id]: devAp, [devRt.id]: devRt },
    linksById: { [link.id]: link },
    subnetsById: { [subnet.id]: subnet },
    obstaclesById: { [obstacle.id]: obstacle },
    catalogById: {
      [apCatalogItem.id]: apCatalogItem,
      [routerCatalogItem.id]: routerCatalogItem,
    },
  };

  it("builds CostEngineInput with resolved devices, derived link lengths, and settings", () => {
    const costInput = buildCostEngineInput(aggregate);
    expect(costInput.currency).toBe("INR");
    expect(costInput.devices).toHaveLength(2);
    expect(costInput.links).toHaveLength(1);
    expect(costInput.links[0]?.lengthM).toBeGreaterThan(0);
    expect(costInput.devicePowerDutyRatio).toBe(1);
  });

  it("builds CoverageEngineInput with projected AP metric coordinates and obstacle polygons", () => {
    const covInput = buildCoverageEngineInput(aggregate);
    expect(covInput.designId).toBe("d1");
    expect(covInput.accessPoints).toHaveLength(1);
    expect(covInput.accessPoints[0]?.txPowerDbm).toBe(20);
    expect(covInput.accessPoints[0]?.antennaGainDbi).toBe(4);
    expect(covInput.obstacles).toHaveLength(1);
    expect(covInput.boundaryM).toHaveLength(1);
    expect(covInput.receiverAntennaGainDbi).toBe(0);
  });

  it("builds SimulationEngineInput with nodes, metric edge lengths, flows, and settings", () => {
    const simInput = buildSimulationEngineInput(aggregate);
    expect(simInput.nodes).toHaveLength(2);
    expect(simInput.edges).toHaveLength(1);
    expect(simInput.edges[0]?.lengthM).toBeGreaterThan(0);
    expect(simInput.flows).toHaveLength(1);
  });

  it("builds VlsmEngineInput with parent CIDR and subnets", () => {
    const vlsmInput = buildVlsmEngineInput(aggregate);
    expect(vlsmInput.parentCidr).toBe("10.0.0.0/16");
    expect(vlsmInput.subnets).toHaveLength(1);
    expect(vlsmInput.subnets[0]?.hostsRequired).toBe(60);
  });
});
