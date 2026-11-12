import { useState, useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Network, Database, Settings, ShieldAlert, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UpdatePrompt } from "@/features/shell/UpdatePrompt";

export function AppShell() {
  const location = useLocation();
  const isWorkspace = location.pathname.includes("/designs/");

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

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
          <div className="flex items-center justify-center w-8 h-8 rounded bg-brand-midnight border border-border-strong text-brand-electric">
            <Network className="w-5 h-5" />
          </div>
          <span className="font-semibold text-base tracking-tight text-text-primary">
            NetScape
          </span>
          <span className="text-xs text-text-muted hidden sm:inline">
            Network Infrastructure Planning Workstation
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Online / Offline status badge */}
          <div
            title={
              isOnline
                ? "Online — search & basemap tiles available"
                : "Offline — local edits and calculations remain fully available"
            }
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-medium transition-colors ${isOnline
                ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                : "text-amber-400 border-amber-500/30 bg-amber-500/10"
              }`}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span>Offline — local mode</span>
              </>
            )}
          </div>

          <nav className="flex items-center space-x-1 sm:space-x-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${isActive
                  ? "bg-surface-elevated text-brand-electric border border-border-strong"
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
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${isActive
                  ? "bg-surface-elevated text-brand-electric border border-border-strong"
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
                `px-3 py-1.5 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${isActive
                  ? "bg-surface-elevated text-brand-electric border border-border-strong"
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

      {/* Phase 0 Status Banner */}
      <div className="bg-surface-panel border-b border-border-subtle px-4 py-2 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <Badge variant="stale" className="gap-1 font-mono uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3" />
            Phase 0
          </Badge>
          <span className="text-text-secondary">
            Engineering Foundation Active — Compile-time contracts and test seam only.
            MVP product features are deferred to Phase 1+.
          </span>
        </div>
        <span className="text-text-muted font-mono text-[11px] hidden md:inline">
          HashRouter • Pure Kernel • Zero Backend
        </span>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>

      <UpdatePrompt />
    </div>
  );
}

