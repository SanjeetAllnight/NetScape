import { useEffect, useRef } from "react";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { useDesignStore } from "@/stores/designStore";
import { useEditorStore } from "@/stores/editorStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { getApplicationContainer } from "@/application/container";
import { makeGeoPoint, localPointToGeo } from "@/domain/geo/localFrame";
import type { Device, Obstacle, Link } from "@/contracts/domain";
import type { Longitude, Latitude, Vec2 } from "@/contracts/primitives";
import type { DeviceType, ObstacleMaterial } from "@/contracts/enums";
import type { AnalysisRecord } from "@/contracts/engines";

// Material color definitions
const OBSTACLE_STYLES: Record<ObstacleMaterial, { color: string; fillColor: string; opacity: number; fillOpacity: number }> = {
  glass: { color: "#38bdf8", fillColor: "#38bdf8", opacity: 0.8, fillOpacity: 0.35 },
  drywall: { color: "#fbbf24", fillColor: "#fbbf24", opacity: 0.8, fillOpacity: 0.35 },
  brick: { color: "#f87171", fillColor: "#f87171", opacity: 0.85, fillOpacity: 0.4 },
  concrete: { color: "#94a3b8", fillColor: "#94a3b8", opacity: 0.9, fillOpacity: 0.5 },
  custom: { color: "#a855f7", fillColor: "#a855f7", opacity: 0.85, fillOpacity: 0.4 },
};

// Device SVG Icons
function getDeviceSvg(type: DeviceType, isSelected: boolean): string {
  const stroke = isSelected ? "#FC734D" : "#0297DE";
  const bg = isSelected ? "#10212A" : "#071117";
  const size = 32;

  let iconInner = "";
  if (type === "router") {
    iconInner = `<circle cx="16" cy="16" r="6" stroke="${stroke}" stroke-width="2" fill="none"/>
                 <path d="M16 6v4M16 22v4M6 16h4M22 16h4" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`;
  } else if (type === "switch") {
    iconInner = `<rect x="7" y="10" width="18" height="12" rx="2" stroke="${stroke}" stroke-width="2" fill="none"/>
                 <path d="M10 16h4M18 16h4M12 14l-2 2 2 2M20 14l2 2-2 2" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (type === "accessPoint") {
    iconInner = `<path d="M9 13a10 10 0 0 1 14 0M12 16a6 6 0 0 1 8 0M15.5 19.5a1 1 0 1 1 1 0" stroke="${stroke}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
  } else {
    // server
    iconInner = `<rect x="7" y="8" width="18" height="6" rx="1.5" stroke="${stroke}" stroke-width="1.5" fill="none"/>
                 <rect x="7" y="18" width="18" height="6" rx="1.5" stroke="${stroke}" stroke-width="1.5" fill="none"/>
                 <circle cx="10" cy="11" r="1" fill="${stroke}"/>
                 <circle cx="10" cy="21" r="1" fill="${stroke}"/>`;
  }

  return `
    <div style="
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${bg};
      border: 2px solid ${stroke};
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.6);
      cursor: pointer;
    ">
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
        ${iconInner}
      </svg>
    </div>
  `;
}

export function MapCanvas() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const aggregate = useDesignStore((s) => s.aggregate);
  const activeTool = useEditorStore((s) => s.activeTool);
  const catalogItemIdToPlace = useEditorStore((s) => s.catalogItemIdToPlace);
  const obstacleMaterialToPlace = useEditorStore((s) => s.obstacleMaterialToPlace);
  const selectedEntity = useEditorStore((s) => s.selectedEntity);
  const viewport = useEditorStore((s) => s.viewport);
  const linkDraft = useEditorStore((s) => s.linkDraft);
  const coverageOverlay = useEditorStore((s) => s.coverageOverlay);
  const coverageRecord = useAnalysisStore((s) => s.records.coverage as (Extract<AnalysisRecord, { type: "coverage" }>) | null);
  const coverageBlob = useAnalysisStore((s) => s.coverageBlob);

  // References to keep event handlers current
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;
  const obstacleMaterialRef = useRef(obstacleMaterialToPlace);
  obstacleMaterialRef.current = obstacleMaterialToPlace;
  const catalogItemRef = useRef(catalogItemIdToPlace);
  catalogItemRef.current = catalogItemIdToPlace;
  const linkDraftRef = useRef(linkDraft);
  linkDraftRef.current = linkDraft;

  // Layer groups
  const boundaryLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const coverageLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const obstaclesLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const linksLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const devicesLayerRef = useRef<L.LayerGroup>(L.layerGroup());

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const container = getApplicationContainer();
    const initialCenter: [number, number] = aggregate
      ? [aggregate.region.center.coordinates[1], aggregate.region.center.coordinates[0]]
      : viewport.center;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: viewport.zoom,
      attributionControl: false,
      zoomControl: false,
    });

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Attribution control
    L.control.attribution({ position: "bottomright", prefix: false }).addTo(map);

    // Tile Layer
    const tileConfig = container.tileSourceConfig;
    const tileLayer = L.tileLayer(tileConfig.urlTemplate, {
      attribution: tileConfig.attribution,
      maxZoom: tileConfig.maxZoom,
      minZoom: tileConfig.minZoom,
    });
    tileLayer.addTo(map);

    // Add layer groups in order
    boundaryLayerRef.current.addTo(map);
    coverageLayerRef.current.addTo(map);
    obstaclesLayerRef.current.addTo(map);
    linksLayerRef.current.addTo(map);
    devicesLayerRef.current.addTo(map);

    // Viewport persistence
    map.on("moveend", () => {
      const c = map.getCenter();
      useEditorStore.getState().setViewport({
        center: [c.lat, c.lng],
        zoom: map.getZoom(),
      });
    });

    // Map Click: place device or deselect
    map.on("click", (e: L.LeafletMouseEvent) => {
      const tool = activeToolRef.current;
      const catId = catalogItemRef.current;

      if (tool === "place-device" && catId) {
        container.designSession.dispatch({
          type: "device/add",
          catalogItemId: catId,
          position: makeGeoPoint(e.latlng.lng, e.latlng.lat),
        });
        useEditorStore.getState().setActiveTool("select");
        useEditorStore.getState().setCatalogItemIdToPlace(null);
      } else if (tool === "select") {
        useEditorStore.getState().setSelectedEntity(null);
      }
    });

    // Geoman Setup
    if (map.pm) {
      map.pm.setGlobalOptions({
        snappable: true,
        snapDistance: 15,
        allowSelfIntersection: false,
      });

      // On Geoman Polygon Creation: PURGE TEMPORARY LAYER IMMEDIATELY
      map.on("pm:create", (e: { layer?: L.Layer }) => {
        const layer = e.layer;
        if (layer && layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs();
          const outerRing: L.LatLng[] = Array.isArray(latlngs[0])
            ? (latlngs[0] as L.LatLng[])
            : (latlngs as L.LatLng[]);

          const coords: [Longitude, Latitude][] = outerRing.map((ll) => [
            ll.lng as Longitude,
            ll.lat as Latitude,
          ]);

          // Close polygon ring
          if (coords.length > 0) {
            const first = coords[0]!;
            const last = coords[coords.length - 1]!;
            if (first[0] !== last[0] || first[1] !== last[1]) {
              coords.push([first[0], first[1]]);
            }
          }

          // PURGE TEMPORARY GEOMAN LAYER
          map.removeLayer(layer);

          if (activeToolRef.current === "draw-boundary") {
            container.designSession.dispatch({
              type: "region/setBoundary",
              boundary: {
                type: "Polygon",
                coordinates: [coords],
              },
            });
          } else if (activeToolRef.current === "draw-obstacle") {
            container.designSession.dispatch({
              type: "obstacle/add",
              geometry: {
                type: "Polygon",
                coordinates: [coords],
              },
              material: obstacleMaterialRef.current,
            });
          }

          useEditorStore.getState().setActiveTool("select");
        }
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Geoman Drawing Mode based on activeTool
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !map.pm) return;

    if (activeTool === "draw-boundary" || activeTool === "draw-obstacle") {
      map.pm.enableDraw("Polygon", {
        snappable: true,
        snapDistance: 15,
        allowSelfIntersection: false,
      });
    } else {
      map.pm.disableDraw();
    }
  }, [activeTool]);

  // Programmatic Viewport Synchronization (e.g. Focus on Dead Zone)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const currentCenter = map.getCenter();
    const currentZoom = map.getZoom();
    const [targetLat, targetLng] = viewport.center;
    const dist = Math.hypot(currentCenter.lat - targetLat, currentCenter.lng - targetLng);
    if (dist > 1e-5 || currentZoom !== viewport.zoom) {
      map.setView(viewport.center, viewport.zoom);
    }
  }, [viewport.center, viewport.zoom]);

  // Declarative Coverage Raster Overlay Render
  useEffect(() => {
    const group = coverageLayerRef.current;
    group.clearLayers();

    if (
      !coverageOverlay.visible ||
      !coverageBlob ||
      !coverageRecord ||
      !aggregate?.project.frame
    ) {
      return;
    }

    const { width, height } = coverageBlob;
    if (width <= 0 || height <= 0) return;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const thresholds = coverageRecord.result.parameters?.signalThresholdsDbm ?? {
      excellentMin: -65,
      goodMin: -75,
      fairMin: -85,
      weakMin: -90,
    };
    const alpha = Math.min(255, Math.max(0, Math.round((coverageOverlay.opacity ?? 0.7) * 255)));

    for (let canvasRow = 0; canvasRow < height; canvasRow++) {
      // In cartesian frame, row 0 is minY (South) and row height-1 is maxY (North).
      // On canvas, canvasRow 0 is North and canvasRow height-1 is South.
      const dataRow = height - 1 - canvasRow;
      for (let col = 0; col < width; col++) {
        const dataIdx = dataRow * width + col;
        const pxIdx = (canvasRow * width + col) * 4;
        const serving = coverageBlob.servingIndex[dataIdx];
        const rssi = coverageBlob.rssiDbm[dataIdx] ?? -127;

        if (serving === 254) {
          // Outside planning mask
          data[pxIdx] = 0;
          data[pxIdx + 1] = 0;
          data[pxIdx + 2] = 0;
          data[pxIdx + 3] = 0;
        } else if (serving === 255 || rssi < thresholds.weakMin) {
          // Inside mask, dead zone
          if (coverageOverlay.showDeadZones) {
            data[pxIdx] = 239;
            data[pxIdx + 1] = 68;
            data[pxIdx + 2] = 68;
            data[pxIdx + 3] = Math.min(255, Math.round(alpha * 1.15));
          } else {
            data[pxIdx] = 0;
            data[pxIdx + 1] = 0;
            data[pxIdx + 2] = 0;
            data[pxIdx + 3] = 0;
          }
        } else if (rssi >= thresholds.excellentMin) {
          // Excellent: Emerald green #10B981
          data[pxIdx] = 16;
          data[pxIdx + 1] = 185;
          data[pxIdx + 2] = 129;
          data[pxIdx + 3] = alpha;
        } else if (rssi >= thresholds.goodMin) {
          // Good: Sky blue #0297DE
          data[pxIdx] = 2;
          data[pxIdx + 1] = 151;
          data[pxIdx + 2] = 222;
          data[pxIdx + 3] = alpha;
        } else if (rssi >= thresholds.fairMin) {
          // Fair: Amber #F59E0B
          data[pxIdx] = 245;
          data[pxIdx + 1] = 158;
          data[pxIdx + 2] = 11;
          data[pxIdx + 3] = alpha;
        } else {
          // Weak: Orange #F97316
          data[pxIdx] = 249;
          data[pxIdx + 1] = 115;
          data[pxIdx + 2] = 22;
          data[pxIdx + 3] = alpha;
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    const grid = coverageRecord.result.grid;
    const nwM: Vec2 = grid.topLeftLocalM;
    const seM: Vec2 = {
      coordinateSpace: "projectMetric",
      x: nwM.x + grid.width * grid.cellSizeM,
      y: nwM.y - grid.height * grid.cellSizeM,
    };

    const nwGeo = localPointToGeo(nwM, aggregate.project.frame);
    const seGeo = localPointToGeo(seM, aggregate.project.frame);
    const bounds = L.latLngBounds(
      [nwGeo.coordinates[1], nwGeo.coordinates[0]],
      [seGeo.coordinates[1], seGeo.coordinates[0]]
    );

    const overlay = L.imageOverlay(canvas.toDataURL(), bounds, { interactive: false });
    group.addLayer(overlay);

    return () => {
      group.clearLayers();
    };
  }, [
    coverageOverlay.visible,
    coverageOverlay.opacity,
    coverageOverlay.showDeadZones,
    coverageBlob,
    coverageRecord,
    aggregate?.project.frame,
  ]);

  // Declarative Boundary Render
  useEffect(() => {
    const group = boundaryLayerRef.current;
    group.clearLayers();

    if (!aggregate?.region.boundary) return;

    const rings = aggregate.region.boundary.coordinates;
    const latlngs = rings.map((ring) =>
      ring.map(([lng, lat]) => [lat, lng] as [number, number])
    );

    const boundaryPoly = L.polygon(latlngs, {
      color: "#0297DE",
      weight: 2,
      dashArray: "6, 8",
      fillColor: "#0297DE",
      fillOpacity: 0.05,
      interactive: false,
    });
    group.addLayer(boundaryPoly);
  }, [aggregate?.region.boundary]);

  // Declarative Obstacles Render
  useEffect(() => {
    const group = obstaclesLayerRef.current;
    group.clearLayers();

    if (!aggregate) return;

    for (const obs of Object.values(aggregate.obstaclesById) as Obstacle[]) {
      const rings = obs.geometry.coordinates;
      const latlngs = rings.map((ring) =>
        ring.map(([lng, lat]) => [lat, lng] as [number, number])
      );

      const style = OBSTACLE_STYLES[obs.material] ?? OBSTACLE_STYLES.brick;
      const isSelected = selectedEntity?.type === "obstacle" && selectedEntity.id === obs.id;

      const poly = L.polygon(latlngs, {
        color: isSelected ? "#FC734D" : style.color,
        weight: isSelected ? 3 : 1.5,
        fillColor: style.fillColor,
        fillOpacity: style.fillOpacity,
      });

      poly.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        useEditorStore.getState().setSelectedEntity({ type: "obstacle", id: obs.id });
      });

      poly.bindTooltip(
        `${obs.label ?? obs.material} (${obs.material}, -${obs.lossDbPerCrossing} dB)`,
        { direction: "top", className: "bg-surface-raised text-text-primary text-[10px] border border-border-strong rounded px-1.5 py-0.5" }
      );

      group.addLayer(poly);
    }
  }, [aggregate?.obstaclesById, selectedEntity]);

  // Declarative Links Render
  useEffect(() => {
    const group = linksLayerRef.current;
    group.clearLayers();

    if (!aggregate) return;

    for (const link of Object.values(aggregate.linksById) as Link[]) {
      const sourceDev = aggregate.devicesById[link.sourceDeviceId];
      const targetDev = aggregate.devicesById[link.targetDeviceId];
      if (!sourceDev || !targetDev) continue;

      const latlngs: [number, number][] = [
        [sourceDev.position.coordinates[1], sourceDev.position.coordinates[0]],
        [targetDev.position.coordinates[1], targetDev.position.coordinates[0]],
      ];

      const isSelected = selectedEntity?.type === "link" && selectedEntity.id === link.id;

      let color = "#0297DE"; // copper
      let dashArray: string | undefined = undefined;
      if (link.medium === "fiber") {
        color = "#FC734D";
      } else if (link.medium === "wireless") {
        color = "#35A879";
        dashArray = "6, 8";
      }

      const polyline = L.polyline(latlngs, {
        color: isSelected ? "#FFFFFF" : color,
        weight: isSelected ? 4 : 2.5,
        dashArray,
        opacity: 0.9,
      });

      polyline.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);
        useEditorStore.getState().setSelectedEntity({ type: "link", id: link.id });
      });

      group.addLayer(polyline);
    }
  }, [aggregate?.linksById, aggregate?.devicesById, selectedEntity]);

  // Declarative Devices Render
  useEffect(() => {
    const group = devicesLayerRef.current;
    group.clearLayers();

    if (!aggregate) return;
    const container = getApplicationContainer();

    for (const device of Object.values(aggregate.devicesById) as Device[]) {
      const isSelected = selectedEntity?.type === "device" && selectedEntity.id === device.id;
      const latlng: [number, number] = [
        device.position.coordinates[1],
        device.position.coordinates[0],
      ];

      const customIcon = L.divIcon({
        className: "custom-device-icon",
        html: getDeviceSvg(device.type, isSelected),
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(latlng, {
        icon: customIcon,
        draggable: true,
      });

      // Drag and drop position update
      marker.on("dragend", () => {
        const newPos = marker.getLatLng();
        container.designSession.dispatch({
          type: "device/move",
          deviceId: device.id,
          position: makeGeoPoint(newPos.lng, newPos.lat),
        });
      });

      // Click: handle two-click link creation OR selection
      marker.on("click", (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e);

        const currentTool = activeToolRef.current;
        const currentDraft = linkDraftRef.current;

        if (currentTool === "connect-link") {
          if (!currentDraft?.sourceDeviceId) {
            // First click: select source device
            useEditorStore.getState().setLinkDraft({
              sourceDeviceId: device.id,
              medium: currentDraft?.medium ?? "copper",
              sourcePosition: device.position,
              mousePosition: null,
            });
          } else if (currentDraft.sourceDeviceId !== device.id) {
            // Second click: connect devices!
            container.designSession.dispatch({
              type: "link/add",
              sourceDeviceId: currentDraft.sourceDeviceId,
              targetDeviceId: device.id,
              medium: currentDraft.medium,
            });
            useEditorStore.getState().setLinkDraft(null);
            useEditorStore.getState().setActiveTool("select");
          }
        } else {
          useEditorStore.getState().setSelectedEntity({ type: "device", id: device.id });
        }
      });

      marker.bindTooltip(device.name, {
        direction: "bottom",
        offset: [0, 10],
        className: "bg-surface-raised text-text-primary text-[11px] font-medium border border-border-strong rounded px-1.5 py-0.5",
      });

      group.addLayer(marker);
    }
  }, [aggregate?.devicesById, selectedEntity]);

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full relative outline-none bg-surface-canvas"
      style={{
        backgroundImage: "radial-gradient(#172A34 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    />
  );
}
