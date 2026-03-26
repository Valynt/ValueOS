/**
 * LLMFallback Service Tests - Streaming
 *
 * Validates that LLMFallback service:
 * 1. Correctly handles streaming requests
 * 2. Accumulates content and usage
 * 3. Handles SSE parsing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { llmCache } from "../LLMCache.js";
import { llmCostTracker } from "../LLMCostTracker.js";
import { llmFallback } from "../LLMFallback.js";

// Mock dependencies
vi.mock("../../utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));
vi.mock("@shared/lib/env", () => ({
  getEnvVar: vi.fn(key => {
    if (key === "TOGETHER_API_KEY") return "test-key";
    return undefined;
  }),
  getLLMCostTrackerConfig: vi.fn(() => ({
    supabaseUrl: "http://localhost",
    supabaseKey: "key",
    tableName: "llm_costs",
  })),
  getSupabaseConfig: vi.fn(() => ({
    url: "http://localhost",
    anonKey: "anon-key",
    serviceRoleKey: "service-key",
  })),
}));
vi.mock("../LLMCache");
vi.mock("../LLMCostTracker");
vi.mock("../CostGovernanceService.js", () => ({
  costGovernance: {
    checkRequest: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    estimatePromptTokens: vi.fn().mockReturnValue(10),
    getSummary: vi.fn().mockResolvedValue({}),
  },
}));

describe("LLMFallback Service - Streaming", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSSEStream = (chunks: string[]) => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    return stream;
  };

  it("should stream content from Together AI", async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
      "data: [DONE]\n\n",
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockSSEStream(sseChunks),
    } as any);

    const request = {
      prompt: "Hi",
      model: "test-model",
      userId: "user-1",
    };

    const generator = llmFallback.streamRequest(request);

    const parts = [];
    for await (const chunk of generator) {
      if (chunk.content) parts.push(chunk.content);
    }

    expect(parts).toEqual(["Hello", " World"]);

    // Verify usage tracking (estimated or zero since usage not provided in chunks)
    expect(llmCostTracker.trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        model: "test-model",
        success: true,
      })
    );

    // Verify caching — the first arg is tenantId (may be undefined when
    // not supplied on the request), followed by prompt, model, content, metadata.
    expect(llmCache.set).toHaveBeenCalledWith(
      request.tenantId ?? expect.anything(),
      request.prompt,
      request.model,
      "Hello World",
      expect.any(Object)
    );
  });

  it("should handle usage data in stream", async () => {
    const sseChunks = [
      'data: {"choices":[{"delta":{"content":"Test"}}]}\n\n',
      'data: {"usage":{"prompt_tokens":5,"completion_tokens":2}}\n\n',
      "data: [DONE]\n\n",
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockSSEStream(sseChunks),
    } as any);

    const request = {
      prompt: "Test",
      model: "test-model",
      userId: "user-1",
    };

    const generator = llmFallback.streamRequest(request);
    for await (const chunk of generator) {
      // consume
    }

    expect(llmCostTracker.trackUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        promptTokens: 5,
        completionTokens: 2,
      })
    );
  });

  it("should return cached response as stream", async () => {
    vi.mocked(llmCache.get).mockResolvedValue({
      response: "Cached content",
      model: "test-model",
      promptTokens: 10,
      completionTokens: 5,
      cached: true,
    } as any);

    const request = {
      prompt: "Test",
      model: "test-model",
      userId: "user-1",
    };

    const generator = llmFallback.streamRequest(request);

    const chunks = [];
    for await (const chunk of generator) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toEqual({ content: "Cached content", done: true });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
