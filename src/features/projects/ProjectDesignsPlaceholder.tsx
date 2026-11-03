import { useParams } from "react-router-dom";

export function ProjectDesignsPlaceholder() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">Designs for Project: {projectId}</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Project designs list and comparison launcher module is not implemented yet.
      </p>
    </div>
  );
}
