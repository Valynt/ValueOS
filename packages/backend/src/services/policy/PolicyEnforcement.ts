import { logger } from '../../lib/logger.js';

import { getAgentPolicyService } from './AgentPolicyService.js';

export type PolicyErrorCode = 'TOOL_DENIED' | 'MODEL_DENIED' | 'BUDGET_EXCEEDED';

export class PolicyEnforcementError extends Error {
  constructor(
    public readonly code: PolicyErrorCode,
    message: string,
    public readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'PolicyEnforcementError';
  }
}

export interface PolicyAuditEvent {
  eventType: 'tool_denied' | 'model_denied' | 'budget_exceeded' | 'llm_call';
  agentType: string;
  policyVersion: string;
  metadata?: Record<string, unknown>;
}

export function recordPolicyAuditEvent(event: PolicyAuditEvent): void {
  logger.warn('policy.audit', event);
}

export function enforceToolPolicy(agentType: string | undefined, toolName: string): { policyVersion: string } {
  const policy = getAgentPolicyService().getPolicy(agentType);
  if (!policy.allowedTools.includes(toolName)) {
    recordPolicyAuditEvent({
      eventType: 'tool_denied',
      agentType: agentType ?? 'default',
      policyVersion: policy.version,
      metadata: { toolName, allowedTools: policy.allowedTools },
    });
    throw new PolicyEnforcementError(
      'TOOL_DENIED',
      `Tool '${toolName}' is not permitted for agent '${agentType ?? 'default'}'`,
      { toolName, agentType, policyVersion: policy.version }
    );
  }

  return { policyVersion: policy.version };
}

export function enforceModelPolicy(agentType: string | undefined, model: string): { policyVersion: string } {
  const policy = getAgentPolicyService().getPolicy(agentType);
  if (!policy.allowedModels.includes(model)) {
    recordPolicyAuditEvent({
      eventType: 'model_denied',
      agentType: agentType ?? 'default',
      policyVersion: policy.version,
      metadata: { model, allowedModels: policy.allowedModels },
    });
    throw new PolicyEnforcementError(
      'MODEL_DENIED',
      `Model '${model}' is not permitted for agent '${agentType ?? 'default'}'`,
      { model, agentType, policyVersion: policy.version }
    );
  }

  return { policyVersion: policy.version };
}

export function enforceBudgetPolicy(
  agentType: string | undefined,
  budget: { totalTokens: number; estimatedCostUsd: number }
): { policyVersion: string } {
  const policy = getAgentPolicyService().getPolicy(agentType);
  if (budget.totalTokens > policy.maxTokens || budget.estimatedCostUsd > policy.maxCostUsd) {
    recordPolicyAuditEvent({
      eventType: 'budget_exceeded',
      agentType: agentType ?? 'default',
      policyVersion: policy.version,
      metadata: { budget, limits: { maxTokens: policy.maxTokens, maxCostUsd: policy.maxCostUsd } },
    });
    throw new PolicyEnforcementError(
      'BUDGET_EXCEEDED',
      `Budget exceeded for agent '${agentType ?? 'default'}'`,
      { budget, limits: { maxTokens: policy.maxTokens, maxCostUsd: policy.maxCostUsd }, policyVersion: policy.version }
    );
  }

  return { policyVersion: policy.version };
}
