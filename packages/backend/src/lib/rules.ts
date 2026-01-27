/**
 * Business Rules Engine
 */

export interface Rule {
  id: string;
  name: string;
  condition: (context: any) => boolean;
  action: (context: any) => void | Promise<void>;
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
