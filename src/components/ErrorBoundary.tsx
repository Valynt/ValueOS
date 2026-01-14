/**
 * Unified Error Boundary Component
 *
 * Consolidated error handling for all contexts with:
 * - Error classification (network, auth, validation, unknown)
 * - Retry mechanisms with exponential backoff
 * - Sentry integration and analytics tracking
 * - Context-aware fallback UIs (general, agent, canvas, sdui)
 * - Circuit breaker awareness
 * - Accessibility features
 */

import React, { Component, ErrorInfo, ReactNode } from "react";
import {
  AlertTriangle,
  RefreshCw,
  Shield,
  XCircle,
  Home,
  Bug,
} from "lucide-react";
import { logger } from "../lib/logger";
import { captureException, captureMessage, addBreadcrumb } from "../lib/sentry";
import { env } from "../lib/env";

// Error classification types
export type ErrorType =
  | "network"
  | "auth"
  | "validation"
  | "runtime"
  | "unknown";

// Context types for different fallback UIs
export type ErrorBoundaryContext =
  | "general"
  | "agent"
  | "canvas"
  | "sdui"
  | "template";

// Error boundary variant configuration
export interface ErrorBoundaryVariant {
  context: ErrorBoundaryContext;
  showDetails?: boolean;
  allowRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  circuitBreakerAware?: boolean;
  componentId?: string;
  componentType?: string;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  variant?: ErrorBoundaryVariant;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorType: ErrorType) => void;
  onRetry?: () => void;
  onReset?: () => void;
  // Circuit breaker props
  circuitBreakerOpen?: boolean;
  agentType?: string;
  // Template props
  templateName?: string;
  // Canvas props
  caseId?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorType: ErrorType;
  retryCount: number;
  lastRetryTime?: number;
  isRetrying: boolean;
}

// Utility to classify errors
function classifyError(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const stack = error.stack?.toLowerCase() || "";

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("connection")
  ) {
    return "network";
  }
  if (
    message.includes("unauthorized") ||
    message.includes("forbidden") ||
    message.includes("401") ||
    message.includes("403")
  ) {
    return "auth";
  }
  if (
    message.includes("validation") ||
    message.includes("invalid") ||
    message.includes("required")
  ) {
    return "validation";
  }
  if (
    message.includes("script") ||
    message.includes("xss") ||
    message.includes("eval") ||
    stack.includes("componentdidcatch")
  ) {
    return "runtime";
  }
  return "unknown";
}

// Exponential backoff delay calculator
function calculateRetryDelay(
  retryCount: number,
  baseDelay: number = 1000
): number {
  return Math.min(baseDelay * Math.pow(2, retryCount), 30000); // Max 30 seconds
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorType: "unknown",
      retryCount: 0,
      isRetrying: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorType: classifyError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { variant, onError, templateName, caseId, agentType } = this.props;
    const errorType = classifyError(error);

    // Update state with error info
    this.setState({ errorInfo });

    // Log error with context
    const logContext = {
      errorType,
      componentId: variant?.componentId,
      componentType: variant?.componentType,
      templateName,
      caseId,
      agentType,
      retryCount: this.state.retryCount,
      context: variant?.context || "general",
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    };

    logger.error("ErrorBoundary caught error:", logContext);

    // Add breadcrumb for debugging
    addBreadcrumb({
      category: "error",
      message: `Error in ${variant?.context || "general"} context: ${error.message}`,
      level: "error",
      data: logContext,
    });

    // Capture in Sentry
    captureException(error, {
      extra: logContext,
    });

    // Track analytics
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("error_boundary_triggered", {
        error_type: errorType,
        context: variant?.context || "general",
        component_id: variant?.componentId,
        retry_count: this.state.retryCount,
      });
    }

    // Call custom error handler
    onError?.(error, errorInfo, errorType);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = async () => {
    const { variant, onRetry } = this.props;
    const { retryCount, errorType } = this.state;

    const maxRetries = variant?.maxRetries ?? 3;
    const retryDelay = variant?.retryDelay ?? 1000;

    if (retryCount >= maxRetries) {
      logger.warn("Max retry attempts reached", { retryCount, maxRetries });
      return;
    }

    this.setState({ isRetrying: true });

    const delay = calculateRetryDelay(retryCount, retryDelay);
    const now = Date.now();
    const timeSinceLastRetry = now - (this.state.lastRetryTime || 0);

    if (timeSinceLastRetry < delay) {
      await new Promise((resolve) => {
        this.retryTimeoutId = setTimeout(resolve, delay - timeSinceLastRetry);
      });
    }

    logger.info("Retrying after error", {
      errorType,
      retryCount: retryCount + 1,
      maxRetries,
      delay,
    });

    // Track retry attempt
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("error_boundary_retry", {
        error_type: errorType,
        retry_count: retryCount + 1,
        context: variant?.context || "general",
      });
    }

    // Reset error state and increment retry count
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: retryCount + 1,
      lastRetryTime: Date.now(),
      isRetrying: false,
    });

    onRetry?.();
  };

  handleReset = () => {
    const { onReset } = this.props;

    logger.info("Manually resetting error boundary");

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      lastRetryTime: undefined,
      isRetrying: false,
    });

    onReset?.();
  };

  renderCircuitBreakerFallback(): ReactNode {
    const { agentType } = this.props;

    return (
      <div
        className="flex items-center justify-center min-h-[200px] p-6 bg-orange-50 border border-orange-200 rounded-lg"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center max-w-md">
          <Shield className="h-12 w-12 text-orange-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-orange-900 mb-2">
            Service Temporarily Unavailable
          </h3>
          <p className="text-orange-800 mb-4">
            The {agentType || "service"} is temporarily unavailable due to
            repeated failures. This is a protective measure to prevent cascading
            issues.
          </p>
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  renderAgentFallback(): ReactNode {
    const { variant } = this.props;
    const { error, errorInfo, retryCount } = this.state;
    const maxRetries = variant?.maxRetries ?? 3;

    return (
      <div
        className="flex items-center justify-center min-h-[200px] p-6 bg-red-50 border border-red-200 rounded-lg"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center max-w-md">
          <XCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">
            Agent Content Error
          </h3>
          <p className="text-red-800 mb-4">
            An error occurred while generating agent content.
          </p>

          {variant?.showDetails && error && (
            <details className="mb-4 text-left bg-red-100 p-3 rounded text-sm">
              <summary className="cursor-pointer font-medium text-red-900 mb-2">
                Error Details
              </summary>
              <div className="text-red-800">
                <div className="mb-2">
                  <strong>Message:</strong> {error.message}
                </div>
                {error.stack && (
                  <div>
                    <strong>Stack:</strong>
                    <pre className="mt-1 text-xs overflow-auto">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {variant?.allowRetry !== false && retryCount < maxRetries && (
            <button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`h-4 w-4 ${this.state.isRetrying ? "animate-spin" : ""}`}
              />
              {this.state.isRetrying ? "Retrying..." : "Retry"}
            </button>
          )}
        </div>
      </div>
    );
  }

  renderCanvasFallback(): ReactNode {
    const { variant, caseId } = this.props;
    const { error, retryCount } = this.state;
    const maxRetries = variant?.maxRetries ?? 3;

    return (
      <div
        className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-background border border-border rounded-lg"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Canvas Rendering Error
          </h3>
          <p className="text-muted-foreground mb-6">
            We encountered an issue rendering this content. This might be due to
            invalid data or a temporary glitch.
          </p>

          {variant?.showDetails && error && (
            <details className="mb-4 text-left bg-muted p-3 rounded text-sm">
              <summary className="cursor-pointer font-medium mb-2">
                Error Details (Development)
              </summary>
              <pre className="text-xs text-red-600 overflow-auto">
                {error.message}
                {"\n"}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            {variant?.allowRetry !== false && retryCount < maxRetries && (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <RefreshCw
                  className={`h-4 w-4 ${this.state.isRetrying ? "animate-spin" : ""}`}
                />
                {this.state.isRetrying ? "Retrying..." : "Try Again"}
              </button>
            )}

            {caseId && (
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-2 px-4 py-2 border border-border text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                Refresh Page
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  renderSDUIFallback(): ReactNode {
    const { variant } = this.props;
    const { error, retryCount } = this.state;
    const maxRetries = variant?.maxRetries ?? 3;

    return (
      <div
        className="sdui-error-boundary flex items-center justify-center min-h-[200px] p-6 bg-gray-50 border border-gray-200 rounded-lg"
        role="alert"
        aria-live="assertive"
        data-component-id={variant?.componentId}
        data-component-type={variant?.componentType}
      >
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mb-4">
            <Bug className="h-6 w-6 text-red-600" />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Component Error
          </h3>
          <p className="text-gray-600 mb-4">
            This component failed to load. You can try again or refresh the
            page.
          </p>

          {variant?.showDetails && error && (
            <details className="mb-4 text-left bg-gray-100 p-3 rounded text-sm">
              <summary className="cursor-pointer font-medium text-gray-900 mb-2">
                Error Details (Development Only)
              </summary>
              <pre className="text-xs text-red-600 overflow-auto">
                {error.message}
                {"\n\n"}
                {error.stack}
              </pre>
            </details>
          )}

          {variant?.allowRetry !== false && retryCount < maxRetries && (
            <button
              onClick={this.handleRetry}
              disabled={this.state.isRetrying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors mr-3"
            >
              <RefreshCw
                className={`h-4 w-4 ${this.state.isRetrying ? "animate-spin" : ""}`}
              />
              {this.state.isRetrying
                ? "Retrying..."
                : `Try Again (${retryCount}/${maxRetries})`}
            </button>
          )}

          {retryCount >= maxRetries && (
            <p className="text-sm text-gray-600">
              Maximum retry attempts reached. Please refresh the page.
            </p>
          )}
        </div>
      </div>
    );
  }

  renderTemplateFallback(): ReactNode {
    const { templateName, variant } = this.props;
    const { error } = this.state;

    return (
      <div
        className="flex items-center justify-center min-h-[200px] p-6 bg-amber-50 border border-amber-200 rounded-lg"
        role="alert"
        aria-live="assertive"
      >
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-amber-900 mb-2">
            {templateName ? `${templateName} Template Error` : "Template Error"}
          </h3>
          <p className="text-amber-800 mb-4">
            This template encountered an error. Please try refreshing the page.
          </p>

          {variant?.showDetails && error && (
            <details className="mb-4 text-left bg-amber-100 p-3 rounded text-sm">
              <summary className="cursor-pointer font-medium text-amber-900 mb-2">
                Technical Details
              </summary>
              <pre className="text-xs text-red-600 overflow-auto">
                {error.message}
                {"\n"}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  renderGeneralFallback(): ReactNode {
    const { variant } = this.props;
    const { error, errorType, retryCount } = this.state;
    const maxRetries = variant?.maxRetries ?? 3;

    return (
      <div
        className="flex items-center justify-center min-h-screen bg-gray-50 px-4"
        role="alert"
        aria-labelledby="error-title"
      >
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <AlertTriangle className="h-16 w-16 text-red-600 mx-auto mb-4" />

          <h1
            id="error-title"
            className="text-2xl font-bold text-gray-900 mb-2"
          >
            Something went wrong
          </h1>

          <p className="text-gray-600 mb-6">
            We encountered an unexpected {errorType} error. Please try
            refreshing the page.
          </p>

          {variant?.showDetails && error && (
            <details className="text-left mb-6 p-4 bg-gray-50 rounded-lg">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                Error Details
              </summary>
              <pre className="text-xs text-red-600 overflow-auto">
                {error.toString()}
                {error.stack}
              </pre>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {variant?.allowRetry !== false && retryCount < maxRetries && (
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <RefreshCw
                  className={`h-4 w-4 mr-2 ${this.state.isRetrying ? "animate-spin" : ""}`}
                />
                {this.state.isRetrying ? "Retrying..." : "Try Again"}
              </button>
            )}

            <button
              onClick={() => (window.location.href = "/")}
              className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Home className="h-4 w-4 mr-2" />
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  render() {
    const { children, fallback, circuitBreakerOpen, variant } = this.props;
    const { hasError } = this.state;

    // Use custom fallback if provided
    if (hasError && fallback) {
      return fallback;
    }

    // Show circuit breaker fallback if applicable
    if (circuitBreakerOpen && variant?.circuitBreakerAware) {
      return this.renderCircuitBreakerFallback();
    }

    // Show error fallback if error occurred
    if (hasError) {
      const context = variant?.context || "general";

      switch (context) {
        case "agent":
          return this.renderAgentFallback();
        case "canvas":
          return this.renderCanvasFallback();
        case "sdui":
          return this.renderSDUIFallback();
        case "template":
          return this.renderTemplateFallback();
        default:
          return this.renderGeneralFallback();
      }
    }

    return children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}

// Hook for error boundary (for functional components)
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = () => setError(null);

  return {
    error,
    resetError,
    setError,
  };
}

// Specialized variants for backward compatibility
export const TemplateErrorBoundary: React.FC<{
  children: ReactNode;
  templateName: string;
  showDetails?: boolean;
}> = ({ children, templateName, showDetails }) => {
  return (
    <ErrorBoundary
      variant={{
        context: "template",
        showDetails: showDetails ?? env.isDevelopment,
        allowRetry: true,
      }}
      templateName={templateName}
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
