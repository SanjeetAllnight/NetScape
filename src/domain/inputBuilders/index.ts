/**
 * Pure domain input builders for Cost, Coverage, Simulation, and IP/VLSM engines.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §10, §11, §12, §13
 *
 * Prepares fully resolved, metric, validated engine inputs. Engines never receive
 * unprojected WGS84 GeoPoints or unresolved catalogue references.
 */

import type { DesignAggregate, AccessPointSpecs } from "@/contracts/domain";
import type {
  CostEngineInput,
  CoverageEngineInput,
  CoverageAccessPointInput,
  CoverageObstacleInput,
  SimulationEngineInput,
  SimulationNodeInput,
  SimulationEdgeInput,
  VlsmEngineInput,
  VlsmSubnetRequirement,
} from "@/contracts/engines";
import { resolveDevice } from "@/domain/catalog/resolveDevice";
import { deriveLinkLengthM, geoPolygonToLocal } from "@/domain/geo/localFrame";
import { EngineInputError } from "@/contracts/errors";

export function buildCostEngineInput(aggregate: DesignAggregate): CostEngineInput {
  const devices = Object.values(aggregate.devicesById).map((device) => {
    const catalogItem = aggregate.catalogById[device.catalogItemId];
    if (!catalogItem) {
      throw new EngineInputError(
        `Catalog item '${device.catalogItemId}' not found for device '${device.id}'`
      );
    }
    const resolved = resolveDevice(device, catalogItem, aggregate.project.frame);
    return {
      deviceId: device.id,
      type: device.type,
      unitPrice: resolved.unitPrice,
      priceProvenance: resolved.priceProvenance,
      powerW: resolved.powerW,
      lifespanYears: resolved.lifespanYears,
    };
  });

  const links = Object.values(aggregate.linksById).map((link) => {
    const lengthM = deriveLinkLengthM(link, aggregate.devicesById, aggregate.project.frame);
    return {
      linkId: link.id,
      medium: link.medium,
      lengthM,
      installationMethod: link.installationMethod,
    };
  });

  return {
    currency: "INR",
    devices,
    links,
    settings: aggregate.project.settings.cost,
    devicePowerDutyRatio: 1,
  };
}

export function buildCoverageEngineInput(aggregate: DesignAggregate): CoverageEngineInput {
  const boundaryM = aggregate.region.boundary
    ? geoPolygonToLocal(aggregate.region.boundary, aggregate.project.frame)
    : [];

  const accessPoints: CoverageAccessPointInput[] = [];
  for (const device of Object.values(aggregate.devicesById)) {
    if (device.type === "accessPoint") {
      const catalogItem = aggregate.catalogById[device.catalogItemId];
      if (!catalogItem) continue;
      const resolved = resolveDevice(device, catalogItem, aggregate.project.frame);
      const apSpecs = resolved.specs as AccessPointSpecs;
      accessPoints.push({
        deviceId: device.id,
        positionM: resolved.positionLocalM,
        txPowerDbm: apSpecs.radio.txPowerDbm,
        antennaGainDbi: apSpecs.radio.antennaGainDbi,
      });
    }
  }

  const obstacles: CoverageObstacleInput[] = Object.values(aggregate.obstaclesById).map((obs) => ({
    obstacleId: obs.id,
    polygonM: geoPolygonToLocal(obs.geometry, aggregate.project.frame),
    lossDbPerCrossing: obs.lossDbPerCrossing,
  }));

  return {
    designId: aggregate.design.id,
    boundaryM,
    accessPoints,
    obstacles,
    settings: aggregate.project.settings.coverage,
    receiverAntennaGainDbi: 0,
  };
}

export function buildSimulationEngineInput(aggregate: DesignAggregate): SimulationEngineInput {
  const nodes: SimulationNodeInput[] = Object.values(aggregate.devicesById).map((device) => {
    const catalogItem = aggregate.catalogById[device.catalogItemId];
    let processingDelayMs: number | null = null;
    if (catalogItem) {
      const resolved = resolveDevice(device, catalogItem, aggregate.project.frame);
      processingDelayMs = resolved.specs.processingDelayMs ?? null;
    }
    return {
      deviceId: device.id,
      type: device.type,
      processingDelayMs,
    };
  });

  const edges: SimulationEdgeInput[] = Object.values(aggregate.linksById).map((link) => {
    const lengthM = deriveLinkLengthM(link, aggregate.devicesById, aggregate.project.frame);
    return {
      linkId: link.id,
      sourceDeviceId: link.sourceDeviceId,
      targetDeviceId: link.targetDeviceId,
      medium: link.medium,
      lengthM,
      capacityMbps: link.capacityMbps,
      routingWeight: link.routingWeight,
    };
  });

  const flows = aggregate.design.simulationSetup.flows.map((f) => {
    const sub = aggregate.subnetsById[f.sourceSubnetId];
    const sourceDevId = sub?.servedByDeviceId ?? f.destinationDeviceId;
    const demand =
      f.demandMbpsOverride ??
      aggregate.project.settings.simulation.perHostDemandMbps * (sub?.hostsRequired || 1);
    return {
      flowId: f.id,
      subnetId: f.sourceSubnetId,
      sourceDeviceId: sourceDevId,
      destinationDeviceId: f.destinationDeviceId,
      demandMbps: demand,
    };
  });

  const scenarios = aggregate.design.simulationSetup.failureScenarios.map((s) => ({
    scenarioId: s.id,
    name: s.name,
    failedDeviceIds: [...s.failedDeviceIds],
    failedLinkIds: [...s.failedLinkIds],
  }));

  return {
    nodes,
    edges,
    flows,
    scenarios,
    settings: aggregate.project.settings.simulation,
  };
}

export function buildVlsmEngineInput(aggregate: DesignAggregate): VlsmEngineInput {
  const parentCidr = aggregate.design.addressing.parentCidr;
  if (!parentCidr) {
    throw new EngineInputError(
      "Parent CIDR is not configured for design addressing"
    );
  }

  const subnets: VlsmSubnetRequirement[] = Object.values(aggregate.subnetsById).map((sub) => ({
    subnetId: sub.id,
    name: sub.name,
    hostsRequired: sub.hostsRequired,
  }));

  return {
    parentCidr,
    subnets,
  };
}
