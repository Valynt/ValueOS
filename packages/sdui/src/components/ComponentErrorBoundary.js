"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedComponentErrorBoundary = void 0;
exports.withEnhancedComponentErrorBoundary = withEnhancedComponentErrorBoundary;
const jsx_runtime_1 = require("react/jsx-runtime");
const logger_1 = require("@shared/lib/logger");
const react_1 = __importStar(require("react"));
const lucide_react_1 = require("lucide-react");
const sentry_1 = require("../../lib/sentry");
const environment_1 = require("../../config/environment");
const SDUITelemetry_1 = require("../../lib/telemetry/SDUITelemetry");
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
class EnhancedComponentErrorBoundary extends react_1.Component {
    retryTimer;
    correlationIdCounter = 0;
    errorTimestampRef = react_1.default.createRef();
    constructor(props) {
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
    componentWillUnmount() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
    }
    /**
     * Update state when an error is caught
     */
    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }
    /**
     * Generate unique correlation ID for error tracking
     */
    generateCorrelationId() {
        return `err_${this.props.componentName}_${Date.now()}_${++this.correlationIdCounter}`;
    }
    /**
     * Create enhanced error correlation record
     */
    createErrorCorrelation(error, errorInfo) {
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
    determineErrorSeverity(error, errorType) {
        const criticalErrors = ["TypeError", "ReferenceError", "RangeError"];
        const highErrors = ["NetworkError", "TimeoutError", "ValidationError"];
        const mediumErrors = ["SyntaxError", "URIError", "EvalError"];
        if (criticalErrors.includes(errorType))
            return "critical";
        if (highErrors.includes(errorType))
            return "high";
        if (mediumErrors.includes(errorType))
            return "medium";
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
    shouldTripCircuitBreaker() {
        const { circuitBreaker } = this.state;
        const { failureThreshold = 5, monitoringPeriod = 300000, severityThreshold = "medium" } = this.props.circuitBreaker || {};
        const now = Date.now();
        // Check if we have enough failures in the monitoring period
        const recentFailures = circuitBreaker.failureHistory.filter(failure => now - failure.timestamp < monitoringPeriod);
        // Count failures that meet or exceed the severity threshold
        const severeFailures = recentFailures.filter(failure => this.getSeverityLevel(failure.severity) >= this.getSeverityLevel(severityThreshold)).length;
        return severeFailures >= failureThreshold;
    }
    /**
     * Get numeric severity level for comparison
     */
    getSeverityLevel(severity) {
        const levels = {
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
    updateCircuitBreakerAfterFailure(error, errorInfo) {
        const { circuitBreaker } = this.state;
        const { recoveryTimeout = 60000, maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};
        const now = Date.now();
        const errorCorrelation = this.createErrorCorrelation(error, errorInfo);
        const newState = {
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
        logger_1.logger.warn("Circuit breaker opened", {
            componentName: this.props.componentName,
            failureCount: newState.failureCount,
            nextRetryTime: new Date(newState.nextRetryTime).toISOString(),
            severity: errorCorrelation.severity,
            recoveryAttempts: newState.recoveryAttempts,
        });
        // Send telemetry event
        this.sendCircuitBreakerTelemetry("opened", errorCorrelation);
    }
    /**
     * Attempt to close circuit breaker with recovery logic
     */
    attemptCircuitBreakerRecovery() {
        const { circuitBreaker } = this.state;
        const { maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};
        const now = Date.now();
        if (circuitBreaker.state === "open" &&
            circuitBreaker.nextRetryTime &&
            now >= circuitBreaker.nextRetryTime &&
            circuitBreaker.recoveryAttempts < maxRecoveryAttempts) {
            this.setState((prevState) => ({
                circuitBreaker: {
                    ...prevState.circuitBreaker,
                    state: "half-open",
                    recoveryAttempts: prevState.circuitBreaker.recoveryAttempts + 1,
                },
            }));
            logger_1.logger.info("Circuit breaker transitioning to half-open", {
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
    calculateRetryDelay() {
        const { retryCount } = this.state;
        const { initialDelay = 1000, backoffMultiplier = 2, maxDelay = 30000, jitter = false } = this.props.retryConfig || {};
        const delay = initialDelay * Math.pow(backoffMultiplier, retryCount);
        const jitteredDelay = jitter ? delay * (0.8 + Math.random() * 0.4) : delay;
        return Math.min(jitteredDelay, maxDelay);
    }
    /**
     * Check if retry should be attempted with circuit breaker awareness
     */
    shouldAllowRetry() {
        const { allowRetry = true, retryConfig } = this.props;
        const { retryCount, circuitBreaker } = this.state;
        const { maxAttempts = 3 } = retryConfig || {};
        const { maxRecoveryAttempts = 5 } = this.props.circuitBreaker || {};
        if (!allowRetry)
            return false;
        if (retryCount >= maxAttempts)
            return false;
        if (circuitBreaker.state === "open")
            return false;
        if (circuitBreaker.recoveryAttempts >= maxRecoveryAttempts)
            return false;
        return true;
    }
    /**
     * Enhanced error logging with correlation and telemetry
     */
    componentDidCatch(error, errorInfo) {
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
        logger_1.logger.error(`Enhanced error in SDUI component "${componentName}":`, {
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
        if ((0, environment_1.isProduction)()) {
            (0, sentry_1.captureException)(error, {
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
    handleRetry = () => {
        if (!this.shouldAllowRetry()) {
            logger_1.logger.warn("Retry blocked", {
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
        logger_1.logger.info("Attempting retry", {
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
                logger_1.logger.info("Circuit breaker closed after successful recovery", {
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
    resetCircuitBreaker = () => {
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
        logger_1.logger.info("Circuit breaker manually reset", {
            componentName: this.props.componentName,
        });
        // Send telemetry event
        this.sendCircuitBreakerTelemetry("reset", {});
    };
    /**
     * Send circuit breaker telemetry event
     */
    sendCircuitBreakerTelemetry(action, metadata) {
        const { telemetryConfig } = this.props;
        if (!telemetryConfig?.enableTelemetry)
            return;
        SDUITelemetry_1.sduiTelemetry.recordEvent({
            type: SDUITelemetry_1.TelemetryEventType.CIRCUIT_BREAKER_EVENT,
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
    sendErrorTelemetry(error, correlation, errorInfo) {
        const { telemetryConfig } = this.props;
        if (!telemetryConfig?.enableTelemetry)
            return;
        SDUITelemetry_1.sduiTelemetry.recordEvent({
            type: SDUITelemetry_1.TelemetryEventType.COMPONENT_ERROR,
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
    renderFallback() {
        const { componentName, fallback, showErrorDetails, allowRetry = true, circuitBreaker, retryConfig, } = this.props;
        const { error, errorInfo, circuitBreaker: cbState, isRetrying, nextRetryTime, errorCorrelations, } = this.state;
        // Use custom fallback if provided
        if (fallback) {
            return fallback;
        }
        // Determine if we should show error details
        const shouldShowDetails = showErrorDetails ?? (0, environment_1.isDevelopment)();
        const canRetry = this.shouldAllowRetry();
        const isCircuitOpen = cbState.state === "open";
        const isCircuitHalfOpen = cbState.state === "half-open";
        return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-lg border border-red-200 bg-red-50 p-4 text-red-900 shadow-lg", role: "alert", "aria-live": "assertive", "data-testid": "enhanced-component-error-boundary", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-start gap-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-shrink-0", children: isCircuitOpen ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Shield, { className: "h-6 w-6 text-red-600 animate-pulse", "aria-hidden": "true" })) : isCircuitHalfOpen ? ((0, jsx_runtime_1.jsx)(lucide_react_1.Clock, { className: "h-6 w-6 text-yellow-600 animate-spin", "aria-hidden": "true" })) : ((0, jsx_runtime_1.jsx)(lucide_react_1.XCircle, { className: "h-6 w-6 text-red-600", "aria-hidden": "true" })) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1", children: [(0, jsx_runtime_1.jsxs)("h3", { className: "text-sm font-semibold mb-1", children: [isCircuitOpen ? "Circuit Breaker Open" : "Component Error", ": ", componentName] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-red-800 mb-3", children: isCircuitOpen
                                    ? `This component has failed ${cbState.failureCount} times and is temporarily disabled for safety.`
                                    : isCircuitHalfOpen
                                        ? "This component is attempting to recover after recent failures."
                                        : "This component encountered an error and could not be rendered." }), (isCircuitOpen || isCircuitHalfOpen) && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-3 p-2 bg-red-100 rounded text-xs", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-medium mb-1", children: "Circuit Breaker Status:" }), (0, jsx_runtime_1.jsxs)("div", { children: ["State: ", cbState.state] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Failures: ", cbState.failureCount] }), isCircuitOpen && cbState.nextRetryTime && ((0, jsx_runtime_1.jsxs)("div", { children: ["Next retry: ", new Date(cbState.nextRetryTime).toLocaleTimeString()] })), (0, jsx_runtime_1.jsxs)("div", { children: ["Recovery attempts: ", cbState.recoveryAttempts] })] })), isRetrying && nextRetryTime && ((0, jsx_runtime_1.jsx)("div", { className: "mb-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-3 w-3 animate-spin" }), (0, jsx_runtime_1.jsxs)("span", { children: ["Retrying in ", Math.ceil((nextRetryTime - Date.now()) / 1000), "s..."] })] }) })), shouldShowDetails && error && ((0, jsx_runtime_1.jsxs)("details", { className: "mb-3", children: [(0, jsx_runtime_1.jsx)("summary", { className: "cursor-pointer text-sm font-medium text-red-700 hover:text-red-900 mb-2", children: "Error Details" }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded bg-red-100 p-3 text-xs font-mono", children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-2", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Message:" }), " ", error.message] }), error.stack && ((0, jsx_runtime_1.jsxs)("div", { className: "mb-2", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Stack:" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-1 overflow-auto whitespace-pre-wrap", children: error.stack })] })), errorInfo && ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Component Stack:" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-1 overflow-auto whitespace-pre-wrap", children: errorInfo.componentStack })] })), errorCorrelations.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2 pt-2 border-t border-red-200", children: [(0, jsx_runtime_1.jsx)("strong", { children: "Error History:" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 space-y-1", children: errorCorrelations.slice(-3).map((corr, _idx) => ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs", children: [new Date(corr.timestamp).toLocaleTimeString(), " - ", corr.errorType, " (", corr.severity, ")"] }, corr.id))) })] }))] })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2 mt-4 pt-4 border-t border-red-200", children: [canRetry && !isRetrying && ((0, jsx_runtime_1.jsxs)("button", { onClick: this.handleRetry, disabled: isCircuitOpen, className: "inline-flex items-center px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed", "aria-label": `Retry rendering ${componentName}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.RefreshCw, { className: "h-3 w-3 mr-1" }), "Try Again"] })), (0, environment_1.isDevelopment)() && (isCircuitOpen || isCircuitHalfOpen) && ((0, jsx_runtime_1.jsxs)("button", { onClick: this.resetCircuitBreaker, className: "inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-100 rounded hover:bg-blue-200 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2", "aria-label": `Reset circuit breaker for ${componentName}`, children: [(0, jsx_runtime_1.jsx)(lucide_react_1.Zap, { className: "h-3 w-3 mr-1" }), "Reset Circuit"] })), isCircuitHalfOpen && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center text-green-600 text-sm", children: [(0, jsx_runtime_1.jsx)(lucide_react_1.CheckCircle, { className: "h-4 w-4 mr-1" }), "Recovery attempt in progress..."] }))] })] })] }) }));
    }
    render() {
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
exports.EnhancedComponentErrorBoundary = EnhancedComponentErrorBoundary;
/**
 * HOC to wrap a component with EnhancedComponentErrorBoundary
 */
function withEnhancedComponentErrorBoundary(Component, boundaryProps) {
    const WrappedComponent = (props) => ((0, jsx_runtime_1.jsx)(EnhancedComponentErrorBoundary, { ...boundaryProps, children: (0, jsx_runtime_1.jsx)(Component, { ...props }) }));
    WrappedComponent.displayName = `withEnhancedComponentErrorBoundary(${Component.displayName || Component.name || "Component"})`;
    return WrappedComponent;
}
exports.default = EnhancedComponentErrorBoundary;
//# sourceMappingURL=ComponentErrorBoundary.js.map