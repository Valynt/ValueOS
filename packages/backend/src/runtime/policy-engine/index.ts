/**
 * PolicyEngine
 *
 * Pre-checks safety, data integrity, compliance rules, and HITL requirements
 * before agent execution.
 *
 * Owns three enforcement paths:
 *  1. Tenant guard — blocks execution when the tenant is paused
 *  2. Autonomy guardrails — kill switch, duration/cost limits, approval gates,
 *     per-agent level/kill-switch/iteration checks
 *  3. Compliance evidence collection — appends an audit record on demand
 *
 * Sprint 5: Added checkHITL() — HITL gating based on DecisionContext.
 *   HITL-01: If opportunity.confidenceScore < 0.6 AND the action involves an
 *   external-facing artifact, require human approval before proceeding.
 */

import { SupabaseClient } from "@supabase/supabase-js";

import { getAutonomyConfig } from "../../config/autonomy.js";
import { logger } from "../../lib/logger.js";
import { AgentRegistry } from "../../services/agents/AgentRegistry.js";
import { complianceEvidenceService } from "../../services/ComplianceEvidenceService.js";
import { securityLogger } from "@valueos/core-services";
import { TenantExecutionStateService } from "../../services/billing/TenantExecutionStateService.js";
import {
  DefaultIntegrityVetoService,
  type IntegrityCheckOptions,
} from "../../services/workflows/IntegrityVetoService.js";
import { WorkflowStageContextDTO } from "../../types/workflow/runner.js";
import { DecisionContext } from "@shared/domain/DecisionContext.js";

// ============================================================================
// Types — autonomy guardrails
// ============================================================================

/**
 * Extended autonomy config shape used by the guardrail checks.
 * The base AutonomyConfig from config/autonomy.ts only carries the fields
 * defined there; the orchestrator casts to this wider type at runtime.
 */
export interface GuardrailAutonomyConfig {
  killSwitchEnabled?: boolean;
  maxDurationMs?: number;
  maxCostUsd?: number;
  requireApprovalForDestructive?: boolean;
  agentAutonomyLevels?: Record<string, string>;
  agentKillSwitches?: Record<string, boolean>;
  agentMaxIterations?: Record<string, number>;
}

export interface ServiceReadiness {
  message_broker_ready: boolean;
  queue_ready: boolean;
  memory_backend_ready: boolean;
  llm_gateway_ready: boolean;
  circuit_breaker_ready: boolean;
}

export interface PolicyEngineOptions {
  supabase: SupabaseClient;
  registry: AgentRegistry;
  /** Pre-built readiness snapshot from the caller (avoids coupling PolicyEngine to concrete service types). */
  serviceReadiness: () => ServiceReadiness;
  /** Optional override for testing — skips internal construction. */
  executionStateService?: Pick<TenantExecutionStateService, "getActiveState">;
  /** Optional override for testing. */
  integrityVetoService?: Pick<DefaultIntegrityVetoService, "evaluateIntegrityVeto">;
}

// ============================================================================
// Types — HITL (Sprint 5)
// ============================================================================

/**
 * Point-in-time health state of the services PolicyEngine depends on.
 *
 * Passed as a single value object rather than individual boolean parameters
 * so the method signature stays stable as new services are added. Callers
 * assemble this from their own health checks; PolicyEngine does not own or
 * query those services directly.
 *
 * @deprecated Use ServiceReadiness (snake_case) for new callers. This
 * camelCase variant is retained for the Sprint 5 HITL path until ContextStore
 * unifies the two.
 */
export interface ServiceHealthSnapshot {
  messageBrokerReady: boolean;
  queueReady: boolean;
  memoryBackendReady: boolean;
  llmGatewayReady: boolean;
  circuitBreakerReady: boolean;
}

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

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Minimum confidence score required to proceed with an external-facing
 * artifact action without human approval.
 *
 * Sprint 5.5 requirement: trigger HITL if confidenceScore < 0.6.
 */
export const HITL_CONFIDENCE_THRESHOLD = 0.6;

// ============================================================================
// PolicyEngine
// ============================================================================

export class PolicyEngine {
  private readonly executionStateService: Pick<TenantExecutionStateService, "getActiveState">;
  private readonly registry: AgentRegistry;
  private readonly serviceReadiness: () => ServiceReadiness;
  private readonly integrityVetoService: Pick<DefaultIntegrityVetoService, "evaluateIntegrityVeto"> | null;

  constructor(options: PolicyEngineOptions) {
    this.executionStateService =
      options.executionStateService ?? new TenantExecutionStateService(options.supabase);
    this.registry = options.registry;
    this.serviceReadiness = options.serviceReadiness;
    this.integrityVetoService = options.integrityVetoService ?? null;
  }

  // --------------------------------------------------------------------------
  // 1. Tenant guard
  // --------------------------------------------------------------------------

  /**
   * Throws if the tenant's execution is paused.
   * Must be called before any agent work begins.
   */
  async assertTenantExecutionAllowed(organizationId: string): Promise<void> {
    const state = await this.executionStateService.getActiveState(organizationId);
    if (!state?.is_paused) {
      return;
    }

    const pausedAt = state.paused_at ?? "unknown";
    const reason = state.reason ?? "No reason provided";
    throw new Error(
      `Tenant execution is paused for organization ${organizationId}. reason=${reason}; paused_at=${pausedAt}`,
    );
  }

  // --------------------------------------------------------------------------
  // 2. Autonomy guardrails
  // --------------------------------------------------------------------------

  /**
   * Enforces all autonomy guardrails for a single stage execution.
   * Throws on any violation; callers should treat the thrown error as fatal
   * for the current execution and call handleWorkflowFailure before re-throwing.
   */
  async enforceAutonomyGuardrails(
    executionId: string,
    stageId: string,
    context: WorkflowStageContextDTO,
    startTime: number,
    onFailure: (executionId: string, organizationId: string, reason: string) => Promise<void>,
  ): Promise<void> {
    const autonomy = getAutonomyConfig() as ReturnType<typeof getAutonomyConfig> &
      GuardrailAutonomyConfig;

    const orgId = context.organizationId || context.organization_id || "";

    // Kill switch
    if (autonomy.killSwitchEnabled) {
      securityLogger.log({
        category: "autonomy",
        action: "kill_switch_activated",
        severity: "error",
        metadata: { executionId, stageId, reason: "Global autonomy kill switch is enabled" },
      });
      throw new Error("Autonomy kill switch is enabled");
    }

    // Duration limit
    const elapsed = Date.now() - startTime;
    if (autonomy.maxDurationMs && elapsed > autonomy.maxDurationMs) {
      await onFailure(executionId, orgId, "Autonomy guard: max duration exceeded");
      securityLogger.log({
        category: "autonomy",
        action: "duration_limit_exceeded",
        severity: "error",
        metadata: { executionId, stageId, elapsedMs: elapsed, limitMs: autonomy.maxDurationMs },
      });
      throw new Error("Autonomy guard: max duration exceeded");
    }

    // Cost limit
    const cost = (context.cost_accumulated_usd as number | undefined) ?? 0;
    if (autonomy.maxCostUsd && cost > autonomy.maxCostUsd) {
      await onFailure(executionId, orgId, "Autonomy guard: max cost exceeded");
      securityLogger.log({
        category: "autonomy",
        action: "cost_limit_exceeded",
        severity: "error",
        metadata: { executionId, stageId, costUsd: cost, limitUsd: autonomy.maxCostUsd },
      });
      throw new Error("Autonomy guard: max cost exceeded");
    }

    // Destructive action approval
    if (autonomy.requireApprovalForDestructive) {
      const approvalState = (context.approvals ?? {}) as Record<string, unknown>;
      const destructivePending = context.destructive_actions_pending as string[] | undefined;
      if (destructivePending && destructivePending.length > 0 && !approvalState[executionId]) {
        await onFailure(executionId, orgId, "Approval required for destructive actions");
        securityLogger.log({
          category: "autonomy",
          action: "destructive_action_unapproved",
          severity: "error",
          metadata: { executionId, stageId, destructiveActions: destructivePending, requiresApproval: true },
        });
        throw new Error("Approval required for destructive actions");
      }
    }

    // Per-agent autonomy level
    const agentLevels: Record<string, string> = autonomy.agentAutonomyLevels || {};
    const stageAgentId = context.current_agent_id as string | undefined;
    const level = stageAgentId ? agentLevels[stageAgentId] : undefined;
    if (level === "observe") {
      await onFailure(executionId, orgId, `Agent ${stageAgentId} restricted to observe-only`);
      securityLogger.log({
        category: "autonomy",
        action: "agent_autonomy_violation",
        severity: "error",
        metadata: { executionId, stageId, agentId: stageAgentId, autonomyLevel: level, violation: "observe-only agent attempted action" },
      });
      throw new Error("Autonomy guard: observe-only agent attempted action");
    }

    // Per-agent kill switch
    const agentKillSwitches: Record<string, boolean> = autonomy.agentKillSwitches || {};
    if (stageAgentId && agentKillSwitches[stageAgentId]) {
      await onFailure(executionId, orgId, `Agent ${stageAgentId} is disabled by kill switch`);
      securityLogger.log({
        category: "autonomy",
        action: "agent_kill_switch_activated",
        severity: "error",
        metadata: { executionId, stageId, agentId: stageAgentId, killSwitchEnabled: true },
      });
      throw new Error("Autonomy guard: agent disabled");
    }

    // Per-agent iteration limit
    const agentMaxIterations: Record<string, number> = autonomy.agentMaxIterations || {};
    const maxIterations = stageAgentId ? agentMaxIterations[stageAgentId] : undefined;
    if (maxIterations !== undefined) {
      const executedSteps = (context.executed_steps as { agent_id?: string }[] | undefined) ?? [];
      const executed = executedSteps.filter((s) => s.agent_id === stageAgentId).length;
      if (executed >= maxIterations) {
        await onFailure(executionId, orgId, `Agent ${stageAgentId} exceeded iteration limit`);
        securityLogger.log({
          category: "autonomy",
          action: "iteration_limit_exceeded",
          severity: "error",
          metadata: { executionId, stageId, agentId: stageAgentId, iterationsExecuted: executed, maxIterations },
        });
        throw new Error("Autonomy guard: iteration limit exceeded");
      }
    }

    logger.debug("Autonomy guardrails passed", { executionId, stageId });
  }

  // --------------------------------------------------------------------------
  // 3. Compliance evidence
  // --------------------------------------------------------------------------

  /**
   * Appends a compliance evidence record for the tenant.
   * Collects agent registry health and service readiness from the caller-supplied
   * snapshot function rather than accepting raw boolean flags.
   */
  async collectComplianceEvidence(
    tenantId: string,
    triggerType: "scheduled" | "event",
    triggerSource: string,
  ): Promise<void> {
    if (!tenantId) {
      throw new Error("tenantId is required for compliance evidence collection");
    }

    const lifecycleAgents = [
      "opportunity-agent",
      "target-agent",
      "financial-modeling-agent",
      "integrity-agent",
      "realization-agent",
      "expansion-agent",
      "compliance-auditor-agent",
    ];

    const agentEvidence = lifecycleAgents.map((agentId) => {
      const record = this.registry.getAgent(agentId);
      return {
        agent_id: agentId,
        status: record?.status ?? "unknown",
        load: record?.load ?? null,
        last_heartbeat: record?.last_heartbeat ?? null,
      };
    });

    const serviceEvidence = this.serviceReadiness();

    await complianceEvidenceService.appendEvidence({
      tenantId,
      actorPrincipal: "policy-engine",
      actorType: "service",
      triggerType,
      triggerSource,
      evidence: {
        tenant_id: tenantId,
        collected_at: new Date().toISOString(),
        agent_evidence: agentEvidence,
        service_evidence: serviceEvidence,
      },
    });
  }

   // --------------------------------------------------------------------------
  // 4. Integrity veto delegation
  // --------------------------------------------------------------------------

  /**
   * Delegates to the injected IntegrityVetoService.
   * Returns no-veto when no service was provided (e.g. in lightweight test setups).
   */
  async evaluateIntegrityVeto(
    payload: unknown,
    options: IntegrityCheckOptions,
  ): Promise<{ vetoed: boolean; metadata?: unknown; reRefine?: boolean }> {
    if (!this.integrityVetoService) {
      return { vetoed: false };
    }
    return this.integrityVetoService.evaluateIntegrityVeto(payload, options);
  }

  // --------------------------------------------------------------------------
  // 5. HITL gating (Sprint 5)
  // --------------------------------------------------------------------------

  /**
   * Check whether the action described by the DecisionContext requires
   * human approval before proceeding.
   *
   * Implements HITL-01: External artifact actions with low opportunity
   * confidence require human approval.
   *
   * Returns `allowed: true` when no policy blocks the action.
   */
  checkHITL(context: DecisionContext): PolicyCheckResult {
    const opportunityConfidence = context.opportunity?.confidence_score;
    const isExternalArtifact = context.is_external_artifact_action;
    const lifecycleStage = context.opportunity?.lifecycle_stage;

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
          rule_id: "HITL-01",
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
        rule_id: "HITL-01",
        confidence_score: opportunityConfidence,
        is_external_artifact_action: isExternalArtifact,
        lifecycle_stage: lifecycleStage,
      },
    };
  }
}