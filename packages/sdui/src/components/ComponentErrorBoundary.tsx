import { logger } from "@shared/lib/logger";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { RefreshCw, Shield, Zap, Clock, CheckCircle, XCircle } from "lucide-react";
import { captureException } from "../../lib/sentry";
import { isDevelopment, isProduction } from "../../config/environment";
import { sduiTelemetry, TelemetryEventType } from "../../lib/telemetry/SDUITelemetry";

/**
 * Enhanced circuit breaker state for error tracking
 */
interface EnhancedCircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  state: "closed" | "open" | "half-open";
  nextRetryTime?: number;
  failureHistory: {
    timestamp: number;
    errorType: string;
    errorMessage: string;
    componentVersion: string;
  }[];
  recoveryAttempts: number;
}

/**
 * Enhanced error correlation tracking
 */
interface EnhancedErrorCorrelation {
  id: string;
  timestamp: number;
  componentName: string;
  componentVersion: string;
  errorType: string;
  errorMessage: string;
  userAgent?: string;
  sessionId?: string;
  userId?: string;
  stackTrace: string;
  componentStack: string;
  severity: "low" | "medium" | "high" | "critical";
  recoveryStatus: "pending" | "attempted" | "succeeded" | "failed";
}

/**
 * Enhanced props for ComponentErrorBoundary
 */
interface EnhancedComponentErrorBoundaryProps {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showErrorDetails?: boolean;
  allowRetry?: boolean;
  circuitBreaker?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
    monitoringPeriod?: number;
    maxRecoveryAttempts?: number;
    severityThreshold?: "low" | "medium" | "high" | "critical";
  };
  retryConfig?: {
    maxAttempts?: number;
    initialDelay?: number;
    backoffMultiplier?: number;
    maxDelay?: number;
    jitter?: boolean;
  };
  correlationContext?: {
    sessionId?: string;
    userId?: string;
    userAgent?: string;
    tenantId?: string;
    organizationId?: string;
  };
  telemetryConfig?: {
    enableTelemetry?: boolean;
    customTags?: Record<string, string>;
  };
}

/**
 * Enhanced state for ComponentErrorBoundary
 */
interface EnhancedComponentErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  circuitBreaker: EnhancedCircuitBreakerState;
  retryCount: number;
  isRetrying: boolean;
  nextRetryTime?: number;
  errorCorrelations: EnhancedErrorCorrelation[];
  lastSuccessfulRender?: number;
  componentVersion?: string;
}

/**
 * Enhanced error boundary specifically designed for SDUI component rendering.
 * Provides comprehensive error handling with advanced resilience patterns.
 *
 * Features:
 * - Isolated error handling per component
 * - Custom fallback UI with rich information
 * - Advanced circuit breaker with recovery attempts
 * - Exponential backoff retry with jitter
 * - Enhanced error correlation and telemetry
 * - Severity-based error handling
 * - Tenant and organization context tracking
 * - Performance monitoring and metrics
 * - Development-friendly error details
 *
 * @example
 * ```tsx
 * <EnhancedComponentErrorBoundary
 *   componentName="MyComponent"
 *   onError={(error) => logError(error)}
 *   circuitBreaker={{
 *     failureThreshold: 3,
 *     recoveryTimeout: 30000,
 *     maxRecoveryAttempts: 5,
 *     severityThreshold: "high"
 *   }}
 *   retryConfig={{
 *     maxAttempts: 5,
 *     initialDelay: 2000,
 *     jitter: true
 *   }}
 *   correlationContext={{
 *     sessionId: "abc123",
 *     userId: "user_456",
 *     tenantId: "tenant_789",
 *     organizationId: "org_101"
 *   }}
 *   telemetryConfig={{
 *     enableTelemetry: true,
 *     customTags: { feature: "dashboard" }
 *   }}
 * >
 *   <MyComponent {...props} />
 * </EnhancedComponentErrorBoundary>
 * ```
 */
export class EnhancedComponentErrorBoundary extends Component<
  EnhancedComponentErrorBoundaryProps,
  EnhancedComponentErrorBoundaryState
> {
  private retryTimer?: NodeJS.Timeout;
  private correlationIdCounter = 0;
  private errorTimestampRef = React.createRef<number>();

  constructor(props: EnhancedComponentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      circuitBreaker: {
        failureCount: 0,
        lastFailureTime: 0,
        state: "closed",
        failureHistory: [],
        recoveryAttempts: 0,
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
  static getDerivedStateFromError(error: Error): Partial<EnhancedComponentErrorBoundaryState> {
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
   * Create enhanced error correlation record
   */
  private createErrorCorrelation(error: Error, errorInfo?: ErrorInfo): EnhancedErrorCorrelation {
    const { correlationContext, componentName } = this.props;
    const errorType = error.constructor.name;
    const severity = this.determineErrorSeverity(error, errorType);

    return {
      id: this.generateCorrelationId(),
      timestamp: Date.now(),
      componentName,
      componentVersion: this.state.componentVersion || "unknown",
      errorType,
      errorMessage: error.message,
      userAgent: correlationContext?.userAgent,
      sessionId: correlationContext?.sessionId,
      userId: correlationContext?.userId,
      stackTrace: error.stack || "No stack trace available",
      componentStack: errorInfo?.componentStack || "No component stack available",
      severity,
      recoveryStatus: "pending",
    };
  }

  /**
   * Determine error severity based on error type and message
   */
  private determineErrorSeverity(error: Error, errorType: string): "low" | "medium" | "high" | "critical" {
    const criticalErrors = ["TypeError", "ReferenceError", "RangeError"];
    const highErrors = ["NetworkError", "TimeoutError", "ValidationError"];
    const mediumErrors = ["SyntaxError", "URIError", "EvalError"];

    if (criticalErrors.includes(errorType)) return "critical";
    if (highErrors.includes(errorType)) return "high";
    if (mediumErrors.includes(errorType)) return "medium";

    // Check error message for severity indicators
    const message = error.message.toLowerCase();
    if (message.includes("failed") || message.includes("error") || message.includes("exception")) {
      return "medium";
    }

    return "low";
  }

  /**
   * Check if circuit breaker should trip based on severity
   */
  private shouldTripCircuitBreaker(): boolean {
    const { circuitBreaker } = this.state;
    const { failureThreshold = 5, monitoringPeriod = 300000, severityThreshold = "medium" } = this.props.circuitBreaker || {};
    const now = Date.now();

    // Check if we have enough failures in the monitoring period
    const recentFailures = circuitBreaker.failureHistory.filter(failure =>
      now - failure.timestamp < monitoringPeriod
    );

    // Count failures that meet or exceed the severity threshold
    const severeFailures = recentFailures.filter(failure =>
      this.getSeverityLevel(failure.severity) >= this.getSeverityLevel(severityThreshold)
    ).length;

    return severeFailures >= failureThreshold;
  }

  /**
   * Get numeric severity level for comparison
   */
  private getSeverityLevel(severity: string): number {
    const levels: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return levels[severity] || 1;
  }

  /**
   * Update circuit breaker state after failure
   */
  private updateCircuitBreakerAfterFailure(error: Error, errorInfo?: ErrorInfo): void {
    const { circuitBreaker } = this.state;
    const { recoveryTimeout = 60000, maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};
    const now = Date.now();
    const errorCorrelation = this.createErrorCorrelation(error, errorInfo);

    const newState: EnhancedCircuitBreakerState = {
      ...circuitBreaker,
      failureCount: circuitBreaker.failureCount + 1,
      lastFailureTime: now,
      state: "open",
      nextRetryTime: now + recoveryTimeout,
      failureHistory: [
        ...circuitBreaker.failureHistory,
        {
          timestamp: now,
          errorType: errorCorrelation.errorType,
          errorMessage: errorCorrelation.errorMessage,
          componentVersion: errorCorrelation.componentVersion,
        }
      ],
      recoveryAttempts: 0,
    };

    this.setState({ circuitBreaker: newState, errorCorrelations: [...this.state.errorCorrelations, errorCorrelation] });

    logger.warn("Circuit breaker opened", {
      componentName: this.props.componentName,
      failureCount: newState.failureCount,
      nextRetryTime: new Date(newState.nextRetryTime!).toISOString(),
      severity: errorCorrelation.severity,
      recoveryAttempts: newState.recoveryAttempts,
    });

    // Send telemetry event
    this.sendCircuitBreakerTelemetry("opened", errorCorrelation);
  }

  /**
   * Attempt to close circuit breaker with recovery logic
   */
  private attemptCircuitBreakerRecovery(): void {
    const { circuitBreaker } = this.state;
    const { maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};
    const now = Date.now();

    if (
      circuitBreaker.state === "open" &&
      circuitBreaker.nextRetryTime &&
      now >= circuitBreaker.nextRetryTime &&
      circuitBreaker.recoveryAttempts < maxRecoveryAttempts
    ) {
      this.setState((prevState) => ({
        circuitBreaker: {
          ...prevState.circuitBreaker,
          state: "half-open",
          recoveryAttempts: prevState.circuitBreaker.recoveryAttempts + 1,
        },
      }));

      logger.info("Circuit breaker transitioning to half-open", {
        componentName: this.props.componentName,
        recoveryAttempt: circuitBreaker.recoveryAttempts + 1,
        maxAttempts: maxRecoveryAttempts,
      });

      // Send telemetry event
      this.sendCircuitBreakerTelemetry("half_open", {
        recoveryAttempt: circuitBreaker.recoveryAttempts + 1,
        maxAttempts,
      });
    }
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(): number {
    const { retryCount } = this.state;
    const { initialDelay = 1000, backoffMultiplier = 2, maxDelay = 30000, jitter = false } = this.props.retryConfig || {};

    const delay = initialDelay * Math.pow(backoffMultiplier, retryCount);
    const jitteredDelay = jitter ? delay * (0.8 + Math.random() * 0.4) : delay;
    return Math.min(jitteredDelay, maxDelay);
  }

  /**
   * Check if retry should be attempted with circuit breaker awareness
   */
  private shouldAllowRetry(): boolean {
    const { allowRetry = true, retryConfig } = this.props;
    const { retryCount, circuitBreaker } = this.state;
    const { maxAttempts = 3 } = retryConfig || {};
    const { maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};

    if (!allowRetry) return false;
    if (retryCount >= maxAttempts) return false;
    if (circuitBreaker.state === "open") return false;
    if (circuitBreaker.recoveryAttempts >= maxRecoveryAttempts) return false;

    return true;
  }

  /**
   * Enhanced error logging with correlation and telemetry
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, onError, correlationContext, telemetryConfig } = this.props;

    // Create error correlation
    const errorCorrelation = this.createErrorCorrelation(error, errorInfo);

    // Update state with error info and correlation
    this.setState((prevState) => ({
      errorInfo,
      errorCorrelations: [...prevState.errorCorrelations, errorCorrelation],
    }));

    // Check if circuit breaker should trip
    if (this.shouldTripCircuitBreaker()) {
      this.updateCircuitBreakerAfterFailure(error, errorInfo);
    }

    // Enhanced error logging
    logger.error(`Enhanced error in SDUI component "${componentName}":`, {
      error,
      errorInfo,
      correlation: errorCorrelation,
      circuitBreakerState: this.state.circuitBreaker.state,
      retryCount: this.state.retryCount,
      severity: errorCorrelation.severity,
    });

    // Call error handler if provided
    onError?.(error, errorInfo);

    // Log to error tracking service in production with correlation
    if (isProduction()) {
      captureException(error, {
        extra: {
          componentName,
          componentStack: errorInfo.componentStack,
          correlationId: errorCorrelation.id,
          circuitBreakerState: this.state.circuitBreaker.state,
          retryCount: this.state.retryCount,
          severity: errorCorrelation.severity,
          sessionId: correlationContext?.sessionId,
          userId: correlationContext?.userId,
          tenantId: correlationContext?.tenantId,
          organizationId: correlationContext?.organizationId,
        },
        tags: {
          component: componentName,
          errorType: error.constructor.name,
          severity: errorCorrelation.severity,
        },
      });
    }

    // Send telemetry event
    if (telemetryConfig?.enableTelemetry) {
      this.sendErrorTelemetry(error, errorCorrelation, errorInfo);
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
        recoveryAttempts: this.state.circuitBreaker.recoveryAttempts,
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
      jitter: this.props.retryConfig?.jitter || false,
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
            failureHistory: [],
            recoveryAttempts: 0,
          },
        }));

        logger.info("Circuit breaker closed after successful recovery", {
          componentName: this.props.componentName,
        });

        // Send telemetry event
        this.sendCircuitBreakerTelemetry("closed", {
          recoveryAttempts: prevState.circuitBreaker.recoveryAttempts,
        });
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
        failureHistory: [],
        recoveryAttempts: 0,
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

    // Send telemetry event
    this.sendCircuitBreakerTelemetry("reset", {});
  };

  /**
   * Send circuit breaker telemetry event
   */
  private sendCircuitBreakerTelemetry(action: string, metadata: Record<string, any>): void {
    const { telemetryConfig } = this.props;
    if (!telemetryConfig?.enableTelemetry) return;

    sduiTelemetry.recordEvent({
      type: TelemetryEventType.CIRCUIT_BREAKER_EVENT,
      metadata: {
        component: this.props.componentName,
        action,
        state: this.state.circuitBreaker.state,
        failureCount: this.state.circuitBreaker.failureCount,
        recoveryAttempts: this.state.circuitBreaker.recoveryAttempts,
        ...metadata,
        ...telemetryConfig.customTags,
      },
    });
  }

  /**
   * Send error telemetry event
   */
  private sendErrorTelemetry(error: Error, correlation: EnhancedErrorCorrelation, errorInfo?: ErrorInfo): void {
    const { telemetryConfig } = this.props;
    if (!telemetryConfig?.enableTelemetry) return;

    sduiTelemetry.recordEvent({
      type: TelemetryEventType.COMPONENT_ERROR,
      metadata: {
        component: this.props.componentName,
        errorType: error.constructor.name,
        errorMessage: error.message,
        severity: correlation.severity,
        circuitBreakerState: this.state.circuitBreaker.state,
        retryCount: this.state.retryCount,
        recoveryAttempts: this.state.circuitBreaker.recoveryAttempts,
        sessionId: correlation.sessionId,
        userId: correlation.userId,
        tenantId: correlation.tenantId,
        organizationId: correlation.organizationId,
        ...telemetryConfig.customTags,
      },
    });
  }

  /**
   * Render enhanced fallback UI when error occurs
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
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 shadow-lg"
        role="alert"
        aria-live="assertive"
        data-testid="enhanced-component-error-boundary"
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {isCircuitOpen ? (
              <Shield className="h-6 w-6 text-red-600 animate-pulse" aria-hidden="true" />
            ) : isCircuitHalfOpen ? (
              <Clock className="h-6 w-6 text-yellow-600 animate-spin" aria-hidden="true" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
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
                <div>Recovery attempts: {cbState.recoveryAttempts}</div>
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
                        {errorCorrelations.slice(-3).map((corr, _idx) => (
                          <div key={corr.id} className="text-xs">
                            {new Date(corr.timestamp).toLocaleTimeString()} - {corr.errorType} ({corr.severity})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 pt-4 border-t border-red-200">
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
                  <Zap className="h-3 w-3 mr-1" />
                  Reset Circuit
                </button>
              )}

              {/* Success indicator for half-open state */}
              {isCircuitHalfOpen && (
                <div className="flex items-center text-green-600 text-sm">
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Recovery attempt in progress...
                </div>
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
 * HOC to wrap a component with EnhancedComponentErrorBoundary
 */
export function withEnhancedComponentErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  boundaryProps: Omit<EnhancedComponentErrorBoundaryProps, "children">
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <EnhancedComponentErrorBoundary {...boundaryProps}>
      <Component {...props} />
    </EnhancedComponentErrorBoundary>
  );

  WrappedComponent.displayName = `withEnhancedComponentErrorBoundary(${Component.displayName || Component.name || "Component"
    })`;

  return WrappedComponent;
}

export default EnhancedComponentErrorBoundary;
