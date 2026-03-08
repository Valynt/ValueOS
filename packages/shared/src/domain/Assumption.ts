/**
 * Assumption — canonical domain object
 *
 * A named, auditable input to a financial model or value hypothesis.
 * Every financial calculation must be traceable to explicit assumptions.
 *
 * Consolidates:
 * - VMRTAssumption (packages/backend/src/types/vmrt.ts)
 * - UpdateAssumptionAction (packages/shared/src/types/actions.ts)
 *
 * Sprint 3: First-class domain definition. Satisfies Guiding Principle 4:
 * "Deterministic Economics — all financial calculations must be explicit,
 * auditable, and reproducible."
 */

import { z } from "zod";

export const AssumptionSourceSchema = z.enum([
  "agent_inference",
  "user_override",
  "benchmark",
  "crm",
  "erp",
  "system",
]);
export type AssumptionSource = z.infer<typeof AssumptionSourceSchema>;

export const AssumptionSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The opportunity this assumption belongs to. */
  opportunity_id: z.string().uuid(),

  /**
   * The hypothesis this assumption supports.
   * Null for assumptions that apply to the whole opportunity model.
   */
  hypothesis_id: z.string().uuid().nullable().optional(),

  /** Short label (e.g. "Average deal size"). */
  name: z.string().min(1).max(255),

  /** Longer description of what this assumption represents. */
  description: z.string().max(1000).optional(),

  /** The numeric value of this assumption. */
  value: z.number(),

  /** Unit of measure (e.g. "USD", "%", "days", "FTE"). */
  unit: z.string().max(50),

  /** Where this value came from. */
  source: AssumptionSourceSchema,

  /**
   * Confidence interval: [low, high] as multipliers on `value`.
   * E.g. [0.8, 1.2] means ±20%.
   */
  sensitivity_range: z
    .tuple([z.number().positive(), z.number().positive()])
    .optional(),

  /**
   * Whether a human has explicitly reviewed and accepted this assumption.
   * Required for assumptions that feed financial model outputs shown to customers.
   */
  human_reviewed: z.boolean().default(false),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Assumption = z.infer<typeof AssumptionSchema>;
