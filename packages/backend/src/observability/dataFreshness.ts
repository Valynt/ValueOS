/**
 * Data freshness monitoring for T1 agent output tables.
 *
 * Queries MAX(updated_at) per tenant-scoped table and emits a Prometheus gauge
 * so stale tables are visible before users notice. Designed to run on a cron
 * and to feed the /health/dependencies endpoint.
 */

import { createLogger } from "@shared/lib/logger";

import { createCounter, createObservableGauge } from "../lib/observability/index.js";
import { createCronSupabaseClient } from "../lib/supabase/privileged/index.js";

const logger = createLogger({ component: "DataFreshness" });

// ─── Metrics ──────────────────────────────────────────────────────────────────

/** Lag in minutes between now and the most recent row update, per table. */
const freshnessLagGauge = createObservableGauge(
  "data_freshness_lag_minutes",
  "Minutes since the most recent row was updated in a T1 table",
);

/** Count of freshness check failures (Supabase query errors). */
const freshnessCheckErrors = createCounter(
  "data_freshness_check_errors_total",
  "Errors encountered during freshness checks",
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type FreshnessStatus = "ok" | "stale" | "unknown";

export interface TableFreshnessResult {
  table: string;
  tier: "T1" | "T2" | "T3";
  lagMinutes: number | null;
  thresholdMinutes: number;
  status: FreshnessStatus;
  checkedAt: string;
}

// ─── T1 table registry ────────────────────────────────────────────────────────

/**
 * T1 tables with their freshness SLA thresholds (minutes).
 * Alert fires when lag exceeds 2× the SLA — matches the sprint plan definition.
 */
export const T1_TABLES: Array<{ table: string; slaMinutes: number }> = [
  { table: "hypothesis_outputs",       slaMinutes: 10 },
  { table: "value_tree_nodes",         slaMinutes: 10 },
  { table: "financial_model_snapshots", slaMinutes: 10 },
  { table: "integrity_outputs",        slaMinutes: 10 },
  { table: "narrative_drafts",         slaMinutes: 10 },
  { table: "realization_reports",      slaMinutes: 10 },
  { table: "expansion_opportunities",  slaMinutes: 30 },
  { table: "semantic_memory",          slaMinutes: 30 },
  { table: "agent_audit_log",          slaMinutes: 5  },
];

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Check freshness for a single table scoped to an org.
 *
 * @param table           - Supabase table name
 * @param thresholdMinutes - Alert threshold; lag > this value → status "stale"
 * @param orgId           - organization_id for tenant scoping
 * @param tier            - Criticality tier label for the Prometheus gauge
 */
export async function checkTableFreshness(
  table: string,
  thresholdMinutes: number,
  orgId: string,
  tier: "T1" | "T2" | "T3" = "T1",
): Promise<TableFreshnessResult> {
  const checkedAt = new Date().toISOString();

  try {
    // service-role:justified dataFreshness cron reads MAX(updated_at) across all tenant tables for observability
    const { data, error } = await createCronSupabaseClient()
      .from(table)
      .select("updated_at")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      logger.warn("Freshness check query failed", { table, orgId, error: error.message });
      freshnessCheckErrors.inc({ table });
      return { table, tier, lagMinutes: null, thresholdMinutes, status: "unknown", checkedAt };
    }

    if (!data) {
      // No rows yet — not stale, just empty. Emit 0 lag.
      freshnessLagGauge.set(0);
      return { table, tier, lagMinutes: 0, thresholdMinutes, status: "ok", checkedAt };
    }

    const lastUpdated = new Date((data as { updated_at: string }).updated_at);
    const lagMinutes = (Date.now() - lastUpdated.getTime()) / 60_000;

    freshnessLagGauge.set(lagMinutes);

    const status: FreshnessStatus = lagMinutes > thresholdMinutes ? "stale" : "ok";

    if (status === "stale") {
      logger.warn("T1 table freshness SLA breached", {
        table,
        orgId,
        lagMinutes: Math.round(lagMinutes),
        thresholdMinutes,
        tier,
      });
    }

    return { table, tier, lagMinutes, thresholdMinutes, status, checkedAt };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("Unexpected error in freshness check", { table, orgId, error: message });
    freshnessCheckErrors.inc({ table });
    return { table, tier, lagMinutes: null, thresholdMinutes, status: "unknown", checkedAt };
  }
}

/**
 * Run freshness checks for all T1 tables for a given org.
 * Threshold is 2× the SLA (matches sprint plan definition).
 */
export async function checkAllT1TableFreshness(
  orgId: string,
): Promise<TableFreshnessResult[]> {
  return Promise.all(
    T1_TABLES.map(({ table, slaMinutes }) =>
      checkTableFreshness(table, slaMinutes * 2, orgId, "T1"),
    ),
  );
}
