/**
 * System Reliability & Performance Instrumentation
 *
 * Specialized observability for multi-agent system reliability:
 * - Latency tracking (LLM, DB, API)
 * - Availability monitoring
 * - Throughput metrics
 * - Cost efficiency tracking
 * - Failure recovery
 * - Dependency health
 */

import { logger, Metrics, withSpan } from "./instrumentation";
import type { Span } from "@opentelemetry/api";

// ============================================================================
// SYSTEM RELIABILITY METRICS
// ============================================================================

export const SystemMetrics = {
  // Latency
  llmLatency: Metrics.createHistogram(
    "system_llm_latency_seconds",
    "LLM API call latency",
    "seconds"
  ),

  databaseLatency: Metrics.createHistogram(
    "system_database_latency_seconds",
    "Database query latency",
    "seconds"
  ),

  apiLatency: Metrics.createHistogram(
    "system_api_latency_seconds",
    "External API call latency",
    "seconds"
  ),

  // Availability
  uptime: Metrics.createCounter(
    "system_uptime_seconds_total",
    "Total system uptime in seconds"
  ),

  healthChecks: Metrics.createCounter(
    "system_health_checks_total",
    "Total health check executions"
  ),

  healthCheckFailures: Metrics.createCounter(
    "system_health_check_failures_total",
    "Failed health checks"
  ),

  // Throughput
  requestsPerSecond: Metrics.createCounter(
    "system_requests_total",
    "Total requests processed"
  ),

  agentInteractions: Metrics.createCounter(
    "system_agent_interactions_total",
    "Total agent interactions"
  ),

  // Cost Tracking
  llmTokensUsed: Metrics.createCounter(
    "system_llm_tokens_total",
    "Total LLM tokens consumed"
  ),

  llmCost: Metrics.createCounter(
    "system_llm_cost_usd_total",
    "Total LLM cost in USD"
  ),

  storageUsed: Metrics.createHistogram(
    "system_storage_bytes",
    "Storage utilization",
    "bytes"
  ),

  // Failure & Recovery
  failures: Metrics.createCounter(
    "system_failures_total",
    "Total system failures"
  ),

  recoveries: Metrics.createCounter(
    "system_recoveries_total",
    "Successful failure recoveries"
  ),

  circuitBreakerState: Metrics.createCounter(
    "system_circuit_breaker_state_changes_total",
    "Circuit breaker state changes"
  ),

  retryAttempts: Metrics.createCounter(
    "system_retry_attempts_total",
    "Retry attempts for failed operations"
  ),

  // Dependency Health
  dependencyErrors: Metrics.createCounter(
    "system_dependency_errors_total",
    "Dependency errors"
  ),

  dependencyLatency: Metrics.createHistogram(
    "system_dependency_latency_seconds",
    "Dependency response time",
    "seconds"
  ),
};

// ============================================================================
// LLM PERFORMANCE TRACKING
// ============================================================================

export interface LLMCallMetadata {
  provider: string;
  model: string;
  operation: "completion" | "embedding" | "chat";
  inputTokens: number;
  outputTokens?: number;
  estimatedCost?: number;
}

/**
 * Track LLM API call with latency and cost
 */
export async function trackLLMCall<T>(
  metadata: LLMCallMetadata,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return withSpan(
    `llm.${metadata.provider}.${metadata.operation}`,
    async (span) => {
      span.setAttribute("llm.provider", metadata.provider);
      span.setAttribute("llm.model", metadata.model);
      span.setAttribute("llm.operation", metadata.operation);
      span.setAttribute("llm.input_tokens", metadata.inputTokens);

      logger.info("LLM call started", {
        provider: metadata.provider,
        model: metadata.model,
        operation: metadata.operation,
        input_tokens: metadata.inputTokens,
      });

      try {
        const result = await operation(span);

        const latency = (Date.now() - startTime) / 1000;

        // Track latency
        SystemMetrics.llmLatency.record(latency, {
          provider: metadata.provider,
          model: metadata.model,
          operation: metadata.operation,
          status: "success",
        });

        // Track token usage
        const totalTokens = metadata.inputTokens + (metadata.outputTokens || 0);
        SystemMetrics.llmTokensUsed.add(totalTokens, {
          provider: metadata.provider,
          model: metadata.model,
          type: "total",
        });

        // Track cost if available
        if (metadata.estimatedCost !== undefined) {
          SystemMetrics.llmCost.add(metadata.estimatedCost, {
            provider: metadata.provider,
            model: metadata.model,
          });
        }

        logger.info("LLM call completed", {
          provider: metadata.provider,
          model: metadata.model,
          latency_ms: latency * 1000,
          input_tokens: metadata.inputTokens,
          output_tokens: metadata.outputTokens,
          estimated_cost: metadata.estimatedCost,
        });

        return result;
      } catch (error) {
        const latency = (Date.now() - startTime) / 1000;

        SystemMetrics.llmLatency.record(latency, {
          provider: metadata.provider,
          model: metadata.model,
          operation: metadata.operation,
          status: "error",
        });

        SystemMetrics.dependencyErrors.add(1, {
          dependency: "llm",
          provider: metadata.provider,
          error: error instanceof Error ? error.name : "unknown",
        });

        logger.error("LLM call failed", {
          provider: metadata.provider,
          model: metadata.model,
          error: error instanceof Error ? error.message : "unknown",
          latency_ms: latency * 1000,
        });

        throw error;
      }
    }
  );
}

// ============================================================================
// DEPENDENCY HEALTH TRACKING
// ============================================================================

export interface DependencyCallMetadata {
  service: string;
  operation: string;
  endpoint?: string;
}

/**
 * Track external dependency call
 */
export async function trackDependencyCall<T>(
  metadata: DependencyCallMetadata,
  operation: (span: Span) => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return withSpan(`dependency.${metadata.service}`, async (span) => {
    span.setAttribute("dependency.service", metadata.service);
    span.setAttribute("dependency.operation", metadata.operation);
    if (metadata.endpoint) {
      span.setAttribute("dependency.endpoint", metadata.endpoint);
    }

    try {
      const result = await operation(span);

      const latency = (Date.now() - startTime) / 1000;
      SystemMetrics.dependencyLatency.record(latency, {
        service: metadata.service,
        operation: metadata.operation,
        status: "success",
      });

      return result;
    } catch (error) {
      const latency = (Date.now() - startTime) / 1000;

      SystemMetrics.dependencyLatency.record(latency, {
        service: metadata.service,
        operation: metadata.operation,
        status: "error",
      });

      SystemMetrics.dependencyErrors.add(1, {
        service: metadata.service,
        operation: metadata.operation,
        error: error instanceof Error ? error.name : "unknown",
      });

      logger.error("Dependency call failed", {
        service: metadata.service,
        operation: metadata.operation,
        error: error instanceof Error ? error.message : "unknown",
      });

      throw error;
    }
  });
}

// ============================================================================
// FAILURE & RECOVERY TRACKING
// ============================================================================

export interface FailureMetadata {
  component: string;
  failureType: string;
  severity: "low" | "medium" | "high" | "critical";
  recoverable: boolean;
}

/**
 * Track system failure
 */
export function trackFailure(metadata: FailureMetadata, error: Error): void {
  SystemMetrics.failures.add(1, {
    component: metadata.component,
    type: metadata.failureType,
    severity: metadata.severity,
    recoverable: metadata.recoverable.toString(),
  });

  logger.error("System failure", {
    component: metadata.component,
    failure_type: metadata.failureType,
    severity: metadata.severity,
    recoverable: metadata.recoverable,
    error: error.message,
    stack: error.stack,
  });
}

/**
 * Track successful recovery from failure
 */
export function trackRecovery(
  component: string,
  failureType: string,
  recoveryMethod: string
): void {
  SystemMetrics.recoveries.add(1, {
    component,
    failure_type: failureType,
    recovery_method: recoveryMethod,
  });

  logger.info("Failure recovery successful", {
    component,
    failure_type: failureType,
    recovery_method: recoveryMethod,
  });
}

/**
 * Track circuit breaker state change
 */
export function trackCircuitBreakerStateChange(
  service: string,
  fromState: "closed" | "open" | "half-open",
  toState: "closed" | "open" | "half-open"
): void {
  SystemMetrics.circuitBreakerState.add(1, {
    service,
    from_state: fromState,
    to_state: toState,
  });

  logger.warn("Circuit breaker state changed", {
    service,
    from: fromState,
    to: toState,
  });
}

/**
 * Track retry attempt
 */
export function trackRetryAttempt(
  operation: string,
  attemptNumber: number,
  maxAttempts: number,
  success: boolean
): void {
  SystemMetrics.retryAttempts.add(1, {
    operation,
    attempt: attemptNumber.toString(),
    success: success.toString(),
  });

  logger.info("Retry attempt", {
    operation,
    attempt: attemptNumber,
    max_attempts: maxAttempts,
    success,
  });
}

// ============================================================================
// HEALTH CHECK MONITORING
// ============================================================================

export interface HealthCheckResult {
  service: string;
  status: "healthy" | "degraded" | "unhealthy";
  latency: number;
  details?: Record<string, any>;
}

/**
 * Track health check execution
 */
export function trackHealthCheck(result: HealthCheckResult): void {
  SystemMetrics.healthChecks.add(1, {
    service: result.service,
    status: result.status,
  });

  if (result.status !== "healthy") {
    SystemMetrics.healthCheckFailures.add(1, {
      service: result.service,
      status: result.status,
    });

    logger.warn("Health check failed", {
      service: result.service,
      status: result.status,
      latency_ms: result.latency,
      details: result.details,
    });
  }
}

// ============================================================================
// THROUGHPUT TRACKING
// ============================================================================

/**
 * Track agent interaction
 */
export function trackAgentInteraction(
  agentId: string,
  interactionType: "user_request" | "agent_to_agent" | "tool_call" | "system"
): void {
  SystemMetrics.agentInteractions.add(1, {
    agent_id: agentId,
    type: interactionType,
  });
}

/**
 * Track system request
 */
export function trackSystemRequest(endpoint: string, method: string): void {
  SystemMetrics.requestsPerSecond.add(1, {
    endpoint,
    method,
  });
}
