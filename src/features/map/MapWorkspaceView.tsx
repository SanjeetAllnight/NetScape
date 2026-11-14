import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Search, MapPin, Loader2, X, Columns2 } from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import { WorkbenchHeader } from "@/features/shell/WorkbenchHeader";
import { AnalysisStatusStrip } from "@/features/shell/AnalysisStatusStrip";
import { MapCanvas } from "@/features/map/MapCanvas";
import { TopologyCanvas } from "@/features/topology/TopologyCanvas";
import { DevicePalette } from "@/features/designer/DevicePalette";
import { WorkbenchInspector } from "@/features/designer/WorkbenchInspector";
import { TemplateModal } from "@/features/designer/TemplateModal";
import type { DesignId } from "@/contracts/primitives";
import type { GeocodeResult } from "@/contracts/services";

export function MapWorkspaceView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();

  const aggregate = useDesignStore((s) => s.aggregate);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isSplitView, setIsSplitView] = useState(false);

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

  // Invalidate Leaflet map size on split view toggle
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 150);
    return () => clearTimeout(timer);
  }, [isSplitView]);

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

  const devicesCount = Object.keys(aggregate?.devicesById ?? {}).length;
  const linksCount = Object.keys(aggregate?.linksById ?? {}).length;

  if (loadError) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-surface-canvas text-text-primary">
        <h2 className="text-base font-semibold text-status-error mb-2">Error Loading Design</h2>
        <p className="text-xs text-text-muted">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative select-none">
      {/* Unified Workbench Application & Navigation Header */}
      <WorkbenchHeader />

      {/* Main Workspace Area (Full Map or Map + Topology Split View) */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface-canvas text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-violet mb-3" />
            <span className="text-xs">Loading design canvas...</span>
          </div>
        ) : (
          <>
            {/* Split View Container or Single Canvas */}
            {isSplitView ? (
              <div className="w-full h-full flex overflow-hidden">
                <div className="w-1/2 h-full relative">
                  <MapCanvas />
                </div>
                <div className="w-1/2 h-full relative border-l border-border-strong bg-surface-canvas">
                  <div className="absolute top-4 left-4 z-10 px-2.5 py-1 rounded bg-surface-raised/90 border border-border-strong text-[10px] font-mono text-text-muted">
                    Logical Topology
                  </div>
                  <TopologyCanvas showMiniMap={false} />
                </div>
              </div>
            ) : (
              <MapCanvas />
            )}

            {/* Labelled, Expandable Tool Rail */}
            <DevicePalette onOpenTemplates={() => setIsTemplateModalOpen(true)} />

            {/* Dedicated Top Canvas Toolbar (Search, Stats & Split View Toggle) */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2">
              {/* Location Search Bar */}
              <div className="w-60 sm:w-72 relative">
                <form onSubmit={handleSearch} className="relative shadow-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Jump to location..."
                    className="w-full pl-8 pr-8 py-1.5 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-full text-xs text-text-primary focus:border-violet focus:outline-none"
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
                    <Loader2 className="w-3.5 h-3.5 text-violet animate-spin absolute right-2.5 top-2.5" />
                  )}
                </form>

                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-lg shadow-2xl max-h-48 overflow-y-auto divide-y divide-border-subtle text-xs z-50">
                    {searchResults.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectSearchResult(item)}
                        className="w-full text-left px-3 py-2 hover:bg-surface-elevated text-text-primary flex items-start gap-2"
                      >
                        <MapPin className="w-3.5 h-3.5 mt-0.5 text-violet shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Entity Count Badge Pill */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-raised/95 backdrop-blur-md border border-border-strong shadow-xl text-[11px] text-text-secondary font-mono">
                <span>{devicesCount} dev</span>
                <span className="text-border-strong">•</span>
                <span>{linksCount} links</span>
              </div>

              {/* Map + Topology Split View Toggle Button */}
              <button
                type="button"
                onClick={() => setIsSplitView((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border shadow-xl text-xs font-medium transition-all ${
                  isSplitView
                    ? "bg-violet/20 border-violet text-violet shadow-violet/20"
                    : "bg-surface-raised/95 border-border-strong text-text-secondary hover:text-text-primary hover:border-violet/40"
                }`}
                title={isSplitView ? "Close Topology Split View" : "Split View: Map + Topology"}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{isSplitView ? "Single View" : "Split View"}</span>
              </button>
            </div>

            {/* Unified Right-Hand Inspector (Device, Link, Coverage) */}
            <WorkbenchInspector />

            {/* Topology Template Modal */}
            <TemplateModal
              isOpen={isTemplateModalOpen}
              onClose={() => setIsTemplateModalOpen(false)}
            />
          </>
        )}
      </div>

      {/* Persistent Bottom Analysis Status Strip */}
      <AnalysisStatusStrip />
    </div>
  );
}
