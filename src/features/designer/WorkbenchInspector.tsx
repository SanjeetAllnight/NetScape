import { useState, useEffect, useMemo } from "react";
import {
  X,
  Trash2,
  Cpu,
  Zap,
  Clock,
  MapPin,
  Check,
  Loader2,
  Waypoints,
  ArrowRight,
  Radio,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getApplicationContainer } from "@/application/container";
import { deriveLinkLengthM, localPointToGeo } from "@/domain/geo/localFrame";
import { ProjectSettingsModal } from "@/features/settings/ProjectSettingsModal";
import type { DeviceId, LinkId, DesignId } from "@/contracts/primitives";
import type { AccessPointSpecs } from "@/contracts/domain";
import type { LinkMedium, LinkInstallationMethod } from "@/contracts/enums";
import type { CoverageResult } from "@/contracts/engines";

export function WorkbenchInspector() {
  const selectedEntity = useEditorStore((s) => s.selectedEntity);
  const setSelectedEntity = useEditorStore((s) => s.setSelectedEntity);
  const setViewport = useEditorStore((s) => s.setViewport);

  const coverageOverlay = useEditorStore((s) => s.coverageOverlay);
  const setCoverageOverlay = useEditorStore((s) => s.setCoverageOverlay);

  const aggregate = useDesignStore((s) => s.aggregate);
  const designId = aggregate?.design.id;

  const coverageRecord = useAnalysisStore((s) => s.records.coverage);
  const coverageStatus = useAnalysisStore((s) => s.status.coverage);
  const coverageProgress = useAnalysisStore((s) => s.progress.coverage);

  // Inspector tabs: "selection" | "coverage"
  const [activeTab, setActiveTab] = useState<"selection" | "coverage">("selection");
  const [isParamsOpen, setIsParamsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Device edit state
  const [deviceName, setDeviceName] = useState("");
  const [deviceHostname, setDeviceHostname] = useState("");
  const [isUpdatingDevice, setIsUpdatingDevice] = useState(false);
  const [isDeletingDevice, setIsDeletingDevice] = useState(false);

  // Link edit state
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);
  const [isDeletingLink, setIsDeletingLink] = useState(false);

  const selectedDevice =
    selectedEntity?.type === "device" && aggregate
      ? aggregate.devicesById[selectedEntity.id as DeviceId]
      : null;

  const catalogItem =
    selectedDevice && aggregate ? aggregate.catalogById[selectedDevice.catalogItemId] : null;

  const selectedLink =
    selectedEntity?.type === "link" && aggregate
      ? aggregate.linksById[selectedEntity.id as LinkId]
      : null;

  // Sync device fields
  useEffect(() => {
    if (selectedDevice) {
      setDeviceName(selectedDevice.name);
      setDeviceHostname(selectedDevice.hostname ?? "");
      setActiveTab("selection");
    }
  }, [selectedDevice]);

  // Sync tab when link is selected
  useEffect(() => {
    if (selectedLink) {
      setActiveTab("selection");
    }
  }, [selectedLink]);

  // Sync tab when coverage dock is requested
  useEffect(() => {
    if (coverageOverlay.isDockOpen) {
      setActiveTab("coverage");
    }
  }, [coverageOverlay.isDockOpen]);

  // Check if anything is active in inspector
  const hasSelection = Boolean(selectedDevice || selectedLink);
  const isOpen = hasSelection || coverageOverlay.isDockOpen;

  // Coverage calculations
  const accessPoints = useMemo(() => {
    return Object.values(aggregate?.devicesById ?? {}).filter((d) => d.type === "accessPoint");
  }, [aggregate?.devicesById]);

  const hasBoundary = Boolean(
    aggregate?.region.boundary && aggregate.region.boundary.coordinates.length > 0
  );
  const hasAps = accessPoints.length > 0;
  const canRunCoverage = hasBoundary && hasAps;

  const coverageResult = coverageRecord?.result as CoverageResult | undefined;
  const coverageSettings = aggregate?.project.settings.coverage;

  const classCountMap = useMemo(() => {
    if (!coverageResult?.classCounts) return {};
    return Object.fromEntries(coverageResult.classCounts.map((c) => [c.class, c]));
  }, [coverageResult?.classCounts]);

  const handleRunCoverage = async () => {
    if (!designId || !canRunCoverage) return;
    try {
      const container = getApplicationContainer();
      await container.analysisCoordinator.run("coverage", designId as DesignId);
      setCoverageOverlay({ visible: true });
    } catch {
      // Handled in store
    }
  };

  const handleCancelCoverage = async () => {
    if (!designId) return;
    const container = getApplicationContainer();
    await container.analysisCoordinator.cancel("coverage", designId as DesignId);
  };

  const handleUpdateDevice = async () => {
    if (!selectedDevice || !deviceName.trim()) return;
    setIsUpdatingDevice(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "device/update",
        deviceId: selectedDevice.id,
        patch: {
          name: deviceName.trim(),
          hostname: deviceHostname.trim() || null,
        },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setIsUpdatingDevice(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!selectedDevice) return;
    if (!window.confirm(`Delete device "${selectedDevice.name}"? Incident links will be cleaned up.`)) {
      return;
    }
    setIsDeletingDevice(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "device/delete",
        deviceId: selectedDevice.id,
      });
      setSelectedEntity(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete device");
    } finally {
      setIsDeletingDevice(false);
    }
  };

  const handleUpdateLinkMedium = async (medium: LinkMedium) => {
    if (!selectedLink) return;
    setIsUpdatingLink(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/update",
        linkId: selectedLink.id,
        patch: { medium },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update link medium");
    } finally {
      setIsUpdatingLink(false);
    }
  };

  const handleUpdateLinkInstallation = async (method: LinkInstallationMethod | null) => {
    if (!selectedLink) return;
    setIsUpdatingLink(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/update",
        linkId: selectedLink.id,
        patch: { installationMethod: method },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update installation method");
    } finally {
      setIsUpdatingLink(false);
    }
  };

  const handleDeleteLink = async () => {
    if (!selectedLink) return;
    if (!window.confirm("Delete this link?")) return;
    setIsDeletingLink(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/delete",
        linkId: selectedLink.id,
      });
      setSelectedEntity(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete link");
    } finally {
      setIsDeletingLink(false);
    }
  };

  // If closed, render a compact floating toggle button if coverage is active or can be opened
  if (!isOpen) {
    return (
      <button
        onClick={() => {
          setCoverageOverlay({ isDockOpen: true });
          setActiveTab("coverage");
        }}
        title="Open Wireless Coverage &amp; Inspector Panel"
        className="absolute top-4 right-4 z-[400] px-3 py-1.5 rounded-lg bg-surface-raised/95 backdrop-blur-md border border-border-strong shadow-xl text-xs font-semibold text-text-primary hover:border-violet flex items-center gap-2 transition-all hover:scale-105"
      >
        <Radio className="w-3.5 h-3.5 text-violet" />
        <span>Coverage</span>
        {coverageStatus === "stale" && (
          <span className="w-2 h-2 rounded-full bg-status-warning" title="Out of date" />
        )}
      </button>
    );
  }

  return (
    <aside
      className="absolute top-4 right-4 bottom-14 z-[400] w-80 sm:w-88 bg-surface-raised/95 backdrop-blur-md border border-border-strong rounded-xl shadow-2xl flex flex-col overflow-hidden text-xs select-none animate-in fade-in slide-in-from-right-4 duration-150"
      aria-label="Workbench Inspector"
    >
      {/* Inspector Header with Tab Switcher */}
      <div className="px-3 py-2 border-b border-border-subtle flex items-center justify-between bg-surface-panel/70 shrink-0">
        <div className="flex items-center space-x-1">
          {hasSelection && (
            <button
              onClick={() => setActiveTab("selection")}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === "selection"
                  ? "bg-surface-elevated text-violet border border-border-strong"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              {selectedDevice ? (
                <>
                  <Cpu className="w-3.5 h-3.5 text-violet" />
                  <span className="capitalize">{selectedDevice.type}</span>
                </>
              ) : (
                <>
                  <Waypoints className="w-3.5 h-3.5 text-violet" />
                  <span>Link</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={() => setActiveTab("coverage")}
            className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === "coverage"
                ? "bg-surface-elevated text-violet border border-border-strong"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-violet" />
            <span>Coverage</span>
            {coverageStatus === "stale" && (
              <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
            )}
          </button>
        </div>

        <button
          onClick={() => {
            setSelectedEntity(null);
            setCoverageOverlay({ isDockOpen: false });
          }}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          title="Close Inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Inspector Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: SELECTION (Device or Link) */}
        {activeTab === "selection" && selectedDevice && catalogItem && (
          <div className="space-y-4">
            {/* Device Name and Hostname */}
            <div className="space-y-2">
              <div>
                <label className="block text-text-muted mb-1 font-medium">Device Name</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    onBlur={handleUpdateDevice}
                    className="flex-1 px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-violet focus:outline-none"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleUpdateDevice}
                    disabled={isUpdatingDevice || deviceName === selectedDevice.name}
                    className="px-2"
                  >
                    {isUpdatingDevice ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-text-muted mb-1 font-medium">Hostname (Optional)</label>
                <input
                  type="text"
                  value={deviceHostname}
                  onChange={(e) => setDeviceHostname(e.target.value)}
                  onBlur={handleUpdateDevice}
                  placeholder="e.g. core-sw-01"
                  className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none text-[11px]"
                />
              </div>
            </div>

            {/* Catalogue Specs Card */}
            <div className="pt-2 border-t border-border-subtle space-y-2">
              <span className="text-[10px] font-mono font-semibold text-text-muted uppercase tracking-wider block">
                Catalogue Specification
              </span>

              <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle space-y-2 text-[11px]">
                <div className="text-text-primary font-semibold flex items-center justify-between">
                  <span>{catalogItem.label}</span>
                  <Badge variant="violet" className="capitalize text-[10px]">
                    {catalogItem.type}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-text-muted pt-1 border-t border-border-subtle">
                  <span className="flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-violet" />
                    Ports
                  </span>
                  <span className="font-mono text-text-primary">
                    {catalogItem.specs.ports.copperEthernet} Cu / {catalogItem.specs.ports.fiber} Fi /{" "}
                    {catalogItem.specs.ports.wireless} Wi
                  </span>
                </div>

                {catalogItem.type === "accessPoint" && (
                  <div className="flex items-center justify-between text-text-muted">
                    <span>Radio Tx / Gain</span>
                    <span className="font-mono text-text-primary">
                      {(catalogItem.specs as AccessPointSpecs).radio.txPowerDbm} dBm /{" "}
                      {(catalogItem.specs as AccessPointSpecs).radio.antennaGainDbi} dBi
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-text-muted">
                  <span className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-status-warning" />
                    Nameplate Power
                  </span>
                  <span className="font-mono text-text-primary">{catalogItem.powerW} W</span>
                </div>

                <div className="flex items-center justify-between text-text-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-text-muted" />
                    TCO Lifespan
                  </span>
                  <span className="font-mono text-text-primary">{catalogItem.lifespanYears} years</span>
                </div>

                <div className="flex items-center justify-between text-text-muted">
                  <span>Unit Price</span>
                  <span className="font-mono text-text-primary font-semibold">
                    {catalogItem.unitPrice
                      ? `₹${catalogItem.unitPrice.amount.toLocaleString("en-IN")}`
                      : "Unlisted"}
                  </span>
                </div>
              </div>
            </div>

            {/* Geographic Coordinates */}
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-violet" />
                Coordinates
              </span>
              <span className="font-mono text-text-primary">
                {selectedDevice.position.coordinates[1].toFixed(5)},{" "}
                {selectedDevice.position.coordinates[0].toFixed(5)}
              </span>
            </div>

            {/* Delete Device */}
            <div className="pt-2 border-t border-border-subtle">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteDevice}
                disabled={isDeletingDevice}
                className="w-full gap-1.5"
              >
                {isDeletingDevice ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete Device
              </Button>
            </div>
          </div>
        )}

        {/* TAB 1: SELECTION (Link) */}
        {activeTab === "selection" && selectedLink && aggregate && (
          <div className="space-y-4">
            <div className="p-2.5 rounded-lg bg-surface-panel border border-border-subtle flex items-center justify-between text-xs">
              <span className="font-semibold text-text-primary truncate max-w-[100px]">
                {aggregate.devicesById[selectedLink.sourceDeviceId]?.name ?? selectedLink.sourceDeviceId}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-violet shrink-0 mx-2" />
              <span className="font-semibold text-text-primary truncate max-w-[100px]">
                {aggregate.devicesById[selectedLink.targetDeviceId]?.name ?? selectedLink.targetDeviceId}
              </span>
            </div>

            {/* Medium Selection */}
            <div>
              <label className="block text-text-muted mb-1 font-medium">Link Medium</label>
              <select
                value={selectedLink.medium}
                disabled={isUpdatingLink}
                onChange={(e) => handleUpdateLinkMedium(e.target.value as LinkMedium)}
                className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-violet focus:outline-none"
              >
                <option value="copper">Copper Ethernet (1000BASE-T)</option>
                <option value="fiber">Optical Fibre (Single-mode)</option>
                <option value="wireless">Wireless Point-to-Point</option>
              </select>
            </div>

            {/* Installation Method */}
            <div>
              <label className="block text-text-muted mb-1 font-medium">Installation Method</label>
              <select
                value={selectedLink.installationMethod ?? "none"}
                disabled={isUpdatingLink}
                onChange={(e) =>
                  handleUpdateLinkInstallation(
                    e.target.value === "none" ? null : (e.target.value as LinkInstallationMethod)
                  )
                }
                className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-violet focus:outline-none"
              >
                <option value="none">Not Classified (Partial Estimate)</option>
                <option value="indoor">Indoor Surface / Conduit</option>
                <option value="underground">Underground Direct Buried</option>
                <option value="aerial">Aerial Pole / Messenger</option>
              </select>
            </div>

            {/* Physical Span Length */}
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
              <span>Physical Span Length</span>
              <span className="font-mono text-text-primary font-semibold">
                {Math.round(
                  deriveLinkLengthM(selectedLink, aggregate.devicesById, aggregate.project.frame)
                )}{" "}
                meters
              </span>
            </div>

            {/* Delete Link */}
            <div className="pt-2 border-t border-border-subtle">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteLink}
                disabled={isDeletingLink}
                className="w-full gap-1.5"
              >
                {isDeletingLink ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                Delete Link
              </Button>
            </div>
          </div>
        )}

        {/* TAB 2: COVERAGE */}
        {activeTab === "coverage" && (
          <div className="space-y-4">
            {/* Status & Freshness Header */}
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <span className="text-text-secondary font-medium">Engine Status</span>
              {coverageStatus === "computing" ? (
                <Badge variant="violet" className="gap-1 animate-pulse font-mono">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {coverageProgress > 0 && coverageProgress < 1
                    ? `${Math.round(coverageProgress * 100)}%`
                    : "Computing..."}
                </Badge>
              ) : coverageStatus === "fresh" ? (
                <Badge variant="success" className="gap-1 font-mono">
                  <Check className="w-3 h-3" />
                  CURRENT
                </Badge>
              ) : coverageStatus === "stale" ? (
                <Badge variant="warning" className="gap-1 font-mono">
                  <AlertTriangle className="w-3 h-3" />
                  OUT OF DATE
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1 font-mono">
                  <Clock className="w-3 h-3" />
                  UNCOMPUTED
                </Badge>
              )}
            </div>

            {/* Execution Controls */}
            <div className="space-y-2">
              <Button
                onClick={handleRunCoverage}
                disabled={!canRunCoverage || coverageStatus === "computing"}
                variant="primary"
                size="sm"
                className="w-full gap-2"
              >
                {coverageStatus === "computing" ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Computing RF Propagation...</span>
                  </>
                ) : (
                  <>
                    <Radio className="w-3.5 h-3.5" />
                    <span>{coverageStatus === "stale" ? "Recompute Coverage" : "Run Coverage Analysis"}</span>
                  </>
                )}
              </Button>

              {coverageStatus === "computing" && (
                <Button
                  onClick={handleCancelCoverage}
                  variant="outline"
                  size="sm"
                  className="w-full text-text-muted hover:text-text-primary"
                >
                  Cancel Simulation
                </Button>
              )}

              {!canRunCoverage && (
                <p className="text-[11px] text-text-muted italic text-center">
                  {!hasBoundary
                    ? "Draw planning boundary polygon on map to enable."
                    : "Place at least one access point to simulate."}
                </p>
              )}
            </div>

            {/* Overlay View Controls */}
            <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-text-primary">Heatmap Overlay</span>
                <button
                  onClick={() => setCoverageOverlay({ visible: !coverageOverlay.visible })}
                  className="p-1 rounded text-text-muted hover:text-text-primary"
                  title={coverageOverlay.visible ? "Hide raster" : "Show raster"}
                >
                  {coverageOverlay.visible ? <Eye className="w-4 h-4 text-violet" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-text-muted mb-1">
                  <span>Opacity</span>
                  <span className="font-mono">{Math.round(coverageOverlay.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={coverageOverlay.opacity}
                  onChange={(e) => setCoverageOverlay({ opacity: parseFloat(e.target.value) })}
                  className="w-full accent-violet"
                />
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border-subtle/50 text-[11px]">
                <span className="text-text-secondary">Highlight Dead Zones</span>
                <input
                  type="checkbox"
                  checked={coverageOverlay.showDeadZones}
                  onChange={(e) => setCoverageOverlay({ showDeadZones: e.target.checked })}
                  className="rounded border-border-strong accent-violet"
                />
              </div>
            </div>

            {/* Results Breakdown */}
            {coverageResult && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle space-y-2">
                  <div className="flex justify-between items-center text-xs font-semibold text-text-primary">
                    <span>Signal Quality Breakdown</span>
                    <span className="font-mono text-violet">
                      {coverageResult.coveragePercent.toFixed(1)}% Satisfied
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                        <span className="text-text-secondary">Excellent (&gt; -65 dBm)</span>
                      </div>
                      <span className="font-mono text-text-primary">
                        {coverageResult.includedCellCount > 0 && classCountMap.excellent
                          ? ((classCountMap.excellent.cellCount / coverageResult.includedCellCount) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]" />
                        <span className="text-text-secondary">Good (-65 to -75 dBm)</span>
                      </div>
                      <span className="font-mono text-text-primary">
                        {coverageResult.includedCellCount > 0 && classCountMap.good
                          ? ((classCountMap.good.cellCount / coverageResult.includedCellCount) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#F59E0B]" />
                        <span className="text-text-secondary">Fair (-75 to -85 dBm)</span>
                      </div>
                      <span className="font-mono text-text-primary">
                        {coverageResult.includedCellCount > 0 && classCountMap.fair
                          ? ((classCountMap.fair.cellCount / coverageResult.includedCellCount) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-sm bg-[#EF4444]" />
                        <span className="text-text-secondary">Poor (&lt; -85 dBm)</span>
                      </div>
                      <span className="font-mono text-text-primary">
                        {coverageResult.includedCellCount > 0 && classCountMap.poor
                          ? ((classCountMap.poor.cellCount / coverageResult.includedCellCount) * 100).toFixed(1)
                          : "0.0"}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dead Zones List */}
                {coverageResult.deadZones.length > 0 && (
                  <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 space-y-2">
                    <div className="flex items-center justify-between text-status-error">
                      <span className="font-semibold text-xs flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Dead Zones Detected
                      </span>
                      <span className="font-mono text-xs">{coverageResult.deadZones.length} areas</span>
                    </div>

                    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                      {coverageResult.deadZones.map((dz, idx) => (
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
                              className="text-[10px] text-violet hover:underline flex items-center gap-0.5"
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

            {/* Model Parameters Collapsible */}
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
                    <span>Grid Cell Resolution</span>
                    <span className="font-mono text-text-primary">{coverageSettings?.gridResolutionM ?? 5} m</span>
                  </div>

                  <div className="pt-2 border-t border-border-subtle">
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="w-full py-1 text-center text-violet hover:underline font-medium text-[11px]"
                    >
                      Edit Project Coverage Settings
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Disclaimer */}
            <div className="p-2 rounded bg-surface-panel/40 border border-border-subtle text-[10px] text-text-muted flex items-start gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-text-disabled" />
              <span>
                2D free-space and obstacle attenuation approximation. 3D floors and antenna lobe patterns are not modeled.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </aside>
  );
}
