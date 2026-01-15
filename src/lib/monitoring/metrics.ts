/**
 * Resilience Monitoring Metrics
 *
 * Exports Prometheus metrics for tracking system stability.
 * Browser-safe: provides no-op stubs when running in browser environment.
 */

// Detect browser environment
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// No-op metric for browser environment
const noopMetric = {
  labels: (..._args: any[]) => noopMetric,
  set: (..._args: any[]) => {},
  inc: (..._args: any[]) => {},
  dec: (..._args: any[]) => {},
  observe: (..._args: any[]) => {},
  startTimer: () => () => {},
};

// Metric type definitions
type MetricLabels = Record<string, string | number>;
interface Metric {
  labels: (...args: any[]) => Metric;
  set: (value: number) => void;
  inc: (value?: number | MetricLabels) => void;
  dec: (value?: number) => void;
  observe: (value: number) => void;
  startTimer: () => () => void;
}

// Create metrics - returns no-op in browser, real metrics on server
function createGauge(_config: any): Metric {
  if (isBrowser) return noopMetric;
  try {
    const { Gauge } = require("prom-client");
    const {
      getMetricsRegistry,
    } = require("../../middleware/metricsMiddleware");
    return new Gauge({ ..._config, registers: [getMetricsRegistry()] });
  } catch {
    return noopMetric;
  }
}

function createCounter(_config: any): Metric {
  if (isBrowser) return noopMetric;
  try {
    const { Counter } = require("prom-client");
    const {
      getMetricsRegistry,
    } = require("../../middleware/metricsMiddleware");
    return new Counter({ ..._config, registers: [getMetricsRegistry()] });
  } catch {
    return noopMetric;
  }
}

function createHistogram(_config: any): Metric {
  if (isBrowser) return noopMetric;
  try {
    const { Histogram } = require("prom-client");
    const {
      getMetricsRegistry,
    } = require("../../middleware/metricsMiddleware");
    return new Histogram({ ..._config, registers: [getMetricsRegistry()] });
  } catch {
    return noopMetric;
  }
}

// 1. Latency Metric
export const agentQueryLatency = createHistogram({
  name: "agent_query_latency_seconds",
  help: "End-to-end latency of agent query processing",
  labelNames: ["status", "model"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
});

// 2. Circuit Breaker State Metric
export const llmCircuitBreakerState = createGauge({
  name: "llm_circuit_breaker_state",
  help: "Current state of the LLM circuit breaker (0=Closed, 1=Open, 2=Half-Open)",
  labelNames: ["provider"],
});

// 3. Resilience Events Counter
export const resilienceEvents = createCounter({
  name: "resilience_events_total",
  help: "Total number of resilience events (retries, fallbacks, circuit trips)",
  labelNames: ["type", "source"],
});

// 4. Circuit Breaker State Changes Counter
export const circuitBreakerStateChanges = createCounter({
  name: "circuit_breaker_state_changes_total",
  help: "Total number of circuit breaker state changes",
  labelNames: ["service", "from_state", "to_state"],
});

// 5. Circuit Breaker Health Score Gauge
export const circuitBreakerHealthScore = createGauge({
  name: "circuit_breaker_health_score",
  help: "Circuit breaker health score (0.0-1.0, where 1.0 is healthy)",
  labelNames: ["service"],
});

// 6. Circuit Breaker Failure Rate Gauge
export const circuitBreakerFailureRate = createGauge({
  name: "circuit_breaker_failure_rate",
  help: "Circuit breaker failure rate (0.0-1.0)",
  labelNames: ["service"],
});

// 7. Circuit Breaker Response Time Histogram
export const circuitBreakerResponseTime = createHistogram({
  name: "circuit_breaker_response_time_seconds",
  help: "Circuit breaker response times",
  labelNames: ["service", "method"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// 8. System Health Status Gauge
export const systemHealthStatus = createGauge({
  name: "system_health_status",
  help: "Overall system health status (0=healthy, 1=degraded, 2=unhealthy, 3=critical)",
});

// 9. Service Health Status Gauge
export const serviceHealthStatus = createGauge({
  name: "service_health_status",
  help: "Individual service health status (0=healthy, 1=degraded, 2=unhealthy)",
  labelNames: ["service"],
});

// 10. Circuit Breaker Alerts Counter
export const circuitBreakerAlerts = createCounter({
  name: "circuit_breaker_alerts_total",
  help: "Total number of circuit breaker alerts triggered",
  labelNames: ["type", "severity", "service"],
});

// 11. Agent Queue Depth Gauge
export const agentQueueDepth = createGauge({
  name: "agent_queue_depth",
  help: "Current depth of agent processing queues",
  labelNames: ["queue_type", "agent_type"],
});

// 12. Agent Queue Processing Rate
export const agentQueueProcessingRate = createGauge({
  name: "agent_queue_processing_rate",
  help: "Rate of agent queue processing (jobs per second)",
  labelNames: ["queue_type"],
});

// 13. Agent Request Error Rate
export const agentRequestErrorRate = createGauge({
  name: "agent_request_error_rate",
  help: "Error rate for agent requests (0.0-1.0)",
  labelNames: ["agent_type", "error_type"],
});

// 14. Agent Request Latency Histogram
export const agentRequestLatency = createHistogram({
  name: "agent_request_latency_seconds",
  help: "End-to-end latency of agent requests",
  labelNames: ["agent_type", "status", "priority"],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60, 120],
});

// 15. Rate Limit Hits Counter
export const rateLimitHits = createCounter({
  name: "rate_limit_hits_total",
  help: "Total number of rate limit hits",
  labelNames: ["tier", "service"],
});

// 16. Rate Limit Current Usage Gauge
export const rateLimitCurrentUsage = createGauge({
  name: "rate_limit_current_usage",
  help: "Current usage of rate limits",
  labelNames: ["tier", "service"],
});

// 17. Message Bus Message Count
export const messageBusMessageCount = createCounter({
  name: "message_bus_messages_total",
  help: "Total number of messages processed by message bus",
  labelNames: ["direction", "priority", "encrypted"],
});

// 18. Message Bus Latency Histogram
export const messageBusLatency = createHistogram({
  name: "message_bus_latency_seconds",
  help: "Message processing latency in the message bus",
  labelNames: ["operation", "priority"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

// 19. Redis Connection Health
export const redisConnectionHealth = createGauge({
  name: "redis_connection_health",
  help: "Redis connection health status (1=healthy, 0=unhealthy)",
  labelNames: ["service"],
});

// 20. Distributed State Synchronization Lag
export const distributedStateSyncLag = createHistogram({
  name: "distributed_state_sync_lag_seconds",
  help: "Lag in distributed state synchronization",
  labelNames: ["component"],
  buckets: [0.001, 0.01, 0.1, 1, 5],
});

// 21. Agent Performance Score
export const agentPerformanceScore = createGauge({
  name: "agent_performance_score",
  help: "Agent performance score based on latency and error rate (0.0-1.0)",
  labelNames: ["agent_type"],
});

// 22. System Load Average
export const systemLoadAverage = createGauge({
  name: "system_load_average",
  help: "System load average (1min, 5min, 15min)",
  labelNames: ["period"],
});

// 23. Memory Usage Gauge
export const memoryUsage = createGauge({
  name: "memory_usage_bytes",
  help: "Memory usage in bytes",
  labelNames: ["type"],
});

// 24. Event Sourcing Lag
export const eventSourcingLag = createHistogram({
  name: "event_sourcing_lag_seconds",
  help: "Lag between event occurrence and storage",
  labelNames: ["event_type"],
  buckets: [0.001, 0.01, 0.1, 1, 10],
});

// 25. Active Agent Sessions
export const activeAgentSessions = createGauge({
  name: "active_agent_sessions",
  help: "Number of currently active agent sessions",
  labelNames: ["agent_type"],
});

// 26. Kafka Producer Events Total
export const kafkaProducerEventsTotal = createCounter({
  name: "kafka_producer_events_total",
  help: "Total number of events published to Kafka",
  labelNames: ["topic", "status"],
});

// 27. Kafka Producer Latency
export const kafkaProducerLatency = createHistogram({
  name: "kafka_producer_latency_seconds",
  help: "Latency of Kafka event publishing in seconds",
  labelNames: ["topic"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

// 28. Kafka Producer Errors
export const kafkaProducerErrors = createCounter({
  name: "kafka_producer_errors_total",
  help: "Total number of Kafka producer errors",
  labelNames: ["topic", "error_type"],
});
