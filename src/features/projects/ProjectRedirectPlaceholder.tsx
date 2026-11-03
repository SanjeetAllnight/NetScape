import { useParams } from "react-router-dom";

export function ProjectRedirectPlaceholder() {
  const { projectId } = useParams<{ projectId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">Project Redirect: {projectId}</h1>
      <p className="mt-2 text-sm text-text-secondary">
        Project baseline redirection will be handled by the project service once implemented in Phase 1/2.
      </p>
    </div>
  );
}

