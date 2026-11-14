import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Network, Database, Settings, ShieldAlert, Wifi, WifiOff, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UpdatePrompt } from "@/features/shell/UpdatePrompt";
import { CommandPalette } from "@/features/shell/CommandPalette";

export function AppShell() {
  const location = useLocation();
  const isWorkspace =
    location.pathname.includes("/designs/") || location.pathname.includes("/compare");

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

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

  // Global Ctrl/Cmd + K shortcut listener for root shell
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

  if (isWorkspace) {
    return (
      <div className="h-screen w-screen flex flex-col bg-surface-canvas text-text-primary overflow-hidden">
        <Outlet />
        <UpdatePrompt />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-canvas text-text-primary">
      {/* Top Header */}
      <header className="h-14 border-b border-border-subtle bg-surface-raised px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-carbon-deep border border-border-strong text-violet">
            <Network className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base tracking-tight text-text-primary">
            NetScape
          </span>
          <span className="text-xs text-text-muted hidden sm:inline">
            Smart Map-Based Network Infrastructure Planning Workstation
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Quick command search trigger */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-panel hover:bg-surface-elevated border border-border-subtle text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <Search className="w-3.5 h-3.5 text-violet" />
            <span>Search commands...</span>
            <kbd className="px-1.5 py-0.2 rounded border border-border-strong bg-surface-elevated text-[9px] font-mono text-text-muted">
              Ctrl K
            </kbd>
          </button>

          {/* Online / Offline status badge */}
          <div
            title={
              isOnline
                ? "Online — search & basemap tiles available"
                : "Offline — local edits and calculations remain fully available"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${
              isOnline
                ? "text-status-success border-status-success/30 bg-status-success/10"
                : "text-status-warning border-status-warning/30 bg-status-warning/10"
            }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-status-success" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-status-warning" />
                <span>Offline — local mode</span>
              </>
            )}
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-panel"
                }`
              }
            >
              <Network className="w-3.5 h-3.5" />
              Projects
            </NavLink>
            <NavLink
              to="/catalog"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-panel"
                }`
              }
            >
              <Database className="w-3.5 h-3.5" />
              Catalog
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
                  isActive
                    ? "bg-violet/15 text-violet border border-violet/30"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-panel"
                }`
              }
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Engineering Baseline Status Banner */}
      <div className="bg-surface-panel border-b border-border-subtle px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Badge variant="stale" className="gap-1 font-mono uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3" />
            Phase 0
          </Badge>
          <span className="text-text-secondary">
            Engineering Foundation Active — Pure local-first client architecture with Dexie IndexedDB persistence.
          </span>
        </div>
        <span className="text-text-muted font-mono text-[11px] hidden md:inline">
          HashRouter • Web Workers • Zero Cloud Dependencies
        </span>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <UpdatePrompt />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
      />
    </div>
  );
}
