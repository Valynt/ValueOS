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

import { featureFlags } from '../config/featureFlags';
import { 
  UnifiedAgentOrchestrator, 
  getUnifiedOrchestrator,
  StreamingUpdate, 
  AgentResponse 
} from './UnifiedAgentOrchestrator';
import { AgentQueryService } from './AgentQueryService';
import { getSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { v4 as uuidv4 } from 'uuid';

/**
 * Adapter class that provides backward compatibility for the unified orchestrator
 */
class AgentOrchestratorAdapter {
  private unifiedOrchestrator: UnifiedAgentOrchestrator;
  private queryService: AgentQueryService | null = null;
  private streamingCallbacks: Array<(update: StreamingUpdate) => void> = [];
  private currentState: WorkflowState | null = null;

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
    context?: Record<string, any>
  ): void {
    this.currentState = this.unifiedOrchestrator.createInitialState(initialStage, context);
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
      context?: Record<string, any>;
    }
  ): Promise<AgentResponse | null> {
    try {
      const userId = options?.userId || 'anonymous';
      const sessionId = options?.sessionId || uuidv4();
      const traceId = uuidv4();

      // Initialize state if not already done
      if (!this.currentState) {
        this.currentState = this.unifiedOrchestrator.createInitialState(
          'discovery',
          options?.context || {}
        );
      }

      // Process query through unified orchestrator
      const result = await this.unifiedOrchestrator.processQuery(
        query,
        this.currentState,
        userId,
        sessionId,
        traceId
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
  async getSession(sessionId: string) {
    if (this.queryService) {
      return await this.queryService.getSession(sessionId);
    }
    return null;
  }

  /**
   * Get active sessions (new interface)
   */
  async getActiveSessions(userId: string, limit?: number) {
    if (this.queryService) {
      return await this.queryService.getActiveSessions(userId, limit);
    }
    return [];
  }

  /**
   * Execute workflow DAG (new interface)
   * Exposes unified orchestrator's workflow execution
   */
  async executeWorkflow(
    workflowDefinitionId: string,
    context: Record<string, any>,
    userId: string
  ) {
    return this.unifiedOrchestrator.executeWorkflow(workflowDefinitionId, context, userId);
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
    return this.unifiedOrchestrator.generateSDUIPage(agent, query, context, callback);
  }

  /**
   * Plan a task (new interface)
   * Exposes unified orchestrator's task planning
   */
  async planTask(
    intentType: string,
    description: string,
    context?: Record<string, any>
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
