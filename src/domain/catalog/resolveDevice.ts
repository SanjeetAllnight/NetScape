/**
 * Pure device catalogue and specifications resolver.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §3.6
 *
 * Merges catalogue defaults with sparse device overrides and projects position
 * into project-local metric coordinates.
 */

import type {
  Device,
  DeviceCatalogItem,
  ProjectFrame,
  ResolvedDevice,
  DeviceSpecifications,
  AccessPointSpecs,
} from "@/contracts/domain";
import type { PriceProvenance } from "@/contracts/enums";
import { geoPointToLocal } from "@/domain/geo/localFrame";
import { NetScapeError } from "@/contracts/errors";

export function resolveDevice(
  device: Device,
  catalogItem: DeviceCatalogItem,
  projectFrame: ProjectFrame
): ResolvedDevice {
  if (device.type !== catalogItem.type) {
    throw new NetScapeError(
      "VALIDATION_FAILED",
      `Device type '${device.type}' does not match catalog item type '${catalogItem.type}' for device '${device.id}'`
    );
  }

  // Clone specifications from catalogue item
  const specs: DeviceSpecifications = JSON.parse(JSON.stringify(catalogItem.specs));

  // Apply sparse overrides
  const overrides = device.overrides;
  if (overrides) {
    if (overrides.ports) {
      specs.ports = {
        ...specs.ports,
        ...overrides.ports,
      };
    }

    if (overrides.processingDelayMs !== undefined) {
      specs.processingDelayMs = overrides.processingDelayMs;
    }

    if (device.type === "accessPoint" && overrides.radio && specs.type === "accessPoint") {
      const apSpecs = specs as AccessPointSpecs;
      apSpecs.radio = {
        ...apSpecs.radio,
        ...overrides.radio,
      };
    }
  }

  const powerW = overrides?.powerW !== undefined ? overrides.powerW : catalogItem.powerW;
  const lifespanYears = overrides?.lifespanYears !== undefined ? overrides.lifespanYears : catalogItem.lifespanYears;
  const unitPrice = overrides?.unitPrice !== undefined ? overrides.unitPrice : catalogItem.unitPrice;

  const priceProvenance: PriceProvenance | null =
    overrides?.unitPrice !== undefined
      ? "userEntered"
      : catalogItem.priceProvenance;

  const positionLocalM = geoPointToLocal(device.position, projectFrame);

  return {
    id: device.id,
    designId: device.designId,
    catalogItemId: catalogItem.id,
    type: device.type,
    name: device.name,
    positionLocalM,
    specs,
    powerW,
    lifespanYears,
    unitPrice,
    priceProvenance,
  };
}
