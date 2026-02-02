/**
 * Business Rules Engine
 */

export interface Rule {
  id: string;
  name: string;
  condition: (context: any) => boolean;
  action: (context: any) => void | Promise<void>;
}

export interface EnforcementResult {
  allowed: boolean;
  violations: RuleViolation[];
  warnings: RuleWarning[];
  metadata?: Record<string, unknown>;
}

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  message: string;
  severity: "error" | "critical";
}

export interface RuleWarning {
  ruleId: string;
  ruleName: string;
  message: string;
}

export async function enforceRules(
  context: Record<string, unknown>,
  ruleIds?: string[]
): Promise<EnforcementResult> {
  // Stub implementation - returns allowed by default
  return {
    allowed: true,
    violations: [],
    warnings: [],
    metadata: { ruleIds, contextKeys: Object.keys(context) },
  };
}

export class RulesEngine {
  private rules: Map<string, Rule> = new Map();

  registerRule(rule: Rule): void {
    this.rules.set(rule.id, rule);
  }

  async evaluate(context: any): Promise<void> {
    for (const rule of this.rules.values()) {
      if (rule.condition(context)) {
        await rule.action(context);
      }
    }
  }
}
