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

// Mock CircuitBreaker (the one from agent-fabric re-export)
vi.mock("../CircuitBreaker.js", () => ({
  CircuitBreaker: class MockCircuitBreaker {
    constructor(_threshold?: number, _timeout?: number) {}
    execute = vi.fn().mockImplementation((fn: () => Promise<any>) => fn());
  },
}));

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
  env: { isProduction: false },
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
    });

    it("returns false for unimplemented agents", () => {
      expect(factory.hasFabricAgent("narrative")).toBe(false);
      expect(factory.hasFabricAgent("coordinator")).toBe(false);
      expect(factory.hasFabricAgent("financial-modeling")).toBe(false);
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
      expect(types).toHaveLength(5);
    });
  });

  describe("create", () => {
    it("creates an OpportunityAgent with correct properties", () => {
      const agent = factory.create("opportunity", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("opportunity");
      expect(agent.lifecycleStage).toBe("opportunity");
    });

    it("creates a TargetAgent with correct properties", () => {
      const agent = factory.create("target", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("target");
      expect(agent.lifecycleStage).toBe("target");
    });

    it("creates an IntegrityAgent with correct properties", () => {
      const agent = factory.create("integrity", "org-123");
      expect(agent).toBeDefined();
      expect(agent.name).toBe("integrity");
      expect(agent.lifecycleStage).toBe("integrity");
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
      expect(agent.lifecycleStage).toBe("realization");
    });

    it("throws for unimplemented agent types", () => {
      expect(() => factory.create("narrative", "org-123")).toThrow(
        /No fabric agent implementation for type "narrative"/
      );
    });

    it("throws for unknown agent types", () => {
      expect(() => factory.create("nonexistent", "org-123")).toThrow(
        /No fabric agent implementation/
      );
    });
  });

  describe("createForStage", () => {
    it("creates agent by lifecycle stage name", () => {
      const agent = factory.createForStage("opportunity", "org-456");
      expect(agent).toBeDefined();
      expect(agent.lifecycleStage).toBe("opportunity");
    });
  });
});
