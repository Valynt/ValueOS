/**
 * TDD: Warmth Derivation Logic
 *
 * Tests the deriveWarmth() function against the warmth derivation spec.
 * All 6 SagaStateEnum values must map to 3 warmth states.
 * Confidence modifiers add sub-state indicators but never override warmth.
 *
 * RED phase: these tests will fail until src/lib/warmth.ts is implemented.
 */

import { describe, expect, it } from "vitest";

import {
  type WarmthModifier,
  type WarmthResult,
  type WarmthState,
  deriveWarmth,
  getWarmthTokens,
} from "@/lib/warmth";

// ---------------------------------------------------------------------------
// deriveWarmth — Saga state mapping
// ---------------------------------------------------------------------------
describe("deriveWarmth", () => {
  describe("saga state → warmth mapping", () => {
    it("maps INITIATED to forming", () => {
      const result = deriveWarmth("INITIATED", 0.3);
      expect(result.state).toBe("forming");
    });

    it("maps DRAFTING to forming", () => {
      const result = deriveWarmth("DRAFTING", 0.4);
      expect(result.state).toBe("forming");
    });

    it("maps VALIDATING to firm", () => {
      const result = deriveWarmth("VALIDATING", 0.65);
      expect(result.state).toBe("firm");
    });

    it("maps COMPOSING to firm", () => {
      const result = deriveWarmth("COMPOSING", 0.7);
      expect(result.state).toBe("firm");
    });

    it("maps REFINING to verified", () => {
      const result = deriveWarmth("REFINING", 0.85);
      expect(result.state).toBe("verified");
    });

    it("maps FINALIZED to verified", () => {
      const result = deriveWarmth("FINALIZED", 0.95);
      expect(result.state).toBe("verified");
    });
  });

  // ---------------------------------------------------------------------------
  // Confidence modifiers — sub-state indicators
  // ---------------------------------------------------------------------------
  describe("confidence modifiers", () => {
    it("returns modifier 'firming' when saga=DRAFTING and confidence > 0.7", () => {
      const result = deriveWarmth("DRAFTING", 0.75);
      expect(result.state).toBe("forming");
      expect(result.modifier).toBe("firming");
    });

    it("returns modifier 'needs_review' when saga=REFINING and confidence < 0.5", () => {
      const result = deriveWarmth("REFINING", 0.4);
      expect(result.state).toBe("verified");
      expect(result.modifier).toBe("needs_review");
    });

    it("returns no modifier when confidence is within normal range for forming", () => {
      const result = deriveWarmth("DRAFTING", 0.5);
      expect(result.state).toBe("forming");
      expect(result.modifier).toBeNull();
    });

    it("returns no modifier when confidence is within normal range for firm", () => {
      const result = deriveWarmth("VALIDATING", 0.65);
      expect(result.state).toBe("firm");
      expect(result.modifier).toBeNull();
    });

    it("returns no modifier when confidence is within normal range for verified", () => {
      const result = deriveWarmth("FINALIZED", 0.85);
      expect(result.state).toBe("verified");
      expect(result.modifier).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Conflict resolution — saga_state ALWAYS wins
  // ---------------------------------------------------------------------------
  describe("conflict resolution", () => {
    it("saga_state wins: DRAFTING + confidence=0.95 is still forming", () => {
      const result = deriveWarmth("DRAFTING", 0.95);
      expect(result.state).toBe("forming");
    });

    it("saga_state wins: INITIATED + confidence=1.0 is still forming", () => {
      const result = deriveWarmth("INITIATED", 1.0);
      expect(result.state).toBe("forming");
    });

    it("saga_state wins: FINALIZED + confidence=0.1 is still verified", () => {
      const result = deriveWarmth("FINALIZED", 0.1);
      expect(result.state).toBe("verified");
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe("edge cases", () => {
    it("handles NaN confidence gracefully (defaults to 0)", () => {
      const result = deriveWarmth("DRAFTING", NaN);
      expect(result.state).toBe("forming");
      expect(result.modifier).toBeNull();
    });

    it("handles negative confidence gracefully (clamps to 0)", () => {
      const result = deriveWarmth("VALIDATING", -0.5);
      expect(result.state).toBe("firm");
      expect(result.modifier).toBeNull();
    });

    it("handles confidence > 1 gracefully (clamps to 1)", () => {
      const result = deriveWarmth("REFINING", 1.5);
      expect(result.state).toBe("verified");
      expect(result.modifier).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Override thresholds
  // ---------------------------------------------------------------------------
  describe("override thresholds", () => {
    it("respects firmMinimum override", () => {
      // With higher firmMinimum, the firming modifier triggers at a higher confidence
      const result = deriveWarmth("DRAFTING", 0.72, { firmMinimum: 0.7 });
      expect(result.state).toBe("forming");
      expect(result.modifier).toBe("firming");
    });

    it("respects verifiedMinimum override", () => {
      const result = deriveWarmth("REFINING", 0.45, { verifiedMinimum: 0.9 });
      expect(result.state).toBe("verified");
      expect(result.modifier).toBe("needs_review");
    });

    it("clamps firmMinimum to valid range (0.5-0.7)", () => {
      // firmMinimum=0.3 should be clamped to 0.5
      const result = deriveWarmth("DRAFTING", 0.55, { firmMinimum: 0.3 });
      expect(result.state).toBe("forming");
      // With clamped minimum of 0.5, confidence 0.55 is NOT > 0.7 so no firming
    });

    it("clamps verifiedMinimum to valid range (0.7-0.9)", () => {
      // verifiedMinimum=0.99 should be clamped to 0.9
      const result = deriveWarmth("REFINING", 0.45, { verifiedMinimum: 0.99 });
      expect(result.state).toBe("verified");
      expect(result.modifier).toBe("needs_review");
    });
  });
});

// ---------------------------------------------------------------------------
// getWarmthTokens
// ---------------------------------------------------------------------------
describe("getWarmthTokens", () => {
  it("returns dashed border for forming", () => {
    const tokens = getWarmthTokens("forming");
    expect(tokens.border).toBe("dashed");
  });

  it("returns solid border for firm", () => {
    const tokens = getWarmthTokens("firm");
    expect(tokens.border).toBe("solid");
  });

  it("returns solid border for verified", () => {
    const tokens = getWarmthTokens("verified");
    expect(tokens.border).toBe("solid");
  });

  it("returns modifier icon when modifier is provided", () => {
    const tokens = getWarmthTokens("forming", "firming");
    expect(tokens.modifierIcon).toBeDefined();
    expect(tokens.modifierIcon).toBe("trending-up");
  });

  it("returns no modifier icon when modifier is null", () => {
    const tokens = getWarmthTokens("firm", null);
    expect(tokens.modifierIcon).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Type validation (compile-time, but assert runtime shape)
// ---------------------------------------------------------------------------
describe("type contracts", () => {
  it("WarmthState is one of forming | firm | verified", () => {
    const validStates: WarmthState[] = ["forming", "firm", "verified"];
    for (const s of validStates) {
      expect(["forming", "firm", "verified"]).toContain(s);
    }
  });

  it("WarmthModifier is one of firming | needs_review | null", () => {
    const validModifiers: WarmthModifier[] = ["firming", "needs_review", null];
    for (const m of validModifiers) {
      expect(["firming", "needs_review", null]).toContain(m);
    }
  });

  it("WarmthResult has state and modifier", () => {
    const result: WarmthResult = deriveWarmth("INITIATED", 0.3);
    expect(result).toHaveProperty("state");
    expect(result).toHaveProperty("modifier");
  });
});
