import { useState, useEffect } from "react";
import { Link, NavLink, useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Wifi,
  WifiOff,
  ChevronDown,
  Star,
  Copy,
  Sliders,
  Map,
  Network,
  Binary,
  IndianRupee,
  Activity,
  FileText,
} from "lucide-react";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import { ProjectSettingsModal } from "@/features/settings/ProjectSettingsModal";
import type { Design } from "@/contracts/domain";
import type { ProjectId, DesignId } from "@/contracts/primitives";

export function ProjectHeader() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const aggregate = useDesignStore((s) => s.aggregate);
  const saveStatus = useDesignStore((s) => s.saveStatus);
  const errorMessage = useDesignStore((s) => s.errorMessage);

  const [designs, setDesigns] = useState<Design[]>([]);
  const [isDesignDropdownOpen, setIsDesignDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

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

  // Determine current active subroute (map, topology, etc.)
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

  return (
    <header className="h-12 border-b border-border-subtle bg-surface-raised px-3 flex items-center justify-between gap-2 select-none z-30 shrink-0">
      {/* Left side: Back, Project Title, Design dropdown */}
      <div className="flex items-center space-x-2.5 min-w-0">
        <Link
          to="/"
          title="Back to Projects"
          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-1.5 truncate">
          <span className="font-semibold text-xs text-text-primary truncate max-w-[140px] sm:max-w-[200px]">
            {aggregate?.project.name ?? "NetScape"}
          </span>
          <span className="text-text-disabled">/</span>

          {/* Design Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsDesignDropdownOpen(!isDesignDropdownOpen)}
              className="px-2 py-1 rounded bg-surface-panel hover:bg-surface-elevated border border-border-subtle hover:border-border-strong text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
            >
              {currentDesign?.isBaseline && <Star className="w-3 h-3 text-brand-cantaloupe fill-brand-cantaloupe" />}
              <span className="truncate max-w-[120px]">{currentDesign?.name ?? "Baseline Design"}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {isDesignDropdownOpen && (
              <div className="absolute left-0 mt-1 w-56 rounded-md bg-surface-raised border border-border-strong shadow-xl py-1 z-50 text-xs divide-y divide-border-subtle">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                  Alternative Designs
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {designs.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleSwitchDesign(d.id)}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-surface-elevated transition-colors ${
                        d.id === designId ? "text-brand-electric font-medium" : "text-text-primary"
                      }`}
                    >
                      <span className="truncate">{d.name}</span>
                      {d.isBaseline && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-cantaloupe/20 text-brand-cantaloupe font-mono">
                          baseline
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="p-1">
                  <button
                    onClick={handleDuplicateDesign}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-surface-elevated text-text-secondary hover:text-text-primary flex items-center gap-2"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate Current Design
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Center: Route Navigation Pills */}
      <nav className="hidden lg:flex items-center space-x-1 bg-surface-panel p-0.5 rounded-md border border-border-subtle text-xs">
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/map`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <Map className="w-3.5 h-3.5" />
          Map
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/topology`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <Network className="w-3.5 h-3.5" />
          Topology
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/addressing`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <Binary className="w-3.5 h-3.5" />
          Addressing
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/cost`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <IndianRupee className="w-3.5 h-3.5" />
          Cost
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/simulation`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <Activity className="w-3.5 h-3.5" />
          Simulation
        </NavLink>
        <NavLink
          to={`/projects/${projectId}/designs/${designId}/report`}
          className={({ isActive }) =>
            `px-2.5 py-1 rounded font-medium flex items-center gap-1.5 transition-colors ${
              isActive
                ? "bg-surface-elevated text-brand-electric shadow-sm border border-border-strong"
                : "text-text-secondary hover:text-text-primary"
            }`
          }
        >
          <FileText className="w-3.5 h-3.5" />
          Report
        </NavLink>
      </nav>

      {/* Right side: Save indicator, Online status, Settings */}
      <div className="flex items-center space-x-2 text-xs">
        {/* Save Status Badge */}
        {saveStatus === "saving" && (
          <div className="flex items-center gap-1.5 text-brand-electric bg-brand-electric/10 px-2 py-0.5 rounded border border-brand-electric/30 font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="hidden sm:inline">Saving...</span>
          </div>
        )}
        {saveStatus === "saved" && (
          <div className="flex items-center gap-1.5 text-status-success bg-status-success/10 px-2 py-0.5 rounded border border-status-success/30 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span className="hidden sm:inline">Saved to browser</span>
          </div>
        )}
        {saveStatus === "error" && (
          <div
            title={errorMessage ?? "Save failed"}
            className="flex items-center gap-1.5 text-status-error bg-status-error/10 px-2 py-0.5 rounded border border-status-error/30 font-medium cursor-help"
          >
            <AlertCircle className="w-3 h-3" />
            <span>Save error</span>
          </div>
        )}

        {/* Online / Offline status */}
        <div
          title={isOnline ? "Online — search & tiles available" : "Offline — neutral canvas fallback active"}
          className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
            isOnline
              ? "text-text-muted border-border-subtle bg-surface-panel"
              : "text-status-warning border-status-warning/30 bg-status-warning/10 font-medium"
          }`}
        >
          {isOnline ? <Wifi className="w-3 h-3 text-status-success" /> : <WifiOff className="w-3 h-3" />}
          <span className="hidden md:inline">{isOnline ? "Online" : "Offline"}</span>
        </div>

        {/* Project Settings Trigger */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          title="Project Engineering Settings"
          className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors"
        >
          <Sliders className="w-4 h-4" />
        </button>
      </div>

      {/* Settings Modal */}
      <ProjectSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </header>
  );
}

