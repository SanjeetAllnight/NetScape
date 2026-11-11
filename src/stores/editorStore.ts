/**
 * Editor Interaction & Selection Zustand Store.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.3
 *
 * Ephemeral interaction state: active tool, selection, link drafting, viewport.
 */

import { create } from "zustand";
import type { CatalogItemId, DeviceId, GeoPoint } from "@/contracts/primitives";
import type { ObstacleMaterial, LinkMedium } from "@/contracts/enums";

export type EditorTool =
  | "select"
  | "pan"
  | "place-device"
  | "connect-link"
  | "draw-boundary"
  | "draw-obstacle";

export interface SelectedEntity {
  type: "device" | "link" | "obstacle" | "region";
  id: string;
}

export interface LinkDraft {
  sourceDeviceId: DeviceId;
  medium: LinkMedium;
  sourcePosition: GeoPoint;
  mousePosition: GeoPoint | null;
}

export interface MapViewport {
  center: [number, number]; // [lat, lng]
  zoom: number;
}

export interface CoverageOverlayState {
  visible: boolean;
  opacity: number;
  showDeadZones: boolean;
  isDockOpen: boolean;
}

export interface EditorStoreState {
  activeTool: EditorTool;
  catalogItemIdToPlace: CatalogItemId | null;
  obstacleMaterialToPlace: ObstacleMaterial;
  selectedEntity: SelectedEntity | null;
  linkDraft: LinkDraft | null;
  viewport: MapViewport;
  coverageOverlay: CoverageOverlayState;

  setActiveTool: (tool: EditorTool) => void;
  setCatalogItemIdToPlace: (id: CatalogItemId | null) => void;
  setObstacleMaterialToPlace: (material: ObstacleMaterial) => void;
  setSelectedEntity: (entity: SelectedEntity | null) => void;
  setLinkDraft: (draft: LinkDraft | null) => void;
  setViewport: (viewport: MapViewport) => void;
  setCoverageOverlay: (patch: Partial<CoverageOverlayState>) => void;
  resetEditor: () => void;
}

const DEFAULT_VIEWPORT: MapViewport = {
  center: [12.9716, 77.5946], // Bangalore default
  zoom: 16,
};

const DEFAULT_COVERAGE_OVERLAY: CoverageOverlayState = {
  visible: true,
  opacity: 0.65,
  showDeadZones: true,
  isDockOpen: false,
};

export const useEditorStore = create<EditorStoreState>((set) => ({
  activeTool: "select",
  catalogItemIdToPlace: null,
  obstacleMaterialToPlace: "brick",
  selectedEntity: null,
  linkDraft: null,
  viewport: DEFAULT_VIEWPORT,
  coverageOverlay: DEFAULT_COVERAGE_OVERLAY,

  setCoverageOverlay: (patch) =>
    set((state) => ({
      coverageOverlay: {
        ...state.coverageOverlay,
        ...patch,
      },
    })),

  setActiveTool: (activeTool) =>
    set({
      activeTool,
      linkDraft: activeTool === "connect-link" ? undefined : null,
    }),

  setCatalogItemIdToPlace: (catalogItemIdToPlace) =>
    set({
      catalogItemIdToPlace,
      activeTool: catalogItemIdToPlace ? "place-device" : "select",
    }),

  setObstacleMaterialToPlace: (obstacleMaterialToPlace) =>
    set({ obstacleMaterialToPlace }),

  setSelectedEntity: (selectedEntity) => set({ selectedEntity }),

  setLinkDraft: (linkDraft) => set({ linkDraft }),

  setViewport: (viewport) => set({ viewport }),

  resetEditor: () =>
    set({
      activeTool: "select",
      catalogItemIdToPlace: null,
      obstacleMaterialToPlace: "brick",
      selectedEntity: null,
      linkDraft: null,
      coverageOverlay: DEFAULT_COVERAGE_OVERLAY,
    }),
}));

