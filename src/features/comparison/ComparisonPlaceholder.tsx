import { useParams, useSearchParams } from "react-router-dom";

export function ComparisonPlaceholder() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const a = searchParams.get("a") ?? "default";
  const b = searchParams.get("b") ?? "default";

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        Design Comparison (Project: {projectId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Comparing design {a} with {b}. Design comparison module is not implemented yet (scheduled for Phase 3).
      </p>
    </div>
  );
}
