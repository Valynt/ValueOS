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
