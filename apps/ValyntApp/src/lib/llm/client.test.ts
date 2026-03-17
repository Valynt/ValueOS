import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock apiClient before importing the module under test
vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { createLLMClient } from "./client";

import { apiClient } from "@/api/client/unified-api-client";

const mockPost = vi.mocked(apiClient.post);

const ORIGINAL_ENV = { ...process.env };

describe("LLMClient.complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "test" };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls /api/llm/chat and maps structured response", async () => {
    mockPost.mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: {
          content: "Real completion",
          model: "gpt-4o",
          usage: { promptTokens: 4, completionTokens: 7, totalTokens: 11 },
        },
      },
    });

    const client = createLLMClient({ model: "gpt-4" });
    const result = await client.complete({
      messages: [{ role: "user", content: "hello" }],
    });

    expect(mockPost).toHaveBeenCalledWith(
      "/api/llm/chat",
      expect.objectContaining({ messages: expect.any(Array) }),
    );
    expect(result.content).toBe("Real completion");
    expect(result.model).toBe("gpt-4o");
    expect(result.usage.totalTokens).toBe(11);
  });

  it("throws in release mode when completion content is empty", async () => {
    process.env.NODE_ENV = "production";

    mockPost.mockResolvedValue({
      success: true,
      data: {
        success: true,
        data: { content: "", model: "gpt-4o" },
      },
    });

    const client = createLLMClient();

    await expect(
      client.complete({ messages: [{ role: "user", content: "hello" }] }),
    ).rejects.toThrow(/Empty LLM completion content/);
  });
});
