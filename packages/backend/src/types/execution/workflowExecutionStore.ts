import { WorkflowStatus } from "../workflow";
import { WorkflowExecutionRecord } from "../workflowExecution";

import { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from "./workflowExecutionDtos";

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

export type ApprovalCheckpointState =
  | "pending"
  | "approved"
  | "rejected"
  | "escalated"
  | "expired";

export interface ApprovalCheckpointRecord {
  checkpoint_id: string;
  run_id: string;
  stage_id: string;
  organization_id: string;
  owner_principal: string;
  owner_type: "user" | "team" | "role";
  due_at: string;
  escalation_policy_id: string;
  state: ApprovalCheckpointState;
  updated_at?: string;
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
  upsertApprovalCheckpoint(record: ApprovalCheckpointRecord): Promise<void>;
  listApprovalCheckpoints(input: {
    organizationId: string;
    ownerPrincipal?: string;
    ownerTeam?: string;
    states?: ApprovalCheckpointState[];
    overdueOnly?: boolean;
  }): Promise<ApprovalCheckpointRecord[]>;
  listOrganizationsWithPendingApprovalCheckpoints(): Promise<string[]>;
  getExecutionStatus(executionId: string, organizationId: string): Promise<WorkflowExecutionStatusDTO | null>;
  getExecutionLogs(executionId: string, organizationId: string): Promise<WorkflowExecutionLogDTO[]>;
}
