/**
 * PWA Service Worker registration module (prompt mode).
 * Precaches application shell and static assets only.
 * Does not cache external OSM basemap tiles or geocoder requests.
 */
import { registerSW } from "virtual:pwa-register";

export interface PwaRegistrationOptions {
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

export function initializePwa(options?: PwaRegistrationOptions): () => void {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return () => {};
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      options?.onNeedRefresh?.();
    },
    onOfflineReady() {
      options?.onOfflineReady?.();
    },
  });

  return updateSW;
}
