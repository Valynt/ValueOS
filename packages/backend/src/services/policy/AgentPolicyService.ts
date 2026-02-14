import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const AgentPolicySchema = z.object({
  version: z.string().min(1),
  agent: z.string().min(1),
  allowedModels: z.array(z.string().min(1)).min(1),
  allowedTools: z.array(z.string().min(1)).min(1),
  maxTokens: z.number().int().positive(),
  maxCostUsd: z.number().positive(),
});

export type AgentPolicy = z.infer<typeof AgentPolicySchema>;

const AgentPolicySetSchema = z.array(AgentPolicySchema).min(1);

export class AgentPolicyService {
  private readonly policies: Map<string, AgentPolicy>;

  constructor(private readonly policyDir = path.resolve(process.cwd(), 'policies/agents')) {
    this.policies = this.loadAndValidate();
  }

  private loadAndValidate(): Map<string, AgentPolicy> {
    const files = readdirSync(this.policyDir).filter((file) => file.endsWith('.json'));
    const parsed = files.map((file) => {
      const payload = JSON.parse(readFileSync(path.join(this.policyDir, file), 'utf-8'));
      return AgentPolicySchema.parse(payload);
    });

    const validated = AgentPolicySetSchema.parse(parsed);
    return new Map(validated.map((policy) => [policy.agent, policy]));
  }

  getPolicy(agentType?: string): AgentPolicy {
    if (agentType && this.policies.has(agentType)) {
      return this.policies.get(agentType)!;
    }

    const defaultPolicy = this.policies.get('default');
    if (defaultPolicy) return defaultPolicy;

    throw new Error(`No policy found for agent: ${agentType ?? 'unknown'}`);
  }

  getPolicyVersion(agentType?: string): string {
    return this.getPolicy(agentType).version;
  }
}

let singleton: AgentPolicyService | null = null;

export function getAgentPolicyService(): AgentPolicyService {
  if (!singleton) {
    const policyDir = process.env.AGENT_POLICY_DIR
      ? path.resolve(process.env.AGENT_POLICY_DIR)
      : undefined;
    singleton = new AgentPolicyService(policyDir);
  }
  return singleton;
}

export function resetAgentPolicyServiceForTests(): void {
  singleton = null;
}
