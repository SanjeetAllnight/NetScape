import { MousePointer, Router, Server, Wifi, Network, Shield, Waypoints, Sparkles } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import type { DeviceType, ObstacleMaterial, LinkMedium } from "@/contracts/enums";
import type { CatalogItemId, Longitude, Latitude } from "@/contracts/primitives";

interface DevicePaletteProps {
  onOpenTemplates?: () => void;
}

export function DevicePalette({ onOpenTemplates }: DevicePaletteProps) {
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
    <div className="absolute top-4 left-4 z-[400] flex flex-col gap-1.5 bg-surface-raised/95 backdrop-blur-md p-1.5 rounded-lg border border-border-strong shadow-2xl text-xs select-none">
      {/* Select Pointer */}
      <button
        onClick={() => {
          setActiveTool("select");
          setCatalogItemIdToPlace(null);
          setLinkDraft(null);
        }}
        title="Select & Move (V)"
        className={`p-2 rounded flex items-center justify-center transition-colors ${
          activeTool === "select"
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <MousePointer className="w-4 h-4" />
      </button>

      <div className="h-px bg-border-subtle my-0.5" />

      {/* 4 Device Types */}
      <button
        onClick={() => handleSelectDevice("router")}
        title="Place Router"
        className={`p-2 rounded flex items-center justify-center transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.router
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Router className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleSelectDevice("switch")}
        title="Place Switch"
        className={`p-2 rounded flex items-center justify-center transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.switch
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Network className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleSelectDevice("accessPoint")}
        title="Place Wi-Fi Access Point"
        className={`p-2 rounded flex items-center justify-center transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.accessPoint
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Wifi className="w-4 h-4" />
      </button>

      <button
        onClick={() => handleSelectDevice("server")}
        title="Place Server"
        className={`p-2 rounded flex items-center justify-center transition-colors relative ${
          activeTool === "place-device" && catalogItemIdToPlace === itemsByType.server
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Server className="w-4 h-4" />
      </button>

      <div className="h-px bg-border-subtle my-0.5" />

      {/* Connect Link Tool */}
      <button
        onClick={() => handleSelectConnect("copper")}
        title="Connect Devices (Two-click link)"
        className={`p-2 rounded flex items-center justify-center transition-colors ${
          activeTool === "connect-link"
            ? "bg-brand-cantaloupe text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Waypoints className="w-4 h-4" />
      </button>

      <div className="h-px bg-border-subtle my-0.5" />

      {/* Draw Planning Boundary */}
      <button
        onClick={() => {
          setActiveTool("draw-boundary");
          setCatalogItemIdToPlace(null);
          setLinkDraft(null);
        }}
        title="Draw Planning Boundary Polygon (Geoman)"
        className={`p-2 rounded flex items-center justify-center transition-colors ${
          activeTool === "draw-boundary"
            ? "bg-brand-electric text-white shadow-sm"
            : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
        }`}
      >
        <Shield className="w-4 h-4" />
      </button>

      {/* Draw Manual Obstacle */}
      <div className="relative group">
        <button
          onClick={() => {
            setActiveTool("draw-obstacle");
            setCatalogItemIdToPlace(null);
            setLinkDraft(null);
          }}
          title="Draw Manual Obstacle Polygon"
          className={`p-2 rounded flex items-center justify-center transition-colors w-full ${
            activeTool === "draw-obstacle"
              ? "bg-brand-electric text-white shadow-sm"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated"
          }`}
        >
          <div className="w-3.5 h-3.5 rounded border border-current flex items-center justify-center text-[9px] font-bold">
            O
          </div>
        </button>

        {/* Obstacle Material Selector on Hover / Click */}
        {activeTool === "draw-obstacle" && (
          <div className="absolute left-full ml-2 top-0 bg-surface-raised border border-border-strong rounded shadow-xl p-1 flex flex-col gap-1 w-24">
            {(["glass", "drywall", "brick", "concrete"] as ObstacleMaterial[]).map((mat) => (
              <button
                key={mat}
                onClick={() => setObstacleMaterialToPlace(mat)}
                className={`px-2 py-1 rounded text-[11px] text-left capitalize transition-colors ${
                  obstacleMaterialToPlace === mat
                    ? "bg-brand-electric text-white font-medium"
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
          <div className="h-px bg-border-subtle my-0.5" />
          <button
            onClick={onOpenTemplates}
            title="Apply Star / Tree Template"
            className="p-2 rounded flex items-center justify-center text-brand-cantaloupe hover:bg-surface-elevated transition-colors"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        </>
      )}

      {/* Link Drafting Status Tooltip */}
      {activeTool === "connect-link" && (
        <div className="absolute left-full ml-3 top-20 bg-surface-raised border border-border-strong shadow-xl px-3 py-1.5 rounded text-[11px] whitespace-nowrap text-text-primary flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-cantaloupe animate-pulse" />
          {linkDraft?.sourceDeviceId
            ? "Click target device to connect"
            : "Click source device"}
        </div>
      )}
    </div>
  );
}
