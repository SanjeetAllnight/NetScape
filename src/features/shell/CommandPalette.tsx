import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Search,
  Map,
  Network,
  Binary,
  IndianRupee,
  Radio,
  Activity,
  GitCompare,
  FileText,
  FolderKanban,
  Database,
  Settings,
  Sliders,
  PanelRight,
  X,
  CornerDownLeft,
} from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
}

interface CommandItem {
  id: string;
  category: "DESIGN" | "PLAN" | "ANALYSE" | "DELIVER" | "APPLICATION" | "VIEW";
  label: string;
  description: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenSettings }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const coverageOverlay = useEditorStore((s) => s.coverageOverlay);
  const setCoverageOverlay = useEditorStore((s) => s.setCoverageOverlay);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Construct command list
  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    if (projectId && designId) {
      list.push(
        {
          id: "nav-map",
          category: "DESIGN",
          label: "Geographic Map Workspace",
          description: "Inspect boundary, place devices, connect links on real coordinates",
          icon: Map,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/map`);
            onClose();
          },
        },
        {
          id: "nav-topology",
          category: "DESIGN",
          label: "Logical Topology Workspace",
          description: "Interactive node-link graph with auto-layout and drag coordinates",
          icon: Network,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/topology`);
            onClose();
          },
        },
        {
          id: "nav-addressing",
          category: "PLAN",
          label: "IPv4 Addressing & VLSM",
          description: "Configure parent CIDR, declare subnets, run deterministic VLSM engine",
          icon: Binary,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/addressing`);
            onClose();
          },
        },
        {
          id: "nav-cost",
          category: "PLAN",
          label: "Cost & TCO Estimation",
          description: "Calculate hardware CAPEX, cabling, installation labour, and 5-year TCO",
          icon: IndianRupee,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/cost`);
            onClose();
          },
        },
        {
          id: "nav-coverage",
          category: "ANALYSE",
          label: "Wireless RF Coverage Mode",
          description: "Log-distance path loss heatmaps, obstacle attenuation, dead-zone detector",
          icon: Radio,
          action: () => {
            setCoverageOverlay({ isDockOpen: true, visible: true });
            if (!location.pathname.includes("/map")) {
              navigate(`/projects/${projectId}/designs/${designId}/map`);
            }
            onClose();
          },
        },
        {
          id: "nav-simulation",
          category: "ANALYSE",
          label: "Network Simulation & Failures",
          description: "Dijkstra SPF shortest paths, link capacities, latency, link/device failures",
          icon: Activity,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/simulation`);
            onClose();
          },
        },
        {
          id: "nav-compare",
          category: "DELIVER",
          label: "Design Comparison Matrix",
          description: "Side-by-side structural diff, CAPEX delta, coverage, and simulation deltas",
          icon: GitCompare,
          action: () => {
            navigate(`/projects/${projectId}/compare?a=${designId}`);
            onClose();
          },
        },
        {
          id: "nav-report",
          category: "DELIVER",
          label: "Engineering Report & PDF",
          description: "9-section technical documentation, schematic figures, client-side PDF export",
          icon: FileText,
          action: () => {
            navigate(`/projects/${projectId}/designs/${designId}/report`);
            onClose();
          },
        },
        {
          id: "action-settings",
          category: "VIEW",
          label: "Project Engineering Settings",
          description: "TCO horizon, power tariffs, frequency, path loss exponent, MTU parameters",
          icon: Sliders,
          action: () => {
            onClose();
            onOpenSettings?.();
          },
        },
        {
          id: "action-toggle-inspector",
          category: "VIEW",
          label: "Toggle Coverage Inspector Panel",
          description: "Show or hide the right-side coverage and entity inspector",
          icon: PanelRight,
          action: () => {
            setCoverageOverlay({ isDockOpen: !coverageOverlay.isDockOpen });
            onClose();
          },
        }
      );
    }

    // App-level navigation
    list.push(
      {
        id: "app-projects",
        category: "APPLICATION",
        label: "All Network Projects",
        description: "Back to projects dashboard and local project switcher",
        icon: FolderKanban,
        action: () => {
          navigate("/");
          onClose();
        },
      },
      {
        id: "app-catalog",
        category: "APPLICATION",
        label: "Device Catalog",
        description: "Standard hardware specifications, port counts, and seeded unit rates",
        icon: Database,
        action: () => {
          navigate("/catalog");
          onClose();
        },
      },
      {
        id: "app-settings",
        category: "APPLICATION",
        label: "Workstation Settings",
        description: "Global workstation preferences and local storage diagnostic seam",
        icon: Settings,
        action: () => {
          navigate("/settings");
          onClose();
        },
      }
    );

    return list;
  }, [
    projectId,
    designId,
    location.pathname,
    navigate,
    onClose,
    onOpenSettings,
    coverageOverlay.isDockOpen,
    setCoverageOverlay,
  ]);

  // Filter commands
  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Handle keyboard events inside modal
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev <= 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredCommands[selectedIndex];
      if (item) {
        item.action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  // Keep selected index in bounds and scroll into view
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-100"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-border-strong bg-surface-raised shadow-2xl flex flex-col overflow-hidden text-xs text-text-primary border-t-violet/40"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border-subtle gap-2.5 bg-surface-panel">
          <Search className="w-4 h-4 text-violet shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a workspace name, engineering lens, or action..."
            className="flex-1 bg-transparent text-text-primary text-xs placeholder:text-text-muted focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded border border-border-strong bg-surface-elevated text-[10px] font-mono text-text-muted">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto p-2 space-y-1 divide-y divide-border-subtle/40"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-text-muted">
              <p>No commands matching &ldquo;{query}&rdquo;</p>
              <p className="text-[11px] mt-1 text-text-disabled">
                Only valid implemented workstation actions are available.
              </p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = cmd.icon;

              return (
                <button
                  key={cmd.id}
                  type="button"
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-3 transition-colors ${
                    isSelected
                      ? "bg-violet/15 text-text-primary border border-violet/30"
                      : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded border shrink-0 ${
                        isSelected
                          ? "bg-violet/20 border-violet/40 text-violet"
                          : "bg-surface-elevated border-border-subtle text-text-muted"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-text-primary truncate flex items-center gap-2">
                        <span>{cmd.label}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-surface-canvas border border-border-subtle text-text-muted font-mono tracking-wider">
                          {cmd.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-text-muted truncate mt-0.5">
                        {cmd.description}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <CornerDownLeft className="w-3.5 h-3.5 text-violet shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Palette Footer */}
        <div className="px-4 py-2 border-t border-border-subtle bg-surface-panel/60 flex items-center justify-between text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono text-text-primary">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono text-text-primary">↵</kbd> select
            </span>
            <span>
              <kbd className="font-mono text-text-primary">esc</kbd> close
            </span>
          </div>
          <span className="font-mono text-text-disabled">NetScape Workbench</span>
        </div>
      </div>
    </div>
  );
}
