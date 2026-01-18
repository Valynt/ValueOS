/**
<<<<<<< HEAD
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
  AgentResponse,
  ExecutionEnvelope,
  getUnifiedOrchestrator,
  StreamingUpdate,
  UnifiedAgentOrchestrator,
} from './UnifiedAgentOrchestrator';
import { AgentQueryService } from './AgentQueryService';
import { getSupabaseClient } from '../lib/supabase';
import { logger } from '../lib/logger';
import { WorkflowState } from '../repositories/WorkflowStateRepository';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionRequest, normalizeExecutionRequest } from '../types/execution';

/**
 * Adapter class that provides backward compatibility for the unified orchestrator
 */
class AgentOrchestratorAdapter {
  private unifiedOrchestrator: UnifiedAgentOrchestrator;
  private queryService: AgentQueryService | null = null;
  private streamingCallbacks: Array<(update: StreamingUpdate) => void> = [];
  private currentState: WorkflowState | null = null;

  private buildExecutionEnvelope(userId: string, context?: Record<string, any>): ExecutionEnvelope {
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
      const result = await this.unifiedOrchestrator.processQuery(envelope, query, this.currentState, userId, sessionId, traceId);

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
=======
 * AgentOrchestratorAdapter
 *
 * Provides a unified interface to the backend UnifiedAgentOrchestrator.
 * Handles async job execution and polling for results.
 */

import { invokeAgent, getJobStatus, waitForJob, AgentInvokeResponse, AgentJobStatus, AgentId } from './agentService';
import type { AgentEvent, Artifact } from '@/features/workspace/agent/types';
import {
  fromAgentResponse,
  createErrorEvent,
  createPhaseChangeEvent,
  AgentResponse,
  StreamingUpdate,
} from '@/features/workspace/agent/api-adapter';

export interface AgentOrchestratorConfig {
  /** Base URL for the backend API */
  baseUrl?: string;
  /** Polling interval in milliseconds */
  pollingInterval?: number;
  /** Maximum polling attempts */
  maxPollingAttempts?: number;
  /** Timeout for agent execution in milliseconds */
  timeoutMs?: number;
}

export interface AgentOrchestratorOptions {
  /** Use mock API instead of real backend */
  useMock?: boolean;
  /** Company name for context */
  companyName?: string;
  /** Callback when stream completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface AgentOrchestratorResult {
  /** Send a message to the agent */
  sendMessage: (message: string) => Promise<void>;
  /** Cancel the current stream */
  cancel: () => void;
  /** Whether a stream is currently active */
  isStreaming: boolean;
}

/**
 * AgentOrchestratorAdapter
 *
 * Connects the frontend to the backend UnifiedAgentOrchestrator.
 * Handles async job execution and polling for results.
 */
export class AgentOrchestratorAdapter {
  private config: AgentOrchestratorConfig;
  private isStreaming = false;
  private abortController: AbortController | null = null;
  private currentJobId: string | null = null;

  constructor(config: AgentOrchestratorConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || '/api',
      pollingInterval: config.pollingInterval || 1000,
      maxPollingAttempts: config.maxPollingAttempts || 60,
      timeoutMs: config.timeoutMs || 30000,
    };
  }

  /**
   * Invoke an agent and poll for results
   */
  async invokeAgent(
    agentId: AgentId,
    query: string,
    runId: string,
    context?: Record<string, any>,
    onEvent?: (event: AgentEvent) => void
  ): Promise<void> {
    this.isStreaming = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      // Emit initial phase change
      onEvent?.(createPhaseChangeEvent('idle', 'execute', runId, 'Processing query'));

      // Invoke the agent
      const invokeResponse = await invokeAgent(agentId, {
        query,
        context: JSON.stringify(context || {}),
      });

      if (!invokeResponse.success || !invokeResponse.data?.jobId) {
        throw new Error(invokeResponse.error || 'Failed to invoke agent');
      }

      const jobId = invokeResponse.data.jobId;
      this.currentJobId = jobId;

      // Poll for job completion
      const jobStatus = await this.pollJobStatus(jobId, runId, signal, onEvent);

      if (!jobStatus) {
        throw new Error('Job polling timed out or was cancelled');
      }

      if (jobStatus.status === 'failed') {
        throw new Error(jobStatus.error || 'Agent execution failed');
      }

      // Process the result
      if (jobStatus.result) {
        const agentResponse: AgentResponse = {
          type: 'message',
          payload: { message: JSON.stringify(jobStatus.result) },
        };

        const events = fromAgentResponse(agentResponse, runId);
        events.forEach(event => onEvent?.(event));
      }

      onEvent?.(createPhaseChangeEvent('execute', 'review', runId, 'Processing complete'));
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      onEvent?.(createErrorEvent(err, runId));
      throw err;
    } finally {
      this.isStreaming = false;
      this.abortController = null;
      this.currentJobId = null;
    }
  }

  /**
   * Poll for job status with progress updates
   */
  private async pollJobStatus(
    jobId: string,
    runId: string,
    signal: AbortSignal,
    onEvent?: (event: AgentEvent) => void
  ): Promise<AgentJobStatus | null> {
    let attempts = 0;

    while (attempts < this.config.maxPollingAttempts!) {
      if (signal.aborted) {
        return null;
      }

      const status = await getJobStatus(jobId);

      if (!status) {
        // Job not found yet, continue polling
        await this.delay(this.config.pollingInterval!);
        attempts++;
        continue;
      }

      // Emit progress update
      if (status.status === 'processing') {
        onEvent?.({
          id: `event_${Date.now()}`,
          type: 'checkpoint_created',
          timestamp: Date.now(),
          runId: runId,
          payload: {
            checkpointId: `checkpoint_${Date.now()}`,
            label: 'Processing...',
            progress: (attempts / this.config.maxPollingAttempts!) * 100,
            canRestore: true,
          },
        });
      }

      // Check if job is complete
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }

      await this.delay(this.config.pollingInterval!);
      attempts++;
    }

>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
    return null;
  }

  /**
<<<<<<< HEAD
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
    context: Record<string, any>,
    userId: string
  ) {
    const envelope = this.buildExecutionEnvelope(userId, context);
    return this.unifiedOrchestrator.executeWorkflow(envelope, workflowDefinitionId, context, userId);
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
    return this.unifiedOrchestrator.generateSDUIPage(envelope, agent, query, context, callback);
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
=======
   * Cancel the current operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.isStreaming = false;
  }

  /**
   * Check if currently streaming
   */
  get isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Get the current job ID
   */
  getCurrentJobId(): string | null {
    return this.currentJobId;
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
  }
}

/**
<<<<<<< HEAD
 * Export singleton adapter instance
 * 
 * This maintains backward compatibility while enabling gradual migration
 */
export const agentOrchestrator = new AgentOrchestratorAdapter();

/**
 * Export types from unified orchestrator for backward compatibility
 */
export type { AgentResponse, StreamingUpdate } from './UnifiedAgentOrchestrator';
=======
 * Default export
 */
export default AgentOrchestratorAdapter;
>>>>>>> abdf1deaad6ae735b2af5e199e9cf9d374047a98
