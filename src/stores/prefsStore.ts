/**
 * Application Preferences Zustand Store.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §9.3
 */

import { create } from "zustand";
import type { AppPreferences } from "@/contracts/storage";

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  autoRecalculateCoverage: false,
  distanceDisplayUnit: "m",
  areaDisplayUnit: "m2",
};

export interface PrefsStoreState {
  preferences: AppPreferences;
  setPreferences: (preferences: AppPreferences) => void;
  updatePreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

export const usePrefsStore = create<PrefsStoreState>((set) => ({
  preferences: { ...DEFAULT_APP_PREFERENCES },

  setPreferences: (preferences) => set({ preferences }),

  updatePreference: (key, value) =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        [key]: value,
      },
    })),
}));
