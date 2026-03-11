/**
 * ContextStore
 *
 * Assembles execution context and workflow state for agent consumption.
 * Extracted from UnifiedAgentOrchestrator in Sprint 4.
 *
 * Owns:
 *  - WorkflowState creation and mutation helpers (createInitialState, updateStage)
 *  - Execution status and log queries (delegated to WorkflowExecutionStore)
 *  - Workflow failure recording
 *  - Progress and completion helpers
 *
 * Sprint 5 target: extend with full DecisionContext hydration from domain
 * repositories (Account, Opportunity, ValueHypothesis).
 */

import { v4 as uuidv4 } from 'uuid';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabase as defaultSupabase } from '../../lib/supabase.js';
import { logger } from '../../lib/logger.js';
import { WorkflowExecutionStore } from '../../services/workflows/WorkflowExecutionStore.js';
import type { WorkflowState, WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import type { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from '../../types/execution/workflowExecutionDtos.js';
import type { ExecutionRequest } from '../../types/execution.js';

export type { WorkflowState, WorkflowStatus };

// ============================================================================
// ContextStore
// ============================================================================

export class ContextStore {
  private readonly executionStore: WorkflowExecutionStore;
  private readonly supabase: SupabaseClient;

  constructor(supabaseClient: SupabaseClient = defaultSupabase) {
    this.supabase = supabaseClient;
    this.executionStore = new WorkflowExecutionStore(supabaseClient);
  }

  // --------------------------------------------------------------------------
  // WorkflowState helpers (pure functions)
  // --------------------------------------------------------------------------

  createInitialState(
    organizationId: string,
    initialStage: string,
    execution: Partial<ExecutionRequest> & Record<string, unknown> = {
      intent: 'FullValueAnalysis',
      environment: 'production',
    },
  ): WorkflowState {
    if (!organizationId) {
      throw new Error('ContextStore.createInitialState: organizationId is required');
    }
    const normalizedExecution = { ...execution, intent: execution.intent ?? 'agent-query' };
    const now = new Date().toISOString();

    return {
      id: uuidv4(),
      workflow_id: '',
      execution_id: uuidv4(),
      workspace_id: '',
      organization_id: organizationId,
      lifecycle_stage: initialStage,
      current_step: initialStage,
      currentStage: initialStage,
      status: 'pending',
      completed_steps: [],
      state_data: {},
      context: {
        ...(normalizedExecution as Record<string, unknown>),
        conversationHistory: [],
      },
      created_at: now,
      updated_at: now,
    };
  }

  updateStage(currentState: WorkflowState, stage: string, status: WorkflowStatus): WorkflowState {
    const nextState: WorkflowState = {
      ...currentState,
      currentStage: stage,
      status,
      completed_steps: [...currentState.completed_steps],
    };

    if (
      status === 'completed' &&
      currentState.currentStage &&
      !nextState.completed_steps.includes(currentState.currentStage)
    ) {
      nextState.completed_steps.push(currentState.currentStage);
    }

    return nextState;
  }

  isWorkflowComplete(state: WorkflowState): boolean {
    return state.status === 'completed';
  }

  getProgress(state: WorkflowState, totalStages = 5): number {
    return Math.round((state.completed_steps.length / totalStages) * 100);
  }

  // --------------------------------------------------------------------------
  // Execution status and logs
  // --------------------------------------------------------------------------

  async getExecutionStatus(
    executionId: string,
    organizationId: string,
  ): Promise<WorkflowExecutionStatusDTO | null> {
    return this.executionStore.getExecutionStatus(executionId, organizationId);
  }

  async getExecutionLogs(
    executionId: string,
    organizationId: string,
  ): Promise<WorkflowExecutionLogDTO[]> {
    return this.executionStore.getExecutionLogs(executionId, organizationId);
  }

  // --------------------------------------------------------------------------
  // Workflow failure recording
  // --------------------------------------------------------------------------

  async handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    errorMessage: string,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_executions')
      .update({
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId)
      .eq('organization_id', organizationId);

    if (error) {
      // Log but do not re-throw — the caller's error is the primary failure.
      logger.error('Failed to persist workflow failure status', new Error(error.message), {
        executionId,
        organizationId,
        dbError: error.message,
      });
    }

    logger.error('Workflow failed', undefined, { executionId, errorMessage });
  }
}

// Singleton
export const contextStore = new ContextStore();
