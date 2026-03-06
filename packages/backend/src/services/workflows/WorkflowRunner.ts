import type {
  StageExecutionResultDTO,
  StageRouteDTO,
  WorkflowRunner,
  WorkflowStageContextDTO,
} from "../../types/workflow/runner";
import type { WorkflowExecutionRecord } from "../../types/workflowExecution";
import type { WorkflowDAG, WorkflowStage } from "../../types/workflow";

export type { WorkflowRunner };

export class DelegatingWorkflowRunner implements WorkflowRunner {
  constructor(
    private readonly delegates: {
      executeDAGAsync: WorkflowRunner["executeDAGAsync"];
      executeStageWithRetry: WorkflowRunner["executeStageWithRetry"];
      executeStage: WorkflowRunner["executeStage"];
    }
  ) {}

  executeDAGAsync(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: WorkflowStageContextDTO,
    traceId: string,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void> {
    return this.delegates.executeDAGAsync(
      executionId,
      organizationId,
      dag,
      initialContext,
      traceId,
      executionRecord
    );
  }

  executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO,
    traceId: string
  ): Promise<StageExecutionResultDTO> {
    return this.delegates.executeStageWithRetry(executionId, stage, context, route, traceId);
  }

  executeStage(
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO
  ): Promise<Record<string, unknown>> {
    return this.delegates.executeStage(stage, context, route);
  }
}
