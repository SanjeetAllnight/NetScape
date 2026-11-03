/**
 * Pure deterministic Network Infrastructure Cost Estimation Engine.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §10.3, §19.4
 *
 * Implements:
 * - Direct CAPEX: hardware, cabling (with slack), terminations, civil work, labour, licences
 * - Markups: contingency, tax (or explicit tax exclusion)
 * - Annual OPEX: continuous energy, maintenance, support contracts, replacement reserves
 * - TCO: CAPEX + (annual OPEX * horizonYears)
 * - Strict completeness and null tracking (missing inputs yield partial buckets with null totals)
 */

import type { Money } from "@/contracts/primitives";
import type {
  CostEngineInput,
  CostEstimate,
  CostLineItem,
  CostCategory,
  CostCompleteness,
  CostIssue,
  CostBucket,
  CostEngine,
} from "@/contracts/engines";
import { roundToDecimals } from "@/kernel/rounding";

function money(amount: number): Money {
  return { amount: roundToDecimals(amount, 2), currency: "INR" };
}

export function estimateCost(input: CostEngineInput): CostEstimate {
  const lineItems: CostLineItem[] = [];
  const issues: CostIssue[] = [];
  const byCategory: Partial<Record<CostCategory, Money>> = {};

  let capexIsPartial = false;
  let opexIsPartial = false;

  let directCapexKnown = 0;
  const categoryKnownSums: Record<CostCategory, number> = {
    hardware: 0,
    cabling: 0,
    termination: 0,
    civilWork: 0,
    labour: 0,
    licence: 0,
    energy: 0,
    maintenance: 0,
    support: 0,
    replacementReserve: 0,
    contingency: 0,
    tax: 0,
  };

  const pricing = input.settings.pricing;

  // 1. Hardware (Devices)
  for (const dev of input.devices) {
    if (dev.unitPrice === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_DEVICE_PRICE",
        message: `Device ${dev.deviceId} is missing unit price`,
        sourceEntityId: dev.deviceId,
      });
      lineItems.push({
        id: `hw-${dev.deviceId}`,
        category: "hardware",
        label: `Device (${dev.type})`,
        quantity: 1,
        unit: "device",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: dev.deviceId,
        note: null,
      });
    } else {
      const amt = dev.unitPrice.amount;
      directCapexKnown += amt;
      categoryKnownSums.hardware += amt;
      lineItems.push({
        id: `hw-${dev.deviceId}`,
        category: "hardware",
        label: `Device (${dev.type})`,
        quantity: 1,
        unit: "device",
        unitPrice: dev.unitPrice,
        amount: dev.unitPrice,
        provenance: dev.priceProvenance ?? "sample",
        sourceEntityId: dev.deviceId,
        note: null,
      });
    }
  }

  // 2. Cabling (Wired links only)
  const slackMultiplier = 1 + input.settings.cableSlackPct / 100;
  let copperLinkCount = 0;
  let fiberLinkCount = 0;
  let totalWiredLengthM = 0;

  for (const link of input.links) {
    if (link.medium === "wireless") {
      continue;
    }

    totalWiredLengthM += link.lengthM;
    const purchasedLengthM = roundToDecimals(link.lengthM * slackMultiplier, 2);

    if (link.medium === "copper") {
      copperLinkCount++;
      const unitRate = pricing.copperPerM;
      if (unitRate === null) {
        capexIsPartial = true;
        issues.push({
          code: "MISSING_CABLE_PRICE",
          message: `Copper cable price per metre is missing for link ${link.linkId}`,
          sourceEntityId: link.linkId,
        });
        lineItems.push({
          id: `cable-${link.linkId}`,
          category: "cabling",
          label: `Copper Cable (${link.linkId})`,
          quantity: purchasedLengthM,
          unit: "m",
          unitPrice: null,
          amount: null,
          provenance: "missing",
          sourceEntityId: link.linkId,
          note: `Slack ${input.settings.cableSlackPct}% applied to ${link.lengthM}m`,
        });
      } else {
        const amt = roundToDecimals(purchasedLengthM * unitRate.amount, 2);
        directCapexKnown += amt;
        categoryKnownSums.cabling += amt;
        lineItems.push({
          id: `cable-${link.linkId}`,
          category: "cabling",
          label: `Copper Cable (${link.linkId})`,
          quantity: purchasedLengthM,
          unit: "m",
          unitPrice: unitRate,
          amount: money(amt),
          provenance: "projectAssumption",
          sourceEntityId: link.linkId,
          note: `Slack ${input.settings.cableSlackPct}% applied to ${link.lengthM}m`,
        });
      }
    } else if (link.medium === "fiber") {
      fiberLinkCount++;
      const unitRate = pricing.fiberPerM;
      if (unitRate === null) {
        capexIsPartial = true;
        issues.push({
          code: "MISSING_CABLE_PRICE",
          message: `Fiber cable price per metre is missing for link ${link.linkId}`,
          sourceEntityId: link.linkId,
        });
        lineItems.push({
          id: `cable-${link.linkId}`,
          category: "cabling",
          label: `Fiber Cable (${link.linkId})`,
          quantity: purchasedLengthM,
          unit: "m",
          unitPrice: null,
          amount: null,
          provenance: "missing",
          sourceEntityId: link.linkId,
          note: `Slack ${input.settings.cableSlackPct}% applied to ${link.lengthM}m`,
        });
      } else {
        const amt = roundToDecimals(purchasedLengthM * unitRate.amount, 2);
        directCapexKnown += amt;
        categoryKnownSums.cabling += amt;
        lineItems.push({
          id: `cable-${link.linkId}`,
          category: "cabling",
          label: `Fiber Cable (${link.linkId})`,
          quantity: purchasedLengthM,
          unit: "m",
          unitPrice: unitRate,
          amount: money(amt),
          provenance: "projectAssumption",
          sourceEntityId: link.linkId,
          note: `Slack ${input.settings.cableSlackPct}% applied to ${link.lengthM}m`,
        });
      }
    }
  }

  // 3. Terminations (2 ends per wired link)
  if (copperLinkCount > 0) {
    const qty = copperLinkCount * 2;
    const rate = pricing.copperTerminationPerEnd;
    if (rate === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_TERMINATION_RATE",
        message: "Copper termination rate per end is missing",
        sourceEntityId: null,
      });
      lineItems.push({
        id: "term-copper",
        category: "termination",
        label: "Copper Termination Ends",
        quantity: qty,
        unit: "termination",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: null,
        note: `${copperLinkCount} copper links × 2 ends`,
      });
    } else {
      const amt = roundToDecimals(qty * rate.amount, 2);
      directCapexKnown += amt;
      categoryKnownSums.termination += amt;
      lineItems.push({
        id: "term-copper",
        category: "termination",
        label: "Copper Termination Ends",
        quantity: qty,
        unit: "termination",
        unitPrice: rate,
        amount: money(amt),
        provenance: "projectAssumption",
        sourceEntityId: null,
        note: `${copperLinkCount} copper links × 2 ends`,
      });
    }
  }

  if (fiberLinkCount > 0) {
    const qty = fiberLinkCount * 2;
    const rate = pricing.fiberTerminationPerEnd;
    if (rate === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_TERMINATION_RATE",
        message: "Fiber termination rate per end is missing",
        sourceEntityId: null,
      });
      lineItems.push({
        id: "term-fiber",
        category: "termination",
        label: "Fiber Termination Ends",
        quantity: qty,
        unit: "termination",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: null,
        note: `${fiberLinkCount} fiber links × 2 ends`,
      });
    } else {
      const amt = roundToDecimals(qty * rate.amount, 2);
      directCapexKnown += amt;
      categoryKnownSums.termination += amt;
      lineItems.push({
        id: "term-fiber",
        category: "termination",
        label: "Fiber Termination Ends",
        quantity: qty,
        unit: "termination",
        unitPrice: rate,
        amount: money(amt),
        provenance: "projectAssumption",
        sourceEntityId: null,
        note: `${fiberLinkCount} fiber links × 2 ends`,
      });
    }
  }

  // 4. Civil Work (Wired links only)
  for (const link of input.links) {
    if (link.medium === "wireless") {
      continue;
    }

    if (link.installationMethod === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_INSTALLATION_METHOD",
        message: `Wired link ${link.linkId} has unclassified installation method`,
        sourceEntityId: link.linkId,
      });
      lineItems.push({
        id: `civil-${link.linkId}`,
        category: "civilWork",
        label: `Civil Work (${link.linkId})`,
        quantity: link.lengthM,
        unit: "m",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: link.linkId,
        note: "Unclassified installation method",
      });
    } else if (link.installationMethod === "underground") {
      const rate = pricing.trenchingPerM;
      if (rate === null) {
        capexIsPartial = true;
        issues.push({
          code: "MISSING_CIVIL_RATE",
          message: `Trenching rate per metre is missing for underground link ${link.linkId}`,
          sourceEntityId: link.linkId,
        });
        lineItems.push({
          id: `civil-${link.linkId}`,
          category: "civilWork",
          label: `Underground Trenching (${link.linkId})`,
          quantity: link.lengthM,
          unit: "m",
          unitPrice: null,
          amount: null,
          provenance: "missing",
          sourceEntityId: link.linkId,
          note: null,
        });
      } else {
        const amt = roundToDecimals(link.lengthM * rate.amount, 2);
        directCapexKnown += amt;
        categoryKnownSums.civilWork += amt;
        lineItems.push({
          id: `civil-${link.linkId}`,
          category: "civilWork",
          label: `Underground Trenching (${link.linkId})`,
          quantity: link.lengthM,
          unit: "m",
          unitPrice: rate,
          amount: money(amt),
          provenance: "projectAssumption",
          sourceEntityId: link.linkId,
          note: null,
        });
      }
    } else if (link.installationMethod === "aerial") {
      const rate = pricing.aerialMountingPerM;
      if (rate === null) {
        capexIsPartial = true;
        issues.push({
          code: "MISSING_CIVIL_RATE",
          message: `Aerial mounting rate per metre is missing for aerial link ${link.linkId}`,
          sourceEntityId: link.linkId,
        });
        lineItems.push({
          id: `civil-${link.linkId}`,
          category: "civilWork",
          label: `Aerial Mounting (${link.linkId})`,
          quantity: link.lengthM,
          unit: "m",
          unitPrice: null,
          amount: null,
          provenance: "missing",
          sourceEntityId: link.linkId,
          note: null,
        });
      } else {
        const amt = roundToDecimals(link.lengthM * rate.amount, 2);
        directCapexKnown += amt;
        categoryKnownSums.civilWork += amt;
        lineItems.push({
          id: `civil-${link.linkId}`,
          category: "civilWork",
          label: `Aerial Mounting (${link.linkId})`,
          quantity: link.lengthM,
          unit: "m",
          unitPrice: rate,
          amount: money(amt),
          provenance: "projectAssumption",
          sourceEntityId: link.linkId,
          note: null,
        });
      }
    }
    // indoor link has no civil work quantity
  }

  // 5. Installation Labour
  if (input.devices.length > 0) {
    const rate = pricing.installationLabourPerDevice;
    if (rate === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_LABOUR_RATE",
        message: "Device installation labour rate is missing",
        sourceEntityId: null,
      });
      lineItems.push({
        id: "labour-device",
        category: "labour",
        label: "Device Installation Labour",
        quantity: input.devices.length,
        unit: "device",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: null,
        note: null,
      });
    } else {
      const amt = roundToDecimals(input.devices.length * rate.amount, 2);
      directCapexKnown += amt;
      categoryKnownSums.labour += amt;
      lineItems.push({
        id: "labour-device",
        category: "labour",
        label: "Device Installation Labour",
        quantity: input.devices.length,
        unit: "device",
        unitPrice: rate,
        amount: money(amt),
        provenance: "projectAssumption",
        sourceEntityId: null,
        note: null,
      });
    }
  }

  if (totalWiredLengthM > 0) {
    const rate = pricing.installationLabourPerM;
    if (rate === null) {
      capexIsPartial = true;
      issues.push({
        code: "MISSING_LABOUR_RATE",
        message: "Cable installation labour rate per metre is missing",
        sourceEntityId: null,
      });
      lineItems.push({
        id: "labour-cable",
        category: "labour",
        label: "Cable Installation Labour",
        quantity: totalWiredLengthM,
        unit: "m",
        unitPrice: null,
        amount: null,
        provenance: "missing",
        sourceEntityId: null,
        note: null,
      });
    } else {
      const amt = roundToDecimals(totalWiredLengthM * rate.amount, 2);
      directCapexKnown += amt;
      categoryKnownSums.labour += amt;
      lineItems.push({
        id: "labour-cable",
        category: "labour",
        label: "Cable Installation Labour",
        quantity: totalWiredLengthM,
        unit: "m",
        unitPrice: rate,
        amount: money(amt),
        provenance: "projectAssumption",
        sourceEntityId: null,
        note: null,
      });
    }
  }

  // 6. Software Licences (one-time)
  const licAmount = pricing.softwareLicencesOneTime;
  if (licAmount === null) {
    capexIsPartial = true;
    issues.push({
      code: "MISSING_SOFTWARE_LICENCE_COST",
      message: "One-time software licence cost assumption is not configured",
      sourceEntityId: null,
    });
    lineItems.push({
      id: "licence-onetime",
      category: "licence",
      label: "Software Licences (One-time)",
      quantity: 1,
      unit: "item",
      unitPrice: null,
      amount: null,
      provenance: "missing",
      sourceEntityId: null,
      note: null,
    });
  } else {
    directCapexKnown += licAmount.amount;
    categoryKnownSums.licence += licAmount.amount;
    lineItems.push({
      id: "licence-onetime",
      category: "licence",
      label: "Software Licences (One-time)",
      quantity: 1,
      unit: "item",
      unitPrice: licAmount,
      amount: licAmount,
      provenance: "projectAssumption",
      sourceEntityId: null,
      note: null,
    });
  }

  // 7. Contingency
  const contingencyAmt = roundToDecimals(
    directCapexKnown * (input.settings.contingencyRatePct / 100),
    2
  );
  categoryKnownSums.contingency += contingencyAmt;
  lineItems.push({
    id: "markup-contingency",
    category: "contingency",
    label: `Contingency (${input.settings.contingencyRatePct}%)`,
    quantity: 1,
    unit: "item",
    unitPrice: money(contingencyAmt),
    amount: money(contingencyAmt),
    provenance: "projectAssumption",
    sourceEntityId: null,
    note: `${input.settings.contingencyRatePct}% of direct CAPEX subtotal`,
  });

  const capexBeforeTax = directCapexKnown + contingencyAmt;

  // 8. Tax
  let taxAmt = 0;
  if (input.settings.taxRatePct === null) {
    issues.push({
      code: "TAX_EXCLUDED",
      message: "Tax is excluded from this estimate (pre-tax estimate)",
      sourceEntityId: null,
    });
  } else {
    taxAmt = roundToDecimals(capexBeforeTax * (input.settings.taxRatePct / 100), 2);
    categoryKnownSums.tax += taxAmt;
    lineItems.push({
      id: "markup-tax",
      category: "tax",
      label: `Tax (${input.settings.taxRatePct}%)`,
      quantity: 1,
      unit: "item",
      unitPrice: money(taxAmt),
      amount: money(taxAmt),
      provenance: "projectAssumption",
      sourceEntityId: null,
      note: `${input.settings.taxRatePct}% applied to pre-tax CAPEX`,
    });
  }

  const capexTotal = capexBeforeTax + taxAmt;
  const capexCompleteness: CostCompleteness = capexIsPartial ? "partial" : "complete";
  const capexBucket: CostBucket = {
    knownSubtotal: money(capexTotal),
    total: capexIsPartial ? null : money(capexTotal),
    completeness: capexCompleteness,
  };

  // 9. Annual Energy
  let energyIsMissing = false;
  let totalWatts = 0;
  for (const dev of input.devices) {
    if (dev.powerW === null) {
      energyIsMissing = true;
      issues.push({
        code: "MISSING_POWER_SPEC",
        message: `Device ${dev.deviceId} is missing power draw specification`,
        sourceEntityId: dev.deviceId,
      });
    } else {
      totalWatts += dev.powerW;
    }
  }

  const tariff = input.settings.electricityTariffPerKwh;
  if (tariff === null) {
    energyIsMissing = true;
    issues.push({
      code: "MISSING_TARIFF",
      message: "Electricity tariff per kWh is missing",
      sourceEntityId: null,
    });
  }

  if (energyIsMissing) {
    opexIsPartial = true;
    lineItems.push({
      id: "opex-energy",
      category: "energy",
      label: "Annual Energy Consumption",
      quantity: 0,
      unit: "kWh",
      unitPrice: null,
      amount: null,
      provenance: "missing",
      sourceEntityId: null,
      note: null,
    });
  } else if (tariff !== null) {
    // 24 hours * 365 days = 8760 hours
    const annualKwh = roundToDecimals((totalWatts * 1.0 * 24 * 365) / 1000, 2);
    const energyAmt = roundToDecimals(annualKwh * tariff.amount, 2);
    categoryKnownSums.energy += energyAmt;
    lineItems.push({
      id: "opex-energy",
      category: "energy",
      label: "Annual Energy Consumption",
      quantity: annualKwh,
      unit: "kWh",
      unitPrice: tariff,
      amount: money(energyAmt),
      provenance: "projectAssumption",
      sourceEntityId: null,
      note: `${totalWatts}W continuous (100% duty) × 8,760 h/year`,
    });
  }

  // 10. Annual Maintenance (% of direct CAPEX subtotal)
  const maintenanceAmt = roundToDecimals(
    directCapexKnown * (input.settings.maintenanceRatePctPerYear / 100),
    2
  );
  categoryKnownSums.maintenance += maintenanceAmt;
  lineItems.push({
    id: "opex-maintenance",
    category: "maintenance",
    label: `Annual Maintenance (${input.settings.maintenanceRatePctPerYear}%)`,
    quantity: 1,
    unit: "year",
    unitPrice: money(maintenanceAmt),
    amount: money(maintenanceAmt),
    provenance: "projectAssumption",
    sourceEntityId: null,
    note: `${input.settings.maintenanceRatePctPerYear}% of direct CAPEX subtotal`,
  });

  // 11. Annual Support
  const supportAmt = input.settings.annualSupportCost;
  if (supportAmt === null) {
    opexIsPartial = true;
    issues.push({
      code: "SUPPORT_NOT_CONFIGURED",
      message: "Annual support contract cost is not configured",
      sourceEntityId: null,
    });
    lineItems.push({
      id: "opex-support",
      category: "support",
      label: "Annual Support Contracts",
      quantity: 1,
      unit: "year",
      unitPrice: null,
      amount: null,
      provenance: "missing",
      sourceEntityId: null,
      note: null,
    });
  } else {
    categoryKnownSums.support += supportAmt.amount;
    lineItems.push({
      id: "opex-support",
      category: "support",
      label: "Annual Support Contracts",
      quantity: 1,
      unit: "year",
      unitPrice: supportAmt,
      amount: supportAmt,
      provenance: "projectAssumption",
      sourceEntityId: null,
      note: null,
    });
  }

  // 12. Replacement Reserve / Year
  let replacementIsMissing = false;
  let annualReplacementSum = 0;
  for (const dev of input.devices) {
    if (dev.unitPrice === null) {
      replacementIsMissing = true;
    } else if (dev.lifespanYears === null || dev.lifespanYears <= 0) {
      replacementIsMissing = true;
      issues.push({
        code: "MISSING_LIFESPAN",
        message: `Device ${dev.deviceId} is missing expected lifespan`,
        sourceEntityId: dev.deviceId,
      });
    } else {
      annualReplacementSum += dev.unitPrice.amount / dev.lifespanYears;
    }
  }

  if (replacementIsMissing) {
    opexIsPartial = true;
    lineItems.push({
      id: "opex-replacement",
      category: "replacementReserve",
      label: "Annual Replacement Reserve",
      quantity: 1,
      unit: "year",
      unitPrice: null,
      amount: null,
      provenance: "missing",
      sourceEntityId: null,
      note: null,
    });
  } else {
    const roundedReplacement = roundToDecimals(annualReplacementSum, 2);
    categoryKnownSums.replacementReserve += roundedReplacement;
    lineItems.push({
      id: "opex-replacement",
      category: "replacementReserve",
      label: "Annual Replacement Reserve",
      quantity: 1,
      unit: "year",
      unitPrice: money(roundedReplacement),
      amount: money(roundedReplacement),
      provenance: "derived",
      sourceEntityId: null,
      note: "Straight-line replacement reserve across all devices",
    });
  }

  const annualOpexKnown = roundToDecimals(
    categoryKnownSums.energy +
      categoryKnownSums.maintenance +
      categoryKnownSums.support +
      categoryKnownSums.replacementReserve,
    2
  );
  const opexCompleteness: CostCompleteness = opexIsPartial ? "partial" : "complete";
  const opexBucket: CostBucket = {
    knownSubtotal: money(annualOpexKnown),
    total: opexIsPartial ? null : money(annualOpexKnown),
    completeness: opexCompleteness,
  };

  // 13. TCO = CAPEX + (Annual OPEX * horizonYears)
  const horizon = input.settings.tcoHorizonYears;
  const tcoKnown = roundToDecimals(capexTotal + annualOpexKnown * horizon, 2);
  const tcoIsPartial = capexIsPartial || opexIsPartial;
  const tcoBucket: CostBucket = {
    knownSubtotal: money(tcoKnown),
    total: tcoIsPartial ? null : money(tcoKnown),
    completeness: tcoIsPartial ? "partial" : "complete",
  };

  // Populate byCategory
  const allCategories: CostCategory[] = [
    "hardware",
    "cabling",
    "termination",
    "civilWork",
    "labour",
    "licence",
    "energy",
    "maintenance",
    "support",
    "replacementReserve",
    "contingency",
    "tax",
  ];

  for (const cat of allCategories) {
    const val = categoryKnownSums[cat];
    if (val > 0) {
      byCategory[cat] = money(val);
    }
  }

  const overallCompleteness: CostCompleteness =
    capexCompleteness === "complete" &&
    opexCompleteness === "complete" &&
    tcoBucket.completeness === "complete"
      ? "complete"
      : "partial";

  return {
    isEstimate: true,
    currency: "INR",
    completeness: overallCompleteness,
    capex: capexBucket,
    annualOpex: opexBucket,
    tco: tcoBucket,
    tcoHorizonYears: horizon,
    byCategory,
    lineItems,
    issues,
    assumptions: {
      settings: input.settings,
      devicePowerDutyRatio: 1,
    },
  };
}

export const defaultCostEngine: CostEngine = {
  estimate: estimateCost,
};
