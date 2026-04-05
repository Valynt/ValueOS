import { logger } from '../../lib/logger.js';
import type { WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import type { WorkflowExecutionStore } from '../../services/workflows/WorkflowExecutionStore.js';
import type { WorkflowEvent } from '../../types/workflow.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';

import { WorkflowFailureSupabaseAdapter } from './adapters/WorkflowFailureSupabaseAdapter.js';
import { composeAdapter, withRetry, withStructuredLogging, withTenantScopeGuard } from '../ports/decorators/adapterDecorators.js';

export class WorkflowStatePersistence {
  private readonly workflowFailureAdapter = composeAdapter(
    new WorkflowFailureSupabaseAdapter(),
    [
      withRetry,
      withStructuredLogging,
      withTenantScopeGuard,
    ],
  );

  constructor(private readonly executionStore: WorkflowExecutionStore) {}

  async persistAndUpdate(
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null,
  ): Promise<void> {
    await this.executionStore.persistExecutionRecord(executionId, organizationId, record);
    await this.executionStore.updateExecutionStatus({ executionId, organizationId, status, currentStage: stageId, executionRecord: record });
  }

  async updateStatus(
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord,
  ): Promise<void> {
    await this.executionStore.updateExecutionStatus({ executionId, organizationId, status, currentStage: stageId, executionRecord: record });
  }

  async recordWorkflowEvent(
    executionId: string,
    organizationId: string,
    eventType: WorkflowEvent['event_type'] | 'workflow_initiated' | 'stage_waiting_for_approval' | 'stage_hitl_pending_approval',
    stageId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.executionStore.recordWorkflowEvent({ executionId, organizationId, eventType, stageId, metadata });
  }

  async handleWorkflowFailure(executionId: string, organizationId: string, errorMessage: string): Promise<void> {
    const result = await this.workflowFailureAdapter.execute(
      { executionId, organizationId, errorMessage },
      {
        tenantId: organizationId,
        authMode: 'user-scoped-rls',
        retryPolicy: {
          strategy: 'exponential',
          maxAttempts: 3,
          initialDelayMs: 100,
          maxDelayMs: 1000,
          multiplier: 2,
          jitter: false,
        },
        logSchema: {
          schema: 'valueos.adapter.log.v1',
          operation: 'workflow_failure_update',
          component: 'execution-runtime',
        },
      },
    );

    logger.error('Workflow failed', undefined, {
      executionId,
      errorMessage,
      persisted: result.ok,
      failureCode: result.ok ? undefined : result.failure.code,
    });
  }
}
