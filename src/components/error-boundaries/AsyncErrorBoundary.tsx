/**
 * Async Operation Error Boundary
 *
 * Specialized error boundary for handling async operations:
 * - Promise rejections
 * - API call failures
 * - Timeout errors
 * - Network connectivity issues
 */

import React, { Component, ReactNode } from "react";
import logger from "@lib/logger";

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error) => void;
  timeout?: number;
  retryCount?: number;
  onRetry?: (count: number) => void;
}

interface AsyncErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
  isRetrying: boolean;
}

export class AsyncErrorBoundary extends Component<
  AsyncErrorBoundaryProps,
  AsyncErrorBoundaryState
> {
  private timeoutId: any = null;

  constructor(props: AsyncErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<AsyncErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error) {
    const { onError } = this.props;

    logger.error("Async error boundary caught an error", error, {
      retryCount: this.state.retryCount,
      componentStack: "Async operation",
    });

    if (onError) {
      onError(error);
    }
  }

  componentWillUnmount() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  private handleRetry = () => {
    const { retryCount = 3, onRetry } = this.props;

    if (this.state.retryCount < retryCount) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1,
        isRetrying: true,
      }));

      if (onRetry) {
        onRetry(this.state.retryCount + 1);
      }

      // Clear retrying state after a short delay
      setTimeout(() => {
        this.setState({ isRetrying: false });
      }, 1000);
    }
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      retryCount: 0,
      isRetrying: false,
    });
  };

  render() {
    const { children, fallback, timeout = 30000 } = this.props;
    const { hasError, error, retryCount, isRetrying } = this.state;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            backgroundColor: "#f9fafb",
          }}
        >
          <div
            style={{
              maxWidth: "20rem",
              width: "100%",
              textAlign: "center",
              gap: "1rem",
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
              Async Operation Failed
            </h2>
            <p style={{ color: "#6b7280", marginBottom: "1rem" }}>
              {error?.message || "An async operation encountered an error"}
            </p>

            {retryCount > 0 && (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "#9ca3af",
                  marginBottom: "1rem",
                }}
              >
                Retry attempts: {retryCount}
              </p>
            )}

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {retryCount < (this.props.retryCount || 3) && (
                <button
                  onClick={this.handleRetry}
                  disabled={isRetrying}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.375rem",
                    cursor: isRetrying ? "not-allowed" : "pointer",
                    opacity: isRetrying ? 0.5 : 1,
                  }}
                >
                  {isRetrying ? "Retrying..." : "Try Again"}
                </button>
              )}

              <button
                onClick={this.handleReset}
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
          </div>
        </div>
      );
    }

    return (
      <AsyncOperationContext.Provider value={{ handleRetry: this.handleRetry }}>
        {children}
      </AsyncOperationContext.Provider>
    );
  }
}

// Context for async operations
interface AsyncOperationContextType {
  handleRetry: () => void;
}

export const AsyncOperationContext =
  React.createContext<AsyncOperationContextType>({
    handleRetry: () => {},
  });

// Hook for async operations with error handling
export function useAsyncOperation<T>(
  asyncOperation: () => Promise<T>,
  options?: {
    timeout?: number;
    retryCount?: number;
    onSuccess?: (result: T) => void;
    onError?: (error: Error) => void;
  }
) {
  const [state, setState] = React.useState<{
    data: T | null;
    loading: boolean;
    error: Error | null;
  }>({
    data: null,
    loading: false,
    error: null,
  });

  const { handleRetry } = React.useContext(AsyncOperationContext);

  const execute = React.useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const timeout = options?.timeout || 30000;

      const result = await Promise.race([
        asyncOperation(),
        new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Operation timed out")), timeout);
        }),
      ]);

      setState({ data: result, loading: false, error: null });

      if (options?.onSuccess) {
        options.onSuccess(result);
      }

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      setState({ data: null, loading: false, error: err });

      if (options?.onError) {
        options.onError(err);
      }

      throw err;
    }
  }, [asyncOperation, options]);

  const reset = React.useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
    retry: handleRetry,
  };
}

// HOC for wrapping components with async error boundary
export function withAsyncErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: { timeout?: number; retryCount?: number }
) {
  const WrappedComponent = (props: P) => (
    <AsyncErrorBoundary
      timeout={options?.timeout}
      retryCount={options?.retryCount}
    >
      <Component {...props} />
    </AsyncErrorBoundary>
  );

  WrappedComponent.displayName = `withAsyncErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
