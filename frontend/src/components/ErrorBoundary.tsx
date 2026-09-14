/**
 * Travelog MVP — Global Error Boundary
 *
 * Catches rendering/runtime errors in the React tree and renders a
 * fallback UI instead of unmounting the whole application. Errors are
 * logged to the console (no external error reporting in MVP1).
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ hasError: false, message: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="error-boundary">
          <h2>Si è verificato un errore</h2>
          <p>{this.state.message ?? "Errore imprevisto durante il rendering della pagina."}</p>
          <button type="button" onClick={this.reset}>
            Riprova
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
