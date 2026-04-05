import { describe, expect, it } from "vitest";
import {
  ExecutiveNarrativeSchema,
  FinancialModelSchema,
  IntegrityAssessmentSchema,
  OpportunityContextSchema,
  ValueHypothesisDraftSchema,
  fromAgentMetaEvent,
  toAgentMetaEvent,
} from "./agent-schemas";

const sharedMeta = {
  traceId: "trace-123",
  agentId: "agent-abc",
} as const;

const confidence = {
  score: 0.72,
  basis: "mixed",
  explanation: "Based on current evidence and assumptions.",
  evidenceCount: 0,
} as const;

describe("agent stage schemas metadata", () => {
  it("requires shared metadata for every lifecycle payload", () => {
    const opportunity = OpportunityContextSchema.safeParse({
      stage: "INITIATED",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      accountName: "Acme Corp",
      problemStatement: "Escalating support costs",
      stakeholders: [],
      baselineMetrics: [],
      evidence: [],
      assumptions: [],
      confidence,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(opportunity.success).toBe(false);

    const draft = ValueHypothesisDraftSchema.safeParse({
      stage: "DRAFTING",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      hypothesisId: "a4c5165f-d4e5-4bb6-a5ce-3fc493f5163a",
      title: "Automate Tier-1 support",
      statement: "Automating triage reduces ticket handling volume.",
      valueDriver: "Cost savings",
      valueRange: { low: 10000, expected: 25000, high: 40000 },
      assumptions: [],
      evidence: [],
      confidence: { ...confidence, score: 0.68 },
      draftedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(draft.success).toBe(false);

    const model = FinancialModelSchema.safeParse({
      stage: "FINANCIAL",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      modelId: "0a44bdb8-8f65-4fc8-a32d-8ccd5d34975b",
      hypothesisId: "a4c5165f-d4e5-4bb6-a5ce-3fc493f5163a",
      modelVersion: "v1",
      scenarios: [
        {
          scenario: "expected",
          benefit: 50000,
          cost: 15000,
          netValue: 35000,
          paybackMonths: 6,
          roiPercent: 233,
        },
      ],
      assumptions: [],
      evidence: [],
      confidence: { ...confidence, score: 0.8 },
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(model.success).toBe(false);

    const assessment = IntegrityAssessmentSchema.safeParse({
      stage: "VALIDATING",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      assessmentId: "f70e6a34-3ce1-43f8-9a68-b245af8f646d",
      modelId: "0a44bdb8-8f65-4fc8-a32d-8ccd5d34975b",
      verdict: "approved",
      checks: [{ checkId: "chk-1", name: "range-check", status: "pass", finding: "within range" }],
      residualRisk: "low",
      confidence: { ...confidence, score: 0.84 },
      assessedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(assessment.success).toBe(false);

    const narrative = ExecutiveNarrativeSchema.safeParse({
      stage: "COMPOSING",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      narrativeId: "2e2831f2-7415-42f9-89d9-ca7dbe005abf",
      audience: "executive",
      headline: "Automation unlocks margin",
      executiveSummary: "Expected value materially exceeds implementation cost.",
      sections: [{ heading: "Financial impact", body: "Positive net value in base case.", claimIds: [] }],
      evidence: [],
      assumptions: [],
      confidence: { ...confidence, score: 0.77 },
      generatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(narrative.success).toBe(false);
  });

  it("accepts traceId/agentId on stage payloads", () => {
    const parsed = OpportunityContextSchema.parse({
      stage: "INITIATED",
      organizationId: "c7a4b30d-b803-4f44-b957-6116dca3e4dd",
      opportunityId: "d9bc2d5e-0b7a-45eb-b0c2-688f8f8b8270",
      accountName: "Acme Corp",
      problemStatement: "Escalating support costs",
      stakeholders: [],
      baselineMetrics: [],
      evidence: [],
      assumptions: [],
      confidence,
      createdAt: "2026-01-01T00:00:00.000Z",
      ...sharedMeta,
    });

    expect(parsed.traceId).toBe(sharedMeta.traceId);
    expect(parsed.agentId).toBe(sharedMeta.agentId);
  });
});

describe("agent metadata adapter", () => {
  it("maps payload metadata to event/log naming", () => {
    expect(toAgentMetaEvent(sharedMeta)).toEqual({
      trace_id: "trace-123",
      agent_id: "agent-abc",
    });
  });

  it("maps event/log metadata back to payload naming", () => {
    expect(
      fromAgentMetaEvent({
        trace_id: "trace-123",
        agent_id: "agent-abc",
      }),
    ).toEqual(sharedMeta);
  });
});
