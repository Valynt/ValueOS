import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createLLMClient } from "./client";

const ORIGINAL_ENV = { ...process.env };

describe("LLMClient.complete", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("calls /api/llm/chat and maps structured response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          content: "Real completion",
          model: "gpt-4o",
          usage: {
            promptTokens: 4,
            completionTokens: 7,
            totalTokens: 11,
          },
        },
      }),
    } as Response);

    const client = createLLMClient({ model: "gpt-4" });
    const result = await client.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/llm/chat",
      expect.objectContaining({ method: "POST" }),
    );
    expect(result.content).toBe("Real completion");
    expect(result.model).toBe("gpt-4o");
    expect(result.usage.totalTokens).toBe(11);
  });

  it("throws in release mode when completion content is empty", async () => {
    process.env.NODE_ENV = "production";
    vi.spyOn(globalThis, "fetch" as never).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          content: "",
          model: "gpt-4o",
        },
      }),
    } as Response);

    const client = createLLMClient();

    await expect(
      client.complete({
        messages: [{ role: "user", content: "hello" }],
      }),
    ).rejects.toThrow(/Empty LLM completion content/);
  });
});
