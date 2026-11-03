import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 m-4 rounded border border-status-error/40 bg-surface-panel">
          <h2 className="text-lg font-semibold text-status-error">Application Error</h2>
          <p className="mt-2 text-sm text-text-secondary">
            An unexpected error occurred in the NetScape workstation shell.
          </p>
          <pre className="mt-4 p-4 text-xs font-mono bg-surface-input text-text-primary rounded overflow-auto">
            {this.state.error?.message ?? "Unknown error"}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-3 py-1.5 text-xs font-medium rounded bg-brand-electric text-white"
          >
            Reload Workstation
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

