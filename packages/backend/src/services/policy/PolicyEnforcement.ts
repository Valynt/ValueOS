import { logger } from '../../lib/logger.js';
import { securityEventStreamingService } from '../security/SecurityEventStreamingService.js';

import { getAgentPolicyService } from './AgentPolicyService.js';
import { assertAuthorized } from './AuthorizationPolicyGateway.js';

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

  const tenantId = typeof event.metadata?.tenant_id === 'string' ? event.metadata.tenant_id : undefined;
  if (tenantId) {
    void securityEventStreamingService.stream({
      source: 'security_audit_log',
      category: 'policy',
      eventType: event.eventType,
      tenantId,
      actorId: (typeof event.metadata?.actor_id === 'string' ? event.metadata.actor_id : event.agentType) ?? 'system',
      action: event.eventType,
      resourceType: 'policy',
      resourceId: (typeof event.metadata?.resource === 'string' ? event.metadata.resource : event.agentType) ?? 'policy',
      outcome: event.eventType === 'llm_call' ? 'success' : 'denied',
      sourceService: 'PolicyEnforcement',
      correlationId: typeof event.metadata?.correlation_id === 'string' ? event.metadata.correlation_id : undefined,
      metadata: { policyVersion: event.policyVersion, ...(event.metadata ?? {}) },
    });
  }
}

export function enforceToolPolicy(agentType: string | undefined, toolName: string): { policyVersion: string } {
  const decision = assertAuthorized({
    domain: 'tool_execution',
    action: 'execute',
    resource: toolName,
    agentType,
  });

  return { policyVersion: decision.policyVersion };
}

export function enforceModelPolicy(agentType: string | undefined, model: string): { policyVersion: string } {
  const policy = getAgentPolicyService().getPolicy(agentType);
  if (!policy.allowedModels.includes(model)) {
    recordPolicyAuditEvent({
      eventType: 'model_denied',
      agentType: agentType ?? 'default',
      policyVersion: policy.version,
      metadata: { model, allowedModels: policy.allowedModels, resource: model },
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
      metadata: { budget, limits: { maxTokens: policy.maxTokens, maxCostUsd: policy.maxCostUsd }, resource: 'budget' },
    });
    throw new PolicyEnforcementError(
      'BUDGET_EXCEEDED',
      `Budget exceeded for agent '${agentType ?? 'default'}'`,
      { budget, limits: { maxTokens: policy.maxTokens, maxCostUsd: policy.maxCostUsd }, policyVersion: policy.version }
    );
  }

  return { policyVersion: policy.version };
}
