import { createHash } from 'node:crypto';

import { logger } from '../../lib/logger.js';

import { getAgentPolicyService } from './AgentPolicyService.js';
import { PolicyEnforcementError, type PolicyErrorCode } from './PolicyEnforcement.js';

export type AuthorizationDomain = 'tool_execution' | 'bfa_tool_execution' | 'agent_side_effect';

export interface AuthorizationRequest {
  domain: AuthorizationDomain;
  action: string;
  resource: string;
  agentType?: string;
  actorId?: string;
  actorPermissions?: readonly string[];
  requiredPermissions?: readonly string[];
  tenantId?: string;
  traceId?: string;
  invocationId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthorizationDecision {
  decisionId: string;
  allowed: boolean;
  reason: string;
  policyVersion: string;
  code?: PolicyErrorCode;
}

export interface AuthorizationPolicyGateway {
  authorize(request: AuthorizationRequest): AuthorizationDecision;
}

class DefaultAuthorizationPolicyGateway implements AuthorizationPolicyGateway {
  authorize(request: AuthorizationRequest): AuthorizationDecision {
    const policyVersion = getAgentPolicyService().getPolicyVersion(request.agentType);
    const decisionId = this.createDecisionId(request);

    if (request.domain === 'bfa_tool_execution') {
      return this.evaluatePermissionDecision(request, policyVersion, decisionId);
    }

    return this.evaluateAgentPolicyDecision(request, policyVersion, decisionId);
  }

  private evaluatePermissionDecision(
    request: AuthorizationRequest,
    policyVersion: string,
    decisionId: string,
  ): AuthorizationDecision {
    const requiredPermissions = request.requiredPermissions ?? [];
    const actorPermissions = new Set(request.actorPermissions ?? []);
    const missingPermissions = requiredPermissions.filter((permission) => !actorPermissions.has(permission));

    if (missingPermissions.length > 0) {
      const decision: AuthorizationDecision = {
        decisionId,
        allowed: false,
        reason: `Missing required permissions: ${missingPermissions.join(', ')}`,
        policyVersion,
        code: 'TOOL_DENIED',
      };
      this.logDecision(request, decision, { missingPermissions });
      return decision;
    }

    const decision: AuthorizationDecision = {
      decisionId,
      allowed: true,
      reason: 'Allowed by permission policy',
      policyVersion,
    };
    this.logDecision(request, decision);
    return decision;
  }

  private evaluateAgentPolicyDecision(
    request: AuthorizationRequest,
    policyVersion: string,
    decisionId: string,
  ): AuthorizationDecision {
    const policy = getAgentPolicyService().getPolicy(request.agentType);

    if (!policy.allowedTools.includes(request.resource)) {
      const decision: AuthorizationDecision = {
        decisionId,
        allowed: false,
        reason: `Resource '${request.resource}' is not permitted for agent '${request.agentType ?? 'default'}'`,
        policyVersion,
        code: 'TOOL_DENIED',
      };
      this.logDecision(request, decision, { allowedTools: policy.allowedTools });
      return decision;
    }

    const decision: AuthorizationDecision = {
      decisionId,
      allowed: true,
      reason: 'Allowed by agent policy',
      policyVersion,
    };
    this.logDecision(request, decision);
    return decision;
  }

  private createDecisionId(request: AuthorizationRequest): string {
    const material = [
      request.invocationId ?? '',
      request.traceId ?? '',
      request.domain,
      request.action,
      request.resource,
      request.agentType ?? 'default',
      request.actorId ?? 'anonymous',
      request.tenantId ?? 'unknown-tenant',
    ].join('|');

    return createHash('sha256').update(material).digest('hex').slice(0, 16);
  }

  private logDecision(
    request: AuthorizationRequest,
    decision: AuthorizationDecision,
    extra: Record<string, unknown> = {},
  ): void {
    const payload = {
      decisionId: decision.decisionId,
      allowed: decision.allowed,
      domain: request.domain,
      action: request.action,
      resource: request.resource,
      agentType: request.agentType ?? 'default',
      actorId: request.actorId,
      tenantId: request.tenantId,
      policyVersion: decision.policyVersion,
      reason: decision.reason,
      traceId: request.traceId,
      ...extra,
      ...(request.metadata ?? {}),
    };

    if (decision.allowed) {
      logger.info('policy.decision', payload);
      return;
    }

    logger.warn('policy.decision', payload);
  }
}

let authorizationPolicyGateway: AuthorizationPolicyGateway = new DefaultAuthorizationPolicyGateway();

export function getAuthorizationPolicyGateway(): AuthorizationPolicyGateway {
  return authorizationPolicyGateway;
}

export function setAuthorizationPolicyGatewayForTests(gateway: AuthorizationPolicyGateway): void {
  authorizationPolicyGateway = gateway;
}

export function resetAuthorizationPolicyGatewayForTests(): void {
  authorizationPolicyGateway = new DefaultAuthorizationPolicyGateway();
}

export function assertAuthorized(request: AuthorizationRequest): AuthorizationDecision {
  const decision = getAuthorizationPolicyGateway().authorize(request);

  if (!decision.allowed) {
    throw new PolicyEnforcementError(
      decision.code ?? 'TOOL_DENIED',
      decision.reason,
      {
        decisionId: decision.decisionId,
        policyVersion: decision.policyVersion,
        domain: request.domain,
        action: request.action,
        resource: request.resource,
        agentType: request.agentType,
        traceId: request.traceId,
      },
    );
  }

  return decision;
}
