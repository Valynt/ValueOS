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
 *
 * Sprint 5.5: Added LRU caching for evaluate() results to reduce redundant
 * rule processing for similar contexts. Cache key is derived from context
 * fingerprint (opportunity_id + lifecycle_stage + key state fields).
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

// Simple LRU Cache implementation for routing decisions
class LRUCache<K, V> {
  private cache: Map<K, V> = new Map();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

/**
 * Generate a cache key from DecisionContext.
 * Creates a deterministic fingerprint based on key routing fields.
 */
function generateContextCacheKey(context: DecisionContext): string {
  // Extract key fields that determine routing decisions
  const opportunityId = context.opportunity?.id ?? 'none';
  const stage = context.opportunity?.lifecycle_stage ?? 'unknown';

  // Include key state flags that affect routing
  const stateFlags = [
    context.hypothesis?.confidence ?? 'no_hyp',
    context.hypothesis?.evidence_count ? 'has_ev' : 'no_ev',
    context.business_case ? 'has_bc' : 'no_bc',
    context.is_external_artifact_action ? 'ext' : 'int',
    context.is_high_impact_decision ? 'hi' : 'lo',
  ].join(':');

  return `${opportunityId}:${stage}:${stateFlags}`;
}

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
  private evaluationCache: LRUCache<string, RoutingRecommendation | null>;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(routingLayer?: AgentRoutingLayer, rules?: RoutingRule[]) {
    this.routingLayer = routingLayer ?? new AgentRoutingLayer();
    // Rules are sorted by priority ascending at construction time so
    // evaluate() can short-circuit on the first match without re-sorting.
    this.rules = [...(rules ?? DOMAIN_ROUTING_RULES)].sort(
      (a, b) => a.priority - b.priority
    );
    // LRU cache for evaluation results - max 1000 entries
    this.evaluationCache = new LRUCache(1000);
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
   *
   * Results are cached based on context fingerprint for O(1) repeated lookups.
   */
  evaluate(context: DecisionContext): RoutingRecommendation | null {
    return runInTelemetrySpan('runtime.decision_router.evaluate', {
      service: 'decision-router',
      env: process.env.NODE_ENV || 'development',
      tenant_id: context.organization_id,
      trace_id: `decision-eval-${context.opportunity?.id ?? 'unknown'}`,
      attributes: { rule_count: this.rules.length },
    }, () => {
      // Check cache first
      const cacheKey = generateContextCacheKey(context);
      const cached = this.evaluationCache.get(cacheKey);

      if (cached !== undefined) {
        this.cacheHits++;
        return cached;
      }

      this.cacheMisses++;

      // Evaluate rules
      let result: RoutingRecommendation | null = null;
      for (const rule of this.rules) {
        const recommendation = rule.evaluate(context);
        if (recommendation !== null) {
          result = recommendation;
          break;
        }
      }

      // Cache the result (including null for "no match")
      this.evaluationCache.set(cacheKey, result);

      return result;
    });
  }

  /**
   * Get cache statistics for observability.
   */
  getCacheStats(): { hits: number; misses: number; size: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.evaluationCache.size,
      hitRate,
    };
  }

  /**
   * Clear the evaluation cache (useful for testing or rule hot-swaps).
   */
  clearCache(): void {
    this.evaluationCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
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
