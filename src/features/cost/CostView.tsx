import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  IndianRupee,
  RefreshCw,
  AlertTriangle,
  Clock,
  Sliders,
  DollarSign,
  HelpCircle,
  HardDrive,
  Cable,
  Wrench,
  Zap,
  ShieldCheck,
  Building,
} from "lucide-react";
import { ProjectHeader } from "@/features/shell/ProjectHeader";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getApplicationContainer } from "@/application/container";
import { ProjectSettingsModal } from "@/features/settings/ProjectSettingsModal";
import type { DesignId } from "@/contracts/primitives";
import type { CostEstimate } from "@/contracts/engines";

export function CostView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();
  const aggregate = useDesignStore((s) => s.aggregate);

  const costRecord = useAnalysisStore((s) => s.records.cost);
  const costStatus = useAnalysisStore((s) => s.status.cost);
  const costError = useAnalysisStore((s) => s.errors.cost);

  const [isCalculating, setIsCalculating] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Ensure design is opened in session and inspected for freshness
  useEffect(() => {
    if (!designId) return;
    const container = getApplicationContainer();
    if (aggregate?.design.id !== designId) {
      container.designSession.open(designId as DesignId);
    }
    container.analysisCoordinator.inspect(designId as DesignId);
  }, [designId, aggregate?.design.id]);

  // Handle calculation action
  const handleCalculate = async () => {
    if (!designId) return;
    setIsCalculating(true);
    try {
      const container = getApplicationContainer();
      await container.analysisCoordinator.run("cost", designId as DesignId);
    } catch {
      // Error handled by analysisStore
    } finally {
      setIsCalculating(false);
    }
  };

  const estimate = costRecord?.result as CostEstimate | undefined;
  const costSettings = aggregate?.project.settings.cost;

  // Formatting helpers
  const formatMoney = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return "—";
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  };

  // Group line items by category
  const lineItemsByCategory = useMemo(() => {
    if (!estimate?.lineItems) return {};
    return estimate.lineItems.reduce<Record<string, typeof estimate.lineItems>>((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
  }, [estimate]);

  // Chart data calculations
  const chartData = useMemo(() => {
    if (!estimate) return null;
    const capex = estimate.capex.total?.amount ?? estimate.capex.knownSubtotal.amount;
    const opex = estimate.annualOpex.total?.amount ?? estimate.annualOpex.knownSubtotal.amount;
    const horizon = estimate.tcoHorizonYears;
    const opexTotal = opex * horizon;
    const tco = estimate.tco.total?.amount ?? estimate.tco.knownSubtotal.amount;

    const hwAmount = estimate.byCategory.hardware?.amount ?? 0;
    const cablingAmount = estimate.byCategory.cabling?.amount ?? 0;
    const terminationAmount = estimate.byCategory.termination?.amount ?? 0;
    const civilAmount = estimate.byCategory.civilWork?.amount ?? 0;
    const labourAmount = estimate.byCategory.labour?.amount ?? 0;

    const capexBreakdown = [
      { name: "Hardware", amount: hwAmount, color: "#0297DE", pct: capex > 0 ? (hwAmount / capex) * 100 : 0 },
      { name: "Cabling", amount: cablingAmount, color: "#38bdf8", pct: capex > 0 ? (cablingAmount / capex) * 100 : 0 },
      { name: "Termination", amount: terminationAmount, color: "#818cf8", pct: capex > 0 ? (terminationAmount / capex) * 100 : 0 },
      { name: "Civil Work", amount: civilAmount, color: "#fbbf24", pct: capex > 0 ? (civilAmount / capex) * 100 : 0 },
      { name: "Labour", amount: labourAmount, color: "#f87171", pct: capex > 0 ? (labourAmount / capex) * 100 : 0 },
    ].filter((item) => item.amount > 0);

    const tcoComparison = [
      { name: "Initial CAPEX", amount: capex, color: "#0297DE", pct: tco > 0 ? (capex / tco) * 100 : 0 },
      { name: `${horizon}-Yr OPEX`, amount: opexTotal, color: "#FC734D", pct: tco > 0 ? (opexTotal / tco) * 100 : 0 },
    ];

    return { capexBreakdown, tcoComparison };
  }, [estimate]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas text-text-primary">
      <ProjectHeader />

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Top Header & Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <IndianRupee className="w-5 h-5 text-brand-electric" />
              <h1 className="text-xl font-bold tracking-tight text-text-primary">
                Bill of Materials &amp; Cost Estimation
              </h1>
            </div>
            <p className="text-xs text-text-muted mt-1">
              Deterministic capital expenditure (CAPEX), operational expenditure (OPEX), and {costSettings?.tcoHorizonYears ?? 5}-year TCO.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3 py-1.5 rounded bg-surface-panel hover:bg-surface-elevated text-text-secondary hover:text-text-primary border border-border-subtle text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              Cost Assumptions
            </button>

            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="px-4 py-1.5 rounded bg-brand-electric hover:bg-brand-electric/90 disabled:opacity-50 text-white text-xs font-semibold shadow flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? "animate-spin" : ""}`} />
              {isCalculating ? "Calculating..." : costRecord ? "Recalculate Estimate" : "Calculate Estimate"}
            </button>
          </div>
        </div>

        {/* Freshness & Status Banners */}
        {costError && (
          <div className="p-3 rounded-lg bg-status-error/10 border border-status-error/30 text-status-error text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Calculation Error: {costError}</span>
          </div>
        )}

        {costStatus === "stale" && (
          <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 text-status-warning text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                <strong>Estimate Out of Date:</strong> Authored devices, links, or pricing settings have changed since the last calculation.
              </span>
            </div>
            <button
              onClick={handleCalculate}
              className="px-2.5 py-1 rounded bg-status-warning/20 hover:bg-status-warning/30 font-medium text-xs text-status-warning"
            >
              Recalculate Now
            </button>
          </div>
        )}

        {estimate && estimate.completeness === "partial" && (
          <div className="p-3 rounded-lg bg-status-warning/10 border border-status-warning/30 text-status-warning text-xs flex items-center gap-2">
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>
              <strong>Partial Estimate:</strong> Some pricing rates or catalogue specs are not configured. Known subtotal is displayed; missing rates are not counted as ₹0.
            </span>
          </div>
        )}

        {/* Summary Row: 3 Aligned Numeric Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-lg bg-surface-raised border border-border-strong shadow-sm space-y-1">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Capital Expenditure</span>
            <div className="text-2xl font-bold font-mono text-text-primary">
              {formatMoney(estimate ? (estimate.capex.total?.amount ?? estimate.capex.knownSubtotal.amount) : null)}
            </div>
            <p className="text-[11px] text-text-muted">Hardware, cabling, termination &amp; civil installation</p>
          </div>

          <div className="p-5 rounded-lg bg-surface-raised border border-border-strong shadow-sm space-y-1">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Annual Operating Cost</span>
            <div className="text-2xl font-bold font-mono text-brand-electric">
              {estimate ? `${formatMoney(estimate.annualOpex.total?.amount ?? estimate.annualOpex.knownSubtotal.amount)} / yr` : "—"}
            </div>
            <p className="text-[11px] text-text-muted">Power tariff ({costSettings?.electricityTariffPerKwh?.amount ? `₹${costSettings.electricityTariffPerKwh.amount}/kWh` : "unconfigured"}), maintenance &amp; support</p>
          </div>

          <div className="p-5 rounded-lg bg-surface-raised border border-border-strong shadow-sm space-y-1">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {costSettings?.tcoHorizonYears ?? 5}-Year TCO Total
            </span>
            <div className="text-2xl font-bold font-mono text-brand-cantaloupe">
              {formatMoney(estimate ? (estimate.tco.total?.amount ?? estimate.tco.knownSubtotal.amount) : null)}
            </div>
            <p className="text-[11px] text-text-muted">CAPEX + {costSettings?.tcoHorizonYears ?? 5} years of cumulative operating expenditure</p>
          </div>
        </div>

        {/* Main Workspace Area: Grouped Line Items (65%) + Right Chart & Assumptions (35%) */}
        {!estimate ? (
          <div className="p-12 text-center rounded-lg bg-surface-raised border border-border-strong text-text-muted space-y-3">
            <DollarSign className="w-10 h-10 text-text-disabled mx-auto mb-2" />
            <h2 className="text-sm font-semibold text-text-secondary">No Cost Estimate Calculated</h2>
            <p className="text-xs max-w-md mx-auto">
              Calculate the Bill of Materials to generate hardware counts, cable distances, civil labor, annual electricity, and TCO projections.
            </p>
            <button
              onClick={handleCalculate}
              disabled={isCalculating}
              className="px-4 py-2 rounded bg-brand-electric text-white text-xs font-semibold hover:bg-brand-electric/90 transition-colors shadow"
            >
              {isCalculating ? "Calculating..." : "Calculate Cost Estimate"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 65%: Grouped Line Items Table (8 cols on lg) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Category Breakdown Tables */}
              {Object.entries(lineItemsByCategory).map(([category, items]) => {
                let categoryLabel = "Hardware";
                let Icon = HardDrive;
                if (category === "cabling") {
                  categoryLabel = "Cabling & Media";
                  Icon = Cable;
                } else if (category === "civilWork" || category === "labour") {
                  categoryLabel = "Installation & Civil Labour";
                  Icon = Wrench;
                } else if (category === "energy") {
                  categoryLabel = "Energy & Power Tariff";
                  Icon = Zap;
                } else if (category === "maintenance") {
                  categoryLabel = "Maintenance & Support";
                  Icon = ShieldCheck;
                }

                const catTotal = items.reduce((sum, item) => sum + (item.amount?.amount ?? 0), 0);

                return (
                  <div key={category} className="rounded-lg bg-surface-raised border border-border-strong overflow-hidden shadow-sm">
                    <div className="px-4 py-3 bg-surface-panel/60 border-b border-border-subtle flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-brand-electric" />
                        <h3 className="text-xs font-bold text-text-primary capitalize">{categoryLabel}</h3>
                        <span className="text-[11px] text-text-muted font-mono">({items.length} items)</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-text-primary">
                        {formatMoney(catTotal)}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border-subtle text-text-muted text-[11px]">
                            <th className="py-2 px-3">Item Description</th>
                            <th className="py-2 px-3 text-right">Quantity / Unit</th>
                            <th className="py-2 px-3 text-right">Unit Rate</th>
                            <th className="py-2 px-3 text-right">Total Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle font-mono text-xs">
                          {items.map((item, idx) => (
                            <tr key={idx} className="hover:bg-surface-elevated/30 transition-colors">
                              <td className="py-2.5 px-3 font-sans">
                                <div className="font-medium text-text-primary">{item.label}</div>
                                {item.provenance && (
                                  <span className="text-[10px] text-text-muted capitalize">
                                    {item.provenance} price
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right text-text-secondary">
                                {item.quantity} {item.unit}
                              </td>
                              <td className="py-2.5 px-3 text-right text-text-muted">
                                {formatMoney(item.unitPrice?.amount)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-semibold text-text-primary">
                                {item.amount ? formatMoney(item.amount.amount) : (
                                  <span className="text-status-warning text-[10px] font-sans">Incomplete</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Contingency & Financials Summary Table */}
              <div className="p-4 rounded-lg bg-surface-raised border border-border-strong space-y-2 text-xs">
                <h3 className="font-semibold text-text-primary flex items-center gap-1.5 pb-2 border-b border-border-subtle">
                  <Building className="w-3.5 h-3.5 text-brand-cantaloupe" />
                  Financial Assumptions &amp; Summary
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="flex justify-between py-1 border-b border-border-subtle font-mono">
                    <span className="text-text-secondary font-sans">Contingency Rate</span>
                    <span className="font-semibold">{costSettings?.contingencyRatePct ?? 12.5}%</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle font-mono">
                    <span className="text-text-secondary font-sans">Tax Rate</span>
                    <span className="text-text-muted font-sans">
                      {costSettings?.taxRatePct !== null && costSettings?.taxRatePct !== undefined ? `${costSettings.taxRatePct}%` : "Tax not included (Pre-tax estimate)"}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle font-mono">
                    <span className="text-text-secondary font-sans">Annual Maintenance ({costSettings?.maintenanceRatePctPerYear ?? 7.5}%/yr)</span>
                    <span className="font-semibold">{formatMoney(estimate.byCategory.maintenance?.amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border-subtle font-mono">
                    <span className="text-text-secondary font-sans">Annual Energy ({costSettings?.electricityTariffPerKwh?.amount ? `₹${costSettings.electricityTariffPerKwh.amount}/kWh` : "unconfigured"})</span>
                    <span className="font-semibold">{formatMoney(estimate.byCategory.energy?.amount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right 35%: Visual Distribution Chart & Assumptions Rail (4 cols on lg) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Restrained SVG Distribution Chart */}
              {chartData && (
                <div className="p-4 rounded-lg bg-surface-raised border border-border-strong shadow-sm space-y-4">
                  <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                    Cost Distribution
                  </h3>

                  {/* CAPEX Category Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span className="font-medium">CAPEX by Category</span>
                      <span className="font-mono">{formatMoney(estimate.capex.total?.amount ?? estimate.capex.knownSubtotal.amount)}</span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div className="h-4 w-full rounded-full overflow-hidden flex bg-surface-panel">
                      {chartData.capexBreakdown.map((item, idx) => (
                        <div
                          key={idx}
                          style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                          title={`${item.name}: ${formatMoney(item.amount)} (${item.pct.toFixed(1)}%)`}
                        />
                      ))}
                    </div>

                    {/* Textual Legend Table (Ensures no color-only reliance) */}
                    <div className="space-y-1.5 pt-1 text-xs">
                      {chartData.capexBreakdown.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-text-secondary">{item.name}</span>
                          </div>
                          <div className="font-mono text-text-primary">
                            <span>{formatMoney(item.amount)}</span>
                            <span className="text-text-muted ml-1.5">({item.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TCO Horizon Comparison Bar */}
                  <div className="space-y-2 pt-3 border-t border-border-subtle">
                    <div className="flex justify-between text-xs text-text-secondary">
                      <span className="font-medium">TCO Proportion</span>
                      <span className="font-mono">{formatMoney(estimate.tco.total?.amount ?? estimate.tco.knownSubtotal.amount)}</span>
                    </div>

                    <div className="h-4 w-full rounded-full overflow-hidden flex bg-surface-panel">
                      {chartData.tcoComparison.map((item, idx) => (
                        <div
                          key={idx}
                          style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                          title={`${item.name}: ${formatMoney(item.amount)} (${item.pct.toFixed(1)}%)`}
                        />
                      ))}
                    </div>

                    <div className="space-y-1.5 pt-1 text-xs">
                      {chartData.tcoComparison.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-text-secondary">{item.name}</span>
                          </div>
                          <div className="font-mono text-text-primary">
                            <span>{formatMoney(item.amount)}</span>
                            <span className="text-text-muted ml-1.5">({item.pct.toFixed(1)}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Assumptions & Provenance Panel */}
              <div className="p-4 rounded-lg bg-surface-raised border border-border-strong space-y-3 text-xs">
                <h3 className="font-semibold text-text-primary flex items-center justify-between">
                  <span>Model Assumptions</span>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-brand-electric hover:underline text-[11px]"
                  >
                    Edit
                  </button>
                </h3>

                <div className="space-y-2 text-[11px] text-text-secondary divide-y divide-border-subtle">
                  <div className="flex justify-between pt-1">
                    <span>Currency</span>
                    <span className="font-mono text-text-primary font-semibold">INR (₹)</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>TCO Horizon</span>
                    <span className="font-mono text-text-primary">{costSettings?.tcoHorizonYears ?? 5} years</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Cable Slack Allowance</span>
                    <span className="font-mono text-text-primary">{costSettings?.cableSlackPct ?? 15}%</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Contingency Rate</span>
                    <span className="font-mono text-text-primary">{costSettings?.contingencyRatePct ?? 12.5}%</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span>Device Duty Ratio</span>
                    <span className="font-mono text-text-primary">100% continuous nameplate power</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-surface-panel/70 border border-border-subtle text-[11px] text-text-muted space-y-1">
                  <p className="font-medium text-text-secondary">Estimate Disclaimer</p>
                  <p>
                    All values are modeled engineering approximations based on synthetic catalogue rates and configuration formulas. Seeded rates do not constitute formal supplier quotes.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Modal */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
