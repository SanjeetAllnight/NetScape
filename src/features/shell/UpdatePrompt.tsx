import { useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { RefreshCw, X, Sparkles } from "lucide-react";

/**
 * Non-blocking Service Worker update notification.
 * Authoritative source: docs/SYSTEM_ARCHITECTURE.md §16.2, Phase 4 P4-02
 *
 * Prompts user when an application update is waiting.
 * NEVER forces reload during active editing, calculation, or PDF generation.
 */
export function UpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Periodic update check every 60 minutes
        setInterval(() => {
          r.update().catch(() => {});
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.warn("ServiceWorker registration failed:", error);
    },
  });

  if (!needRefresh || dismissed) {
    return null;
  }

  const handleUpdate = async () => {
    try {
      await updateServiceWorker(true);
    } catch (err) {
      console.error("Failed to update service worker:", err);
    }
  };

  const handleLater = () => {
    setDismissed(true);
    setNeedRefresh(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-accent-blue/30 bg-surface-panel p-4 shadow-xl backdrop-blur transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-blue/15 text-accent-blue">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h4 className="text-xs font-bold text-text-primary">
            New Version Available
          </h4>
          <p className="mt-1 text-[11px] text-text-secondary leading-relaxed">
            A new version of NetScape is ready. Update now to load the latest release. All your authored designs and local projects remain safe in IndexedDB.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="flex items-center gap-1.5 rounded bg-accent-blue px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-accent-blue-hover shadow-sm"
            >
              <RefreshCw className="h-3 w-3" />
              Update Now
            </button>
            <button
              onClick={handleLater}
              className="rounded bg-surface-raised px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-border-strong hover:text-text-primary transition"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleLater}
          className="text-text-muted hover:text-text-primary p-1"
          aria-label="Dismiss update notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
