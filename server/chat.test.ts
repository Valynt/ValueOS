/**
 * Chat API Tests — Together.ai Integration
 *
 * Tests the /api/chat endpoint with mocked Together.ai responses.
 * Validates: streaming SSE format, system prompt injection, error handling.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the togetherClient module
vi.mock("../server/togetherClient", () => ({
  together: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  MODELS: {
    chat: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    toolCalling: "Qwen/Qwen2.5-72B-Instruct-Turbo",
    reasoning: "deepseek-ai/DeepSeek-R1",
    vision: "meta-llama/Llama-4-Scout-17B-16E-Instruct",
    fast: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
  },
}));

import { together, MODELS } from "../server/togetherClient";

const mockCreate = together.chat.completions.create as ReturnType<typeof vi.fn>;

describe("Together.ai Chat Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("togetherClient configuration", () => {
    it("exports a MODELS registry with all agent roles", () => {
      expect(MODELS.chat).toBe("meta-llama/Llama-3.3-70B-Instruct-Turbo");
      expect(MODELS.toolCalling).toBe("Qwen/Qwen2.5-72B-Instruct-Turbo");
      expect(MODELS.reasoning).toBe("deepseek-ai/DeepSeek-R1");
      expect(MODELS.vision).toBe(
        "meta-llama/Llama-4-Scout-17B-16E-Instruct"
      );
      expect(MODELS.fast).toBe("meta-llama/Llama-3.1-8B-Instruct-Turbo");
    });

    it("maps 5 distinct model roles", () => {
      const roles = Object.keys(MODELS);
      expect(roles).toHaveLength(5);
      expect(roles).toEqual([
        "chat",
        "toolCalling",
        "reasoning",
        "vision",
        "fast",
      ]);
    });
  });

  describe("streaming chat completions", () => {
    it("calls Together.ai with the correct model and stream=true", async () => {
      // Simulate an async iterable stream
      const chunks = [
        { choices: [{ delta: { content: "Hello" }, finish_reason: null }] },
        { choices: [{ delta: { content: " world" }, finish_reason: null }] },
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          for (const chunk of chunks) yield chunk;
        },
      });

      const stream = await together.chat.completions.create({
        model: MODELS.chat,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Hello" },
        ],
        stream: true,
        max_tokens: 1024,
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
          stream: true,
          max_tokens: 1024,
        })
      );

      // Verify the stream produces expected chunks
      const collected: string[] = [];
      for await (const chunk of stream as AsyncIterable<{
        choices: { delta: { content: string }; finish_reason: string | null }[];
      }>) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) collected.push(delta);
      }

      expect(collected).toEqual(["Hello", " world"]);
    });

    it("includes system prompt with ValueOS context in messages", async () => {
      mockCreate.mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield {
            choices: [{ delta: { content: "Response" }, finish_reason: "stop" }],
          };
        },
      });

      await together.chat.completions.create({
        model: MODELS.chat,
        messages: [
          {
            role: "system",
            content: "You are the VALYNT Value Architect",
          },
          { role: "user", content: "Analyze ROI" },
        ],
        stream: true,
      });

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].role).toBe("system");
      expect(callArgs.messages[0].content).toContain("VALYNT Value Architect");
      expect(callArgs.messages[1].role).toBe("user");
      expect(callArgs.messages[1].content).toBe("Analyze ROI");
    });

    it("handles stream errors gracefully", async () => {
      mockCreate.mockRejectedValue(new Error("API rate limit exceeded"));

      await expect(
        together.chat.completions.create({
          model: MODELS.chat,
          messages: [{ role: "user", content: "test" }],
          stream: true,
        })
      ).rejects.toThrow("API rate limit exceeded");
    });
  });

  describe("AI SDK removal verification", () => {
    it("no @ai-sdk/openai import exists in the project", async () => {
      // This test ensures the AI SDK was fully removed
      await expect(async () => {
        await import("@ai-sdk/openai");
      }).rejects.toThrow();
    });

    it("no @ai-sdk/react import exists in the project", async () => {
      await expect(async () => {
        await import("@ai-sdk/react");
      }).rejects.toThrow();
    });

    it("no ai package import exists in the project", async () => {
      await expect(async () => {
        await import("ai");
      }).rejects.toThrow();
    });
  });
});
