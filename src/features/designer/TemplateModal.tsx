import { useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import type { DeviceId } from "@/contracts/primitives";
import type { LinkMedium } from "@/contracts/enums";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplateModal({ isOpen, onClose }: TemplateModalProps) {
  const aggregate = useDesignStore((s) => s.aggregate);
  const devices = Object.values(aggregate?.devicesById ?? {});

  const [kind, setKind] = useState<"star" | "tree">("star");
  const [rootDeviceId, setRootDeviceId] = useState<string>(devices[0]?.id ?? "");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [medium, setMedium] = useState<LinkMedium>("copper");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !aggregate) return null;

  const handleToggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleApply = async () => {
    if (!rootDeviceId) {
      setError("Please select a root device");
      return;
    }
    const members = selectedMemberIds.filter((id) => id !== rootDeviceId);
    if (members.length === 0) {
      setError("Please select at least one member device to connect to the root");
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const container = getApplicationContainer();
      const res = await container.designSession.dispatch({
        type: "template/apply",
        template: {
          kind: "star",
          rootDeviceId: rootDeviceId as DeviceId,
          memberDeviceIds: members as DeviceId[],
          medium,
        },
      });

      if (res.status === "rejected") {
        setError(res.issues.map((i) => i.message).join(", "));
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to apply template");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-surface-raised border border-border-strong rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet" />
            <h2 className="text-base font-semibold text-text-primary">Topology Template</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-panel transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          {error && (
            <div className="p-3 rounded bg-status-error/10 border border-status-error/30 text-status-error">
              {error}
            </div>
          )}

          {/* Template Type */}
          <div>
            <label className="block text-text-secondary mb-1 font-medium">Template Topology</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setKind("star")}
                className={`flex-1 py-1.5 px-3 rounded text-center border font-medium transition-colors ${
                  kind === "star"
                    ? "bg-violet text-carbon-deep font-semibold border-violet"
                    : "bg-surface-panel border-border-subtle text-text-secondary hover:text-text-primary"
                }`}
              >
                Star Topology
              </button>
            </div>
          </div>

          {/* Root Device */}
          <div>
            <label className="block text-text-secondary mb-1 font-medium">Root / Hub Device</label>
            <select
              value={rootDeviceId}
              onChange={(e) => setRootDeviceId(e.target.value)}
              className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-violet focus:outline-none"
            >
              {devices.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.type})
                </option>
              ))}
            </select>
          </div>

          {/* Medium */}
          <div>
            <label className="block text-text-secondary mb-1 font-medium">Link Medium</label>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value as LinkMedium)}
              className="w-full px-3 py-2 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-violet focus:outline-none"
            >
              <option value="copper">Copper Ethernet</option>
              <option value="fiber">Optical Fibre</option>
              <option value="wireless">Wireless Point-to-Point</option>
            </select>
          </div>

          {/* Member devices */}
          <div>
            <label className="block text-text-secondary mb-1 font-medium">
              Select Member Devices to Connect
            </label>
            <div className="max-h-40 overflow-y-auto border border-border-subtle rounded bg-surface-panel p-2 space-y-1.5">
              {devices
                .filter((d) => d.id !== rootDeviceId)
                .map((d) => (
                  <label
                    key={d.id}
                    className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-elevated cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(d.id)}
                      onChange={() => handleToggleMember(d.id)}
                      className="rounded border-border-strong text-violet focus:ring-0"
                    />
                    <span className="text-text-primary font-medium">{d.name}</span>
                    <span className="text-text-muted text-[10px]">({d.type})</span>
                  </label>
                ))}
              {devices.length <= 1 && (
                <div className="text-text-muted text-center py-2">
                  Place more devices on the map to connect them with a template.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isApplying}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply} disabled={isApplying || devices.length <= 1}>
            {isApplying ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Apply Star Template
          </Button>
        </div>
      </div>
    </div>
  );
}

