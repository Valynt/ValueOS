import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock all transitive dependencies before any imports
vi.mock("../../logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock LLMGateway entirely to avoid OpenTelemetry dependency chain
vi.mock("../LLMGateway.js", () => ({
  LLMGateway: class MockLLMGateway {
    constructor(_provider?: string) {}
    complete = vi.fn().mockResolvedValue({ content: "{}" });
  },
}));

// Mock MemorySystem
vi.mock("../MemorySystem.js", () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: any) {}
    store = vi.fn().mockResolvedValue("mem_1");
    retrieve = vi.fn().mockResolvedValue([]);
  },
}));

// Mock CircuitBreaker and CircuitBreakerManager (the ones from agent-fabric re-export)
vi.mock("../CircuitBreaker.js", () => {
  class MockCircuitBreaker {
    constructor(_threshold?: number, _timeout?: number) {}
    execute = vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn());
    getState = vi.fn().mockReturnValue("closed");
  }
  class MockCircuitBreakerManager {
    getBreaker = vi.fn().mockReturnValue(new MockCircuitBreaker());
    getState = vi.fn().mockReturnValue("closed");
    execute = vi.fn().mockImplementation((_key: string, fn: () => Promise<unknown>) => fn());
  }
  return {
    CircuitBreaker: MockCircuitBreaker,
    CircuitBreakerManager: MockCircuitBreakerManager,
  };
});

// Mock the secrets CircuitBreaker (used by AgentFactory import)
vi.mock("../../../config/secrets/CircuitBreaker.js", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor(_config?: any) {}
    execute = vi.fn().mockImplementation((fn: () => Promise<any>) => fn());
  },
}));

// Mock AdvancedCausalEngine (used by TargetAgent)
vi.mock("../../../services/reasoning/AdvancedCausalEngine.js", () => ({
  getAdvancedCausalEngine: () => ({
    inferCausalRelationship: vi.fn().mockResolvedValue({
      confidence: 0.8,
      effect: { direction: "positive", magnitude: 0.5 },
    }),
  }),
}));

// Mock MCPGroundTruthService (used by OpportunityAgent).
// Must also mock the env module it imports to prevent Vite from scanning
// the dynamic import('../mcp-ground-truth') inside the service.
vi.mock("../../../services/MCPGroundTruthService.js", () => ({
  mcpGroundTruthService: {
    getFinancialData: vi.fn().mockResolvedValue(null),
    verifyClaim: vi.fn().mockResolvedValue({ verified: false, confidence: 0 }),
    getIndustryBenchmarks: vi.fn().mockResolvedValue(null),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock ExternalCircuitBreaker (transitive dep of MCPGroundTruthService)
vi.mock("../../../services/ExternalCircuitBreaker.js", () => ({
  ExternalCircuitBreaker: class {
    execute = vi.fn().mockImplementation((_k: string, fn: () => Promise<any>) => fn());
    getMetrics = vi.fn().mockReturnValue({});
  },
}));

// Mock env module (used by MCPGroundTruthService)
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

// Mock @valueos/memory/provenance (used by FinancialModelingAgent and TargetAgent)
vi.mock("@valueos/memory/provenance", () => ({
  ProvenanceTracker: class {
    record = vi.fn().mockResolvedValue({ id: "prov-1", createdAt: new Date().toISOString() });
  },
}));

// Mock AgentKillSwitchService (called in secureInvoke before circuit breaker)
vi.mock("../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: {
    isKilled: vi.fn().mockResolvedValue(false),
  },
}));

import { AgentFactory } from "../AgentFactory";
import { CircuitBreaker } from "../CircuitBreaker";
import { LLMGateway } from "../LLMGateway";
import { MemorySystem } from "../MemorySystem";

describe("AgentFactory", () => {
  let factory: AgentFactory;

  beforeEach(() => {
    factory = new AgentFactory({
      llmGateway: new LLMGateway("custom") as any,
      memorySystem: new MemorySystem({} as any) as any,
      circuitBreaker: new CircuitBreaker() as any,
    });
  });

  describe("hasFabricAgent", () => {
    it("returns true for lifecycle agents", () => {
      expect(factory.hasFabricAgent("opportunity")).toBe(true);
      expect(factory.hasFabricAgent("target")).toBe(true);
      expect(factory.hasFabricAgent("expansion")).toBe(true);
      expect(factory.hasFabricAgent("integrity")).toBe(true);
      expect(factory.hasFabricAgent("realization")).toBe(true);
      expect(factory.hasFabricAgent("financial-modeling")).toBe(true);
      expect(factory.hasFabricAgent("narrative")).toBe(true);
      expect(factory.hasFabricAgent("compliance-auditor")).toBe(true);
    });

    it("returns false for unimplemented agents", () => {
      expect(factory.hasFabricAgent("coordinator")).toBe(false);
      expect(factory.hasFabricAgent("nonexistent")).toBe(false);
    });
  });

  describe("getFabricAgentTypes", () => {
    it("returns all implemented agent types", () => {
      const types = factory.getFabricAgentTypes();
      expect(types).toContain("opportunity");
      expect(types).toContain("target");
      expect(types).toContain("expansion");
      expect(types).toContain("integrity");
      expect(types).toContain("realization");
      expect(types).toContain("financial-modeling");
      expect(types).toContain("narrative");
      expect(types).toContain("compliance-auditor");
      expect(types).toHaveLength(8);
    });
  });

  // AgentFactory.create() takes a routing label (e.g. "opportunity") and maps
  // it to a canonical LifecycleStage via agentLabelToLifecycleStage().
  // agent.name  = routing label (set in AgentConfig.name)
  // agent.lifecycleStage = canonical stage (set in AgentConfig.lifecycle_stage)
  describe("create", () => {
    it("creates an OpportunityAgent with correct properties", () => {
      const agent = factory.create("opportunity", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("opportunity");
      expect(agent.lifecycleStage).toBe("discovery");
    });

    it("creates a TargetAgent with correct properties", () => {
      const agent = factory.create("target", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("target");
      expect(agent.lifecycleStage).toBe("drafting");
    });

    it("creates an IntegrityAgent with correct properties", () => {
      const agent = factory.create("integrity", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("integrity");
      expect(agent.lifecycleStage).toBe("validating");
    });

    it("creates an ExpansionAgent with correct properties", () => {
      const agent = factory.create("expansion", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("expansion");
      expect(agent.lifecycleStage).toBe("expansion");
    });

    it("creates a RealizationAgent with correct properties", () => {
      const agent = factory.create("realization", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("realization");
      expect(agent.lifecycleStage).toBe("refining");
    });

    it("creates a FinancialModelingAgent with correct properties", () => {
      const agent = factory.create("financial-modeling", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("financial-modeling");
      expect(agent.lifecycleStage).toBe("drafting");
    });

    it("creates a NarrativeAgent with correct properties", () => {
      const agent = factory.create("narrative", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("narrative");
      // NarrativeAgent declares lifecycleStage = "narrative" directly.
      // The canonical stage mapping ("composing") is in AgentConfig.lifecycle_stage,
      // not in the agent's own lifecycleStage property.
      expect(agent.lifecycleStage).toBe("narrative");
    });

    it("creates a ComplianceAuditorAgent with correct properties", () => {
      const agent = factory.create("compliance-auditor", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("compliance-auditor");
      expect(agent.lifecycleStage).toBe("validating");
    });

    it("throws for unknown agent types", () => {
      expect(() => factory.create("nonexistent", "org-123")).toThrow(
        /No fabric agent implementation/
      );
    });
  });

  // createForStage() takes a canonical LifecycleStage and maps it to the
  // primary agent routing label via lifecycleStageToAgentLabel().
  describe("createForStage", () => {
    it("creates OpportunityAgent for discovery stage", () => {
      const agent = factory.createForStage("discovery", "org-456");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("opportunity");
      expect(agent.lifecycleStage).toBe("discovery");
    });

    it("creates TargetAgent for drafting stage", () => {
      const agent = factory.createForStage("drafting", "org-456");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("target");
      expect(agent.lifecycleStage).toBe("drafting");
    });
  });
});
