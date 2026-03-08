/**
 * PolicyEngine
 *
 * Pre-checks safety, data integrity, compliance rules, and HITL requirements
 * before agent execution.
 *
 * Sprint 5: Initial implementation — HITL gating based on DecisionContext.
 * Full extraction from UnifiedAgentOrchestrator is a Sprint 4 target; this
 * module implements only the HITL trigger required by Sprint 5.
 *
 * HITL trigger rule (Sprint 5.5):
 *   If opportunity.confidenceScore < 0.6 AND the action involves an
 *   external-facing artifact, require human approval before proceeding.
 */

import { DecisionContext } from '@shared/domain/DecisionContext.js';

// ---------------------------------------------------------------------------
// ServiceHealthSnapshot
// ---------------------------------------------------------------------------

/**
 * Point-in-time health state of the services PolicyEngine depends on.
 *
 * Passed as a single value object rather than individual boolean parameters
 * so the method signature stays stable as new services are added. Callers
 * assemble this from their own health checks; PolicyEngine does not own or
 * query those services directly.
 *
 * Used by the full PolicyEngine extraction (Sprint 4 target). The Sprint 5
 * `checkHITL` method does not require service health — it operates on
 * DecisionContext alone.
 */
export interface ServiceHealthSnapshot {
  messageBrokerReady: boolean;
  queueReady: boolean;
  memoryBackendReady: boolean;
  llmGatewayReady: boolean;
  circuitBreakerReady: boolean;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PolicyCheckResult {
  /** Whether the action is allowed to proceed without human intervention. */
  allowed: boolean;
  /**
   * When allowed is false, the reason human approval is required.
   * Included in audit logs and surfaced to the UI.
   */
  hitl_required: boolean;
  hitl_reason?: string;
  /**
   * Structured details for audit trail and OTel span attributes.
   */
  details: PolicyCheckDetails;
}

export interface PolicyCheckDetails {
  /** The policy rule that produced this result. */
  rule_id: string;
  /** Confidence score that triggered the check (if applicable). */
  confidence_score?: number;
  /** Whether the action was flagged as external-facing. */
  is_external_artifact_action: boolean;
  /** Lifecycle stage at the time of the check. */
  lifecycle_stage?: string;
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

/**
 * Minimum confidence score required to proceed with an external-facing
 * artifact action without human approval.
 *
 * Sprint 5.5 requirement: trigger HITL if confidenceScore < 0.6.
 */
export const HITL_CONFIDENCE_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// PolicyEngine
// ---------------------------------------------------------------------------

export class PolicyEngine {
  /**
   * Check whether the action described by the DecisionContext requires
   * human approval before proceeding.
   *
   * Currently implements one rule:
   *   HITL-01: External artifact actions with low opportunity confidence
   *            require human approval.
   *
   * Returns `allowed: true` when no policy blocks the action.
   */
  checkHITL(context: DecisionContext): PolicyCheckResult {
    const opportunityConfidence = context.opportunity?.confidence_score;
    const isExternalArtifact = context.is_external_artifact_action;
    const lifecycleStage = context.opportunity?.lifecycle_stage;

    // HITL-01: Low confidence + external artifact → require approval
    if (
      isExternalArtifact &&
      opportunityConfidence !== undefined &&
      opportunityConfidence < HITL_CONFIDENCE_THRESHOLD
    ) {
      return {
        allowed: false,
        hitl_required: true,
        hitl_reason:
          `Opportunity confidence score is ${opportunityConfidence.toFixed(2)} ` +
          `(below the ${HITL_CONFIDENCE_THRESHOLD} threshold). ` +
          `Human approval is required before generating an external-facing artifact.`,
        details: {
          rule_id: 'HITL-01',
          confidence_score: opportunityConfidence,
          is_external_artifact_action: isExternalArtifact,
          lifecycle_stage: lifecycleStage,
        },
      };
    }

    return {
      allowed: true,
      hitl_required: false,
      details: {
        rule_id: 'HITL-01',
        confidence_score: opportunityConfidence,
        is_external_artifact_action: isExternalArtifact,
        lifecycle_stage: lifecycleStage,
      },
    };
  }
}

// Singleton for use by the orchestrator
export const policyEngine = new PolicyEngine();
