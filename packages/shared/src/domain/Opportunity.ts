/**
 * Opportunity — canonical domain object
 *
 * A value engineering engagement tied to a customer account.
 * Consolidates the value-case concept (packages/backend/src/api/valueCases/types.ts)
 * and CanonicalOpportunity (packages/backend/src/services/crm/types.ts).
 *
 * Sprint 3: First-class domain definition. The lifecycle stage drives all
 * agent routing decisions (Sprint 5 target).
 */

import { z } from "zod";

export const OpportunityLifecycleStageSchema = z.enum([
  "discovery",
  "drafting",
  "validating",
  "composing",
  "refining",
  "realizing",  // Active post-sale tracking: expected vs actual, variance analysis
  "realized",   // Terminal: value delivery confirmed and documented
  "expansion",
]);

export type OpportunityLifecycleStage = z.infer<typeof OpportunityLifecycleStageSchema>;

export const OpportunityStatusSchema = z.enum([
  "active",
  "on_hold",
  "closed_won",
  "closed_lost",
]);

export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;

export const OpportunitySchema = z.object({
  /** Stable internal identifier (UUID). */
  id: z.string().uuid(),

  /** Tenant that owns this opportunity. All queries must filter on this. */
  organization_id: z.string().uuid(),

  /** The customer account this opportunity belongs to. */
  account_id: z.string().uuid(),

  /** Human-readable name for the engagement. */
  name: z.string().min(1).max(255),

  /** Current stage in the value lifecycle. Drives agent routing. */
  lifecycle_stage: OpportunityLifecycleStageSchema,

  /** Operational status. */
  status: OpportunityStatusSchema.default("active"),

  /**
   * External CRM opportunity identifier (e.g. Salesforce Opportunity ID).
   * Null when created directly in ValueOS.
   */
  crm_external_id: z.string().max(255).nullable().optional(),

  /** Estimated close date (ISO 8601 date string). */
  close_date: z.string().date().nullable().optional(),

  /** ISO 8601 timestamps. */
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Opportunity = z.infer<typeof OpportunitySchema>;

/**
 * Check if opportunity can advance to next lifecycle stage.
 * Requires integrity_score >= 0.6 and integrity_check_passed on associated BusinessCase.
 *
 * @param opportunity - The opportunity to check
 * @param businessCase - Associated business case with integrity data (null if not created)
 * @returns Object with allowed boolean and optional reason string
 */
export function canAdvanceStage(
  opportunity: Opportunity,
  businessCase: { integrity_score: number | null; integrity_check_passed: boolean | null; veto_reason: string | null } | null
): { allowed: boolean; reason?: string } {
  if (!businessCase) {
    return { allowed: false, reason: "No business case exists" };
  }

  if (businessCase.integrity_check_passed !== true) {
    return {
      allowed: false,
      reason: businessCase.veto_reason || "Integrity check not passed"
    };
  }

  if ((businessCase.integrity_score ?? 0) < 0.6) {
    return {
      allowed: false,
      reason: `Integrity score ${businessCase.integrity_score} below threshold 0.6`
    };
  }

  return { allowed: true };
}
