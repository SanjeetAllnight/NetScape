import { useState } from "react";
import {
  MousePointer,
  Router,
  Server,
  Wifi,
  Network,
  Shield,
  Waypoints,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import type { DeviceType, ObstacleMaterial, LinkMedium } from "@/contracts/enums";
import type { CatalogItemId, Longitude, Latitude } from "@/contracts/primitives";

interface DevicePaletteProps {
  onOpenTemplates?: () => void;
}

export function DevicePalette({ onOpenTemplates }: DevicePaletteProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeTool = useEditorStore((s) => s.activeTool);
  const catalogItemIdToPlace = useEditorStore((s) => s.catalogItemIdToPlace);
  const obstacleMaterialToPlace = useEditorStore((s) => s.obstacleMaterialToPlace);
  const setActiveTool = useEditorStore((s) => s.setActiveTool);
  const setCatalogItemIdToPlace = useEditorStore((s) => s.setCatalogItemIdToPlace);
  const setObstacleMaterialToPlace = useEditorStore((s) => s.setObstacleMaterialToPlace);
  const linkDraft = useEditorStore((s) => s.linkDraft);
  const setLinkDraft = useEditorStore((s) => s.setLinkDraft);

  const aggregate = useDesignStore((s) => s.aggregate);
  const catalog = aggregate?.catalogById ?? {};

  // Group catalogue items by type
  const itemsByType = Object.values(catalog).reduce<Record<DeviceType, CatalogItemId | null>>(
    (acc, item) => {
      acc[item.type] = item.id;
      return acc;
    },
    { router: null, switch: null, accessPoint: null, server: null }
  );

  const handleSelectDevice = (type: DeviceType) => {
    const id = itemsByType[type];
    if (id) {
      setCatalogItemIdToPlace(id);
    }
  };

  const handleSelectConnect = (medium: LinkMedium = "copper") => {
    setActiveTool("connect-link");
    setLinkDraft({
      sourceDeviceId: "" as never,
      medium,
      sourcePosition: { type: "Point", coordinates: [0 as Longitude, 0 as Latitude] },
      mousePosition: null,
    });
  };

  return (
    <div
      className={`absolute top-4 left-4 z-[400] flex flex-col bg-surface-raised/95 backdrop-blur-md rounded-xl border border-border-strong shadow-2xl text-xs select-none transition-all duration-150 ${
        isExpanded ? "w-44 p-2 gap-1" : "w-11 p-1.5 gap-1.5 items-center"
      }`}
      aria-label="Authoring Tool Rail"
    >
      {/* Expand / Collapse Header */}
      <div className={`flex items-center ${isExpanded ? "justify-between px-1 mb-1" : "justify-center"}`}>
        {isExpanded && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold">
            Tools
          </span>
        )}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          title={isExpanded ? "Collapse tool rail" : "Expand tool rail"}
        >
          {isExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Select Pointer */}
      <button
        onClick={() => {
          setActiveTool("select");
          setCatalogItemIdToPlace(null);
          setLinkDraft(null);
        }}
        title="Select & Move (V)"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
          activeTool === "select"
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <MousePointer className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Select / Move</span>}
      </button>

      <div className="h-px bg-border-subtle my-0.5 w-full" />

      {/* 4 Device Types */}
      <button
        onClick={() => handleSelectDevice("router")}
        title="Place Router"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.router
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Router className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Router</span>}
      </button>

      <button
        onClick={() => handleSelectDevice("switch")}
        title="Place Switch"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.switch
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Network className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Switch</span>}
      </button>

      <button
        onClick={() => handleSelectDevice("accessPoint")}
        title="Place Wi-Fi Access Point"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.accessPoint
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Wifi className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Access Point</span>}
      </button>

      <button
        onClick={() => handleSelectDevice("server")}
        title="Place Server"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.server
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Server className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Server</span>}
      </button>

      <div className="h-px bg-border-subtle my-0.5 w-full" />

      {/* Connect Link Tool */}
      <button
        onClick={() => handleSelectConnect("copper")}
        title="Connect Devices (Two-click link)"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
          activeTool === "connect-link"
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Waypoints className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Connect Link</span>}
      </button>

      <div className="h-px bg-border-subtle my-0.5 w-full" />

      {/* Draw Planning Boundary */}
      <button
        onClick={() => {
          setActiveTool("draw-boundary");
          setCatalogItemIdToPlace(null);
          setLinkDraft(null);
        }}
        title="Draw Planning Boundary (Geoman)"
        className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
          activeTool === "draw-boundary"
            ? "bg-violet text-carbon-deep font-semibold shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Shield className="w-4 h-4 shrink-0" />
        {isExpanded && <span>Boundary</span>}
      </button>

      {/* Draw Manual Obstacle */}
      <div className="relative group w-full">
        <button
          onClick={() => {
            setActiveTool("draw-obstacle");
            setCatalogItemIdToPlace(null);
            setLinkDraft(null);
          }}
          title="Draw Manual Obstacle Polygon"
          className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
            activeTool === "draw-obstacle"
              ? "bg-violet text-carbon-deep font-semibold shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
          }`}
        >
          <div className="w-4 h-4 rounded border border-current flex items-center justify-center text-[10px] font-bold shrink-0">
            O
          </div>
          {isExpanded && <span>Obstacle</span>}
        </button>

        {/* Obstacle Material Selector on Click / Hover */}
        {activeTool === "draw-obstacle" && (
          <div className="absolute left-full ml-2 top-0 bg-surface-raised border border-border-strong rounded-lg shadow-2xl p-1.5 flex flex-col gap-1 w-28 z-50">
            <span className="text-[10px] font-mono text-text-muted px-1.5 py-0.5 uppercase font-semibold">
              Material:
            </span>
            {(["glass", "drywall", "brick", "concrete"] as ObstacleMaterial[]).map((mat) => (
              <button
                key={mat}
                onClick={() => setObstacleMaterialToPlace(mat)}
                className={`px-2 py-1 rounded text-[11px] text-left capitalize transition-colors ${
                  obstacleMaterialToPlace === mat
                    ? "bg-violet text-carbon-deep font-semibold"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
                }`}
              >
                {mat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Topology Template Application */}
      {onOpenTemplates && (
        <>
          <div className="h-px bg-border-subtle my-0.5 w-full" />
          <button
            onClick={onOpenTemplates}
            title="Apply Star / Tree Template"
            className={`w-full p-2 rounded-lg flex items-center gap-2.5 transition-colors ${
              isExpanded
                ? "text-text-secondary hover:text-violet hover:bg-surface-elevated"
                : "text-violet hover:bg-surface-elevated justify-center"
            }`}
          >
            <Sparkles className="w-4 h-4 text-violet shrink-0" />
            {isExpanded && <span>Templates</span>}
          </button>
        </>
      )}

      {/* Link Drafting Status Tooltip */}
      {activeTool === "connect-link" && (
        <div className="absolute left-full ml-3 top-20 bg-surface-raised border border-border-strong shadow-2xl px-3 py-1.5 rounded-lg text-[11px] whitespace-nowrap text-text-primary flex items-center gap-2 z-50">
          <span className="w-2 h-2 rounded-full bg-violet animate-pulse" />
          {linkDraft?.sourceDeviceId
            ? "Click target device to connect"
            : "Click source device"}
        </div>
      )}
    </div>
  );
}
