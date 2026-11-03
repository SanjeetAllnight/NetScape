/**
 * Pure, deterministic command reducer for NetScape design aggregates.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §7
 *
 * Implements all 18 canonical commands, validations, cascades, and revision increments.
 * Zero external I/O, clocks, random generators, or framework dependencies.
 */

import type {
  DeviceId,
  LinkId,
  SubnetId,
  ObstacleId,
  LogicalPoint,
} from "@/contracts/primitives";
import type {
  Project,
  ProjectSettings,
  MapRegion,
  Design,
  Device,
  Link,
  Subnet,
  Obstacle,
  DesignAggregate,
} from "@/contracts/domain";
import type {
  PreparedDesignCommand,
  DesignChangeSet,
  ApplyCommandResult,
  TopologyTemplateRequest,
} from "@/contracts/commands";
import type { ValidationIssue, ValidationIssueCode } from "@/contracts/errors";
import type { AnalysisType } from "@/contracts/enums";
import { DESIGN_LIMITS } from "@/contracts/constants";
import { isPointInBoundary, checkPlanningExtent } from "@/domain/geo/localFrame";

export function suggestLogicalPosition(
  deviceCount: number
): LogicalPoint {
  const col = deviceCount % 5;
  const row = Math.floor(deviceCount / 5);
  return {
    coordinateSpace: "logical",
    x: 100 + col * 180,
    y: 100 + row * 140,
  };
}

function errorIssue(
  code: ValidationIssueCode,
  message: string,
  path: string = "",
  entityType: ValidationIssue["entityType"] = "design",
  entityId: string | null = null,
  relatedEntityIds: string[] = []
): ValidationIssue {
  return {
    code,
    severity: "error",
    message,
    path,
    entityType,
    entityId,
    relatedEntityIds,
  };
}

function warningIssue(
  code: ValidationIssueCode,
  message: string,
  path: string = "",
  entityType: ValidationIssue["entityType"] = "design",
  entityId: string | null = null,
  relatedEntityIds: string[] = []
): ValidationIssue {
  return {
    code,
    severity: "warning",
    message,
    path,
    entityType,
    entityId,
    relatedEntityIds,
  };
}

export function applyCommand(
  aggregate: DesignAggregate,
  prepared: PreparedDesignCommand
): ApplyCommandResult {
  const { command, stamp, generatedIds } = prepared;
  const issues: ValidationIssue[] = [];

  // Working copy of aggregate collections
  const currentProject: Project = JSON.parse(JSON.stringify(aggregate.project));
  const currentRegion: MapRegion = JSON.parse(JSON.stringify(aggregate.region));
  const currentDesign: Design = JSON.parse(JSON.stringify(aggregate.design));
  const currentDevices: Record<DeviceId, Device> = JSON.parse(JSON.stringify(aggregate.devicesById));
  const currentLinks: Record<LinkId, Link> = JSON.parse(JSON.stringify(aggregate.linksById));
  const currentSubnets: Record<SubnetId, Subnet> = JSON.parse(JSON.stringify(aggregate.subnetsById));
  const currentObstacles: Record<ObstacleId, Obstacle> = JSON.parse(JSON.stringify(aggregate.obstaclesById));

  let projectUpdated = false;
  let regionUpdated = false;
  let designUpdated = false;

  const upsertDevices: Device[] = [];
  const deleteDeviceIds: DeviceId[] = [];
  const upsertLinks: Link[] = [];
  const deleteLinkIds: LinkId[] = [];
  const upsertSubnets: Subnet[] = [];
  const deleteSubnetIds: SubnetId[] = [];
  const upsertObstacles: Obstacle[] = [];
  const deleteObstacleIds: ObstacleId[] = [];
  const affectedAnalysisTypes: Set<AnalysisType> = new Set();

  switch (command.type) {
    case "project/update": {
      if (command.patch.name !== undefined) {
        const trimmed = command.patch.name.trim();
        if (trimmed.length === 0) {
          issues.push(errorIssue("REQUIRED", "Project name cannot be empty", "name", "project", currentProject.id));
        } else {
          currentProject.name = trimmed;
          projectUpdated = true;
        }
      }
      if (command.patch.description !== undefined) {
        currentProject.description = command.patch.description;
        projectUpdated = true;
      }
      break;
    }

    case "project/settingsUpdate": {
      const p = command.patch;
      if (p.cost) {
        const costPatch = p.cost as Partial<ProjectSettings["cost"]>;
        currentProject.settings.cost = {
          ...currentProject.settings.cost,
          ...costPatch,
          pricing: {
            ...currentProject.settings.cost.pricing,
            ...(costPatch.pricing || {}),
          },
        };
        affectedAnalysisTypes.add("cost");
      }
      if (p.coverage) {
        const covPatch = p.coverage as Partial<ProjectSettings["coverage"]>;
        currentProject.settings.coverage = {
          ...currentProject.settings.coverage,
          ...covPatch,
        };
        affectedAnalysisTypes.add("coverage");
      }
      if (p.simulation) {
        const simPatch = p.simulation as Partial<ProjectSettings["simulation"]>;
        currentProject.settings.simulation = {
          ...currentProject.settings.simulation,
          ...simPatch,
        };
        affectedAnalysisTypes.add("simulation");
      }
      projectUpdated = true;
      break;
    }

    case "region/update": {
      if (command.patch.label !== undefined) {
        currentRegion.label = command.patch.label;
        regionUpdated = true;
      }
      if (command.patch.center !== undefined) {
        const [lng, lat] = command.patch.center.coordinates;
        if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
          issues.push(errorIssue("OUT_OF_RANGE", "Region center coordinates out of range", "center", "region", currentRegion.id));
        } else {
          currentRegion.center = command.patch.center;
          regionUpdated = true;
        }
      }
      if (command.patch.bbox !== undefined) {
        currentRegion.bbox = command.patch.bbox;
        regionUpdated = true;
      }
      if (regionUpdated) {
        projectUpdated = true;
      }
      break;
    }

    case "region/setBoundary": {
      if (command.boundary !== null) {
        const rings = command.boundary.coordinates;
        if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 4) {
          issues.push(errorIssue("INVALID_GEOMETRY", "Boundary must have at least one ring with 4 coordinates", "boundary", "region", currentRegion.id));
        } else {
          const extent = checkPlanningExtent(command.boundary, currentProject.frame);
          if (!extent.ok) {
            issues.push(errorIssue("AREA_TOO_LARGE", `Boundary diagonal ${extent.diagonalM}m exceeds maximum allowed 20000m`, "boundary", "region", currentRegion.id));
          } else {
            currentRegion.boundary = command.boundary;
            regionUpdated = true;
            projectUpdated = true;
            affectedAnalysisTypes.add("coverage");
          }
        }
      } else {
        currentRegion.boundary = null;
        regionUpdated = true;
        projectUpdated = true;
        affectedAnalysisTypes.add("coverage");
      }
      break;
    }

    case "device/add": {
      const catItem = aggregate.catalogById[command.catalogItemId];
      if (!catItem) {
        issues.push(errorIssue("CATALOG_ITEM_MISSING", `Catalogue item '${command.catalogItemId}' not found`, "catalogItemId", "device"));
        break;
      }
      const existingCount = Object.keys(currentDevices).length;
      if (existingCount >= DESIGN_LIMITS.maxDevices) {
        issues.push(errorIssue("DEVICE_LIMIT_EXCEEDED", `Maximum device limit (${DESIGN_LIMITS.maxDevices}) reached`, "", "device"));
        break;
      }
      const deviceId = generatedIds.device?.[0];
      if (!deviceId) {
        issues.push(errorIssue("REQUIRED", "No generated device ID provided in command stamp", "deviceId", "device"));
        break;
      }

      // Check boundary warning
      if (currentRegion.boundary && !isPointInBoundary(command.position, currentRegion.boundary)) {
        issues.push(warningIssue("DEVICE_OUTSIDE_BOUNDARY", `Device positioned outside planning boundary`, "position", "device", deviceId));
      }

      const deviceName = command.name?.trim() || `${catItem.type} ${existingCount + 1}`;
      const newDevice: Device = {
        id: deviceId,
        designId: currentDesign.id,
        catalogItemId: catItem.id,
        type: catItem.type,
        name: deviceName,
        hostname: null,
        position: command.position,
        overrides: {},
        notes: null,
        createdAt: stamp.committedAt,
        updatedAt: stamp.committedAt,
      };

      currentDevices[deviceId] = newDevice;
      upsertDevices.push(newDevice);

      // Logical layout assignment
      const suggested = suggestLogicalPosition(existingCount);
      currentDesign.logicalLayout[deviceId] = suggested;

      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      if (newDevice.type === "accessPoint") {
        affectedAnalysisTypes.add("coverage");
      }
      break;
    }

    case "device/update": {
      const existing = currentDevices[command.deviceId];
      if (!existing) {
        issues.push(errorIssue("REQUIRED", `Device '${command.deviceId}' not found`, "deviceId", "device", command.deviceId));
        break;
      }
      if (command.patch.name !== undefined) {
        const trimmed = command.patch.name.trim();
        if (trimmed.length === 0) {
          issues.push(errorIssue("REQUIRED", "Device name cannot be empty", "name", "device", command.deviceId));
        } else {
          existing.name = trimmed;
        }
      }
      if (command.patch.hostname !== undefined) {
        existing.hostname = command.patch.hostname;
      }
      if (command.patch.notes !== undefined) {
        existing.notes = command.patch.notes;
      }
      if (command.patch.catalogItemId !== undefined) {
        const cat = aggregate.catalogById[command.patch.catalogItemId];
        if (!cat) {
          issues.push(errorIssue("CATALOG_ITEM_MISSING", `Catalogue item '${command.patch.catalogItemId}' not found`, "catalogItemId", "device", command.deviceId));
        } else if (cat.type !== existing.type) {
          issues.push(errorIssue("CATALOG_TYPE_MISMATCH", "Cannot change device catalogue item to a different device type", "catalogItemId", "device", command.deviceId));
        } else {
          existing.catalogItemId = cat.id;
        }
      }
      if (command.patch.overrides !== undefined) {
        existing.overrides = command.patch.overrides;
      }

      existing.updatedAt = stamp.committedAt;
      upsertDevices.push(existing);
      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      if (existing.type === "accessPoint") {
        affectedAnalysisTypes.add("coverage");
      }
      break;
    }

    case "device/move": {
      const dev = currentDevices[command.deviceId];
      if (!dev) {
        issues.push(errorIssue("REQUIRED", `Device '${command.deviceId}' not found`, "deviceId", "device", command.deviceId));
        break;
      }
      dev.position = command.position;
      dev.updatedAt = stamp.committedAt;
      upsertDevices.push(dev);

      if (currentRegion.boundary && !isPointInBoundary(command.position, currentRegion.boundary)) {
        issues.push(warningIssue("DEVICE_OUTSIDE_BOUNDARY", "Device moved outside planning boundary", "position", "device", dev.id));
      }

      // Update geometry of all incident links
      for (const link of Object.values(currentLinks)) {
        if (link.sourceDeviceId === dev.id || link.targetDeviceId === dev.id) {
          const s = currentDevices[link.sourceDeviceId];
          const t = currentDevices[link.targetDeviceId];
          if (s && t) {
            link.geometry = {
              type: "LineString",
              coordinates: [s.position.coordinates, t.position.coordinates],
            };
            link.updatedAt = stamp.committedAt;
            upsertLinks.push(link);
          }
        }
      }

      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      if (dev.type === "accessPoint") {
        affectedAnalysisTypes.add("coverage");
      }
      break;
    }

    case "device/delete": {
      const devId = command.deviceId;
      if (!currentDevices[devId]) {
        issues.push(errorIssue("REQUIRED", `Device '${devId}' not found`, "deviceId", "device", devId));
        break;
      }

      delete currentDevices[devId];
      deleteDeviceIds.push(devId);
      delete currentDesign.logicalLayout[devId];

      // Cascade: delete incident links
      for (const [linkId, link] of Object.entries(currentLinks)) {
        if (link.sourceDeviceId === devId || link.targetDeviceId === devId) {
          delete currentLinks[linkId as LinkId];
          deleteLinkIds.push(linkId as LinkId);
        }
      }

      // Cascade: clear subnet references
      for (const sub of Object.values(currentSubnets)) {
        let changed = false;
        if (sub.servedByDeviceId === devId) {
          sub.servedByDeviceId = null;
          changed = true;
        }
        if (sub.linkId && deleteLinkIds.includes(sub.linkId)) {
          sub.linkId = null;
          changed = true;
        }
        if (changed) {
          sub.updatedAt = stamp.committedAt;
          upsertSubnets.push(sub);
        }
      }

      // Cascade: clean simulation setup
      currentDesign.simulationSetup.flows = currentDesign.simulationSetup.flows.filter(
        (f) => f.destinationDeviceId !== devId
      );
      for (const sc of currentDesign.simulationSetup.failureScenarios) {
        sc.failedDeviceIds = sc.failedDeviceIds.filter((id) => id !== devId);
        sc.failedLinkIds = sc.failedLinkIds.filter((id) => !deleteLinkIds.includes(id));
      }

      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      affectedAnalysisTypes.add("coverage");
      break;
    }

    case "link/add": {
      const existingLinkCount = Object.keys(currentLinks).length;
      if (existingLinkCount >= DESIGN_LIMITS.maxLinks) {
        issues.push(errorIssue("LINK_LIMIT_EXCEEDED", `Maximum link limit (${DESIGN_LIMITS.maxLinks}) reached`, "", "link"));
        break;
      }
      const s = currentDevices[command.sourceDeviceId];
      const t = currentDevices[command.targetDeviceId];
      if (!s || !t) {
        issues.push(errorIssue("LINK_ENDPOINT_MISSING", "Source or target device does not exist", "targetDeviceId", "link"));
        break;
      }
      if (command.sourceDeviceId === command.targetDeviceId) {
        issues.push(errorIssue("LINK_SELF_CONNECTION", "Self-links are forbidden", "targetDeviceId", "link", undefined, [s.id]));
        break;
      }
      // Check parallel link
      const isParallel = Object.values(currentLinks).some(
        (l) =>
          (l.sourceDeviceId === s.id && l.targetDeviceId === t.id) ||
          (l.sourceDeviceId === t.id && l.targetDeviceId === s.id)
      );
      if (isParallel) {
        issues.push(errorIssue("LINK_DUPLICATE", "Parallel links between same devices are forbidden", "link", "link", undefined, [s.id, t.id]));
        break;
      }

      const linkId = generatedIds.link?.[0];
      if (!linkId) {
        issues.push(errorIssue("REQUIRED", "No generated link ID provided in command stamp", "linkId", "link"));
        break;
      }

      const newLink: Link = {
        id: linkId,
        designId: currentDesign.id,
        sourceDeviceId: s.id,
        targetDeviceId: t.id,
        medium: command.medium,
        installationMethod: command.installationMethod ?? null,
        geometry: {
          type: "LineString",
          coordinates: [s.position.coordinates, t.position.coordinates],
        },
        capacityMbps: command.capacityMbps ?? null,
        routingWeight: command.routingWeight ?? 1,
        lengthOverrideM: null,
        createdAt: stamp.committedAt,
        updatedAt: stamp.committedAt,
      };

      currentLinks[linkId] = newLink;
      upsertLinks.push(newLink);
      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "link/update": {
      const link = currentLinks[command.linkId];
      if (!link) {
        issues.push(errorIssue("REQUIRED", `Link '${command.linkId}' not found`, "linkId", "link", command.linkId));
        break;
      }
      if (command.patch.medium !== undefined) link.medium = command.patch.medium;
      if (command.patch.installationMethod !== undefined) link.installationMethod = command.patch.installationMethod;
      if (command.patch.capacityMbps !== undefined) link.capacityMbps = command.patch.capacityMbps;
      if (command.patch.routingWeight !== undefined) {
        if (command.patch.routingWeight <= 0) {
          issues.push(errorIssue("OUT_OF_RANGE", "Routing weight must be positive", "routingWeight", "link", link.id));
        } else {
          link.routingWeight = command.patch.routingWeight;
        }
      }
      if (command.patch.lengthOverrideM !== undefined) link.lengthOverrideM = command.patch.lengthOverrideM;

      link.updatedAt = stamp.committedAt;
      upsertLinks.push(link);
      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "link/delete": {
      const linkId = command.linkId;
      if (!currentLinks[linkId]) {
        issues.push(errorIssue("REQUIRED", `Link '${linkId}' not found`, "linkId", "link", linkId));
        break;
      }
      delete currentLinks[linkId];
      deleteLinkIds.push(linkId);

      // Cascade: clear subnets
      for (const sub of Object.values(currentSubnets)) {
        if (sub.linkId === linkId) {
          sub.linkId = null;
          sub.updatedAt = stamp.committedAt;
          upsertSubnets.push(sub);
        }
      }

      // Cascade: clean simulation scenarios
      for (const sc of currentDesign.simulationSetup.failureScenarios) {
        sc.failedLinkIds = sc.failedLinkIds.filter((id) => id !== linkId);
      }

      designUpdated = true;
      affectedAnalysisTypes.add("cost");
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "subnet/add": {
      const name = command.name.trim();
      if (name.length === 0) {
        issues.push(errorIssue("REQUIRED", "Subnet name cannot be empty", "name", "subnet"));
        break;
      }
      if (command.hostsRequired < 1 || command.hostsRequired > 65534) {
        issues.push(errorIssue("HOST_REQUIREMENT_INVALID", "Subnet hostsRequired must be between 1 and 65534", "hostsRequired", "subnet"));
        break;
      }
      if (command.servedByDeviceId && !currentDevices[command.servedByDeviceId]) {
        issues.push(errorIssue("SUBNET_REFERENCE_MISSING", `Serving device '${command.servedByDeviceId}' not found`, "servedByDeviceId", "subnet"));
        break;
      }
      if (command.linkId && !currentLinks[command.linkId]) {
        issues.push(errorIssue("SUBNET_REFERENCE_MISSING", `Associated link '${command.linkId}' not found`, "linkId", "subnet"));
        break;
      }

      const subnetId = generatedIds.subnet?.[0];
      if (!subnetId) {
        issues.push(errorIssue("REQUIRED", "No generated subnet ID provided", "subnetId", "subnet"));
        break;
      }

      const newSubnet: Subnet = {
        id: subnetId,
        designId: currentDesign.id,
        name,
        hostsRequired: command.hostsRequired,
        servedByDeviceId: command.servedByDeviceId ?? null,
        linkId: command.linkId ?? null,
        allocatedCidr: null,
        usableHostCapacity: null,
        wastedUsableHosts: null,
        allocationStatus: "notAllocated",
        createdAt: stamp.committedAt,
        updatedAt: stamp.committedAt,
      };

      currentSubnets[subnetId] = newSubnet;
      upsertSubnets.push(newSubnet);
      designUpdated = true;
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "subnet/update": {
      const sub = currentSubnets[command.subnetId];
      if (!sub) {
        issues.push(errorIssue("REQUIRED", `Subnet '${command.subnetId}' not found`, "subnetId", "subnet", command.subnetId));
        break;
      }
      if (command.patch.name !== undefined) {
        const trimmed = command.patch.name.trim();
        if (trimmed.length === 0) {
          issues.push(errorIssue("REQUIRED", "Subnet name cannot be empty", "name", "subnet", sub.id));
        } else {
          sub.name = trimmed;
        }
      }
      if (command.patch.hostsRequired !== undefined) {
        if (command.patch.hostsRequired < 1 || command.patch.hostsRequired > 65534) {
          issues.push(errorIssue("HOST_REQUIREMENT_INVALID", "Subnet hostsRequired must be between 1 and 65534", "hostsRequired", "subnet", sub.id));
        } else {
          sub.hostsRequired = command.patch.hostsRequired;
          sub.allocationStatus = "outOfDate";
        }
      }
      if (command.patch.servedByDeviceId !== undefined) {
        if (command.patch.servedByDeviceId && !currentDevices[command.patch.servedByDeviceId]) {
          issues.push(errorIssue("SUBNET_REFERENCE_MISSING", `Serving device '${command.patch.servedByDeviceId}' not found`, "servedByDeviceId", "subnet", sub.id));
        } else {
          sub.servedByDeviceId = command.patch.servedByDeviceId;
        }
      }
      if (command.patch.linkId !== undefined) {
        if (command.patch.linkId && !currentLinks[command.patch.linkId]) {
          issues.push(errorIssue("SUBNET_REFERENCE_MISSING", `Link '${command.patch.linkId}' not found`, "linkId", "subnet", sub.id));
        } else {
          sub.linkId = command.patch.linkId;
        }
      }

      sub.updatedAt = stamp.committedAt;
      upsertSubnets.push(sub);
      designUpdated = true;
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "subnet/delete": {
      const subId = command.subnetId;
      if (!currentSubnets[subId]) {
        issues.push(errorIssue("REQUIRED", `Subnet '${subId}' not found`, "subnetId", "subnet", subId));
        break;
      }
      delete currentSubnets[subId];
      deleteSubnetIds.push(subId);

      // Clean flows
      currentDesign.simulationSetup.flows = currentDesign.simulationSetup.flows.filter((f) => f.sourceSubnetId !== subId);

      designUpdated = true;
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "addressing/setParentCidr": {
      if (command.parentCidr !== null) {
        const match = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(command.parentCidr);
        if (!match || !match[2]) {
          issues.push(errorIssue("INVALID_CIDR", "Parent CIDR must be a valid IPv4 CIDR string", "parentCidr", "design", currentDesign.id));
        } else {
          const prefix = parseInt(match[2], 10);
          if (prefix < 8 || prefix > 30) {
            issues.push(errorIssue("INVALID_CIDR", "Parent CIDR prefix must be between /8 and /30", "parentCidr", "design", currentDesign.id));
          } else {
            currentDesign.addressing.parentCidr = command.parentCidr;
            currentDesign.addressing.allocationStatus = "notAllocated";
            currentDesign.addressing.lastAllocatedAt = null;
            for (const sub of Object.values(currentSubnets)) {
              sub.allocatedCidr = null;
              sub.usableHostCapacity = null;
              sub.wastedUsableHosts = null;
              sub.allocationStatus = "notAllocated";
              upsertSubnets.push(sub);
            }
            designUpdated = true;
          }
        }
      } else {
        currentDesign.addressing.parentCidr = null;
        currentDesign.addressing.allocationStatus = "notAllocated";
        currentDesign.addressing.lastAllocatedAt = null;
        for (const sub of Object.values(currentSubnets)) {
          sub.allocatedCidr = null;
          sub.allocationStatus = "notAllocated";
          upsertSubnets.push(sub);
        }
        designUpdated = true;
      }
      break;
    }

    case "addressing/applyAllocation": {
      if (command.parentCidr !== currentDesign.addressing.parentCidr) {
        issues.push(errorIssue("INVALID_CIDR", "Allocation parent CIDR does not match design parent CIDR", "parentCidr", "design", currentDesign.id));
        break;
      }
      for (const alloc of command.allocations) {
        const sub = currentSubnets[alloc.subnetId];
        if (!sub) {
          issues.push(errorIssue("SUBNET_REFERENCE_MISSING", `Allocated subnet '${alloc.subnetId}' does not exist in design`, "allocations", "subnet", alloc.subnetId));
        } else {
          sub.allocatedCidr = alloc.cidr;
          sub.usableHostCapacity = alloc.usableHostCapacity;
          sub.wastedUsableHosts = alloc.wastedUsableHosts;
          sub.allocationStatus = "current";
          sub.updatedAt = stamp.committedAt;
          upsertSubnets.push(sub);
        }
      }
      currentDesign.addressing.allocationStatus = "current";
      currentDesign.addressing.lastAllocatedAt = command.allocatedAt;
      designUpdated = true;
      break;
    }

    case "obstacle/add": {
      const obstacleId = generatedIds.obstacle?.[0];
      if (!obstacleId) {
        issues.push(errorIssue("REQUIRED", "No generated obstacle ID provided", "obstacleId", "obstacle"));
        break;
      }
      const rings = command.geometry.coordinates;
      if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 4) {
        issues.push(errorIssue("INVALID_GEOMETRY", "Obstacle polygon must be closed and have at least 4 coordinates", "geometry", "obstacle", obstacleId));
        break;
      }
      const newObs: Obstacle = {
        id: obstacleId,
        projectId: currentProject.id,
        label: command.label ?? "Obstacle",
        geometry: command.geometry,
        material: command.material,
        lossDbPerCrossing: command.lossDbPerCrossing ?? 10,
        source: "manual",
        createdAt: stamp.committedAt,
        updatedAt: stamp.committedAt,
      };
      currentObstacles[obstacleId] = newObs;
      upsertObstacles.push(newObs);
      projectUpdated = true;
      affectedAnalysisTypes.add("coverage");
      break;
    }

    case "obstacle/update": {
      const obs = currentObstacles[command.obstacleId];
      if (!obs) {
        issues.push(errorIssue("REQUIRED", `Obstacle '${command.obstacleId}' not found`, "obstacleId", "obstacle", command.obstacleId));
        break;
      }
      if (command.patch.label !== undefined) obs.label = command.patch.label;
      if (command.patch.geometry !== undefined) {
        const rings = command.patch.geometry.coordinates;
        if (!rings || rings.length === 0 || !rings[0] || rings[0].length < 4) {
          issues.push(errorIssue("INVALID_GEOMETRY", "Obstacle polygon must be closed and have at least 4 coordinates", "geometry", "obstacle", obs.id));
        } else {
          obs.geometry = command.patch.geometry;
        }
      }
      if (command.patch.material !== undefined) obs.material = command.patch.material;
      if (command.patch.lossDbPerCrossing !== undefined) obs.lossDbPerCrossing = command.patch.lossDbPerCrossing;

      obs.updatedAt = stamp.committedAt;
      upsertObstacles.push(obs);
      projectUpdated = true;
      affectedAnalysisTypes.add("coverage");
      break;
    }

    case "obstacle/delete": {
      const obsId = command.obstacleId;
      if (!currentObstacles[obsId]) {
        issues.push(errorIssue("REQUIRED", `Obstacle '${obsId}' not found`, "obstacleId", "obstacle", obsId));
        break;
      }
      delete currentObstacles[obsId];
      deleteObstacleIds.push(obsId);
      projectUpdated = true;
      affectedAnalysisTypes.add("coverage");
      break;
    }

    case "layout/set": {
      for (const [devId, pt] of Object.entries(command.positions)) {
        if (!currentDevices[devId as DeviceId]) {
          issues.push(errorIssue("REQUIRED", `Layout target device '${devId}' not found`, "positions", "device", devId));
        } else if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
          issues.push(errorIssue("INVALID_FORMAT", `Layout coordinates for '${devId}' must be finite numbers`, "positions", "device", devId));
        } else {
          currentDesign.logicalLayout[devId as DeviceId] = {
            coordinateSpace: "logical",
            x: pt.x,
            y: pt.y,
          };
        }
      }
      designUpdated = true;
      break;
    }

    case "simulation/setup": {
      for (const flow of command.setup.flows) {
        if (!currentSubnets[flow.sourceSubnetId]) {
          issues.push(errorIssue("SIMULATION_FLOW_INVALID", `Flow source subnet '${flow.sourceSubnetId}' not found`, "flows", "simulation"));
        }
        const dest = currentDevices[flow.destinationDeviceId];
        if (!dest) {
          issues.push(errorIssue("SIMULATION_FLOW_INVALID", `Flow destination device '${flow.destinationDeviceId}' not found`, "flows", "simulation"));
        } else if (dest.type !== "server") {
          issues.push(errorIssue("SIMULATION_FLOW_INVALID", "Flow destination device must be of type 'server'", "flows", "simulation"));
        }
      }
      for (const sc of command.setup.failureScenarios) {
        for (const devId of sc.failedDeviceIds) {
          if (!currentDevices[devId]) {
            issues.push(errorIssue("SIMULATION_SCENARIO_INVALID", `Scenario failed device '${devId}' not found`, "failureScenarios", "simulation"));
          }
        }
        for (const linkId of sc.failedLinkIds) {
          if (!currentLinks[linkId]) {
            issues.push(errorIssue("SIMULATION_SCENARIO_INVALID", `Scenario failed link '${linkId}' not found`, "failureScenarios", "simulation"));
          }
        }
      }
      currentDesign.simulationSetup = JSON.parse(JSON.stringify(command.setup));
      designUpdated = true;
      affectedAnalysisTypes.add("simulation");
      break;
    }

    case "template/apply": {
      const template: TopologyTemplateRequest = command.template;
      if (template.kind === "star") {
        const root = currentDevices[template.rootDeviceId];
        if (!root) {
          issues.push(errorIssue("REQUIRED", `Star root device '${template.rootDeviceId}' not found`, "rootDeviceId", "device", template.rootDeviceId));
          break;
        }
        const linkIds = generatedIds.link || [];
        if (linkIds.length < template.memberDeviceIds.length) {
          issues.push(errorIssue("REQUIRED", "Not enough generated link IDs for star template", "link", "link"));
          break;
        }

        let linkIdx = 0;
        for (const memberId of template.memberDeviceIds) {
          const member = currentDevices[memberId];
          if (!member) {
            issues.push(errorIssue("REQUIRED", `Star member device '${memberId}' not found`, "memberDeviceIds", "device", memberId));
            continue;
          }
          if (memberId === root.id) continue;

          // Check if parallel
          const parallel = Object.values(currentLinks).some(
            (l) =>
              (l.sourceDeviceId === root.id && l.targetDeviceId === member.id) ||
              (l.sourceDeviceId === member.id && l.targetDeviceId === root.id)
          );
          if (parallel) continue;

          const lId = linkIds[linkIdx++];
          if (!lId) continue;
          const newLink: Link = {
            id: lId,
            designId: currentDesign.id,
            sourceDeviceId: root.id,
            targetDeviceId: member.id,
            medium: template.medium,
            installationMethod: null,
            geometry: {
              type: "LineString",
              coordinates: [root.position.coordinates, member.position.coordinates],
            },
            capacityMbps: null,
            routingWeight: 1,
            lengthOverrideM: null,
            createdAt: stamp.committedAt,
            updatedAt: stamp.committedAt,
          };
          currentLinks[lId] = newLink;
          upsertLinks.push(newLink);
        }
        designUpdated = true;
        affectedAnalysisTypes.add("cost");
        affectedAnalysisTypes.add("simulation");
      } else if (template.kind === "tree") {
        const root = currentDevices[template.rootDeviceId];
        if (!root) {
          issues.push(errorIssue("REQUIRED", `Tree root device '${template.rootDeviceId}' not found`, "rootDeviceId", "device", template.rootDeviceId));
          break;
        }
        const entries = Object.entries(template.parentByDeviceId);
        const linkIds = generatedIds.link || [];
        if (linkIds.length < entries.length) {
          issues.push(errorIssue("REQUIRED", "Not enough generated link IDs for tree template", "link", "link"));
          break;
        }
        let linkIdx = 0;
        for (const [childId, parentId] of entries) {
          const child = currentDevices[childId as DeviceId];
          const parent = currentDevices[parentId as DeviceId];
          if (!child || !parent) continue;
          if (child.id === parent.id) continue;

          const lId = linkIds[linkIdx++];
          if (!lId) continue;
          const newLink: Link = {
            id: lId,
            designId: currentDesign.id,
            sourceDeviceId: parent.id,
            targetDeviceId: child.id,
            medium: template.medium,
            installationMethod: null,
            geometry: {
              type: "LineString",
              coordinates: [parent.position.coordinates, child.position.coordinates],
            },
            capacityMbps: null,
            routingWeight: 1,
            lengthOverrideM: null,
            createdAt: stamp.committedAt,
            updatedAt: stamp.committedAt,
          };
          currentLinks[lId] = newLink;
          upsertLinks.push(newLink);
        }
        designUpdated = true;
        affectedAnalysisTypes.add("cost");
        affectedAnalysisTypes.add("simulation");
      }
      break;
    }
  }

  // If there are blocking validation errors, reject command
  const errorIssues = issues.filter((i) => i.severity === "error");
  if (errorIssues.length > 0) {
    return {
      ok: false,
      issues,
    };
  }

  // Increment revisions
  if (projectUpdated) {
    currentProject.revision += 1;
    currentProject.updatedAt = stamp.committedAt;
  }
  if (regionUpdated) {
    currentRegion.updatedAt = stamp.committedAt;
  }
  if (designUpdated) {
    currentDesign.revision += 1;
    currentDesign.updatedAt = stamp.committedAt;
  }

  const changeSet: DesignChangeSet = {
    project: projectUpdated ? currentProject : null,
    region: regionUpdated ? currentRegion : null,
    design: currentDesign,
    upsertDevices,
    deleteDeviceIds,
    upsertLinks,
    deleteLinkIds,
    upsertSubnets,
    deleteSubnetIds,
    upsertObstacles,
    deleteObstacleIds,
    affectedAnalysisTypes: Array.from(affectedAnalysisTypes),
    validationIssues: issues.filter((i) => i.severity === "warning"),
  };

  const nextAggregate: DesignAggregate = {
    project: currentProject,
    region: currentRegion,
    design: currentDesign,
    devicesById: currentDevices,
    linksById: currentLinks,
    subnetsById: currentSubnets,
    obstaclesById: currentObstacles,
    catalogById: aggregate.catalogById,
  };

  return {
    ok: true,
    changeSet,
    nextAggregate,
  };
}
