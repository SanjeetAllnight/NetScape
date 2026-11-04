import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import { useEditorStore } from "@/stores/editorStore";
import { ProjectHeader } from "@/features/shell/ProjectHeader";
import { MapCanvas } from "@/features/map/MapCanvas";
import { DevicePalette } from "@/features/designer/DevicePalette";
import { DeviceInspector } from "@/features/designer/DeviceInspector";
import { LinkInspector } from "@/features/designer/LinkInspector";
import { TemplateModal } from "@/features/designer/TemplateModal";
import type { DesignId } from "@/contracts/primitives";
import type { GeocodeResult } from "@/contracts/services";

export function MapWorkspaceView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Search in map
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!designId) return;

    let isMounted = true;
    const openDesign = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const container = getApplicationContainer();
        await container.designSession.open(designId as DesignId);
      } catch (err: unknown) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : "Failed to open design");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    openDesign();

    return () => {
      isMounted = false;
      const container = getApplicationContainer();
      container.designSession.close();
    };
  }, [designId]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const container = getApplicationContainer();
      const results = await container.geocodingService.search(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item: GeocodeResult) => {
    useEditorStore.getState().setViewport({
      center: [item.center.coordinates[1], item.center.coordinates[0]],
      zoom: 16,
    });
    setSearchResults([]);
    setSearchQuery("");
  };

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <h2 className="text-base font-semibold text-status-error mb-2">Error Loading Design</h2>
        <p className="text-xs text-text-muted">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      {/* Project Context Header */}
      <ProjectHeader />

      {/* Main Map Workspace Area */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-canvas text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-brand-electric mb-3" />
            <span className="text-xs">Loading design canvas...</span>
          </div>
        ) : (
          <>
            {/* Map Canvas surface */}
            <MapCanvas />

            {/* Floating Palette */}
            <DevicePalette onOpenTemplates={() => setIsTemplateModalOpen(true)} />

            {/* Floating Inspectors */}
            <DeviceInspector />
            <LinkInspector />

            {/* Quick Location Search Bar at Top Center */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-72 sm:w-80">
              <form onSubmit={handleSearch} className="relative shadow-xl">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Jump to location..."
                  className="w-full pl-8 pr-8 py-1.5 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-full text-xs text-text-primary focus:border-brand-electric focus:outline-none"
                />
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-2.5 top-2.5 pointer-events-none" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="absolute right-2.5 top-2 text-text-muted hover:text-text-primary"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {isSearching && (
                  <Loader2 className="w-3.5 h-3.5 text-brand-electric animate-spin absolute right-2.5 top-2.5" />
                )}
              </form>

              {searchResults.length > 0 && (
                <div className="mt-1.5 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-lg shadow-2xl max-h-48 overflow-y-auto divide-y divide-border-subtle text-xs">
                  {searchResults.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => selectSearchResult(item)}
                      className="w-full text-left px-3 py-2 hover:bg-surface-elevated text-text-primary flex items-start gap-2"
                    >
                      <MapPin className="w-3.5 h-3.5 mt-0.5 text-brand-electric shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Topology Template Modal */}
            <TemplateModal
              isOpen={isTemplateModalOpen}
              onClose={() => setIsTemplateModalOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}

