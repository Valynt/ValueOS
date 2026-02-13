import { describe, expect, it, vi, afterEach } from "vitest";
import { createLLMClient } from "./client";

describe("LLMClient.complete", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls /api/llm/chat and returns provider content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: "resp_123",
            content: "generated answer",
            model: "gpt-4o-mini",
            usage: { promptTokens: 2, completionTokens: 3, totalTokens: 5 },
            finishReason: "stop",
          },
        }),
      })
    );

    const client = createLLMClient({ model: "gpt-4o-mini" });
    const response = await client.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/llm/chat",
      expect.objectContaining({ method: "POST" })
    );
    expect(response.content).toBe("generated answer");
    expect(response.usage.totalTokens).toBe(5);
  });
});
