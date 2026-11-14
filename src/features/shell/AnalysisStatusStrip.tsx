import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IndianRupee,
  Radio,
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Sparkles,
  X,
} from "lucide-react";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getApplicationContainer } from "@/application/container";
import type { DesignId } from "@/contracts/primitives";
import type { CostEstimate, CoverageResult, SimulationResult } from "@/contracts/engines";

export function AnalysisStatusStrip() {
  const navigate = useNavigate();
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  const aggregate = useDesignStore((s) => s.aggregate);

  const costRecord = useAnalysisStore((s) => s.records.cost);
  const costStatus = useAnalysisStore((s) => s.status.cost);
  const costProgress = useAnalysisStore((s) => s.progress.cost);

  const coverageRecord = useAnalysisStore((s) => s.records.coverage);
  const coverageStatus = useAnalysisStore((s) => s.status.coverage);
  const coverageProgress = useAnalysisStore((s) => s.progress.coverage);

  const simulationRecord = useAnalysisStore((s) => s.records.simulation);
  const simulationStatus = useAnalysisStore((s) => s.status.simulation);
  const simulationProgress = useAnalysisStore((s) => s.progress.simulation);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRunningAction, setIsRunningAction] = useState<string | null>(null);

  // Cast typed results
  const costResult = costRecord?.result as CostEstimate | undefined;
  const coverageResult = coverageRecord?.result as CoverageResult | undefined;
  const simulationResult = simulationRecord?.result as SimulationResult | undefined;

  const devicesCount = Object.keys(aggregate?.devicesById ?? {}).length;
  const linksCount = Object.keys(aggregate?.linksById ?? {}).length;
  const hasAps = Object.values(aggregate?.devicesById ?? {}).some((d) => d.type === "accessPoint");
  const hasBoundary = Boolean(aggregate?.region.boundary && aggregate.region.boundary.coordinates.length > 0);
  const hasSubnets = Object.keys(aggregate?.subnetsById ?? {}).length > 0;
  const hasServers = Object.values(aggregate?.devicesById ?? {}).some((d) => d.type === "server");

  // Determine contextual next action
  const nextAction = useMemo(() => {
    if (!aggregate || devicesCount === 0) {
      return {
        prompt: "Design canvas empty. Place routers, switches, and APs to begin infrastructure planning.",
        buttonText: "Go to Map",
        action: () => navigate(`/projects/${projectId}/designs/${designId}/map`),
      };
    }

    if (linksCount === 0 && devicesCount > 1) {
      return {
        prompt: "Devices placed without interconnects. Connect devices using copper, fiber, or wireless links.",
        buttonText: "Connect Links",
        action: () => navigate(`/projects/${projectId}/designs/${designId}/map`),
      };
    }

    if (costStatus === "stale") {
      return {
        prompt: "Equipment inventory modified since last calculation. Recompute cost & TCO estimate.",
        buttonText: "Update Cost",
        action: async () => {
          if (!designId) return;
          setIsRunningAction("cost");
          try {
            await getApplicationContainer().analysisCoordinator.run("cost", designId as DesignId);
          } finally {
            setIsRunningAction(null);
          }
        },
      };
    }

    if (hasAps && hasBoundary && coverageStatus === "stale") {
      return {
        prompt: "Wireless APs or boundary modified. Recompute RF propagation coverage.",
        buttonText: "Update Coverage",
        action: async () => {
          if (!designId) return;
          setIsRunningAction("coverage");
          try {
            await getApplicationContainer().analysisCoordinator.run("coverage", designId as DesignId);
          } finally {
            setIsRunningAction(null);
          }
        },
      };
    }

    if (simulationStatus === "stale") {
      return {
        prompt: "Topology or links modified. Re-run shortest path routing simulation.",
        buttonText: "Update Simulation",
        action: async () => {
          if (!designId) return;
          setIsRunningAction("simulation");
          try {
            await getApplicationContainer().analysisCoordinator.run("simulation", designId as DesignId);
          } finally {
            setIsRunningAction(null);
          }
        },
      };
    }

    if (costStatus === "idle") {
      return {
        prompt: "Cost analysis has not been calculated for this bill of materials.",
        buttonText: "Calculate Cost",
        action: () => navigate(`/projects/${projectId}/designs/${designId}/cost`),
      };
    }

    if (hasAps && hasBoundary && coverageStatus === "idle") {
      return {
        prompt: "Access points present in region. Run wireless coverage to detect dead zones.",
        buttonText: "Run Coverage",
        action: async () => {
          if (!designId) return;
          setIsRunningAction("coverage");
          try {
            await getApplicationContainer().analysisCoordinator.run("coverage", designId as DesignId);
          } finally {
            setIsRunningAction(null);
          }
        },
      };
    }

    if (hasSubnets && hasServers && simulationStatus === "idle") {
      return {
        prompt: "Subnets and servers defined. Run network simulation to test reachability and latency.",
        buttonText: "Run Simulation",
        action: () => navigate(`/projects/${projectId}/designs/${designId}/simulation`),
      };
    }

    return {
      prompt: "All engineering analyses are current. Design is ready for documentation and export.",
      buttonText: "Open Report",
      action: () => navigate(`/projects/${projectId}/designs/${designId}/report`),
    };
  }, [
    aggregate,
    devicesCount,
    linksCount,
    costStatus,
    coverageStatus,
    simulationStatus,
    hasAps,
    hasBoundary,
    hasSubnets,
    hasServers,
    projectId,
    designId,
    navigate,
  ]);

  const renderStatusPill = (
    label: string,
    icon: React.ElementType,
    status: string,
    progress: number,
    lensPath: string
  ) => {
    const Icon = icon;
    let badgeClass = "text-text-muted border-border-subtle bg-surface-panel";
    let statusText = "Uncomputed";
    let StatusIcon = Clock;

    if (status === "computing") {
      badgeClass = "text-violet border-violet/40 bg-violet/10 animate-pulse";
      statusText = progress > 0 && progress < 1 ? `${Math.round(progress * 100)}%` : "Running...";
      StatusIcon = Loader2;
    } else if (status === "fresh") {
      badgeClass = "text-status-success border-status-success/30 bg-status-success/10";
      statusText = "Current";
      StatusIcon = CheckCircle2;
    } else if (status === "stale") {
      badgeClass = "text-status-warning border-status-warning/30 bg-status-warning/10";
      statusText = "Out of date";
      StatusIcon = AlertTriangle;
    }

    return (
      <button
        type="button"
        onClick={() => navigate(lensPath)}
        title={`${label}: ${statusText}. Click to open lens.`}
        className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium transition-colors hover:brightness-110 select-none ${badgeClass}`}
      >
        <Icon className="w-3 h-3" />
        <span className="font-semibold">{label}:</span>
        <span className="flex items-center gap-1">
          <StatusIcon className={`w-2.5 h-2.5 ${status === "computing" ? "animate-spin" : ""}`} />
          <span>{statusText}</span>
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Persistent Status Strip Bar */}
      <footer className="h-9 border-t border-border-subtle bg-surface-raised px-3 flex items-center justify-between text-xs select-none shrink-0 z-30">
        {/* Left: Engineering Analysis Status Chips */}
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted hidden sm:inline">
            Status:
          </span>

          {renderStatusPill(
            "Cost",
            IndianRupee,
            costStatus,
            costProgress,
            `/projects/${projectId}/designs/${designId}/cost`
          )}

          {renderStatusPill(
            "Coverage",
            Radio,
            coverageStatus,
            coverageProgress,
            `/projects/${projectId}/designs/${designId}/map`
          )}

          {renderStatusPill(
            "Simulation",
            Activity,
            simulationStatus,
            simulationProgress,
            `/projects/${projectId}/designs/${designId}/simulation`
          )}
        </div>

        {/* Center: Contextual Next Action Guidance */}
        <div className="hidden lg:flex items-center gap-2 max-w-xl truncate text-[11px]">
          <span className="w-1.5 h-1.5 rounded-full bg-violet shrink-0" />
          <span className="text-text-secondary truncate">{nextAction.prompt}</span>
          <button
            onClick={nextAction.action}
            disabled={Boolean(isRunningAction)}
            className="text-violet hover:text-violet-hover hover:underline font-semibold flex items-center gap-1 shrink-0"
          >
            {isRunningAction ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <span>{nextAction.buttonText}</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
        </div>

        {/* Right: Drawer toggle */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-surface-elevated text-[11px] text-text-muted hover:text-text-primary transition-colors border border-transparent hover:border-border-subtle"
            title="Toggle Detailed Analysis Drawer"
          >
            <span className="hidden sm:inline">Details</span>
            {isDrawerOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </footer>

      {/* Expandable Details Drawer */}
      {isDrawerOpen && (
        <div className="border-t border-border-strong bg-surface-raised p-4 max-h-64 overflow-y-auto animate-in slide-in-from-bottom duration-150 z-20 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-border-subtle mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-violet" />
              <h4 className="font-semibold text-xs text-text-primary">Engineering Analysis Breakdown</h4>
              <span className="text-[11px] text-text-muted">
                (Deterministic client-side models • Zero cloud dependencies)
              </span>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Cost Card */}
            <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                  <IndianRupee className="w-3.5 h-3.5 text-violet" />
                  <span>Cost Estimation</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                    costStatus === "fresh"
                      ? "text-status-success bg-status-success/10 border border-status-success/30"
                      : costStatus === "stale"
                      ? "text-status-warning bg-status-warning/10 border border-status-warning/30"
                      : "text-text-muted bg-surface-canvas border border-border-subtle"
                  }`}
                >
                  {costStatus}
                </span>
              </div>

              {costResult ? (
                <div className="space-y-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>CAPEX Subtotal:</span>
                    <span className="font-mono text-text-primary">
                      ₹{(costResult.capex.total?.amount ?? costResult.capex.knownSubtotal.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>5-Yr TCO:</span>
                    <span className="font-mono text-text-primary font-bold">
                      ₹{(costResult.tco.total?.amount ?? costResult.tco.knownSubtotal.amount).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted pt-1 border-t border-border-subtle">
                    <span>Line items:</span>
                    <span className="font-mono">{costResult.lineItems.length} items</span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted italic">No cost estimate computed yet.</p>
              )}

              <button
                onClick={() => navigate(`/projects/${projectId}/designs/${designId}/cost`)}
                className="w-full mt-2 py-1 text-center rounded bg-surface-elevated hover:bg-slate-elevated border border-border-subtle text-[11px] font-medium text-text-primary transition-colors"
              >
                Open Cost Workbench →
              </button>
            </div>

            {/* Coverage Card */}
            <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                  <Radio className="w-3.5 h-3.5 text-violet" />
                  <span>Wireless Coverage</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                    coverageStatus === "fresh"
                      ? "text-status-success bg-status-success/10 border border-status-success/30"
                      : coverageStatus === "stale"
                      ? "text-status-warning bg-status-warning/10 border border-status-warning/30"
                      : "text-text-muted bg-surface-canvas border border-border-subtle"
                  }`}
                >
                  {coverageStatus}
                </span>
              </div>

              {coverageResult ? (
                <div className="space-y-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Active APs:</span>
                    <span className="font-mono text-text-primary">
                      {Object.values(aggregate?.devicesById ?? {}).filter((d) => d.type === "accessPoint").length} APs
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Dead Zones:</span>
                    <span
                      className={`font-mono font-semibold ${
                        coverageResult.deadZones.length > 0 ? "text-status-error" : "text-status-success"
                      }`}
                    >
                      {coverageResult.deadZones.length} detected
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted pt-1 border-t border-border-subtle">
                    <span>Grid dimension:</span>
                    <span className="font-mono">
                      {coverageResult.grid.width} × {coverageResult.grid.height} cells
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted italic">
                  {hasAps ? "Ready to simulate RF propagation." : "Place access points to enable coverage."}
                </p>
              )}

              <button
                onClick={() => navigate(`/projects/${projectId}/designs/${designId}/map`)}
                className="w-full mt-2 py-1 text-center rounded bg-surface-elevated hover:bg-slate-elevated border border-border-subtle text-[11px] font-medium text-text-primary transition-colors"
              >
                Inspect on Map →
              </button>
            </div>

            {/* Simulation Card */}
            <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                  <Activity className="w-3.5 h-3.5 text-violet" />
                  <span>Simulation &amp; SPF</span>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                    simulationStatus === "fresh"
                      ? "text-status-success bg-status-success/10 border border-status-success/30"
                      : simulationStatus === "stale"
                      ? "text-status-warning bg-status-warning/10 border border-status-warning/30"
                      : "text-text-muted bg-surface-canvas border border-border-subtle"
                  }`}
                >
                  {simulationStatus}
                </span>
              </div>

              {simulationResult ? (
                <div className="space-y-1 text-[11px] text-text-secondary">
                  <div className="flex justify-between">
                    <span>Baseline Flows:</span>
                    <span className="font-mono text-text-primary">
                      {simulationResult.baselineFlows.length} flows
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Reachability:</span>
                    <span className="font-mono text-text-primary font-semibold">
                      {simulationResult.baselineFlows.filter((f) => f.reachable).length} /{" "}
                      {simulationResult.baselineFlows.length} reachable
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] text-text-muted pt-1 border-t border-border-subtle">
                    <span>Mean Latency:</span>
                    <span className="font-mono">
                      {simulationResult.baselineMetrics.meanReachableLatencyMs !== null
                        ? `${simulationResult.baselineMetrics.meanReachableLatencyMs.toFixed(2)} ms`
                        : "—"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-text-muted italic">No traffic flows simulated yet.</p>
              )}

              <button
                onClick={() => navigate(`/projects/${projectId}/designs/${designId}/simulation`)}
                className="w-full mt-2 py-1 text-center rounded bg-surface-elevated hover:bg-slate-elevated border border-border-subtle text-[11px] font-medium text-text-primary transition-colors"
              >
                Open Simulation →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
