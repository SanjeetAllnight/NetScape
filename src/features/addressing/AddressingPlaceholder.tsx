import { useParams } from "react-router-dom";

export function AddressingPlaceholder() {
  const { projectId, designId } = useParams<{ projectId: string; designId: string }>();

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-text-primary">
        IPv4 Addressing &amp; VLSM (Project: {projectId}, Design: {designId})
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Subnet requirements and VLSM allocation workspace are not implemented yet (scheduled for Phase 3).
      </p>
    </div>
  );
}
