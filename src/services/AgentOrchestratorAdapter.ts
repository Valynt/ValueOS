/**
 * Agent Orchestrator Adapter
 * 
 * PHASE 3: Backward-compatible adapter for gradual migration
 * 
 * This adapter provides the same interface as the legacy MockAgentOrchestrator
 * but uses the new stateless architecture under the hood when enabled.
 * 
 * Usage:
 *   import { agentOrchestrator } from './AgentOrchestratorAdapter';
 *   // Works with both old and new implementations
 */

import { featureFlags } from '../config/featureFlags';
import { agentOrchestrator as legacyOrchestrator, StreamingUpdate, AgentResponse } from './AgentOrchestrator';
import { AgentQueryService } from './AgentQueryService';
import { getSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';

/**
 * Adapter class that switches between legacy and new implementation
 */
class AgentOrchestratorAdapter {
  private queryService: AgentQueryService | null = null;
  private streamingCallbacks: Array<(update: StreamingUpdate) => void> = [];

  constructor() {
    if (featureFlags.ENABLE_STATELESS_ORCHESTRATION) {
      const supabase = getSupabaseClient();
      this.queryService = new AgentQueryService(supabase);
      logger.info('Using stateless orchestration');
    } else {
      logger.info('Using legacy orchestration');
    }
  }

  /**
   * Initialize workflow (legacy interface)
   */
  initializeWorkflow(
    initialStage: string,
    context?: Record<string, any>
  ): void {
    if (this.queryService) {
      // Stateless: No-op (state created on first query)
      logger.debug('Stateless orchestration: workflow will be initialized on first query', {
        initialStage,
      });
    } else {
      // Legacy: Initialize singleton state
      legacyOrchestrator.initializeWorkflow(initialStage, context);
    }
  }

  /**
   * Process query (legacy interface)
   */
  async processQuery(
    query: string,
    options?: {
      userId?: string;
      sessionId?: string;
      context?: Record<string, any>;
    }
  ): Promise<AgentResponse | null> {
    if (this.queryService) {
      // Stateless: Use new service
      try {
        const userId = options?.userId || 'anonymous';
        const sessionId = options?.sessionId;

        const result = await this.queryService.handleQuery(
          query,
          userId,
          sessionId,
          {
            initialContext: options?.context,
          }
        );

        // Emit streaming updates if callbacks registered
        if (this.streamingCallbacks.length > 0) {
          this.streamingCallbacks.forEach(callback => {
            callback({
              stage: 'complete',
              message: 'Query processed',
              progress: result.progress,
            });
          });
        }

        return result.response;
      } catch (error) {
        logger.error('Stateless orchestration error', error instanceof Error ? error : undefined);
        throw error;
      }
    } else {
      // Legacy: Use singleton
      return await legacyOrchestrator.processQuery(query);
    }
  }

  /**
   * Register streaming callback (legacy interface)
   */
  onStreaming(callback: (update: StreamingUpdate) => void): () => void {
    if (this.queryService) {
      // Stateless: Store callback
      this.streamingCallbacks.push(callback);
      return () => {
        const index = this.streamingCallbacks.indexOf(callback);
        if (index > -1) {
          this.streamingCallbacks.splice(index, 1);
        }
      };
    } else {
      // Legacy: Use singleton
      return legacyOrchestrator.onStreaming(callback);
    }
  }

  /**
   * Update workflow stage (legacy interface)
   */
  updateStage(stage: string, status: string): void {
    if (this.queryService) {
      // Stateless: No-op (state managed per-request)
      logger.debug('Stateless orchestration: stage updates handled per-request', {
        stage,
        status,
      });
    } else {
      // Legacy: Update singleton state
      legacyOrchestrator.updateStage(stage, status as any);
    }
  }

  /**
   * Get current workflow state (legacy interface)
   */
  getCurrentState(): any {
    if (this.queryService) {
      // Stateless: Cannot get state without session ID
      logger.warn('Stateless orchestration: getCurrentState() requires session ID');
      return null;
    } else {
      // Legacy: Return singleton state
      return legacyOrchestrator.getCurrentState();
    }
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
}

/**
 * Export singleton adapter instance
 * 
 * This maintains backward compatibility while enabling gradual migration
 */
export const agentOrchestrator = new AgentOrchestratorAdapter();

/**
 * Export types for backward compatibility
 */
export type { AgentResponse, StreamingUpdate } from './AgentOrchestrator';
