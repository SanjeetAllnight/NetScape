import type { ReportModel } from "@/contracts/reports";
import type { AnalysisBlob } from "@/contracts/engines";
import type { Device } from "@/contracts/domain";

/**
 * Pure 2D canvas renderers for report figures.
 * Operates purely from domain model coordinates and saved analysis blobs.
 * NEVER screenshots Leaflet canvas or requests live tiles.
 */

export function renderGeographicSchematic(
  canvas: HTMLCanvasElement,
  report: ReportModel
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  // Dark workstation background
  ctx.fillStyle = "#071117";
  ctx.fillRect(0, 0, width, height);

  // Collect all coordinates to compute geographic bounding box
  const allPoints: [number, number][] = [];

  const boundary = report.region.boundary;
  if (boundary && boundary.coordinates[0]) {
    for (const [lng, lat] of boundary.coordinates[0]) {
      allPoints.push([lng, lat]);
    }
  }

  for (const obs of report.obstacles) {
    if (obs.geometry.coordinates[0]) {
      for (const [lng, lat] of obs.geometry.coordinates[0]) {
        allPoints.push([lng, lat]);
      }
    }
  }

  for (const dev of report.devices) {
    allPoints.push([dev.position.coordinates[0], dev.position.coordinates[1]]);
  }

  if (allPoints.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No geographic features or devices placed in design", width / 2, height / 2);
    return;
  }

  let minLng = Math.min(...allPoints.map((p) => p[0]));
  let maxLng = Math.max(...allPoints.map((p) => p[0]));
  let minLat = Math.min(...allPoints.map((p) => p[1]));
  let maxLat = Math.max(...allPoints.map((p) => p[1]));

  // Ensure minimum delta
  if (maxLng - minLng < 0.0001) {
    minLng -= 0.0005;
    maxLng += 0.0005;
  }
  if (maxLat - minLat < 0.0001) {
    minLat -= 0.0005;
    maxLat += 0.0005;
  }

  const midLat = (minLat + maxLat) / 2;
  const latCos = Math.cos((midLat * Math.PI) / 180);

  // Equalize aspect ratio
  const pad = 48;
  const availW = width - pad * 2;
  const availH = height - pad * 2;

  let spanLng = maxLng - minLng;
  let spanLat = maxLat - minLat;

  const spanLngM = spanLng * 111320 * latCos;
  const spanLatM = spanLat * 110540;

  if (spanLngM / availW > spanLatM / availH) {
    const targetLatM = (spanLngM / availW) * availH;
    const diffLat = (targetLatM - spanLatM) / 110540;
    minLat -= diffLat / 2;
    maxLat += diffLat / 2;
  } else {
    const targetLngM = (spanLatM / availH) * availW;
    const diffLng = (targetLngM - spanLngM) / (111320 * latCos);
    minLng -= diffLng / 2;
    maxLng += diffLng / 2;
  }

  spanLng = maxLng - minLng;
  spanLat = maxLat - minLat;

  const toX = (lng: number) => pad + ((lng - minLng) / spanLng) * availW;
  const toY = (lat: number) => height - pad - ((lat - minLat) / spanLat) * availH;

  // 1. Draw Planning Boundary Polygon
  if (boundary && boundary.coordinates[0]?.length) {
    ctx.beginPath();
    boundary.coordinates[0].forEach(([lng, lat], i) => {
      const x = toX(lng);
      const y = toY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(2, 151, 222, 0.08)";
    ctx.fill();
    ctx.strokeStyle = "#0297DE";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Draw Obstacles
  const OBSTACLE_COLORS: Record<string, { stroke: string; fill: string }> = {
    glass: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.25)" },
    drywall: { stroke: "#fbbf24", fill: "rgba(251, 191, 36, 0.25)" },
    brick: { stroke: "#f87171", fill: "rgba(248, 113, 113, 0.3)" },
    concrete: { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.35)" },
    custom: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.3)" },
  };

  for (const obs of report.obstacles) {
    const ring = obs.geometry.coordinates[0];
    if (!ring?.length) continue;

    ctx.beginPath();
    ring.forEach(([lng, lat], i) => {
      const x = toX(lng);
      const y = toY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();

    const style = OBSTACLE_COLORS[obs.material] ?? OBSTACLE_COLORS.custom!;
    ctx.fillStyle = style.fill;
    ctx.fill();
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 3. Draw Links
  const devMap = new Map<string, Device>();
  report.devices.forEach((d) => devMap.set(d.id, d));

  const LINK_COLORS: Record<string, string> = {
    copper: "#fbbf24",
    fiber: "#06b6d4",
    wireless: "#c084fc",
  };

  for (const link of report.links) {
    const src = devMap.get(link.sourceDeviceId);
    const tgt = devMap.get(link.targetDeviceId);
    if (!src || !tgt) continue;

    const x1 = toX(src.position.coordinates[0]);
    const y1 = toY(src.position.coordinates[1]);
    const x2 = toX(tgt.position.coordinates[0]);
    const y2 = toY(tgt.position.coordinates[1]);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = LINK_COLORS[link.medium] ?? "#94a3b8";
    ctx.lineWidth = link.medium === "fiber" ? 2.5 : 2;
    if (link.medium === "wireless") {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. Draw Devices
  for (const dev of report.devices) {
    const x = toX(dev.position.coordinates[0]);
    const y = toY(dev.position.coordinates[1]);

    // Outer glow
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = "#10212A";
    ctx.fill();
    ctx.strokeStyle = "#0297DE";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center icon dot
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fillStyle = dev.type === "router" ? "#FC734D" : dev.type === "server" ? "#10b981" : "#0297DE";
    ctx.fill();

    // Device Label
    ctx.font = "10px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#e2e8f0";
    ctx.fillText(dev.name, x, y + 18);
  }

  // 5. North Arrow
  const arrowX = width - 36;
  const arrowY = 36;
  ctx.strokeStyle = "#0297DE";
  ctx.fillStyle = "#0297DE";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY - 14);
  ctx.lineTo(arrowX - 6, arrowY + 6);
  ctx.lineTo(arrowX, arrowY + 2);
  ctx.lineTo(arrowX + 6, arrowY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.font = "bold 11px Noto Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("N", arrowX, arrowY - 18);

  // 6. Scale bar
  const totalMeters = spanLng * 111320 * latCos;
  const pixelsPerMeter = availW / totalMeters;
  let scaleMeters = 50;
  if (totalMeters > 500) scaleMeters = 200;
  if (totalMeters > 1000) scaleMeters = 500;
  if (totalMeters > 2000) scaleMeters = 1000;

  const scaleBarPx = scaleMeters * pixelsPerMeter;
  const barX = pad;
  const barY = height - 16;

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(barX, barY);
  ctx.lineTo(barX + scaleBarPx, barY);
  ctx.stroke();

  ctx.font = "10px Noto Sans Mono, monospace";
  ctx.textAlign = "left";
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`${scaleMeters} m`, barX + scaleBarPx + 8, barY + 3);

  // 7. Legend
  const legX = width - 180;
  const legY = height - 60;
  ctx.fillStyle = "rgba(10, 20, 29, 0.85)";
  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 1;
  ctx.fillRect(legX, legY, 160, 48);
  ctx.strokeRect(legX, legY, 160, 48);

  ctx.font = "9px Noto Sans, sans-serif";
  ctx.textAlign = "left";

  // Legend items
  ctx.fillStyle = "#FC734D";
  ctx.fillRect(legX + 8, legY + 8, 8, 8);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Router", legX + 20, legY + 15);

  ctx.fillStyle = "#0297DE";
  ctx.fillRect(legX + 80, legY + 8, 8, 8);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Switch / AP", legX + 92, legY + 15);

  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(legX + 8, legY + 28, 8, 2);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Copper", legX + 20, legY + 33);

  ctx.fillStyle = "#06b6d4";
  ctx.fillRect(legX + 80, legY + 28, 8, 2);
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText("Fiber", legX + 92, legY + 33);
}

/**
 * Pure 2D canvas renderer for logical topology diagram.
 */
export function renderTopologySchematic(
  canvas: HTMLCanvasElement,
  report: ReportModel
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#071117";
  ctx.fillRect(0, 0, width, height);

  const devices = report.devices;
  if (devices.length === 0) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No devices in logical topology", width / 2, height / 2);
    return;
  }

  // Derive coordinates from layout or calculate clean layout
  const layoutPos = report.design.logicalLayout;
  const posMap = new Map<string, { x: number; y: number }>();

  let hasLayout = false;
  devices.forEach((d) => {
    const p = layoutPos[d.id];
    if (p) {
      posMap.set(d.id, { x: p.x, y: p.y });
      hasLayout = true;
    }
  });

  if (!hasLayout || posMap.size < devices.length) {
    // Generate clean circular / tree layout
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.35;
    devices.forEach((d, i) => {
      const angle = (i / devices.length) * Math.PI * 2 - Math.PI / 2;
      posMap.set(d.id, {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      });
    });
  } else {
    // Normalize existing positions to canvas bounds
    const xs = Array.from(posMap.values()).map((p) => p.x);
    const ys = Array.from(posMap.values()).map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 60;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    devices.forEach((d) => {
      const raw = posMap.get(d.id)!;
      posMap.set(d.id, {
        x: pad + ((raw.x - minX) / spanX) * (width - pad * 2),
        y: pad + ((raw.y - minY) / spanY) * (height - pad * 2),
      });
    });
  }

  // 1. Draw Links
  ctx.lineWidth = 2;
  for (const link of report.links) {
    const p1 = posMap.get(link.sourceDeviceId);
    const p2 = posMap.get(link.targetDeviceId);
    if (!p1 || !p2) continue;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = link.medium === "fiber" ? "#06b6d4" : link.medium === "copper" ? "#fbbf24" : "#c084fc";
    if (link.medium === "wireless") {
      ctx.setLineDash([4, 4]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 2. Draw Nodes
  for (const dev of devices) {
    const pos = posMap.get(dev.id)!;
    const nodeW = 100;
    const nodeH = 44;
    const nx = pos.x - nodeW / 2;
    const ny = pos.y - nodeH / 2;

    // Node body
    ctx.fillStyle = "#0c1820";
    ctx.strokeStyle = "#0297DE";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(nx, ny, nodeW, nodeH, 6);
    } else {
      ctx.rect(nx, ny, nodeW, nodeH);
    }
    ctx.fill();
    ctx.stroke();

    // Node header color tag
    ctx.fillStyle = dev.type === "router" ? "#FC734D" : dev.type === "server" ? "#10b981" : "#0297DE";
    ctx.fillRect(nx, ny, nodeW, 4);

    // Node text
    ctx.font = "bold 10px Noto Sans, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.fillText(dev.name, pos.x, ny + 19);

    ctx.font = "9px Noto Sans Mono, monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(dev.type.toUpperCase(), pos.x, ny + 33);
  }
}

/**
 * Pure 2D canvas renderer for wireless coverage heatmap figure.
 */
export function renderCoverageHeatmap(
  canvas: HTMLCanvasElement,
  blob: AnalysisBlob | null,
  report: ReportModel
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = "#071117";
  ctx.fillRect(0, 0, width, height);

  if (!blob || report.coverage.status === "missing") {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "14px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Coverage analysis not computed", width / 2, height / 2);
    return;
  }

  // Render raw raster onto an offscreen canvas
  const offCanvas = document.createElement("canvas");
  offCanvas.width = blob.width;
  offCanvas.height = blob.height;
  const offCtx = offCanvas.getContext("2d");
  if (!offCtx) return;

  const imgData = offCtx.createImageData(blob.width, blob.height);
  const data = imgData.data;

  for (let i = 0; i < blob.servingIndex.length; i++) {
    const sIdx = blob.servingIndex[i];
    const rssi = blob.rssiDbm[i] ?? -128;
    const p = i * 4;

    if (sIdx === 254) {
      // Transparent outside mask
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      data[p + 3] = 0;
    } else if (sIdx === 255 || rssi === -128) {
      // In-mask unserved dead-zone
      data[p] = 51;
      data[p + 1] = 65;
      data[p + 2] = 85;
      data[p + 3] = 200;
    } else {
      // 5-class colormap
      let r = 239, g = 68, b = 68; // < -85
      if (rssi >= -50) {
        r = 16; g = 185; b = 129; // >= -50 emerald
      } else if (rssi >= -65) {
        r = 6; g = 182; b = 212; // -65 to -50 cyan
      } else if (rssi >= -75) {
        r = 59; g = 130; b = 246; // -75 to -65 blue
      } else if (rssi >= -85) {
        r = 245; g = 158; b = 11; // -85 to -75 amber
      }
      data[p] = r;
      data[p + 1] = g;
      data[p + 2] = b;
      data[p + 3] = 220;
    }
  }

  offCtx.putImageData(imgData, 0, 0);

  // Draw offscreen raster onto main canvas, maintaining aspect ratio
  const pad = 24;
  const availW = width - pad * 2;
  const availH = height - pad * 2 - 30; // leave space for legend

  const scale = Math.min(availW / blob.width, availH / blob.height);
  const drawW = blob.width * scale;
  const drawH = blob.height * scale;
  const drawX = pad + (availW - drawW) / 2;
  const drawY = pad + (availH - drawH) / 2;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(offCanvas, drawX, drawY, drawW, drawH);

  // Stale watermark if out of date
  if (report.coverage.status === "outOfDate") {
    ctx.fillStyle = "rgba(245, 158, 11, 0.9)";
    ctx.font = "bold 13px Noto Sans, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Computed on an earlier version of the design", width / 2, 20);
  }

  // Draw 5-class colorbar legend at bottom
  const barY = height - 24;
  const barW = 320;
  const barX = (width - barW) / 2;
  const colW = barW / 5;

  const CLASSES = [
    { label: "≥ -50", color: "#10b981" },
    { label: "-65", color: "#06b6d4" },
    { label: "-75", color: "#3b82f6" },
    { label: "-85", color: "#f59e0b" },
    { label: "< -85", color: "#ef4444" },
  ];

  ctx.font = "9px Noto Sans Mono, monospace";
  ctx.textAlign = "center";

  CLASSES.forEach((c, idx) => {
    ctx.fillStyle = c.color;
    ctx.fillRect(barX + idx * colW, barY, colW, 8);
    ctx.fillStyle = "#cbd5e1";
    ctx.fillText(c.label, barX + idx * colW + colW / 2, barY + 20);
  });
}
