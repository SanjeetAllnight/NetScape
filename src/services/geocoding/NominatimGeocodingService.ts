/**
 * OpenStreetMap Nominatim Geocoding Service adapter.
 * Authoritative source: docs/DATA_MODEL_AND_CONTRACTS.md §17.2
 *
 * Requirements:
 * - Enforce maximum 1 request per second rate limit
 * - In-memory client-side cache
 * - Return GeoPoint center and BoundingBox
 * - Graceful fallback on network/offline failure
 */

import type { GeocodingService, GeocodeResult } from "@/contracts/services";
import type { BoundingBox, Latitude, Longitude } from "@/contracts/primitives";
import { makeGeoPoint } from "@/domain/geo/localFrame";

export class NominatimGeocodingService implements GeocodingService {
  private lastRequestTime = 0;
  private readonly cache = new Map<string, GeocodeResult[]>();

  async search(
    query: string,
    options?: { signal?: AbortSignal; limit?: number; viewbox?: BoundingBox }
  ): Promise<GeocodeResult[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return [];
    }

    const cacheKey = trimmed.toLowerCase();
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Rate limiting: at least 1000ms between calls
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1000) {
      await new Promise((resolve) => setTimeout(resolve, 1000 - elapsed));
    }
    this.lastRequestTime = Date.now();

    const limit = options?.limit ?? 5;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", trimmed);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("addressdetails", "1");

    try {
      const response = await fetch(url.toString(), {
        headers: {
          Accept: "application/json",
        },
        signal: options?.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      if (!Array.isArray(data)) {
        return [];
      }

      const results: GeocodeResult[] = data.map((item: any) => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const [minLat, maxLat, minLng, maxLng] = (item.boundingbox || []).map(parseFloat);

        const bbox: BoundingBox = {
          minLng: (isNaN(minLng) ? lon - 0.01 : minLng) as Longitude,
          minLat: (isNaN(minLat) ? lat - 0.01 : minLat) as Latitude,
          maxLng: (isNaN(maxLng) ? lon + 0.01 : maxLng) as Longitude,
          maxLat: (isNaN(maxLat) ? lat + 0.01 : maxLat) as Latitude,
        };

        return {
          providerId: "nominatim",
          label: item.display_name || trimmed,
          center: makeGeoPoint(lon, lat),
          bbox,
        };
      });

      this.cache.set(cacheKey, results);
      return results;
    } catch {
      // Graceful offline or network error fallback
      return [];
    }
  }
}
