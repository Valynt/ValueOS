/**
 * Routing rule types for domain-driven decisioning.
 *
 * Each rule is a pure function: DecisionContext → RoutingRecommendation | null.
 * Rules return null when they do not apply to the given context.
 * The router evaluates rules in priority order and returns the first match.
 */

import { DecisionContext } from '@shared/domain/DecisionContext';
import { AgentType } from '../../../services/agent-types.js';

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

/**
 * The action the router recommends based on domain state.
 * Maps to an agent type and an optional action name for finer-grained
 * orchestration (e.g. the same agent can perform different actions).
 */
export interface RoutingRecommendation {
  /** The agent that should handle the next step. */
  agent: AgentType;
  /**
   * Logical action name within the agent's capability set.
   * Used by the orchestrator to select the right method/prompt.
   */
  action: RoutingAction;
  /**
   * Human-readable explanation of why this recommendation was made.
   * Included in audit logs and OTel spans.
   */
  reasoning: string;
  /**
   * Priority of the rule that produced this recommendation (lower = higher priority).
   * Preserved for observability.
   */
  rule_priority: number;
}

/**
 * Canonical action names used across routing rules.
 * Extend this union as new agent capabilities are added.
 */
export type RoutingAction =
  | 'generateBusinessCase'
  | 'gatherEvidence'
  | 'validateHypotheses'
  | 'generateHypotheses'
  | 'buildFinancialModel'
  | 'mapStakeholders'
  | 'planRealization'
  | 'identifyExpansion'
  | 'requireHumanApproval'
  | 'coordinateNext';

// ---------------------------------------------------------------------------
// Rule interface
// ---------------------------------------------------------------------------

/**
 * A single domain-driven routing rule.
 *
 * Rules are stateless and side-effect-free. They must not call external
 * services or perform I/O. All required data must be present in the context.
 */
export interface RoutingRule {
  /**
   * Unique identifier for this rule. Used in audit logs.
   */
  readonly id: string;
  /**
   * Lower number = evaluated first. Rules with the same priority are
   * evaluated in registration order.
   */
  readonly priority: number;
  /**
   * Human-readable description of when this rule fires.
   */
  readonly description: string;
  /**
   * Evaluate the rule against the given context.
   * Returns a recommendation if the rule applies, null otherwise.
   */
  evaluate(context: DecisionContext): RoutingRecommendation | null;
}
