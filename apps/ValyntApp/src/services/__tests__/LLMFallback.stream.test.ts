import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies with factories to prevent module execution issues
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn(),
  }
}));

vi.mock("../../lib/env", () => ({
  getEnvVar: vi.fn(),
  getLLMCostTrackerConfig: vi.fn().mockReturnValue({}),
}));

vi.mock("../LLMCache", () => ({
  llmCache: {
    get: vi.fn(),
    set: vi.fn(),
  }
}));

vi.mock("../LLMCostTracker", () => ({
  llmCostTracker: {
    trackUsage: vi.fn(),
    calculateCost: vi.fn(),
  }
}));

import { getEnvVar } from "../../lib/env";
import { LLMFallbackService } from "../LLMFallback";

describe("LLMFallback Service - Streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEnvVar as any).mockReturnValue("test-key");
  });

  it("should stream content from Together AI", async () => {
    const service = new LLMFallbackService();

    const mockChunks = [
      'data: {"choices": [{"delta": {"content": "Hello"}}]}\n\n',
      'data: {"choices": [{"delta": {"content": " world"}}]}\n\n',
      'data: [DONE]\n\n'
    ];

    const encoder = new TextEncoder();

    // Mocking response.body as an async iterable
    const mockBody = {
        async *[Symbol.asyncIterator]() {
            for (const chunk of mockChunks) {
                yield encoder.encode(chunk);
            }
        },
        getReader: () => {
             let i = 0;
             return {
                 read: async () => {
                     if (i >= mockChunks.length) return { done: true, value: undefined };
                     return { done: false, value: encoder.encode(mockChunks[i++]) };
                 },
                 releaseLock: () => {}
             }
        }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockBody,
    });

    const generator = service.streamRequest({
      prompt: "test",
      model: "mistral",
      userId: "test-user",
      stream: true
    });

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(["Hello", " world"]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining("together.ai"),
      expect.objectContaining({
        body: expect.stringContaining('"stream":true')
      })
    );
  });
});
