import { describe, it, expect } from "vitest";
import { estimateCost } from "@/engines/cost/costEngine";
import { COST_01_VECTOR } from "../../vectors/cost.vectors";
import type { CostEngineInput } from "@/contracts/engines";
import type { DeviceId, LinkId, Money } from "@/contracts/primitives";

describe("Cost Estimation Engine (P1-03)", () => {
  it("matches normative COST-01 vector values and completeness", () => {
    const input: CostEngineInput = {
      currency: "INR",
      devices: [
        {
          deviceId: "dev-1" as DeviceId,
          type: "router",
          unitPrice: COST_01_VECTOR.inputs.deviceUnitPrice,
          priceProvenance: "sample",
          powerW: COST_01_VECTOR.inputs.devicePowerW,
          lifespanYears: COST_01_VECTOR.inputs.deviceLifespanYears,
        },
        {
          deviceId: "dev-2" as DeviceId,
          type: "switch",
          unitPrice: COST_01_VECTOR.inputs.deviceUnitPrice,
          priceProvenance: "sample",
          powerW: COST_01_VECTOR.inputs.devicePowerW,
          lifespanYears: COST_01_VECTOR.inputs.deviceLifespanYears,
        },
      ],
      links: [
        {
          linkId: "link-1" as LinkId,
          medium: "copper",
          lengthM: COST_01_VECTOR.inputs.copperDerivedLengthM,
          installationMethod: "indoor",
        },
      ],
      settings: {
        currency: "INR",
        cableSlackPct: COST_01_VECTOR.inputs.cableSlackPct,
        tcoHorizonYears: COST_01_VECTOR.inputs.tcoHorizonYears,
        electricityTariffPerKwh: COST_01_VECTOR.inputs.electricityTariffPerKwh,
        maintenanceRatePctPerYear: COST_01_VECTOR.inputs.maintenanceRatePct,
        contingencyRatePct: COST_01_VECTOR.inputs.contingencyRatePct,
        taxRatePct: COST_01_VECTOR.inputs.taxRatePct,
        annualSupportCost: COST_01_VECTOR.inputs.annualSupportCost,
        pricing: {
          copperPerM: COST_01_VECTOR.inputs.copperPricePerM,
          fiberPerM: null,
          copperTerminationPerEnd: COST_01_VECTOR.inputs.copperTerminationRate,
          fiberTerminationPerEnd: null,
          trenchingPerM: null,
          aerialMountingPerM: null,
          installationLabourPerDevice: COST_01_VECTOR.inputs.installationLabourPerDevice,
          installationLabourPerM: COST_01_VECTOR.inputs.installationLabourPerM,
          softwareLicencesOneTime: COST_01_VECTOR.inputs.softwareLicenceAmount,
        },
      },
      devicePowerDutyRatio: 1,
    };

    const estimate = estimateCost(input);

    expect(estimate.completeness).toBe("complete");
    expect(estimate.currency).toBe("INR");

    // Copper cabling line
    const copperLine = estimate.lineItems.find((l) => l.category === "cabling");
    expect(copperLine).toBeDefined();
    expect(copperLine?.quantity).toBe(COST_01_VECTOR.expected.purchasedCopperLengthM);
    expect(copperLine?.amount?.amount).toBe(COST_01_VECTOR.expected.copperCost.amount);

    // Direct CAPEX
    const hwLine1 = estimate.lineItems.find((l) => l.id === "hw-dev-1");
    const hwLine2 = estimate.lineItems.find((l) => l.id === "hw-dev-2");
    expect(hwLine1?.amount?.amount).toBe(1000);
    expect(hwLine2?.amount?.amount).toBe(1000);

    // Contingency & CAPEX before tax
    const contingencyLine = estimate.lineItems.find((l) => l.category === "contingency");
    expect(contingencyLine?.amount?.amount).toBe(COST_01_VECTOR.expected.contingency.amount);
    expect(estimate.capex.total?.amount).toBe(COST_01_VECTOR.expected.capexBeforeTax.amount);

    // OPEX lines
    const energyLine = estimate.lineItems.find((l) => l.category === "energy");
    expect(energyLine?.quantity).toBe(COST_01_VECTOR.expected.annualEnergyKwh);
    expect(energyLine?.amount?.amount).toBe(COST_01_VECTOR.expected.annualEnergyCost.amount);

    const maintLine = estimate.lineItems.find((l) => l.category === "maintenance");
    expect(maintLine?.amount?.amount).toBe(COST_01_VECTOR.expected.annualMaintenance.amount);

    const reserveLine = estimate.lineItems.find((l) => l.category === "replacementReserve");
    expect(reserveLine?.amount?.amount).toBe(
      COST_01_VECTOR.expected.annualReplacementReserve.amount
    );

    expect(estimate.annualOpex.total?.amount).toBe(COST_01_VECTOR.expected.annualOpex.amount);
    expect(estimate.tco.total?.amount).toBe(COST_01_VECTOR.expected.tco.amount);
  });

  it("marks CAPEX as partial and sets total to null when required pricing is missing", () => {
    const input: CostEngineInput = {
      currency: "INR",
      devices: [
        {
          deviceId: "dev-noprice" as DeviceId,
          type: "router",
          unitPrice: null, // missing!
          priceProvenance: null,
          powerW: 20,
          lifespanYears: 5,
        },
      ],
      links: [],
      settings: {
        currency: "INR",
        cableSlackPct: 15,
        tcoHorizonYears: 5,
        electricityTariffPerKwh: { amount: 8, currency: "INR" },
        maintenanceRatePctPerYear: 5,
        contingencyRatePct: 10,
        taxRatePct: 0,
        annualSupportCost: { amount: 0, currency: "INR" },
        pricing: {
          copperPerM: { amount: 10, currency: "INR" },
          fiberPerM: null,
          copperTerminationPerEnd: { amount: 0, currency: "INR" },
          fiberTerminationPerEnd: null,
          trenchingPerM: null,
          aerialMountingPerM: null,
          installationLabourPerDevice: { amount: 0, currency: "INR" },
          installationLabourPerM: { amount: 0, currency: "INR" },
          softwareLicencesOneTime: { amount: 0, currency: "INR" },
        },
      },
      devicePowerDutyRatio: 1,
    };

    const estimate = estimateCost(input);
    expect(estimate.capex.completeness).toBe("partial");
    expect(estimate.capex.total).toBeNull();
    expect(estimate.tco.completeness).toBe("partial");
    expect(estimate.tco.total).toBeNull();
    expect(estimate.issues.some((i) => i.code === "MISSING_DEVICE_PRICE")).toBe(true);
  });

  it("handles pre-tax estimates (taxRatePct: null) without invalidating completeness", () => {
    const input: CostEngineInput = {
      currency: "INR",
      devices: [
        {
          deviceId: "dev-1" as DeviceId,
          type: "switch",
          unitPrice: { amount: 500, currency: "INR" } as Money,
          priceProvenance: "sample",
          powerW: 10,
          lifespanYears: 5,
        },
      ],
      links: [],
      settings: {
        currency: "INR",
        cableSlackPct: 15,
        tcoHorizonYears: 3,
        electricityTariffPerKwh: { amount: 8, currency: "INR" },
        maintenanceRatePctPerYear: 5,
        contingencyRatePct: 10,
        taxRatePct: null, // Pre-tax explicit exclusion!
        annualSupportCost: { amount: 0, currency: "INR" },
        pricing: {
          copperPerM: null,
          fiberPerM: null,
          copperTerminationPerEnd: null,
          fiberTerminationPerEnd: null,
          trenchingPerM: null,
          aerialMountingPerM: null,
          installationLabourPerDevice: { amount: 0, currency: "INR" },
          installationLabourPerM: null,
          softwareLicencesOneTime: { amount: 0, currency: "INR" },
        },
      },
      devicePowerDutyRatio: 1,
    };

    const estimate = estimateCost(input);
    expect(estimate.capex.completeness).toBe("complete");
    expect(estimate.capex.total).not.toBeNull();
    expect(estimate.issues.some((i) => i.code === "TAX_EXCLUDED")).toBe(true);
  });
});

