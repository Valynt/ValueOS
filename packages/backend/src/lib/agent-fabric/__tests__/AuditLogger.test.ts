import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { AuditLogService } from "../../../services/security/AuditLogService.js";
import { AuditLogger, getAuditLogger } from "../AuditLogger.js";

function makeMockAuditLogService() {
  return {
    logAudit: vi.fn().mockResolvedValue({ id: "audit-1" }),
  } as unknown as AuditLogService;
}

describe("AuditLogger", () => {
  let mockService: AuditLogService;
  let auditLogger: AuditLogger;

  beforeEach(() => {
    mockService = makeMockAuditLogService();
    auditLogger = new AuditLogger(mockService);
  });

  describe("logLLMInvocation", () => {
    it("delegates to AuditLogService with correct fields", async () => {
      await auditLogger.logLLMInvocation({
        agentName: "OpportunityAgent",
        sessionId: "sess-001",
        tenantId: "tenant-abc",
        userId: "user-xyz",
        model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        latencyMs: 1234,
        hallucinationPassed: true,
        groundingScore: 0.92,
      });

      expect(mockService.logAudit).toHaveBeenCalledOnce();
      const call = vi.mocked(mockService.logAudit).mock.calls[0][0];
      expect(call.action).toBe("agent.llm_invocation");
      expect(call.userId).toBe("user-xyz");
      expect(call.tenantId).toBe("tenant-abc");
      expect(call.resourceId).toBe("sess-001");
      expect(call.details?.agent).toBe("OpportunityAgent");
      expect(call.details?.hallucination_passed).toBe(true);
      expect(call.details?.grounding_score).toBe(0.92);
    });

    it("does not throw when AuditLogService fails", async () => {
      vi.mocked(mockService.logAudit).mockRejectedValueOnce(new Error("db down"));

      await expect(
        auditLogger.logLLMInvocation({
          agentName: "TargetAgent",
          sessionId: "sess-002",
          tenantId: "tenant-abc",
          userId: "user-xyz",
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          latencyMs: 500,
          hallucinationPassed: false,
          groundingScore: 0.3,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("logMemoryStore", () => {
    it("delegates to AuditLogService with correct fields", async () => {
      await auditLogger.logMemoryStore({
        agentName: "IntegrityAgent",
        sessionId: "sess-003",
        tenantId: "tenant-abc",
        userId: "user-xyz",
        memoryType: "episodic",
        keyPreview: "claim validation result for case-001",
      });

      expect(mockService.logAudit).toHaveBeenCalledOnce();
      const call = vi.mocked(mockService.logAudit).mock.calls[0][0];
      expect(call.action).toBe("agent.memory_store");
      expect(call.resourceType).toBe("semantic_memory");
      expect(call.details?.memory_type).toBe("episodic");
      expect(call.details?.key_preview).toBe("claim validation result for case-001");
    });
  });

  describe("logVetoDecision", () => {
    it("delegates to AuditLogService with correct fields", async () => {
      await auditLogger.logVetoDecision({
        agentName: "IntegrityAgent",
        sessionId: "sess-004",
        tenantId: "tenant-abc",
        userId: "user-xyz",
        caseId: "case-001",
        claimId: "claim-007",
        reason: "ROI claim lacks supporting evidence",
        confidence: 0.85,
      });

      expect(mockService.logAudit).toHaveBeenCalledOnce();
      const call = vi.mocked(mockService.logAudit).mock.calls[0][0];
      expect(call.action).toBe("agent.veto_decision");
      expect(call.resourceType).toBe("value_case");
      expect(call.resourceId).toBe("case-001");
      expect(call.details?.claim_id).toBe("claim-007");
      expect(call.details?.reason).toBe("ROI claim lacks supporting evidence");
      expect(call.details?.confidence).toBe(0.85);
    });

    it("does not throw when AuditLogService fails", async () => {
      vi.mocked(mockService.logAudit).mockRejectedValueOnce(new Error("network error"));

      await expect(
        auditLogger.logVetoDecision({
          agentName: "IntegrityAgent",
          sessionId: "sess-005",
          tenantId: "tenant-abc",
          userId: "user-xyz",
          caseId: "case-002",
          reason: "insufficient evidence",
          confidence: 0.7,
        })
      ).resolves.toBeUndefined();
    });
  });
});

describe("getAuditLogger — lazy singleton (bug fix)", () => {
  // Regression: `export const auditlogger = new AuditLogger()` ran at import
  // time, constructing AuditLogService before dependencies were ready.
  // The fix replaces it with a lazy getter that constructs on first call.

  it("returns an AuditLogger instance", () => {
    const instance = getAuditLogger();
    expect(instance).toBeInstanceOf(AuditLogger);
  });

  it("returns the same instance on repeated calls (singleton)", () => {
    const a = getAuditLogger();
    const b = getAuditLogger();
    expect(a).toBe(b);
  });
});
