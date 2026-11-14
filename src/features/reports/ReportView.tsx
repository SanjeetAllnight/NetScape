import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Loader2,
  RefreshCw,
  Info,
  MapPin,
  Network,
  Cpu,
  Layers,
  Radio,
  Activity,
  DollarSign,
} from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import type { ReportModel } from "@/contracts/reports";
import type { AnalysisBlob } from "@/contracts/engines";
import type { ProjectId, DesignId } from "@/contracts/primitives";
import {
  renderGeographicSchematic,
  renderTopologySchematic,
  renderCoverageHeatmap,
} from "./schematicRenderer";
import { generateEngineeringReportPdf } from "./pdfGenerator";

export function ReportView() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  const [reportModel, setReportModel] = useState<ReportModel | null>(null);
  const [coverageBlob, setCoverageBlob] = useState<AnalysisBlob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const geoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const topoCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const covCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadReport = useCallback(async () => {
    if (!projectId || !designId) return;
    setLoading(true);
    setError(null);
    try {
      const container = getApplicationContainer();
      const model = await container.reportService.buildReportModel(
        projectId as ProjectId,
        designId as DesignId
      );
      const blob = await container.reportService.getCoverageBlob(designId as DesignId);
      setReportModel(model);
      setCoverageBlob(blob);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [projectId, designId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Redraw canvas figures when report data loads
  useEffect(() => {
    if (!reportModel) return;

    if (geoCanvasRef.current) {
      renderGeographicSchematic(geoCanvasRef.current, reportModel);
    }
    if (topoCanvasRef.current) {
      renderTopologySchematic(topoCanvasRef.current, reportModel);
    }
    if (covCanvasRef.current) {
      renderCoverageHeatmap(covCanvasRef.current, coverageBlob, reportModel);
    }
  }, [reportModel, coverageBlob]);

  const handleDownloadPdf = async () => {
    if (!reportModel) return;
    setIsGeneratingPdf(true);
    setPdfError(null);

    try {
      const pdfBlob = await generateEngineeringReportPdf(reportModel, coverageBlob);
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${reportModel.project.name.replace(/\s+/g, "_")}-${reportModel.design.name.replace(/\s+/g, "_")}-Report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setPdfError(err instanceof Error ? err.message : "PDF generation failed. Please try again.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-surface-canvas text-text-primary">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
          <p className="text-sm font-medium text-text-secondary">Assembling report preview from local data...</p>
        </div>
      </div>
    );
  }

  if (error || !reportModel) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-surface-canvas p-6 text-text-primary">
        <div className="max-w-md rounded-lg border border-border-strong bg-surface-panel p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-accent-orange" />
          <h2 className="mt-3 text-lg font-bold">Failed to Load Report</h2>
          <p className="mt-2 text-sm text-text-secondary">{error ?? "Report model could not be assembled."}</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              to={`/projects/${projectId}/designs/${designId}/map`}
              className="rounded bg-surface-raised px-4 py-2 text-xs font-medium text-text-primary hover:bg-border-strong"
            >
              Back to Map
            </Link>
            <button
              onClick={loadReport}
              className="flex items-center gap-1.5 rounded bg-accent-blue px-4 py-2 text-xs font-semibold text-white hover:bg-accent-blue-hover"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderFreshnessBadge = (status: "current" | "outOfDate" | "missing") => {
    if (status === "current") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
          <CheckCircle2 className="h-3 w-3" />
          Current
        </span>
      );
    }
    if (status === "outOfDate") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-400">
          <Clock className="h-3 w-3" />
          Computed on an earlier version of the design
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-500/15 px-2 py-0.5 text-[11px] font-medium text-slate-400">
        <AlertTriangle className="h-3 w-3" />
        Not computed
      </span>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-surface-canvas text-text-primary">
      {/* Top Header Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-default bg-surface-panel px-6">
        <div className="flex items-center gap-4">
          <Link
            to={`/projects/${projectId}/designs/${designId}/map`}
            className="flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Workspace
          </Link>
          <div className="h-4 w-px bg-border-strong" />
          <div>
            <h1 className="flex items-center gap-2 text-sm font-bold text-text-primary">
              <FileText className="h-4 w-4 text-accent-blue" />
              Report Preview: {reportModel.project.name}
            </h1>
            <p className="text-[11px] text-text-secondary">
              Design: {reportModel.design.name} (Rev {reportModel.design.revision})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Status strip */}
          <div className="hidden items-center gap-3 text-xs sm:flex">
            <span className="text-[11px] text-text-muted">Analysis Status:</span>
            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
              Cost:{" "}
              <span
                className={`font-semibold ${
                  reportModel.cost.status === "current"
                    ? "text-emerald-400"
                    : reportModel.cost.status === "outOfDate"
                    ? "text-amber-400"
                    : "text-slate-400"
                }`}
              >
                {reportModel.cost.status}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
              Coverage:{" "}
              <span
                className={`font-semibold ${
                  reportModel.coverage.status === "current"
                    ? "text-emerald-400"
                    : reportModel.coverage.status === "outOfDate"
                    ? "text-amber-400"
                    : "text-slate-400"
                }`}
              >
                {reportModel.coverage.status}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[11px] text-text-secondary">
              Simulation:{" "}
              <span
                className={`font-semibold ${
                  reportModel.simulation.status === "current"
                    ? "text-emerald-400"
                    : reportModel.simulation.status === "outOfDate"
                    ? "text-amber-400"
                    : "text-slate-400"
                }`}
              >
                {reportModel.simulation.status}
              </span>
            </span>
          </div>

          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="flex items-center gap-2 rounded bg-accent-blue px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-accent-blue-hover disabled:opacity-50"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download PDF
              </>
            )}
          </button>
        </div>
      </header>

      {/* PDF Error Alert */}
      {pdfError && (
        <div className="flex items-center justify-between border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-xs text-red-400">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span>{pdfError}</span>
          </div>
          <button onClick={handleDownloadPdf} className="font-semibold underline hover:text-white">
            Retry Download
          </button>
        </div>
      )}

      {/* Main Container: Left TOC + Document Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left TOC Navigation Rail */}
        <nav className="hidden w-56 shrink-0 border-r border-border-default bg-surface-panel p-4 md:block overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Report Contents</p>
          <ul className="mt-3 space-y-1 text-xs">
            <li>
              <a href="#section-cover" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <FileText className="h-3.5 w-3.5 text-accent-blue" />
                Cover & Summary
              </a>
            </li>
            <li>
              <a href="#section-inventory" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Cpu className="h-3.5 w-3.5 text-text-muted" />
                Equipment Inventory
              </a>
            </li>
            <li>
              <a href="#section-geo" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <MapPin className="h-3.5 w-3.5 text-text-muted" />
                Geographical Figure
              </a>
            </li>
            <li>
              <a href="#section-topo" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Network className="h-3.5 w-3.5 text-text-muted" />
                Logical Topology
              </a>
            </li>
            <li>
              <a href="#section-addressing" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Layers className="h-3.5 w-3.5 text-text-muted" />
                IPv4 Addressing Plan
              </a>
            </li>
            <li>
              <a href="#section-cost" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <DollarSign className="h-3.5 w-3.5 text-text-muted" />
                Cost Estimation
              </a>
            </li>
            <li>
              <a href="#section-coverage" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Radio className="h-3.5 w-3.5 text-text-muted" />
                Wireless Coverage
              </a>
            </li>
            <li>
              <a href="#section-simulation" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Activity className="h-3.5 w-3.5 text-text-muted" />
                Network Simulation
              </a>
            </li>
            <li>
              <a href="#section-assumptions" className="flex items-center gap-2 rounded px-2 py-1.5 text-text-secondary hover:bg-surface-raised hover:text-text-primary">
                <Info className="h-3.5 w-3.5 text-text-muted" />
                Assumptions & Disclaimers
              </a>
            </li>
          </ul>
        </nav>

        {/* Document Scroll View */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="mx-auto max-w-4xl space-y-8">
            {/* SECTION 1: Cover & Project Summary */}
            <section
              id="section-cover"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <div className="border-b border-border-default pb-6">
                <div className="flex items-center justify-between">
                  <span className="rounded bg-accent-blue/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-accent-blue">
                    Engineering Workstation Plan
                  </span>
                  <span className="text-xs text-text-muted">
                    Generated: {new Date(reportModel.generatedAt).toLocaleString()}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold tracking-tight text-text-primary">
                  {reportModel.project.name}
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  Design: <span className="font-semibold text-text-primary">{reportModel.design.name}</span>{" "}
                  (Revision {reportModel.design.revision})
                </p>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-[10px] text-text-muted">Primary Region</span>
                  <p className="mt-1 font-semibold text-text-primary">{reportModel.region.label}</p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-[10px] text-text-muted">Center Coordinates</span>
                  <p className="mt-1 font-semibold text-text-primary">
                    {reportModel.region.center.coordinates[1].toFixed(4)}° N,{" "}
                    {reportModel.region.center.coordinates[0].toFixed(4)}° E
                  </p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-[10px] text-text-muted">Inventory Total</span>
                  <p className="mt-1 font-semibold text-text-primary">
                    {reportModel.devices.length} Devices, {reportModel.links.length} Links
                  </p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-[10px] text-text-muted">Subnet Requirements</span>
                  <p className="mt-1 font-semibold text-text-primary">
                    {reportModel.subnets.length} Configured
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 2: Design Overview */}
            <section
              id="section-inventory"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <h3 className="text-base font-bold text-text-primary">1. Equipment Inventory & Interconnects</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Hardware devices placed in the coordinate frame and connected media links.
              </p>

              {/* Devices Table */}
              <div className="mt-4 overflow-x-auto rounded border border-border-default">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Device Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Position (Lat, Lon)</th>
                      <th className="px-3 py-2">Catalog Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {reportModel.devices.map((d) => (
                      <tr key={d.id} className="hover:bg-surface-canvas">
                        <td className="px-3 py-2 font-medium text-text-primary">{d.name}</td>
                        <td className="px-3 py-2 uppercase text-text-secondary">{d.type}</td>
                        <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">
                          {d.position.coordinates[1].toFixed(5)}°, {d.position.coordinates[0].toFixed(5)}°
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-text-muted">{d.catalogItemId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Links Table */}
              <div className="mt-6 overflow-x-auto rounded border border-border-default">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Link ID</th>
                      <th className="px-3 py-2">Endpoints</th>
                      <th className="px-3 py-2">Medium</th>
                      <th className="px-3 py-2">Installation</th>
                      <th className="px-3 py-2">Capacity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {reportModel.links.map((l) => (
                      <tr key={l.id} className="hover:bg-surface-canvas">
                        <td className="px-3 py-2 font-mono text-[11px] text-text-muted">{l.id.substring(0, 8)}</td>
                        <td className="px-3 py-2 text-text-primary">
                          {reportModel.devices.find((d) => d.id === l.sourceDeviceId)?.name ?? l.sourceDeviceId} →{" "}
                          {reportModel.devices.find((d) => d.id === l.targetDeviceId)?.name ?? l.targetDeviceId}
                        </td>
                        <td className="px-3 py-2 uppercase text-text-secondary">{l.medium}</td>
                        <td className="px-3 py-2 text-text-secondary">{l.installationMethod ?? "N/A"}</td>
                        <td className="px-3 py-2 font-mono text-text-primary">
                          {l.capacityMbps ? `${l.capacityMbps} Mbps` : "Unconfigured"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 3: Geographical Schematic Figure */}
            <section
              id="section-geo"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <h3 className="text-base font-bold text-text-primary">2. Schematic Geographical Figure</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Rendered from domain geometry in the conformal metric frame. Depicts boundary, obstacles, devices, and link vectors.
              </p>
              <div className="mt-4 flex justify-center rounded-lg border border-border-default bg-surface-canvas p-2">
                <canvas
                  ref={geoCanvasRef}
                  width={800}
                  height={460}
                  className="max-h-[460px] w-full rounded object-contain shadow-inner"
                />
              </div>
            </section>

            {/* SECTION 4: Logical Topology Figure */}
            <section
              id="section-topo"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <h3 className="text-base font-bold text-text-primary">3. Logical Topology Figure</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Rendered from authored logical layout and device connectivity graph.
              </p>
              <div className="mt-4 flex justify-center rounded-lg border border-border-default bg-surface-canvas p-2">
                <canvas
                  ref={topoCanvasRef}
                  width={800}
                  height={420}
                  className="max-h-[420px] w-full rounded object-contain shadow-inner"
                />
              </div>
            </section>

            {/* SECTION 5: IPv4 Addressing Plan */}
            <section
              id="section-addressing"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">4. IPv4 Addressing & VLSM Plan</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Parent network: <span className="font-mono text-text-primary">{reportModel.design.addressing.parentCidr ?? "Not Configured"}</span>
                  </p>
                </div>
                {renderFreshnessBadge(
                  reportModel.design.addressing.allocationStatus === "current"
                    ? "current"
                    : reportModel.design.addressing.allocationStatus === "outOfDate"
                    ? "outOfDate"
                    : "missing"
                )}
              </div>

              <div className="mt-4 overflow-x-auto rounded border border-border-default">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-raised text-text-secondary">
                    <tr>
                      <th className="px-3 py-2">Subnet Name</th>
                      <th className="px-3 py-2">Hosts Req.</th>
                      <th className="px-3 py-2">Allocated CIDR</th>
                      <th className="px-3 py-2">Usable Capacity</th>
                      <th className="px-3 py-2">Wasted Hosts</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default">
                    {reportModel.subnets.map((s) => (
                      <tr key={s.id} className="hover:bg-surface-canvas">
                        <td className="px-3 py-2 font-medium text-text-primary">{s.name}</td>
                        <td className="px-3 py-2">{s.hostsRequired}</td>
                        <td className="px-3 py-2 font-mono text-accent-blue">{s.allocatedCidr ?? "Unallocated"}</td>
                        <td className="px-3 py-2">{s.usableHostCapacity ?? "-"}</td>
                        <td className="px-3 py-2 text-text-muted">{s.wastedUsableHosts ?? "-"}</td>
                        <td className="px-3 py-2 uppercase text-[10px] font-semibold">{s.allocationStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECTION 6: Cost Estimation */}
            <section
              id="section-cost"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">5. Cost Estimation</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Capital expenditure, operational expenses, and Total Cost of Ownership over {reportModel.assumptions.cost.tcoHorizonYears} years.
                  </p>
                </div>
                {renderFreshnessBadge(reportModel.cost.status)}
              </div>

              {reportModel.cost.result ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded border border-border-default bg-surface-canvas p-3 text-center">
                      <span className="text-[10px] text-text-muted">CAPEX (Initial)</span>
                      <p className="mt-1 font-mono text-sm font-bold text-text-primary">
                        {reportModel.cost.result.capex.total !== null
                          ? `INR ${reportModel.cost.result.capex.total.amount.toLocaleString("en-IN")}`
                          : "Partial / Incomplete"}
                      </p>
                    </div>
                    <div className="rounded border border-border-default bg-surface-canvas p-3 text-center">
                      <span className="text-[10px] text-text-muted">Annual OPEX</span>
                      <p className="mt-1 font-mono text-sm font-bold text-text-primary">
                        {reportModel.cost.result.annualOpex.total !== null
                          ? `INR ${reportModel.cost.result.annualOpex.total.amount.toLocaleString("en-IN")}`
                          : "Partial / Incomplete"}
                      </p>
                    </div>
                    <div className="rounded border border-border-default bg-surface-canvas p-3 text-center">
                      <span className="text-[10px] text-text-muted">TCO ({reportModel.cost.result.tcoHorizonYears} Yrs)</span>
                      <p className="mt-1 font-mono text-sm font-bold text-accent-blue">
                        {reportModel.cost.result.tco.total !== null
                          ? `INR ${reportModel.cost.result.tco.total.amount.toLocaleString("en-IN")}`
                          : "Partial / Incomplete"}
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded border border-border-default">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-raised text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Category</th>
                          <th className="px-3 py-2">Line Item</th>
                          <th className="px-3 py-2">Quantity</th>
                          <th className="px-3 py-2">Unit Rate</th>
                          <th className="px-3 py-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {reportModel.cost.result.lineItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-surface-canvas">
                            <td className="px-3 py-2 uppercase text-[10px] text-text-muted">{item.category}</td>
                            <td className="px-3 py-2 font-medium text-text-primary">{item.label}</td>
                            <td className="px-3 py-2 text-text-secondary">
                              {item.quantity} {item.unit}
                            </td>
                            <td className="px-3 py-2 font-mono text-text-secondary">
                              {item.unitPrice ? `INR ${item.unitPrice.amount.toFixed(2)}` : "Not configured"}
                            </td>
                            <td className="px-3 py-2 font-mono text-text-primary">
                              {item.amount ? `INR ${item.amount.amount.toFixed(2)}` : "Incomplete"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs italic text-text-muted">Cost analysis has not been calculated for this design.</p>
              )}
            </section>

            {/* SECTION 7: Wireless Coverage */}
            <section
              id="section-coverage"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">6. Wireless Coverage Analysis</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Log-distance RF propagation, wall transmission loss, and signal threshold verification.
                  </p>
                </div>
                {renderFreshnessBadge(reportModel.coverage.status)}
              </div>

              {reportModel.coverage.result ? (
                <div className="mt-4 space-y-4">
                  <div className="flex items-center gap-6 text-xs text-text-secondary">
                    <span>
                      Coverage Ratio (≥ -75 dBm):{" "}
                      <strong className="text-emerald-400">
                        {reportModel.coverage.result.coveragePercent.toFixed(1)}%
                      </strong>
                    </span>
                    <span>
                      Dead Zones:{" "}
                      <strong className="text-accent-orange">
                        {reportModel.coverage.result.deadZones.length}
                      </strong>
                    </span>
                  </div>

                  <div className="flex justify-center rounded-lg border border-border-default bg-surface-canvas p-2">
                    <canvas
                      ref={covCanvasRef}
                      width={800}
                      height={420}
                      className="max-h-[420px] w-full rounded object-contain shadow-inner"
                    />
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs italic text-text-muted">Wireless coverage has not been computed for this design.</p>
              )}
            </section>

            {/* SECTION 8: Network Simulation */}
            <section
              id="section-simulation"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-text-primary">7. Network Simulation & Failure Scenarios</h3>
                  <p className="mt-1 text-xs text-text-secondary">
                    Dijkstra shortest-path forwarding, bottleneck throughput estimation, and failure injection resilience.
                  </p>
                </div>
                {renderFreshnessBadge(reportModel.simulation.status)}
              </div>

              {reportModel.simulation.result ? (
                <div className="mt-4 space-y-4">
                  <div className="overflow-x-auto rounded border border-border-default">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-raised text-text-secondary">
                        <tr>
                          <th className="px-3 py-2">Flow ID</th>
                          <th className="px-3 py-2">Endpoints</th>
                          <th className="px-3 py-2">Reachability</th>
                          <th className="px-3 py-2">Offered</th>
                          <th className="px-3 py-2">Delivered</th>
                          <th className="px-3 py-2">Latency</th>
                          <th className="px-3 py-2">Hops</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-default">
                        {reportModel.simulation.result.baselineFlows.map((f) => (
                          <tr key={f.flowId} className="hover:bg-surface-canvas">
                            <td className="px-3 py-2 font-mono text-[11px] text-text-muted">{f.flowId}</td>
                            <td className="px-3 py-2 text-text-primary">
                              {reportModel.subnets.find((s) => s.id === f.sourceSubnetId)?.name ?? f.sourceSubnetId} →{" "}
                              {reportModel.devices.find((d) => d.id === f.destinationDeviceId)?.name ?? f.destinationDeviceId}
                            </td>
                            <td className="px-3 py-2 font-semibold">
                              {f.reachable ? (
                                <span className="text-emerald-400">REACHABLE</span>
                              ) : (
                                <span className="text-red-400">UNREACHABLE</span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-mono">{f.offeredDemandMbps} Mbps</td>
                            <td className="px-3 py-2 font-mono">
                              {f.deliveredRateMbps !== null ? `${f.deliveredRateMbps.toFixed(1)} Mbps` : "Missing Cap"}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {f.latency ? `${f.latency.totalMs.toFixed(2)} ms` : "N/A"}
                            </td>
                            <td className="px-3 py-2">{f.hopCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-xs italic text-text-muted">Simulation has not been computed for this design.</p>
              )}
            </section>

            {/* SECTION 9: Assumptions & Disclaimers */}
            <section
              id="section-assumptions"
              className="rounded-lg border border-border-strong bg-surface-panel p-8 shadow-md"
            >
              <h3 className="text-base font-bold text-text-primary">8. Engineering Assumptions & Disclaimers</h3>
              <p className="mt-1 text-xs text-text-secondary">
                Model assumptions and technical parameter constraints applied to calculations.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-text-muted">Electricity Tariff:</span>
                  <p className="font-semibold text-text-primary">
                    {reportModel.assumptions.cost.electricityTariffPerKwh
                      ? `INR ${reportModel.assumptions.cost.electricityTariffPerKwh.amount} / kWh`
                      : "Not configured"}
                  </p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-text-muted">Power Duty Ratio:</span>
                  <p className="font-semibold text-text-primary">100% Continuous Draw (Fixed)</p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-text-muted">Forwarding Delay:</span>
                  <p className="font-semibold text-text-primary">{reportModel.assumptions.simulation.processingDelayMsPerHop} ms per intermediate hop</p>
                </div>
                <div className="rounded border border-border-default bg-surface-canvas p-3">
                  <span className="text-text-muted">Packet Size for Delay:</span>
                  <p className="font-semibold text-text-primary">{reportModel.assumptions.simulation.averagePacketSizeBytes} Bytes MTU</p>
                </div>
              </div>

              <div className="mt-6 border-t border-border-default pt-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Legal & Fidelity Notices</p>
                <ul className="mt-2 space-y-1 text-xs text-text-secondary">
                  {reportModel.disclaimers.map((d, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-accent-blue">•</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}