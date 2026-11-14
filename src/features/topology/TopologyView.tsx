import { useEffect, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type OnNodeDrag,
  BackgroundVariant,
} from "@xyflow/react";
import { Loader2 } from "lucide-react";
import { ProjectHeader } from "@/features/shell/ProjectHeader";
import { DeviceTopologyNode } from "./DeviceTopologyNode";
import { DeviceInspector } from "@/features/designer/DeviceInspector";
import { LinkInspector } from "@/features/designer/LinkInspector";
import { useDesignStore } from "@/stores/designStore";
import { useEditorStore } from "@/stores/editorStore";
import { getApplicationContainer } from "@/application/container";
import { suggestLogicalPosition } from "@/domain";
import type { DesignId, DeviceId, LogicalPoint } from "@/contracts/primitives";
import type { Device, Link } from "@/contracts/domain";

const nodeTypes: NodeTypes = {
  deviceNode: DeviceTopologyNode,
};

export function TopologyView() {
  const { designId } = useParams<{ projectId: string; designId: string }>();

  const aggregate = useDesignStore((s) => s.aggregate);
  const selectedEntity = useEditorStore((s) => s.selectedEntity);
  const setSelectedEntity = useEditorStore((s) => s.setSelectedEntity);

  // Ensure design is opened in session
  useEffect(() => {
    if (!designId) return;

    const container = getApplicationContainer();
    if (aggregate?.design.id !== designId) {
      container.designSession.open(designId as DesignId);
    }
  }, [designId, aggregate?.design.id]);

  // Compute React Flow nodes from aggregate devices
  const initialNodes: Node[] = useMemo(() => {
    if (!aggregate) return [];

    const devices = Object.values(aggregate.devicesById) as Device[];
    return devices.map((dev, index) => {
      const savedPos = aggregate.design.logicalLayout[dev.id];
      const pos = savedPos ? { x: savedPos.x, y: savedPos.y } : suggestLogicalPosition(index);

      return {
        id: dev.id,
        type: "deviceNode",
        position: { x: pos.x, y: pos.y },
        data: {
          deviceId: dev.id,
          name: dev.name,
          type: dev.type,
          hostname: dev.hostname,
        },
        selected: selectedEntity?.type === "device" && selectedEntity.id === dev.id,
      };
    });
  }, [aggregate, selectedEntity]);

  // Compute React Flow edges from aggregate links
  const initialEdges: Edge[] = useMemo(() => {
    if (!aggregate) return [];

    const links = Object.values(aggregate.linksById) as Link[];
    return links.map((link) => {
      const isSelected = selectedEntity?.type === "link" && selectedEntity.id === link.id;

      let stroke = "#0297DE"; // copper
      if (link.medium === "fiber") stroke = "#FC734D";
      if (link.medium === "wireless") stroke = "#35A879";

      return {
        id: link.id,
        source: link.sourceDeviceId,
        target: link.targetDeviceId,
        animated: link.medium === "wireless",
        selected: isSelected,
        label: link.medium,
        labelStyle: { fill: "#9AAEB8", fontSize: 10, fontFamily: "monospace" },
        labelBgStyle: { fill: "#0A171E", fillOpacity: 0.9, stroke: "#172A34" },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: isSelected ? "#FFFFFF" : stroke,
          strokeWidth: isSelected ? 3 : 2,
        },
      };
    });
  }, [aggregate, selectedEntity]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when aggregate changes
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Commit layout update when a node drag stops
  const handleNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (!aggregate) return;

      const deviceId = node.id as DeviceId;
      const currentLayout = aggregate.design.logicalLayout;

      const updatedLayout: Record<DeviceId, LogicalPoint> = {
        ...currentLayout,
        [deviceId]: {
          coordinateSpace: "logical",
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        },
      };

      const container = getApplicationContainer();
      container.designSession.dispatch({
        type: "layout/set",
        positions: updatedLayout,
      });
    },
    [aggregate]
  );

  // Connect edge gesture -> creates link via same link/add domain command
  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      const container = getApplicationContainer();
      container.designSession.dispatch({
        type: "link/add",
        sourceDeviceId: connection.source as DeviceId,
        targetDeviceId: connection.target as DeviceId,
        medium: "copper",
      });
    },
    []
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedEntity({ type: "device", id: node.id });
    },
    [setSelectedEntity]
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedEntity({ type: "link", id: edge.id });
    },
    [setSelectedEntity]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedEntity(null);
  }, [setSelectedEntity]);

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-canvas relative">
      <ProjectHeader />

      <div className="flex-1 relative overflow-hidden">
        {!aggregate ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
            <Loader2 className="w-8 h-8 animate-spin text-brand-electric mb-3" />
            <span className="text-xs">Loading topology view...</span>
          </div>
        ) : (
          <>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={handleNodeDragStop}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onEdgeClick={handleEdgeClick}
              onPaneClick={handlePaneClick}
              fitView
              minZoom={0.2}
              maxZoom={2.5}
              className="bg-surface-canvas"
            >
              <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#172A34" />
              <Controls className="!bg-surface-raised !border-border-strong !shadow-xl" />
              <MiniMap
                className="!bg-surface-raised !border-border-strong !rounded-lg !overflow-hidden"
                nodeColor="#0297DE"
                maskColor="rgba(2, 7, 10, 0.7)"
              />
            </ReactFlow>

            {/* Floating Inspectors */}
            <DeviceInspector />
            <LinkInspector />
          </>
        )}
      </div>
    </div>
  );
}

