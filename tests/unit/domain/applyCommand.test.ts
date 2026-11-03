import { describe, it, expect } from "vitest";
import { applyCommand } from "@/domain/commands/applyCommand";
import type {
  DesignAggregate,
  Project,
  MapRegion,
  Design,
  Device,
  Link,
  DeviceCatalogItem,
} from "@/contracts/domain";
import type {
  ProjectId,
  MapRegionId,
  DesignId,
  DeviceId,
  LinkId,
  SubnetId,
  CatalogItemId,
  IPv4Cidr,
  EpochMs,
  Longitude,
  Latitude,
} from "@/contracts/primitives";
import { DEFAULT_PROJECT_SETTINGS } from "@/contracts/constants";
import { createProjectFrame, makeGeoPoint } from "@/domain/geo/localFrame";

describe("Domain Command Reducer: applyCommand", () => {
  const origin = makeGeoPoint(77.5946, 12.9716);
  const project: Project = {
    id: "proj-1" as ProjectId,
    name: "Campus Network",
    description: "Phase 1 test project",
    regionId: "reg-1" as MapRegionId,
    settings: JSON.parse(JSON.stringify(DEFAULT_PROJECT_SETTINGS)),
    frame: createProjectFrame(origin),
    revision: 1,
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
    lastOpenedAt: 1000 as EpochMs,
  };

  const region: MapRegion = {
    id: "reg-1" as MapRegionId,
    projectId: "proj-1" as ProjectId,
    label: "Main Campus",
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

  const design: Design = {
    id: "des-1" as DesignId,
    projectId: "proj-1" as ProjectId,
    parentDesignId: null,
    name: "Baseline Design",
    notes: null,
    isBaseline: true,
    revision: 1,
    logicalLayout: {},
    addressing: {
      parentCidr: "192.168.0.0/16" as IPv4Cidr,
      allocationStatus: "notAllocated",
      lastAllocatedAt: null,
    },
    simulationSetup: {
      flows: [],
      failureScenarios: [],
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const routerCatalogItem: DeviceCatalogItem = {
    id: "cat-router-1" as CatalogItemId,
    type: "router",
    origin: "builtIn",
    builtInCatalogVersion: 1,
    label: "Core Edge Router 10G",
    brand: "Cisco",
    model: "ISR 4451",
    powerW: 150,
    lifespanYears: 7,
    unitPrice: { amount: 120000, currency: "INR" },
    priceProvenance: "sample",
    priceUpdatedAt: 1000 as EpochMs,
    specs: {
      type: "router",
      ports: { copperEthernet: 4, fiber: 2, wireless: 0 },
      capacityMbps: 2000,
      routingCapacityMbps: 2000,
      processingDelayMs: 0.5,
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const switchCatalogItem: DeviceCatalogItem = {
    id: "cat-switch-1" as CatalogItemId,
    type: "switch",
    origin: "builtIn",
    builtInCatalogVersion: 1,
    label: "24-Port Gigabit Switch",
    brand: "Cisco",
    model: "Catalyst 2960-X",
    powerW: 50,
    lifespanYears: 5,
    unitPrice: { amount: 35000, currency: "INR" },
    priceProvenance: "sample",
    priceUpdatedAt: 1000 as EpochMs,
    specs: {
      type: "switch",
      ports: { copperEthernet: 24, fiber: 0, wireless: 0 },
      capacityMbps: 52000,
      switchingCapacityMbps: 52000,
      processingDelayMs: 0.2,
    },
    createdAt: 1000 as EpochMs,
    updatedAt: 1000 as EpochMs,
  };

  const initialAggregate: DesignAggregate = {
    project,
    region,
    design,
    devicesById: {},
    linksById: {},
    subnetsById: {},
    obstaclesById: {},
    catalogById: {
      [routerCatalogItem.id]: routerCatalogItem,
      [switchCatalogItem.id]: switchCatalogItem,
    },
  };

  it("handles project/update: trims name, updates revision, and rejects empty names", () => {
    const validRes = applyCommand(initialAggregate, {
      command: { type: "project/update", patch: { name: "  New Campus Name  " } },
      stamp: { commandId: "cmd-1", committedAt: 2000 as EpochMs },
      generatedIds: {},
    });
    expect(validRes.ok).toBe(true);
    if (!validRes.ok) return;
    expect(validRes.nextAggregate.project.name).toBe("New Campus Name");
    expect(validRes.nextAggregate.project.revision).toBe(2);

    const emptyRes = applyCommand(initialAggregate, {
      command: { type: "project/update", patch: { name: "   " } },
      stamp: { commandId: "cmd-2", committedAt: 2000 as EpochMs },
      generatedIds: {},
    });
    expect(emptyRes.ok).toBe(false);
    if (emptyRes.ok) return;
    expect(emptyRes.issues[0]?.code).toBe("REQUIRED");
  });

  it("handles device/add: creates device, assigns logical layout, and produces boundary warnings when outside", () => {
    // Add router inside boundary
    const resInside = applyCommand(initialAggregate, {
      command: {
        type: "device/add",
        catalogItemId: routerCatalogItem.id,
        position: makeGeoPoint(77.595, 12.975),
        name: "Main Gateway",
      },
      stamp: { commandId: "cmd-3", committedAt: 2000 as EpochMs },
      generatedIds: { device: ["dev-gw" as DeviceId] },
    });
    expect(resInside.ok).toBe(true);
    if (!resInside.ok) return;
    const dev = resInside.nextAggregate.devicesById["dev-gw" as DeviceId];
    expect(dev).toBeDefined();
    expect(dev?.name).toBe("Main Gateway");
    expect(dev?.type).toBe("router");
    expect(resInside.nextAggregate.design.revision).toBe(2);
    expect(resInside.nextAggregate.design.logicalLayout["dev-gw" as DeviceId]).toBeDefined();
    expect(resInside.changeSet.validationIssues).toHaveLength(0); // Inside boundary, no warnings

    // Add device outside boundary -> succeeds with warning
    const resOutside = applyCommand(resInside.nextAggregate, {
      command: {
        type: "device/add",
        catalogItemId: switchCatalogItem.id,
        position: makeGeoPoint(77.620, 12.975), // Outside boundary
      },
      stamp: { commandId: "cmd-4", committedAt: 2500 as EpochMs },
      generatedIds: { device: ["dev-sw1" as DeviceId] },
    });
    expect(resOutside.ok).toBe(true);
    if (!resOutside.ok) return;
    expect(resOutside.changeSet.validationIssues).toHaveLength(1);
    expect(resOutside.changeSet.validationIssues[0]?.code).toBe("DEVICE_OUTSIDE_BOUNDARY");
  });

  it("handles device/move: updates position and incident link geometries", () => {
    // Scaffold 2 devices and 1 link
    const step1 = applyCommand(initialAggregate, {
      command: {
        type: "device/add",
        catalogItemId: routerCatalogItem.id,
        position: makeGeoPoint(77.595, 12.975),
      },
      stamp: { commandId: "cmd-a", committedAt: 2000 as EpochMs },
      generatedIds: { device: ["d1" as DeviceId] },
    });
    if (!step1.ok) throw new Error("step1 failed");

    const step2 = applyCommand(step1.nextAggregate, {
      command: {
        type: "device/add",
        catalogItemId: switchCatalogItem.id,
        position: makeGeoPoint(77.596, 12.975),
      },
      stamp: { commandId: "cmd-b", committedAt: 2100 as EpochMs },
      generatedIds: { device: ["d2" as DeviceId] },
    });
    if (!step2.ok) throw new Error("step2 failed");

    const step3 = applyCommand(step2.nextAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d2" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-c", committedAt: 2200 as EpochMs },
      generatedIds: { link: ["l1" as LinkId] },
    });
    expect(step3.ok).toBe(true);
    if (!step3.ok) throw new Error("step3 failed");

    // Move d1
    const moveRes = applyCommand(step3.nextAggregate, {
      command: {
        type: "device/move",
        deviceId: "d1" as DeviceId,
        position: makeGeoPoint(77.597, 12.976),
      },
      stamp: { commandId: "cmd-d", committedAt: 2300 as EpochMs },
      generatedIds: {},
    });
    expect(moveRes.ok).toBe(true);
    if (!moveRes.ok) return;
    const movedLink = moveRes.nextAggregate.linksById["l1" as LinkId];
    expect(movedLink).toBeDefined();
    expect(movedLink?.geometry.coordinates[0]).toEqual([77.597, 12.976]);
    expect(movedLink?.geometry.coordinates[1]).toEqual([77.596, 12.975]);
  });

  it("handles device/delete cascades: cleans links, subnets, and simulation references", () => {
    // Setup d1, d2, link, subnet attached to d1 and link
    const step1 = applyCommand(initialAggregate, {
      command: {
        type: "device/add",
        catalogItemId: routerCatalogItem.id,
        position: makeGeoPoint(77.595, 12.975),
      },
      stamp: { commandId: "cmd-a", committedAt: 2000 as EpochMs },
      generatedIds: { device: ["d1" as DeviceId] },
    });
    if (!step1.ok) throw new Error("step1 failed");

    const step2 = applyCommand(step1.nextAggregate, {
      command: {
        type: "device/add",
        catalogItemId: switchCatalogItem.id,
        position: makeGeoPoint(77.596, 12.975),
      },
      stamp: { commandId: "cmd-b", committedAt: 2100 as EpochMs },
      generatedIds: { device: ["d2" as DeviceId] },
    });
    if (!step2.ok) throw new Error("step2 failed");

    const step3 = applyCommand(step2.nextAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d2" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-c", committedAt: 2200 as EpochMs },
      generatedIds: { link: ["l1" as LinkId] },
    });
    if (!step3.ok) throw new Error("step3 failed");

    const step4 = applyCommand(step3.nextAggregate, {
      command: {
        type: "subnet/add",
        name: "Admin LAN",
        hostsRequired: 50,
        servedByDeviceId: "d1" as DeviceId,
        linkId: "l1" as LinkId,
      },
      stamp: { commandId: "cmd-d", committedAt: 2300 as EpochMs },
      generatedIds: { subnet: ["sub-1" as SubnetId] },
    });
    if (!step4.ok) throw new Error("step4 failed");

    // Delete d1
    const delRes = applyCommand(step4.nextAggregate, {
      command: {
        type: "device/delete",
        deviceId: "d1" as DeviceId,
      },
      stamp: { commandId: "cmd-e", committedAt: 2400 as EpochMs },
      generatedIds: {},
    });
    expect(delRes.ok).toBe(true);
    if (!delRes.ok) return;

    // d1 is deleted
    expect(delRes.nextAggregate.devicesById["d1" as DeviceId]).toBeUndefined();
    // incident link l1 is cascaded and deleted
    expect(delRes.nextAggregate.linksById["l1" as LinkId]).toBeUndefined();
    expect(delRes.changeSet.deleteLinkIds).toContain("l1");
    // subnet servedByDeviceId and linkId are cleared
    const sub = delRes.nextAggregate.subnetsById["sub-1" as SubnetId];
    expect(sub).toBeDefined();
    expect(sub?.servedByDeviceId).toBeNull();
    expect(sub?.linkId).toBeNull();
    // layout entry removed
    expect(delRes.nextAggregate.design.logicalLayout["d1" as DeviceId]).toBeUndefined();
  });

  it("rejects parallel links and self-links", () => {
    const step1 = applyCommand(initialAggregate, {
      command: {
        type: "device/add",
        catalogItemId: routerCatalogItem.id,
        position: makeGeoPoint(77.595, 12.975),
      },
      stamp: { commandId: "cmd-a", committedAt: 2000 as EpochMs },
      generatedIds: { device: ["d1" as DeviceId] },
    });
    if (!step1.ok) throw new Error("step1 failed");

    const step2 = applyCommand(step1.nextAggregate, {
      command: {
        type: "device/add",
        catalogItemId: switchCatalogItem.id,
        position: makeGeoPoint(77.596, 12.975),
      },
      stamp: { commandId: "cmd-b", committedAt: 2100 as EpochMs },
      generatedIds: { device: ["d2" as DeviceId] },
    });
    if (!step2.ok) throw new Error("step2 failed");

    // Self-link rejection
    const selfRes = applyCommand(step2.nextAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d1" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-c", committedAt: 2200 as EpochMs },
      generatedIds: { link: ["l1" as LinkId] },
    });
    expect(selfRes.ok).toBe(false);
    if (!selfRes.ok) {
      expect(selfRes.issues[0]?.code).toBe("LINK_SELF_CONNECTION");
    }

    // Add first link
    const linkRes1 = applyCommand(step2.nextAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d2" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-d", committedAt: 2300 as EpochMs },
      generatedIds: { link: ["l1" as LinkId] },
    });
    expect(linkRes1.ok).toBe(true);
    if (!linkRes1.ok) return;

    // Parallel link in opposite direction rejection
    const linkRes2 = applyCommand(linkRes1.nextAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d2" as DeviceId,
        targetDeviceId: "d1" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-e", committedAt: 2400 as EpochMs },
      generatedIds: { link: ["l2" as LinkId] },
    });
    expect(linkRes2.ok).toBe(false);
    if (!linkRes2.ok) {
      expect(linkRes2.issues[0]?.code).toBe("LINK_DUPLICATE");
    }
  });

  it("applies star topology template correctly", () => {
    // Create root and 3 members
    let agg = initialAggregate;
    const ids: DeviceId[] = ["root" as DeviceId, "m1" as DeviceId, "m2" as DeviceId, "m3" as DeviceId];
    for (let i = 0; i < ids.length; i++) {
      const devId = ids[i]!;
      const res = applyCommand(agg, {
        command: {
          type: "device/add",
          catalogItemId: switchCatalogItem.id,
          position: makeGeoPoint(77.595 + i * 0.001, 12.975),
        },
        stamp: { commandId: `cmd-dev-${i}`, committedAt: (2000 + i * 100) as EpochMs },
        generatedIds: { device: [devId] },
      });
      if (!res.ok) throw new Error("dev add failed");
      agg = res.nextAggregate;
    }

    const templateRes = applyCommand(agg, {
      command: {
        type: "template/apply",
        template: {
          kind: "star",
          rootDeviceId: "root" as DeviceId,
          memberDeviceIds: ["m1", "m2", "m3"] as DeviceId[],
          medium: "copper",
        },
      },
      stamp: { commandId: "cmd-star", committedAt: 3000 as EpochMs },
      generatedIds: { link: ["l-s1", "l-s2", "l-s3"] as LinkId[] },
    });

    expect(templateRes.ok).toBe(true);
    if (!templateRes.ok) return;
    expect(Object.keys(templateRes.nextAggregate.linksById)).toHaveLength(3);
    expect(templateRes.changeSet.upsertLinks).toHaveLength(3);
  });

  it("enforces DESIGN_LIMITS: maxDevices (500) and maxLinks (1000)", () => {
    // Test device limit
    const mockDevices: Record<DeviceId, Device> = {};
    for (let i = 0; i < 500; i++) {
      const id = `d-${i}` as DeviceId;
      mockDevices[id] = {
        id,
        designId: "des-1" as DesignId,
        catalogItemId: switchCatalogItem.id,
        type: "switch",
        name: `Switch ${i}`,
        hostname: null,
        position: origin,
        overrides: {},
        notes: null,
        createdAt: 1000 as EpochMs,
        updatedAt: 1000 as EpochMs,
      };
    }
    const maxedDevAggregate = {
      ...initialAggregate,
      devicesById: mockDevices,
    };
    const devRes = applyCommand(maxedDevAggregate, {
      command: {
        type: "device/add",
        catalogItemId: switchCatalogItem.id,
        position: origin,
      },
      stamp: { commandId: "cmd-dev-overflow", committedAt: 4000 as EpochMs },
      generatedIds: { device: ["d-500" as DeviceId] },
    });
    expect(devRes.ok).toBe(false);
    if (!devRes.ok) {
      expect(devRes.issues[0]?.code).toBe("DEVICE_LIMIT_EXCEEDED");
    }

    // Test link limit
    const mockLinks: Record<LinkId, Link> = {};
    for (let i = 0; i < 1000; i++) {
      const id = `l-${i}` as LinkId;
      mockLinks[id] = {
        id,
        designId: "des-1" as DesignId,
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d2" as DeviceId,
        medium: "copper",
        installationMethod: null,
        geometry: { type: "LineString", coordinates: [origin.coordinates, origin.coordinates] },
        capacityMbps: 1000,
        routingWeight: 1,
        lengthOverrideM: null,
        createdAt: 1000 as EpochMs,
        updatedAt: 1000 as EpochMs,
      };
    }
    const maxedLinkAggregate = {
      ...initialAggregate,
      devicesById: {
        d1: { id: "d1" as DeviceId, type: "switch", position: origin },
        d2: { id: "d2" as DeviceId, type: "switch", position: origin },
      },
      linksById: mockLinks,
    };
    const linkRes = applyCommand(maxedLinkAggregate, {
      command: {
        type: "link/add",
        sourceDeviceId: "d1" as DeviceId,
        targetDeviceId: "d2" as DeviceId,
        medium: "copper",
      },
      stamp: { commandId: "cmd-link-overflow", committedAt: 4100 as EpochMs },
      generatedIds: { link: ["l-1000" as LinkId] },
    });
    expect(linkRes.ok).toBe(false);
    if (!linkRes.ok) {
      expect(linkRes.issues[0]?.code).toBe("LINK_LIMIT_EXCEEDED");
    }
  });
});
