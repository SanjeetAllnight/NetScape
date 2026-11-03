import { useParams } from "react-router-dom";

export function CostPlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Cost Analysis (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        CAPEX, OPEX and TCO cost analysis panel is not implemented yet (scheduled for Phase 3).
      </p>
    </div>
  );
}

