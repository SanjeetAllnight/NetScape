import { useState, useMemo } from "react";
import {
  Wifi,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  MapPin,
  HelpCircle,
  Radio,
} from "lucide-react";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useEditorStore } from "@/stores/editorStore";
import { getApplicationContainer } from "@/application/container";
import { localPointToGeo } from "@/domain/geo/localFrame";
import { ProjectSettingsModal } from "@/features/settings/ProjectSettingsModal";
import type { DesignId } from "@/contracts/primitives";
import type { CoverageResult } from "@/contracts/engines";

export function CoverageDock() {
  const aggregate = useDesignStore((s) => s.aggregate);
  const designId = aggregate?.design.id;

  const coverageRecord = useAnalysisStore((s) => s.records.coverage);
  const coverageStatus = useAnalysisStore((s) => s.status.coverage);
  const coverageProgress = useAnalysisStore((s) => s.progress.coverage);
  const coverageError = useAnalysisStore((s) => s.errors.coverage);

  const coverageOverlay = useEditorStore((s) => s.coverageOverlay);
  const setCoverageOverlay = useEditorStore((s) => s.setCoverageOverlay);
  const setViewport = useEditorStore((s) => s.setViewport);

  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Check prerequisites
  const accessPoints = useMemo(() => {
    return Object.values(aggregate?.devicesById ?? {}).filter((d) => d.type === "accessPoint");
  }, [aggregate?.devicesById]);

  const hasBoundary = Boolean(aggregate?.region.boundary && aggregate.region.boundary.coordinates.length > 0);
  const hasAps = accessPoints.length > 0;
  const canRun = hasBoundary && hasAps;

  const handleRun = async () => {
    if (!designId || !canRun) return;
    try {
      const container = getApplicationContainer();
      await container.analysisCoordinator.run("coverage", designId as DesignId);
      setCoverageOverlay({ visible: true });
    } catch {
      // Error handled in store
    }
  };

  const handleCancel = async () => {
    if (!designId) return;
    const container = getApplicationContainer();
    await container.analysisCoordinator.cancel("coverage", designId as DesignId);
  };

  const result = coverageRecord?.result as CoverageResult | undefined;
  const coverageSettings = aggregate?.project.settings.coverage;

  const classCountMap = useMemo(() => {
    if (!result?.classCounts) return {};
    return Object.fromEntries(result.classCounts.map((c) => [c.class, c]));
  }, [result?.classCounts]);

  if (!coverageOverlay.isDockOpen) {
    return (
      <button
        onClick={() => setCoverageOverlay({ isDockOpen: true })}
        title="Open Wireless Coverage Panel"
        className="absolute top-4 right-4 z-[400] px-3 py-2 rounded-lg bg-surface-raised/95 backdrop-blur-md border border-border-strong shadow-2xl text-xs font-semibold text-text-primary hover:border-brand-electric flex items-center gap-2 transition-all"
      >
        <Radio className="w-4 h-4 text-brand-electric animate-pulse" />
        <span>Coverage</span>
        {coverageStatus === "stale" && (
          <span className="w-2 h-2 rounded-full bg-status-warning" title="Out of date" />
        )}
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 bottom-4 z-[400] w-80 sm:w-96 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs select-none">
      {/* Dock Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between bg-surface-panel/50 shrink-0">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-brand-electric" />
          <h2 className="font-bold text-text-primary text-xs tracking-tight">Wireless RF Coverage</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCoverageOverlay({ isDockOpen: false })}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            title="Collapse dock"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dock Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Status & Freshness Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
          <span className="text-text-secondary font-medium">Status</span>
          {coverageStatus === "computing" ? (
            <span className="inline-flex items-center gap-1 text-brand-electric font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Computing ({Math.round(coverageProgress * 100)}%)
            </span>
          ) : coverageStatus === "fresh" ? (
            <span className="inline-flex items-center gap-1 text-status-success font-medium">
              <CheckCircle2 className="w-3 h-3" />
              Up to Date
            </span>
          ) : coverageStatus === "stale" ? (
            <span className="inline-flex items-center gap-1 text-status-warning font-medium">
              <Clock className="w-3 h-3" />
              Out of Date
            </span>
          ) : (
            <span className="text-text-muted">Not calculated</span>
          )}
        </div>

        {/* Error Banner */}
        {coverageError && (
          <div className="p-2.5 rounded bg-status-error/10 border border-status-error/30 text-status-error text-[11px] flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{coverageError}</span>
          </div>
        )}

        {/* Missing Prerequisites Warning */}
        {!canRun && (
          <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle space-y-1.5 text-[11px]">
            <div className="flex items-center gap-1.5 font-semibold text-status-warning">
              <AlertTriangle className="w-3.5 h-3.5" />
              Prerequisites Needed
            </div>
            {!hasBoundary && (
              <p className="text-text-muted">
                • Define a planning boundary polygon using the polygon tool on the left palette.
              </p>
            )}
            {!hasAps && (
              <p className="text-text-muted">
                • Place at least one Wi-Fi Access Point device inside the planning region.
              </p>
            )}
          </div>
        )}

        {/* Primary Action Button */}
        <div>
          {coverageStatus === "computing" ? (
            <div className="space-y-2">
              <div className="h-1.5 w-full bg-surface-panel rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-electric transition-all duration-300"
                  style={{ width: `${Math.max(5, coverageProgress * 100)}%` }}
                />
              </div>
              <button
                onClick={handleCancel}
                className="w-full py-1.5 rounded bg-status-error/20 hover:bg-status-error/30 text-status-error border border-status-error/40 font-semibold text-xs transition-colors"
              >
                Cancel Computation
              </button>
            </div>
          ) : (
            <button
              onClick={handleRun}
              disabled={!canRun}
              className="w-full py-2 rounded bg-brand-electric hover:bg-brand-electric/90 disabled:opacity-40 text-white font-semibold shadow flex items-center justify-center gap-1.5 transition-colors"
            >
              <Wifi className="w-3.5 h-3.5" />
              {coverageRecord ? "Recalculate Coverage" : "Run Coverage Analysis"}
            </button>
          )}
        </div>

        {/* Overlay Presentation Controls */}
        {result && (
          <div className="p-3 rounded-lg bg-surface-panel/80 border border-border-subtle space-y-3">
            <span className="font-semibold text-text-primary text-[11px] block">Overlay Controls</span>

            <div className="flex items-center justify-between">
              <span className="text-text-secondary text-[11px]">Heatmap Visibility</span>
              <button
                onClick={() => setCoverageOverlay({ visible: !coverageOverlay.visible })}
                className={`p-1.5 rounded border flex items-center gap-1 transition-colors ${
                  coverageOverlay.visible
                    ? "bg-brand-electric/10 border-brand-electric text-brand-electric"
                    : "bg-surface-elevated border-border-subtle text-text-muted"
                }`}
              >
                {coverageOverlay.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-medium">{coverageOverlay.visible ? "Visible" : "Hidden"}</span>
              </button>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-text-secondary">
                <span>Opacity</span>
                <span className="font-mono text-text-primary">{Math.round(coverageOverlay.opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={coverageOverlay.opacity}
                onChange={(e) => setCoverageOverlay({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-brand-electric cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label htmlFor="showDeadZones" className="text-text-secondary text-[11px] cursor-pointer">
                Highlight Dead Zones
              </label>
              <input
                id="showDeadZones"
                type="checkbox"
                checked={coverageOverlay.showDeadZones}
                onChange={(e) => setCoverageOverlay({ showDeadZones: e.target.checked })}
                className="rounded accent-brand-electric cursor-pointer"
              />
            </div>
          </div>
        )}

        {/* Results Summary */}
        {result && (
          <div className="space-y-3 pt-2 border-t border-border-subtle">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-text-primary text-xs">Coverage Ratio</span>
              <span className="font-mono font-bold text-sm text-brand-electric">
                {result.coveragePercent.toFixed(1)}%
              </span>
            </div>
            <p className="text-[10px] text-text-muted">
              Grid cells inside boundary meeting &ge; {coverageSettings?.minimumAcceptableRssiDbm ?? -75} dBm requirement.
            </p>

            {/* 5-Class RSSI Legend & Area Breakdown */}
            <div className="space-y-1.5 pt-1">
              <span className="font-medium text-text-secondary text-[11px] block">Signal Classification</span>

              <div className="space-y-1 text-[11px] font-mono">
                {/* Excellent */}
                <div className="flex items-center justify-between p-1.5 rounded bg-surface-panel/40 border border-border-subtle">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#10b981]" />
                    <span className="text-text-primary">Excellent</span>
                  </div>
                  <div className="text-text-muted text-[10px]">
                    <span>&ge; {coverageSettings?.signalThresholdsDbm.excellentMin ?? -65} dBm</span>
                    <span className="text-text-primary ml-2">{classCountMap.excellent?.cellCount ?? 0} cells</span>
                  </div>
                </div>

                {/* Good */}
                <div className="flex items-center justify-between p-1.5 rounded bg-surface-panel/40 border border-border-subtle">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#0297de]" />
                    <span className="text-text-primary">Good</span>
                  </div>
                  <div className="text-text-muted text-[10px]">
                    <span>&ge; {coverageSettings?.signalThresholdsDbm.goodMin ?? -75} dBm</span>
                    <span className="text-text-primary ml-2">{classCountMap.good?.cellCount ?? 0} cells</span>
                  </div>
                </div>

                {/* Fair */}
                <div className="flex items-center justify-between p-1.5 rounded bg-surface-panel/40 border border-border-subtle">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#f59e0b]" />
                    <span className="text-text-primary">Fair</span>
                  </div>
                  <div className="text-text-muted text-[10px]">
                    <span>&ge; {coverageSettings?.signalThresholdsDbm.fairMin ?? -85} dBm</span>
                    <span className="text-text-primary ml-2">{classCountMap.fair?.cellCount ?? 0} cells</span>
                  </div>
                </div>

                {/* Weak */}
                <div className="flex items-center justify-between p-1.5 rounded bg-surface-panel/40 border border-border-subtle">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#f97316]" />
                    <span className="text-text-primary">Weak</span>
                  </div>
                  <div className="text-text-muted text-[10px]">
                    <span>&ge; {coverageSettings?.signalThresholdsDbm.weakMin ?? -90} dBm</span>
                    <span className="text-text-primary ml-2">{classCountMap.weak?.cellCount ?? 0} cells</span>
                  </div>
                </div>

                {/* Dead Zone */}
                <div className="flex items-center justify-between p-1.5 rounded bg-surface-panel/40 border border-border-subtle">
                  <div className="flex items-center gap-1.5 font-sans">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#ef4444]" />
                    <span className="text-text-primary">Dead Zone</span>
                  </div>
                  <div className="text-text-muted text-[10px]">
                    <span>&lt; {coverageSettings?.signalThresholdsDbm.weakMin ?? -90} dBm</span>
                    <span className="text-text-primary ml-2">{classCountMap.deadZone?.cellCount ?? 0} cells</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dead Zones Details List */}
            {result.deadZones && result.deadZones.length > 0 && (
              <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 space-y-2">
                <div className="flex items-center justify-between text-status-error">
                  <span className="font-semibold text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Dead Zones Detected
                  </span>
                  <span className="font-mono text-xs">{result.deadZones.length} areas</span>
                </div>

                <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                  {result.deadZones.map((dz, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded bg-surface-canvas border border-status-error/20 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-mono text-text-primary">
                        {dz.cellCount} cells (~{dz.areaM2} m²)
                      </span>
                      {aggregate?.project.frame && dz.centroidLocalM && (
                        <button
                          onClick={() => {
                            const geo = localPointToGeo(dz.centroidLocalM, aggregate.project.frame);
                            setViewport({
                              center: [geo.coordinates[1], geo.coordinates[0]],
                              zoom: 18,
                            });
                          }}
                          className="text-[10px] text-brand-electric hover:underline flex items-center gap-0.5"
                          title="Focus map on dead zone"
                        >
                          <MapPin className="w-3 h-3" />
                          Focus
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Model Parameters Section */}
        <div className="pt-2 border-t border-border-subtle">
          <button
            onClick={() => setIsParamsOpen(!isParamsOpen)}
            className="w-full flex items-center justify-between py-1 text-text-secondary hover:text-text-primary text-[11px] font-medium"
          >
            <span>Model Parameters &amp; Assumptions</span>
            {isParamsOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>

          {isParamsOpen && (
            <div className="mt-2 p-3 rounded-lg bg-surface-panel/60 border border-border-subtle space-y-2 text-[11px] text-text-secondary">
              <div className="flex justify-between">
                <span>Model</span>
                <span className="font-mono text-text-primary">Log-Distance Path Loss</span>
              </div>
              <div className="flex justify-between">
                <span>Frequency</span>
                <span className="font-mono text-text-primary">{coverageSettings?.frequencyMhz ?? 2400} MHz</span>
              </div>
              <div className="flex justify-between">
                <span>Path Loss Exponent (n)</span>
                <span className="font-mono text-text-primary">{coverageSettings?.pathLossExponent ?? 3.0}</span>
              </div>
              <div className="flex justify-between">
                <span>Reference Loss (d0 = 1m)</span>
                <span className="font-mono text-text-primary">{coverageSettings?.referenceLossDb ?? 40.04} dB</span>
              </div>
              <div className="flex justify-between">
                <span>Grid Cell Resolution</span>
                <span className="font-mono text-text-primary">{coverageSettings?.gridResolutionM ?? 5} meters</span>
              </div>

              <div className="pt-2 border-t border-border-subtle">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="w-full py-1 text-center text-brand-electric hover:underline font-medium text-[11px]"
                >
                  Edit Project Coverage Settings
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="p-2.5 rounded bg-surface-panel/40 border border-border-subtle text-[10px] text-text-muted flex items-start gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-text-disabled" />
          <span>
            2D free-space and obstacle attenuation approximation. Antenna radiation patterns, 3D multi-floor, and interference are not modeled.
          </span>
        </div>
      </div>

      {/* Settings Modal */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}

