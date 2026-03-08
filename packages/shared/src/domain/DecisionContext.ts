/**
 * DecisionContext — structured domain state for agent routing
 *
 * Replaces the keyword-based `selectAgentForQuery(query, state)` pattern.
 * DecisionRouter accepts this object as its sole input and applies
 * domain-driven rules to select the next agent or action.
 *
 * Sprint 5: Initial definition. All fields are optional so callers can
 * provide partial context; rules must handle missing fields gracefully.
 *
 * Assembly: ContextStore (packages/backend/src/runtime/context-store/) is
 * the planned home for building this from live Supabase state. Until that
 * service is implemented, callers construct it inline from WorkflowState.
 */

import { z } from "zod";
import { OpportunityLifecycleStageSchema } from "./Opportunity.js";
import { HypothesisConfidenceSchema } from "./ValueHypothesis.js";
import { EvidenceTierSchema } from "./Evidence.js";
import { BusinessCaseStatusSchema } from "./BusinessCase.js";
import { StakeholderRoleSchema } from "./Stakeholder.js";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * Maturity of the value case — how well-developed the opportunity is.
 * Derived from the combination of lifecycle stage, hypothesis count, and
 * evidence quality. Used as a routing signal for business case generation.
 */
export const ValueMaturitySchema = z.enum(["low", "medium", "high"]);
export type ValueMaturity = z.infer<typeof ValueMaturitySchema>;

/**
 * Snapshot of the opportunity's current state relevant to routing.
 */
export const OpportunityContextSchema = z.object({
  id: z.string().uuid(),
  lifecycle_stage: OpportunityLifecycleStageSchema,
  /**
   * Aggregate confidence score 0–1 across all active hypotheses.
   * Computed by ConfidenceScorer. Drives HITL gating for external artifacts.
   */
  confidence_score: z.number().min(0).max(1),
  /**
   * How developed the value case is. Low = business case generation needed.
   */
  value_maturity: ValueMaturitySchema,
});
export type OpportunityContext = z.infer<typeof OpportunityContextSchema>;

/**
 * Snapshot of the primary (or weakest) hypothesis relevant to routing.
 * When multiple hypotheses exist, callers should pass the one with the
 * lowest confidence score so rules trigger on the worst case.
 */
export const HypothesisContextSchema = z.object({
  id: z.string().uuid(),
  confidence: HypothesisConfidenceSchema,
  /**
   * Numeric confidence score 0–1 mapped from the enum:
   *   high → 0.85, medium → 0.6, low → 0.35 (approximate midpoints).
   * Populated by ConfidenceScorer when available.
   */
  confidence_score: z.number().min(0).max(1).optional(),
  /**
   * Number of evidence items linked to this hypothesis.
   * Zero evidence → gatherEvidence rule fires.
   */
  evidence_count: z.number().int().nonnegative().default(0),
  /**
   * Highest evidence tier attached to this hypothesis.
   * Null when no evidence exists.
   */
  best_evidence_tier: EvidenceTierSchema.nullable().optional(),
});
export type HypothesisContext = z.infer<typeof HypothesisContextSchema>;

/**
 * Buying committee coverage — which stakeholder roles are mapped.
 * Used to detect gaps that block business case approval.
 */
export const BuyingCommitteeCoverageSchema = z.object({
  /** Roles present in the stakeholder list for this opportunity. */
  covered_roles: z.array(StakeholderRoleSchema),
  /**
   * Whether an economic buyer is identified.
   * Business cases without an economic buyer should not be presented.
   */
  has_economic_buyer: z.boolean(),
  /**
   * Total number of stakeholders mapped.
   */
  stakeholder_count: z.number().int().nonnegative(),
});
export type BuyingCommitteeCoverage = z.infer<typeof BuyingCommitteeCoverageSchema>;

/**
 * State of the business case artifact for this opportunity.
 * Absent (undefined) when the caller does not have business case data.
 * Present when the caller has queried for it — use null to signal that no
 * business case exists yet.
 */
export const BusinessCaseContextSchema = z.object({
  id: z.string().uuid(),
  status: BusinessCaseStatusSchema,
  /** Whether all financial assumptions have been human-reviewed. */
  assumptions_reviewed: z.boolean(),
});
export type BusinessCaseContext = z.infer<typeof BusinessCaseContextSchema>;

// ---------------------------------------------------------------------------
// DecisionContext
// ---------------------------------------------------------------------------

export const DecisionContextSchema = z.object({
  /**
   * Tenant that owns this context. Required for all routing decisions.
   * Ensures no cross-tenant routing occurs.
   */
  organization_id: z.string().uuid(),

  /**
   * The opportunity being worked on. Required for stage-based routing.
   */
  opportunity: OpportunityContextSchema.optional(),

  /**
   * The hypothesis with the lowest confidence score, or the primary
   * hypothesis under active review. Optional — absent when no hypotheses
   * exist yet.
   */
  hypothesis: HypothesisContextSchema.optional(),

  /**
   * Buying committee coverage for the opportunity.
   */
  buying_committee: BuyingCommitteeCoverageSchema.optional(),

  /**
   * Current business case state.
   * Absent (undefined) = caller did not provide business case data.
   * Present = caller has queried for it; check status for current state.
   */
  business_case: BusinessCaseContextSchema.optional(),

  /**
   * Whether the next action will produce or update an external-facing
   * artifact (e.g. a business case PDF, a customer-facing slide deck).
   * When true, HITL gating applies if confidence is below threshold.
   */
  is_external_artifact_action: z.boolean().default(false),
});

export type DecisionContext = z.infer<typeof DecisionContextSchema>;
