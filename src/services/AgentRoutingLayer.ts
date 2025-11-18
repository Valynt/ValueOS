import { WorkflowDAG, WorkflowStage, LifecycleStage } from '../types/workflow';
import { AgentRegistry, AgentRecord, RoutingContext } from './AgentRegistry';
import { AgentRoutingScorer, AgentScoreBreakdown } from './AgentRoutingScorer';

export interface StageRoute {
  stage: WorkflowStage;
  lifecycle_stage: LifecycleStage;
  dependencies: string[];
  selected_agent: AgentRecord;
  fallback_agents: AgentRecord[];
  score: AgentScoreBreakdown;
  sticky_session_applied: boolean;
  reason: string;
}

export class AgentRoutingLayer {
  constructor(
    private registry = new AgentRegistry(),
    private scorer = new AgentRoutingScorer()
  ) {}

  getRegistry(): AgentRegistry {
    return this.registry;
  }

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

  routeStage(dag: WorkflowDAG, stageId: string, context: RoutingContext): StageRoute {
    const stage = this.resolveStage(dag, stageId);
    const dependencies = this.resolveDependencies(dag, stageId);
    const lifecycle_stage = (context.lifecycle_stage as LifecycleStage) || stage.agent_type;
    const requiredCapabilities = this.registry.describeStageCapabilities(stage, context);
    const stickyAgent = this.registry.getStickyAgent(context.session_id);

    const candidates = this.registry.getAgentsByLifecycle(lifecycle_stage, true);

    if (candidates.length === 0) {
      this.propagateError(stageId, new Error('No registered agents available for lifecycle stage'));
    }

    const scoring = this.scorer.scoreCandidates(stage, candidates, { ...context, required_capabilities: requiredCapabilities }, stickyAgent?.id);

    const healthyCandidates = scoring.ranked.filter(score => score.agent.status === 'healthy');
    const selection = healthyCandidates[0] || scoring.ranked[0];

    if (!selection) {
      this.propagateError(stageId, new Error('No routable agents after scoring'));
    }

    if (context.session_id) {
      this.registry.markStickySession(context.session_id, selection.agent.id);
    }
    this.registry.recordAssignment(selection.agent.id);

    const fallbackAgents = scoring.ranked.filter(score => score.agent.id !== selection.agent.id).map(score => score.agent);
    const reason = this.buildRoutingReason(stage, dependencies, selection, requiredCapabilities, stickyAgent, fallbackAgents);

    return {
      stage,
      lifecycle_stage,
      dependencies,
      selected_agent: selection.agent,
      fallback_agents: fallbackAgents,
      score: selection,
      sticky_session_applied: Boolean(stickyAgent),
      reason
    };
  }

  propagateError(stageId: string, error: Error): never {
    throw new Error(`Routing error at stage ${stageId}: ${error.message}`);
  }

  private buildRoutingReason(
    stage: WorkflowStage,
    dependencies: string[],
    selection: AgentScoreBreakdown,
    requiredCapabilities: string[],
    stickyAgent?: AgentRecord,
    fallbackAgents: AgentRecord[] = []
  ): string {
    const parts = [
      `Routing ${stage.id} to ${selection.agent.lifecycle_stage} agent ${selection.agent.name} with dependencies [${dependencies.join(', ')}]`
    ];

    if (requiredCapabilities.length > 0) {
      parts.push(`capabilities matched ${requiredCapabilities.length - selection.capabilityMismatches.length}/${requiredCapabilities.length}`);
    }

    if (stickyAgent) {
      parts.push(`stickiness honored for session (${stickyAgent.id})`);
    }

    if (selection.capabilityMismatches.length > 0) {
      parts.push(`missing capabilities: ${selection.capabilityMismatches.join(', ')}`);
    }

    if (selection.agent.status === 'degraded') {
      parts.push('selected degraded agent due to healthy pool exhaustion');
    }

    if (fallbackAgents.length > 0) {
      parts.push(`fallbacks: ${fallbackAgents.map(f => f.name).join(', ')}`);
    }

    return parts.join(' | ');
  }
}

export const agentRoutingLayer = new AgentRoutingLayer();
