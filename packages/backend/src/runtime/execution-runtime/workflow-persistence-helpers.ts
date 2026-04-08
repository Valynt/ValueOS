import type { WorkflowStatus } from "../../repositories/WorkflowStateRepository.js";
import type { WorkflowExecutionRecord } from "../../types/workflowExecution.js";
import type { WorkflowEvent } from "../../types/workflow.js";

import { WorkflowStatePersistence } from "./state-persistence.js";

export class WorkflowPersistenceHelpers {
  constructor(private readonly statePersistence: WorkflowStatePersistence) {}

  persistAndUpdate(
    executionId: string,
    organizationId: string,
    record: WorkflowExecutionRecord,
    status: WorkflowStatus,
    stageId: string | null
  ): Promise<void> {
    return this.statePersistence.persistAndUpdate(
      executionId,
      organizationId,
      record,
      status,
      stageId
    );
  }

  updateStatus(
    executionId: string,
    organizationId: string,
    status: WorkflowStatus,
    stageId: string | null,
    record: WorkflowExecutionRecord
  ): Promise<void> {
    return this.statePersistence.updateStatus(
      executionId,
      organizationId,
      status,
      stageId,
      record
    );
  }

  recordWorkflowEvent(
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
    return this.statePersistence.recordWorkflowEvent(
      executionId,
      organizationId,
      eventType,
      stageId,
      metadata
    );
  }

  handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    errorMessage: string
  ): Promise<void> {
    return this.statePersistence.handleWorkflowFailure(
      executionId,
      organizationId,
      errorMessage
    );
  }
}
