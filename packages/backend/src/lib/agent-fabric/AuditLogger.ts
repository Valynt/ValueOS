/**
 * AuditLogger — agent-fabric audit trail
 *
 * Delegates to AuditLogService to produce immutable audit entries for:
 *   - LLM invocations (secureInvoke start/end, model, latency)
 *   - Memory store operations (table, tenant, key)
 *   - Veto decisions (agent, case ID, claim ID, reason)
 *   - Generic agent lifecycle events (execute, compensate, etc.)
 *
 * BaseAgent wires this — no agent subclass changes required.
 * All entries include tenantId per the 2026-08-04 audit_logs decision.
 */

import { AuditLogService } from "../../services/security/AuditLogService.js";
import { logger } from "../logger.js";

import { redactSensitiveText } from "./redaction.js";

/**
 * Recursively redact PII from all string values in an audit details object.
 * Numeric and boolean values pass through unchanged.
 */
function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details)) {
    if (typeof v === "string") {
      out[k] = redactSensitiveText(v).redactedText;
    } else if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactDetails(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export interface LLMInvocationAuditParams {
  agentName: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  model: string;
  latencyMs: number;
  hallucinationPassed: boolean;
  groundingScore: number;
  tokenUsage?: { input_tokens: number; output_tokens: number; total_tokens: number };
}

export interface MemoryStoreAuditParams {
  agentName: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  memoryType: string;
  /** First 80 chars of the memory key/content — must not contain PII. */
  keyPreview: string;
}

export interface VetoDecisionAuditParams {
  agentName: string;
  sessionId: string;
  tenantId: string;
  userId: string;
  caseId: string;
  claimId?: string;
  reason: string;
  confidence: number;
}

/**
 * Generic agent lifecycle event — used by ValueLifecycleOrchestrator to record
 * execute/compensate outcomes without requiring a typed params interface.
 */
export interface AgentAuditEvent {
  agentName: string;
  action: string;
  organizationId: string;
  sessionId: string;
  userId: string;
  status: "success" | "failed";
  details?: Record<string, unknown>;
}

export interface AgentSecurityAuditParams {
  agentName: string;
  tenantId: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
}

export class AuditLogger {
  private readonly auditLogService: AuditLogService;

  constructor(auditLogService?: AuditLogService) {
    this.auditLogService = auditLogService ?? new AuditLogService();
  }

  async logAgentSecurity(params: AgentSecurityAuditParams): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: params.userId,
        userName: params.agentName,
        userEmail: `agent:${params.agentName}`,
        action: `agent.security.${params.action}`,
        resourceType: "agent",
        resourceId: params.agentName,
        tenantId: params.tenantId,
        details: redactDetails(params.details),
        status: "failed",
      });
    } catch (err) {
      logger.warn("AuditLogger: failed to log agent security event", {
        agent: params.agentName,
        action: params.action,
        err,
      });
    }
  }

  async logLLMInvocation(params: LLMInvocationAuditParams): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: params.userId,
        userName: params.agentName,
        userEmail: `agent:${params.agentName}`,
        action: "agent.llm_invocation",
        resourceType: "agent_session",
        resourceId: params.sessionId,
        tenantId: params.tenantId,
        details: redactDetails({
          agent: params.agentName,
          model: params.model,
          latency_ms: params.latencyMs,
          hallucination_passed: params.hallucinationPassed,
          grounding_score: params.groundingScore,
          token_usage: params.tokenUsage,
        }),
        status: "success",
        correlationId: params.sessionId,
      });
    } catch (err) {
      logger.warn("AuditLogger: failed to log LLM invocation", {
        agent: params.agentName,
        session_id: params.sessionId,
        err,
      });
    }
  }

  async logMemoryStore(params: MemoryStoreAuditParams): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: params.userId,
        userName: params.agentName,
        userEmail: `agent:${params.agentName}`,
        action: "agent.memory_store",
        resourceType: "semantic_memory",
        resourceId: params.sessionId,
        tenantId: params.tenantId,
        details: redactDetails({
          agent: params.agentName,
          memory_type: params.memoryType,
          key_preview: params.keyPreview,
        }),
        status: "success",
        correlationId: params.sessionId,
      });
    } catch (err) {
      logger.warn("AuditLogger: failed to log memory store", {
        agent: params.agentName,
        session_id: params.sessionId,
        err,
      });
    }
  }

  async logVetoDecision(params: VetoDecisionAuditParams): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        userId: params.userId,
        userName: params.agentName,
        userEmail: `agent:${params.agentName}`,
        action: "agent.veto_decision",
        resourceType: "value_case",
        resourceId: params.caseId,
        tenantId: params.tenantId,
        details: redactDetails({
          agent: params.agentName,
          case_id: params.caseId,
          claim_id: params.claimId,
          reason: params.reason,
          confidence: params.confidence,
        }),
        status: "success",
        correlationId: params.sessionId,
      });
    } catch (err) {
      logger.warn("AuditLogger: failed to log veto decision", {
        agent: params.agentName,
        session_id: params.sessionId,
        err,
      });
    }
  }

  /**
   * Record a generic agent lifecycle event (execute, compensate, etc.).
   * Used by ValueLifecycleOrchestrator. Failures are swallowed — audit must
   * not interrupt orchestration.
   */
  async logAgentEvent(event: AgentAuditEvent): Promise<void> {
    try {
      await this.auditLogService.logAudit({
        // Treat the agent as the acting "system" user; record the triggering user in details.
        userId: "system",
        userName: event.agentName,
        userEmail: `agent:${event.agentName.toLowerCase()}@valueos.internal`,
        action: `agent.${event.action}`,
        resourceType: "agent",
        resourceId: event.agentName,
        tenantId: event.organizationId,
        status: event.status,
        details: {
          session_id: event.sessionId,
          triggered_by_user_id: event.userId,
          organization_id: event.organizationId,
          ...event.details,
        },
        correlationId: event.sessionId,
      });
    } catch (err) {
      logger.warn("AuditLogger: failed to log agent event", {
        agentName: event.agentName,
        action: event.action,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// Lazy singleton — constructed on first access so AuditLogService dependencies
// (Supabase client, env vars) are available by the time the instance is created.
let _auditlogger: AuditLogger | null = null;
export function getAuditLogger(): AuditLogger {
  if (_auditlogger === null) {
    _auditlogger = new AuditLogger();
  }
  return _auditlogger;
}
