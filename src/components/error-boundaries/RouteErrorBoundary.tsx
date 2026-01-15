/**
 * Route-Level Error Boundary
 *
 * Provides error handling at the route level with enhanced features:
 * - Route-specific error recovery
 * - Navigation-based error handling
 * - Context-aware error messages
 * - Automatic retry mechanisms
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../../lib/logger";

interface RouteErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  routeName?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
  errorId: string;
}

interface RouteErrorContextType {
  error: Error | null;
  retry: () => void;
  reset: () => void;
}

export const RouteErrorContext =
  React.createContext<RouteErrorContextType | null>(null);

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  static contextType = RouteErrorContext;

  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: "",
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<RouteErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `route-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { routeName, onError } = this.props;

    // Enhanced error logging with context
    logger.error("Route error boundary caught an error", error, {
      componentStack: errorInfo.componentStack,
      routeName,
      errorId: this.state.errorId,
      retryCount: this.state.retryCount,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo);
    }

    // Update state with full error info
    this.setState({
      error,
      errorInfo,
    });
  }

  retry = () => {
    const { maxRetries = 3 } = this.props;

    if (this.state.retryCount < maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));

      logger.info("Retrying route after error", {
        errorId: this.state.errorId,
        retryCount: this.state.retryCount + 1,
      });
    }
  };

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      errorId: "",
    });
  };

  render() {
    const { children, fallback, routeName } = this.props;
    const { hasError, error, errorId, retryCount } = this.state;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            backgroundColor: "#f9fafb",
          }}
        >
          <div
            style={{
              maxWidth: "32rem",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h2
              style={{
                fontSize: "1.25rem",
                fontWeight: "600",
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
              {routeName
                ? `Error in ${routeName}`
                : "An unexpected error occurred"}
            </p>

            <div
              style={{
                fontSize: "0.875rem",
                color: "#9ca3af",
                marginBottom: "1rem",
              }}
            >
              <p>
                <strong>Error ID:</strong> {errorId}
              </p>
              <p>
                <strong>Message:</strong> {error?.message}
              </p>
              {retryCount > 0 && (
                <p>
                  <strong>Retry attempts:</strong> {retryCount}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                justifyContent: "center",
              }}
            >
              {retryCount < (this.props.maxRetries || 3) && (
                <button
                  onClick={this.retry}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                  }}
                >
                  Try Again
                </button>
              )}

              <button
                onClick={this.reset}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#6b7280",
                  color: "white",
                  border: "none",
                  borderRadius: "0.375rem",
                  cursor: "pointer",
                }}
              >
                Reset
              </button>
            </div>

            <details style={{ marginTop: "2rem", textAlign: "left" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                Technical Details
              </summary>
              <div
                style={{
                  marginTop: "0.5rem",
                  padding: "0.75rem",
                  backgroundColor: "#f3f4f6",
                  borderRadius: "0.375rem",
                  fontSize: "0.75rem",
                  overflow: "auto",
                }}
              >
                <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {error?.stack}
                </pre>
              </div>
            </details>
          </div>
        </div>
      );
    }

    // Provide error context to children
    return (
      <RouteErrorContext.Provider
        value={{
          error: this.state.error,
          retry: this.retry,
          reset: this.reset,
        }}
      >
        {children}
      </RouteErrorContext.Provider>
    );
  }
}

// Hook for accessing route error context
export function useRouteError() {
  const context = React.useContext(RouteErrorContext);
  if (!context) {
    throw new Error("useRouteError must be used within a RouteErrorBoundary");
  }
  return context;
}

// HOC for wrapping components with route error boundary
export function withRouteErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: { routeName?: string; maxRetries?: number }
) {
  const WrappedComponent = (props: P) => (
    <RouteErrorBoundary
      routeName={options?.routeName}
      maxRetries={options?.maxRetries}
    >
      <Component {...props} />
    </RouteErrorBoundary>
  );

  WrappedComponent.displayName = `withRouteErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
