import { WorkflowStatus } from "../workflow";

export type AgentResponsePayload = Record<string, unknown> | string | number | boolean | null;

export interface WorkflowExecutionStatusDTO {
  id: string;
  organization_id: string;
  status: WorkflowStatus;
  current_stage: string | null;
  updated_at?: string;
  execution_record?: Record<string, unknown>;
}

export interface WorkflowExecutionLogDTO {
  id: string;
  execution_id: string;
  organization_id: string;
  event_type: string;
  stage_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WorkflowContextDTO {
  organizationId?: string;
  organization_id?: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
  [key: string]: unknown;
}
