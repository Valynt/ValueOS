/**
 * Agent Governance Layer
 *
 * Three enforcement mechanisms applied after every agent output is produced:
 *
 * 1. IntegrityAgent veto — routes output through IntegrityAgent when the
 *    agent declares requiresIntegrityVeto=true. A veto blocks the output
 *    and triggers saga compensation.
 *
 * 2. Confidence thresholds — compares the output's ConfidenceBreakdown
 *    against the risk-tier thresholds declared by the agent:
 *      - score >= accept  → approved
 *      - accept > score >= review → pending_human (HITL queue)
 *      - score < block    → vetoed (output blocked)
 *
 * 3. Human-in-the-loop checkpoints — when verdict is pending_human, the
 *    output is written to the ApprovalInbox and the workflow is paused
 *    until a human approves or rejects.
 *
 * All governance decisions are immutable once written. The GovernanceLayer
 * does not modify agent output — it only decides whether to release it.
 */

import { v4 as uuidv4 } from "uuid";
import { logger } from "../../logger.js";
import type {
  ConfidenceBreakdown,
  ConfidenceThresholds,
  GovernanceDecision,
  IntegrityIssueRecord,
} from "./AgentHardeningTypes.js";
import { CONFIDENCE_THRESHOLDS } from "./AgentHardeningTypes.js";

// ---------------------------------------------------------------------------
// Confidence evaluator
// ---------------------------------------------------------------------------

export interface ConfidenceEvaluationResult {
  verdict: GovernanceDecision["verdict"];
  reason: string;
  thresholds_used: ConfidenceThresholds;
}

/**
 * Evaluate a confidence score against the declared risk-tier thresholds.
 *
 * Returns the governance verdict and the thresholds that were applied so
 * the decision is fully auditable.
 */
export function evaluateConfidence(
  confidence: ConfidenceBreakdown,
  riskTier: string
): ConfidenceEvaluationResult {
  const thresholds =
    CONFIDENCE_THRESHOLDS[riskTier] ?? CONFIDENCE_THRESHOLDS["discovery"]!;
  const score = confidence.overall;

  if (score >= thresholds.accept) {
    return {
      verdict: "approved",
      reason: `Confidence ${score.toFixed(3)} meets accept threshold ${thresholds.accept} for tier '${riskTier}'.`,
      thresholds_used: thresholds,
    };
  }

  if (score >= thresholds.review) {
    return {
      verdict: "pending_human",
      reason: `Confidence ${score.toFixed(3)} is below accept (${thresholds.accept}) but above review (${thresholds.review}) threshold for tier '${riskTier}'. Routing to human review.`,
      thresholds_used: thresholds,
    };
  }

  return {
    verdict: "vetoed",
    reason: `Confidence ${score.toFixed(3)} is below block threshold ${thresholds.block} for tier '${riskTier}'. Output blocked.`,
    thresholds_used: thresholds,
  };
}

// ---------------------------------------------------------------------------
// IntegrityVeto adapter
// ---------------------------------------------------------------------------

export interface IntegrityVetoInput {
  output: unknown;
  agentName: string;
  agentType: string;
  traceId: string;
  sessionId: string;
  organizationId: string;
}

export interface IntegrityVetoResult {
  vetoed: boolean;
  issues: IntegrityIssueRecord[];
  /** Confidence adjustment applied by the integrity check (negative = penalty). */
  confidence_delta: number;
  /** When true, the agent should re-refine rather than hard-fail. */
  re_refine: boolean;
}

/**
 * Minimal interface for the IntegrityVetoService dependency.
 * Keeps the governance layer decoupled from the concrete service.
 */
export interface IntegrityVetoServicePort {
  evaluateIntegrityVeto(
    payload: unknown,
    options: {
      traceId: string;
      agentType: string;
      query?: string;
      stageId?: string;
    }
  ): Promise<{
    vetoed: boolean;
    metadata?: {
      integrityVeto?: boolean;
      deviationPercent?: number;
      benchmark?: number;
      metricId?: string;
      claimedValue?: number;
      warning?: string;
    };
    reRefine?: boolean;
  }>;
}

/**
 * Run the IntegrityAgent veto check on an agent output.
 *
 * Translates the IntegrityVetoService response into the governance layer's
 * IntegrityVetoResult type so the GovernanceLayer stays decoupled from the
 * concrete service implementation.
 */
export async function runIntegrityVeto(
  input: IntegrityVetoInput,
  service: IntegrityVetoServicePort
): Promise<IntegrityVetoResult> {
  try {
    const result = await service.evaluateIntegrityVeto(input.output, {
      traceId: input.traceId,
      agentType: input.agentType,
      query: `governance-veto:${input.agentName}`,
    });

    if (!result.vetoed) {
      return {
        vetoed: false,
        issues: [],
        confidence_delta: 0,
        re_refine: result.reRefine ?? false,
      };
    }

    const meta = result.metadata;
    const issues: IntegrityIssueRecord[] = [];

    if (meta?.integrityVeto) {
      issues.push({
        type: "data_integrity",
        severity:
          (meta.deviationPercent ?? 0) > 50
            ? "critical"
            : (meta.deviationPercent ?? 0) > 25
              ? "high"
              : "medium",
        description:
          meta.warning ??
          `Metric '${meta.metricId}' deviates ${meta.deviationPercent?.toFixed(1)}% from benchmark ${meta.benchmark}.`,
        field: meta.metricId,
      });
    }

    return {
      vetoed: true,
      issues,
      confidence_delta: -0.2,
      re_refine: false,
    };
  } catch (err) {
    logger.error("IntegrityVeto check failed — failing open", {
      agent: input.agentName,
      trace_id: input.traceId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail open: a broken integrity check should not silently block all outputs.
    // The failure is logged; the caller can decide whether to escalate.
    return {
      vetoed: false,
      issues: [
        {
          type: "data_integrity",
          severity: "low",
          description: "IntegrityVeto service unavailable — check skipped.",
        },
      ],
      confidence_delta: -0.05,
      re_refine: false,
    };
  }
}

// ---------------------------------------------------------------------------
// HITL checkpoint writer
// ---------------------------------------------------------------------------

export interface HITLCheckpointPort {
  createCheckpoint(params: {
    organizationId: string;
    sessionId: string;
    agentName: string;
    reason: string;
    payload: unknown;
    checkpointId: string;
  }): Promise<void>;
}

export interface HITLCheckpointResult {
  checkpoint_id: string;
  queued_at: string;
}

/**
 * Write a human-in-the-loop approval checkpoint.
 *
 * The workflow is paused until the checkpoint is resolved. The checkpoint_id
 * is included in the GovernanceDecision so it can be tracked end-to-end.
 */
export async function createHITLCheckpoint(
  params: {
    organizationId: string;
    sessionId: string;
    agentName: string;
    reason: string;
    output: unknown;
  },
  port: HITLCheckpointPort
): Promise<HITLCheckpointResult> {
  const checkpointId = uuidv4();
  const queuedAt = new Date().toISOString();

  await port.createCheckpoint({
    organizationId: params.organizationId,
    sessionId: params.sessionId,
    agentName: params.agentName,
    reason: params.reason,
    payload: params.output,
    checkpointId,
  });

  logger.info("HITL checkpoint created", {
    checkpoint_id: checkpointId,
    agent: params.agentName,
    organization_id: params.organizationId,
    session_id: params.sessionId,
    reason: params.reason,
  });

  return { checkpoint_id: checkpointId, queued_at: queuedAt };
}

// ---------------------------------------------------------------------------
// GovernanceLayer — orchestrates all three mechanisms
// ---------------------------------------------------------------------------

export interface GovernanceCheckInput {
  output: unknown;
  confidence: ConfidenceBreakdown;
  riskTier: string;
  agentName: string;
  agentType: string;
  traceId: string;
  sessionId: string;
  organizationId: string;
  requiresIntegrityVeto: boolean;
  requiresHumanApproval: boolean;
}

export interface GovernanceCheckResult {
  decision: GovernanceDecision;
  /** Adjusted confidence after integrity check penalties. */
  adjusted_confidence: ConfidenceBreakdown;
  /** True when the output should be released to the caller. */
  release: boolean;
}

export class GovernanceLayer {
  constructor(
    private readonly integrityVetoService: IntegrityVetoServicePort | null,
    private readonly hitlPort: HITLCheckpointPort | null
  ) {}

  async evaluate(input: GovernanceCheckInput): Promise<GovernanceCheckResult> {
    let confidence = { ...input.confidence };
    const issues: IntegrityIssueRecord[] = [];
    let re_refine = false;

    // ── Step 1: IntegrityAgent veto ──────────────────────────────────────
    if (input.requiresIntegrityVeto && this.integrityVetoService) {
      const vetoResult = await runIntegrityVeto(
        {
          output: input.output,
          agentName: input.agentName,
          agentType: input.agentType,
          traceId: input.traceId,
          sessionId: input.sessionId,
          organizationId: input.organizationId,
        },
        this.integrityVetoService
      );

      issues.push(...vetoResult.issues);
      re_refine = vetoResult.re_refine;

      if (vetoResult.vetoed) {
        const decision: GovernanceDecision = {
          verdict: "vetoed",
          decided_by: "IntegrityAgent",
          decided_at: new Date().toISOString(),
          reason: vetoResult.issues[0]?.description ?? "Integrity veto triggered.",
          integrity_issues: vetoResult.issues,
        };
        return { decision, adjusted_confidence: confidence, release: false };
      }

      // Apply confidence penalty from integrity check
      confidence = {
        ...confidence,
        overall: Math.max(0, confidence.overall + vetoResult.confidence_delta),
        integrity_check: vetoResult.issues.length === 0 ? 1.0 : 0.7,
        label: this.scoreToLabel(
          Math.max(0, confidence.overall + vetoResult.confidence_delta)
        ),
      };
    }

    // ── Step 2: Confidence threshold evaluation ──────────────────────────
    const confidenceResult = evaluateConfidence(confidence, input.riskTier);

    if (confidenceResult.verdict === "vetoed") {
      const decision: GovernanceDecision = {
        verdict: "vetoed",
        decided_by: "ConfidenceThresholdPolicy",
        decided_at: new Date().toISOString(),
        reason: confidenceResult.reason,
        integrity_issues: issues.length > 0 ? issues : undefined,
      };
      return { decision, adjusted_confidence: confidence, release: false };
    }

    // ── Step 3: Human-in-the-loop ────────────────────────────────────────
    const needsHuman =
      input.requiresHumanApproval ||
      confidenceResult.verdict === "pending_human" ||
      re_refine;

    if (needsHuman && this.hitlPort) {
      const reason =
        input.requiresHumanApproval
          ? "Agent declared requiresHumanApproval=true."
          : re_refine
            ? "IntegrityAgent requested re-refinement — routing to human review."
            : confidenceResult.reason;

      const checkpoint = await createHITLCheckpoint(
        {
          organizationId: input.organizationId,
          sessionId: input.sessionId,
          agentName: input.agentName,
          reason,
          output: input.output,
        },
        this.hitlPort
      );

      const decision: GovernanceDecision = {
        verdict: "pending_human",
        decided_by: "GovernanceLayer",
        decided_at: new Date().toISOString(),
        reason,
        integrity_issues: issues.length > 0 ? issues : undefined,
        approval_checkpoint_id: checkpoint.checkpoint_id,
      };
      return { decision, adjusted_confidence: confidence, release: false };
    }

    // ── Approved ─────────────────────────────────────────────────────────
    const decision: GovernanceDecision = {
      verdict: "approved",
      decided_by: "GovernanceLayer",
      decided_at: new Date().toISOString(),
      reason: confidenceResult.reason,
      integrity_issues: issues.length > 0 ? issues : undefined,
    };
    return { decision, adjusted_confidence: confidence, release: true };
  }

  private scoreToLabel(score: number): ConfidenceBreakdown["label"] {
    if (score >= 0.85) return "very_high";
    if (score >= 0.70) return "high";
    if (score >= 0.50) return "medium";
    if (score >= 0.30) return "low";
    return "very_low";
  }
}
