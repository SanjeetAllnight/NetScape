import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportModel } from "@/contracts/reports";
import type { AnalysisBlob } from "@/contracts/engines";
import type { Device } from "@/contracts/domain";
import type { DeviceId } from "@/contracts/primitives";
import { deriveLinkLengthM } from "@/domain/geo/localFrame";
import {
  renderGeographicSchematic,
  renderTopologySchematic,
  renderCoverageHeatmap,
} from "./schematicRenderer";

/**
 * Builds a deterministic, paginated A4 PDF engineering report.
 * Adheres strictly to the 9 approved sections in exact sequence (§6 P4-01B).
 */
export async function generateEngineeringReportPdf(
  report: ReportModel,
  coverageBlob: AnalysisBlob | null
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  let currentY = margin + 12;

  // Helper to add section heading
  const addSectionHeader = (
    title: string,
    badge?: { text: string; type: "current" | "stale" | "missing" }
  ) => {
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = margin + 12;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(2, 7, 10); // Midnight Black
    doc.text(title, margin, currentY);

    if (badge) {
      const badgeColor =
        badge.type === "current"
          ? [16, 185, 129] // Emerald
          : badge.type === "stale"
          ? [245, 158, 11] // Amber
          : [148, 163, 184]; // Gray
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(badgeColor[0]!, badgeColor[1]!, badgeColor[2]!);
      doc.text(`[${badge.text}]`, margin + doc.getTextWidth(title) + 4, currentY);
    }

    currentY += 4;
    doc.setDrawColor(2, 151, 222); // Electric Blue accent line
    doc.setLineWidth(0.6);
    doc.line(margin, currentY, margin + contentWidth, currentY);
    currentY += 8;
  };

  // Helper to safely get finalY from autoTable
  const getAutoTableFinalY = (): number => {
    return (
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      currentY
    );
  };

  // ----------------------------------------------------
  // SECTION 1: Cover and Project/Design Summary
  // ----------------------------------------------------
  doc.setFillColor(2, 7, 10); // Midnight Black
  doc.rect(margin, currentY, contentWidth, 32, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(2, 151, 222); // Electric Blue
  doc.text("NETSCAPE ENGINEERING REPORT", margin + 8, currentY + 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(
    "Smart Map-Based Network Infrastructure Planning Workstation",
    margin + 8,
    currentY + 19
  );
  doc.text(
    `Generated: ${new Date(report.generatedAt).toLocaleString()} (Local Offline Synthesis)`,
    margin + 8,
    currentY + 26
  );

  currentY += 38;

  // Metadata summary card
  autoTable(doc, {
    startY: currentY,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: [51, 65, 85] },
    body: [
      [
        { content: "Project Name:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        report.project.name,
        { content: "Design Name:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        `${report.design.name} (Rev ${report.design.revision})`,
      ],
      [
        { content: "Primary Region:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        report.region.label,
        { content: "Design ID:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        report.design.id,
      ],
      [
        { content: "Region Center:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        `${report.region.center.coordinates[1].toFixed(5)}° N, ${report.region.center.coordinates[0].toFixed(5)}° E`,
        { content: "Total Inventory:", styles: { fontStyle: "bold", textColor: [2, 7, 10] } },
        `${report.devices.length} Devices, ${report.links.length} Links, ${report.subnets.length} Subnets`,
      ],
    ],
    margin: { left: margin, right: margin },
  });

  currentY = getAutoTableFinalY() + 10;

  // ----------------------------------------------------
  // SECTION 2: Design Overview with Device & Link Tables
  // ----------------------------------------------------
  addSectionHeader("1. Design Overview & Equipment Inventory");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("1.1 Network Devices", margin, currentY);
  currentY += 3;

  const deviceRows = report.devices.map((d) => [
    d.name,
    d.type.toUpperCase(),
    `${d.position.coordinates[1].toFixed(5)}°, ${d.position.coordinates[0].toFixed(5)}°`,
    d.catalogItemId,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [["Device Name", "Type", "Position (Lat, Lon)", "Catalog Item Reference"]],
    body: deviceRows.length > 0 ? deviceRows : [["No devices placed in design", "-", "-", "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [7, 17, 23],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });

  currentY = getAutoTableFinalY() + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text("1.2 Network Links & Interconnects", margin, currentY);
  currentY += 3;

  const devMap = new Map<string, string>();
  const devicesById: Record<DeviceId, Device> = {} as Record<DeviceId, Device>;
  report.devices.forEach((d) => {
    devMap.set(d.id, d.name);
    devicesById[d.id] = d;
  });

  const linkRows = report.links.map((l) => {
    const lenM = deriveLinkLengthM(l, devicesById, report.project.frame);
    return [
      l.id.substring(0, 12),
      devMap.get(l.sourceDeviceId) ?? l.sourceDeviceId,
      devMap.get(l.targetDeviceId) ?? l.targetDeviceId,
      l.medium.toUpperCase(),
      l.installationMethod ?? "N/A",
      `${lenM.toFixed(1)} m`,
      l.capacityMbps ? `${l.capacityMbps} Mbps` : "Unconfigured",
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      ["Link ID", "Source Device", "Target Device", "Medium", "Installation", "Length", "Capacity"],
    ],
    body:
      linkRows.length > 0
        ? linkRows
        : [["No links authored in design", "-", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [7, 17, 23],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });

  currentY = getAutoTableFinalY() + 10;

  // ----------------------------------------------------
  // SECTION 3: Schematic Geographical Figure
  // ----------------------------------------------------
  addSectionHeader("2. Schematic Geographical Figure");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Generated from project frame and local metric coordinates. Depicts planning boundary, physical obstacles, devices, and link vectors.",
    margin,
    currentY
  );
  currentY += 5;

  const geoCanvas = document.createElement("canvas");
  geoCanvas.width = 1000;
  geoCanvas.height = 580;
  renderGeographicSchematic(geoCanvas, report);
  const geoImgData = geoCanvas.toDataURL("image/png");

  const figureH = 95;
  if (currentY + figureH > pageHeight - 20) {
    doc.addPage();
    currentY = margin + 12;
  }

  doc.addImage(geoImgData, "PNG", margin, currentY, contentWidth, figureH);
  currentY += figureH + 10;

  // ----------------------------------------------------
  // SECTION 4: Logical Topology Figure
  // ----------------------------------------------------
  addSectionHeader("3. Logical Topology Figure");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Rendered from authored logical layout positions and device interconnection graph. Independent of physical geographic coordinates.",
    margin,
    currentY
  );
  currentY += 5;

  const topoCanvas = document.createElement("canvas");
  topoCanvas.width = 1000;
  topoCanvas.height = 500;
  renderTopologySchematic(topoCanvas, report);
  const topoImgData = topoCanvas.toDataURL("image/png");

  const topoH = 85;
  if (currentY + topoH > pageHeight - 20) {
    doc.addPage();
    currentY = margin + 12;
  }

  doc.addImage(topoImgData, "PNG", margin, currentY, contentWidth, topoH);
  currentY += topoH + 10;

  // ----------------------------------------------------
  // SECTION 5: IPv4 Addressing Plan
  // ----------------------------------------------------
  const addrStatusBadge =
    report.design.addressing.allocationStatus === "current"
      ? { text: "Current", type: "current" as const }
      : report.design.addressing.allocationStatus === "outOfDate"
      ? { text: "Computed on an earlier version of the design", type: "stale" as const }
      : { text: "Not allocated", type: "missing" as const };

  addSectionHeader("4. IPv4 Addressing & VLSM Plan", addrStatusBadge);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Parent Network CIDR: ${report.design.addressing.parentCidr ?? "Not Configured"}`,
    margin,
    currentY
  );
  currentY += 5;

  const subnetRows = report.subnets.map((s) => [
    s.name,
    s.hostsRequired,
    s.allocatedCidr ?? "Unallocated",
    s.usableHostCapacity ?? "-",
    s.wastedUsableHosts ?? "-",
    s.servedByDeviceId ? devMap.get(s.servedByDeviceId) ?? s.servedByDeviceId : "None",
    s.allocationStatus,
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        "Subnet Name",
        "Required Hosts",
        "Allocated CIDR",
        "Usable Capacity",
        "Wasted Hosts",
        "Serving Device",
        "Status",
      ],
    ],
    body:
      subnetRows.length > 0 ? subnetRows : [["No subnets configured", "-", "-", "-", "-", "-", "-"]],
    theme: "striped",
    headStyles: {
      fillColor: [7, 17, 23],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
    },
    styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin },
  });

  currentY = getAutoTableFinalY() + 10;

  // ----------------------------------------------------
  // SECTION 6: Cost Breakdown and Chart
  // ----------------------------------------------------
  const costStatusBadge =
    report.cost.status === "current"
      ? { text: "Current", type: "current" as const }
      : report.cost.status === "outOfDate"
      ? { text: "Computed on an earlier version of the design", type: "stale" as const }
      : { text: "Not computed", type: "missing" as const };

  addSectionHeader("5. Cost Estimation (CAPEX, OPEX, TCO)", costStatusBadge);

  const costResult = report.cost.result;
  if (!costResult || report.cost.status === "missing") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Cost estimation has not been calculated for this design.", margin, currentY);
    currentY += 10;
  } else {
    // 3 Metric summary box
    const capexText =
      costResult.capex.total !== null
        ? `INR ${costResult.capex.total.amount.toFixed(2)}`
        : "Partial / Incomplete";
    const opexText =
      costResult.annualOpex.total !== null
        ? `INR ${costResult.annualOpex.total.amount.toFixed(2)}`
        : "Partial / Incomplete";
    const tcoText =
      costResult.tco.total !== null
        ? `INR ${costResult.tco.total.amount.toFixed(2)}`
        : "Partial / Incomplete";

    autoTable(doc, {
      startY: currentY,
      theme: "plain",
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: 3, textColor: [15, 23, 42], halign: "center" },
      head: [
        [
          "CAPEX (Initial Capital)",
          "Annual OPEX (Operational)",
          `TCO (${costResult.tcoHorizonYears}-Year Horizon)`,
        ],
      ],
      body: [[capexText, opexText, tcoText]],
      margin: { left: margin, right: margin },
    });

    currentY = getAutoTableFinalY() + 6;

    // Line items table
    const costRows = costResult.lineItems.map((item) => [
      item.category.toUpperCase(),
      item.label,
      `${item.quantity} ${item.unit}`,
      item.unitPrice !== null ? `INR ${item.unitPrice.amount.toFixed(2)}` : "Not configured",
      item.amount !== null ? `INR ${item.amount.amount.toFixed(2)}` : "Incomplete",
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [["Category", "Line Item Description", "Quantity / Unit", "Unit Rate", "Subtotal"]],
      body: costRows,
      theme: "striped",
      headStyles: {
        fillColor: [7, 17, 23],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
      },
      styles: { fontSize: 8, cellPadding: 2, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    currentY = getAutoTableFinalY() + 10;
  }

  // ----------------------------------------------------
  // SECTION 7: Coverage Figure, Statistics & Dead-Zone List
  // ----------------------------------------------------
  const covStatusBadge =
    report.coverage.status === "current"
      ? { text: "Current", type: "current" as const }
      : report.coverage.status === "outOfDate"
      ? { text: "Computed on an earlier version of the design", type: "stale" as const }
      : { text: "Not computed", type: "missing" as const };

  addSectionHeader("6. Wireless Coverage Analysis", covStatusBadge);

  const covResult = report.coverage.result;
  if (!covResult || report.coverage.status === "missing") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Wireless RF coverage simulation has not been computed for this design.",
      margin,
      currentY
    );
    currentY += 10;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `Coverage Ratio (≥ -75 dBm Threshold): ${covResult.coveragePercent.toFixed(1)}% | Dead Zones Identified: ${covResult.deadZones.length}`,
      margin,
      currentY
    );
    currentY += 5;

    // Render heatmap image
    const heatCanvas = document.createElement("canvas");
    heatCanvas.width = 800;
    heatCanvas.height = 420;
    renderCoverageHeatmap(heatCanvas, coverageBlob, report);
    const heatImgData = heatCanvas.toDataURL("image/png");

    const heatH = 80;
    if (currentY + heatH > pageHeight - 20) {
      doc.addPage();
      currentY = margin + 12;
    }

    doc.addImage(heatImgData, "PNG", margin, currentY, contentWidth, heatH);
    currentY += heatH + 6;

    // Dead zone table
    const dzRows = covResult.deadZones.map((dz, i) => [
      `DZ-${i + 1}`,
      `${dz.areaM2.toFixed(1)} m²`,
      `[${dz.centroidLocalM.x.toFixed(1)}, ${dz.centroidLocalM.y.toFixed(1)}]`,
      `${dz.worstRssiDbm} dBm`,
    ]);

    if (dzRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [["Dead Zone ID", "Unserved Area", "Centroid (East, North)", "Worst RSSI"]],
        body: dzRows,
        theme: "striped",
        headStyles: {
          fillColor: [7, 17, 23],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
        margin: { left: margin, right: margin },
      });
      currentY = getAutoTableFinalY() + 10;
    }
  }

  // ----------------------------------------------------
  // SECTION 8: Simulation Baseline & Failure Scenarios
  // ----------------------------------------------------
  const simStatusBadge =
    report.simulation.status === "current"
      ? { text: "Current", type: "current" as const }
      : report.simulation.status === "outOfDate"
      ? { text: "Computed on an earlier version of the design", type: "stale" as const }
      : { text: "Not computed", type: "missing" as const };

  addSectionHeader("7. Network Simulation & Failure Analysis", simStatusBadge);

  const simResult = report.simulation.result;
  if (!simResult || report.simulation.status === "missing") {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Network simulation has not been computed for this design.", margin, currentY);
    currentY += 10;
  } else {
    // Baseline flows table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text("7.1 Baseline Traffic Flows", margin, currentY);
    currentY += 3;

    const subnetMap = new Map<string, string>();
    report.subnets.forEach((s) => subnetMap.set(s.id, s.name));

    const flowRows = simResult.baselineFlows.map((f) => [
      f.flowId,
      subnetMap.get(f.sourceSubnetId) ?? f.sourceSubnetId,
      devMap.get(f.destinationDeviceId) ?? f.destinationDeviceId,
      f.reachable ? "REACHABLE" : "UNREACHABLE",
      `${f.offeredDemandMbps} Mbps`,
      f.deliveredRateMbps !== null ? `${f.deliveredRateMbps.toFixed(1)} Mbps` : "Missing Cap",
      f.latency ? `${f.latency.totalMs.toFixed(2)} ms` : "N/A",
      `${f.hopCount} hops`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        ["Flow ID", "Source Subnet", "Destination", "Reachability", "Offered", "Delivered", "Latency", "Hops"],
      ],
      body:
        flowRows.length > 0
          ? flowRows
          : [["No flows defined in simulation setup", "-", "-", "-", "-", "-", "-", "-"]],
      theme: "striped",
      headStyles: {
        fillColor: [7, 17, 23],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8,
      },
      styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: margin, right: margin },
    });

    currentY = getAutoTableFinalY() + 6;

    // Failure scenarios table
    if (simResult.scenarios.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 41, 59);
      doc.text("7.2 Injected Failure Scenarios", margin, currentY);
      currentY += 3;

      const scenRows = simResult.scenarios.map((scen) => [
        scen.name,
        scen.flowResults.filter((f) => f.reachable).length,
        scen.flowResults.filter((f) => !f.reachable).length,
        scen.flowResults.every((f) => f.reachable) ? "PASSED (Full Failover)" : "DEGRADED",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Scenario Name", "Reachable Flows", "Unreachable Flows", "Resilience Status"]],
        body: scenRows,
        theme: "striped",
        headStyles: {
          fillColor: [7, 17, 23],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8,
        },
        styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [30, 41, 59] },
        margin: { left: margin, right: margin },
      });

      currentY = getAutoTableFinalY() + 10;
    }
  }

  // ----------------------------------------------------
  // SECTION 9: Assumptions & Disclaimers
  // ----------------------------------------------------
  addSectionHeader("8. Engineering Assumptions & Disclaimers");

  const assumptionsData: [string, string][] = [
    ["Electricity Tariff Rate", `INR ${report.assumptions.cost.electricityTariffPerKwh} / kWh`],
    ["TCO Evaluation Horizon", `${report.assumptions.cost.tcoHorizonYears} Years`],
    ["Device Power Duty Cycle", "100% Continuous Nameplate Consumption (Fixed Assumption)"],
    ["Propagation Speed in Medium", "200,000 km/s (Nominal 2.0 × 10^8 m/s)"],
    [
      "Forwarding Delay per Hop",
      `${report.assumptions.simulation.processingDelayMsPerHop} ms (Fixed intermediate device delay)`,
    ],
    [
      "Packet Size for Delay Calculation",
      `${report.assumptions.simulation.averagePacketSizeBytes} Bytes (Nominal Ethernet MTU)`,
    ],
    ["Queueing Model", "None (M/M/1 queueing delay and buffer loss explicitly outside MVP scope)"],
    ["Wireless RF Model", "2D Log-distance path loss with material-specific wall crossing attenuation"],
  ];

  autoTable(doc, {
    startY: currentY,
    theme: "plain",
    columnStyles: { 0: { fontStyle: "bold", textColor: [30, 41, 59] } },
    styles: { fontSize: 8, cellPadding: 2, textColor: [51, 65, 85] },
    body: assumptionsData,
    margin: { left: margin, right: margin },
  });

  currentY = getAutoTableFinalY() + 6;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);

  report.disclaimers.forEach((d) => {
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = margin + 12;
    }
    doc.text(`• ${d}`, margin, currentY, { maxWidth: contentWidth });
    currentY += 4;
  });

  // ----------------------------------------------------
  // RUNNING HEADERS & FOOTERS (All Pages)
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (Pages > 1)
    if (i > 1) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text("NETSCAPE ENGINEERING REPORT", margin, 9);
      doc.text(`${report.project.name} | ${report.design.name}`, pageWidth - margin, 9, {
        align: "right",
      });

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, 11, pageWidth - margin, 11);
    }

    // Running Footer (All Pages)
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      "NetScape Infrastructure Planning Workstation — Local-First Engineering Report",
      margin,
      pageHeight - 7
    );
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7, { align: "right" });
  }

  return doc.output("blob");
}