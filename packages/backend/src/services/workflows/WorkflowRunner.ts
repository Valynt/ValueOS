import type { WorkflowExecutionRecord } from "../../types/workflowExecution";
import type { WorkflowDAG, WorkflowStage } from "../../types/workflow";

export interface StageExecutionContext extends Record<string, unknown> {
  organizationId?: string;
  sessionId?: string;
  userId?: string;
}

export interface WorkflowRunner {
  executeDAGAsync(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: StageExecutionContext,
    traceId: string,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void>;
  executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: StageExecutionContext,
    route: unknown,
    traceId: string
  ): Promise<{ status: "completed" | "failed"; output?: Record<string, unknown>; error?: string }>;
  executeStage(
    stage: WorkflowStage,
    context: StageExecutionContext,
    route: unknown
  ): Promise<Record<string, unknown>>;
}

export class DelegatingWorkflowRunner implements WorkflowRunner {
  constructor(
    private readonly delegates: {
      executeDAGAsync: WorkflowRunner["executeDAGAsync"];
      executeStageWithRetry: WorkflowRunner["executeStageWithRetry"];
      executeStage: WorkflowRunner["executeStage"];
    }
  ) {}

  executeDAGAsync(...args: Parameters<WorkflowRunner["executeDAGAsync"]>): Promise<void> {
    return this.delegates.executeDAGAsync(...args);
  }

  executeStageWithRetry(...args: Parameters<WorkflowRunner["executeStageWithRetry"]>) {
    return this.delegates.executeStageWithRetry(...args);
  }

  executeStage(...args: Parameters<WorkflowRunner["executeStage"]>) {
    return this.delegates.executeStage(...args);
  }
}
