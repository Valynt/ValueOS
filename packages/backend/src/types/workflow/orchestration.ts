import { AgentResponsePayload } from "./agentResponse";
import { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from "../execution/workflowExecutionDtos";

export { AgentResponsePayload, WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO };

export interface WorkflowContextDTO {
  organizationId?: string;
  organization_id?: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
  [key: string]: unknown;
}
