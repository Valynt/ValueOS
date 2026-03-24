/**
 * Data Model Validation Report
 * 
 * Generated: Task 0 of MVP Execution Plan
 * Purpose: Verify domain schemas support MVP critical path requirements
 * 
 * STATUS: ⚠️ CHANGES REQUIRED
 * 
 * Schema Gaps Identified:
 * ======================
 * 
 * 1. AssumptionSchema
 *    ❌ value: z.number() → should be z.string() for Decimal precision
 *    ❌ Missing version field for edit tracking
 *    ⚠️ sensitivity_range uses numbers, should support string precision
 * 
 * 2. BusinessCaseSchema
 *    ✅ integrity_score present
 *    ❌ Missing integrity_check_passed: boolean
 *    ❌ Missing integrity_evaluated_at: string (ISO timestamp)
 *    ❌ Missing veto_reason?: string
 * 
 * 3. ValueHypothesisSchema
 *    ❌ estimated_value.low/high: z.number() → should be z.string()
 *    ❌ Missing financial_summary: { npv, irr, roi, payback_months, scenarios }
 * 
 * 4. OpportunitySchema
 *    ✅ lifecycle_stage enum present
 *    ✅ organization_id tenant isolation
 *    ⚠️ can_advance_stage() helper needed (computed, not stored)
 */

import { z } from "zod";

// ============================================================================
// PROPOSED SCHEMA UPDATES FOR MVP COMPLIANCE
// ============================================================================

/**
 * Updated AssumptionSchema with Decimal precision and versioning
 */
export const AssumptionSchemaMVP = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  hypothesis_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  
  // CHANGED: string for Decimal precision
  value: z.string(),
  unit: z.string().max(50),
  source: z.enum(["agent_inference", "user_override", "benchmark", "crm", "erp", "system"]),
  
  // CHANGED: string-based sensitivity for precision
  sensitivity_low: z.string().optional(),
  sensitivity_high: z.string().optional(),
  
  // ADDED: version tracking for assumption edits
  version: z.number().int().positive().default(1),
  
  human_reviewed: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * Updated BusinessCaseSchema with integrity gating fields
 */
export const BusinessCaseSchemaMVP = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  status: z.enum(["draft", "in_review", "approved", "presented", "archived"]).default("draft"),
  hypothesis_ids: z.array(z.string().uuid()).min(1),
  financial_summary: z.object({
    total_value_low_usd: z.number().nonnegative(),
    total_value_high_usd: z.number().nonnegative(),
    payback_months: z.number().positive().nullable().optional(),
    roi_3yr: z.number().nullable().optional(),
    irr: z.number().nullable().optional(),
    currency: z.string().length(3).default("USD"),
  }).nullable().optional(),
  version: z.number().int().positive().default(1),
  owner_id: z.string().uuid(),
  defense_readiness_score: z.number().min(0).max(1).nullable().optional(),
  integrity_score: z.number().min(0).max(1).nullable().optional(),
  
  // ADDED: Explicit integrity check result
  integrity_check_passed: z.boolean().nullable().optional(),
  
  // ADDED: When integrity was last evaluated
  integrity_evaluated_at: z.string().datetime().nullable().optional(),
  
  // ADDED: Reason for veto if blocked
  veto_reason: z.string().nullable().optional(),
  
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * FinancialSummary for ValueHypothesis with scenarios
 */
export const HypothesisFinancialSummarySchema = z.object({
  npv: z.string(), // Decimal precision
  irr: z.string(),
  roi: z.string(),
  payback_months: z.number(),
  scenarios: z.object({
    conservative: z.object({ npv: z.string(), irr: z.string() }),
    base: z.object({ npv: z.string(), irr: z.string() }),
    upside: z.object({ npv: z.string(), irr: z.string() }),
  }),
});

/**
 * Updated ValueHypothesisSchema with financial summary
 */
export const ValueHypothesisSchemaMVP = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  opportunity_id: z.string().uuid(),
  description: z.string().min(10).max(2000),
  category: z.string().min(1).max(100),
  
  // CHANGED: String-based for Decimal precision
  estimated_value: z.object({
    low: z.string(),
    high: z.string(),
    unit: z.enum(["usd", "percent", "hours", "headcount"]),
    timeframe_months: z.number().int().positive(),
  }).nullable().optional(),
  
  // ADDED: Computed financial summary from Economic Kernel
  financial_summary: HypothesisFinancialSummarySchema.nullable().optional(),
  
  confidence: z.enum(["high", "medium", "low"]),
  status: z.enum(["proposed", "under_review", "validated", "rejected", "superseded"]).default("proposed"),
  evidence_ids: z.array(z.string().uuid()).default([]),
  hallucination_check: z.boolean().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

/**
 * OpportunitySchema unchanged - already MVP compliant
 */
export const OpportunitySchemaMVP = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  account_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  lifecycle_stage: z.enum([
    "discovery", "drafting", "validating", "composing", "refining", "realized", "expansion"
  ]),
  status: z.enum(["active", "on_hold", "closed_won", "closed_lost"]).default("active"),
  crm_external_id: z.string().max(255).nullable().optional(),
  close_date: z.string().date().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if opportunity can advance to next lifecycle stage.
 * Requires integrity_score >= 0.6 on associated BusinessCase.
 */
export function canAdvanceStage(
  opportunity: z.infer<typeof OpportunitySchemaMVP>,
  businessCase: z.infer<typeof BusinessCaseSchemaMVP> | null
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
