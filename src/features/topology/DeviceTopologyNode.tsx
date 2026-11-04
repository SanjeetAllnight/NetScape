import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Router, Network, Wifi, Server } from "lucide-react";
import type { DeviceType } from "@/contracts/enums";

export interface DeviceNodeData {
  deviceId: string;
  name: string;
  type: DeviceType;
  hostname: string | null;
  isSelected?: boolean;
}

export const DeviceTopologyNode = memo((props: NodeProps) => {
  const data = props.data as unknown as DeviceNodeData;
  const { name, type, hostname } = data;
  const isSelected = props.selected;
  const stroke = isSelected ? "border-brand-cantaloupe ring-2 ring-brand-cantaloupe/40" : "border-border-strong";

  let Icon = Router;
  if (type === "switch") Icon = Network;
  else if (type === "accessPoint") Icon = Wifi;
  else if (type === "server") Icon = Server;

  return (
    <div
      className={`min-w-[140px] px-3 py-2 rounded-lg bg-surface-raised border ${stroke} shadow-xl flex items-center gap-2.5 transition-all text-xs select-none`}
    >
      {/* Input / Output connection handles on all 4 sides */}
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-brand-electric !border-border-subtle" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-brand-cantaloupe !border-border-subtle" />
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-brand-electric !border-border-subtle" />
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-brand-cantaloupe !border-border-subtle" />

      <div className="p-1.5 rounded bg-surface-elevated text-brand-electric border border-border-subtle shrink-0">
        <Icon className="w-4 h-4" />
      </div>

      <div className="truncate flex-1">
        <div className="font-semibold text-text-primary truncate">{name}</div>
        <div className="text-[10px] text-text-muted truncate capitalize">
          {hostname ? hostname : type}
        </div>
      </div>
    </div>
  );
});

DeviceTopologyNode.displayName = "DeviceTopologyNode";

