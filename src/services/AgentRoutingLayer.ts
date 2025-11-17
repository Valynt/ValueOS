import { WorkflowDAG, WorkflowStage, LifecycleStage } from '../types/workflow';

export interface StageRoute {
  stage: WorkflowStage;
  lifecycle_stage: LifecycleStage;
  dependencies: string[];
  reason: string;
}

export class AgentRoutingLayer {
  resolveStage(dag: WorkflowDAG, stageId: string): WorkflowStage {
    const stage = dag.stages.find(s => s.id === stageId);
    if (!stage) {
      throw new Error(`Stage ${stageId} is not defined in workflow ${dag.name}`);
    }
    return stage;
  }

  resolveDependencies(dag: WorkflowDAG, stageId: string): string[] {
    return dag.transitions
      .filter(t => t.to_stage === stageId)
      .map(t => t.from_stage);
  }

  routeStage(dag: WorkflowDAG, stageId: string, context: Record<string, any>): StageRoute {
    const stage = this.resolveStage(dag, stageId);
    const dependencies = this.resolveDependencies(dag, stageId);
    const lifecycle_stage = (context.lifecycle_stage as LifecycleStage) || stage.agent_type;

    const reason = `Routing ${stage.id} to ${lifecycle_stage} agent with dependencies [${dependencies.join(', ')}]`;

    return {
      stage,
      lifecycle_stage,
      dependencies,
      reason
    };
  }

  propagateError(stageId: string, error: Error): never {
    throw new Error(`Routing error at stage ${stageId}: ${error.message}`);
  }
}

export const agentRoutingLayer = new AgentRoutingLayer();
