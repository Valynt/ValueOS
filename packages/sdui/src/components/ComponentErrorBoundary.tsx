import { logger } from "@shared/lib/logger";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, AlertCircle } from "lucide-react";
import { captureException } from "../../lib/sentry";
import { isDevelopment, isProduction } from "../../config/environment";

/**
 * Circuit breaker state for error tracking
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
  nextRetryTime?: number;
}

/**
 * Error correlation tracking
 */
interface ErrorCorrelation {
  id: string;
  timestamp: number;
  componentName: string;
  errorType: string;
  errorMessage: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
}

/**
 * Props for ComponentErrorBoundary
 */
interface ComponentErrorBoundaryProps {
  /**
   * Child components to render
   */
  children: ReactNode;

  /**
   * Name of the component being wrapped (for error reporting)
   */
  componentName: string;

  /**
   * Custom fallback UI to show on error
   */
  fallback?: ReactNode;

  /**
   * Callback when an error is caught
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * Whether to show error details in the UI
   * @default false in production, true in development
   */
  showErrorDetails?: boolean;

  /**
   * Whether to allow retry after error
   * @default true
   */
  allowRetry?: boolean;

  /**
   * Circuit breaker configuration
   */
  circuitBreaker?: {
    /**
     * Number of failures before opening circuit
     * @default 5
     */
    failureThreshold?: number;

    /**
     * Time in milliseconds to wait before attempting recovery
     * @default 60000 (1 minute)
     */
    recoveryTimeout?: number;

    /**
     * Time in milliseconds to consider for failure rate calculation
     * @default 300000 (5 minutes)
     */
    monitoringPeriod?: number;
  };

  /**
   * Retry configuration with exponential backoff
   */
  retryConfig?: {
    /**
     * Maximum number of retry attempts
     * @default 3
     */
    maxAttempts?: number;

    /**
     * Initial delay in milliseconds
     * @default 1000
     */
    initialDelay?: number;

    /**
     * Backoff multiplier
     * @default 2
     */
    backoffMultiplier?: number;

    /**
     * Maximum delay in milliseconds
     * @default 30000
     */
    maxDelay?: number;
  };

  /**
   * Error correlation context
   */
  correlationContext?: {
    sessionId?: string;
    userId?: string;
    userAgent?: string;
  };
}

/**
 * State for ComponentErrorBoundary
 */
interface ComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  circuitBreaker: CircuitBreakerState;
  retryCount: number;
  isRetrying: boolean;
  nextRetryTime?: number;
  errorCorrelations: ErrorCorrelation[];
}

/**
 * Error boundary specifically designed for SDUI component rendering.
 * Catches errors in child components and displays a graceful fallback.
 *
 * Features:
 * - Isolated error handling per component
 * - Custom fallback UI
 * - Error logging and reporting
 * - Circuit breaker pattern for failure protection
 * - Exponential backoff retry with configurable limits
 * - Error correlation tracking
 * - Development-friendly error details
 *
 * @example
 * ```tsx
 * <ComponentErrorBoundary
 *   componentName="MyComponent"
 *   onError={(error) => logError(error)}
 *   circuitBreaker={{ failureThreshold: 3, recoveryTimeout: 30000 }}
 *   retryConfig={{ maxAttempts: 5, initialDelay: 2000 }}
 * >
 *   <MyComponent {...props} />
 * </ComponentErrorBoundary>
 * ```
 */
export class ComponentErrorBoundary extends Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  private retryTimer?: NodeJS.Timeout;
  private correlationIdCounter = 0;

  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      circuitBreaker: {
        failureCount: 0,
        lastFailureTime: 0,
        state: "closed",
      },
      retryCount: 0,
      isRetrying: false,
      errorCorrelations: [],
    };
  }

  /**
   * Clean up timers on unmount
   */
  componentWillUnmount(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }

  /**
   * Update state when an error is caught
   */
  static getDerivedStateFromError(error: Error): Partial<ComponentErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Generate unique correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `err_${this.props.componentName}_${Date.now()}_${++this.correlationIdCounter}`;
  }

  /**
   * Create error correlation record
   */
  private createErrorCorrelation(error: Error): ErrorCorrelation {
    const { correlationContext } = this.props;

    return {
      id: this.generateCorrelationId(),
      timestamp: Date.now(),
      componentName: this.props.componentName,
      errorType: error.constructor.name,
      errorMessage: error.message,
      userAgent: correlationContext?.userAgent,
      sessionId: correlationContext?.sessionId,
      userId: correlationContext?.userId,
    };
  }

  /**
   * Check if circuit breaker should trip
   */
  private shouldTripCircuitBreaker(): boolean {
    const { circuitBreaker } = this.state;
    const { failureThreshold = 5, monitoringPeriod = 300000 } = this.props.circuitBreaker || {};

    const now = Date.now();
    const recentFailures = circuitBreaker.failureCount;

    return (
      recentFailures >= failureThreshold && now - circuitBreaker.lastFailureTime < monitoringPeriod
    );
  }

  /**
   * Update circuit breaker state after failure
   */
  private updateCircuitBreakerAfterFailure(): void {
    const { circuitBreaker } = this.state;
    const { recoveryTimeout = 60000 } = this.props.circuitBreaker || {};

    const newState: CircuitBreakerState = {
      ...circuitBreaker,
      failureCount: circuitBreaker.failureCount + 1,
      lastFailureTime: Date.now(),
      state: "open",
      nextRetryTime: Date.now() + recoveryTimeout,
    };

    this.setState({ circuitBreaker: newState });

    logger.warn("Circuit breaker opened", {
      componentName: this.props.componentName,
      failureCount: newState.failureCount,
      nextRetryTime: new Date(newState.nextRetryTime!).toISOString(),
    });
  }

  /**
   * Attempt to close circuit breaker
   */
  private attemptCircuitBreakerRecovery(): void {
    const { circuitBreaker } = this.state;
    const now = Date.now();

    if (
      circuitBreaker.state === "open" &&
      circuitBreaker.nextRetryTime &&
      now >= circuitBreaker.nextRetryTime
    ) {
      this.setState({
        circuitBreaker: {
          ...circuitBreaker,
          state: "half-open",
        },
      });

      logger.info("Circuit breaker transitioning to half-open", {
        componentName: this.props.componentName,
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(): number {
    const { retryCount } = this.state;
    const {
      initialDelay = 1000,
      backoffMultiplier = 2,
      maxDelay = 30000,
    } = this.props.retryConfig || {};

    const delay = initialDelay * Math.pow(backoffMultiplier, retryCount);
    return Math.min(delay, maxDelay);
  }

  /**
   * Check if retry should be attempted
   */
  private shouldAllowRetry(): boolean {
    const { allowRetry = true, retryConfig } = this.props;
    const { retryCount, circuitBreaker } = this.state;
    const { maxAttempts = 3 } = retryConfig || {};

    if (!allowRetry) return false;
    if (retryCount >= maxAttempts) return false;
    if (circuitBreaker.state === "open") return false;

    return true;
  }

  /**
   * Log error and call error handler with enhanced tracking
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, onError, correlationContext } = this.props;

    // Create error correlation
    const correlation = this.createErrorCorrelation(error);

    // Update state with error info and correlation
    this.setState((prevState) => ({
      errorInfo,
      errorCorrelations: [...prevState.errorCorrelations, correlation],
    }));

    // Check if circuit breaker should trip
    if (this.shouldTripCircuitBreaker()) {
      this.updateCircuitBreakerAfterFailure();
    }

    // Enhanced error logging
    logger.error(`Error in SDUI component "${componentName}":`, {
      error,
      errorInfo,
      correlation,
      circuitBreakerState: this.state.circuitBreaker.state,
      retryCount: this.state.retryCount,
    });

    // Call error handler if provided
    onError?.(error, errorInfo);

    // Log to error tracking service in production with correlation
    if (isProduction()) {
      captureException(error, {
        extra: {
          componentName,
          componentStack: errorInfo.componentStack,
          correlationId: correlation.id,
          circuitBreakerState: this.state.circuitBreaker.state,
          retryCount: this.state.retryCount,
          sessionId: correlationContext?.sessionId,
          userId: correlationContext?.userId,
        },
        tags: {
          component: componentName,
          errorType: error.constructor.name,
        },
      });
    }
  }

  /**
   * Reset error state to retry rendering with circuit breaker awareness
   */
  handleRetry = (): void => {
    if (!this.shouldAllowRetry()) {
      logger.warn("Retry blocked", {
        componentName: this.props.componentName,
        reason: "retry_limit_exceeded_or_circuit_open",
        retryCount: this.state.retryCount,
        circuitBreakerState: this.state.circuitBreaker.state,
      });
      return;
    }

    const { retryCount } = this.state;
    const delay = this.calculateRetryDelay();

    this.setState({
      isRetrying: true,
      nextRetryTime: Date.now() + delay,
    });

    logger.info("Attempting retry", {
      componentName: this.props.componentName,
      attempt: retryCount + 1,
      delay,
    });

    this.retryTimer = setTimeout(() => {
      this.setState((prevState) => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
        isRetrying: false,
        nextRetryTime: undefined,
      }));

      // If circuit breaker was half-open, close it on successful retry
      if (this.state.circuitBreaker.state === "half-open") {
        this.setState((prevState) => ({
          circuitBreaker: {
            ...prevState.circuitBreaker,
            state: "closed",
            failureCount: 0,
          },
        }));
      }
    }, delay);
  };

  /**
   * Reset circuit breaker manually (for admin/management purposes)
   */
  resetCircuitBreaker = (): void => {
    this.setState({
      circuitBreaker: {
        failureCount: 0,
        lastFailureTime: 0,
        state: "closed",
      },
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      isRetrying: false,
      nextRetryTime: undefined,
    });

    logger.info("Circuit breaker manually reset", {
      componentName: this.props.componentName,
    });
  };

  /**
   * Render fallback UI when error occurs with enhanced information
   */
  renderFallback(): ReactNode {
    const {
      componentName,
      fallback,
      showErrorDetails,
      allowRetry = true,
      circuitBreaker,
      retryConfig,
    } = this.props;
    const {
      error,
      errorInfo,
      circuitBreaker: cbState,
      isRetrying,
      nextRetryTime,
      errorCorrelations,
    } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      return fallback;
    }

    // Determine if we should show error details
    const shouldShowDetails = showErrorDetails ?? isDevelopment();
    const canRetry = this.shouldAllowRetry();
    const isCircuitOpen = cbState.state === "open";
    const isCircuitHalfOpen = cbState.state === "half-open";

    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900"
        role="alert"
        aria-live="assertive"
        data-testid="component-error-boundary"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isCircuitOpen ? (
              <AlertCircle className="h-5 w-5 text-red-600" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600" aria-hidden="true" />
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-1">
              {isCircuitOpen ? "Circuit Breaker Open" : "Component Error"}: {componentName}
            </h3>

            <p className="text-sm text-red-800 mb-3">
              {isCircuitOpen
                ? `This component has failed ${cbState.failureCount} times and is temporarily disabled for safety.`
                : isCircuitHalfOpen
                  ? "This component is attempting to recover after recent failures."
                  : "This component encountered an error and could not be rendered."}
            </p>

            {/* Circuit breaker status */}
            {(isCircuitOpen || isCircuitHalfOpen) && (
              <div className="mb-3 p-2 bg-red-100 rounded text-xs">
                <div className="font-medium mb-1">Circuit Breaker Status:</div>
                <div>State: {cbState.state}</div>
                <div>Failures: {cbState.failureCount}</div>
                {isCircuitOpen && cbState.nextRetryTime && (
                  <div>Next retry: {new Date(cbState.nextRetryTime).toLocaleTimeString()}</div>
                )}
              </div>
            )}

            {/* Retry status */}
            {isRetrying && nextRetryTime && (
              <div className="mb-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Retrying in {Math.ceil((nextRetryTime - Date.now()) / 1000)}s...</span>
                </div>
              </div>
            )}

            {/* Error details */}
            {shouldShowDetails && error && (
              <details className="mb-3">
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
                      <pre className="mt-1 overflow-auto whitespace-pre-wrap">{error.stack}</pre>
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
                  {errorCorrelations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <strong>Error History:</strong>
                      <div className="mt-1 space-y-1">
                        {errorCorrelations.slice(-3).map((corr, idx) => (
                          <div key={corr.id} className="text-xs">
                            {new Date(corr.timestamp).toLocaleTimeString()} - {corr.errorType}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {canRetry && !isRetrying && (
                <button
                  onClick={this.handleRetry}
                  disabled={isCircuitOpen}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label={`Retry rendering ${componentName}`}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try Again
                </button>
              )}

              {/* Admin reset button in development */}
              {isDevelopment() && (isCircuitOpen || isCircuitHalfOpen) && (
                <button
                  onClick={this.resetCircuitBreaker}
                  className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={`Reset circuit breaker for ${componentName}`}
                >
                  Reset Circuit
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  render(): ReactNode {
    // Check if circuit breaker allows rendering
    if (this.state.circuitBreaker.state === "open") {
      return this.renderFallback();
    }

    // Attempt circuit breaker recovery if needed
    this.attemptCircuitBreakerRecovery();

    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ComponentErrorBoundary
 *
 * @example
 * ```tsx
 * const SafeComponent = withComponentErrorBoundary(MyComponent, {
 *   componentName: 'MyComponent',
 *   onError: (error) => logError(error),
 * });
 * ```
 */
export function withComponentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps: Omit<ComponentErrorBoundaryProps, "children">
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ComponentErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </ComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withComponentErrorBoundary(${
    Component.displayName || Component.name || "Component"
  })`;

  return WrappedComponent;
}
