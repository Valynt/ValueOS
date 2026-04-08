import type { WorkflowStatus } from "../../repositories/WorkflowStateRepository.js";
import type { WorkflowEvent } from "../../types/workflow.js";
import type { WorkflowExecutionRecord } from "../../types/workflowExecution.js";
import { WorkflowPersistence } from "./workflow-persistence.js";

export class WorkflowPersistenceInteractions {
  constructor(private readonly workflowPersistence: WorkflowPersistence) {}

  async persistAndUpdate(
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null
  ): Promise<void> {
    await this.workflowPersistence.persistAndUpdate(
      executionId,
      organizationId,
      record,
      status,
      stageId
    );
  }

  async updateStatus(
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord
  ): Promise<void> {
    await this.workflowPersistence.updateStatus(
      executionId,
      organizationId,
      status,
      stageId,
      record
    );
  }

  async recordWorkflowEvent(
    executionId: string,
    organizationId: string,
    eventType:
      | WorkflowEvent["event_type"]
      | "workflow_initiated"
      | "stage_waiting_for_approval"
      | "stage_hitl_pending_approval",
    stageId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await this.workflowPersistence.recordWorkflowEvent(
      executionId,
      organizationId,
      eventType,
      stageId,
      metadata
    );
  }

  async handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    errorMessage: string
  ): Promise<void> {
    await this.workflowPersistence.handleWorkflowFailure(
      executionId,
      organizationId,
      errorMessage
    );
  }
}
