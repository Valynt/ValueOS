/**
 * RiskClassifier — determines whether an agent action requires human approval.
 *
 * Classification is based on configurable intent lists, agent types, and
 * payload heuristics. No LLM calls.
 */

import { AgentMiddlewareContext } from '../UnifiedAgentOrchestrator.js';
import {
  RiskClassification,
  CheckpointConfig,
  DEFAULT_CHECKPOINT_CONFIG,
} from './types.js';

export class RiskClassifier {
  private config: CheckpointConfig;

  constructor(config: Partial<CheckpointConfig> = {}) {
    this.config = { ...DEFAULT_CHECKPOINT_CONFIG, ...config };
  }

  classify(context: AgentMiddlewareContext): RiskClassification {
    const reasons: string[] = [];
    let maxLevel: RiskClassification['riskLevel'] = 'low';

    // 1. Check agent type
    if (
      this.config.highRiskAgentTypes.includes(context.agentType)
    ) {
      reasons.push(`Agent type "${context.agentType}" is classified as high-risk`);
      maxLevel = this.elevate(maxLevel, 'high');
    }

    // 2. Check intent
    const intent = context.envelope?.intent ?? '';
    if (
      this.config.highRiskIntents.some(
        (ri) => intent.toLowerCase().includes(ri.toLowerCase()),
      )
    ) {
      reasons.push(`Intent "${intent}" matches a high-risk pattern`);
      maxLevel = this.elevate(maxLevel, 'high');
    }

    // 3. Check payload for destructive signals
    const payloadStr =
      typeof context.payload === 'string'
        ? context.payload
        : JSON.stringify(context.payload ?? '');

    if (this.containsDestructiveSignal(payloadStr)) {
      reasons.push('Payload contains destructive action signals');
      maxLevel = this.elevate(maxLevel, 'critical');
    }

    const requiresApproval = maxLevel !== 'low';

    return {
      isHighRisk: requiresApproval,
      riskLevel: maxLevel,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No risk signals detected',
      requiresApproval,
    };
  }

  /**
   * Check if the actor's roles allow bypassing the checkpoint.
   */
  canBypass(roles: string[] | undefined): boolean {
    if (!roles || !this.config.bypassRoles?.length) return false;
    return roles.some((r) => this.config.bypassRoles!.includes(r));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private elevate(
    current: RiskClassification['riskLevel'],
    candidate: RiskClassification['riskLevel'],
  ): RiskClassification['riskLevel'] {
    const order: Record<RiskClassification['riskLevel'], number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    return order[candidate] > order[current] ? candidate : current;
  }

  private containsDestructiveSignal(payload: string): boolean {
    const destructivePatterns = [
      /\bdelete\s+all\b/i,
      /\bdrop\s+table\b/i,
      /\btruncate\b/i,
      /\bpurge\b/i,
      /\bdestructive_action\b/i,
    ];
    return destructivePatterns.some((p) => p.test(payload));
  }
}
