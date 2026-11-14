import { Settings, HardDrive } from "lucide-react";

export function SettingsPlaceholder() {
  return (
    <div className="flex-1 p-6 md:p-8 max-w-4xl mx-auto w-full select-none text-xs text-text-primary">
      {/* Header */}
      <div className="pb-4 border-b border-border-subtle mb-6">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-violet" />
          <h1 className="text-xl font-bold tracking-tight text-text-primary">Application Settings</h1>
        </div>
        <p className="text-xs text-text-secondary mt-1">
          Workstation operational profile, client runtime diagnostic telemetry, and storage quota health.
        </p>
      </div>

      <div className="space-y-6">
        {/* Storage Runtime Card */}
        <div className="p-5 rounded-xl bg-surface-raised border border-border-strong space-y-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <HardDrive className="w-4 h-4 text-violet" />
              <h2 className="font-semibold text-sm text-text-primary">Local Storage &amp; IndexedDB Engine</h2>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold text-status-success bg-status-success/10 border border-status-success/30">
              HEALTHY
            </span>
          </div>

          <p className="text-xs text-text-secondary">
            NetScape stores all authored designs, projects, boundaries, catalog items, and calculated analysis blobs directly in browser IndexedDB (Database: <code className="font-mono text-violet">netscape-db</code>).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px]">
            <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle">
              <span className="text-text-muted block mb-1">Architecture</span>
              <span className="font-mono font-bold text-text-primary">Local-First (Pure Client)</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle">
              <span className="text-text-muted block mb-1">Sync Boundary</span>
              <span className="font-mono font-bold text-text-primary">Zero Remote Transmit</span>
            </div>
            <div className="p-3 rounded-lg bg-surface-panel border border-border-subtle">
              <span className="text-text-muted block mb-1">Worker Threads</span>
              <span className="font-mono font-bold text-text-primary">Active (Coverage &amp; Sim)</span>
            </div>
          </div>
        </div>

        {/* Visual Identity Profile Card */}
        <div className="p-5 rounded-xl bg-surface-raised border border-border-strong space-y-3 shadow-xl">
          <h2 className="font-semibold text-sm text-text-primary">Visual Identity &amp; Workbench Theme</h2>
          <p className="text-xs text-text-secondary">
            Active visual profile: <strong className="text-text-primary">Carbon &amp; Electric Violet</strong> (Integrated Engineering Workbench CAD/GIS Direction).
          </p>

          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121218] border border-[#3E3E50] text-[11px]">
              <span className="w-3 h-3 rounded-full bg-[#121218] border border-white/20" />
              <span className="font-mono">#121218 Carbon</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#242430] border border-[#3E3E50] text-[11px]">
              <span className="w-3 h-3 rounded-full bg-[#242430] border border-white/20" />
              <span className="font-mono">#242430 Slate</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-panel border border-border-subtle text-[11px]">
              <span className="w-3 h-3 rounded-full bg-[#A78BFA]" />
              <span className="font-mono text-violet font-semibold">#A78BFA Violet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
