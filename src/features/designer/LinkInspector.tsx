import { useState } from "react";
import { X, Trash2, Waypoints, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import { deriveLinkLengthM } from "@/domain/geo/localFrame";
import type { LinkId } from "@/contracts/primitives";
import type { LinkMedium, LinkInstallationMethod } from "@/contracts/enums";

export function LinkInspector() {
  const selectedEntity = useEditorStore((s) => s.selectedEntity);
  const setSelectedEntity = useEditorStore((s) => s.setSelectedEntity);
  const aggregate = useDesignStore((s) => s.aggregate);

  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const link =
    selectedEntity?.type === "link" && aggregate
      ? aggregate.linksById[selectedEntity.id as LinkId]
      : null;

  if (!link || !aggregate) return null;

  const sourceDevice = aggregate.devicesById[link.sourceDeviceId];
  const targetDevice = aggregate.devicesById[link.targetDeviceId];

  const lengthM = deriveLinkLengthM(link, aggregate.devicesById, aggregate.project.frame);

  const handleUpdateMedium = async (medium: LinkMedium) => {
    setIsUpdating(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/update",
        linkId: link.id,
        patch: { medium },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update link medium");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateInstallation = async (method: LinkInstallationMethod | null) => {
    setIsUpdating(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/update",
        linkId: link.id,
        patch: { installationMethod: method },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update installation method");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this link?")) return;
    setIsDeleting(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "link/delete",
        linkId: link.id,
      });
      setSelectedEntity(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete link");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[400] w-80 bg-surface-raised/95 backdrop-blur-md rounded-lg border border-border-strong shadow-2xl flex flex-col text-xs select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Waypoints className="w-3.5 h-3.5 text-brand-cantaloupe" />
          <h3 className="font-semibold text-text-primary">Link Inspector</h3>
        </div>
        <button
          onClick={() => setSelectedEntity(null)}
          className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-panel transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4">
        {/* Endpoints */}
        <div className="p-2.5 rounded bg-surface-panel border border-border-subtle flex items-center justify-between">
          <span className="font-medium text-text-primary truncate max-w-[100px]">
            {sourceDevice?.name ?? link.sourceDeviceId}
          </span>
          <ArrowRight className="w-3.5 h-3.5 text-text-muted shrink-0 mx-2" />
          <span className="font-medium text-text-primary truncate max-w-[100px]">
            {targetDevice?.name ?? link.targetDeviceId}
          </span>
        </div>

        {/* Medium Selection */}
        <div>
          <label className="block text-text-muted mb-1 font-medium">Link Medium</label>
          <select
            value={link.medium}
            disabled={isUpdating}
            onChange={(e) => handleUpdateMedium(e.target.value as LinkMedium)}
            className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-brand-electric focus:outline-none"
          >
            <option value="copper">Copper Ethernet (1000BASE-T)</option>
            <option value="fiber">Optical Fibre (Single-mode)</option>
            <option value="wireless">Wireless Point-to-Point</option>
          </select>
        </div>

        {/* Installation Method */}
        <div>
          <label className="block text-text-muted mb-1 font-medium">Installation Method</label>
          <select
            value={link.installationMethod ?? "none"}
            disabled={isUpdating}
            onChange={(e) =>
              handleUpdateInstallation(e.target.value === "none" ? null : (e.target.value as LinkInstallationMethod))
            }
            className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-brand-electric focus:outline-none"
          >
            <option value="none">Not Classified (Partial Estimate)</option>
            <option value="indoor">Indoor Surface / Conduit</option>
            <option value="underground">Underground Direct Buried</option>
            <option value="aerial">Aerial Pole / Messenger</option>
          </select>
        </div>

        {/* Derived Length */}
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
          <span>Physical Span Length</span>
          <span className="font-mono text-text-primary">{Math.round(lengthM)} m</span>
        </div>

        {/* Delete Link */}
        <div className="pt-2 border-t border-border-subtle">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full gap-1.5"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete Link
          </Button>
        </div>
      </div>
    </div>
  );
}

