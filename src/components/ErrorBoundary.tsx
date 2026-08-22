import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = { children: ReactNode };
type ErrorBoundaryState = { hasError: boolean };

/** Catches render-time exceptions anywhere in the tree so a bug in one screen shows a friendly
 * recovery message instead of a blank white page. Only guards against render/lifecycle errors —
 * data-fetch errors are handled per-page by TanStack Query's own error state, not this. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled UI error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-page">
          <div className="error-boundary-card">
            <h2>Something went wrong</h2>
            <p>An unexpected error occurred. Try reloading the page — if this keeps happening, contact your administrator.</p>
            <button type="button" className="btn primary" onClick={() => window.location.reload()}>
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
