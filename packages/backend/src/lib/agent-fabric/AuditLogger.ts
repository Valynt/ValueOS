/**
 * AuditLogger — agent-fabric audit trail
 *
 * Delegates to AuditLogService to produce immutable audit entries for:
 *   - LLM invocations (secureInvoke start/end, model, latency)
 *   - Memory store operations (table, tenant, key)
 *   - Veto decisions (agent, case ID, claim ID, reason)
 *
 * BaseAgent wires this — no agent subclass changes required.
 * All entries include tenantId per the 2026-08-04 audit_logs decision.
 */

import { logger } from "../logger.js";
import { AuditLogService } from "../../services/security/AuditLogService.js";

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

export class AuditLogger {
  private readonly auditLogService: AuditLogService;

  constructor(auditLogService?: AuditLogService) {
    this.auditLogService = auditLogService ?? new AuditLogService();
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
        details: {
          agent: params.agentName,
          model: params.model,
          latency_ms: params.latencyMs,
          hallucination_passed: params.hallucinationPassed,
          grounding_score: params.groundingScore,
          token_usage: params.tokenUsage,
        },
        status: "success",
        correlationId: params.sessionId,
      });
    } catch (err) {
      // Audit failures must not break agent execution.
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
        details: {
          agent: params.agentName,
          memory_type: params.memoryType,
          key_preview: params.keyPreview,
        },
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
        details: {
          agent: params.agentName,
          case_id: params.caseId,
          claim_id: params.claimId,
          reason: params.reason,
          confidence: params.confidence,
        },
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
}

export const auditlogger = new AuditLogger();
