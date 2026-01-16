/**
 * Shared metrics utilities for ValueOS agents
 * Uses Prometheus client for metrics collection
 */

import { register, collectDefaultMetrics, Gauge, Counter, Histogram } from "prom-client";

// Enable default metrics (CPU, memory, etc.)
collectDefaultMetrics();

export const metrics = {
  // Request metrics
  httpRequestsTotal: new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
  }),

  httpRequestDuration: new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  // Agent-specific metrics
  agentQueriesTotal: new Counter({
    name: "agent_queries_total",
    help: "Total number of agent queries processed",
    labelNames: ["agent_type", "status"],
  }),

  agentQueryDuration: new Histogram({
    name: "agent_query_duration_seconds",
    help: "Duration of agent queries in seconds",
    labelNames: ["agent_type"],
    buckets: [1, 5, 10, 30, 60, 120, 300],
  }),

  // Health metrics
  healthStatus: new Gauge({
    name: "agent_health_status",
    help: "Current health status of the agent (1 = healthy, 0 = unhealthy)",
  }),

  // Resource metrics
  activeConnections: new Gauge({
    name: "agent_active_connections",
    help: "Number of active connections",
  }),

  // Custom metrics for agent-specific needs
  customMetrics: new Map<string, Gauge | Counter | Histogram>(),
};

/**
 * Create a custom metric
 */
export function createCustomMetric<T extends Gauge | Counter | Histogram>(
  name: string,
  type: "gauge" | "counter" | "histogram",
  options: any
): T {
  let metric: T;

  switch (type) {
    case "gauge":
      metric = new Gauge(options) as T;
      break;
    case "counter":
      metric = new Counter(options) as T;
      break;
    case "histogram":
      metric = new Histogram(options) as T;
      break;
  }

  metrics.customMetrics.set(name, metric);
  return metric;
}

/**
 * Get metrics registry for scraping
 */
export function getMetricsRegistry() {
  return register;
}
