import { useParams } from "react-router-dom";

export function MapWorkspacePlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Map Workspace (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Geographical map planning workspace and coverage panel are not implemented yet (scheduled for Phase 2).
      </p>
    </div>
  );
}

