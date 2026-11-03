/**
 * Project and Active Session Zustand Store skeleton.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17
 */

import { create } from "zustand";
import type { Project, Design } from "@/contracts/domain";
import type { ProjectId, DesignId } from "@/contracts/primitives";

export interface ProjectStoreState {
  activeProjectId: ProjectId | null;
  activeDesignId: DesignId | null;
  project: Project | null;
  designs: Design[];
  isLoading: boolean;
  error: string | null;

  setSession: (project: Project, designs: Design[], activeDesignId: DesignId) => void;
  setActiveDesign: (designId: DesignId) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectStoreState>((set) => ({
  activeProjectId: null,
  activeDesignId: null,
  project: null,
  designs: [],
  isLoading: false,
  error: null,

  setSession: (project, designs, activeDesignId) =>
    set({
      activeProjectId: project.id,
      activeDesignId,
      project,
      designs,
      isLoading: false,
      error: null,
    }),

  setActiveDesign: (activeDesignId) => set({ activeDesignId }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      activeProjectId: null,
      activeDesignId: null,
      project: null,
      designs: [],
      isLoading: false,
      error: null,
    }),
}));

