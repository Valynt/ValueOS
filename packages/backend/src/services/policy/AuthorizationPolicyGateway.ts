import { createHash } from "node:crypto";

import { logger } from "../../lib/logger.js";

import {
  enforceToolPolicy,
  PolicyEnforcementError,
  recordPolicyAuditEvent,
} from "./PolicyEnforcement.js";

export type AuthorizationChannel =
  | "tool_registry"
  | "bfa_auth_guard"
  | "runtime_orchestration";

export interface AuthorizationSubject {
  userId?: string;
  tenantId?: string;
  organizationId?: string;
  sessionId?: string;
  agentType?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  decisionId: string;
  policyVersion: string;
  reason?: string;
}

export interface AuthorizationRequest {
  channel: AuthorizationChannel;
  action: string;
  resource: string;
  subject: AuthorizationSubject;
  mode?: "tool_policy" | "custom";
  policyVersion?: string;
  metadata?: Record<string, unknown>;
}

interface DecisionContext {
  request: AuthorizationRequest;
  policyVersion: string;
}

export type DecisionValidator = (context: DecisionContext) => void;

export class AuthorizationPolicyGateway {
  authorize(
    request: AuthorizationRequest,
    validator?: DecisionValidator
  ): AuthorizationDecision {
    const policyVersion =
      request.mode === "custom"
        ? (request.policyVersion ?? "custom")
        : enforceToolPolicy(request.subject.agentType, request.resource)
            .policyVersion;
    const decisionId = this.createDecisionId(request, policyVersion);

    try {
      validator?.({ request, policyVersion });

      const decision: AuthorizationDecision = {
        allowed: true,
        decisionId,
        policyVersion,
      };

      this.logDecision("policy.decision.allowed", decision, request);
      return decision;
    } catch (error) {
      if (error instanceof PolicyEnforcementError) {
        this.logDeniedDecision(
          decisionId,
          request,
          policyVersion,
          error.code,
          error.message
        );
      }
      throw error;
    }
  }

  deny(
    request: AuthorizationRequest,
    policyVersion: string,
    reason: string,
    details?: Record<string, unknown>
  ): never {
    const decisionId = this.createDecisionId(request, policyVersion);
    this.logDeniedDecision(
      decisionId,
      request,
      policyVersion,
      "TOOL_DENIED",
      reason,
      details
    );
    throw new PolicyEnforcementError("TOOL_DENIED", reason, {
      ...details,
      decisionId,
      policyVersion,
      channel: request.channel,
      action: request.action,
      resource: request.resource,
    });
  }

  private logDeniedDecision(
    decisionId: string,
    request: AuthorizationRequest,
    policyVersion: string,
    code: string,
    reason: string,
    details?: Record<string, unknown>
  ): void {
    const metadata = {
      ...request.metadata,
      ...details,
      decisionId,
      action: request.action,
      resource: request.resource,
      channel: request.channel,
      reason,
      code,
    };

    recordPolicyAuditEvent({
      eventType: "tool_denied",
      agentType: request.subject.agentType ?? "default",
      policyVersion,
      metadata,
    });

    logger.warn("policy.decision.denied", {
      decisionId,
      channel: request.channel,
      action: request.action,
      resource: request.resource,
      reason,
      code,
      policyVersion,
      subject: request.subject,
      metadata: request.metadata,
    });
  }

  private logDecision(
    event: string,
    decision: AuthorizationDecision,
    request: AuthorizationRequest
  ): void {
    logger.info(event, {
      decisionId: decision.decisionId,
      policyVersion: decision.policyVersion,
      channel: request.channel,
      action: request.action,
      resource: request.resource,
      subject: request.subject,
      metadata: request.metadata,
    });
  }

  private createDecisionId(
    request: AuthorizationRequest,
    policyVersion: string
  ): string {
    const hash = createHash("sha256");
    hash.update(
      JSON.stringify({
        channel: request.channel,
        action: request.action,
        resource: request.resource,
        subject: request.subject,
        policyVersion,
        traceId: request.metadata?.traceId,
        requestId: request.metadata?.requestId,
        sessionId: request.subject.sessionId,
      })
    );

    return `dec_${hash.digest("hex").slice(0, 16)}`;
  }
}

export const authorizationPolicyGateway = new AuthorizationPolicyGateway();

// Convenience wrapper: throws if the authorization decision is denied.
export function assertAuthorized(
  request: AuthorizationRequest,
  validator?: DecisionValidator
): void {
  const decision = authorizationPolicyGateway.authorize(request, validator);
  if (!decision.allowed) {
    throw new PolicyEnforcementError(
      decision.reason ?? "permission denied",
      "POLICY_DENIED",
      decision.policyVersion
    );
  }
}
