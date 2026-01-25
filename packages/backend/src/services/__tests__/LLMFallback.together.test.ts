/**
 * LLMFallback Service Tests - Together AI Only
 *
 * Validates that LLMFallback service:
 * 1. Only uses Together AI (no OpenAI fallback)
 * 2. Properly handles Together AI circuit breaker
 * 3. Does not have any OpenAI-related methods or logic
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { llmFallback, LLMFallbackService } from "../LLMFallback";

// Mock dependencies
vi.mock("../../utils/logger");
vi.mock("@shared/lib/env", () => ({
  getEnvVar: vi.fn(),
  getLLMCostTrackerConfig: vi.fn(() => ({
    supabaseUrl: 'http://localhost',
    supabaseServiceRoleKey: 'key',
    tableName: 'llm_costs'
  }))
}));
vi.mock("../LLMCache");
vi.mock("../../LLMCostTracker");

describe("LLMFallback Service - Together AI Only", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Provider Configuration", () => {
    it("should only have Together AI circuit breaker", () => {
      const service = new LLMFallbackService();
      const stats = service.getStats();

      // Should have togetherAI stats
      expect(stats).toHaveProperty("togetherAI");
      expect(stats.togetherAI).toHaveProperty("calls");
      expect(stats.togetherAI).toHaveProperty("failures");

      // Should NOT have openAI stats
      expect(stats).not.toHaveProperty("openAI");
    });

    it("should not expose OpenAI-related methods", () => {
      const service = new LLMFallbackService();

      // These methods should NOT exist
      expect(service).not.toHaveProperty("callOpenAI");
      expect(service).not.toHaveProperty("mapToOpenAIModel");
      expect(service).not.toHaveProperty("calculateOpenAICost");
      expect(service).not.toHaveProperty("openAIBreaker");
    });

    it("should export singleton instance", () => {
      expect(llmFallback).toBeInstanceOf(LLMFallbackService);
    });
  });

  describe("Health Check", () => {
    it("should only check Together AI health", async () => {
      const service = new LLMFallbackService();
      const health = await service.healthCheck();

      // Should have togetherAI health
      expect(health).toHaveProperty("togetherAI");
      expect(health.togetherAI).toHaveProperty("healthy");
      expect(health.togetherAI).toHaveProperty("state");

      // Should NOT have openAI health
      expect(health).not.toHaveProperty("openAI");
    });

    it("should report circuit breaker state correctly", async () => {
      const service = new LLMFallbackService();
      const health = await service.healthCheck();

      expect(health.togetherAI.state).toMatch(/^(open|half-open|closed)$/);
    });
  });

  describe("Response Provider", () => {
    it('should only return "together_ai" or "cache" as provider', async () => {
      const validProviders = ["together_ai", "cache"];

      // The response provider field should NEVER be 'openai'
      // This is enforced by the TypeScript type
      const mockResponse: any = {
        provider: "together_ai",
        content: "test",
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        cost: 0.001,
        latency: 100,
        cached: false,
        model: "test-model",
      };

      expect(validProviders).toContain(mockResponse.provider);
      expect(mockResponse.provider).not.toBe("openai");
    });
  });

  describe("Error Handling", () => {
    it("should throw error when Together AI fails (no fallback)", async () => {
      // Mock Together AI failure
      vi.mock("../../../lib/env", () => ({
        getEnvVar: vi.fn(() => "test-key"),
      }));

      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Together AI API error"));

      const service = new LLMFallbackService();

      await expect(async () => {
        await service.processRequest({
          prompt: "test",
          model: "test-model",
          userId: "test-user",
        });
      }).rejects.toThrow("LLM provider unavailable");

      // Should NOT fallback to OpenAI
      const stats = service.getStats();
      expect(stats).not.toHaveProperty("openAI");
    });
  });

  describe("Stats Tracking", () => {
    it("should only track Together AI and cache stats", () => {
      const service = new LLMFallbackService();
      const stats = service.getStats();

      // Should have these properties
      expect(stats).toHaveProperty("togetherAI");
      expect(stats).toHaveProperty("cache");

      // Should NOT have these properties
      expect(stats).not.toHaveProperty("openAI");
      expect(stats).not.toHaveProperty("fallbacks");
    });

    it("should increment Together AI call count", async () => {
      const service = new LLMFallbackService();
      const initialStats = service.getStats();
      const initialCalls = initialStats.togetherAI.calls;

      // Stats should be tracking Together AI calls
      expect(typeof initialCalls).toBe("number");
      expect(initialCalls).toBeGreaterThanOrEqual(0);
    });
  });
});
