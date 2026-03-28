import { describe, expect, it } from "vitest";

import { normalizeHypothesisOutput } from "./useHypothesis";

describe("normalizeHypothesisOutput", () => {
  it("normalizes legacy hypothesis payloads into canonical entities", () => {
    const output = normalizeHypothesisOutput({
      id: "f53aec6d-f6a4-4f48-99c0-4cf6a022b038",
      case_id: "ff8ebd18-4f91-4462-a8b1-a2e3675bfc42",
      organization_id: "c1239080-4b22-4c11-99a4-0f81d95bb4a2",
      agent_run_id: null,
      hypotheses: [
        {
          title: "Reduce onboarding time",
          description: "Automating user provisioning will reduce onboarding cycle time by 30%.",
          category: "cost_reduction",
          estimated_impact: {
            low: 20000,
            high: 55000,
            unit: "usd",
            timeframe_months: 12,
          },
          confidence: 0.82,
          evidence: ["CSAT survey", "Ops baseline"],
          assumptions: ["Provisioning flow unchanged"],
          kpi_targets: ["Time to onboard"],
        },
      ],
      kpis: ["Time to onboard"],
      confidence: "high",
      reasoning: "Strong benchmark alignment",
      hallucination_check: true,
      created_at: "2026-03-20T10:10:10.000Z",
      updated_at: "2026-03-20T10:10:10.000Z",
    });

    expect(output.hypotheses).toHaveLength(1);
    expect(output.hypotheses[0].entity.category).toBe("cost_reduction");
    expect(output.hypotheses[0].entity.confidence).toBe("high");
    expect(output.hypotheses[0].entity.estimated_value).toMatchObject({
      low: "20000",
      high: "55000",
      unit: "usd",
      timeframe_months: 12,
    });
    expect(output.hypotheses[0].evidence).toEqual(["CSAT survey", "Ops baseline"]);
  });

  it("throws when payload drifts from expected schema", () => {
    expect(() =>
      normalizeHypothesisOutput({
        id: "f53aec6d-f6a4-4f48-99c0-4cf6a022b038",
        case_id: "ff8ebd18-4f91-4462-a8b1-a2e3675bfc42",
        organization_id: "c1239080-4b22-4c11-99a4-0f81d95bb4a2",
        agent_run_id: null,
        hypotheses: [
          {
            title: "Bad payload",
            description: "This now has the wrong confidence type and should fail validation.",
            category: "cost_reduction",
            confidence: "high",
            evidence: [],
            assumptions: [],
            kpi_targets: [],
          },
        ],
        kpis: [],
        confidence: "medium",
        reasoning: null,
        hallucination_check: true,
        created_at: "2026-03-20T10:10:10.000Z",
        updated_at: "2026-03-20T10:10:10.000Z",
      }),
    ).toThrow();
  });
});
