import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getApplicationContainer } from "@/application/container";
import type { ProjectId } from "@/contracts/primitives";

export function ProjectRedirectPlaceholder() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      navigate("/", { replace: true });
      return;
    }

    const open = async () => {
      try {
        const container = getApplicationContainer();
        const summary = await container.projectService.openProject(projectId as ProjectId);
        navigate(`/projects/${projectId}/designs/${summary.baselineDesignId}/map`, { replace: true });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to open project");
      }
    };

    open();
  }, [projectId, navigate]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-base font-semibold text-status-error mb-2">Failed to open project</h1>
        <p className="text-xs text-text-muted mb-4">{error}</p>
        <button
          onClick={() => navigate("/", { replace: true })}
          className="text-xs text-brand-electric hover:underline"
        >
          Return to Projects list
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-20 text-text-muted">
      <Loader2 className="w-8 h-8 animate-spin text-brand-electric mb-3" />
      <span className="text-xs">Opening project workspace...</span>
    </div>
  );
}
