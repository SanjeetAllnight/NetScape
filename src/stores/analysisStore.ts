/**
 * Analysis Results & Status Zustand Store.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.3
 *
 * Ephemeral projection of cached analysis records and in-flight execution states.
 */

import { create } from "zustand";
import type { AnalysisType } from "@/contracts/enums";
import type { InputHash } from "@/contracts/primitives";
import type { AnalysisRecord } from "@/contracts/engines";

export type AnalysisStatus = "idle" | "computing" | "stale" | "fresh" | "error";

export interface AnalysisStoreState {
  records: Record<AnalysisType, AnalysisRecord | null>;
  hashes: Record<AnalysisType, InputHash | null>;
  status: Record<AnalysisType, AnalysisStatus>;
  progress: Record<AnalysisType, number>;
  errors: Record<AnalysisType, string | null>;

  setRecord: (type: AnalysisType, record: AnalysisRecord | null, hash: InputHash | null) => void;
  setStatus: (type: AnalysisType, status: AnalysisStatus) => void;
  setProgress: (type: AnalysisType, progress: number) => void;
  setError: (type: AnalysisType, error: string | null) => void;
  markStale: (type: AnalysisType) => void;
  resetAnalyses: () => void;
}

const INITIAL_RECORDS: Record<AnalysisType, AnalysisRecord | null> = {
  cost: null,
  coverage: null,
  simulation: null,
};

const INITIAL_HASHES: Record<AnalysisType, InputHash | null> = {
  cost: null,
  coverage: null,
  simulation: null,
};

const INITIAL_STATUS: Record<AnalysisType, AnalysisStatus> = {
  cost: "idle",
  coverage: "idle",
  simulation: "idle",
};

const INITIAL_PROGRESS: Record<AnalysisType, number> = {
  cost: 0,
  coverage: 0,
  simulation: 0,
};

const INITIAL_ERRORS: Record<AnalysisType, string | null> = {
  cost: null,
  coverage: null,
  simulation: null,
};

export const useAnalysisStore = create<AnalysisStoreState>((set) => ({
  records: { ...INITIAL_RECORDS },
  hashes: { ...INITIAL_HASHES },
  status: { ...INITIAL_STATUS },
  progress: { ...INITIAL_PROGRESS },
  errors: { ...INITIAL_ERRORS },

  setRecord: (type, record, hash) =>
    set((state) => ({
      records: { ...state.records, [type]: record },
      hashes: { ...state.hashes, [type]: hash },
      status: { ...state.status, [type]: record ? "fresh" : "idle" },
      errors: { ...state.errors, [type]: null },
      progress: { ...state.progress, [type]: 1 },
    })),

  setStatus: (type, status) =>
    set((state) => ({
      status: { ...state.status, [type]: status },
    })),

  setProgress: (type, progress) =>
    set((state) => ({
      progress: { ...state.progress, [type]: progress },
    })),

  setError: (type, error) =>
    set((state) => ({
      status: { ...state.status, [type]: "error" },
      errors: { ...state.errors, [type]: error },
    })),

  markStale: (type) =>
    set((state) => ({
      status: {
        ...state.status,
        [type]: state.records[type] ? "stale" : "idle",
      },
    })),

  resetAnalyses: () =>
    set({
      records: { ...INITIAL_RECORDS },
      hashes: { ...INITIAL_HASHES },
      status: { ...INITIAL_STATUS },
      progress: { ...INITIAL_PROGRESS },
      errors: { ...INITIAL_ERRORS },
    }),
}));
