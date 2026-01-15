/**
 * Root Error Boundary
 *
 * Top-level error boundary that catches all unhandled React errors.
 * Provides a crash screen with recovery options.
 */

import React, { Component, ErrorInfo, ReactNode } from "react";

interface RootErrorBoundaryProps {
  children: ReactNode;
}

interface RootErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export class RootErrorBoundary extends Component<
  RootErrorBoundaryProps,
  RootErrorBoundaryState
> {
  constructor(props: RootErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<RootErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    console.error("[RootErrorBoundary] Uncaught error:", error);
    console.error(
      "[RootErrorBoundary] Component stack:",
      errorInfo.componentStack
    );

    try {
      if (typeof window !== "undefined" && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          extra: {
            componentStack: errorInfo.componentStack,
            errorId: this.state.errorId,
          },
        });
      }
    } catch {
      // Sentry not available
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });
  };

  handleClearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Storage not available
    }
    window.location.reload();
  };

  render() {
    const { children } = this.props;
    const { hasError, error, errorInfo, errorId } = this.state;

    if (!hasError) {
      return children;
    }

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)",
          padding: "2rem",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: "40rem",
            width: "100%",
            background: "white",
            borderRadius: "12px",
            padding: "2rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "0.5rem" }}>💥</div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                margin: 0,
                color: "#1f2937",
              }}
            >
              Something went wrong
            </h1>
            <p style={{ color: "#6b7280", marginTop: "0.5rem" }}>
              The application encountered an unexpected error.
            </p>
          </div>

          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#991b1b",
                  textTransform: "uppercase",
                }}
              >
                Error
              </span>
              <span
                style={{
                  fontSize: "0.625rem",
                  color: "#9ca3af",
                  fontFamily: "monospace",
                }}
              >
                {errorId}
              </span>
            </div>
            <p
              style={{
                margin: 0,
                color: "#b91c1c",
                fontSize: "0.875rem",
                wordBreak: "break-word",
              }}
            >
              {error?.message || "Unknown error"}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginBottom: "1.5rem",
            }}
          >
            <button
              onClick={this.handleReload}
              style={{
                padding: "0.625rem 1.5rem",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              Reload Page
            </button>
            <button
              onClick={this.handleReset}
              style={{
                padding: "0.625rem 1.5rem",
                background: "#e5e7eb",
                color: "#374151",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleClearStorageAndReload}
              style={{
                padding: "0.625rem 1.5rem",
                background: "#fef3c7",
                color: "#92400e",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.875rem",
              }}
            >
              Clear Cache & Reload
            </button>
          </div>

          <details style={{ marginTop: "1rem" }}>
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 500,
                color: "#374151",
                fontSize: "0.875rem",
              }}
            >
              Technical Details
            </summary>
            <div
              style={{
                marginTop: "0.75rem",
                padding: "1rem",
                background: "#1f2937",
                borderRadius: "8px",
                overflow: "auto",
                maxHeight: "300px",
              }}
            >
              <pre
                style={{
                  margin: 0,
                  color: "#e5e7eb",
                  fontSize: "0.75rem",
                  whiteSpace: "pre-wrap",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {error?.stack || "No stack trace available"}
              </pre>
              {errorInfo?.componentStack && (
                <>
                  <hr
                    style={{
                      border: "none",
                      borderTop: "1px solid #374151",
                      margin: "1rem 0",
                    }}
                  />
                  <pre
                    style={{
                      margin: 0,
                      color: "#9ca3af",
                      fontSize: "0.75rem",
                      whiteSpace: "pre-wrap",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                </>
              )}
            </div>
          </details>

          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e5e7eb",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: "0.75rem", color: "#9ca3af", margin: 0 }}>
              If this problem persists, please contact support with error ID:{" "}
              <code
                style={{
                  background: "#f3f4f6",
                  padding: "0.125rem 0.375rem",
                  borderRadius: "4px",
                }}
              >
                {errorId}
              </code>
            </p>
          </div>
        </div>
      </div>
    );
  }
}

export default RootErrorBoundary;
