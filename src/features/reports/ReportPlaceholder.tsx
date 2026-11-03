import { useParams } from "react-router-dom";

export function ReportPlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        PDF Report Preview (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Report preview and PDF generation panel are not implemented yet (scheduled for Phase 3).
      </p>
    </div>
  );
}

