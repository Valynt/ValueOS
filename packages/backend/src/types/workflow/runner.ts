import type { WorkflowDAG, WorkflowStage } from "../workflow";
import type { WorkflowExecutionRecord } from "../workflowExecution";

export interface WorkflowStageContextDTO extends Record<string, unknown> {
  organizationId?: string;
  organization_id?: string;
  tenantId?: string;
  sessionId?: string;
  userId?: string;
}

export interface StageRouteDTO {
  selected_agent?: {
    id: string;
  };
}

export interface StageExecutionResultDTO {
  status: "completed" | "failed";
  output?: Record<string, unknown>;
  error?: string;
}

export interface StagePredictionDTO {
  outcome: Record<string, unknown>;
  confidence: number;
  estimatedDuration: number;
}

export interface WorkflowRunner {
  executeDAGAsync(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: WorkflowStageContextDTO,
    traceId: string,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void>;
  executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO,
    traceId: string
  ): Promise<StageExecutionResultDTO>;
  executeStage(
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO
  ): Promise<Record<string, unknown>>;
}
