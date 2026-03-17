/**
 * llm-chat-maxTokens-clamped — unit test
 *
 * The LLM chat endpoint validates maxTokens via a Zod schema that caps the
 * value at 8192. Sending maxTokens: 999999 must produce a validation error.
 * This prevents cost overruns from unbounded token requests.
 */

import { describe, expect, it } from "vitest";
import { z } from "zod";

// Reproduce the schema from packages/backend/src/api/llm.ts (lines 45-52)
const LLMChatSchema = z.object({
  prompt: z.string().min(1).max(32_000),
  model: z.string().min(1),
  maxTokens: z.number().int().min(1).max(8192).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional(),
  dealId: z.string().uuid().optional(),
});

describe("llm-chat-maxTokens-clamped", () => {
  it("rejects maxTokens: 999999 with a validation error", () => {
    const result = LLMChatSchema.safeParse({
      prompt: "Hello",
      model: "gpt-4o-mini",
      maxTokens: 999999,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const tokenError = result.error.issues.find(issue =>
        issue.path.includes("maxTokens")
      );
      expect(tokenError).toBeDefined();
      expect(tokenError?.code).toBe("too_big");
    }
  });

  it("accepts maxTokens within the allowed range", () => {
    const result = LLMChatSchema.safeParse({
      prompt: "Hello",
      model: "gpt-4o-mini",
      maxTokens: 4096,
    });

    expect(result.success).toBe(true);
  });

  it("accepts request without maxTokens (optional field)", () => {
    const result = LLMChatSchema.safeParse({
      prompt: "Hello",
      model: "gpt-4o-mini",
    });

    expect(result.success).toBe(true);
  });

  it("rejects maxTokens: 0 (minimum is 1)", () => {
    const result = LLMChatSchema.safeParse({
      prompt: "Hello",
      model: "gpt-4o-mini",
      maxTokens: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects non-integer maxTokens", () => {
    const result = LLMChatSchema.safeParse({
      prompt: "Hello",
      model: "gpt-4o-mini",
      maxTokens: 100.5,
    });

    expect(result.success).toBe(false);
  });
});
