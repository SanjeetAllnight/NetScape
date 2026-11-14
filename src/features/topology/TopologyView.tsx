import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Info } from "lucide-react";
import { WorkbenchHeader } from "@/features/shell/WorkbenchHeader";
import { AnalysisStatusStrip } from "@/features/shell/AnalysisStatusStrip";
import { TopologyCanvas } from "./TopologyCanvas";
import { WorkbenchInspector } from "@/features/designer/WorkbenchInspector";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import type { DesignId } from "@/contracts/primitives";

export function TopologyView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();
  const aggregate = useDesignStore((s) => s.aggregate);

  // Ensure design is opened in session
  useEffect(() => {
    if (!designId) return;

    const container = getApplicationContainer();
    if (aggregate?.design.id !== designId) {
      container.designSession.open(designId as DesignId);
    }
  }, [designId, aggregate?.design.id]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative select-none">
      <WorkbenchHeader />

      <div className="flex-1 relative overflow-hidden">
        {!aggregate ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted bg-surface-canvas">
            <Loader2 className="w-8 h-8 animate-spin text-violet mb-3" />
            <span className="text-xs">Loading topology view...</span>
          </div>
        ) : (
          <>
            {/* Logical Independence Notice Pill */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-raised/90 backdrop-blur-md border border-border-strong shadow-lg text-[11px] text-text-secondary">
              <Info className="w-3.5 h-3.5 text-violet shrink-0" />
              <span>Logical layout is independent of geographic GPS coordinates.</span>
            </div>

            <TopologyCanvas />

            {/* Shared Workbench Inspector */}
            <WorkbenchInspector />
          </>
        )}
      </div>

      <AnalysisStatusStrip />
    </div>
  );
}
