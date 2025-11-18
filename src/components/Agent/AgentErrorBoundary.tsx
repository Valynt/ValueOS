/**
 * Agent Error Boundary
 * 
 * Specialized error boundary for agent-driven content with
 * circuit breaker awareness and retry capabilities.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, XCircle, Shield } from 'lucide-react';
import { AgentType } from '../../services/AgentAPI';

/**
 * Props for AgentErrorBoundary
 */
export interface AgentErrorBoundaryProps {
  /**
   * Child components
   */
  children: ReactNode;

  /**
   * Agent type (for circuit breaker awareness)
   */
  agent?: AgentType;

  /**
   * Custom fallback UI
   */
  fallback?: ReactNode;

  /**
   * Callback when error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Callback for retry action
   */
  onRetry?: () => void;

  /**
   * Whether circuit breaker is open
   */
  circuitBreakerOpen?: boolean;

  /**
   * Show detailed error information
   * @default false in production
   */
  showDetails?: boolean;
}

/**
 * State for AgentErrorBoundary
 */
interface AgentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

/**
 * AgentErrorBoundary Component
 * 
 * Catches errors in agent-driven content and provides
 * user-friendly fallback UI with retry capabilities.
 */
export class AgentErrorBoundary extends Component<
  AgentErrorBoundaryProps,
  AgentErrorBoundaryState
> {
  constructor(props: AgentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError(error: Error): AgentErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { agent, onError } = this.props;

    console.error(
      `Error in agent-driven content${agent ? ` (${agent})` : ''}:`,
      error,
      errorInfo
    );

    this.setState({ errorInfo });
    onError?.(error, errorInfo);

    // Log to error tracking service in production
    if (process.env.NODE_ENV === 'production') {
      // TODO: Integrate with error tracking service
      // logErrorToService(error, { agent, errorInfo });
    }
  }

  handleRetry = (): void => {
    const { onRetry } = this.props;

    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    });

    onRetry?.();
  };

  renderCircuitBreakerFallback(): ReactNode {
    const { agent } = this.props;

    return (
      <div
        className="rounded-lg border-2 border-orange-300 bg-orange-50 p-6"
        role="alert"
        data-testid="circuit-breaker-fallback"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Shield className="h-8 w-8 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-orange-900 mb-2">
              Circuit Breaker Active
            </h3>
            <p className="text-sm text-orange-800 mb-4">
              The {agent || 'agent'} service is temporarily unavailable due to repeated
              failures. This is a protective measure to prevent cascading issues.
            </p>
            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <p className="text-xs text-orange-700 flex items-center">
                The service will automatically recover after a cooldown period.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  renderErrorFallback(): ReactNode {
    const { agent, showDetails, fallback } = this.props;
    const { error, errorInfo } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    const shouldShowDetails = showDetails ?? process.env.NODE_ENV === 'development';

    return (
      <div
        className="rounded-lg border-2 border-red-300 bg-red-50 p-6"
        role="alert"
        data-testid="agent-error-fallback"
      >
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 mb-2">
              Agent Content Error
            </h3>
            <p className="text-sm text-red-800 mb-4">
              {agent
                ? `The ${agent} agent encountered an error while generating content.`
                : 'An error occurred while generating agent content.'}
            </p>

            {shouldShowDetails && error && (
              <details className="mb-4">
                <summary className="cursor-pointer text-sm font-medium text-red-700 hover:text-red-900 mb-2">
                  Error Details
                </summary>
                <div className="rounded bg-red-100 p-3 text-xs font-mono">
                  <div className="mb-2">
                    <strong>Message:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div className="mb-2">
                      <strong>Stack:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                  {errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-100 transition-colors"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    const { children, circuitBreakerOpen } = this.props;
    const { hasError } = this.state;

    // Show circuit breaker fallback if breaker is open
    if (circuitBreakerOpen) {
      return this.renderCircuitBreakerFallback();
    }

    // Show error fallback if error occurred
    if (hasError) {
      return this.renderErrorFallback();
    }

    return children;
  }
}

/**
 * Agent Loading Fallback
 * 
 * Shows loading state while agent is processing
 */
export const AgentLoadingFallback: React.FC<{
  agent?: AgentType;
  message?: string;
}> = ({ agent, message }) => {
  return (
    <div
      className="rounded-lg border border-blue-200 bg-blue-50 p-6"
      role="status"
      aria-live="polite"
      data-testid="agent-loading-fallback"
    >
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
        </div>
        <div>
          <p className="text-sm font-medium text-blue-900">
            {message || `${agent ? `${agent} agent` : 'Agent'} is processing...`}
          </p>
          <p className="text-xs text-blue-700 mt-1">
            This may take a few moments
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Agent Validation Error Fallback
 * 
 * Shows validation errors from agent responses
 */
export const AgentValidationErrorFallback: React.FC<{
  errors: string[];
  onRetry?: () => void;
}> = ({ errors, onRetry }) => {
  return (
    <div
      className="rounded-lg border border-yellow-300 bg-yellow-50 p-6"
      role="alert"
      data-testid="agent-validation-error-fallback"
    >
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-6 w-6 text-yellow-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">
            Validation Errors
          </h3>
          <p className="text-sm text-yellow-800 mb-3">
            The agent response contains validation errors:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-yellow-800 mb-4">
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * HOC to wrap component with AgentErrorBoundary
 */
export function withAgentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps: Omit<AgentErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <AgentErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </AgentErrorBoundary>
  );

  WrappedComponent.displayName = `withAgentErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}
