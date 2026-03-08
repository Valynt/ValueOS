/**
 * ExpansionOpportunity — canonical domain object
 *
 * A growth opportunity identified by ExpansionAgent after value has been
 * realized. Represents the next value engineering engagement.
 *
 * Consolidates:
 * - ExpansionOpportunitySchema (packages/backend/src/lib/agent-fabric/agents/ExpansionAgent.ts)
 * - ExpansionData (packages/backend/src/types/sdui-integration.ts)
 *
 * Sprint 3: First-class domain definition.
 */

import { z } from "zod";

export const ExpansionTypeSchema = z.enum([
  "upsell",
  "cross_sell",
  "new_use_case",
  "geographic_expansion",
  "deeper_adoption",
]);
export type ExpansionType = z.infer<typeof ExpansionTypeSchema>;

export const ExpansionOpportunityStatusSchema = z.enum([
  "identified",
  "qualified",
  "in_progress",
  "converted",
  "dismissed",
]);
export type ExpansionOpportunityStatus = z.infer<typeof ExpansionOpportunityStatusSchema>;

export const ExpansionValueRangeSchema = z.object({
  low: z.number().nonnegative(),
  high: z.number().nonnegative(),
  unit: z.enum(["usd", "percent", "hours", "headcount"]),
  timeframe_months: z.number().int().positive(),
});
export type ExpansionValueRange = z.infer<typeof ExpansionValueRangeSchema>;

export const ExpansionOpportunitySchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity (parent engagement) that surfaced this expansion signal. */
  source_opportunity_id: z.string().uuid(),

  /**
   * The KPI that triggered this expansion signal.
   * Null for expansion opportunities identified from qualitative signals.
   */
  source_kpi_id: z.string().uuid().nullable().optional(),

  /** Short title. */
  title: z.string().min(1).max(255),

  /** Detailed description of the expansion opportunity. */
  description: z.string().min(1).max(2000),

  type: ExpansionTypeSchema,

  status: ExpansionOpportunityStatusSchema.default("identified"),

  /** Estimated incremental value if this expansion is pursued. */
  estimated_additional_value: ExpansionValueRangeSchema,

  /** Agent-assigned confidence 0–1. */
  confidence: z.number().min(0).max(1),

  /**
   * IDs of Evidence objects that support this expansion signal.
   * Minimum one required — no expansion without evidence.
   */
  evidence_ids: z.array(z.string().uuid()).min(1),

  /**
   * Prerequisites that must be true before this expansion can be pursued
   * (free-form strings; structured in a future sprint).
   */
  prerequisites: z.array(z.string()).default([]),

  /**
   * IDs of Stakeholder objects who are relevant to this expansion.
   */
  stakeholder_ids: z.array(z.string().uuid()).default([]),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ExpansionOpportunity = z.infer<typeof ExpansionOpportunitySchema>;
