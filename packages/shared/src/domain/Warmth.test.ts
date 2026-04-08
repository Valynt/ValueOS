/**
 * Warmth domain model — unit tests
 *
 * Validates the canonical warmth derivation contract:
 *   - Type exports are stable
 *   - SAGA_TO_WARMTH mapping is complete and deterministic
 *   - deriveWarmth() produces correct results for all saga states
 *   - Confidence modifiers fire at correct thresholds
 *   - Edge cases: boundary values, backward transitions
 */

import { describe, expect, it } from "vitest";

import {
  CONFIDENCE_MODIFIERS,
  DEFAULT_CONFIDENCE,
  deriveWarmth,
  SAGA_TO_WARMTH,
  WarmthModifierSchema,
  WarmthResultSchema,
  WarmthStateSchema,
  WorkspaceModeSchema,
} from "./Warmth";
import { SagaStateEnumSchema } from "./ExperienceModel";
import type { SagaStateEnum } from "./ExperienceModel";

// ============================================================================
// Schema stability
// ============================================================================

describe("Warmth schema exports", () => {
  it("WarmthStateSchema has exactly three values", () => {
    const values = WarmthStateSchema.options;
    expect(values).toEqual(["forming", "firm", "verified"]);
    expect(values).toHaveLength(3);
  });

  it("WarmthModifierSchema allows firming, needs_review, and null", () => {
    expect(WarmthModifierSchema.parse("firming")).toBe("firming");
    expect(WarmthModifierSchema.parse("needs_review")).toBe("needs_review");
    expect(WarmthModifierSchema.parse(null)).toBe(null);
  });

  it("WarmthModifierSchema rejects arbitrary strings", () => {
    expect(() => WarmthModifierSchema.parse("random")).toThrow();
  });

  it("WorkspaceModeSchema has four values", () => {
    expect(WorkspaceModeSchema.options).toEqual(["canvas", "narrative", "copilot", "evidence"]);
  });

  it("WarmthResultSchema validates a complete result", () => {
    const result = WarmthResultSchema.parse({
      state: "forming",
      modifier: null,
      confidence: 0.5,
      sagaState: "DRAFTING",
    });
    expect(result.state).toBe("forming");
  });
});

// ============================================================================
// SAGA_TO_WARMTH mapping completeness
// ============================================================================

describe("SAGA_TO_WARMTH mapping", () => {
  const allSagaStates = SagaStateEnumSchema.options;

  it("covers every saga state", () => {
    for (const state of allSagaStates) {
      expect(SAGA_TO_WARMTH).toHaveProperty(state);
    }
  });

  it("maps to only valid warmth states", () => {
    const validWarmth = new Set(WarmthStateSchema.options);
    for (const warmth of Object.values(SAGA_TO_WARMTH)) {
      expect(validWarmth.has(warmth)).toBe(true);
    }
  });

  it("maps INITIATED and DRAFTING to forming", () => {
    expect(SAGA_TO_WARMTH.INITIATED).toBe("forming");
    expect(SAGA_TO_WARMTH.DRAFTING).toBe("forming");
  });

  it("maps VALIDATING and COMPOSING to firm", () => {
    expect(SAGA_TO_WARMTH.VALIDATING).toBe("firm");
    expect(SAGA_TO_WARMTH.COMPOSING).toBe("firm");
  });

  it("maps REFINING and FINALIZED to verified", () => {
    expect(SAGA_TO_WARMTH.REFINING).toBe("verified");
    expect(SAGA_TO_WARMTH.FINALIZED).toBe("verified");
  });

  it("has no extra keys beyond known saga states", () => {
    const mappingKeys = Object.keys(SAGA_TO_WARMTH);
    expect(mappingKeys.sort()).toEqual([...allSagaStates].sort());
  });
});

// ============================================================================
// deriveWarmth — table-driven tests
// ============================================================================

describe("deriveWarmth", () => {
  const cases: Array<{
    saga: string;
    confidence: number;
    expectedState: string;
    expectedModifier: string | null;
    label: string;
  }> = [
    // Forming states
    { saga: "INITIATED", confidence: 0.0, expectedState: "forming", expectedModifier: null, label: "INITIATED at 0.0" },
    { saga: "INITIATED", confidence: 0.5, expectedState: "forming", expectedModifier: null, label: "INITIATED at 0.5" },
    { saga: "DRAFTING", confidence: 0.3, expectedState: "forming", expectedModifier: null, label: "DRAFTING at 0.3" },
    { saga: "DRAFTING", confidence: 0.69, expectedState: "forming", expectedModifier: null, label: "DRAFTING just below firming threshold" },
    { saga: "DRAFTING", confidence: 0.7, expectedState: "forming", expectedModifier: "firming", label: "DRAFTING at firming threshold" },
    { saga: "DRAFTING", confidence: 0.95, expectedState: "forming", expectedModifier: "firming", label: "DRAFTING high confidence → firming modifier" },

    // Firm states
    { saga: "VALIDATING", confidence: 0.5, expectedState: "firm", expectedModifier: null, label: "VALIDATING at 0.5" },
    { saga: "VALIDATING", confidence: 0.8, expectedState: "firm", expectedModifier: null, label: "VALIDATING at 0.8" },
    { saga: "COMPOSING", confidence: 0.6, expectedState: "firm", expectedModifier: null, label: "COMPOSING at 0.6" },

    // Verified states
    { saga: "REFINING", confidence: 0.8, expectedState: "verified", expectedModifier: null, label: "REFINING at 0.8" },
    { saga: "REFINING", confidence: 0.5, expectedState: "verified", expectedModifier: null, label: "REFINING at needs_review boundary (not below)" },
    { saga: "REFINING", confidence: 0.49, expectedState: "verified", expectedModifier: "needs_review", label: "REFINING below needs_review threshold" },
    { saga: "REFINING", confidence: 0.1, expectedState: "verified", expectedModifier: "needs_review", label: "REFINING very low confidence" },
    { saga: "FINALIZED", confidence: 0.9, expectedState: "verified", expectedModifier: null, label: "FINALIZED at 0.9" },
    { saga: "FINALIZED", confidence: 0.3, expectedState: "verified", expectedModifier: "needs_review", label: "FINALIZED with low confidence" },
  ];

  it.each(cases)("$label → $expectedState ($expectedModifier)", ({ saga, confidence, expectedState, expectedModifier }) => {
    const result = deriveWarmth(saga as SagaStateEnum, confidence);
    expect(result.state).toBe(expectedState);
    expect(result.modifier).toBe(expectedModifier);
    expect(result.confidence).toBe(confidence);
    expect(result.sagaState).toBe(saga);
  });

  it("returns a valid WarmthResult for every saga state", () => {
    for (const saga of SagaStateEnumSchema.options) {
      const result = deriveWarmth(saga, 0.5);
      expect(() => WarmthResultSchema.parse(result)).not.toThrow();
    }
  });

  it("is deterministic — same input always produces same output", () => {
    const a = deriveWarmth("DRAFTING", 0.75);
    const b = deriveWarmth("DRAFTING", 0.75);
    expect(a).toEqual(b);
  });

  it("handles null confidence by defaulting to 0.5", () => {
    const result = deriveWarmth("DRAFTING", null);
    expect(result.state).toBe("forming");
    expect(result.modifier).toBe(null);
    expect(result.confidence).toBe(DEFAULT_CONFIDENCE);
  });

  it("handles undefined confidence by defaulting to 0.5", () => {
    const result = deriveWarmth("DRAFTING", undefined);
    expect(result.state).toBe("forming");
    expect(result.modifier).toBe(null);
    expect(result.confidence).toBe(DEFAULT_CONFIDENCE);
  });

  it("handles no confidence argument by defaulting to 0.5", () => {
    const result = deriveWarmth("VALIDATING");
    expect(result.state).toBe("firm");
    expect(result.confidence).toBe(DEFAULT_CONFIDENCE);
  });

  it("handles unknown saga state by defaulting to forming", () => {
    const result = deriveWarmth("UNKNOWN_STATE" as SagaStateEnum, 0.5);
    expect(result.state).toBe("forming");
    expect(result.modifier).toBe(null);
  });

  it("null confidence at verified state does not trigger needs_review", () => {
    const result = deriveWarmth("REFINING", null);
    expect(result.state).toBe("verified");
    expect(result.modifier).toBe(null);
    expect(result.confidence).toBe(0.5);
  });
});

// ============================================================================
// Confidence modifiers — threshold validation
// ============================================================================

describe("CONFIDENCE_MODIFIERS", () => {
  it("highConfidenceInForming threshold is 0.7", () => {
    expect(CONFIDENCE_MODIFIERS.highConfidenceInForming.threshold).toBe(0.7);
    expect(CONFIDENCE_MODIFIERS.highConfidenceInForming.indicator).toBe("firming");
  });

  it("lowConfidenceInVerified threshold is 0.5", () => {
    expect(CONFIDENCE_MODIFIERS.lowConfidenceInVerified.threshold).toBe(0.5);
    expect(CONFIDENCE_MODIFIERS.lowConfidenceInVerified.indicator).toBe("needs_review");
  });
});
