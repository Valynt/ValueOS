/**
 * Agent Orchestrator Adapter
 * 
 * PHASE 4: Unified orchestration with backward-compatible interface
 * 
 * This adapter provides the same interface as the legacy AgentOrchestrator
 * but now uses the UnifiedAgentOrchestrator under the hood.
 * 
 * Migration Status:
 * - Legacy AgentOrchestrator: DEPRECATED
 * - StatelessAgentOrchestrator: MERGED into UnifiedAgentOrchestrator
 * - WorkflowOrchestrator: Capabilities MERGED into UnifiedAgentOrchestrator
 * 
 * Usage:
 *   import { agentOrchestrator } from './AgentOrchestratorAdapter';
 *   // Works with unified implementation
 */

import { v4 as uuidv4 } from 'uuid';

import { featureFlags } from '../config/featureFlags';
import { logger } from '../lib/logger';
import { getSupabaseClient } from '../lib/supabase';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { ExecutionRequest, normalizeExecutionRequest } from '../types/execution';

import { AgentQueryService } from './AgentQueryService';
import {
  AgentResponse,
  ExecutionEnvelope,
  getUnifiedOrchestrator,
  StreamingUpdate,
  UnifiedAgentOrchestrator,
} from './UnifiedAgentOrchestrator';

/**
 * Adapter class that provides backward compatibility for the unified orchestrator
 */
class AgentOrchestratorAdapter {
  private unifiedOrchestrator: UnifiedAgentOrchestrator;
  private queryService: AgentQueryService | null = null;
  private streamingCallbacks: Array<(update: StreamingUpdate) => void> = [];
  private currentState: WorkflowState | null = null;
  private inFlightExecutions = new Set<Promise<unknown>>();

  private trackInFlight<T>(execution: Promise<T>): Promise<T> {
    this.inFlightExecutions.add(execution);
    execution.finally(() => {
      this.inFlightExecutions.delete(execution);
    });
    return execution;
  }

  private buildExecutionEnvelope(userId: string, context?: Record<string, unknown>): ExecutionEnvelope {
    return {
      intent: 'agent-orchestrator-adapter',
      actor: { id: userId },
      organizationId: context?.organizationId || 'unknown',
      entryPoint: 'agent-orchestrator-adapter',
      reason: 'adapter-request',
      timestamps: { requestedAt: new Date().toISOString() },
    };
  }

  constructor() {
    // Always use unified orchestrator now
    this.unifiedOrchestrator = getUnifiedOrchestrator();
    logger.info('Using unified orchestration');

    // Keep query service for session management if needed
    if (featureFlags.ENABLE_STATELESS_ORCHESTRATION) {
      const supabase = getSupabaseClient();
      this.queryService = new AgentQueryService(supabase);
    }
  }

  /**
   * Initialize workflow (legacy interface)
   * Now uses unified orchestrator's createInitialState
   */
  initializeWorkflow(
    initialStage: string,
    execution?: ExecutionRequest
  ): void {
    const normalizedExecution = normalizeExecutionRequest(
      'agent-query',
      execution || { intent: 'FullValueAnalysis', environment: 'production' }
    );
    this.currentState = this.unifiedOrchestrator.createInitialState(initialStage, normalizedExecution);
    logger.debug('Workflow initialized via unified orchestrator', { initialStage });
  }

  /**
   * Process query (legacy interface)
   * Now uses unified orchestrator's processQuery
   */
  async processQuery(
    query: string,
    options?: {
      userId?: string;
      sessionId?: string;
      context?: ExecutionRequest;
    }
  ): Promise<AgentResponse | null> {
    try {
      const userId = options?.userId || 'anonymous';
      const sessionId = options?.sessionId || uuidv4();
      const traceId = uuidv4();

      const normalizedExecution = normalizeExecutionRequest(
        'agent-query',
        options?.context || { intent: 'FullValueAnalysis', environment: 'production' }
      );

      // Initialize state if not already done
      if (!this.currentState) {
        this.currentState = this.unifiedOrchestrator.createInitialState(
          'discovery',
          normalizedExecution
        );
      }

      // Process query through unified orchestrator
      const envelope = this.buildExecutionEnvelope(userId, options?.context);
      const result = await this.trackInFlight(
        this.unifiedOrchestrator.processQuery(envelope, query, this.currentState, userId, sessionId, traceId)
      );

      // Update internal state
      this.currentState = result.nextState;

      // Emit streaming updates if callbacks registered
      if (this.streamingCallbacks.length > 0) {
        this.streamingCallbacks.forEach(callback => {
          callback({
            stage: 'complete',
            message: 'Query processed',
            progress: 100,
          });
        });
      }

      return result.response;
    } catch (error) {
      logger.error('Unified orchestration error', error instanceof Error ? error : undefined);
      throw error;
    }
  }

  /**
   * Register streaming callback (legacy interface)
   */
  onStreaming(callback: (update: StreamingUpdate) => void): () => void {
    this.streamingCallbacks.push(callback);
    return () => {
      const index = this.streamingCallbacks.indexOf(callback);
      if (index > -1) {
        this.streamingCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update workflow stage (legacy interface)
   * Now uses unified orchestrator's updateStage
   */
  updateStage(stage: string, status: string): void {
    if (this.currentState) {
      this.currentState = this.unifiedOrchestrator.updateStage(
        this.currentState,
        stage,
        status as any
      );
      logger.debug('Stage updated via unified orchestrator', { stage, status });
    } else {
      logger.warn('Cannot update stage: no workflow initialized');
    }
  }

  /**
   * Get current workflow state (legacy interface)
   */
  getCurrentState(): WorkflowState | null {
    return this.currentState;
  }

  /**
   * Get session (new interface)
   */
  async getSession(sessionId: string, tenantId: string) {
    if (this.queryService) {
      return await this.queryService.getSession(sessionId, tenantId);
    }
    return null;
  }

  /**
   * Get active sessions (new interface)
   */
  async getActiveSessions(userId: string, tenantId: string, limit?: number) {
    if (this.queryService) {
      return await this.queryService.getActiveSessions(userId, tenantId, limit);
    }
    return [];
  }

  /**
   * Execute workflow DAG (new interface)
   * Exposes unified orchestrator's workflow execution
   */
  async executeWorkflow(
    workflowDefinitionId: string,
    context: Record<string, unknown>,
    userId: string
  ) {
    const envelope = this.buildExecutionEnvelope(userId, context);
    return this.trackInFlight(
      this.unifiedOrchestrator.executeWorkflow(envelope, workflowDefinitionId, context, userId)
    );
  }

  /**
   * Generate SDUI page (new interface)
   * Exposes unified orchestrator's SDUI generation
   */
  async generateSDUIPage(
    agent: Parameters<UnifiedAgentOrchestrator['generateSDUIPage']>[0],
    query: string,
    context?: Parameters<UnifiedAgentOrchestrator['generateSDUIPage']>[2]
  ) {
    const callback = this.streamingCallbacks.length > 0
      ? this.streamingCallbacks[0]
      : undefined;
    const envelope = this.buildExecutionEnvelope(context?.userId || 'anonymous', context);
    return this.trackInFlight(
      this.unifiedOrchestrator.generateSDUIPage(envelope, agent, query, context, callback)
    );
  }

  /**
   * Plan a task (new interface)
   * Exposes unified orchestrator's task planning
   */
  async planTask(
    intentType: string,
    description: string,
    context?: Record<string, unknown>
  ) {
    return this.unifiedOrchestrator.planTask(intentType, description, context);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(agent: Parameters<UnifiedAgentOrchestrator['getCircuitBreakerStatus']>[0]) {
    return this.unifiedOrchestrator.getCircuitBreakerStatus(agent);
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(agent: Parameters<UnifiedAgentOrchestrator['resetCircuitBreaker']>[0]) {
    return this.unifiedOrchestrator.resetCircuitBreaker(agent);
  }

  async awaitDrain(pollIntervalMs: number = 25): Promise<void> {
    while (this.inFlightExecutions.size > 0) {
      await Promise.allSettled(Array.from(this.inFlightExecutions));
      if (this.inFlightExecutions.size > 0) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }
  }

  async shutdown(): Promise<void> {
    await this.awaitDrain();
  }

  /**
   * Get the underlying unified orchestrator
   */
  getUnifiedOrchestrator(): UnifiedAgentOrchestrator {
    return this.unifiedOrchestrator;
  }
}

/**
 * Export singleton adapter instance
 * 
 * This maintains backward compatibility while enabling gradual migration
 */
export const agentOrchestrator = new AgentOrchestratorAdapter();

/**
 * Export types from unified orchestrator for backward compatibility
 */
export type { AgentResponse, StreamingUpdate } from './UnifiedAgentOrchestrator';
