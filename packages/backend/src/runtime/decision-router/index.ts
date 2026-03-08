/**
 * DecisionRouter
 *
 * Selects the next agent or action based on workflow state and domain context.
 *
 * Sprint 2: Extracted from UnifiedAgentOrchestrator.selectAgent() and the
 * AgentRoutingLayer/AgentRoutingScorer/AgentRegistry trio. The orchestrator
 * now delegates all routing decisions here via a thin facade.
 *
 * Sprint 5 target: Replace selectAgentForQuery() keyword matching with
 * structured domain-state decisioning via DecisionContext.
 */

import { AgentType } from '../../services/agent-types.js';
import { AgentRegistry, RoutingContext } from '../../services/AgentRegistry.js';
import { AgentRoutingLayer, StageRoute } from '../../services/AgentRoutingLayer.js';
import { AgentRoutingScorer } from '../../services/AgentRoutingScorer.js';
import { WorkflowDAG } from '../../types/workflow.js';

/** Minimal workflow state shape needed for query-based routing. */
export interface QueryRoutingState {
  currentStage: string;
}

export type { StageRoute };
export { AgentRegistry, AgentRoutingLayer, AgentRoutingScorer };

// ============================================================================
// DecisionRouter
// ============================================================================

export class DecisionRouter {
  private routingLayer: AgentRoutingLayer;

  constructor(routingLayer?: AgentRoutingLayer) {
    this.routingLayer = routingLayer ?? new AgentRoutingLayer();
  }

  /**
   * Select an agent for a DAG workflow stage.
   * Uses capability scoring, load balancing, and sticky sessions.
   */
  routeStage(dag: WorkflowDAG, stageId: string, context: RoutingContext): StageRoute {
    return this.routingLayer.routeStage(dag, stageId, context);
  }

  /**
   * Select an agent for a free-form query against current workflow state.
   *
   * @deprecated Sprint 5 will replace this with domain-state decisioning via
   * DecisionContext. The keyword matching below is preserved from the original
   * UnifiedAgentOrchestrator.selectAgent() to maintain behavioral parity during
   * the transition.
   */
  selectAgentForQuery(query: string, state: QueryRoutingState): AgentType {
    const lowerQuery = query.toLowerCase();

    // Stage-based routing takes priority over keyword matching
    switch (state.currentStage) {
      case 'discovery':
        return 'company-intelligence';
      case 'research':
        return 'research';
      case 'analysis':
        return 'system-mapper';
      case 'benchmarking':
        return 'benchmark';
      case 'design':
        return 'intervention-designer';
      case 'modeling':
        return 'financial-modeling';
      case 'narrative':
        return 'narrative';
      default:
        break;
    }

    // Keyword-based fallback — to be replaced in Sprint 5
    if (
      lowerQuery.includes('research') ||
      lowerQuery.includes('company intel') ||
      lowerQuery.includes('persona')
    ) {
      return 'research';
    }

    if (
      lowerQuery.includes('benchmark') ||
      lowerQuery.includes('industry') ||
      lowerQuery.includes('compare')
    ) {
      return 'benchmark';
    }

    if (
      lowerQuery.includes('narrative') ||
      lowerQuery.includes('story') ||
      lowerQuery.includes('present') ||
      lowerQuery.includes('explain')
    ) {
      return 'narrative';
    }

    if (lowerQuery.includes('roi') || lowerQuery.includes('financial')) {
      return 'financial-modeling';
    }

    if (lowerQuery.includes('system') || lowerQuery.includes('map')) {
      return 'system-mapper';
    }

    if (lowerQuery.includes('intervention') || lowerQuery.includes('solution')) {
      return 'intervention-designer';
    }

    if (lowerQuery.includes('outcome') || lowerQuery.includes('result')) {
      return 'outcome-engineer';
    }

    if (lowerQuery.includes('expand') || lowerQuery.includes('growth')) {
      return 'expansion';
    }

    if (lowerQuery.includes('value') || lowerQuery.includes('opportunity')) {
      return 'opportunity';
    }

    return 'coordinator';
  }

  getRoutingLayer(): AgentRoutingLayer {
    return this.routingLayer;
  }
}

// Singleton for use by the orchestrator facade
export const decisionRouter = new DecisionRouter();
