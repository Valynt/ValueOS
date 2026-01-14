/**
 * Resilience Monitoring Metrics
 *
 * Exports Prometheus metrics for tracking system stability,
 * specifically targeting the "Golden Signals" of resilience:
 * - Latency (Agent Query Duration)
 * - Saturation (Circuit Breaker State)
 */

import { Counter, Gauge, Histogram } from "prom-client";
import { getMetricsRegistry } from "../../middleware/metricsMiddleware";

const registry = getMetricsRegistry();

// 1. Latency Metric
export const agentQueryLatency = new Histogram({
  name: "agent_query_latency_seconds",
  help: "End-to-end latency of agent query processing",
  labelNames: ["status", "model"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60], // Buckets up to 60s for timeout tracking
  registers: [registry],
});

// 2. Circuit Breaker State Metric
// 0 = Closed (Healthy), 1 = Open (Failing/Protecting), 2 = Half-Open (Recovering)
export const llmCircuitBreakerState = new Gauge({
  name: "llm_circuit_breaker_state",
  help: "Current state of the LLM circuit breaker (0=Closed, 1=Open, 2=Half-Open)",
  labelNames: ["provider"],
  registers: [registry],
});

// 3. Resilience Events Counter
export const resilienceEvents = new Counter({
  name: "resilience_events_total",
  help: "Total number of resilience events (retries, fallbacks, circuit trips)",
  labelNames: ["type", "source"],
  registers: [registry],
});

// 4. Circuit Breaker State Changes Counter
export const circuitBreakerStateChanges = new Counter({
  name: "circuit_breaker_state_changes_total",
  help: "Total number of circuit breaker state changes",
  labelNames: ["service", "from_state", "to_state"],
  registers: [registry],
});

// 5. Circuit Breaker Health Score Gauge
export const circuitBreakerHealthScore = new Gauge({
  name: "circuit_breaker_health_score",
  help: "Circuit breaker health score (0.0-1.0, where 1.0 is healthy)",
  labelNames: ["service"],
  registers: [registry],
});

// 6. Circuit Breaker Failure Rate Gauge
export const circuitBreakerFailureRate = new Gauge({
  name: "circuit_breaker_failure_rate",
  help: "Circuit breaker failure rate (0.0-1.0)",
  labelNames: ["service"],
  registers: [registry],
});

// 7. Circuit Breaker Response Time Histogram
export const circuitBreakerResponseTime = new Histogram({
  name: "circuit_breaker_response_time_seconds",
  help: "Circuit breaker response times",
  labelNames: ["service", "method"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [registry],
});

// 8. System Health Status Gauge
export const systemHealthStatus = new Gauge({
  name: "system_health_status",
  help: "Overall system health status (0=healthy, 1=degraded, 2=unhealthy, 3=critical)",
  registers: [registry],
});

// 9. Service Health Status Gauge
export const serviceHealthStatus = new Gauge({
  name: "service_health_status",
  help: "Individual service health status (0=healthy, 1=degraded, 2=unhealthy)",
  labelNames: ["service"],
  registers: [registry],
});

// 10. Circuit Breaker Alerts Counter
export const circuitBreakerAlerts = new Counter({
  name: "circuit_breaker_alerts_total",
  help: "Total number of circuit breaker alerts triggered",
  labelNames: ["type", "severity", "service"],
  registers: [registry],
});
