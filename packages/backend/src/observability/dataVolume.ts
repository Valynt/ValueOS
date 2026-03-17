/**
 * Volume monitoring for T1 agent output tables.
 *
 * Tracks row-count deltas and detects two failure modes:
 *   1. Sudden volume drop (>50% vs 7-day rolling average) — indicates a partial
 *      load, a failed migration, or a runaway delete.
 *   2. Zero-row agent write — an agent run completed but persisted nothing,
 *      which is always a bug in the persistence path.
 */

import { createLogger } from "@shared/lib/logger";

import { createCounter, createObservableGauge } from "../lib/observability/index.js";
import { supabase } from "../lib/supabase.js";

const logger = createLogger({ component: "DataVolume" });

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Row-count delta over the last 24 h, per table. */
const rowDeltaGauge = createObservableGauge(
  "data_volume_row_delta",
  "Row count delta over the last 24 hours for a T1 table",
);

/** Fires when a table's 24 h delta drops >50% below its 7-day rolling average. */
const volumeAnomalyCounter = createCounter(
  "data_volume_anomaly_total",
  "Volume anomalies detected: sudden drop vs 7-day rolling average",
);

/** Fires when an agent run completes but writes 0 rows to its output table. */
const partialLoadCounter = createCounter(
  "data_partial_load_total",
  "Agent runs that completed but wrote 0 rows to their output table",
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableVolumeResult {
  table: string;
  orgId: string;
  rowDelta24h: number;
  rollingAvg7d: number | null;
  anomalyDetected: boolean;
  checkedAt: string;
}

// ─── Core functions ───────────────────────────────────────────────────────────

/**
 * Count rows created in the last N hours for a tenant-scoped table.
 * Uses `created_at` because `updated_at` would count edits, not new writes.
 */
async function countRowsInWindow(
  table: string,
  orgId: string,
  hoursBack: number,
): Promise<number | null> {
  const since = new Date(Date.now() - hoursBack * 3_600_000).toISOString();

  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", since);

  if (error) {
    logger.warn("Volume count query failed", { table, orgId, hoursBack, error: error.message });
    return null;
  }

  return count ?? 0;
}

/**
 * Check volume for a single table.
 *
 * Emits `data_volume_row_delta` gauge and fires `data_volume_anomaly_total`
 * if the 24 h delta is more than 50% below the 7-day daily average.
 */
export async function checkTableVolume(
  table: string,
  orgId: string,
): Promise<TableVolumeResult> {
  const checkedAt = new Date().toISOString();

  const [delta24h, total7d] = await Promise.all([
    countRowsInWindow(table, orgId, 24),
    countRowsInWindow(table, orgId, 24 * 7),
  ]);

  if (delta24h === null) {
    return { table, orgId, rowDelta24h: 0, rollingAvg7d: null, anomalyDetected: false, checkedAt };
  }

  rowDeltaGauge.set(delta24h);

  // Rolling daily average over 7 days (null when total7d query failed)
  const rollingAvg7d = total7d !== null ? total7d / 7 : null;

  let anomalyDetected = false;
  if (rollingAvg7d !== null && rollingAvg7d > 0) {
    const dropFraction = (rollingAvg7d - delta24h) / rollingAvg7d;
    if (dropFraction > 0.5) {
      anomalyDetected = true;
      volumeAnomalyCounter.inc({ table });
      logger.warn("Volume anomaly: sudden drop vs 7-day average", {
        table,
        orgId,
        delta24h,
        rollingAvg7d: Math.round(rollingAvg7d),
        dropPercent: Math.round(dropFraction * 100),
      });
    }
  }

  return { table, orgId, rowDelta24h: delta24h, rollingAvg7d, anomalyDetected, checkedAt };
}

/**
 * Record a zero-row agent write.
 *
 * Call this from a repository write path when an agent run completes but
 * the resulting insert/upsert affects 0 rows. This is always a bug.
 *
 * @param agent - Agent class name (e.g. "OpportunityAgent")
 * @param table - Target table name
 * @param orgId - organization_id for context
 */
export function recordPartialLoad(agent: string, table: string, orgId: string): void {
  partialLoadCounter.inc({ agent, table });
  logger.error("Agent run produced zero rows — partial load detected", {
    agent,
    table,
    orgId,
  });
}
