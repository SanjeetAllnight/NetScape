/**
 * Committed Design Aggregate Zustand Store.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.3
 *
 * Holds the current committed DesignAggregate. Updated strictly after Dexie commit.
 */

import { create } from "zustand";
import type { DesignAggregate } from "@/contracts/domain";

export type SaveStatus = "saved" | "saving" | "error";

export interface DesignStoreState {
  aggregate: DesignAggregate | null;
  saveStatus: SaveStatus;
  errorMessage: string | null;

  setAggregate: (aggregate: DesignAggregate | null) => void;
  setSaveStatus: (status: SaveStatus, errorMessage?: string | null) => void;
  reset: () => void;
}

export const useDesignStore = create<DesignStoreState>((set) => ({
  aggregate: null,
  saveStatus: "saved",
  errorMessage: null,

  setAggregate: (aggregate) =>
    set({
      aggregate,
      saveStatus: "saved",
      errorMessage: null,
    }),

  setSaveStatus: (saveStatus, errorMessage = null) =>
    set({
      saveStatus,
      errorMessage,
    }),

  reset: () =>
    set({
      aggregate: null,
      saveStatus: "saved",
      errorMessage: null,
    }),
}));
