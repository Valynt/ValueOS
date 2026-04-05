import type { WorkflowStatus } from '../../repositories/WorkflowStateRepository.js';
import type { WorkflowEvent } from '../../types/workflow.js';
import type { WorkflowExecutionRecord } from '../../types/workflowExecution.js';
import type { WorkflowExecutionPersistencePort } from '../ports/runtimePorts.js';

export class WorkflowStatePersistence {
  constructor(private readonly executionPersistence: WorkflowExecutionPersistencePort) {}

  async persistAndUpdate(
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null,
  ): Promise<void> {
    await this.executionPersistence.persistExecutionRecord(executionId, organizationId, record);
    await this.executionPersistence.updateExecutionStatus({
      executionId,
      organizationId,
      status,
      currentStage: stageId,
      executionRecord: record,
    });
  }

  async updateStatus(
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord,
  ): Promise<void> {
    await this.executionPersistence.updateExecutionStatus({
      executionId,
      organizationId,
      status,
      currentStage: stageId,
      executionRecord: record,
    });
  }

  async recordWorkflowEvent(
    executionId: string,
    organizationId: string,
    eventType: WorkflowEvent['event_type'] | 'workflow_initiated' | 'stage_waiting_for_approval' | 'stage_hitl_pending_approval',
    stageId: string | null,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.executionPersistence.recordWorkflowEvent({
      executionId,
      organizationId,
      eventType,
      stageId,
      metadata,
    });
  }

  async handleWorkflowFailure(executionId: string, organizationId: string, errorMessage: string): Promise<void> {
    await this.executionPersistence.markWorkflowFailed(executionId, organizationId, errorMessage);
  }
}