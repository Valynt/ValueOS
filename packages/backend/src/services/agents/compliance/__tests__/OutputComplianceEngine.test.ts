import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("OutputComplianceEngine", () => {
  const ContractOutputSchema = z
    .object({
      confidence: z.number().min(0).max(1),
      evidence: z.array(z.object({ id: z.string() })),
      summary: z.string(),
    })
    .strict();

  const contract = {
    version: "1.0.0",
    outputSchema: ContractOutputSchema,
    policy: {
      requireStructuredOutput: true,
      maxRetries: 2,
      repairOnFailure: true,
    },
  };

  it("rejects prose/markdown responses instead of strict JSON", async () => {
    const { OutputComplianceEngine } = await import("../OutputComplianceEngine.js");
    const engine = new OutputComplianceEngine();

    await expect(
      engine.validateOutput({
        rawOutput:
          "```json\n{\"confidence\":0.5,\"evidence\":[{\"id\":\"ev-1\"}],\"summary\":\"ok\"}\n```",
        contract,
        traceId: "trace-md-reject",
      })
    ).rejects.toMatchObject({
      code: "SCHEMA_VALIDATION_FAILED",
    });
  });

  it("rejects schema mismatches", async () => {
    const { OutputComplianceEngine } = await import("../OutputComplianceEngine.js");
    const engine = new OutputComplianceEngine();

    await expect(
      engine.validateOutput({
        rawOutput: JSON.stringify({
          confidence: "high",
          evidence: [{ id: "ev-1" }],
          summary: "wrong confidence type",
        }),
        contract,
        traceId: "trace-schema-mismatch",
      })
    ).rejects.toMatchObject({
      code: "SCHEMA_VALIDATION_FAILED",
    });
  });

  it("rejects high confidence outputs with missing evidence", async () => {
    const { OutputComplianceEngine } = await import("../OutputComplianceEngine.js");
    const engine = new OutputComplianceEngine();

    await expect(
      engine.validateOutput({
        rawOutput: JSON.stringify({
          confidence: 0.93,
          evidence: [],
          summary: "high confidence claim without support",
        }),
        contract,
        traceId: "trace-evidence-required",
      })
    ).rejects.toMatchObject({
      code: "MISSING_EVIDENCE",
    });
  });
});
