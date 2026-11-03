/**
 * Pure domain functions for structural diff and comparison between designs.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §18
 *
 * Devices and links are matched by semantic content (catalog item, type, position, medium),
 * NOT by internal entity IDs, ensuring correct diffs across duplicated designs.
 */

import type { DesignAggregate } from "@/contracts/domain";
import type {
  StructuralDesignDiff,
  StructuralDeviceGroup,
  StructuralLinkGroup,
  StructuralEndpointSignature,
  MetricComparison,
  ComparisonDirection,
} from "@/contracts/comparison";

function deviceGroupKey(catalogItemId: string, lng: number, lat: number): string {
  return `${catalogItemId}:${lng.toFixed(7)}:${lat.toFixed(7)}`;
}

function endpointSigKey(sig: StructuralEndpointSignature): string {
  return `${sig.catalogItemId}:${sig.type}:${sig.position.coordinates[0].toFixed(7)}:${sig.position.coordinates[1].toFixed(7)}`;
}

export function computeStructuralDiff(
  aggregateA: DesignAggregate,
  aggregateB: DesignAggregate
): StructuralDesignDiff {
  const devicesA = Object.values(aggregateA.devicesById);
  const devicesB = Object.values(aggregateB.devicesById);

  // Group devices by catalogItemId + geographic position
  const deviceGroupsMap = new Map<
    string,
    {
      group: Omit<StructuralDeviceGroup, "countA" | "countB" | "deltaBMinusA">;
      countA: number;
      countB: number;
    }
  >();

  for (const d of devicesA) {
    const [lng, lat] = d.position.coordinates;
    const key = deviceGroupKey(d.catalogItemId, lng, lat);
    const existing = deviceGroupsMap.get(key);
    if (existing) {
      existing.countA += 1;
    } else {
      deviceGroupsMap.set(key, {
        group: {
          catalogItemId: d.catalogItemId,
          type: d.type,
          position: d.position,
        },
        countA: 1,
        countB: 0,
      });
    }
  }

  for (const d of devicesB) {
    const [lng, lat] = d.position.coordinates;
    const key = deviceGroupKey(d.catalogItemId, lng, lat);
    const existing = deviceGroupsMap.get(key);
    if (existing) {
      existing.countB += 1;
    } else {
      deviceGroupsMap.set(key, {
        group: {
          catalogItemId: d.catalogItemId,
          type: d.type,
          position: d.position,
        },
        countA: 0,
        countB: 1,
      });
    }
  }

  const deviceGroups: StructuralDeviceGroup[] = Array.from(deviceGroupsMap.values()).map(
    ({ group, countA, countB }) => ({
      ...group,
      countA,
      countB,
      deltaBMinusA: countB - countA,
    })
  );

  // Group links by medium + canonical endpoint signatures
  const linkGroupsMap = new Map<
    string,
    {
      group: Omit<StructuralLinkGroup, "countA" | "countB" | "deltaBMinusA">;
      countA: number;
      countB: number;
    }
  >();

  function processLinks(
    aggregate: DesignAggregate,
    isDesignA: boolean
  ) {
    for (const l of Object.values(aggregate.linksById)) {
      const s = aggregate.devicesById[l.sourceDeviceId];
      const t = aggregate.devicesById[l.targetDeviceId];
      if (!s || !t) continue;

      const sig1: StructuralEndpointSignature = {
        catalogItemId: s.catalogItemId,
        type: s.type,
        position: s.position,
      };
      const sig2: StructuralEndpointSignature = {
        catalogItemId: t.catalogItemId,
        type: t.type,
        position: t.position,
      };

      const k1 = endpointSigKey(sig1);
      const k2 = endpointSigKey(sig2);

      // Canonical undirected ordering
      const [epA, epB] = k1 <= k2 ? [sig1, sig2] : [sig2, sig1];
      const linkKey = `${l.medium}:${l.installationMethod ?? "none"}:${endpointSigKey(epA)}<=>${endpointSigKey(epB)}`;

      const existing = linkGroupsMap.get(linkKey);
      if (existing) {
        if (isDesignA) existing.countA += 1;
        else existing.countB += 1;
      } else {
        linkGroupsMap.set(linkKey, {
          group: {
            medium: l.medium,
            installationMethod: l.installationMethod,
            endpointA: epA,
            endpointB: epB,
          },
          countA: isDesignA ? 1 : 0,
          countB: isDesignA ? 0 : 1,
        });
      }
    }
  }

  processLinks(aggregateA, true);
  processLinks(aggregateB, false);

  const linkGroups: StructuralLinkGroup[] = Array.from(linkGroupsMap.values()).map(
    ({ group, countA, countB }) => ({
      ...group,
      countA,
      countB,
      deltaBMinusA: countB - countA,
    })
  );

  return {
    devices: deviceGroups,
    links: linkGroups,
    deviceCountA: devicesA.length,
    deviceCountB: devicesB.length,
    linkCountA: Object.keys(aggregateA.linksById).length,
    linkCountB: Object.keys(aggregateB.linksById).length,
  };
}

export function compareMetric(
  key: string,
  label: string,
  unit: MetricComparison["unit"],
  valueA: number | null,
  valueB: number | null,
  direction: ComparisonDirection
): MetricComparison {
  let deltaBMinusA: number | null = null;
  let betterDesign: MetricComparison["betterDesign"] = "notComparable";

  if (valueA !== null && valueB !== null) {
    deltaBMinusA = valueB - valueA;
    if (deltaBMinusA === 0) {
      betterDesign = "tie";
    } else if (direction === "higherIsBetter") {
      betterDesign = deltaBMinusA > 0 ? "B" : "A";
    } else if (direction === "lowerIsBetter") {
      betterDesign = deltaBMinusA < 0 ? "B" : "A";
    } else {
      betterDesign = "notComparable";
    }
  }

  return {
    key,
    label,
    unit,
    valueA,
    valueB,
    deltaBMinusA,
    direction,
    betterDesign,
  };
}
