/**
 * Registers the Supabase query instrumentation hook at backend startup.
 *
 * This module wires the shared supabase.ts hook to the backend's Prometheus
 * metrics (dbMetrics.ts) and structured logger. It must be imported once
 * during server initialization, before any Supabase clients are used.
 *
 * Design: the shared package (@valueos/shared) has no dependency on prom-client
 * or the backend logger. The hook pattern keeps that boundary clean.
 */

import { setQueryInstrumentationHook } from "@shared/lib/supabase";

import { logger } from "./logger.js";
import {
  supabaseQueryDurationSeconds,
  supabaseQueryErrorsTotal,
  supabaseQueryTotal,
} from "./metrics/dbMetrics.js";

const SLOW_QUERY_THRESHOLD_MS = 500;

export function registerSupabaseInstrumentation(): void {
  setQueryInstrumentationHook((event) => {
    const { table, operation, duration_ms, status } = event;

    // Prometheus metrics
    supabaseQueryTotal.inc({ operation, table, status });
    supabaseQueryDurationSeconds.observe({ operation, table }, duration_ms / 1000);
    if (status === "error") {
      supabaseQueryErrorsTotal.inc({ operation, table });
    }

    // Structured logs — debug for all, warn for slow queries, error on failure
    if (status === "error") {
      logger.error("supabase_query", {
        event: "supabase_query",
        table,
        operation,
        duration_ms,
        status,
        http_status: event.http_status,
      });
    } else if (duration_ms >= SLOW_QUERY_THRESHOLD_MS) {
      logger.warn("supabase_query slow", {
        event: "supabase_query",
        table,
        operation,
        duration_ms,
        status,
      });
    } else {
      logger.debug("supabase_query", {
        event: "supabase_query",
        table,
        operation,
        duration_ms,
        status,
      });
    }
  });
}
