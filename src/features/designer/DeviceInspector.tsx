import { useState, useEffect } from "react";
import { X, Trash2, Cpu, Zap, Clock, DollarSign, MapPin, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "@/stores/editorStore";
import { useDesignStore } from "@/stores/designStore";
import { getApplicationContainer } from "@/application/container";
import type { DeviceId } from "@/contracts/primitives";
import type { AccessPointSpecs } from "@/contracts/domain";

export function DeviceInspector() {
  const selectedEntity = useEditorStore((s) => s.selectedEntity);
  const setSelectedEntity = useEditorStore((s) => s.setSelectedEntity);
  const aggregate = useDesignStore((s) => s.aggregate);

  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const device =
    selectedEntity?.type === "device" && aggregate
      ? aggregate.devicesById[selectedEntity.id as DeviceId]
      : null;

  const catalogItem = device && aggregate ? aggregate.catalogById[device.catalogItemId] : null;

  useEffect(() => {
    if (device) {
      setName(device.name);
      setHostname(device.hostname ?? "");
    }
  }, [device]);

  if (!device || !catalogItem) return null;

  const handleUpdate = async () => {
    if (!name.trim()) return;
    setIsUpdating(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "device/update",
        deviceId: device.id,
        patch: {
          name: name.trim(),
          hostname: hostname.trim() || null,
        },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete device "${device.name}"? Incident links will be cleaned up.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      const container = getApplicationContainer();
      await container.designSession.dispatch({
        type: "device/delete",
        deviceId: device.id,
      });
      setSelectedEntity(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete device");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="absolute top-4 right-4 z-[400] w-80 bg-surface-raised/95 backdrop-blur-md rounded-lg border border-border-strong shadow-2xl flex flex-col text-xs select-none">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand-electric" />
          <h3 className="font-semibold text-text-primary capitalize">{device.type} Inspector</h3>
        </div>
        <button
          onClick={() => setSelectedEntity(null)}
          className="text-text-muted hover:text-text-primary p-1 rounded hover:bg-surface-panel transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto">
        {/* Editable Name & Hostname */}
        <div className="space-y-2">
          <div>
            <label className="block text-text-muted mb-1 font-medium">Device Name</label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleUpdate}
                className="flex-1 px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary focus:border-brand-electric focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleUpdate}
                disabled={isUpdating || name === device.name}
                className="px-2"
              >
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-text-muted mb-1 font-medium">Hostname (Optional)</label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              onBlur={handleUpdate}
              placeholder="e.g. edge-rtr-01"
              className="w-full px-2.5 py-1.5 bg-surface-input border border-border-subtle rounded text-text-primary font-mono focus:border-brand-electric focus:outline-none text-[11px]"
            />
          </div>
        </div>

        {/* Hardware Catalog Specs */}
        <div className="pt-3 border-t border-border-subtle space-y-2">
          <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
            Catalogue Specifications
          </span>

          <div className="p-2.5 rounded bg-surface-panel border border-border-subtle space-y-1.5 text-[11px]">
            <div className="text-text-primary font-medium">{catalogItem.label}</div>

            <div className="flex items-center justify-between text-text-muted pt-1 border-t border-border-subtle/50">
              <span className="flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                Ports
              </span>
              <span className="font-mono text-text-primary">
                {catalogItem.specs.ports.copperEthernet} Cu / {catalogItem.specs.ports.fiber} Fi / {catalogItem.specs.ports.wireless} Wi
              </span>
            </div>

            {catalogItem.type === "accessPoint" && (
              <div className="flex items-center justify-between text-text-muted">
                <span>Radio Tx / Gain</span>
                <span className="font-mono text-text-primary">
                  {(catalogItem.specs as AccessPointSpecs).radio.txPowerDbm} dBm / {(catalogItem.specs as AccessPointSpecs).radio.antennaGainDbi} dBi
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Power
              </span>
              <span className="font-mono text-text-primary">{catalogItem.powerW} W</span>
            </div>

            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Lifespan
              </span>
              <span className="font-mono text-text-primary">{catalogItem.lifespanYears} years</span>
            </div>

            <div className="flex items-center justify-between text-text-muted">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Sample Price
              </span>
              <span className="font-mono text-text-primary">
                {catalogItem.unitPrice
                  ? `₹${catalogItem.unitPrice.amount.toLocaleString()} (${catalogItem.priceProvenance})`
                  : "Unlisted"}
              </span>
            </div>
          </div>
        </div>

        {/* Coordinates */}
        <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            Position
          </span>
          <span className="font-mono text-text-primary">
            {device.position.coordinates[1].toFixed(5)}, {device.position.coordinates[0].toFixed(5)}
          </span>
        </div>

        {/* Delete Action */}
        <div className="pt-2 border-t border-border-subtle">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            className="w-full gap-1.5"
          >
            {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete Device
          </Button>
        </div>
      </div>
    </div>
  );
}
