import * as client from "prom-client";

import registry from "./httpMetrics.js";

/**
 * Prometheus metrics for Supabase query instrumentation.
 *
 * Labels are kept low-cardinality:
 *   operation — one of: select, insert, update, delete, upsert, rpc
 *   table     — logical table/resource name (bounded, no raw SQL or user input)
 *   status    — ok | error
 *
 * Do NOT add user IDs, org IDs, request IDs, or arbitrary filter values as
 * labels — these cause cardinality explosions in Prometheus.
 */

export const supabaseQueryTotal = new client.Counter({
  name: "valuecanvas_supabase_query_total",
  help: "Total Supabase queries by operation, table, and outcome",
  labelNames: ["operation", "table", "status"] as const,
  registers: [registry],
});

export const supabaseQueryDurationSeconds = new client.Histogram({
  name: "valuecanvas_supabase_query_duration_seconds",
  help: "Supabase query duration in seconds",
  labelNames: ["operation", "table"] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const supabaseQueryErrorsTotal = new client.Counter({
  name: "valuecanvas_supabase_query_errors_total",
  help: "Total Supabase query errors by operation and table",
  labelNames: ["operation", "table"] as const,
  registers: [registry],
});
