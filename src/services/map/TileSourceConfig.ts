/**
 * Map Tile Source Configuration and Offline Fallback.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.2
 */

import type { TileSourceConfig } from "@/contracts/services";

export const OSM_TILE_SOURCE: TileSourceConfig = {
  urlTemplate: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  minZoom: 1,
  maxZoom: 19,
};
