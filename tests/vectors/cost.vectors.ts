/**
 * Normative CAPEX, OPEX, and TCO test vectors.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §19.4
 */

import type { Money } from "@/contracts/primitives";
import type { CostVectorExpected } from "@/contracts/vectors";

export const COST_01_VECTOR = {
  id: "COST-01" as const,
  inputs: {
    deviceCount: 2,
    deviceUnitPrice: { amount: 1000, currency: "INR" as const },
    copperDerivedLengthM: 100,
    copperPricePerM: { amount: 10, currency: "INR" as const },
    cableSlackPct: 10,
    copperTerminationRate: { amount: 0, currency: "INR" as const },
    installationLabourPerDevice: { amount: 0, currency: "INR" as const },
    installationLabourPerM: { amount: 0, currency: "INR" as const },
    softwareLicenceAmount: { amount: 0, currency: "INR" as const },
    contingencyRatePct: 10,
    taxRatePct: 0,
    devicePowerW: 10,
    powerDutyRatio: 1,
    electricityTariffPerKwh: { amount: 8, currency: "INR" as const },
    maintenanceRatePct: 5,
    deviceLifespanYears: 5,
    annualSupportCost: { amount: 0, currency: "INR" as const },
    tcoHorizonYears: 5,
  },
  expected: {
    purchasedCopperLengthM: 110,
    copperCost: { amount: 1100, currency: "INR" } as Money,
    directCapexSubtotal: { amount: 3100, currency: "INR" } as Money,
    contingency: { amount: 310, currency: "INR" } as Money,
    capexBeforeTax: { amount: 3410, currency: "INR" } as Money,
    annualEnergyKwh: 175.2,
    annualEnergyCost: { amount: 1401.6, currency: "INR" } as Money,
    annualMaintenance: { amount: 155, currency: "INR" } as Money,
    annualReplacementReserve: { amount: 400, currency: "INR" } as Money,
    annualOpex: { amount: 1956.6, currency: "INR" } as Money,
    tco: { amount: 13193, currency: "INR" } as Money,
    toleranceMoney: 0.01,
  } satisfies CostVectorExpected,
};
