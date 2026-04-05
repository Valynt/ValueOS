import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import type { WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import type { WorkflowExecutionStore } from '../../services/workflows/WorkflowExecutionStore.js';
import type { WorkflowEvent } from '../../types/workflow.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';

export class WorkflowStatePersistence {
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
    await supabase
      .from('workflow_executions')
      .update({ status: 'failed', error_message: errorMessage, completed_at: new Date().toISOString() })
      .eq('id', executionId)
      .eq('organization_id', organizationId);

    logger.error('Workflow failed', undefined, { executionId, errorMessage });
  }
}
