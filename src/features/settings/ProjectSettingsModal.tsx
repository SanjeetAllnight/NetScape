import React, { useState } from "react";
import { X, Sliders, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApplicationContainer } from "@/application/container";
import { useDesignStore } from "@/stores/designStore";
import type { ProjectSettings } from "@/contracts/domain";

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSettingsModal({ isOpen, onClose }: ProjectSettingsModalProps) {
  const aggregate = useDesignStore((s) => s.aggregate);
  const currentSettings = aggregate?.project.settings;

  const [activeTab, setActiveTab] = useState<"cost" | "coverage" | "simulation">("cost");
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Cost settings
  const [cableSlackPct, setCableSlackPct] = useState(currentSettings?.cost.cableSlackPct ?? 15);
  const [maintenancePct, setMaintenancePct] = useState(currentSettings?.cost.maintenanceRatePctPerYear ?? 7.5);
  const [contingencyPct, setContingencyPct] = useState(currentSettings?.cost.contingencyRatePct ?? 12.5);
  const [tcoHorizonYears, setTcoHorizonYears] = useState(currentSettings?.cost.tcoHorizonYears ?? 5);

  // Coverage settings
  const [gridResolutionM, setGridResolutionM] = useState(currentSettings?.coverage.gridResolutionM ?? 5);
  const [pathLossExponent, setPathLossExponent] = useState(currentSettings?.coverage.pathLossExponent ?? 3);
  const [minRssi, setMinRssi] = useState(currentSettings?.coverage.minimumAcceptableRssiDbm ?? -75);

  // Simulation settings
  const [perHostDemandMbps, setPerHostDemandMbps] = useState(currentSettings?.simulation.perHostDemandMbps ?? 5);

  if (!isOpen || !aggregate) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedSuccess(false);

    try {
      const container = getApplicationContainer();
      const patch: Partial<ProjectSettings> = {
        cost: {
          ...aggregate.project.settings.cost,
          cableSlackPct: Number(cableSlackPct),
          maintenanceRatePctPerYear: Number(maintenancePct),
          contingencyRatePct: Number(contingencyPct),
          tcoHorizonYears: Number(tcoHorizonYears),
        },
        coverage: {
          ...aggregate.project.settings.coverage,
          gridResolutionM: Number(gridResolutionM),
          pathLossExponent: Number(pathLossExponent),
          minimumAcceptableRssiDbm: Number(minRssi),
        },
        simulation: {
          ...aggregate.project.settings.simulation,
          perHostDemandMbps: Number(perHostDemandMbps),
        },
      };

      await container.projectService.updateProjectSettings(aggregate.project.id, patch);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update project settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-surface-raised border border-border-strong rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet" />
            <h2 className="text-base font-semibold text-text-primary">Project Engineering Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-panel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-border-subtle bg-surface-panel px-6 pt-2 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab("cost")}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === "cost"
                ? "border-violet text-violet"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Cost Engine
          </button>
          <button
            onClick={() => setActiveTab("coverage")}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === "coverage"
                ? "border-violet text-violet"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Wireless Coverage
          </button>
          <button
            onClick={() => setActiveTab("simulation")}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === "simulation"
                ? "border-violet text-violet"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            Simulation
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {activeTab === "cost" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Cable Slack (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={cableSlackPct}
                    onChange={(e) => setCableSlackPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Annual Maintenance (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={maintenancePct}
                    onChange={(e) => setMaintenancePct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Contingency Rate (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={contingencyPct}
                    onChange={(e) => setContingencyPct(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">TCO Horizon (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={tcoHorizonYears}
                    onChange={(e) => setTcoHorizonYears(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3 bg-surface-panel rounded border border-border-subtle text-[11px] text-text-muted">
                Cost currency is locked to INR. Settings apply across all designs in this project.
              </div>
            </div>
          )}

          {activeTab === "coverage" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary mb-1">Grid Resolution (m)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={gridResolutionM}
                    onChange={(e) => setGridResolutionM(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary mb-1">Path Loss Exponent (n)</label>
                  <input
                    type="number"
                    min="1.5"
                    max="5"
                    step="0.1"
                    value={pathLossExponent}
                    onChange={(e) => setPathLossExponent(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary mb-1">Min Acceptable RSSI (dBm)</label>
                <input
                  type="number"
                  min="-100"
                  max="-40"
                  value={minRssi}
                  onChange={(e) => setMinRssi(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                />
              </div>

              <div className="p-3 bg-surface-panel rounded border border-border-subtle text-[11px] text-text-muted">
                Lower grid resolution produces finer rasters but increases compute time. Max planning extent is 20 km.
              </div>
            </div>
          )}

          {activeTab === "simulation" && (
            <div className="space-y-4">
              <div>
                <label className="block text-text-secondary mb-1">Default Per-Host Demand (Mbps)</label>
                <input
                  type="number"
                  min="0.1"
                  max="1000"
                  step="0.5"
                  value={perHostDemandMbps}
                  onChange={(e) => setPerHostDemandMbps(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-violet focus:outline-none"
                />
              </div>

              <div className="p-3 bg-surface-panel rounded border border-border-subtle text-[11px] text-text-muted">
                Simulation uses deterministic shortest-path routing and latency calculations based on physical propagation speed and transmission rates.
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-border-subtle flex items-center justify-between">
            {savedSuccess ? (
              <span className="text-status-success flex items-center gap-1 font-medium">
                <Check className="w-3.5 h-3.5" />
                Settings saved!
              </span>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isSaving}>
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Settings"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

