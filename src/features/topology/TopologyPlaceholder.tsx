import { useParams } from "react-router-dom";

export function TopologyPlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Logical Topology (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Logical topology workspace is not implemented yet (scheduled for Phase 2).
      </p>
    </div>
  );
}
