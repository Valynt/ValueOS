/**
 * UseCase — canonical domain object
 *
 * A customer use case identified during deal assembly, including
 * pain signals, expected outcomes, and value driver potential.
 * Used by agents to generate and prioritize value hypotheses.
 */

import { z } from "zod";
import { SourceClassificationSchema } from "./DealContext.js";

export const PainSignalSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(1000),
  severity: z.enum(["critical", "high", "medium", "low"]),
  frequency: z.enum(["constant", "daily", "weekly", "monthly", "occasional"]).optional(),
  source_quote: z.string().max(2000).optional(),
  source_ref: z.string().uuid().optional(),
});
export type PainSignal = z.infer<typeof PainSignalSchema>;

export const ExpectedOutcomeSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(1000),
  metric: z.string().max(255).optional(),
  target_improvement: z.string().max(255).optional(),
});
export type ExpectedOutcome = z.infer<typeof ExpectedOutcomeSchema>;

export const UseCaseSchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this record. All queries must filter on this. */
  tenant_id: z.string().uuid(),

  /** The deal context this use case belongs to. */
  deal_context_id: z.string().uuid(),

  /** Short name of the use case. */
  name: z.string().min(1).max(255),

  /** Detailed description. */
  description: z.string().min(1).max(2000),

  /** Identified pain signals for this use case. */
  pain_signals: z.array(PainSignalSchema),

  /** Priority ranking (1-100, higher = more important). */
  priority: z.number().int().min(1).max(100).default(50),

  /** Expected outcomes if this use case is addressed. */
  expected_outcomes: z.array(ExpectedOutcomeSchema),

  /** How this use case was identified. */
  source_type: SourceClassificationSchema,

  /** Whether this use case is flagged as a potential value driver. */
  value_driver_candidate: z.boolean().default(false),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type UseCase = z.infer<typeof UseCaseSchema>;
