import { describe, expect, it } from "vitest";

import {
  FinancialModelSchema,
  ValueHypothesisDraftSchema,
  fromValueLifecycleEventPayload,
  toValueLifecycleEventPayload,
} from "../agent-schemas";

const validEvidenceRef = {
  id: "00000000-0000-4000-8000-000000000001",
  type: "benchmark" as const,
  source: "industry study",
  reference: "benchmark-2026",
};

const validConfidence = {
  score: 0.78,
  basis: "mixed" as const,
  explanation: "benchmark and customer interview corroborate estimate",
  evidenceCount: 1,
};

const baseAssumption = {
  id: "00000000-0000-4000-8000-000000000010",
  name: "Adoption rate",
  category: "adoption" as const,
  value: 0.3,
  rationale: "Initial pilot cohorts indicate achievable adoption",
  confidence: validConfidence,
  sourceType: "customer-confirmed" as const,
};

const agentMetadata = {
  traceId: "trace-123",
  agentId: "OpportunityAgent",
};

describe("agent assumption evidence linkage", () => {
  it("accepts supported assumptions with linked evidence refs", () => {
    const result = ValueHypothesisDraftSchema.safeParse({
      ...agentMetadata,
      schemaVersion: "v1",
      stage: "DRAFTING",
      organizationId: "00000000-0000-4000-8000-000000000101",
      opportunityId: "00000000-0000-4000-8000-000000000102",
      hypothesisId: "00000000-0000-4000-8000-000000000103",
      title: "Automate onboarding",
      statement: "Automation can reduce onboarding cycle time by 25%",
      valueDriver: "Operational efficiency",
      valueRange: {
        low: 10000,
        expected: 25000,
        high: 40000,
      },
      assumptions: [
        {
          ...baseAssumption,
          evidenceState: "supported",
          evidenceRefs: [validEvidenceRef],
        },
      ],
      evidence: [validEvidenceRef],
      confidence: validConfidence,
      draftedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects pending assumptions without pendingReason", () => {
    const result = FinancialModelSchema.safeParse({
      ...agentMetadata,
      schemaVersion: "v1",
      stage: "FINANCIAL",
      organizationId: "00000000-0000-4000-8000-000000000201",
      opportunityId: "00000000-0000-4000-8000-000000000202",
      modelId: "00000000-0000-4000-8000-000000000203",
      hypothesisId: "00000000-0000-4000-8000-000000000204",
      modelVersion: "v1",
      scenarios: [
        {
          scenario: "expected",
          benefit: 50000,
          cost: 10000,
          netValue: 40000,
          paybackMonths: 6,
          roiPercent: 300,
        },
      ],
      assumptions: [
        {
          ...baseAssumption,
          evidenceState: "pending",
          evidenceRefs: [],
        },
      ],
      evidence: [validEvidenceRef],
      confidence: validConfidence,
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("requires shared agent metadata on lifecycle payloads", () => {
    const result = ValueHypothesisDraftSchema.safeParse({
      schemaVersion: "v1",
      stage: "DRAFTING",
      organizationId: "00000000-0000-4000-8000-000000000101",
      opportunityId: "00000000-0000-4000-8000-000000000102",
      hypothesisId: "00000000-0000-4000-8000-000000000103",
      title: "Automate onboarding",
      statement: "Automation can reduce onboarding cycle time by 25%",
      valueDriver: "Operational efficiency",
      valueRange: {
        low: 10000,
        expected: 25000,
        high: 40000,
      },
      assumptions: [
        {
          ...baseAssumption,
          evidenceState: "supported",
          evidenceRefs: [validEvidenceRef],
        },
      ],
      evidence: [validEvidenceRef],
      confidence: validConfidence,
      draftedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("requires schemaVersion on lifecycle payloads", () => {
    const result = ValueHypothesisDraftSchema.safeParse({
      ...agentMetadata,
      stage: "DRAFTING",
      organizationId: "00000000-0000-4000-8000-000000000101",
      opportunityId: "00000000-0000-4000-8000-000000000102",
      hypothesisId: "00000000-0000-4000-8000-000000000103",
      title: "Automate onboarding",
      statement: "Automation can reduce onboarding cycle time by 25%",
      valueDriver: "Operational efficiency",
      valueRange: {
        low: 10000,
        expected: 25000,
        high: 40000,
      },
      assumptions: [
        {
          ...baseAssumption,
          evidenceState: "supported",
          evidenceRefs: [validEvidenceRef],
        },
      ],
      evidence: [validEvidenceRef],
      confidence: validConfidence,
      draftedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("serializes and deserializes lifecycle payload schemaVersion", () => {
    const lifecyclePayload = {
      ...agentMetadata,
      schemaVersion: "v1" as const,
      stage: "DRAFTING" as const,
      organizationId: "00000000-0000-4000-8000-000000000101",
      opportunityId: "00000000-0000-4000-8000-000000000102",
      hypothesisId: "00000000-0000-4000-8000-000000000103",
      title: "Automate onboarding",
      statement: "Automation can reduce onboarding cycle time by 25%",
      valueDriver: "Operational efficiency",
      valueRange: {
        low: 10000,
        expected: 25000,
        high: 40000,
      },
      assumptions: [
        {
          ...baseAssumption,
          evidenceState: "supported" as const,
          evidenceRefs: [validEvidenceRef],
        },
      ],
      evidence: [validEvidenceRef],
      confidence: validConfidence,
      draftedAt: "2026-01-01T00:00:00.000Z",
    };

    const serialized = toValueLifecycleEventPayload(lifecyclePayload);
    expect(serialized.schema_version).toBe("v1");
    expect(serialized.schemaVersion).toBe("v1");

    const deserialized = fromValueLifecycleEventPayload(serialized);
    expect(deserialized.schemaVersion).toBe("v1");
  });
});
