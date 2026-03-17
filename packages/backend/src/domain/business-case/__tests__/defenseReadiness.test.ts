import type { Assumption } from "@valueos/shared/domain";
import type { Evidence } from "@valueos/shared/domain";
import { describe, expect, it } from "vitest";

import {
  calculateDefenseReadiness,
} from "../defenseReadiness.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const ORG = "00000000-0000-0000-0000-000000000001";
const OPP = "00000000-0000-0000-0000-000000000002";

function makeAssumption(id: string, human_reviewed: boolean): Assumption {
  return {
    id,
    organization_id: ORG,
    opportunity_id: OPP,
    name: `Assumption ${id}`,
    value: 100,
    unit: "USD",
    source: "benchmark",
    human_reviewed,
    created_at: NOW,
    updated_at: NOW,
  };
}

function makeEvidence(id: string, grounding_score: number | null): Evidence {
  return {
    id,
    organization_id: ORG,
    opportunity_id: OPP,
    title: `Evidence ${id}`,
    content: "Supporting data point.",
    provenance: "benchmark",
    tier: "silver",
    grounding_score,
    created_at: NOW,
    updated_at: NOW,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("calculateDefenseReadiness", () => {
  it("returns 0 for empty inputs", () => {
    const result = calculateDefenseReadiness({ assumptions: [], evidence: [] });
    expect(result.score).toBe(0);
    expect(result.assumption_validation_rate).toBe(0);
    expect(result.mean_evidence_grounding_score).toBe(0);
  });

  it("scores 1.0 when all assumptions validated and all evidence grounding=1", () => {
    const assumptions = [
      makeAssumption("a1", true),
      makeAssumption("a2", true),
    ];
    const evidence = [
      makeEvidence("e1", 1.0),
      makeEvidence("e2", 1.0),
    ];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    expect(result.score).toBeCloseTo(1.0);
    expect(result.assumption_validation_rate).toBe(1);
    expect(result.mean_evidence_grounding_score).toBe(1);
  });

  it("scores < 0.4 when no assumptions validated and evidence grounding=0", () => {
    const assumptions = [
      makeAssumption("a1", false),
      makeAssumption("a2", false),
    ];
    const evidence = [makeEvidence("e1", 0)];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    expect(result.score).toBeLessThan(0.4);
  });

  it("applies 0.6/0.4 weighting correctly", () => {
    // 100% validated assumptions, 0.5 mean grounding
    const assumptions = [makeAssumption("a1", true)];
    const evidence = [makeEvidence("e1", 0.5)];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    // 0.6 * 1.0 + 0.4 * 0.5 = 0.8
    expect(result.score).toBeCloseTo(0.8);
  });

  it("ignores evidence items without a grounding score", () => {
    const assumptions = [makeAssumption("a1", true)];
    const evidence = [
      makeEvidence("e1", 0.8),
      makeEvidence("e2", null), // no score — excluded from mean
    ];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    // mean grounding = 0.8 (only e1 counted)
    // score = 0.6 * 1.0 + 0.4 * 0.8 = 0.92
    expect(result.score).toBeCloseTo(0.92);
    expect(result.scored_evidence_count).toBe(1);
  });

  it("partial assumption validation produces intermediate score", () => {
    const assumptions = [
      makeAssumption("a1", true),
      makeAssumption("a2", false),
    ];
    const evidence = [makeEvidence("e1", 0.6)];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    // 0.6 * 0.5 + 0.4 * 0.6 = 0.3 + 0.24 = 0.54
    expect(result.score).toBeCloseTo(0.54);
    expect(result.validated_assumption_count).toBe(1);
  });

  it("score is clamped to [0, 1]", () => {
    const assumptions = [makeAssumption("a1", true)];
    const evidence = [makeEvidence("e1", 1.0)];
    const result = calculateDefenseReadiness({ assumptions, evidence });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
