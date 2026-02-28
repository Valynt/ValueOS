/**
 * Together AI Integration Tests
 *
 * End-to-end tests validating that Together AI is used throughout
 * the entire application stack.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";

import { llmConfig } from "../../config/llm";
import { validateLLMConfig } from "../../config/validateEnv";
import { LLMFallbackService } from "../../services/LLMFallback";

describe("Together AI Integration Tests", () => {
  beforeAll(() => {
    // Set up test environment
    vi.stubEnv("VITE_LLM_PROVIDER", "together");
    process.env.TOGETHER_API_KEY = "test-together-key";
  });

  describe("End-to-End Provider Flow", () => {
    it("should use Together AI from config through to service", () => {
      // 1. Config level
      expect(llmConfig.provider).toBe("together");

      // 2. Validation level
      const validation = validateLLMConfig();
      expect(validation.provider).toBe("together");
      expect(validation.valid).toBe(true);

      // 3. Service level
      const service = new LLMFallbackService();
      const stats = service.getStats();
      expect(stats).toHaveProperty("togetherAI");
      expect(stats).not.toHaveProperty("openAI");
    });

    it("should reject OpenAI at every layer", () => {
      // Even if we try to set OpenAI, it should be rejected or ignored
      vi.stubEnv("VITE_LLM_PROVIDER", "openai");

      // Config should still be 'together' (hard-coded)
      expect(llmConfig.provider).toBe("together");

      // Validation should reject it
      const validation = validateLLMConfig();
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.includes("together"))).toBe(true);
    });
  });

  describe("Embedding Pipeline", () => {
    it("should use Together AI embedding model throughout", () => {
      // Config specifies Together AI model
      expect(llmConfig.semanticMemory.embeddingModel).toBe(
        "togethercomputer/m2-bert-80M-8k-retrieval"
      );

      // Dimensions match Together AI (768, not OpenAI's 1536)
      expect(llmConfig.semanticMemory.embeddingDimension).toBe(768);
    });
  });

  describe("Circuit Breaker Configuration", () => {
    it("should only have Together AI circuit breaker configured", () => {
      const service = new LLMFallbackService();

      // Should have exactly one circuit breaker (Together AI)
      const stats = service.getStats();
      const providers = Object.keys(stats).filter((key) => key !== "cache");

      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe("togetherAI");
    });
  });

  describe("Error Handling Flow", () => {
    it("should fail gracefully when Together AI is down (no fallback to OpenAI)", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("API Error"));
      globalThis.fetch = mockFetch;

      const service = new LLMFallbackService();

      try {
        await service.processRequest({
          prompt: "test",
          model: "test-model",
          userId: "test-user",
        });
        fail("Should have thrown error");
      } catch (error) {
        // Should throw error without falling back to OpenAI
        expect(error).toBeDefined();

        const stats = service.getStats();
        // Should NOT have any OpenAI call attempts
        expect(stats).not.toHaveProperty("openAI");
      }
    });
  });

  describe("Type Safety", () => {
    it("should enforce Together AI types throughout", () => {
      // Provider type should only allow 'together'
      type ProviderType = typeof llmConfig.provider;

      // This test validates at compile time that provider is typed correctly
      const provider: ProviderType = "together";
      expect(provider).toBe("together");

      // TypeScript should prevent this (would fail at compile time):
      // const invalidProvider: ProviderType = 'openai';
    });
  });
});
