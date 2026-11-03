import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="p-8 text-center">
      <h1 className="text-2xl font-bold text-text-primary">404 — Page Not Found</h1>
      <p className="mt-2 text-sm text-text-secondary">
        The requested NetScape workstation route does not exist.
      </p>
      <div className="mt-4">
        <Link
          to="/"
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded bg-brand-electric text-white hover:bg-brand-electric/90"
        >
          Return to Projects
        </Link>
      </div>
    </div>
  );
}
