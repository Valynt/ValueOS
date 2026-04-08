import { describe, expect, it, vi } from "vitest";

import { buildRepairPrompt, executeContractAwareRetry } from "../AgentRetryContract.js";

describe("AgentRetryContract", () => {
  it("builds repair prompts with violation details", () => {
    const prompt = buildRepairPrompt(
      { type: "object", properties: { score: { type: "number" } } },
      {
        approved: false,
        failureType: "schema",
        violations: [
          { message: "Required field missing", path: "score", code: "invalid_type" },
          { message: "Output must be JSON" },
        ],
      }
    );

    expect(prompt).toContain("Violations to fix");
    expect(prompt).toContain("Required field missing at score (invalid_type)");
    expect(prompt).toContain("Output must be JSON");
  });

  it("retries parse errors and returns approved output", async () => {
    const generator = vi
      .fn<({ prompt, attempt }: { prompt: string; attempt: number }) => Promise<string>>()
      .mockResolvedValueOnce("bad-json")
      .mockResolvedValueOnce('{"ok":true}');

    const validate = vi
      .fn<
        (
          rawOutput: string,
          payload: { outputSchema: unknown; originalSchema: unknown }
        ) => Promise<{ approved: boolean; output?: { ok: boolean }; failureType?: "parse" }>
      >()
      .mockResolvedValueOnce({ approved: false, failureType: "parse", details: "Invalid JSON" })
      .mockResolvedValueOnce({ approved: true, output: { ok: true } });

    const result = await executeContractAwareRetry({
      generator,
      complianceEngine: { validate },
      outputSchema: { type: "object", properties: { ok: { type: "boolean" } } },
      initialPrompt: "generate",
      agentPolicy: { maxRetries: 2 },
    });

    expect(result).toEqual({ approved: true, output: { ok: true }, retryCount: 1 });
    expect(generator.mock.calls[1]?.[0].prompt).toContain("Repair the previous response");
  });
});
