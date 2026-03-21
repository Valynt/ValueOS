/**
 * VgMetric — Value Graph entity
 *
 * A quantifiable outcome that a capability impacts. Metrics are the
 * measurement layer between capabilities and value drivers — they make
 * ROI claims falsifiable and auditable.
 *
 * Graph position: VgCapability → (capability_impacts_metric) → VgMetric
 *                 VgMetric → (metric_maps_to_value_driver) → VgValueDriver
 *                 Evidence → (evidence_supports_metric) → VgMetric
 *                 ValueHypothesis → (hypothesis_claims_metric) → VgMetric
 *
 * Sprint 47: Initial definition.
 */

import { z } from "zod";

export const VgMetricUnitSchema = z.enum([
  "usd",
  "percent",
  "hours",
  "headcount",
  "days",
  "count",
  "score",
]);
export type VgMetricUnit = z.infer<typeof VgMetricUnitSchema>;

export const VgMetricSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this metric node belongs to. */
  opportunity_id: z.string().uuid(),

  /**
   * Short name of the metric.
   * Example: "Days Sales Outstanding (DSO)"
   */
  name: z.string().min(1).max(255),

  /** Unit of measurement. */
  unit: VgMetricUnitSchema,

  /**
   * Current measured value before the capability is applied.
   * Null when not yet established.
   */
  baseline_value: z.number().nullable().optional(),

  /**
   * Target value after the capability is applied.
   * Null when not yet modeled.
   */
  target_value: z.number().nullable().optional(),

  /**
   * How this metric is measured.
   * Example: "ERP export → average of (invoice_date - payment_date) over 90 days"
   */
  measurement_method: z.string().max(1000).nullable().optional(),

  /**
   * Timeframe over which the impact is expected.
   * Months from capability deployment.
   */
  impact_timeframe_months: z.number().int().positive().nullable().optional(),

  /** Ontology version this node was written under. */
  ontology_version: z.string().default("1.0"),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type VgMetric = z.infer<typeof VgMetricSchema>;
