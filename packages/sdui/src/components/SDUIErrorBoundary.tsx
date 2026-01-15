/**
 * SDUI Error Boundary - Production-Grade Error Handling
 *
 * CRITICAL: Prevents single component failures from crashing entire page
 *
 * Features:
 * - Catches React component errors
 * - Logs to monitoring (Sentry/Datadog)
 * - Shows fallback UI
 * - Allows retry
 * - Tracks error metrics
 * - Prevents error propagation
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import { logger } from "../../lib/logger";
import { getTracer } from "../../lib/observability";
import { SpanStatusCode } from "@opentelemetry/api";

interface Props {
  /** Unique identifier for this component instance */
  componentId?: string;
  /** Component type (for logging) */
  componentType?: string;
  /** Custom fallback UI */
  fallback?: ReactNode;
  /** Error callback for external error tracking */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show retry button */
  allowRetry?: boolean;
  /** Children to render */
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export class SDUIErrorBoundary extends Component<Props, State> {
  private tracer = getTracer("SDUIErrorBoundary");

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentId, componentType, onError } = this.props;

    // Create span for error tracking
    this.tracer.startActiveSpan("sdui_component_error", (span) => {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      span.setAttributes({
        "component.id": componentId || "unknown",
        "component.type": componentType || "unknown",
        "error.message": error.message,
        "error.stack": error.stack || "",
        "retry.count": this.state.retryCount,
      });

      // Log error with full context
      logger.error("SDUI Component Error", {
        componentId,
        componentType,
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
        timestamp: new Date().toISOString(),
      });

      // Call external error handler (e.g., Sentry)
      if (onError) {
        try {
          onError(error, errorInfo);
        } catch (callbackError) {
          logger.error("Error in SDUIErrorBoundary callback", {
            error: callbackError,
          });
        }
      }

      // Track in analytics
      if (typeof window !== "undefined" && window.analytics) {
        window.analytics.track("sdui_component_error", {
          component_id: componentId,
          component_type: componentType,
          error_message: error.message,
          retry_count: this.state.retryCount,
        });
      }

      span.end();
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });
  }

  handleRetry = (): void => {
    const { componentId } = this.props;
    const { retryCount } = this.state;

    logger.info("SDUI Component Retry", {
      componentId,
      retryCount: retryCount + 1,
    });

    // Track retry attempt
    if (typeof window !== "undefined" && window.analytics) {
      window.analytics.track("sdui_component_retry", {
        component_id: componentId,
        retry_count: retryCount + 1,
      });
    }

    // Reset error state and increment retry count
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: retryCount + 1,
    });
  };

  render(): ReactNode {
    const { hasError, error, retryCount } = this.state;
    const {
      children,
      fallback,
      allowRetry = true,
      componentId,
      componentType,
    } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <div
          className="sdui-error-boundary"
          role="alert"
          aria-live="assertive"
          data-component-id={componentId}
          data-component-type={componentType}
        >
          <div className="sdui-error-boundary__container">
            <div className="sdui-error-boundary__icon">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <div className="sdui-error-boundary__content">
              <h3 className="sdui-error-boundary__title">Component Error</h3>
              <p className="sdui-error-boundary__message">
                This component failed to load.{" "}
                {allowRetry && "You can try again or refresh the page."}
              </p>

              {process.env.NODE_ENV === "development" && error && (
                <details className="sdui-error-boundary__details">
                  <summary>Error Details (Development Only)</summary>
                  <pre className="sdui-error-boundary__stack">
                    {error.message}
                    {"\n\n"}
                    {error.stack}
                  </pre>
                </details>
              )}

              {allowRetry && retryCount < 3 && (
                <button
                  onClick={this.handleRetry}
                  className="sdui-error-boundary__retry-button"
                  type="button"
                >
                  Try Again {retryCount > 0 && `(${retryCount}/3)`}
                </button>
              )}

              {retryCount >= 3 && (
                <p className="sdui-error-boundary__max-retries">
                  Maximum retry attempts reached. Please refresh the page.
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Functional wrapper for easier usage
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, "children">
): React.FC<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <SDUIErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </SDUIErrorBoundary>
    );
  };
}

/**
 * Hook for programmatic error handling
 */
export function useErrorBoundary(): {
  showBoundary: (error: Error) => void;
} {
  const [, setState] = React.useState();

  return {
    showBoundary: (error: Error) => {
      setState(() => {
        throw error;
      });
    },
  };
}
