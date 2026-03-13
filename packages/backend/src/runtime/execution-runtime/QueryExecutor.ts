/**
 * QueryExecutor
 *
 * Handles the synchronous and asynchronous query execution paths extracted
 * from UnifiedAgentOrchestrator.processQuery / processQueryAsync /
 * getAsyncQueryResult in Sprint 4.
 */

import { v4 as uuidv4 } from 'uuid';
import { Span, SpanStatusCode } from '@opentelemetry/api';

import { getTracer } from '../../config/telemetry.js';
import { featureFlags } from '../../config/featureFlags.js';
import { logger } from '../../lib/logger.js';
import { CircuitBreakerManager } from '../../services/CircuitBreaker.js';
import { AgentMessageQueue } from '../../services/agents/AgentMessageQueue.js';
import type { AgentType } from '../../services/agent-types.js';
import { createAgentFactory } from '../../lib/agent-fabric/AgentFactory.js';
import { LLMGateway } from '../../lib/agent-fabric/LLMGateway.js';
import { MemorySystem } from '../../lib/agent-fabric/MemorySystem.js';
import { SupabaseMemoryBackend } from '../../lib/agent-fabric/SupabaseMemoryBackend.js';
import { CircuitBreaker } from '../../lib/resilience/CircuitBreaker.js';
import type { LifecycleContext } from '../../types/agent.js';

// AgentContext shape used for direct factory invocation (ADR-0014)
interface AgentContext {
  userId: string;
  sessionId: string;
  organizationId: string;
  metadata?: Record<string, unknown>;
}
import type { WorkflowState } from '../../repositories/WorkflowStateRepository.js';
import type { AgentResponse, ExecutionEnvelope, ProcessQueryResult } from '../../types/orchestration.js';
import type { PolicyEngine } from '../policy-engine/index.js';
import type { DecisionRouter } from '../decision-router/index.js';
import { DecisionContextSchema, type DecisionContext } from '@shared/domain/DecisionContext.js';
import { OpportunityLifecycleStageSchema } from '@shared/domain/Opportunity.js';
import {
  SupabaseDecisionContextRepository,
  type DecisionContextRepository,
  type DecisionContextSnapshot,
} from './DecisionContextRepository.js';

// ============================================================================
// QueryExecutor
// ============================================================================

export interface QueryExecutorConfig {
  defaultTimeoutMs: number;
  maxAgentInvocationsPerMinute: number;
}

const DEFAULT_CONFIG: QueryExecutorConfig = {
  defaultTimeoutMs: 30_000,
  maxAgentInvocationsPerMinute: 20,
};

export class QueryExecutor {
  private readonly agentInvocationTimes = new Map<string, number[]>();

  /**
   * Lazy singleton factory — created on first agent invocation.
   * ADR-0014: server-side orchestration calls AgentFactory directly;
   * AgentAPI (HTTP client) is for external/frontend callers only.
   */
  private _factory: ReturnType<typeof createAgentFactory> | null = null;
  private getFactory(): ReturnType<typeof createAgentFactory> {
    if (!this._factory) {
      this._factory = createAgentFactory({
        llmGateway: new LLMGateway({ provider: 'together', model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo' }),
        memorySystem: new MemorySystem({ max_memories: 1000, enable_persistence: true }, new SupabaseMemoryBackend()),
        circuitBreaker: new CircuitBreaker(),
      });
    }
    return this._factory;
  }

  constructor(
    private readonly policy: PolicyEngine,
    private readonly router: DecisionRouter,
    private readonly circuitBreakers: CircuitBreakerManager,
    private readonly agentMessageQueue: AgentMessageQueue,
    private readonly config: QueryExecutorConfig = DEFAULT_CONFIG,
    private readonly decisionContextRepository: DecisionContextRepository = new SupabaseDecisionContextRepository(),
  ) {}

  // --------------------------------------------------------------------------
  // DecisionContext assembly
  // --------------------------------------------------------------------------

  /**
   * Build a DecisionContext from the available WorkflowState and
   * ExecutionEnvelope. WorkflowState carries a flat `currentStage` string;
   * we map it to the canonical OpportunityLifecycleStage enum, defaulting to
   * 'discovery' when the value is absent or unrecognised.
   *
   * Full hydration from domain repositories (Opportunity, ValueHypothesis,
   * BusinessCase) is deferred to the ContextStore Sprint 5 target. Until
   * then, only the fields derivable from WorkflowState are populated.
   */
  private async buildDecisionContext(
    state: WorkflowState,
    organizationId: string,
  ): Promise<{ context: DecisionContext; diagnostics: string[]; mode: 'full' | 'downgraded' | 'rejected' }> {
    const rawStage = state.currentStage ?? state.lifecycle_stage ?? 'discovery';
    const stageParseResult = OpportunityLifecycleStageSchema.safeParse(rawStage);
    const lifecycle_stage = stageParseResult.success ? stageParseResult.data : 'discovery';

    const opportunityId = state.context?.opportunityId ?? state.context?.opportunity_id;
    const diagnostics: string[] = [];

    if (!opportunityId) {
      diagnostics.push('Missing required context field: opportunity_id');
      return {
        context: {
          organization_id: organizationId,
          is_external_artifact_action: false,
        },
        diagnostics,
        mode: 'rejected',
      };
    }

    let snapshot: DecisionContextSnapshot;
    try {
      snapshot = await this.decisionContextRepository.getSnapshot(String(opportunityId), organizationId);
    } catch (error) {
      diagnostics.push(`Failed to hydrate decision context: ${error instanceof Error ? error.message : String(error)}`);
      return {
        context: {
          organization_id: organizationId,
          is_external_artifact_action: false,
        },
        diagnostics,
        mode: 'downgraded',
      };
    }

    const context: DecisionContext = {
      organization_id: organizationId,
      opportunity: snapshot.opportunity
        ? {
            id: snapshot.opportunity.id,
            lifecycle_stage: (OpportunityLifecycleStageSchema.safeParse(snapshot.opportunity.lifecycle_stage).success
              ? snapshot.opportunity.lifecycle_stage
              : lifecycle_stage) as NonNullable<DecisionContext['opportunity']>['lifecycle_stage'],
            confidence_score: snapshot.opportunity.confidence_score ?? 0,
            value_maturity: snapshot.opportunity.value_maturity ?? 'low',
          }
        : undefined,
      hypothesis: snapshot.hypothesis
        ? {
            id: snapshot.hypothesis.id,
            confidence: snapshot.hypothesis.confidence ?? 'low',
            confidence_score: snapshot.hypothesis.confidence_score,
            evidence_count: snapshot.hypothesis.evidence_count ?? 0,
            best_evidence_tier: snapshot.hypothesis.best_evidence_tier,
          }
        : undefined,
      business_case: snapshot.businessCase
        ? {
            id: snapshot.businessCase.id,
            status: snapshot.businessCase.status ?? 'draft',
            assumptions_reviewed: snapshot.businessCase.assumptions_reviewed ?? false,
          }
        : undefined,
      is_external_artifact_action: false,
    };

    if (!snapshot.opportunity) {
      diagnostics.push('Missing required context field: opportunity');
    } else {
      if (snapshot.opportunity.lifecycle_stage === undefined) diagnostics.push('Missing required context field: opportunity.lifecycle_stage');
      if (snapshot.opportunity.confidence_score === undefined) diagnostics.push('Missing required context field: opportunity.confidence_score');
      if (snapshot.opportunity.value_maturity === undefined) diagnostics.push('Missing required context field: opportunity.value_maturity');
    }

    const schemaResult = DecisionContextSchema.safeParse(context);
    if (!schemaResult.success) {
      for (const issue of schemaResult.error.issues) {
        diagnostics.push(`DecisionContext schema validation failed at ${issue.path.join('.') || 'root'}: ${issue.message}`);
      }
    }

    if (diagnostics.length > 0) {
      return {
        context: {
          organization_id: organizationId,
          is_external_artifact_action: false,
        },
        diagnostics,
        mode: 'downgraded',
      };
    }

    return { context, diagnostics, mode: 'full' };
  }

  // --------------------------------------------------------------------------
  // Rate limiting
  // --------------------------------------------------------------------------

  checkAgentRateLimit(agentType: AgentType): boolean {
    const now = Date.now();
    const windowMs = 60_000;
    const times = this.agentInvocationTimes.get(agentType) ?? [];
    const valid = times.filter((t) => now - t < windowMs);

    if (valid.length >= this.config.maxAgentInvocationsPerMinute) {
      logger.warn('Agent rate limit exceeded', {
        agentType,
        invocationCount: valid.length,
        limit: this.config.maxAgentInvocationsPerMinute,
      });
      // Persist the already-filtered array (may be empty if the window expired);
      // delete the entry entirely when empty to prevent unbounded map growth.
      if (valid.length > 0) {
        this.agentInvocationTimes.set(agentType, valid);
      } else {
        this.agentInvocationTimes.delete(agentType);
      }
      return false;
    }

    valid.push(now);
    this.agentInvocationTimes.set(agentType, valid);
    return true;
  }

  // --------------------------------------------------------------------------
  // Async query path
  // --------------------------------------------------------------------------

  async processQueryAsync(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4(),
  ): Promise<{ jobId: string; traceId: string }> {
    if (
      currentState.context?.organizationId &&
      currentState.context.organizationId !== envelope.organizationId
    ) {
      throw new Error('Execution envelope organization does not match workflow state');
    }

    await this.policy.assertTenantExecutionAllowed(envelope.organizationId);

    logger.info('Processing query asynchronously', {
      traceId, sessionId, userId,
      currentStage: currentState.currentStage,
      queryLength: query.length,
    });

    const decisionContextResult = await this.buildDecisionContext(currentState, envelope.organizationId);
    if (decisionContextResult.mode === 'rejected') {
      logger.warn('Rejecting automation due to missing routing context', {
        organizationId: envelope.organizationId,
        diagnostics: decisionContextResult.diagnostics,
      });
      throw new Error(`Cannot route automatically: ${decisionContextResult.diagnostics.join('; ')}`);
    }
    const agentType = decisionContextResult.mode === 'downgraded'
      ? 'coordinator'
      : this.router.selectAgent(decisionContextResult.context);

    if (!this.checkAgentRateLimit(agentType)) {
      throw new Error(`Agent ${agentType} rate limit exceeded`);
    }

    const agentContext: AgentContext = {
      userId: envelope.actor.id || userId,
      sessionId,
      organizationId: envelope.organizationId,
      metadata: {
        companyProfile: currentState.context?.companyProfile,
        currentStage: currentState.currentStage,
      },
    };

    const jobId = await this.agentMessageQueue.queueAgentInvocation({
      agent: agentType,
      query,
      context: agentContext,
      sessionId,
      organizationId: envelope.organizationId,
      userId,
      traceId,
      correlationId: traceId,
    });

    logger.info('Agent invocation queued asynchronously', { jobId, traceId, agentType, sessionId });
    return { jobId, traceId };
  }

  async getAsyncQueryResult(
    jobId: string,
    currentState: WorkflowState,
  ): Promise<ProcessQueryResult | null> {
    const result = await this.agentMessageQueue.getJobResult(jobId);
    if (!result) return null;

    if (!result.success) {
      logger.error('Async agent invocation failed', { jobId, error: result.error, traceId: result.traceId });
      return {
        response: { type: 'message', payload: { message: result.error || 'Agent request failed', error: true } },
        nextState: { ...currentState, status: 'failed', context: { ...currentState.context, lastError: result.error || 'Agent invocation failed', errorTimestamp: new Date().toISOString() } },
        traceId: result.traceId,
      };
    }

    logger.info('Async agent invocation completed', { jobId, traceId: result.traceId, executionTime: result.executionTime });

    const structuralCheck = await this.policy.evaluateStructuralTruthVeto(result.data, {
      traceId: result.traceId, agentType: 'coordinator', query: 'async-query-result',
    });
    if (structuralCheck.vetoed) {
      return { response: { type: 'message', payload: { message: 'Output failed structural truth validation against expected schema.', error: true }, metadata: structuralCheck.metadata }, nextState: currentState, traceId: result.traceId };
    }

    let integrityCheck = await this.policy.evaluateIntegrityVeto(result.data, {
      traceId: result.traceId, agentType: 'coordinator', query: 'async-query-result',
    });

    if (integrityCheck.reRefine) {
      logger.info('Triggering async RE-REFINE loop due to low confidence', { traceId: result.traceId });
      const agentContext: AgentContext = {
        userId: String(currentState.context?.requestedBy || currentState.context?.requester || 'system'),
        sessionId: String(currentState.context?.sessionId || ''),
        organizationId: String(currentState.context?.organizationId || ''),
        metadata: { currentStage: currentState.currentStage },
      };
      const re = await this.policy.performReRefine(
        'coordinator',
        `Refine based on prior async output: ${JSON.stringify(result.data).slice(0, 1000)}`,
        agentContext,
        result.traceId,
      );
      if (re.success && re.response) {
        result.data = (re.response as { data?: unknown }).data;
        integrityCheck = await this.policy.evaluateIntegrityVeto(result.data, {
          traceId: result.traceId, agentType: 'coordinator', query: 'async-query-result',
        });
      } else {
        return { response: { type: 'message', payload: { message: 'Unable to auto-refine response. Please try again or request manual review.', error: true } }, nextState: currentState, traceId: result.traceId };
      }
    }

    if (integrityCheck.vetoed) {
      return { response: { type: 'message', payload: { message: 'Output failed integrity validation against ground truth benchmarks.', error: true }, metadata: integrityCheck.metadata }, nextState: currentState, traceId: result.traceId };
    }

    const nextState: WorkflowState = {
      ...currentState,
      context: { ...(currentState.context ?? {}) },
      completed_steps: [...currentState.completed_steps],
    };

    if (result.data) {
      nextState.context!.conversationHistory = [
        ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
        { role: 'user', content: 'Async query', timestamp: new Date().toISOString() },
        { role: 'assistant', content: typeof result.data === 'string' ? result.data : JSON.stringify(result.data), timestamp: new Date().toISOString() },
      ];
    }
    nextState.status = 'running';

    logger.info('Async query result processed', { jobId, traceId: result.traceId });
    return {
      response: { type: 'message', payload: { message: typeof result.data === 'string' ? result.data : JSON.stringify(result.data) } },
      nextState,
      traceId: result.traceId,
    };
  }

  // --------------------------------------------------------------------------
  // Synchronous query path
  // --------------------------------------------------------------------------

  async processQuery(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4(),
  ): Promise<ProcessQueryResult> {
    await this.policy.assertTenantExecutionAllowed(envelope.organizationId);

    if (featureFlags.ENABLE_ASYNC_AGENT_EXECUTION) {
      return this._processQueryViaAsync(envelope, query, currentState, userId, sessionId, traceId);
    }

    return this._processQuerySync(envelope, query, currentState, userId, sessionId, traceId);
  }

  private async _processQueryViaAsync(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string,
  ): Promise<ProcessQueryResult> {
    logger.info('Using async agent execution', { traceId, sessionId });
    const { jobId } = await this.processQueryAsync(envelope, query, currentState, userId, sessionId, traceId);
    const result = await this.agentMessageQueue.waitForJobCompletion(jobId, 60_000);

    if (!result.success) throw new Error(result.error || 'Async agent execution failed');

    const decisionContextResult = await this.buildDecisionContext(currentState, envelope.organizationId);
    const agentType = decisionContextResult.mode === 'downgraded'
      ? 'coordinator'
      : this.router.selectAgent(decisionContextResult.context);
    const agentContext: AgentContext = { userId: envelope.actor.id || userId, sessionId, organizationId: envelope.organizationId };

    const structuralCheck = await this.policy.evaluateStructuralTruthVeto(result.data, { traceId, agentType, query, context: agentContext });
    if (structuralCheck.vetoed) {
      return { response: { type: 'message', payload: { message: 'Output failed structural truth validation against expected schema.', error: true }, metadata: structuralCheck.metadata }, nextState: currentState, traceId };
    }

    const integrityCheck = await this.policy.evaluateIntegrityVeto(result.data, { traceId, agentType, query, context: agentContext });
    if (integrityCheck.vetoed) {
      return { response: { type: 'message', payload: { message: 'Output failed integrity validation against ground truth benchmarks.', error: true }, metadata: integrityCheck.metadata }, nextState: currentState, traceId };
    }

    const nextState: WorkflowState = { ...currentState, context: { ...(currentState.context ?? {}) }, completed_steps: [...currentState.completed_steps] };
    if (result.data) {
      nextState.context!.conversationHistory = [
        ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        { role: 'assistant', content: typeof result.data === 'string' ? result.data : JSON.stringify(result.data), timestamp: new Date().toISOString() },
      ];
    }
    nextState.status = 'running';
    return { response: { type: 'message', payload: { message: typeof result.data === 'string' ? result.data : JSON.stringify(result.data) } }, nextState, traceId: result.traceId };
  }

  private async _processQuerySync(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string,
  ): Promise<ProcessQueryResult> {
    const tracer = getTracer();
    return tracer.startActiveSpan('agent.processQuery', {
      attributes: {
        'agent.query': query, 'agent.user_id': userId, 'agent.session_id': sessionId,
        'agent.trace_id': traceId, 'agent.organization_id': envelope.organizationId,
      },
    }, async (rootSpan: Span) => {
      const start = Date.now();
      try {
        const nextState: WorkflowState = { ...currentState, context: { ...(currentState.context ?? {}) }, completed_steps: [...currentState.completed_steps] };

        let agentType: AgentType = 'coordinator';
        await tracer.startActiveSpan('agent.selectAgent', async (selectSpan: Span) => {
          try {
            const decisionContextResult = await this.buildDecisionContext(currentState, envelope.organizationId);
            if (decisionContextResult.mode === 'rejected') {
              throw new Error(`Missing required context for automation: ${decisionContextResult.diagnostics.join('; ')}`);
            }
            if (decisionContextResult.mode === 'downgraded') {
              logger.warn('Downgrading automation to coordinator due to missing context fields', {
                organizationId: envelope.organizationId,
                diagnostics: decisionContextResult.diagnostics,
              });
              agentType = 'coordinator';
            } else {
              agentType = this.router.selectAgent(decisionContextResult.context);
            }
            selectSpan.setAttributes({
              'agent.selected_type': agentType,
              'agent.routing_strategy': currentState.currentStage ? 'stage-based' : 'intent-based',
            });
            selectSpan.setStatus({ code: SpanStatusCode.OK });
          } catch (error) {
            selectSpan.setStatus({
              code: SpanStatusCode.ERROR,
              message: error instanceof Error ? error.message : String(error),
            });
            if (error instanceof Error) {
              selectSpan.recordException(error);
            }
            throw error;
          } finally {
            selectSpan.end();
          }
        });

        if (!this.checkAgentRateLimit(agentType)) throw new Error(`Agent ${agentType} rate limit exceeded`);

        logger.debug('Agent selected', { traceId, agentType, currentStage: currentState.currentStage });

        const agentContext: AgentContext = {
          userId: envelope.actor.id || userId,
          sessionId,
          organizationId: envelope.organizationId,
          metadata: { companyProfile: currentState.context?.companyProfile, currentStage: currentState.currentStage },
        };

        // ADR-0014: invoke agent directly via AgentFactory — no HTTP round-trip.
        const lifecycleCtx: LifecycleContext = {
          workspace_id: agentContext.sessionId,
          user_id: agentContext.userId,
          organization_id: agentContext.organizationId,
          session_id: agentContext.sessionId,
          query,
          metadata: agentContext.metadata,
        };

        let agentResponse = await this.circuitBreakers.execute(
          `query-${agentType}`,
          async () => {
            const agent = this.getFactory().create(agentType, agentContext.organizationId);
            const output = await agent.execute(lifecycleCtx);
            return {
              success: output.status === 'success' || output.status === 'partial_success',
              data: output.result,
              error: output.errors?.[0]?.message,
              confidence: output.confidence === 'high' || output.confidence === 'very_high' ? 0.85
                : output.confidence === 'medium' ? 0.65
                : 0.4,
            };
          },
          { timeoutMs: this.config.defaultTimeoutMs },
        );

        if (agentResponse.success) {
          const structuralCheck = await this.policy.evaluateStructuralTruthVeto(agentResponse.data, { traceId, agentType, query, context: agentContext });
          if (structuralCheck.vetoed) {
            rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - start });
            rootSpan.setStatus({ code: SpanStatusCode.OK });
            rootSpan.end();
            return { response: { type: 'message', payload: { message: 'Output failed structural truth validation against expected schema.', error: true }, metadata: structuralCheck.metadata }, nextState: currentState, traceId };
          }

          const integrityCheck = await this.policy.evaluateIntegrityVeto(agentResponse.data, { traceId, agentType, query, context: agentContext });

          if (integrityCheck.reRefine) {
            logger.info('Triggering RE-REFINE loop due to low confidence', { traceId, agentType, sessionId });
            const re = await this.policy.performReRefine(agentType, query, agentContext, traceId);
            if (re.success && re.response) {
              agentResponse = re.response as typeof agentResponse;
            } else {
              rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - start });
              rootSpan.setStatus({ code: SpanStatusCode.OK });
              rootSpan.end();
              return { response: { type: 'message', payload: { message: 'Unable to auto-refine response. Please try again or request manual review.', error: true } }, nextState: currentState, traceId };
            }
          }

          if (integrityCheck.vetoed) {
            rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - start });
            rootSpan.setStatus({ code: SpanStatusCode.OK });
            rootSpan.end();
            return { response: { type: 'message', payload: { message: 'Output failed integrity validation against ground truth benchmarks.', error: true }, metadata: integrityCheck.metadata }, nextState: currentState, traceId };
          }
        }

        if (agentResponse.success && agentResponse.data) {
          nextState.context!.conversationHistory = [
            ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
            { role: 'user', content: query, timestamp: new Date().toISOString() },
            { role: 'assistant', content: typeof agentResponse.data === 'string' ? agentResponse.data : JSON.stringify(agentResponse.data), timestamp: new Date().toISOString() },
          ];
        }
        nextState.status = agentResponse.success ? 'running' : 'completed';

        const response: AgentResponse = {
          type: 'message',
          payload: agentResponse.success
            ? { message: typeof agentResponse.data === 'string' ? agentResponse.data : JSON.stringify(agentResponse.data) }
            : { message: agentResponse.error || 'Agent request failed', error: true },
        };

        logger.info('Query processed successfully', { traceId, sessionId, nextStage: nextState.currentStage });
        rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - start });
        rootSpan.setStatus({ code: SpanStatusCode.OK });
        rootSpan.end();
        return { response, nextState, traceId };

      } catch (error) {
        logger.error('Error processing query', error instanceof Error ? error : undefined, { traceId, sessionId, userId });
        rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - start });
        rootSpan.setStatus({ code: SpanStatusCode.ERROR, message: error instanceof Error ? error.message : String(error) });
        if (error instanceof Error) rootSpan.recordException(error);
        rootSpan.end();
        return {
          response: { type: 'message', payload: { message: 'I encountered an error processing your request. Please try again.', error: true } },
          nextState: { ...currentState, status: 'failed', context: { ...currentState.context, lastError: error instanceof Error ? error.message : 'Unknown error', errorTimestamp: new Date().toISOString() } },
          traceId,
        };
      }
    });
  }
}
