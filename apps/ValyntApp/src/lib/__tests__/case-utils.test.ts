/**
 * TDD: Phase 3 — case-utils shared helpers
 *
 * Tests for utility functions extracted from Dashboard.tsx that derive
 * warmth groupings, display fields, and sort orders from ValueCaseWithRelations.
 *
 * RED phase: fails until src/lib/case-utils.ts is implemented.
 */

import { describe, expect, it } from "vitest";

import {
  deriveCaseDisplayFields,
  deriveWarmthFromCase,
  getTotalValueByWarmth,
  groupCasesByWarmth,
  sortByWarmthPriority,
} from "@/lib/case-utils";

import { MOCK_CASES, NEEDS_INPUT_CASE } from "@/test/fixtures/phase3";

// ============================================================================
// deriveWarmthFromCase — map a ValueCaseWithRelations to a WarmthState
// ============================================================================

describe("deriveWarmthFromCase", () => {
  it("maps discovery stage to forming", () => {
    const forming = MOCK_CASES.find((c) => c.stage === "discovery")!;
    expect(deriveWarmthFromCase(forming)).toBe("forming");
  });

  it("maps target stage to firm", () => {
    const firm = MOCK_CASES.find((c) => c.stage === "target")!;
    expect(deriveWarmthFromCase(firm)).toBe("firm");
  });

  it("maps narrative stage to verified", () => {
    const verified = MOCK_CASES.find((c) =>
      c.stage?.toLowerCase().includes("narrat"),
    )!;
    expect(deriveWarmthFromCase(verified)).toBe("verified");
  });

  it("defaults to forming for null stage", () => {
    const noStage = { ...MOCK_CASES[0]!, stage: null };
    expect(deriveWarmthFromCase(noStage)).toBe("forming");
  });

  it("defaults to forming for unknown stage", () => {
    const unknown = { ...MOCK_CASES[0]!, stage: "something-new" };
    expect(deriveWarmthFromCase(unknown)).toBe("forming");
  });
});

// ============================================================================
// groupCasesByWarmth — count cases per warmth tier
// ============================================================================

describe("groupCasesByWarmth", () => {
  it("counts cases per warmth state", () => {
    const counts = groupCasesByWarmth(MOCK_CASES);
    expect(counts.forming).toBe(2);
    expect(counts.firm).toBe(2);
    expect(counts.verified).toBe(2);
  });

  it("returns zeros for empty array", () => {
    const counts = groupCasesByWarmth([]);
    expect(counts.forming).toBe(0);
    expect(counts.firm).toBe(0);
    expect(counts.verified).toBe(0);
  });
});

// ============================================================================
// getTotalValueByWarmth — sum projected value per warmth tier
// ============================================================================

describe("getTotalValueByWarmth", () => {
  it("sums projected values per warmth state", () => {
    const totals = getTotalValueByWarmth(MOCK_CASES);
    // forming: 890K + 1.2M = 2.09M
    expect(totals.forming).toBeCloseTo(2_090_000, -3);
    // firm: 2.4M + 1.8M = 4.2M
    expect(totals.firm).toBeCloseTo(4_200_000, -3);
    // verified: 5.1M + 3.2M = 8.3M
    expect(totals.verified).toBeCloseTo(8_300_000, -3);
  });

  it("returns zeros for empty array", () => {
    const totals = getTotalValueByWarmth([]);
    expect(totals.forming).toBe(0);
    expect(totals.firm).toBe(0);
    expect(totals.verified).toBe(0);
  });
});

// ============================================================================
// sortByWarmthPriority — needs-input first, then forming → firm → verified
// ============================================================================

describe("sortByWarmthPriority", () => {
  it("places needs-input cases first", () => {
    const sorted = sortByWarmthPriority(MOCK_CASES);
    expect(sorted[0]!.id).toBe(NEEDS_INPUT_CASE.id);
  });

  it("orders forming before firm before verified", () => {
    const sorted = sortByWarmthPriority(MOCK_CASES);
    // After the needs-input case, the remaining forming cases come next
    const warmthOrder = sorted.map((c) => deriveWarmthFromCase(c));
    // Check that forming appears before firm, firm before verified
    const firstFirmIndex = warmthOrder.indexOf("firm");
    const lastFormingIndex = warmthOrder.lastIndexOf("forming");
    expect(lastFormingIndex).toBeLessThan(firstFirmIndex);

    const firstVerifiedIndex = warmthOrder.indexOf("verified");
    const lastFirmIndex = warmthOrder.lastIndexOf("firm");
    expect(lastFirmIndex).toBeLessThan(firstVerifiedIndex);
  });

  it("preserves recency within same warmth tier", () => {
    const sorted = sortByWarmthPriority(MOCK_CASES);
    const verifiedCases = sorted.filter(
      (c) => deriveWarmthFromCase(c) === "verified",
    );
    // More recently updated should come first within tier
    if (verifiedCases.length >= 2) {
      const first = new Date(verifiedCases[0]!.updated_at).getTime();
      const second = new Date(verifiedCases[1]!.updated_at).getTime();
      expect(first).toBeGreaterThanOrEqual(second);
    }
  });
});

// ============================================================================
// deriveCaseDisplayFields — formatted display strings
// ============================================================================

describe("deriveCaseDisplayFields", () => {
  it("returns company name", () => {
    const fields = deriveCaseDisplayFields(MOCK_CASES[0]!);
    expect(fields.companyName).toBe("Acme Corp");
  });

  it("returns formatted projected value", () => {
    const fields = deriveCaseDisplayFields(MOCK_CASES[0]!);
    expect(fields.value).toMatch(/\$/);
  });

  it("returns next action text", () => {
    const fields = deriveCaseDisplayFields(MOCK_CASES[0]!);
    expect(fields.nextAction).toBeTruthy();
    expect(typeof fields.nextAction).toBe("string");
  });

  it("returns relative lastActivity string", () => {
    const fields = deriveCaseDisplayFields(MOCK_CASES[0]!);
    expect(fields.lastActivity).toMatch(/ago|now/i);
  });

  it("returns confidence as 0-100 integer", () => {
    const fields = deriveCaseDisplayFields(MOCK_CASES[0]!);
    expect(fields.confidence).toBeGreaterThanOrEqual(0);
    expect(fields.confidence).toBeLessThanOrEqual(100);
    expect(Number.isInteger(fields.confidence)).toBe(true);
  });

  it("falls back to case name when company_profiles is null", () => {
    const noCompany = { ...MOCK_CASES[0]!, company_profiles: null };
    const fields = deriveCaseDisplayFields(noCompany);
    expect(fields.companyName).toBe(noCompany.name);
  });
});
