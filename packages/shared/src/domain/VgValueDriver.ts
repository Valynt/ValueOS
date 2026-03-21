/**
 * VgValueDriver — Value Graph entity
 *
 * The terminal node of the Value Graph. Represents the economic category
 * that a metric maps to. The taxonomy is fixed — agents cannot invent new
 * driver types. This enforces ontology stability across all agent runs.
 *
 * Graph position: VgMetric → (metric_maps_to_value_driver) → VgValueDriver
 *
 * The four driver types correspond to the EVF (Economic Value Framework):
 *   - revenue_growth:     top-line expansion (new ARR, upsell, faster close)
 *   - cost_reduction:     opex/capex savings (headcount, tooling, process)
 *   - risk_mitigation:    avoided loss (compliance, security, churn prevention)
 *   - capital_efficiency: working capital improvement (DSO, inventory, cash cycle)
 *
 * Sprint 47: Initial definition. Taxonomy is version-locked at 1.0.
 */

import { z } from "zod";

/**
 * Fixed taxonomy of value driver types.
 * Agents MUST map to one of these — no free-text driver types allowed.
 */
export const VgValueDriverTypeSchema = z.enum([
  "revenue_growth",
  "cost_reduction",
  "risk_mitigation",
  "capital_efficiency",
]);
export type VgValueDriverType = z.infer<typeof VgValueDriverTypeSchema>;

export const VgValueDriverSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this value driver node belongs to. */
  opportunity_id: z.string().uuid(),

  /**
   * Economic category. Fixed taxonomy — no new types may be added without
   * an ontology version bump.
   */
  type: VgValueDriverTypeSchema,

  /**
   * Human-readable name for this driver instance.
   * Example: "Reduce invoice processing cost"
   */
  name: z.string().min(1).max(255),

  /**
   * Description of how this driver manifests for this opportunity.
   * Example: "AP team spends 40% of time on manual reconciliation; automation
   * eliminates this entirely."
   */
  description: z.string().min(1).max(2000),

  /**
   * Estimated total financial impact in USD.
   * Null until FinancialModelingAgent computes it from connected metrics.
   */
  estimated_impact_usd: z.number().nullable().optional(),

  /** Ontology version this node was written under. */
  ontology_version: z.string().default("1.0"),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type VgValueDriver = z.infer<typeof VgValueDriverSchema>;
