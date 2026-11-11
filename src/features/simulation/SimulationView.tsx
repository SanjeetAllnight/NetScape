import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  Play,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ShieldAlert,
  Cpu,
  Info,
  Trash2,
  Plus,
} from "lucide-react";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getApplicationContainer } from "@/application/container";
import type {
  DesignId,
  FlowId,
  FailureScenarioId,
  SubnetId,
  DeviceId,
  LinkId,
} from "@/contracts/primitives";
import type {
  AnalysisRecord,
  SimulationResult,
  SimulationFlowResult,
  NetworkMetrics,
} from "@/contracts/engines";
import type { SimulationFlow, FailureScenario } from "@/contracts/domain";

export function SimulationView() {
  const { designId } = useParams<{ designId: string }>();
  const aggregate = useDesignStore((s) => s.aggregate);

  const simulationRecord = useAnalysisStore(
    (s) => s.records.simulation as (Extract<AnalysisRecord, { type: "simulation" }>) | null
  );
  const simulationStatus = useAnalysisStore((s) => s.status.simulation);
  const simulationProgress = useAnalysisStore((s) => s.progress.simulation);
  const simulationError = useAnalysisStore((s) => s.errors.simulation);

  // Active scenario selection: "baseline" or scenarioId
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("baseline");
  // Selected flow for details rail
  const [selectedFlowId, setSelectedFlowId] = useState<FlowId | null>(null);

  // Setup form states
  const [leftTab, setLeftTab] = useState<"flows" | "scenarios">("flows");
  const [isAddingFlow, setIsAddingFlow] = useState(false);
  const [isAddingScenario, setIsAddingScenario] = useState(false);

  // New flow inputs
  const [newFlowSubnetId, setNewFlowSubnetId] = useState<string>("");
  const [newFlowDestServerId, setNewFlowDestServerId] = useState<string>("");
  const [newFlowDemandOverride, setNewFlowDemandOverride] = useState<string>("");

  // New scenario inputs
  const [newScenarioName, setNewScenarioName] = useState<string>("");
  const [newScenarioFailedDeviceIds, setNewScenarioFailedDeviceIds] = useState<DeviceId[]>([]);
  const [newScenarioFailedLinkIds, setNewScenarioFailedLinkIds] = useState<LinkId[]>([]);

  const container = getApplicationContainer();
  const result: SimulationResult | undefined = simulationRecord?.result;

  const currentSetup = aggregate?.design.simulationSetup ?? { flows: [], failureScenarios: [] };
  const subnets = useMemo(() => Object.values(aggregate?.subnetsById ?? {}), [aggregate?.subnetsById]);
  const servers = useMemo(
    () => Object.values(aggregate?.devicesById ?? {}).filter((d) => d.type === "server"),
    [aggregate?.devicesById]
  );
  const allDevices = useMemo(() => Object.values(aggregate?.devicesById ?? {}), [aggregate?.devicesById]);
  const allLinks = useMemo(() => Object.values(aggregate?.linksById ?? {}), [aggregate?.linksById]);

  // Execute simulation
  const handleRun = async () => {
    if (!designId) return;
    try {
      await container.analysisCoordinator.run("simulation", designId as DesignId);
    } catch {
      // Error handled in Zustand
    }
  };

  const handleCancel = async () => {
    if (!designId) return;
    await container.analysisCoordinator.cancel("simulation", designId as DesignId);
  };

  // Add flow
  const handleCreateFlow = () => {
    if (!newFlowSubnetId || !newFlowDestServerId) return;
    const sub = aggregate?.subnetsById[newFlowSubnetId as SubnetId];
    const srv = aggregate?.devicesById[newFlowDestServerId as DeviceId];
    if (!sub || !srv) return;

    const newFlow: SimulationFlow = {
      id: `flow_${Date.now()}` as FlowId,
      name: `${sub.name} -> ${srv.name}`,
      sourceSubnetId: sub.id,
      destinationDeviceId: srv.id,
      demandMbpsOverride: newFlowDemandOverride ? Number(newFlowDemandOverride) : null,
      enabled: true,
    };

    container.designSession.dispatch({
      type: "simulation/setup",
      setup: {
        ...currentSetup,
        flows: [...currentSetup.flows, newFlow],
      },
    });

    setIsAddingFlow(false);
    setNewFlowSubnetId("");
    setNewFlowDestServerId("");
    setNewFlowDemandOverride("");
  };

  // Delete flow
  const handleDeleteFlow = (flowId: FlowId) => {
    container.designSession.dispatch({
      type: "simulation/setup",
      setup: {
        ...currentSetup,
        flows: currentSetup.flows.filter((f) => f.id !== flowId),
      },
    });
    if (selectedFlowId === flowId) {
      setSelectedFlowId(null);
    }
  };

  // Add scenario
  const handleCreateScenario = () => {
    if (!newScenarioName.trim()) return;

    const newScenario: FailureScenario = {
      id: `scen_${Date.now()}` as FailureScenarioId,
      name: newScenarioName.trim(),
      failedDeviceIds: newScenarioFailedDeviceIds,
      failedLinkIds: newScenarioFailedLinkIds,
    };

    container.designSession.dispatch({
      type: "simulation/setup",
      setup: {
        ...currentSetup,
        failureScenarios: [...currentSetup.failureScenarios, newScenario],
      },
    });

    setIsAddingScenario(false);
    setNewScenarioName("");
    setNewScenarioFailedDeviceIds([]);
    setNewScenarioFailedLinkIds([]);
  };

  // Delete scenario
  const handleDeleteScenario = (scenId: FailureScenarioId) => {
    container.designSession.dispatch({
      type: "simulation/setup",
      setup: {
        ...currentSetup,
        failureScenarios: currentSetup.failureScenarios.filter((s) => s.id !== scenId),
      },
    });
    if (selectedScenarioId === scenId) {
      setSelectedScenarioId("baseline");
    }
  };

  // Active scenario metrics & flows
  const activeMetrics: NetworkMetrics | undefined = useMemo(() => {
    if (!result) return undefined;
    if (selectedScenarioId === "baseline") {
      return result.baselineMetrics;
    }
    const scen = result.scenarios.find((s) => s.scenarioId === selectedScenarioId);
    return scen?.metrics;
  }, [result, selectedScenarioId]);

  const activeFlowResults: SimulationFlowResult[] = useMemo(() => {
    if (!result) return [];
    if (selectedScenarioId === "baseline") {
      return result.baselineFlows;
    }
    const scen = result.scenarios.find((s) => s.scenarioId === selectedScenarioId);
    return scen?.flowResults ?? [];
  }, [result, selectedScenarioId]);

  // Selected flow result
  const activeSelectedFlow = useMemo(() => {
    if (!selectedFlowId) return activeFlowResults[0] ?? null;
    return activeFlowResults.find((f) => f.flowId === selectedFlowId) ?? activeFlowResults[0] ?? null;
  }, [activeFlowResults, selectedFlowId]);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-canvas overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 border-b border-border-subtle bg-surface-panel/80 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-brand-electric" />
          <div>
            <h1 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              Network Simulation
              <span className="text-xs px-2 py-0.5 rounded bg-surface-raised border border-border-subtle font-mono text-text-secondary">
                {aggregate?.design.name ?? "Design"}
              </span>
            </h1>
            <p className="text-[11px] text-text-muted">
              Undirected Dijkstra routing, hop latency, and failure scenario evaluation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {simulationStatus === "computing" ? (
            <button
              onClick={handleCancel}
              className="px-3 py-1.5 rounded-lg border border-status-error/40 text-status-error text-xs font-medium hover:bg-status-error/10 flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Cancel ({Math.round(simulationProgress * 100)}%)
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="px-4 py-1.5 rounded-lg bg-brand-electric text-text-inverse text-xs font-semibold hover:bg-brand-electric/90 shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Run Simulation
            </button>
          )}

          {/* Freshness Badge */}
          {simulationStatus === "fresh" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#10B981] bg-[#10B981]/10 px-2 py-0.5 rounded border border-[#10B981]/30">
              <CheckCircle2 className="w-3 h-3" />
              Current
            </span>
          )}
          {simulationStatus === "stale" && (
            <span className="inline-flex items-center gap-1 text-[11px] text-[#F59E0B] bg-[#F59E0B]/10 px-2 py-0.5 rounded border border-[#F59E0B]/30">
              <Clock className="w-3 h-3" />
              Out of date
            </span>
          )}
          {simulationStatus === "idle" && !result && (
            <span className="text-[11px] text-text-muted bg-surface-raised px-2 py-0.5 rounded border border-border-subtle">
              Not calculated
            </span>
          )}
        </div>
      </div>

      {/* Assumptions and Model Limitations Bar */}
      <div className="bg-surface-raised/60 border-b border-border-subtle px-6 py-2 flex items-center justify-between text-[11px] text-text-secondary">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-brand-electric flex-shrink-0" />
          <span>
            <strong className="text-text-primary">Model Assumptions:</strong> 1500-byte packets • 1 ms processing delay per intermediate hop • {aggregate?.project.settings.simulation.perHostDemandMbps ?? 5} Mbps per host default.
          </span>
        </div>
        <div className="flex items-center gap-1 text-text-muted text-[10px]">
          <span>M/M/1 queueing buffer delays unmodelled</span>
        </div>
      </div>

      {/* In-flight Progress Bar */}
      {simulationStatus === "computing" && (
        <div className="w-full bg-surface-canvas h-1">
          <div
            className="bg-brand-electric h-1 transition-all duration-300"
            style={{ width: `${Math.max(5, simulationProgress * 100)}%` }}
          />
        </div>
      )}

      {/* Error Banner */}
      {simulationError && (
        <div className="bg-status-error/15 border-b border-status-error/30 px-6 py-2 text-xs text-status-error flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{simulationError}</span>
        </div>
      )}

      {/* Main 3-Column Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Rail (28%): Setup Configuration (Flows & Scenarios) */}
        <div className="w-[28%] border-r border-border-subtle flex flex-col bg-surface-panel/40 overflow-hidden">
          {/* Rail Tabs */}
          <div className="flex border-b border-border-subtle bg-surface-panel text-xs">
            <button
              onClick={() => setLeftTab("flows")}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                leftTab === "flows"
                  ? "border-brand-electric text-text-primary bg-surface-canvas/50"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Traffic Flows ({currentSetup.flows.length})
            </button>
            <button
              onClick={() => setLeftTab("scenarios")}
              className={`flex-1 py-2.5 font-medium border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                leftTab === "scenarios"
                  ? "border-brand-electric text-text-primary bg-surface-canvas/50"
                  : "border-transparent text-text-secondary hover:text-text-primary"
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Failure Scenarios ({currentSetup.failureScenarios.length})
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {leftTab === "flows" ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Configured Flows</span>
                  {!isAddingFlow && (
                    <button
                      onClick={() => setIsAddingFlow(true)}
                      className="px-2 py-1 rounded bg-brand-electric/15 text-brand-electric hover:bg-brand-electric/25 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Flow
                    </button>
                  )}
                </div>

                {/* Add Flow Form */}
                {isAddingFlow && (
                  <div className="p-3 rounded-lg border border-brand-electric/40 bg-surface-raised space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-text-primary">
                      <span>Define Traffic Flow</span>
                      <button
                        onClick={() => setIsAddingFlow(false)}
                        className="text-text-muted hover:text-text-primary"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">Source Subnet</label>
                      <select
                        value={newFlowSubnetId}
                        onChange={(e) => setNewFlowSubnetId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-surface-canvas border border-border-strong rounded text-text-primary text-xs"
                      >
                        <option value="">Select Subnet...</option>
                        {subnets.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name} ({sub.hostsRequired} hosts)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">Destination Server</label>
                      <select
                        value={newFlowDestServerId}
                        onChange={(e) => setNewFlowDestServerId(e.target.value)}
                        className="w-full px-2 py-1.5 bg-surface-canvas border border-border-strong rounded text-text-primary text-xs"
                      >
                        <option value="">Select Server...</option>
                        {servers.map((srv) => (
                          <option key={srv.id} value={srv.id}>
                            {srv.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">
                        Demand Override (Mbps, optional)
                      </label>
                      <input
                        type="number"
                        placeholder="Leave blank for hosts × perHostDemand"
                        value={newFlowDemandOverride}
                        onChange={(e) => setNewFlowDemandOverride(e.target.value)}
                        className="w-full px-2 py-1 bg-surface-canvas border border-border-strong rounded text-text-primary font-mono text-xs"
                      />
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsAddingFlow(false)}
                        className="px-2.5 py-1 text-text-secondary hover:text-text-primary text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateFlow}
                        disabled={!newFlowSubnetId || !newFlowDestServerId}
                        className="px-3 py-1 bg-brand-electric text-text-inverse font-medium rounded text-xs disabled:opacity-50"
                      >
                        Save Flow
                      </button>
                    </div>
                  </div>
                )}

                {/* Flows List */}
                {currentSetup.flows.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-border-strong text-center text-xs text-text-muted space-y-1">
                    <p>No explicit flows configured.</p>
                    <p className="text-[10px]">
                      Defaults will be auto-derived between subnets and server endpoints during simulation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentSetup.flows.map((flow) => {
                      const sub = aggregate?.subnetsById[flow.sourceSubnetId];
                      const srv = aggregate?.devicesById[flow.destinationDeviceId];
                      return (
                        <div
                          key={flow.id}
                          className="p-2.5 rounded-lg border border-border-subtle bg-surface-canvas flex items-center justify-between text-xs"
                        >
                          <div className="space-y-0.5 min-w-0 pr-2">
                            <span className="font-semibold text-text-primary block truncate">
                              {flow.name || `${sub?.name ?? "Subnet"} -> ${srv?.name ?? "Server"}`}
                            </span>
                            <span className="text-[10px] text-text-muted block truncate font-mono">
                              {sub?.name ?? flow.sourceSubnetId} &rarr; {srv?.name ?? flow.destinationDeviceId}
                            </span>
                            <span className="text-[10px] text-brand-electric font-mono">
                              {flow.demandMbpsOverride
                                ? `${flow.demandMbpsOverride} Mbps (override)`
                                : `${(sub?.hostsRequired ?? 1) * (aggregate?.project.settings.simulation.perHostDemandMbps ?? 5)} Mbps`}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDeleteFlow(flow.id)}
                            className="text-text-muted hover:text-status-error p-1 rounded"
                            title="Delete flow"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Failure Scenarios</span>
                  {!isAddingScenario && (
                    <button
                      onClick={() => setIsAddingScenario(true)}
                      className="px-2 py-1 rounded bg-brand-electric/15 text-brand-electric hover:bg-brand-electric/25 text-[11px] font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Scenario
                    </button>
                  )}
                </div>

                {/* Add Scenario Form */}
                {isAddingScenario && (
                  <div className="p-3 rounded-lg border border-brand-electric/40 bg-surface-raised space-y-2.5 text-xs">
                    <div className="flex items-center justify-between font-semibold text-text-primary">
                      <span>Define Failure Scenario</span>
                      <button
                        onClick={() => setIsAddingScenario(false)}
                        className="text-text-muted hover:text-text-primary"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">Scenario Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Core Switch Failure"
                        value={newScenarioName}
                        onChange={(e) => setNewScenarioName(e.target.value)}
                        className="w-full px-2 py-1 bg-surface-canvas border border-border-strong rounded text-text-primary text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">
                        Select Failed Devices ({newScenarioFailedDeviceIds.length})
                      </label>
                      <div className="max-h-24 overflow-y-auto space-y-1 bg-surface-canvas border border-border-strong rounded p-1.5 text-[11px]">
                        {allDevices.map((dev) => {
                          const checked = newScenarioFailedDeviceIds.includes(dev.id);
                          return (
                            <label key={dev.id} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewScenarioFailedDeviceIds([...newScenarioFailedDeviceIds, dev.id]);
                                  } else {
                                    setNewScenarioFailedDeviceIds(
                                      newScenarioFailedDeviceIds.filter((id) => id !== dev.id)
                                    );
                                  }
                                }}
                                className="rounded accent-brand-electric"
                              />
                              <span className="truncate">{dev.name} ({dev.type})</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-text-secondary block mb-1">
                        Select Failed Links ({newScenarioFailedLinkIds.length})
                      </label>
                      <div className="max-h-24 overflow-y-auto space-y-1 bg-surface-canvas border border-border-strong rounded p-1.5 text-[11px]">
                        {allLinks.map((link) => {
                          const checked = newScenarioFailedLinkIds.includes(link.id);
                          const s = aggregate?.devicesById[link.sourceDeviceId]?.name ?? link.sourceDeviceId;
                          const t = aggregate?.devicesById[link.targetDeviceId]?.name ?? link.targetDeviceId;
                          return (
                            <label key={link.id} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewScenarioFailedLinkIds([...newScenarioFailedLinkIds, link.id]);
                                  } else {
                                    setNewScenarioFailedLinkIds(
                                      newScenarioFailedLinkIds.filter((id) => id !== link.id)
                                    );
                                  }
                                }}
                                className="rounded accent-brand-electric"
                              />
                              <span className="truncate font-mono text-[10px]">{s} &harr; {t}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsAddingScenario(false)}
                        className="px-2.5 py-1 text-text-secondary hover:text-text-primary text-xs"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateScenario}
                        disabled={!newScenarioName.trim()}
                        className="px-3 py-1 bg-brand-electric text-text-inverse font-medium rounded text-xs disabled:opacity-50"
                      >
                        Save Scenario
                      </button>
                    </div>
                  </div>
                )}

                {/* Scenarios List */}
                {currentSetup.failureScenarios.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-border-strong text-center text-xs text-text-muted space-y-1">
                    <p>No failure scenarios configured.</p>
                    <p className="text-[10px]">
                      Simulation will evaluate baseline normal operation only.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentSetup.failureScenarios.map((scen) => (
                      <div
                        key={scen.id}
                        className="p-2.5 rounded-lg border border-border-subtle bg-surface-canvas flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5 min-w-0 pr-2">
                          <span className="font-semibold text-text-primary block truncate">
                            {scen.name}
                          </span>
                          <span className="text-[10px] text-text-muted block">
                            Failed: {scen.failedDeviceIds.length} devices, {scen.failedLinkIds.length} links
                          </span>
                        </div>
                        <button
                          onClick={() => handleDeleteScenario(scen.id)}
                          className="text-text-muted hover:text-status-error p-1 rounded"
                          title="Delete scenario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Center Region (48%): Scenario Selector, Metrics Cards, and Flow Outcomes Table */}
        <div className="w-[48%] border-r border-border-subtle flex flex-col overflow-hidden bg-surface-canvas">
          {/* Scenario Tabs Bar */}
          <div className="h-11 border-b border-border-subtle bg-surface-panel/40 px-4 flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => setSelectedScenarioId("baseline")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                selectedScenarioId === "baseline"
                  ? "bg-brand-electric text-text-inverse font-semibold"
                  : "text-text-secondary hover:text-text-primary bg-surface-raised/40"
              }`}
            >
              Baseline (Normal)
            </button>
            {result?.scenarios.map((scen) => (
              <button
                key={scen.scenarioId}
                onClick={() => setSelectedScenarioId(scen.scenarioId)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedScenarioId === scen.scenarioId
                    ? "bg-brand-electric text-text-inverse font-semibold"
                    : "text-text-secondary hover:text-text-primary bg-surface-raised/40"
                }`}
              >
                <ShieldAlert className="w-3 h-3" />
                {scen.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Metrics Cards Grid (4 Cards) */}
            {activeMetrics ? (
              <div className="grid grid-cols-4 gap-3">
                {/* Reachability */}
                <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-text-secondary block">
                    Reachability
                  </span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="font-mono text-lg font-bold text-text-primary">
                      {activeMetrics.reachableFlowCount}
                    </span>
                    <span className="font-mono text-xs text-text-muted">
                      / {activeMetrics.totalFlowCount}
                    </span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {activeMetrics.unreachableFlowCount > 0 ? (
                      <span className="text-status-error font-medium">
                        {activeMetrics.unreachableFlowCount} unreachable
                      </span>
                    ) : (
                      <span className="text-[#10B981] font-medium">100% reachable</span>
                    )}
                  </span>
                </div>

                {/* Offered Demand */}
                <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-text-secondary block">
                    Offered Demand
                  </span>
                  <div className="mt-1 font-mono text-lg font-bold text-text-primary">
                    {activeMetrics.aggregateOfferedDemandMbps}
                    <span className="text-xs text-text-muted font-normal ml-1">Mbps</span>
                  </div>
                  <span className="text-[10px] text-text-muted">Total endpoint load</span>
                </div>

                {/* Aggregate Delivered Rate */}
                <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-text-secondary block">
                    Delivered Rate
                  </span>
                  <div className="mt-1 font-mono text-lg font-bold text-brand-electric">
                    {activeMetrics.aggregateDeliveredRateMbps}
                    <span className="text-xs text-text-muted font-normal ml-1">Mbps</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {activeMetrics.completeness === "complete" ? "Complete estimate" : "Partial capacity"}
                  </span>
                </div>

                {/* Mean Latency */}
                <div className="p-3 rounded-lg border border-border-subtle bg-surface-panel/60">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-text-secondary block">
                    Mean Latency
                  </span>
                  <div className="mt-1 font-mono text-lg font-bold text-text-primary">
                    {activeMetrics.meanReachableLatencyMs !== null
                      ? activeMetrics.meanReachableLatencyMs.toFixed(3)
                      : "—"}
                    <span className="text-xs text-text-muted font-normal ml-1">ms</span>
                  </div>
                  <span className="text-[10px] text-text-muted">
                    Max: {activeMetrics.maxReachableLatencyMs?.toFixed(3) ?? "—"} ms
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg border border-dashed border-border-strong text-center text-xs text-text-muted">
                Run simulation to view network metrics and flow outcomes.
              </div>
            )}

            {/* Flows Outcomes Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Flow Outcomes</span>
                <span className="text-[11px] text-text-muted">
                  Click a flow to view hop sequence and latency breakdown
                </span>
              </div>

              {activeFlowResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-text-muted">
                  No flow results available. Click "Run Simulation" above to evaluate network paths.
                </div>
              ) : (
                <div className="border border-border-subtle rounded-lg overflow-hidden bg-surface-panel/30">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-raised border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-secondary font-semibold">
                      <tr>
                        <th className="py-2 px-3">Flow / Endpoints</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Hops</th>
                        <th className="py-2 px-3">Demand</th>
                        <th className="py-2 px-3">Bottleneck</th>
                        <th className="py-2 px-3">Delivered</th>
                        <th className="py-2 px-3">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                      {activeFlowResults.map((fr) => {
                        const isSelected = activeSelectedFlow?.flowId === fr.flowId;
                        const sub = aggregate?.subnetsById[fr.sourceSubnetId];
                        const srv = aggregate?.devicesById[fr.destinationDeviceId];
                        return (
                          <tr
                            key={fr.flowId}
                            onClick={() => setSelectedFlowId(fr.flowId)}
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-brand-electric/15 text-text-primary"
                                : "hover:bg-surface-raised/40 text-text-secondary"
                            }`}
                          >
                            <td className="py-2 px-3 font-sans">
                              <span className="font-semibold text-text-primary block">
                                {sub?.name ?? fr.sourceSubnetId} &rarr; {srv?.name ?? fr.destinationDeviceId}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-sans">
                              {fr.reachable ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/30">
                                  Reachable
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded border border-[#EF4444]/30">
                                  Unreachable ({fr.unreachableReason ?? "no path"})
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3">{fr.hopCount}</td>
                            <td className="py-2 px-3">{fr.offeredDemandMbps} Mbps</td>
                            <td className="py-2 px-3">
                              {fr.bottleneckCapacityMbps !== null ? `${fr.bottleneckCapacityMbps} Mbps` : "—"}
                            </td>
                            <td className="py-2 px-3 font-bold text-text-primary">
                              {fr.deliveredRateMbps !== null ? `${fr.deliveredRateMbps} Mbps` : "—"}
                            </td>
                            <td className="py-2 px-3">
                              {fr.latency ? `${fr.latency.totalMs.toFixed(3)} ms` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Rail (24%): Selected Flow Path & Latency Breakdown */}
        <div className="w-[24%] flex flex-col bg-surface-panel/40 overflow-y-auto p-4 space-y-4">
          <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-brand-electric" />
            Path & Latency Details
          </span>

          {activeSelectedFlow ? (
            <div className="space-y-4 text-xs">
              {/* Flow Header */}
              <div className="p-3 rounded-lg border border-border-subtle bg-surface-canvas space-y-1">
                <span className="text-[10px] uppercase font-semibold text-text-muted block">Selected Flow</span>
                <span className="font-semibold text-text-primary block">
                  {aggregate?.subnetsById[activeSelectedFlow.sourceSubnetId]?.name ?? activeSelectedFlow.sourceSubnetId}
                  {" "}&rarr;{" "}
                  {aggregate?.devicesById[activeSelectedFlow.destinationDeviceId]?.name ?? activeSelectedFlow.destinationDeviceId}
                </span>
                <div className="pt-1 flex items-center justify-between text-[11px]">
                  <span className="text-text-muted">Status:</span>
                  {activeSelectedFlow.reachable ? (
                    <span className="text-[#10B981] font-semibold">Reachable</span>
                  ) : (
                    <span className="text-[#EF4444] font-semibold">
                      Unreachable ({activeSelectedFlow.unreachableReason ?? "noPath"})
                    </span>
                  )}
                </div>
              </div>

              {/* Path Hops */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-text-primary">
                  Hop Sequence ({activeSelectedFlow.pathDeviceIds.length} devices)
                </span>
                {activeSelectedFlow.pathDeviceIds.length === 0 ? (
                  <p className="text-text-muted text-[11px] italic">No path traversed.</p>
                ) : (
                  <div className="space-y-1.5">
                    {activeSelectedFlow.pathDeviceIds.map((devId, idx) => {
                      const dev = aggregate?.devicesById[devId];
                      return (
                        <div
                          key={devId}
                          className="p-2 rounded bg-surface-canvas border border-border-subtle flex items-center justify-between text-[11px]"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-text-muted text-[10px] w-4">{idx + 1}.</span>
                            <span className="font-medium text-text-primary">{dev?.name ?? devId}</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-raised border border-border-subtle text-text-secondary capitalize">
                            {dev?.type ?? "device"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Latency Breakdown */}
              <div className="p-3 rounded-lg border border-border-subtle bg-surface-canvas space-y-2 font-mono text-[11px]">
                <div className="flex items-center justify-between font-sans">
                  <span className="font-semibold text-text-primary text-xs">Latency Breakdown</span>
                  <span className="text-text-muted text-[10px]">1500B frame</span>
                </div>

                {activeSelectedFlow.latency ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary font-sans text-[11px]">Propagation delay:</span>
                      <span className="text-text-primary">{activeSelectedFlow.latency.propagationMs.toFixed(3)} ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary font-sans text-[11px]">Transmission delay:</span>
                      <span className="text-text-primary">{activeSelectedFlow.latency.transmissionMs.toFixed(3)} ms</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-text-secondary font-sans text-[11px]">Processing delay:</span>
                      <span className="text-text-primary">{activeSelectedFlow.latency.processingMs.toFixed(3)} ms</span>
                    </div>
                    <div className="flex items-center justify-between text-text-muted">
                      <span className="font-sans text-[11px]">Queueing delay:</span>
                      <span className="italic">Unmodelled</span>
                    </div>
                    <div className="pt-2 border-t border-border-subtle flex items-center justify-between font-bold">
                      <span className="font-sans text-xs text-text-primary">Total Latency:</span>
                      <span className="text-brand-electric text-xs">{activeSelectedFlow.latency.totalMs.toFixed(3)} ms</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-text-muted text-[10px] italic">Latency not applicable for unreachable flow.</p>
                )}
              </div>

              {/* Capacity & Bottleneck Info */}
              <div className="p-3 rounded-lg border border-border-subtle bg-surface-canvas space-y-1.5 text-[11px]">
                <span className="font-semibold text-text-primary text-xs block">Throughput Metrics</span>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Offered Demand:</span>
                  <span className="font-mono text-text-primary">{activeSelectedFlow.offeredDemandMbps} Mbps</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Bottleneck Capacity:</span>
                  <span className="font-mono text-text-primary">
                    {activeSelectedFlow.bottleneckCapacityMbps !== null
                      ? `${activeSelectedFlow.bottleneckCapacityMbps} Mbps`
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Delivered Rate:</span>
                  <span className="font-mono font-bold text-brand-electric">
                    {activeSelectedFlow.deliveredRateMbps !== null
                      ? `${activeSelectedFlow.deliveredRateMbps} Mbps`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-text-muted text-xs">
              Select a flow from the table to inspect path hops and latency breakdown.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
