import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PolicyEngine,
  PolicyEngineOptions,
  ServiceReadiness,
  HITL_CONFIDENCE_THRESHOLD,
  PolicyCheckResult,
} from "../index.js";
import { DecisionContext } from "@shared/domain/DecisionContext.js";

// ============================================================================
// Shared mocks — hoisted so vi.mock factories can reference them
// ============================================================================

const { mockAppendEvidence, mockGetAutonomyConfig } = vi.hoisted(() => ({
  mockAppendEvidence: vi.fn(),
  mockGetAutonomyConfig: vi.fn(),
}));

// Injected directly into PolicyEngineOptions — no constructor mock needed
const mockGetActiveState = vi.fn();
const mockGetAgent = vi.fn();

vi.mock("../../../services/ComplianceEvidenceService.js", () => ({
  complianceEvidenceService: {
    appendEvidence: (...args: unknown[]) => mockAppendEvidence(...args),
  },
}));

vi.mock("../../../services/SecurityLogger.js", () => ({
  securityLogger: { log: vi.fn() },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { debug: vi.fn(), error: vi.fn() },
}));

vi.mock("../../../config/autonomy.js", () => ({
  getAutonomyConfig: () => mockGetAutonomyConfig(),
}));

// ============================================================================
// Helpers
// ============================================================================

function makeEngine(overrides: Partial<PolicyEngineOptions> = {}): PolicyEngine {
  const readiness: ServiceReadiness = {
    message_broker_ready: true,
    queue_ready: true,
    memory_backend_ready: true,
    llm_gateway_ready: true,
    circuit_breaker_ready: true,
  };

  return new PolicyEngine({
    supabase: {} as never,
    registry: { getAgent: mockGetAgent } as never,
    serviceReadiness: () => readiness,
    // Inject mock directly — avoids relying on constructor interception
    executionStateService: { getActiveState: mockGetActiveState },
    ...overrides,
  });
}

function baseContext(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: "org-1",
    organization_id: "org-1",
    cost_accumulated_usd: 0,
    approvals: {},
    executed_steps: [],
    ...overrides,
  };
}

const noopOnFailure = vi.fn().mockResolvedValue(undefined);

// ============================================================================
// Tests
// ============================================================================

describe("PolicyEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no autonomy restrictions
    mockGetAutonomyConfig.mockReturnValue({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Tenant guard
  // --------------------------------------------------------------------------

  describe("assertTenantExecutionAllowed", () => {
    it("passes when tenant is not paused", async () => {
      mockGetActiveState.mockResolvedValue(null);
      const engine = makeEngine();
      await expect(engine.assertTenantExecutionAllowed("org-1")).resolves.toBeUndefined();
    });

    it("passes when state exists but is_paused is false", async () => {
      mockGetActiveState.mockResolvedValue({ is_paused: false });
      const engine = makeEngine();
      await expect(engine.assertTenantExecutionAllowed("org-1")).resolves.toBeUndefined();
    });

    it("throws when tenant is paused", async () => {
      mockGetActiveState.mockResolvedValue({
        is_paused: true,
        paused_at: "2026-01-01T00:00:00Z",
        reason: "billing overdue",
      });
      const engine = makeEngine();
      await expect(engine.assertTenantExecutionAllowed("org-1")).rejects.toThrow(
        "Tenant execution is paused for organization org-1",
      );
    });

    it("includes reason and paused_at in the error message", async () => {
      mockGetActiveState.mockResolvedValue({
        is_paused: true,
        paused_at: "2026-03-01T12:00:00Z",
        reason: "manual suspension",
      });
      const engine = makeEngine();
      await expect(engine.assertTenantExecutionAllowed("org-1")).rejects.toThrow(
        "reason=manual suspension; paused_at=2026-03-01T12:00:00Z",
      );
    });

    it("uses fallback text when paused_at and reason are absent", async () => {
      mockGetActiveState.mockResolvedValue({ is_paused: true });
      const engine = makeEngine();
      await expect(engine.assertTenantExecutionAllowed("org-1")).rejects.toThrow(
        "reason=No reason provided; paused_at=unknown",
      );
    });
  });

  // --------------------------------------------------------------------------
  // Kill switch
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — kill switch", () => {
    it("throws immediately when global kill switch is enabled", async () => {
      mockGetAutonomyConfig.mockReturnValue({ killSwitchEnabled: true });
      const engine = makeEngine();
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", baseContext(), Date.now(), noopOnFailure),
      ).rejects.toThrow("Autonomy kill switch is enabled");
      // Kill switch does not call onFailure — it is a hard stop before any DB write
      expect(noopOnFailure).not.toHaveBeenCalled();
    });

    it("passes when kill switch is absent", async () => {
      mockGetAutonomyConfig.mockReturnValue({});
      const engine = makeEngine();
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", baseContext(), Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Duration limit
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — duration limit", () => {
    it("throws and calls onFailure when elapsed exceeds maxDurationMs", async () => {
      mockGetAutonomyConfig.mockReturnValue({ maxDurationMs: 100 });
      const engine = makeEngine();
      const startTime = Date.now() - 200; // 200ms ago
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", baseContext(), startTime, noopOnFailure),
      ).rejects.toThrow("Autonomy guard: max duration exceeded");
      expect(noopOnFailure).toHaveBeenCalledWith("exec-1", "org-1", "Autonomy guard: max duration exceeded");
    });

    it("passes when elapsed is within maxDurationMs", async () => {
      mockGetAutonomyConfig.mockReturnValue({ maxDurationMs: 60_000 });
      const engine = makeEngine();
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", baseContext(), Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Cost limit
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — cost limit", () => {
    it("throws and calls onFailure when cost exceeds maxCostUsd", async () => {
      mockGetAutonomyConfig.mockReturnValue({ maxCostUsd: 5 });
      const engine = makeEngine();
      const ctx = baseContext({ cost_accumulated_usd: 10 });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).rejects.toThrow("Autonomy guard: max cost exceeded");
      expect(noopOnFailure).toHaveBeenCalledWith("exec-1", "org-1", "Autonomy guard: max cost exceeded");
    });

    it("passes when cost is within limit", async () => {
      mockGetAutonomyConfig.mockReturnValue({ maxCostUsd: 25 });
      const engine = makeEngine();
      const ctx = baseContext({ cost_accumulated_usd: 1 });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Integrity veto path (destructive action approval)
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — destructive action approval", () => {
    it("throws when destructive actions are pending and unapproved", async () => {
      mockGetAutonomyConfig.mockReturnValue({ requireApprovalForDestructive: true });
      const engine = makeEngine();
      const ctx = baseContext({
        destructive_actions_pending: ["delete-records"],
        approvals: {},
      });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).rejects.toThrow("Approval required for destructive actions");
      expect(noopOnFailure).toHaveBeenCalledWith("exec-1", "org-1", "Approval required for destructive actions");
    });

    it("passes when destructive actions are approved", async () => {
      mockGetAutonomyConfig.mockReturnValue({ requireApprovalForDestructive: true });
      const engine = makeEngine();
      const ctx = baseContext({
        destructive_actions_pending: ["delete-records"],
        approvals: { "exec-1": true },
      });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });

    it("passes when there are no pending destructive actions", async () => {
      mockGetAutonomyConfig.mockReturnValue({ requireApprovalForDestructive: true });
      const engine = makeEngine();
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", baseContext(), Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Per-agent autonomy level
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — per-agent level", () => {
    it("throws when agent is observe-only", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentAutonomyLevels: { "opportunity-agent": "observe" },
      });
      const engine = makeEngine();
      const ctx = baseContext({ current_agent_id: "opportunity-agent" });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).rejects.toThrow("Autonomy guard: observe-only agent attempted action");
    });

    it("passes when agent has a non-observe level", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentAutonomyLevels: { "opportunity-agent": "full" },
      });
      const engine = makeEngine();
      const ctx = baseContext({ current_agent_id: "opportunity-agent" });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Per-agent kill switch
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — per-agent kill switch", () => {
    it("throws when the specific agent is killed", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentKillSwitches: { "integrity-agent": true },
      });
      const engine = makeEngine();
      const ctx = baseContext({ current_agent_id: "integrity-agent" });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).rejects.toThrow("Autonomy guard: agent disabled");
    });

    it("passes when a different agent is killed", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentKillSwitches: { "integrity-agent": true },
      });
      const engine = makeEngine();
      const ctx = baseContext({ current_agent_id: "opportunity-agent" });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Per-agent iteration limit
  // --------------------------------------------------------------------------

  describe("enforceAutonomyGuardrails — iteration limit", () => {
    it("throws when agent has reached its iteration limit", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentMaxIterations: { "target-agent": 2 },
      });
      const engine = makeEngine();
      const ctx = baseContext({
        current_agent_id: "target-agent",
        executed_steps: [
          { agent_id: "target-agent" },
          { agent_id: "target-agent" },
        ],
      });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).rejects.toThrow("Autonomy guard: iteration limit exceeded");
    });

    it("passes when agent is below its iteration limit", async () => {
      mockGetAutonomyConfig.mockReturnValue({
        agentMaxIterations: { "target-agent": 3 },
      });
      const engine = makeEngine();
      const ctx = baseContext({
        current_agent_id: "target-agent",
        executed_steps: [{ agent_id: "target-agent" }],
      });
      await expect(
        engine.enforceAutonomyGuardrails("exec-1", "stage-1", ctx, Date.now(), noopOnFailure),
      ).resolves.toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Compliance evidence
  // --------------------------------------------------------------------------

  describe("collectComplianceEvidence", () => {
    it("throws when tenantId is empty", async () => {
      const engine = makeEngine();
      await expect(
        engine.collectComplianceEvidence("", "scheduled", "compliance_scheduler"),
      ).rejects.toThrow("tenantId is required");
    });

    it("calls appendEvidence with correct tenant and trigger metadata", async () => {
      mockAppendEvidence.mockResolvedValue({});
      mockGetAgent.mockReturnValue(null);
      const engine = makeEngine();

      await engine.collectComplianceEvidence("tenant-abc", "event", "billing_event");

      expect(mockAppendEvidence).toHaveBeenCalledOnce();
      const call = mockAppendEvidence.mock.calls[0][0];
      expect(call.tenantId).toBe("tenant-abc");
      expect(call.triggerType).toBe("event");
      expect(call.triggerSource).toBe("billing_event");
      expect(call.actorPrincipal).toBe("policy-engine");
    });

    it("includes service readiness snapshot in evidence payload", async () => {
      mockAppendEvidence.mockResolvedValue({});
      mockGetAgent.mockReturnValue(null);

      const readiness: ServiceReadiness = {
        message_broker_ready: true,
        queue_ready: false,
        memory_backend_ready: true,
        llm_gateway_ready: true,
        circuit_breaker_ready: false,
      };
      const engine = makeEngine({ serviceReadiness: () => readiness });

      await engine.collectComplianceEvidence("tenant-abc", "scheduled", "compliance_scheduler");

      const call = mockAppendEvidence.mock.calls[0][0];
      expect(call.evidence.service_evidence).toEqual(readiness);
    });

    it("includes all 7 lifecycle agents in agent_evidence", async () => {
      mockAppendEvidence.mockResolvedValue({});
      mockGetAgent.mockReturnValue(null);
      const engine = makeEngine();

      await engine.collectComplianceEvidence("tenant-abc", "scheduled", "compliance_scheduler");

      const call = mockAppendEvidence.mock.calls[0][0];
      const agentIds = (call.evidence.agent_evidence as { agent_id: string }[]).map((a) => a.agent_id);
      expect(agentIds).toContain("opportunity-agent");
      expect(agentIds).toContain("integrity-agent");
      expect(agentIds).toContain("compliance-auditor-agent");
      expect(agentIds).toHaveLength(7);
    });
  });

  // --------------------------------------------------------------------------
  // HITL gating (Sprint 5)
  // --------------------------------------------------------------------------

  describe("checkHITL — HITL-01: external artifact + low confidence", () => {
    function makeHITLContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
      return {
        organization_id: "00000000-0000-0000-0000-000000000001",
        is_external_artifact_action: false,
        ...overrides,
      };
    }

    function makeOpportunity(
      confidence_score: number,
      lifecycle_stage: NonNullable<DecisionContext["opportunity"]>["lifecycle_stage"] = "composing",
    ): NonNullable<DecisionContext["opportunity"]> {
      return {
        id: "00000000-0000-0000-0000-000000000002",
        lifecycle_stage,
        confidence_score,
        value_maturity: "medium",
      };
    }

    it("blocks when confidence < 0.6 and action is external-facing", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(0.5),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.hitl_required).toBe(true);
      expect(result.hitl_reason).toBeDefined();
      expect(result.details.rule_id).toBe("HITL-01");
      expect(result.details.confidence_score).toBe(0.5);
      expect(result.details.is_external_artifact_action).toBe(true);
    });

    it("blocks at confidence just below threshold (0.59)", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(0.59),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(false);
      expect(result.hitl_required).toBe(true);
    });

    it("allows at exactly the threshold (0.6)", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(HITL_CONFIDENCE_THRESHOLD),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it("allows when confidence > 0.6", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(0.85),
        is_external_artifact_action: true,
      });
      const result: PolicyCheckResult = engine.checkHITL(ctx);
      expect(result.allowed).toBe(true);
      expect(result.hitl_required).toBe(false);
    });

    it("allows when action is not external-facing, even with low confidence", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(0.3),
        is_external_artifact_action: false,
      });
      expect(engine.checkHITL(ctx).allowed).toBe(true);
    });

    it("allows when opportunity is absent (no confidence to check)", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({ is_external_artifact_action: true });
      expect(engine.checkHITL(ctx).allowed).toBe(true);
    });

    it("hitl_reason cites the threshold and actual score", () => {
      const engine = makeEngine();
      const ctx = makeHITLContext({
        opportunity: makeOpportunity(0.42),
        is_external_artifact_action: true,
      });
      const result = engine.checkHITL(ctx);
      expect(result.hitl_reason).toContain(String(HITL_CONFIDENCE_THRESHOLD));
      expect(result.hitl_reason).toContain("0.42");
    });

    it("HITL fires for every lifecycle stage when confidence < threshold", () => {
      const engine = makeEngine();
      const stages: NonNullable<DecisionContext["opportunity"]>["lifecycle_stage"][] = [
        "discovery", "drafting", "validating", "composing", "refining", "realized", "expansion",
      ];
      for (const stage of stages) {
        const ctx = makeHITLContext({
          opportunity: makeOpportunity(0.3, stage),
          is_external_artifact_action: true,
        });
        const result = engine.checkHITL(ctx);
        expect(result.allowed).toBe(false);
        expect(result.details.lifecycle_stage).toBe(stage);
      }
    });

    it("HITL_CONFIDENCE_THRESHOLD is 0.6", () => {
      expect(HITL_CONFIDENCE_THRESHOLD).toBe(0.6);
    });
  });
});
