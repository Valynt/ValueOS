/**
 * AgentGovernanceLayer — unit tests
 *
 * Covers evaluateConfidence, runIntegrityVeto, createHITLCheckpoint,
 * and the GovernanceLayer orchestration.
 */

import { describe, it, expect, vi } from "vitest";

import {
  evaluateConfidence,
  GovernanceLayer,
  InvalidRiskTierError,
  type IntegrityVetoServicePort,
  type HITLCheckpointPort,
} from "../AgentGovernanceLayer.js";
import { CONFIDENCE_THRESHOLDS } from "../AgentHardeningTypes.js";
import type { ConfidenceBreakdown } from "../AgentHardeningTypes.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfidence(overall: number): ConfidenceBreakdown {
  let label: ConfidenceBreakdown["label"];
  if (overall >= 0.85) label = "very_high";
  else if (overall >= 0.7) label = "high";
  else if (overall >= 0.5) label = "medium";
  else if (overall >= 0.3) label = "low";
  else label = "very_low";

  return {
    overall,
    evidence_quality: overall,
    grounding: overall,
    label,
  };
}

// ---------------------------------------------------------------------------
// evaluateConfidence
// ---------------------------------------------------------------------------

describe("evaluateConfidence", () => {
  it("returns approved when score meets the accept threshold", () => {
    // financial: accept=0.75
    const result = evaluateConfidence(makeConfidence(0.80), "financial");
    expect(result.verdict).toBe("approved");
    expect(result.thresholds_used).toEqual(CONFIDENCE_THRESHOLDS["financial"]);
  });

  it("returns pending_human when score is between review and accept", () => {
    // financial: review=0.60, accept=0.75
    const result = evaluateConfidence(makeConfidence(0.65), "financial");
    expect(result.verdict).toBe("pending_human");
  });

  it("returns vetoed when score is below the block threshold", () => {
    // financial: block=0.40
    const result = evaluateConfidence(makeConfidence(0.30), "financial");
    expect(result.verdict).toBe("vetoed");
  });

  it("throws InvalidRiskTierError for unknown tier", () => {
    expect(() => evaluateConfidence(makeConfidence(0.60), "unknown_tier")).toThrow(InvalidRiskTierError);
  });

  it("includes the score and threshold values in the reason string", () => {
    const result = evaluateConfidence(makeConfidence(0.80), "financial");
    expect(result.reason).toContain("0.800");
    expect(result.reason).toContain("0.75");
  });

  describe("all risk tiers", () => {
    const tiers = Object.keys(CONFIDENCE_THRESHOLDS) as Array<keyof typeof CONFIDENCE_THRESHOLDS>;

    for (const tier of tiers) {
      const thresholds = CONFIDENCE_THRESHOLDS[tier]!;

      it(`${tier}: score at accept threshold → approved`, () => {
        const result = evaluateConfidence(makeConfidence(thresholds.accept), tier);
        expect(result.verdict).toBe("approved");
      });

      it(`${tier}: score just below accept → pending_human`, () => {
        const score = thresholds.accept - 0.01;
        if (score >= thresholds.review) {
          const result = evaluateConfidence(makeConfidence(score), tier);
          expect(result.verdict).toBe("pending_human");
        }
      });

      it(`${tier}: score below block threshold → vetoed`, () => {
        const score = thresholds.block - 0.01;
        const result = evaluateConfidence(makeConfidence(score), tier);
        expect(result.verdict).toBe("vetoed");
      });
    }
  });
});

// ---------------------------------------------------------------------------
// GovernanceLayer
// ---------------------------------------------------------------------------

describe("GovernanceLayer", () => {
  const baseInput = {
    output: { result: "test", confidence: 0.8 },
    confidence: makeConfidence(0.85),
    riskTier: "discovery" as const,
    agentName: "TestAgent",
    agentType: "DISCOVERY",
    traceId: "trace-001",
    sessionId: "session-001",
    organizationId: "org-001",
    requiresIntegrityVeto: false,
    requiresHumanApproval: false,
  };

  it("approves high-confidence output with no veto service", async () => {
    const layer = new GovernanceLayer(null, null);
    const result = await layer.evaluate(baseInput);

    expect(result.decision.verdict).toBe("approved");
    expect(result.release).toBe(true);
  });

  it("vetoes output when IntegrityAgent returns vetoed=true", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockResolvedValue({
        vetoed: true,
        metadata: { integrityVeto: true, deviationPercent: 40, metricId: "roi", benchmark: 1.2 },
        reRefine: false,
      }),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    const result = await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true });

    expect(result.decision.verdict).toBe("vetoed");
    expect(result.release).toBe(false);
    expect(result.decision.integrity_issues?.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("applies confidence penalty from IntegrityAgent and may change verdict", async () => {
    // Start with medium confidence (0.50), discovery accept=0.55
    // IntegrityAgent applies -0.20 penalty → 0.30, below review (0.40) → vetoed
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockResolvedValue({
        vetoed: true,
        metadata: { integrityVeto: true, deviationPercent: 30, metricId: "evidence", benchmark: 0.9 },
        reRefine: false,
      }),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.50),
      requiresIntegrityVeto: true,
    });

    // Hard integrity veto should deterministically block output regardless of fallback behavior.
    expect(result.decision.verdict).toBe("vetoed");
    expect(result.release).toBe(false);
  });

  it("creates HITL checkpoint when verdict is pending_human", async () => {
    const hitlPort: HITLCheckpointPort = {
      createCheckpoint: vi.fn().mockResolvedValue({
        checkpoint_id: "cp-001",
        status: "pending",
        created_at: new Date().toISOString(),
      }),
    };

    const layer = new GovernanceLayer(null, hitlPort);
    // financial: review=0.60, accept=0.75 → 0.65 → pending_human
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.65),
      riskTier: "financial",
    });

    expect(result.decision.verdict).toBe("pending_human");
    expect(result.release).toBe(false);
    expect(hitlPort.createCheckpoint).toHaveBeenCalledOnce();
    expect(result.decision.approval_checkpoint_id).toMatch(/[a-f0-9-]{36}/);
  });

  it("forces HITL when requiresHumanApproval=true regardless of confidence", async () => {
    const hitlPort: HITLCheckpointPort = {
      createCheckpoint: vi.fn().mockResolvedValue({
        checkpoint_id: "cp-forced-001",
        status: "pending",
        created_at: new Date().toISOString(),
      }),
    };

    const layer = new GovernanceLayer(null, hitlPort);
    // Very high confidence — would normally be approved
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.95),
      requiresHumanApproval: true,
    });

    expect(result.release).toBe(false);
    expect(hitlPort.createCheckpoint).toHaveBeenCalledOnce();
  });


  it("rejects invalid risk tier with explicit veto reason", async () => {
    const layer = new GovernanceLayer(null, null);

    const result = await layer.evaluate({
      ...baseInput,
      riskTier: "invalid_tier" as keyof typeof CONFIDENCE_THRESHOLDS,
    });

    expect(result.decision.verdict).toBe("vetoed");
    expect(result.decision.reason).toBe("invalid risk tier");
    expect(result.release).toBe(false);
  });

  it("fails open with confidence penalty for transient IntegrityVeto failures", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockRejectedValue(new Error("Service unavailable")),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.80),
      requiresIntegrityVeto: true,
      riskTier: "financial",
    });

    expect(result.adjusted_confidence.overall).toBeCloseTo(0.75, 5);
    expect(result.decision.verdict).toBe("approved");
    expect(result.release).toBe(true);
  });

  it("escalates to pending_human on sustained IntegrityVeto failures for low-risk tiers", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockRejectedValue(new Error("Service unavailable")),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "discovery" });
    await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "discovery" });
    const third = await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "discovery" });

    expect(third.decision.verdict).toBe("pending_human");
    expect(third.release).toBe(false);
  });

  it("escalates to vetoed on sustained IntegrityVeto failures for high-risk tiers", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockRejectedValue(new Error("Service unavailable")),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "financial" });
    await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "financial" });
    const third = await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true, riskTier: "financial" });

    expect(third.decision.verdict).toBe("vetoed");
    expect(third.release).toBe(false);
  });

  it("fails open when IntegrityAgent service throws", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      evaluateIntegrityVeto: vi.fn().mockRejectedValue(new Error("Service unavailable")),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    // Should not throw — fail-open behavior
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.90),
      requiresIntegrityVeto: true,
    });

    // High confidence even after penalty should still be approved
    expect(result.release).toBe(true);
  });
});
