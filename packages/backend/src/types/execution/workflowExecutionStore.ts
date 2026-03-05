import { WorkflowStatus } from "../workflow";
import { WorkflowExecutionRecord } from "../workflowExecution";
import { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from "../workflow/orchestration";

export interface UpdateExecutionStatusInput {
  executionId: string;
  organizationId: string;
  status: WorkflowStatus;
  currentStage: string | null;
  executionRecord?: WorkflowExecutionRecord;
}

export interface RecordWorkflowEventInput {
  executionId: string;
  organizationId: string;
  eventType: string;
  stageId: string | null;
  metadata: Record<string, unknown>;
}

export interface RecordStageRunInput {
  executionId: string;
  organizationId: string;
  stage: {
    id: string;
    name?: string;
    agent_type: string;
  };
  executionRecord: WorkflowExecutionRecord;
  startedAt: Date;
  completedAt: Date;
  output?: Record<string, unknown>;
}

export interface WorkflowExecutionStore {
  persistExecutionRecord(executionId: string, organizationId: string, executionRecord: WorkflowExecutionRecord): Promise<void>;
  updateExecutionStatus(input: UpdateExecutionStatusInput): Promise<void>;
  recordStageRun(input: RecordStageRunInput): Promise<void>;
  recordWorkflowEvent(input: RecordWorkflowEventInput): Promise<void>;
  getExecutionStatus(executionId: string, organizationId: string): Promise<WorkflowExecutionStatusDTO | null>;
  getExecutionLogs(executionId: string, organizationId: string): Promise<WorkflowExecutionLogDTO[]>;
}
