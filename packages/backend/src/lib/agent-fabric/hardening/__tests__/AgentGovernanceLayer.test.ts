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

  it("uses discovery thresholds for unknown tier (fallback)", () => {
    const result = evaluateConfidence(makeConfidence(0.60), "unknown_tier");
    // discovery: accept=0.55 → 0.60 >= 0.55 → approved
    expect(result.verdict).toBe("approved");
    expect(result.thresholds_used).toEqual(CONFIDENCE_THRESHOLDS["discovery"]);
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
      veto: vi.fn().mockResolvedValue({
        vetoed: true,
        issues: [{ type: "hallucination", severity: "high", description: "Fabricated data" }],
        confidence_delta: -0.4,
        re_refine: false,
      }),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    const result = await layer.evaluate({ ...baseInput, requiresIntegrityVeto: true });

    expect(result.decision.verdict).toBe("vetoed");
    expect(result.release).toBe(false);
    expect(result.decision.integrity_issues).toHaveLength(1);
  });

  it("applies confidence penalty from IntegrityAgent and may change verdict", async () => {
    // Start with medium confidence (0.50), discovery accept=0.55
    // IntegrityAgent applies -0.20 penalty → 0.30, below review (0.40) → vetoed
    const integrityVetoService: IntegrityVetoServicePort = {
      veto: vi.fn().mockResolvedValue({
        vetoed: false, // not a hard veto, but applies penalty
        issues: [{ type: "evidence_gap", severity: "medium", description: "Thin evidence" }],
        confidence_delta: -0.20,
        re_refine: false,
      }),
    };

    const layer = new GovernanceLayer(integrityVetoService, null);
    const result = await layer.evaluate({
      ...baseInput,
      confidence: makeConfidence(0.50),
      requiresIntegrityVeto: true,
    });

    // After penalty: 0.50 - 0.20 = 0.30, below discovery block (0.25)? No, 0.30 > 0.25
    // 0.30 < review (0.40) → vetoed
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
    expect(result.decision.approval_checkpoint_id).toBe("cp-001");
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

  it("fails open when IntegrityAgent service throws", async () => {
    const integrityVetoService: IntegrityVetoServicePort = {
      veto: vi.fn().mockRejectedValue(new Error("Service unavailable")),
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
