/**
 * Built-in catalogue seeding and version reconciliation.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §3.5, §9.2
 *
 * Upserts built-in items with stable IDs. Strictly preserves user custom items.
 */

import type { NetScapeDatabase } from "./database";
import { BUILTIN_CATALOG_SEED, BUILTIN_CATALOG_VERSION } from "@/contracts/constants";
import type { DeviceCatalogItem } from "@/contracts/domain";
import type { EpochMs } from "@/contracts/primitives";

export async function seedBuiltinCatalog(
  db: NetScapeDatabase,
  now: EpochMs = Date.now() as EpochMs
): Promise<void> {
  await db.transaction("rw", db.deviceCatalog, async () => {
    for (const seed of BUILTIN_CATALOG_SEED) {
      const existing = await db.deviceCatalog.get(seed.id);

      if (!existing) {
        const newItem: DeviceCatalogItem = {
          id: seed.id,
          type: seed.type,
          label: seed.label,
          brand: null,
          model: null,
          specs: seed.specs,
          powerW: seed.powerW,
          lifespanYears: seed.lifespanYears,
          unitPrice: seed.unitPrice,
          priceProvenance: seed.priceProvenance,
          priceUpdatedAt: now,
          origin: "builtIn",
          builtInCatalogVersion: BUILTIN_CATALOG_VERSION,
          createdAt: now,
          updatedAt: now,
        };
        await db.deviceCatalog.put(newItem);
      } else if (existing.origin === "builtIn") {
        // Update built-in definition if catalog version advanced or properties changed
        const updatedItem: DeviceCatalogItem = {
          ...existing,
          type: seed.type,
          label: seed.label,
          specs: seed.specs,
          powerW: seed.powerW,
          lifespanYears: seed.lifespanYears,
          unitPrice: seed.unitPrice,
          priceProvenance: seed.priceProvenance,
          builtInCatalogVersion: BUILTIN_CATALOG_VERSION,
          updatedAt: now,
        };
        await db.deviceCatalog.put(updatedItem);
      }
      // If existing.origin === "custom", do nothing: never overwrite custom items!
    }
  });
}
