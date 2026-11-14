import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import {
  GitCompare,
  Plus,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  DollarSign,
  Wifi,
  Activity,
  Layers,
} from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import { computeStructuralDiff, compareMetric } from "@/domain/comparison/compareDesigns";
import type {
  ProjectId,
  DesignId,
} from "@/contracts/primitives";
import type {
  Design,
  DesignAggregate,
} from "@/contracts/domain";
import type {
  AnalysisRecord,
  CostEstimate,
  CoverageResult,
  SimulationResult,
} from "@/contracts/engines";
import type { MetricComparison, StructuralDesignDiff } from "@/contracts/comparison";

interface DesignAnalysisBundle {
  cost: Extract<AnalysisRecord, { type: "cost" }> | null;
  coverage: Extract<AnalysisRecord, { type: "coverage" }> | null;
  simulation: Extract<AnalysisRecord, { type: "simulation" }> | null;
}

export function ComparisonView() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [designs, setDesigns] = useState<Design[]>([]);
  const [selectedDesignIdA, setSelectedDesignIdA] = useState<DesignId | null>(null);
  const [selectedDesignIdB, setSelectedDesignIdB] = useState<DesignId | null>(null);

  const [aggregateA, setAggregateA] = useState<DesignAggregate | null>(null);
  const [aggregateB, setAggregateB] = useState<DesignAggregate | null>(null);

  const [analysesA, setAnalysesA] = useState<DesignAnalysisBundle>({ cost: null, coverage: null, simulation: null });
  const [analysesB, setAnalysesB] = useState<DesignAnalysisBundle>({ cost: null, coverage: null, simulation: null });

  const [isLoading, setIsLoading] = useState(true);
  const [runningAnalysis, setRunningAnalysis] = useState<string | null>(null); // e.g. "A:cost"
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const container = getApplicationContainer();

  // Load project designs
  const loadDesigns = useCallback(async () => {
    if (!projectId) return;
    try {
      const list = await container.repos.designs.listByProject(projectId as ProjectId);
      setDesigns(list);

      const paramA = searchParams.get("a") as DesignId | null;
      const paramB = searchParams.get("b") as DesignId | null;

      const baseline = list.find((d) => d.isBaseline) ?? list[0];
      const alternative = list.find((d) => !d.isBaseline) ?? list[1];

      const initialA = (paramA && list.some((d) => d.id === paramA)) ? paramA : baseline?.id ?? null;
      let initialB = (paramB && list.some((d) => d.id === paramB)) ? paramB : alternative?.id ?? null;

      if (initialA && initialB && initialA === initialB && list.length > 1) {
        initialB = list.find((d) => d.id !== initialA)?.id ?? null;
      }

      setSelectedDesignIdA(initialA);
      setSelectedDesignIdB(initialB);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to load project designs");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, searchParams, container.repos.designs]);

  useEffect(() => {
    loadDesigns();
  }, [loadDesigns]);

  // Load aggregates and latest analysis records for Design A and B
  const loadDesignData = useCallback(async (designId: DesignId, setAgg: (agg: DesignAggregate | null) => void, setAna: (bundle: DesignAnalysisBundle) => void) => {
    try {
      const agg = await container.repos.designs.loadAggregate(designId);
      setAgg(agg);

      const [cost, coverage, simulation] = await Promise.all([
        container.repos.analyses.getLatest(designId, "cost"),
        container.repos.analyses.getLatest(designId, "coverage"),
        container.repos.analyses.getLatest(designId, "simulation"),
      ]);

      setAna({
        cost: (cost as Extract<AnalysisRecord, { type: "cost" }>) ?? null,
        coverage: (coverage as Extract<AnalysisRecord, { type: "coverage" }>) ?? null,
        simulation: (simulation as Extract<AnalysisRecord, { type: "simulation" }>) ?? null,
      });
    } catch (err) {
      console.error("Error loading design data:", err);
    }
  }, [container.repos.designs, container.repos.analyses]);

  useEffect(() => {
    if (selectedDesignIdA) {
      loadDesignData(selectedDesignIdA, setAggregateA, setAnalysesA);
    } else {
      setAggregateA(null);
      setAnalysesA({ cost: null, coverage: null, simulation: null });
    }
  }, [selectedDesignIdA, loadDesignData]);

  useEffect(() => {
    if (selectedDesignIdB) {
      loadDesignData(selectedDesignIdB, setAggregateB, setAnalysesB);
    } else {
      setAggregateB(null);
      setAnalysesB({ cost: null, coverage: null, simulation: null });
    }
  }, [selectedDesignIdB, loadDesignData]);

  // Update query params when selections change
  const handleSelectA = (id: DesignId) => {
    setSelectedDesignIdA(id);
    setSearchParams((prev) => {
      prev.set("a", id);
      return prev;
    });
  };

  const handleSelectB = (id: DesignId) => {
    setSelectedDesignIdB(id);
    setSearchParams((prev) => {
      prev.set("b", id);
      return prev;
    });
  };

  // Duplicate baseline to create alternative
  const handleDuplicateToCompare = async () => {
    if (!selectedDesignIdA) return;
    try {
      setIsLoading(true);
      const newDesignId = await container.projectService.duplicateDesign(
        selectedDesignIdA,
        "Alternative Design"
      );
      await loadDesigns();
      handleSelectB(newDesignId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to duplicate design");
    } finally {
      setIsLoading(false);
    }
  };

  // Targeted Run Analysis
  const handleRunAnalysis = async (target: "A" | "B", type: "cost" | "coverage" | "simulation") => {
    const targetId = target === "A" ? selectedDesignIdA : selectedDesignIdB;
    if (!targetId) return;

    const runKey = `${target}:${type}`;
    setRunningAnalysis(runKey);
    try {
      if (type === "cost") {
        await container.analysisCoordinator.run("cost", targetId);
      } else if (type === "coverage") {
        await container.analysisCoordinator.run("coverage", targetId);
      } else {
        await container.analysisCoordinator.run("simulation", targetId);
      }
      // Reload analyses for target design
      if (target === "A") {
        await loadDesignData(targetId, setAggregateA, setAnalysesA);
      } else {
        await loadDesignData(targetId, setAggregateB, setAnalysesB);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : `Failed to run ${type} analysis`);
    } finally {
      setRunningAnalysis(null);
    }
  };

  // Structural Diff
  const structuralDiff: StructuralDesignDiff | null = useMemo(() => {
    if (!aggregateA || !aggregateB) return null;
    return computeStructuralDiff(aggregateA, aggregateB);
  }, [aggregateA, aggregateB]);

  // Cost Metrics Comparison
  const costA: CostEstimate | undefined = analysesA.cost?.result;
  const costB: CostEstimate | undefined = analysesB.cost?.result;

  const costMetrics: MetricComparison[] = useMemo(() => {
    return [
      compareMetric(
        "capex",
        "Total CAPEX",
        "INR",
        costA ? (costA.capex.total ?? costA.capex.knownSubtotal).amount : null,
        costB ? (costB.capex.total ?? costB.capex.knownSubtotal).amount : null,
        "lowerIsBetter"
      ),
      compareMetric(
        "opex",
        "Annual OPEX",
        "INR",
        costA ? (costA.annualOpex.total ?? costA.annualOpex.knownSubtotal).amount : null,
        costB ? (costB.annualOpex.total ?? costB.annualOpex.knownSubtotal).amount : null,
        "lowerIsBetter"
      ),
      compareMetric(
        "tco",
        `TCO (${costA?.tcoHorizonYears ?? 3}-Year)`,
        "INR",
        costA ? (costA.tco.total ?? costA.tco.knownSubtotal).amount : null,
        costB ? (costB.tco.total ?? costB.tco.knownSubtotal).amount : null,
        "lowerIsBetter"
      ),
    ];
  }, [costA, costB]);

  // Coverage Metrics Comparison
  const covA: CoverageResult | undefined = analysesA.coverage?.result;
  const covB: CoverageResult | undefined = analysesB.coverage?.result;

  const coverageMetrics: MetricComparison[] = useMemo(() => {
    return [
      compareMetric(
        "coveragePercent",
        "Coverage Ratio",
        "%",
        covA ? covA.coveragePercent : null,
        covB ? covB.coveragePercent : null,
        "higherIsBetter"
      ),
      compareMetric(
        "deadZones",
        "Dead Zones Count",
        "count",
        covA ? covA.deadZones.length : null,
        covB ? covB.deadZones.length : null,
        "lowerIsBetter"
      ),
      compareMetric(
        "coveredCells",
        "Covered Grid Cells",
        "count",
        covA ? covA.coveredCellCount : null,
        covB ? covB.coveredCellCount : null,
        "higherIsBetter"
      ),
    ];
  }, [covA, covB]);

  // Simulation Metrics Comparison
  const simA: SimulationResult | undefined = analysesA.simulation?.result;
  const simB: SimulationResult | undefined = analysesB.simulation?.result;

  const simulationMetrics: MetricComparison[] = useMemo(() => {
    return [
      compareMetric(
        "reachableFlows",
        "Reachable Flows",
        "count",
        simA ? simA.baselineMetrics.reachableFlowCount : null,
        simB ? simB.baselineMetrics.reachableFlowCount : null,
        "higherIsBetter"
      ),
      compareMetric(
        "deliveredRate",
        "Aggregate Delivered Rate",
        "Mbps",
        simA ? simA.baselineMetrics.aggregateDeliveredRateMbps : null,
        simB ? simB.baselineMetrics.aggregateDeliveredRateMbps : null,
        "higherIsBetter"
      ),
      compareMetric(
        "meanLatency",
        "Mean Reachable Latency",
        "ms",
        simA ? simA.baselineMetrics.meanReachableLatencyMs : null,
        simB ? simB.baselineMetrics.meanReachableLatencyMs : null,
        "lowerIsBetter"
      ),
    ];
  }, [simA, simB]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-canvas text-text-secondary text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-violet" />
        Loading designs and cached analyses...
      </div>
    );
  }

  // Single Design Guard
  if (designs.length <= 1) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-canvas p-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-violet/10 text-violet flex items-center justify-center mb-4">
          <GitCompare className="w-6 h-6" />
        </div>
        <h2 className="text-base font-semibold text-text-primary">Design Comparison Requires Multiple Designs</h2>
        <p className="mt-2 text-xs text-text-muted max-w-md">
          This project currently has only one design ({designs[0]?.name ?? "Baseline"}). To evaluate trade-offs in cost, RF coverage, and network simulation, duplicate the baseline to create an alternative design.
        </p>
        <button
          onClick={handleDuplicateToCompare}
          className="mt-6 px-4 py-2 rounded-lg bg-violet text-carbon-deep text-xs font-semibold hover:bg-violet-hover shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Duplicate Design to Compare
        </button>
      </div>
    );
  }

  const designA = designs.find((d) => d.id === selectedDesignIdA);
  const designB = designs.find((d) => d.id === selectedDesignIdB);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-canvas overflow-y-auto">
      {/* Top Header Bar */}
      <div className="border-b border-border-subtle bg-surface-panel/80 px-6 py-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitCompare className="w-5 h-5 text-violet" />
            <div>
              <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Design Comparison
                <span className="text-xs px-2 py-0.5 rounded bg-surface-raised border border-border-subtle font-mono text-text-secondary">
                  Read-Only Trade-Off Analysis
                </span>
              </h1>
              <p className="text-[11px] text-text-muted">
                Side-by-side structural diff and multi-discipline engineering metric deltas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {designA && (
              <Link
                to={`/projects/${projectId}/designs/${designA.id}/map`}
                className="px-3 py-1.5 rounded-lg border border-border-strong text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5"
              >
                Open {designA.name} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
            {designB && (
              <Link
                to={`/projects/${projectId}/designs/${designB.id}/map`}
                className="px-3 py-1.5 rounded-lg border border-border-strong text-text-secondary hover:text-text-primary text-xs font-medium flex items-center gap-1.5"
              >
                Open {designB.name} <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Design Selectors Strip */}
        <div className="grid grid-cols-2 gap-6 bg-surface-canvas/60 p-3 rounded-lg border border-border-subtle">
          {/* Design A Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-violet w-16">Design A:</span>
            <select
              value={selectedDesignIdA ?? ""}
              onChange={(e) => handleSelectA(e.target.value as DesignId)}
              className="flex-1 px-3 py-1.5 bg-surface-panel border border-border-strong rounded text-xs font-medium text-text-primary"
            >
              {designs.map((d) => (
                <option key={d.id} value={d.id} disabled={d.id === selectedDesignIdB}>
                  {d.name} {d.isBaseline ? "(Baseline)" : ""}
                </option>
              ))}
            </select>
            {designA?.isBaseline && (
              <span className="text-[10px] bg-violet/15 text-violet px-2 py-0.5 rounded font-medium border border-violet/30">
                Baseline
              </span>
            )}
          </div>

          {/* Design B Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-[#38BDF8] w-16">Design B:</span>
            <select
              value={selectedDesignIdB ?? ""}
              onChange={(e) => handleSelectB(e.target.value as DesignId)}
              className="flex-1 px-3 py-1.5 bg-surface-panel border border-border-strong rounded text-xs font-medium text-text-primary"
            >
              {designs.map((d) => (
                <option key={d.id} value={d.id} disabled={d.id === selectedDesignIdA}>
                  {d.name} {d.isBaseline ? "(Baseline)" : ""}
                </option>
              ))}
            </select>
            {designB?.isBaseline && (
              <span className="text-[10px] bg-violet/15 text-violet px-2 py-0.5 rounded font-medium border border-violet/30">
                Baseline
              </span>
            )}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-status-error/15 border-b border-status-error/30 px-6 py-2 text-xs text-status-error flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-6 space-y-6 max-w-6xl w-full mx-auto">
        {/* Section 1: Structural Differences */}
        <div className="rounded-lg border border-border-subtle bg-surface-panel/40 overflow-hidden">
          <div className="px-4 py-3 bg-surface-panel border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
              <Layers className="w-4 h-4 text-violet" />
              1. Structural Equipment & Connectivity Diff
            </span>
            <span className="text-[11px] text-text-muted">
              Semantic comparison by equipment catalog item and coordinates
            </span>
          </div>

          <div className="p-4 space-y-4">
            {/* Counts Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-surface-canvas border border-border-subtle flex items-center justify-between text-xs">
                <span className="text-text-secondary">Total Devices</span>
                <div className="flex items-center gap-4 font-mono">
                  <span>A: <strong className="text-text-primary">{structuralDiff?.deviceCountA ?? 0}</strong></span>
                  <span>B: <strong className="text-text-primary">{structuralDiff?.deviceCountB ?? 0}</strong></span>
                  <span className={`font-bold ${(structuralDiff?.deviceCountB ?? 0) - (structuralDiff?.deviceCountA ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                    Δ {((structuralDiff?.deviceCountB ?? 0) - (structuralDiff?.deviceCountA ?? 0)) >= 0 ? "+" : ""}
                    {(structuralDiff?.deviceCountB ?? 0) - (structuralDiff?.deviceCountA ?? 0)}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-canvas border border-border-subtle flex items-center justify-between text-xs">
                <span className="text-text-secondary">Total Links</span>
                <div className="flex items-center gap-4 font-mono">
                  <span>A: <strong className="text-text-primary">{structuralDiff?.linkCountA ?? 0}</strong></span>
                  <span>B: <strong className="text-text-primary">{structuralDiff?.linkCountB ?? 0}</strong></span>
                  <span className={`font-bold ${(structuralDiff?.linkCountB ?? 0) - (structuralDiff?.linkCountA ?? 0) >= 0 ? "text-[#10B981]" : "text-[#EF4444]"}`}>
                    Δ {((structuralDiff?.linkCountB ?? 0) - (structuralDiff?.linkCountA ?? 0)) >= 0 ? "+" : ""}
                    {(structuralDiff?.linkCountB ?? 0) - (structuralDiff?.linkCountA ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Device Groups Breakdown Table */}
            {structuralDiff && structuralDiff.devices.length > 0 && (
              <div className="border border-border-subtle rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                    <tr>
                      <th className="py-2 px-3">Equipment / Type</th>
                      <th className="py-2 px-3">Coordinates (Lon, Lat)</th>
                      <th className="py-2 px-3 text-right">In Design A</th>
                      <th className="py-2 px-3 text-right">In Design B</th>
                      <th className="py-2 px-3 text-right">Delta (B - A)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                    {structuralDiff.devices.map((dg, idx) => (
                      <tr key={idx} className="hover:bg-surface-raised/30">
                        <td className="py-2 px-3 font-sans">
                          <span className="font-semibold text-text-primary capitalize">{dg.type}</span>
                          <span className="text-[10px] text-text-muted ml-2 font-mono">({dg.catalogItemId})</span>
                        </td>
                        <td className="py-2 px-3 text-text-muted text-[10px]">
                          {dg.position.coordinates[0].toFixed(5)}, {dg.position.coordinates[1].toFixed(5)}
                        </td>
                        <td className="py-2 px-3 text-right">{dg.countA}</td>
                        <td className="py-2 px-3 text-right">{dg.countB}</td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          dg.deltaBMinusA > 0 ? "text-[#10B981]" : dg.deltaBMinusA < 0 ? "text-[#EF4444]" : "text-text-muted"
                        }`}>
                          {dg.deltaBMinusA > 0 ? `+${dg.deltaBMinusA}` : dg.deltaBMinusA}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Cost Analysis Comparison */}
        <div className="rounded-lg border border-border-subtle bg-surface-panel/40 overflow-hidden">
          <div className="px-4 py-3 bg-surface-panel border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-violet" />
              2. Cost Estimation (CAPEX, OPEX, TCO)
            </span>
            <div className="flex items-center gap-3">
              {!costA && (
                <button
                  onClick={() => handleRunAnalysis("A", "cost")}
                  disabled={runningAnalysis === "A:cost"}
                  className="px-2.5 py-1 rounded bg-violet/15 text-violet hover:bg-violet/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "A:cost" ? "animate-spin" : ""}`} />
                  Run Cost for A
                </button>
              )}
              {!costB && (
                <button
                  onClick={() => handleRunAnalysis("B", "cost")}
                  disabled={runningAnalysis === "B:cost"}
                  className="px-2.5 py-1 rounded bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8]/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "B:cost" ? "animate-spin" : ""}`} />
                  Run Cost for B
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <MetricComparisonTable
              metrics={costMetrics}
              formatValue={(val) => (val !== null ? `₹${Math.round(val).toLocaleString()}` : "Not calculated")}
              formatDelta={(delta) => (delta !== null ? `₹${Math.round(delta).toLocaleString()}` : "—")}
            />
          </div>
        </div>

        {/* Section 3: Wireless RF Coverage Comparison */}
        <div className="rounded-lg border border-border-subtle bg-surface-panel/40 overflow-hidden">
          <div className="px-4 py-3 bg-surface-panel border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
              <Wifi className="w-4 h-4 text-violet" />
              3. Wireless RF Coverage & Dead Zones
            </span>
            <div className="flex items-center gap-3">
              {!covA && (
                <button
                  onClick={() => handleRunAnalysis("A", "coverage")}
                  disabled={runningAnalysis === "A:coverage"}
                  className="px-2.5 py-1 rounded bg-violet/15 text-violet hover:bg-violet/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "A:coverage" ? "animate-spin" : ""}`} />
                  Run Coverage for A
                </button>
              )}
              {!covB && (
                <button
                  onClick={() => handleRunAnalysis("B", "coverage")}
                  disabled={runningAnalysis === "B:coverage"}
                  className="px-2.5 py-1 rounded bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8]/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "B:coverage" ? "animate-spin" : ""}`} />
                  Run Coverage for B
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <MetricComparisonTable
              metrics={coverageMetrics}
              formatValue={(val, key) => {
                if (val === null) return "Not calculated";
                if (key === "coveragePercent") return `${val.toFixed(1)}%`;
                return val.toLocaleString();
              }}
              formatDelta={(delta, key) => {
                if (delta === null) return "—";
                if (key === "coveragePercent") return `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`;
                return `${delta >= 0 ? "+" : ""}${delta}`;
              }}
            />
          </div>
        </div>

        {/* Section 4: Network Simulation Comparison */}
        <div className="rounded-lg border border-border-subtle bg-surface-panel/40 overflow-hidden">
          <div className="px-4 py-3 bg-surface-panel border-b border-border-subtle flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet" />
              4. Network Simulation Performance (Baseline)
            </span>
            <div className="flex items-center gap-3">
              {!simA && (
                <button
                  onClick={() => handleRunAnalysis("A", "simulation")}
                  disabled={runningAnalysis === "A:simulation"}
                  className="px-2.5 py-1 rounded bg-violet/15 text-violet hover:bg-violet/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "A:simulation" ? "animate-spin" : ""}`} />
                  Run Simulation for A
                </button>
              )}
              {!simB && (
                <button
                  onClick={() => handleRunAnalysis("B", "simulation")}
                  disabled={runningAnalysis === "B:simulation"}
                  className="px-2.5 py-1 rounded bg-[#38BDF8]/15 text-[#38BDF8] hover:bg-[#38BDF8]/25 text-[11px] font-medium flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${runningAnalysis === "B:simulation" ? "animate-spin" : ""}`} />
                  Run Simulation for B
                </button>
              )}
            </div>
          </div>

          <div className="p-4">
            <MetricComparisonTable
              metrics={simulationMetrics}
              formatValue={(val, key) => {
                if (val === null) return "Not calculated";
                if (key === "deliveredRate") return `${val} Mbps`;
                if (key === "meanLatency") return `${val.toFixed(3)} ms`;
                return val.toLocaleString();
              }}
              formatDelta={(delta, key) => {
                if (delta === null) return "—";
                if (key === "deliveredRate") return `${delta >= 0 ? "+" : ""}${delta} Mbps`;
                if (key === "meanLatency") return `${delta >= 0 ? "+" : ""}${delta.toFixed(3)} ms`;
                return `${delta >= 0 ? "+" : ""}${delta}`;
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Reusable Metric Comparison Table
interface MetricTableProps {
  metrics: MetricComparison[];
  formatValue: (val: number | null, key: string) => string;
  formatDelta: (delta: number | null, key: string) => string;
}

function MetricComparisonTable({ metrics, formatValue, formatDelta }: MetricTableProps) {
  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface-raised border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
          <tr>
            <th className="py-2 px-3">Metric</th>
            <th className="py-2 px-3 text-right">Design A</th>
            <th className="py-2 px-3 text-right">Design B</th>
            <th className="py-2 px-3 text-right">Delta (B - A)</th>
            <th className="py-2 px-3 text-center">Favourable</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
          {metrics.map((m) => {
            const isBetterB = m.betterDesign === "B";
            const isBetterA = m.betterDesign === "A";
            const isTie = m.betterDesign === "tie";

            return (
              <tr key={m.key} className="hover:bg-surface-raised/30">
                <td className="py-2.5 px-3 font-sans font-medium text-text-primary">
                  {m.label}
                </td>
                <td className="py-2.5 px-3 text-right text-text-secondary">
                  {formatValue(m.valueA, m.key)}
                </td>
                <td className="py-2.5 px-3 text-right text-text-secondary">
                  {formatValue(m.valueB, m.key)}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-text-primary">
                  {formatDelta(m.deltaBMinusA, m.key)}
                </td>
                <td className="py-2.5 px-3 text-center font-sans">
                  {isBetterB && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/30">
                      Design B
                    </span>
                  )}
                  {isBetterA && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet bg-violet/10 px-2 py-0.5 rounded border border-violet/30">
                      Design A
                    </span>
                  )}
                  {isTie && (
                    <span className="text-[10px] text-text-muted">Tie</span>
                  )}
                  {m.betterDesign === "notComparable" && (
                    <span className="text-[10px] text-text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
