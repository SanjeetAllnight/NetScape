import { useParams } from "react-router-dom";

export function SimulationPlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Network Simulation (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Dijkstra routing and failure simulation panel is not implemented yet (scheduled for Phase 3).
      </p>
    </div>
  );
}

