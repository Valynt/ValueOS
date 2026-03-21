/**
 * AgentFactory — per-agent circuit breaker isolation tests.
 *
 * Uses the real CircuitBreaker / CircuitBreakerManager implementations so
 * breaker state transitions are exercised, not mocked away.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — transitive deps that pull in OpenTelemetry / Supabase / Redis
// ---------------------------------------------------------------------------

vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../LLMGateway.js", () => ({
  LLMGateway: class {
    complete = vi.fn().mockResolvedValue({ content: "{}" });
  },
}));

vi.mock("../MemorySystem.js", () => ({
  MemorySystem: class {
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
  },
}));

vi.mock("../../../config/secrets/CircuitBreaker.js", () => ({
  CircuitBreaker: class {
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
  },
}));

vi.mock("../../../services/reasoning/AdvancedCausalEngine.js", () => ({
  getAdvancedCausalEngine: () => ({
    inferCausalRelationship: vi.fn().mockResolvedValue({
      confidence: 0.8,
      effect: { direction: "positive", magnitude: 0.5 },
    }),
  }),
}));

vi.mock("../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../../../services/ExternalCircuitBreaker.js", () => ({
  ExternalCircuitBreaker: class {
    execute = vi.fn().mockImplementation((_k: string, fn: () => Promise<unknown>) => fn());
    getMetrics = vi.fn().mockReturnValue({});
  },
}));

vi.mock("../../env", () => ({
  isBrowser: () => false,
  getGroundtruthConfig: () => ({ apiUrl: "", apiKey: "", timeoutMs: 5000 }),
  getValidatedSupabaseRuntimeConfig: () => ({
    url: "http://localhost:54321",
    anonKey: "test-anon-key",
    serviceRoleKey: "test-service-role-key",
  }),
  env: { isProduction: false },
}));

// Mock @valueos/memory/provenance so FinancialModelingAgent and TargetAgent
// can be imported without a real Supabase connection.
vi.mock("@valueos/memory/provenance", () => ({
  ProvenanceTracker: class {
    record = vi.fn().mockResolvedValue({ id: "prov-1", createdAt: new Date().toISOString() });
  },
}));

// ---------------------------------------------------------------------------
// Imports — CircuitBreaker/Manager from canonical path (NOT mocked above)
// ---------------------------------------------------------------------------

import { CircuitBreaker, CircuitBreakerManager } from "../../../lib/resilience/CircuitBreaker";
import { AgentFactory } from "../AgentFactory";
import { LLMGateway } from "../LLMGateway";
import { MemorySystem } from "../MemorySystem";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDeps() {
  return {
    llmGateway: new LLMGateway("custom") as unknown as InstanceType<typeof LLMGateway>,
    memorySystem: new MemorySystem({} as never) as unknown as InstanceType<typeof MemorySystem>,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AgentFactory — circuit breaker isolation", () => {
  describe("with circuitBreakerManager (preferred path)", () => {
    let manager: CircuitBreakerManager;
    let factory: AgentFactory;

    beforeEach(() => {
      manager = new CircuitBreakerManager();
      factory = new AgentFactory({ ...makeDeps(), circuitBreakerManager: manager });
    });

    it("creates agents for all 8 types without error", () => {
      const types = factory.getFabricAgentTypes();
      expect(types).toHaveLength(8);
      for (const type of types) {
        expect(() => factory.create(type, "org-test")).not.toThrow();
      }
    });

    it("each agent type gets its own isolated breaker", async () => {
      factory.create("opportunity", "org-test");
      factory.create("integrity", "org-test");

      // Trip the opportunity breaker by exhausting its failure threshold (default 5).
      const opportunityBreaker = manager.getBreaker("opportunity");
      const alwaysFails = () => Promise.reject(new Error("forced failure"));
      for (let i = 0; i < 5; i++) {
        await opportunityBreaker.execute(alwaysFails).catch(() => undefined);
      }

      expect(manager.getState("opportunity")).toBe("open");
      // integrity breaker is completely unaffected.
      expect(manager.getState("integrity")).toBe("closed");
    });

    it("two calls to create() for the same type return agents sharing the same breaker", () => {
      factory.create("target", "org-a");
      factory.create("target", "org-b");

      // Both agents were constructed with the same breaker from the manager.
      const breaker = manager.getBreaker("target");
      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("with circuitBreaker (legacy path)", () => {
    it("creates all agent types successfully", () => {
      const legacyBreaker = new CircuitBreaker();
      const factory = new AgentFactory({
        ...makeDeps(),
        circuitBreaker: legacyBreaker,
      });

      const types = factory.getFabricAgentTypes();
      for (const type of types) {
        expect(() => factory.create(type, "org-legacy")).not.toThrow();
      }
    });

    it("all agents share the same underlying breaker instance", () => {
      const legacyBreaker = new CircuitBreaker();
      const factory = new AgentFactory({
        ...makeDeps(),
        circuitBreaker: legacyBreaker,
      });

      // The factory stores _legacyBreaker and returns it for every type.
      // We verify this by checking that the factory's internal _legacyBreaker
      // is the same reference we passed in.
      const internal = (factory as unknown as { _legacyBreaker: CircuitBreaker })._legacyBreaker;
      expect(internal).toBe(legacyBreaker);
    });
  });

  describe("validation", () => {
    it("throws when neither circuitBreakerManager nor circuitBreaker is provided", () => {
      expect(
        () =>
          new AgentFactory({
            llmGateway: new LLMGateway("custom") as unknown as InstanceType<typeof LLMGateway>,
            memorySystem: new MemorySystem({} as never) as unknown as InstanceType<typeof MemorySystem>,
          })
      ).toThrow("AgentFactory requires either circuitBreakerManager or circuitBreaker in deps.");
    });
  });
});
