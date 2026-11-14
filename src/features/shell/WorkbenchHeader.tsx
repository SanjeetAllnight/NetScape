import { useState, useEffect } from "react";
import { Link, NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Network,
  ChevronDown,
  Star,
  Copy,
  Sliders,
  Map,
  Binary,
  IndianRupee,
  Radio,
  Activity,
  GitCompare,
  FileText,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  FolderKanban,
  Database,
  Settings,
} from "lucide-react";
import { useDesignStore } from "@/stores/designStore";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useEditorStore } from "@/stores/editorStore";
import { getApplicationContainer } from "@/application/container";
import { ProjectSettingsModal } from "@/features/settings/ProjectSettingsModal";
import { CommandPalette } from "@/features/shell/CommandPalette";
import type { Design } from "@/contracts/domain";
import type { ProjectId, DesignId } from "@/contracts/primitives";

export function WorkbenchHeader() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const aggregate = useDesignStore((s) => s.aggregate);
  const saveStatus = useDesignStore((s) => s.saveStatus);
  const errorMessage = useDesignStore((s) => s.errorMessage);

  const costStatus = useAnalysisStore((s) => s.status.cost);
  const coverageStatus = useAnalysisStore((s) => s.status.coverage);
  const simulationStatus = useAnalysisStore((s) => s.status.simulation);

  const coverageOverlay = useEditorStore((s) => s.coverageOverlay);
  const setCoverageOverlay = useEditorStore((s) => s.setCoverageOverlay);

  const [designs, setDesigns] = useState<Design[]>([]);
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  // Online / offline detector
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Global Ctrl/Cmd + K shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch designs
  useEffect(() => {
    if (!projectId) return;
    const fetchDesigns = async () => {
      try {
        const container = getApplicationContainer();
        const list = await container.projectService.listDesigns(projectId as ProjectId);
        setDesigns(list);
      } catch {
        // Ignored
      }
    };
    fetchDesigns();
  }, [projectId, designId]);

  const currentDesign = designs.find((d) => d.id === designId) ?? aggregate?.design;
  const currentSubRoute = location.pathname.split("/").pop() || "map";

  const handleSwitchDesign = (newDesignId: string) => {
    setIsDesignDropdownOpen(false);
    navigate(`/projects/${projectId}/designs/${newDesignId}/${currentSubRoute}`);
  };

  const handleDuplicateDesign = async () => {
    if (!designId) return;
    setIsDesignDropdownOpen(false);
    try {
      const container = getApplicationContainer();
      const newDesignId = await container.projectService.duplicateDesign(designId as DesignId);
      navigate(`/projects/${projectId}/designs/${newDesignId}/${currentSubRoute}`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to duplicate design");
    }
  };

  const isMapActive = location.pathname.includes("/map") && !coverageOverlay.isDockOpen;
  const isCoverageActive = location.pathname.includes("/map") && coverageOverlay.isDockOpen;

  return (
    <header className="border-b border-border-subtle bg-surface-raised flex flex-col select-none z-30 shrink-0">
      {/* Top Row: Application Bar */}
      <div className="h-11 px-3 sm:px-4 flex items-center justify-between gap-3 border-b border-border-subtle/60 text-xs">
        {/* Left: NetScape Logo & Project Breadcrumb */}
        <div className="flex items-center space-x-2.5 min-w-0">
          <Link
            to="/"
            title="NetScape — All Projects"
            className="flex items-center gap-2 text-text-primary hover:text-violet transition-colors group"
          >
            <div className="flex items-center justify-center w-6 h-6 rounded bg-carbon-deep border border-border-strong text-violet group-hover:border-violet/40">
              <Network className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-xs tracking-tight hidden md:inline">NetScape</span>
          </Link>

          <span className="text-text-disabled">/</span>

          {/* Project Name Breadcrumb */}
          <Link
            to="/"
            className="font-semibold text-text-primary hover:text-violet truncate max-w-[120px] sm:max-w-[180px] transition-colors"
            title={aggregate?.project.name ?? "Project"}
          >
            {aggregate?.project.name ?? "NetScape Project"}
          </Link>

          <span className="text-text-disabled">/</span>

          {/* Design Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDesignDropdownOpen(!isDesignDropdownOpen)}
              className="px-2 py-1 rounded bg-surface-panel hover:bg-surface-elevated border border-border-subtle hover:border-border-strong text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
            >
              {currentDesign?.isBaseline && (
                <Star className="w-3 h-3 text-status-warning fill-status-warning" />
              )}
              <span className="truncate max-w-[110px] sm:max-w-[140px]">
                {currentDesign?.name ?? "Baseline Design"}
              </span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isDesignDropdownOpen && (
              <div className="absolute left-0 mt-1 w-56 rounded-lg bg-surface-raised border border-border-strong shadow-2xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] uppercase font-semibold text-text-muted border-b border-border-subtle">
                  Project Designs
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {designs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSwitchDesign(d.id)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-surface-elevated transition-colors ${
                        d.id === designId
                          ? "bg-violet/10 text-violet font-semibold"
                          : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        {d.isBaseline && (
                          <Star className="w-3 h-3 text-status-warning fill-status-warning shrink-0" />
                        )}
                        <span>{d.name}</span>
                      </span>
                      {d.id === designId && <span className="text-[10px] font-mono">ACTIVE</span>}
                    </button>
                  ))}
                </div>
                <div className="border-t border-border-subtle pt-1 mt-1">
                  <button
                    onClick={handleDuplicateDesign}
                    className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Duplicate Current Design</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Command Palette Trigger */}
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-panel hover:bg-surface-elevated border border-border-subtle hover:border-violet/40 text-text-muted hover:text-text-primary transition-all max-w-xs w-full sm:w-64 justify-between"
          title="Open Command Palette (Ctrl+K)"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3 h-3 text-violet shrink-0" />
            <span className="text-[11px] truncate">Search commands...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.2 rounded border border-border-strong bg-surface-elevated text-[9px] font-mono text-text-muted">
            Ctrl K
          </kbd>
        </button>

        {/* Right: Save status, Online pill, Settings */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Save Status Badge */}
          {saveStatus === "saving" && (
            <div className="flex items-center gap-1 text-violet bg-violet/10 px-2 py-0.5 rounded border border-violet/30 font-medium text-[11px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="hidden sm:inline">Saving...</span>
            </div>
          )}
          {saveStatus === "saved" && (
            <div className="flex items-center gap-1 text-status-success bg-status-success/10 px-2 py-0.5 rounded border border-status-success/30 font-medium text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden sm:inline">Saved</span>
            </div>
          )}
          {saveStatus === "error" && (
            <div
              title={errorMessage ?? "Save failed"}
              className="flex items-center gap-1 text-status-error bg-status-error/10 px-2 py-0.5 rounded border border-status-error/30 font-medium text-[11px] cursor-help"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Save error</span>
            </div>
          )}

          {/* Online / Offline status */}
          <div
            title={
              isOnline
                ? "Online — map tiles and geocoding available"
                : "Offline — neutral canvas fallback and local computation fully active"
            }
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
              isOnline
                ? "text-text-muted border-border-subtle bg-surface-panel"
                : "text-status-warning border-status-warning/30 bg-status-warning/10 font-medium"
            }`}
          >
            {isOnline ? (
              <Wifi className="w-3 h-3 text-status-success" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            <span className="hidden md:inline">{isOnline ? "Online" : "Offline"}</span>
          </div>

          {/* Project Settings Trigger */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            title="Project Engineering Settings"
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Grouped Workspace Navigation Bar */}
      <div className="h-10 px-3 sm:px-4 flex items-center justify-between gap-2 overflow-x-auto text-xs bg-surface-panel/40">
        <nav className="flex items-center space-x-4 shrink-0">
          {/* GROUP 1: DESIGN */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mr-1">
              Design
            </span>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/map`}
              onClick={() => setCoverageOverlay({ isDockOpen: false })}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                isMapActive
                  ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>Map</span>
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/topology`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <Network className="w-3.5 h-3.5" />
              <span>Topology</span>
            </NavLink>
          </div>

          <div className="h-4 w-px bg-border-subtle shrink-0" />

          {/* GROUP 2: PLAN */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mr-1">
              Plan
            </span>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/addressing`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <Binary className="w-3.5 h-3.5" />
              <span>Addressing</span>
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/cost`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Cost</span>
              {costStatus === "stale" && (
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" title="Cost out of date" />
              )}
            </NavLink>
          </div>

          <div className="h-4 w-px bg-border-subtle shrink-0" />

          {/* GROUP 3: ANALYSE */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mr-1">
              Analyse
            </span>
            <button
              type="button"
              onClick={() => {
                setCoverageOverlay({ isDockOpen: true, visible: true });
                if (!location.pathname.includes("/map")) {
                  navigate(`/projects/${projectId}/designs/${designId}/map`);
                }
              }}
              className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                isCoverageActive
                  ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Coverage</span>
              {coverageStatus === "stale" && (
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" title="Coverage out of date" />
              )}
            </button>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/simulation`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Simulation</span>
              {simulationStatus === "stale" && (
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" title="Simulation out of date" />
              )}
            </NavLink>
          </div>

          <div className="h-4 w-px bg-border-subtle shrink-0" />

          {/* GROUP 4: DELIVER */}
          <div className="flex items-center space-x-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted font-bold mr-1">
              Deliver
            </span>
            <NavLink
              to={`/projects/${projectId}/compare?a=${designId}`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Compare</span>
            </NavLink>
            <NavLink
              to={`/projects/${projectId}/designs/${designId}/report`}
              className={({ isActive }) =>
                `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30 shadow-sm"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-elevated border border-transparent"
                }`
              }
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Report</span>
            </NavLink>
          </div>
        </nav>

        {/* Global links */}
        <div className="hidden sm:flex items-center space-x-1 text-[11px] text-text-muted">
          <Link
            to="/"
            className="px-2 py-0.5 rounded hover:bg-surface-elevated hover:text-text-primary flex items-center gap-1 transition-colors"
          >
            <FolderKanban className="w-3 h-3" />
            <span>Projects</span>
          </Link>
          <Link
            to="/catalog"
            className="px-2 py-0.5 rounded hover:bg-surface-elevated hover:text-text-primary flex items-center gap-1 transition-colors"
          >
            <Database className="w-3 h-3" />
            <span>Catalog</span>
          </Link>
          <Link
            to="/settings"
            className="px-2 py-0.5 rounded hover:bg-surface-elevated hover:text-text-primary flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3 h-3" />
            <span>Settings</span>
          </Link>
        </div>
      </div>

      {/* Settings Modal */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
    </header>
  );
}
