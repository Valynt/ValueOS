/**
 * PolicyEngine
 *
 * Pre-checks safety, data integrity, compliance rules, and HITL requirements
 * before agent execution. Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Owns:
 *  - Tenant execution guard (pause state)
 *  - Autonomy guardrails (kill switch, duration, cost, iteration limits)
 *  - Integrity veto delegation (structural truth + ground-truth benchmarks)
 *  - Compliance evidence collection
 */

import { supabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { getAutonomyConfig } from '../../config/autonomy.js';
import { securityLogger } from '../../services/SecurityLogger.js';
import { complianceEvidenceService } from '../../services/ComplianceEvidenceService.js';
import { TenantExecutionStateService } from '../../services/billing/TenantExecutionStateService.js';
import {
  DefaultIntegrityVetoService,
  type IntegrityCheckOptions,
} from '../../services/workflows/IntegrityVetoService.js';
import { logAgentResponse } from '../../services/AgentAuditLogger.js';
import { GroundTruthIntegrationService } from '../../services/GroundTruthIntegrationService.js';
import { ConfidenceMonitor } from '../../services/ConfidenceMonitor.js';
import { CircuitBreakerManager } from '../../services/CircuitBreaker.js';
import { AgentRegistry } from '../../services/AgentRegistry.js';
import { getAgentAPI } from '../../services/AgentAPI.js';
import type { AgentContext } from '../../services/AgentAPI.js';
import type { AgentType } from '../../services/agent-types.js';
import type { WorkflowStageContextDTO } from '../../types/workflow/runner.js';
import type { IntegrityVetoMetadata } from '../../services/UnifiedAgentOrchestrator.js';

export type { IntegrityCheckOptions };
export type { IntegrityVetoMetadata };

/** Point-in-time health snapshot of services the PolicyEngine does not own. */
export interface ServiceHealthSnapshot {
  messageBrokerReady: boolean;
  queueReady: boolean;
  memoryBackendReady: boolean;
  llmGatewayReady: boolean;
  circuitBreakerReady: boolean;
}

// ============================================================================
// PolicyEngine
// ============================================================================

export interface PolicyEngineConfig {
  defaultTimeoutMs: number;
  maxReRefineAttempts: number;
}

const DEFAULT_CONFIG: PolicyEngineConfig = {
  defaultTimeoutMs: 30_000,
  maxReRefineAttempts: 2,
};

export class PolicyEngine {
  private readonly executionStateService: TenantExecutionStateService;
  private readonly integrityVetoService: DefaultIntegrityVetoService;
  private readonly groundTruthService = GroundTruthIntegrationService.getInstance();
  private readonly confidenceMonitor: ConfidenceMonitor;
  // Stored Promise prevents double-initialization under concurrent callers.
  private groundTruthInitPromise: Promise<void> | null = null;

  constructor(
    private readonly config: PolicyEngineConfig = DEFAULT_CONFIG,
    private readonly circuitBreakers: CircuitBreakerManager = new CircuitBreakerManager(),
    private readonly registry: AgentRegistry = new AgentRegistry(),
  ) {
    // Capture once; used consistently throughout the instance lifetime.
    const agentAPI = getAgentAPI();
    this.executionStateService = new TenantExecutionStateService(supabase);
    this.confidenceMonitor = new ConfidenceMonitor(supabase);

    this.integrityVetoService = new DefaultIntegrityVetoService({
      agentAPI,
      evaluateClaim: async (metricId, claimedValue, options) => {
        await this.ensureGroundTruthInitialized();
        const [validation, metricValue] = await Promise.all([
          this.groundTruthService.validateClaim(metricId, claimedValue),
          this.groundTruthService.getBenchmark(metricId, 'p50'),
        ]);
        return {
          benchmarkValue: (metricValue as { value?: number }).value ?? (validation as { benchmark?: { p50?: number } }).benchmark?.p50,
          warning: (validation as { warning?: string }).warning,
        };
      },
      getAverageConfidence: async (agentType) =>
        (await this.confidenceMonitor.getMetrics(agentType, 'hour')).avgConfidenceScore,
      logVeto: async (agentType, query, payload, options, metadata) => {
        await logAgentResponse(
          agentType,
          query,
          false,
          payload,
          { traceId: options.traceId, stageId: options.stageId, integrityVeto: metadata },
          'integrity_veto',
          options.context,
        );
      },
      invokeRefinement: async (agentType, prompt, context, attempt) => {
        const key = `query-${agentType}-refine-${attempt}`;
        const result = await this.circuitBreakers.execute(
          key,
          () => agentAPI.invokeAgent({ agent: agentType, query: prompt, context }),
          { timeoutMs: this.config.defaultTimeoutMs },
        );
        return { success: Boolean(result?.success), data: result?.data };
      },
      maxReRefineAttempts: this.config.maxReRefineAttempts,
    });
  }

  // --------------------------------------------------------------------------
  // Tenant guard
  // --------------------------------------------------------------------------

  async assertTenantExecutionAllowed(organizationId: string): Promise<void> {
    const state = await this.executionStateService.getActiveState(organizationId);
    if (!state?.is_paused) return;

    const pausedAt = state.paused_at ?? 'unknown';
    const reason = state.reason ?? 'No reason provided';
    throw new Error(
      `Tenant execution is paused for organization ${organizationId}. reason=${reason}; paused_at=${pausedAt}`,
    );
  }

  // --------------------------------------------------------------------------
  // Autonomy guardrails
  // --------------------------------------------------------------------------

  async checkAutonomyGuardrails(
    executionId: string,
    stageId: string,
    context: WorkflowStageContextDTO,
    startTime: number,
  ): Promise<void> {
    const autonomy = getAutonomyConfig() as ReturnType<typeof getAutonomyConfig> & {
      killSwitchEnabled?: boolean;
      maxDurationMs?: number;
      maxCostUsd?: number;
      requireApprovalForDestructive?: boolean;
      agentAutonomyLevels?: Record<string, string>;
      agentKillSwitches?: Record<string, boolean>;
      agentMaxIterations?: Record<string, number>;
    };

    if (autonomy.killSwitchEnabled) {
      securityLogger.log({
        category: 'autonomy',
        action: 'kill_switch_activated',
        severity: 'error',
        metadata: { executionId, stageId, reason: 'Global autonomy kill switch is enabled' },
      });
      throw new Error('Autonomy kill switch is enabled');
    }

    const elapsed = Date.now() - startTime;
    if (autonomy.maxDurationMs && elapsed > autonomy.maxDurationMs) {
      securityLogger.log({
        category: 'autonomy',
        action: 'duration_limit_exceeded',
        severity: 'error',
        metadata: { executionId, stageId, elapsedMs: elapsed, limitMs: autonomy.maxDurationMs },
      });
      throw new Error('Autonomy guard: max duration exceeded');
    }

    const cost = (context as Record<string, unknown>).cost_accumulated_usd as number | undefined ?? 0;
    if (autonomy.maxCostUsd && cost > autonomy.maxCostUsd) {
      securityLogger.log({
        category: 'autonomy',
        action: 'cost_limit_exceeded',
        severity: 'error',
        metadata: { executionId, stageId, costUsd: cost, limitUsd: autonomy.maxCostUsd },
      });
      throw new Error('Autonomy guard: max cost exceeded');
    }

    if (autonomy.requireApprovalForDestructive) {
      const approvalState = (context as Record<string, unknown>).approvals as Record<string, unknown> ?? {};
      const destructivePending = (context as Record<string, unknown>).destructive_actions_pending as string[] | undefined;
      if (destructivePending && destructivePending.length > 0 && !approvalState[executionId]) {
        securityLogger.log({
          category: 'autonomy',
          action: 'destructive_action_unapproved',
          severity: 'error',
          metadata: { executionId, stageId, destructiveActions: destructivePending, requiresApproval: true },
        });
        throw new Error('Approval required for destructive actions');
      }
    }

    const agentLevels = autonomy.agentAutonomyLevels ?? {};
    const stageAgentId = (context as Record<string, unknown>).current_agent_id as string | undefined;
    const level = stageAgentId ? agentLevels[stageAgentId] : undefined;
    if (level === 'observe') {
      securityLogger.log({
        category: 'autonomy',
        action: 'agent_autonomy_violation',
        severity: 'error',
        metadata: { executionId, stageId, agentId: stageAgentId, autonomyLevel: level, violation: 'observe-only agent attempted action' },
      });
      throw new Error('Autonomy guard: observe-only agent attempted action');
    }

    const agentKillSwitches = autonomy.agentKillSwitches ?? {};
    if (stageAgentId && agentKillSwitches[stageAgentId]) {
      securityLogger.log({
        category: 'autonomy',
        action: 'agent_kill_switch_activated',
        severity: 'error',
        metadata: { executionId, stageId, agentId: stageAgentId, killSwitchEnabled: true },
      });
      throw new Error('Autonomy guard: agent disabled');
    }

    const agentMaxIterations = autonomy.agentMaxIterations ?? {};
    const maxIterations = stageAgentId ? agentMaxIterations[stageAgentId] : undefined;
    if (maxIterations !== undefined) {
      const executed = ((context as Record<string, unknown>).executed_steps as Array<{ agent_id?: string }> ?? [])
        .filter((s) => s.agent_id === stageAgentId).length;
      if (executed >= maxIterations) {
        securityLogger.log({
          category: 'autonomy',
          action: 'iteration_limit_exceeded',
          severity: 'error',
          metadata: { executionId, stageId, agentId: stageAgentId, iterationsExecuted: executed, maxIterations },
        });
        throw new Error('Autonomy guard: iteration limit exceeded');
      }
    }

    logger.debug('Autonomy guardrails passed', { executionId, stageId });
  }

  // --------------------------------------------------------------------------
  // Integrity veto
  // --------------------------------------------------------------------------

  async evaluateIntegrityVeto(
    payload: unknown,
    options: IntegrityCheckOptions,
  ): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata; reRefine?: boolean }> {
    return this.integrityVetoService.evaluateIntegrityVeto(payload, options);
  }

  async evaluateStructuralTruthVeto(
    payload: unknown,
    options: IntegrityCheckOptions,
  ): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata }> {
    return this.integrityVetoService.evaluateStructuralTruthVeto(payload, options);
  }

  async performReRefine(
    agentType: AgentType,
    originalQuery: string,
    agentContext: AgentContext,
    traceId: string,
    maxAttempts?: number,
  ): Promise<{ success: boolean; response?: unknown; attempts: number }> {
    return this.integrityVetoService.performReRefine(agentType, originalQuery, agentContext, traceId, maxAttempts);
  }

  // --------------------------------------------------------------------------
  // Compliance evidence
  // --------------------------------------------------------------------------

  async collectComplianceEvidence(
    tenantId: string,
    triggerType: 'scheduled' | 'event',
    triggerSource: string,
    serviceHealth: ServiceHealthSnapshot,
  ): Promise<void> {
    if (!tenantId) throw new Error('tenantId is required for compliance evidence collection');

    const lifecycleAgents = [
      'opportunity-agent',
      'target-agent',
      'financial-modeling-agent',
      'integrity-agent',
      'realization-agent',
      'expansion-agent',
      'compliance-auditor-agent',
    ];

    const agentEvidence = lifecycleAgents.map((agentId) => {
      const record = this.registry.getAgent(agentId);
      return {
        agent_id: agentId,
        status: record?.status ?? 'unknown',
        load: record?.load ?? null,
        last_heartbeat: record?.last_heartbeat ?? null,
      };
    });

    await complianceEvidenceService.appendEvidence({
      tenantId,
      actorPrincipal: 'orchestrator-facade',
      actorType: 'service',
      triggerType,
      triggerSource,
      evidence: {
        tenant_id: tenantId,
        collected_at: new Date().toISOString(),
        agent_evidence: agentEvidence,
        service_evidence: {
          message_broker_ready: serviceHealth.messageBrokerReady,
          queue_ready: serviceHealth.queueReady,
          memory_backend_ready: serviceHealth.memoryBackendReady,
          llm_gateway_ready: serviceHealth.llmGatewayReady,
          circuit_breaker_ready: serviceHealth.circuitBreakerReady,
        },
      },
    });
  }

  // --------------------------------------------------------------------------
  // Internal helpers
  // --------------------------------------------------------------------------

  private ensureGroundTruthInitialized(): Promise<void> {
    this.groundTruthInitPromise ??= this.groundTruthService.initialize();
    return this.groundTruthInitPromise;
  }
}

// Singleton
export const policyEngine = new PolicyEngine();
