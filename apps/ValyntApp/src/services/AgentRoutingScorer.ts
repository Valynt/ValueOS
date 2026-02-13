import { WorkflowStage } from '../types/workflow';
import { AgentRecord, RoutingContext } from './AgentRegistry';

export interface AgentScoreBreakdown {
  agent: AgentRecord;
  total: number;
  capabilityScore: number;
  loadScore: number;
  proximityScore: number;
  stickinessScore: number;
  capabilityMismatches: string[];
}

export interface ScoringResult {
  ranked: AgentScoreBreakdown[];
  stickyApplied: boolean;
}

export interface AgentScoringWeights {
  capability: number;
  load: number;
  proximity: number;
  stickiness: number;
}

export const DEFAULT_AGENT_SCORING_WEIGHTS: AgentScoringWeights = {
  capability: 0.4,
  load: 0.2,
  proximity: 0.2,
  stickiness: 0.2
};

export class AgentRoutingScorer {
  constructor(private weights: AgentScoringWeights = DEFAULT_AGENT_SCORING_WEIGHTS) {}

  scoreCandidates(
    stage: WorkflowStage,
    candidates: AgentRecord[],
    context: RoutingContext,
    stickyAgentId?: string
  ): ScoringResult {
    const requiredCapabilities = stage.required_capabilities || context.required_capabilities || [];

    const ranked = candidates
      .map(agent => {
        const capabilityMismatches = requiredCapabilities.filter(cap => !agent.capabilities.includes(cap));
        const capabilityScore = requiredCapabilities.length === 0
          ? 1
          : (requiredCapabilities.length - capabilityMismatches.length) / requiredCapabilities.length;

        const loadScore = 1 - Math.min(1, agent.load);
        const proximityScore = context.region && agent.region
          ? (context.region === agent.region ? 1 : 0.25)
          : 0.5;
        const stickinessScore = stickyAgentId && stickyAgentId === agent.id ? 1 : 0;

        const total =
          capabilityScore * this.weights.capability +
          loadScore * this.weights.load +
          proximityScore * this.weights.proximity +
          stickinessScore * this.weights.stickiness;

        return {
          agent,
          total,
          capabilityScore,
          loadScore,
          proximityScore,
          stickinessScore,
          capabilityMismatches
        } as AgentScoreBreakdown;
      })
      .sort((a, b) => b.total - a.total);

    return {
      ranked,
      stickyApplied: Boolean(stickyAgentId)
    };
  }
}
