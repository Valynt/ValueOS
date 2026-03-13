/**
 * AuditLogger
 *
 * Facade over AuditLogService for agent-fabric callers. Provides a stable
 * injection interface used by ValueLifecycleOrchestrator and route handlers
 * while delegating persistence to the canonical AuditLogService.
 */

import { auditLogService } from "../../services/security/AuditLogService.js";
import { logger } from "../logger.js";

export interface AgentAuditEvent {
  /** Agent name (e.g. "OpportunityAgent") */
  agentName: string;
  /** Lifecycle action being audited (e.g. "execute", "veto", "memory_write") */
  action: string;
  /** Tenant / organization scoping this event */
  organizationId: string;
  /** Session or workspace ID */
  sessionId: string;
  /** User who triggered the agent run. Use "system" only for cron/background jobs. */
  userId: string;
  /** Outcome of the action */
  status: "success" | "failed";
  /** Arbitrary structured detail payload */
  details?: Record<string, unknown>;
}

export class AuditLogger {
  /**
   * Record an agent lifecycle event in the persistent audit trail.
   * Failures are logged but never thrown — audit must not break agent execution.
   */
  async logAgentEvent(event: AgentAuditEvent): Promise<void> {
    try {
      await auditLogService.logAudit({
        // Treat the agent as the acting "system" user; record the triggering user in details.
        userId: "system",
        userName: event.agentName,
        userEmail: `agent:${event.agentName.toLowerCase()}@valueos.internal`,
        action: `agent.${event.action}`,
        resourceType: "agent",
        resourceId: event.agentName,
        status: event.status,
        details: {
          session_id: event.sessionId,
          organization_id: event.organizationId,
          triggered_by_user_id: event.userId,
          ...event.details,
        },
        correlationId: event.sessionId,
      });
    } catch (err) {
      // Audit failures must not propagate — log and continue.
      logger.error("AuditLogger: failed to persist agent event", {
        agentName: event.agentName,
        action: event.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Record an LLM invocation for cost tracking and abuse investigation.
   */
  async logLLMInvocation(params: {
    agentName: string;
    organizationId: string;
    sessionId: string;
    userId: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    hallucinationCheck?: boolean;
    status: "success" | "failed";
  }): Promise<void> {
    await this.logAgentEvent({
      agentName: params.agentName,
      action: "llm_invocation",
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      userId: params.userId,
      status: params.status,
      details: {
        model: params.model,
        input_tokens: params.inputTokens,
        output_tokens: params.outputTokens,
        hallucination_check: params.hallucinationCheck,
      },
    });
  }

  /**
   * Record a veto decision from IntegrityAgent or ComplianceAuditorAgent.
   */
  async logVetoDecision(params: {
    agentName: string;
    organizationId: string;
    sessionId: string;
    userId: string;
    reason: string;
    targetAgent?: string;
  }): Promise<void> {
    await this.logAgentEvent({
      agentName: params.agentName,
      action: "veto",
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      userId: params.userId,
      status: "success",
      details: {
        reason: params.reason,
        target_agent: params.targetAgent,
      },
    });
  }
}
