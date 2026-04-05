/**
 * DecisionRouter
 *
 * Selects the next agent or action based on structured domain state.
 *
 * Sprint 2: Extracted from UnifiedAgentOrchestrator.selectAgent(). The
 * orchestrator delegates all routing decisions here via a thin facade.
 *
 * Sprint 5: Replaced selectAgentForQuery() keyword matching with
 * domain-state decisioning via DecisionContext. Rules live in ./rules/.
 * The legacy selectAgentForQuery() method is removed.
 */

import { DecisionContext } from '@shared/domain/DecisionContext';

import { runInTelemetrySpan } from '../../observability/telemetryStandards.js';
import { AgentType } from '../../services/agent-types.js';
import { AgentRegistry, RoutingContext } from '../../services/agents/AgentRegistry.js';
import { AgentRoutingLayer, StageRoute } from '../../services/agents/AgentRoutingLayer.js';
import { AgentRoutingScorer } from '../../services/agents/AgentRoutingScorer.js';
import { WorkflowDAG } from '../../types/workflow.js';
import { stageTransitionEventBus } from '../approval-inbox/StageTransitionEventBus.js';

import {
  DOMAIN_ROUTING_RULES,
  RoutingRecommendation,
  RoutingRule,
} from './rules/index.js';


export type { StageRoute, RoutingRecommendation, RoutingRule };
export { AgentRegistry, AgentRoutingLayer, AgentRoutingScorer };
export { DOMAIN_ROUTING_RULES } from './rules/index.js';
export * from './rules/types.js';

// ============================================================================
// DecisionRouter
// ============================================================================

export class DecisionRouter {
  private routingLayer: AgentRoutingLayer;
  private rules: RoutingRule[];

  constructor(routingLayer?: AgentRoutingLayer, rules?: RoutingRule[]) {
    this.routingLayer = routingLayer ?? new AgentRoutingLayer();
    // Rules are sorted by priority ascending at construction time so
    // evaluate() can short-circuit on the first match without re-sorting.
    this.rules = [...(rules ?? DOMAIN_ROUTING_RULES)].sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Select an agent for a DAG workflow stage.
   * Uses capability scoring, load balancing, and sticky sessions.
   */
  routeStage(dag: WorkflowDAG, stageId: string, context: RoutingContext): StageRoute {
    return runInTelemetrySpan('runtime.decision_router.route_stage', {
      service: 'decision-router',
      env: process.env.NODE_ENV || 'development',
      tenant_id: context.organizationId || 'unknown',
      trace_id: context.sessionId || `decision-route-${stageId}`,
      attributes: { stage_id: stageId },
    }, () => {
      const route = this.routingLayer.routeStage(dag, stageId, context);
      stageTransitionEventBus.publish({
        source: "decision-router",
        organizationId: context.organizationId || "unknown",
        runId: context.sessionId || `route-${stageId}`,
        stageId,
        transition: "stage_routed",
        metadata: {
          selected_agent_id: route.selected_agent?.id ?? null,
          fallback_reason: route.fallback_reason ?? null,
        },
      });
      return route;
    });
  }

  /**
   * Select the next agent and action for a free-form query using structured
   * domain state. Rules are evaluated in priority order; the first match wins.
   *
   * Returns null when no rule matches — callers should fall back to the
   * 'coordinator' agent.
   */
  evaluate(context: DecisionContext): RoutingRecommendation | null {
    return runInTelemetrySpan('runtime.decision_router.evaluate', {
      service: 'decision-router',
      env: process.env.NODE_ENV || 'development',
      tenant_id: context.organization_id,
      trace_id: `decision-eval-${context.opportunity?.id ?? 'unknown'}`,
      attributes: { rule_count: this.rules.length },
    }, () => {
      for (const rule of this.rules) {
        const recommendation = rule.evaluate(context);
        if (recommendation !== null) {
          return recommendation;
        }
      }
      return null;
    });
  }

  /**
   * Convenience wrapper: evaluate() and return the AgentType, defaulting to
   * 'coordinator' when no rule matches.
   */
  selectAgent(context: DecisionContext): AgentType {
    return this.evaluate(context)?.agent ?? 'coordinator';
  }

  getRoutingLayer(): AgentRoutingLayer {
    return this.routingLayer;
  }

  getRules(): RoutingRule[] {
    return [...this.rules];
  }
}

// Singleton for use by the orchestrator facade
export const decisionRouter = new DecisionRouter();
