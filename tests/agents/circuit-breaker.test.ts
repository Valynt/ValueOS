import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/ValyntApp/src/utils/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn(),
  },
}));

vi.mock("../../apps/ValyntApp/src/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    llm: vi.fn(),
    cache: vi.fn(),
  },
}));

vi.mock("../../apps/ValyntApp/src/lib/env", () => ({
  getEnvVar: vi.fn(() => "test-key"),
  env: { isBrowser: true },
}));

vi.mock("../../apps/ValyntApp/src/services/LLMCache", () => ({
  llmCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../apps/ValyntApp/src/services/LLMCostTracker", () => ({
  llmCostTracker: {
    calculateCost: vi.fn(() => 0.01),
    trackUsage: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../apps/ValyntApp/src/services/CostGovernanceService", () => ({
  costGovernance: {
    estimatePromptTokens: vi.fn(() => 10),
    checkRequest: vi.fn(),
    recordUsage: vi.fn(),
    getSummary: vi.fn(() => ({ ok: true })),
  },
}));

import {
  CircuitBreakerManager,
  type CircuitBreakerConfig,
} from "../../apps/ValyntApp/src/services/CircuitBreaker";
import { ExternalCircuitBreaker } from "../../apps/ValyntApp/src/services/ExternalCircuitBreaker";
import { LLMFallbackService } from "../../apps/ValyntApp/src/services/LLMFallback";
import { mcpGroundTruthService } from "../../apps/ValyntApp/src/services/MCPGroundTruthService";

describe("Agent Circuit Breaker Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();

    mcpGroundTruthService["circuitBreaker"].reset("external:groundtruth:financials");
    mcpGroundTruthService["circuitBreaker"].reset("external:groundtruth:verify");
    mcpGroundTruthService["circuitBreaker"].reset("external:groundtruth:benchmarks");
  });

  describe("Real state transitions", () => {
    const config: CircuitBreakerConfig = {
      windowMs: 60_000,
      failureRateThreshold: 1,
      latencyThresholdMs: 10_000,
      minimumSamples: 3,
      timeoutMs: 25,
      halfOpenMaxProbes: 1,
    };

    it("transitions CLOSED → OPEN after threshold failures", async () => {
      const manager = new CircuitBreakerManager(config);
      const breaker = new ExternalCircuitBreaker("test", manager);
      const key = "external:test:chat";

      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(key, async () => {
            throw new Error("upstream down");
          })
        ).rejects.toThrow("upstream down");
      }

      expect(breaker.getState(key)).toBe("open");

      const blockedTask = vi.fn().mockResolvedValue("should-not-run");
      await expect(breaker.execute(key, blockedTask)).rejects.toThrow("Circuit breaker open");
      expect(blockedTask).not.toHaveBeenCalled();
    });

    it("enters HALF_OPEN for a probe and closes after a successful recovery", async () => {
      const manager = new CircuitBreakerManager(config);
      const breaker = new ExternalCircuitBreaker("test", manager);
      const key = "external:test:recover";

      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(key, async () => {
            throw new Error("still failing");
          })
        ).rejects.toThrow("still failing");
      }

      const state = manager.getState(key)!;
      state.opened_at = new Date(Date.now() - 100).toISOString();

      let resolveProbe: ((value: string) => void) | undefined;
      const probePromise = breaker.execute(
        key,
        () =>
          new Promise<string>((resolve) => {
            resolveProbe = resolve;
          })
      );

      expect(manager.getState(key)?.state).toBe("half_open");
      expect(manager.getState(key)?.half_open_probes).toBe(1);

      resolveProbe?.("ok");
      await expect(probePromise).resolves.toBe("ok");

      expect(breaker.getState(key)).toBe("closed");
      expect(manager.getState(key)?.failure_count).toBe(0);
    });

    it("re-opens if the HALF_OPEN probe fails", async () => {
      const manager = new CircuitBreakerManager(config);
      const breaker = new ExternalCircuitBreaker("test", manager);
      const key = "external:test:reopen";

      for (let i = 0; i < 3; i++) {
        await expect(
          breaker.execute(key, async () => {
            throw new Error("failing");
          })
        ).rejects.toThrow("failing");
      }

      manager.getState(key)!.opened_at = new Date(Date.now() - 100).toISOString();

      await expect(
        breaker.execute(key, async () => {
          throw new Error("probe failed");
        })
      ).rejects.toThrow("probe failed");

      expect(breaker.getState(key)).toBe("open");
    });
  });

  describe("Fallback behavior on open circuits", () => {
    it("TogetherAI fallback rejects quickly once circuit is OPEN", async () => {
      const service = new LLMFallbackService();
      const request = { prompt: "hello", model: "model", userId: "u1" };
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

      fetchMock.mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("unavailable"),
      });

      await expect(service.processRequest(request)).rejects.toThrow(
        "LLM provider unavailable"
      );

      const firstCallCount = fetchMock.mock.calls.length;
      expect(service.getStats().circuitBreakers["external:together_ai:chat"].state).toBe("open");

      await expect(service.processRequest(request)).rejects.toThrow(
        "LLM provider unavailable"
      );

      expect(fetchMock).toHaveBeenCalledTimes(firstCallCount);
    });

    it("GroundTruth returns fallback null without calling fetch when circuit is OPEN", async () => {
      const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;

      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("down"),
      });

      const first = await mcpGroundTruthService.getFinancialData({ entityId: "ACME" });
      expect(first).toBeNull();

      const metrics = mcpGroundTruthService.getCircuitBreakerMetrics();
      expect(metrics["external:groundtruth:financials"].state).toBe("open");

      const firstCallCount = fetchMock.mock.calls.length;
      const second = await mcpGroundTruthService.getFinancialData({ entityId: "ACME" });

      expect(second).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(firstCallCount);
    });
  });
});
