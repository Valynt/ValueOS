/**
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

    return null;
  }

  /**
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
  }
}

/**
 * Default export
 */
export default AgentOrchestratorAdapter;
