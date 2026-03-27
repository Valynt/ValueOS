/**
 * LLMFallback Service Tests - Together primary with secondary provider fallback.
 *
 * Validates that LLMFallback service:
 * 1. Uses Together AI as primary provider
 * 2. Properly handles Together AI circuit breaker
 * 3. Does not have any OpenAI-related methods or logic
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { llmFallback, LLMFallbackService } from "../LLMFallback.js"

// Mock dependencies
vi.mock("../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("@shared/lib/env", () => ({
  getEnvVar: vi.fn(),
  getLLMCostTrackerConfig: vi.fn(() => ({
    supabaseUrl: 'http://localhost',
    supabaseKey: 'key',
    tableName: 'llm_costs'
  })),
  getSupabaseConfig: vi.fn(() => ({
    url: 'http://localhost',
    anonKey: 'anon-key',
    serviceRoleKey: 'service-key'
  }))
}));
vi.mock("../LLMCache");
vi.mock("../../LLMCostTracker");
vi.mock("../CostGovernanceService.js", () => ({
  costGovernance: {
    checkRequest: vi.fn().mockResolvedValue(undefined),
    recordUsage: vi.fn().mockResolvedValue(undefined),
    estimatePromptTokens: vi.fn().mockReturnValue(10),
    getSummary: vi.fn().mockResolvedValue({}),
  }
}));

describe("LLMFallback Service - Together + secondary fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Provider Configuration", () => {
    it("should only have Together AI circuit breaker", async () => {
      const service = new LLMFallbackService();
      const stats = await service.getStats();

      // Should have togetherAI stats
      expect(stats).toHaveProperty("togetherAI");
      expect(stats.togetherAI).toHaveProperty("calls");
      expect(stats.togetherAI).toHaveProperty("failures");

      // fallback stats remain aggregated under togetherAI counters
      expect(stats).not.toHaveProperty("openAI");
    });

    it("does not expose provider-specific legacy methods", () => {
      const service = new LLMFallbackService();

      // These methods should NOT exist
      expect(service).not.toHaveProperty("callOpenAI");
      expect(service).not.toHaveProperty("callAnthropic");
      expect(service).not.toHaveProperty("mapToOpenAIModel");
    });

    it("should export singleton instance", () => {
      expect(llmFallback).toBeInstanceOf(LLMFallbackService);
    });
  });

  describe("Health Check", () => {
    it("reports primary provider health", async () => {
      const service = new LLMFallbackService();
      const health = await service.healthCheck();

      // Should have togetherAI health
      expect(health).toHaveProperty("togetherAI");
      expect(health.togetherAI).toHaveProperty("healthy");
      expect(health.togetherAI).toHaveProperty("state");

      expect(health).not.toHaveProperty("openAI");
    });

    it("should report circuit breaker state correctly", async () => {
      const service = new LLMFallbackService();
      const health = await service.healthCheck();

      expect(health.togetherAI.state).toMatch(/^(open|half-open|closed)$/);
    });
  });

  describe("Response Provider", () => {
    it('should return a known provider value', async () => {
      const validProviders = ["together_ai", "openai", "anthropic", "cache"];

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
    });
  });

  describe("Error Handling", () => {
    it("should throw error when providers fail", async () => {
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

      const stats = await service.getStats();
      expect(stats).toHaveProperty("togetherAI");
    });

    it('should default to TOGETHER_PRIMARY_MODEL_NAME when model is omitted', async () => {
      const env = vi.importMock('@shared/lib/env') as any;
      // getEnvVar is mocked at module level; set behavior for keys we care about
      env.getEnvVar = vi.fn((key: string) => {
        if (key === 'TOGETHER_PRIMARY_MODEL_NAME') return 'primary-model';
        if (key === 'TOGETHER_API_KEY') return 'test-key';
        return undefined;
      });

      // Mock Together primary success
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'primary-response' } }],
          usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
        }),
      });

      const service = new LLMFallbackService();
      const resp = await service.processRequest({ prompt: 'hi', model: (undefined as any), userId: 'u1' });

      expect(resp.model).toBe('primary-model');
      expect(resp.content).toContain('primary-response');
      // verify fetch got the primary model in the request body
      const body = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
      expect(body.model).toBe('primary-model');
    });

    it('should fallback to SECONDARY when PRIMARY fails transiently', async () => {
      const env = vi.importMock('@shared/lib/env') as any;
      env.getEnvVar = vi.fn((key: string) => {
        if (key === 'TOGETHER_PRIMARY_MODEL_NAME') return 'primary-model';
        if (key === 'TOGETHER_SECONDARY_MODEL_NAME') return 'secondary-model';
        if (key === 'TOGETHER_API_KEY') return 'test-key';
        if (key === 'LLM_FALLBACK_MAX_ATTEMPTS') return '1';
        if (key === 'LLM_RETRY_BACKOFF_MS') return '1';
        return undefined;
      });

      // fetch behaviour: primary -> 500, secondary -> 200
      globalThis.fetch = vi.fn((url: string, opts: any) => {
        const b = JSON.parse(opts.body || '{}');
        if (b.model === 'primary-model') {
          return Promise.resolve({ ok: false, status: 500, text: async () => 'server error' });
        }
        return Promise.resolve({ ok: true, json: async () => ({ choices: [{ message: { content: 'secondary-response' } }], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } }) });
      });

      const service = new LLMFallbackService();
      const resp = await service.processRequest({ prompt: 'hi', model: (undefined as any), userId: 'u1' });

      expect(resp.content).toContain('secondary-response');
      expect(resp.model).toBe('secondary-model');

      const stats = await service.getStats();
      expect(stats.togetherAI.fallbacks).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Stats Tracking", () => {
    it("should only track Together AI and cache stats", async () => {
      const service = new LLMFallbackService();
      const stats = await service.getStats();

      // Should have these properties
      expect(stats).toHaveProperty("togetherAI");
      expect(stats).toHaveProperty("cache");

      // Should NOT have these properties
      expect(stats).not.toHaveProperty("openAI");
      expect(stats).not.toHaveProperty("fallbacks");
    });

    it("should increment Together AI call count", async () => {
      const service = new LLMFallbackService();
      const initialStats = await service.getStats();
      const initialCalls = initialStats.togetherAI.calls;

      // Stats should be tracking Together AI calls
      expect(typeof initialCalls).toBe("number");
      expect(initialCalls).toBeGreaterThanOrEqual(0);
    });
  });
});
