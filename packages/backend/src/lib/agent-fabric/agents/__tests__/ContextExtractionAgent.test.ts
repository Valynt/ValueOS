/**
 * ContextExtractionAgent Unit Tests
 *
 * Tests for deal context extraction with LLM integration.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { ContextExtractionAgent } from "../../../../lib/agent-fabric/agents/ContextExtractionAgent.js";

// Mocks
vi.mock("../../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe("ContextExtractionAgent", () => {
  const mockMemorySystem = {
    storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
    retrieve: vi.fn().mockResolvedValue([]),
  };

  const mockLLMGateway = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        stakeholders: [
          { name: "John Smith", role: "economic_buyer", priority: 9, source_type: "crm-derived" },
        ],
        use_cases: [
          { name: "Efficiency Improvement", description: "Reduce processing time", pain_signals: ["Slow workflows"], expected_outcomes: ["Faster processing"], source_type: "crm-derived" },
        ],
        pain_points: ["Slow manual processes", "Data silos"],
        baseline_clues: { current_processing_time: 48 },
        value_driver_candidates: [
          { driver_name: "Process Automation", impact_estimate_low: 100000, impact_estimate_high: 200000, evidence_strength: 0.8, signal_sources: ["crm"], confidence_score: 0.85 },
        ],
        objection_signals: ["Budget constraints"],
        missing_data: [
          { field_name: "confirmed_budget", importance: "critical", reason: "Not specified", suggested_source: "direct ask" },
        ],
        extraction_confidence: 0.75,
      }),
      model: "gpt-4",
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    }),
  };

  const mockCircuitBreaker = {
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  };

  let agent: ContextExtractionAgent;

  beforeEach(() => {
    agent = new ContextExtractionAgent(
      {
        name: "ContextExtractionAgent",
        lifecycle_stage: "discovery",
        metadata: { version: "1.0.0" },
      },
      "org-1",
      mockMemorySystem as unknown as import("../../../../lib/agent-fabric/MemorySystem.js").MemorySystem,
      mockLLMGateway as unknown as import("../../../../lib/agent-fabric/LLMGateway.js").LLMGateway,
      mockCircuitBreaker as unknown as import("../../../../lib/agent-fabric/CircuitBreaker.js").CircuitBreaker
    );
    vi.clearAllMocks();
  });

  describe("execute", () => {
    it("should extract context from CRM data", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        crm_data: {
          opportunity: {
            id: "opp-1",
            name: "Test Deal",
            stage: "qualified",
            amount: 150000,
          },
          account: {
            id: "acc-1",
            name: "Test Corp",
            industry: "Technology",
          },
          contacts: [
            { id: "c1", first_name: "John", last_name: "Smith", role: "economic_buyer", is_primary: true },
          ],
        },
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(result.result.extracted_context).toBeDefined();
      expect(result.result.extracted_context.stakeholders).toHaveLength(1);
      expect(result.result.extracted_context.use_cases).toHaveLength(1);
    });

    it("should return failed status when no CRM data", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        // No crm_data
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("failed");
      expect(result.result.error).toContain("No CRM data");
    });

    it("should rank value drivers by composite score", async () => {
      mockLLMGateway.complete.mockResolvedValueOnce({
        content: JSON.stringify({
          stakeholders: [],
          use_cases: [],
          pain_points: [],
          baseline_clues: {},
          value_driver_candidates: [
            { driver_name: "Driver A", impact_estimate_low: 100, impact_estimate_high: 200, evidence_strength: 0.9, signal_sources: ["a", "b", "c"], confidence_score: 0.9 },
            { driver_name: "Driver B", impact_estimate_low: 100, impact_estimate_high: 200, evidence_strength: 0.5, signal_sources: ["a"], confidence_score: 0.5 },
          ],
          objection_signals: [],
          missing_data: [],
          extraction_confidence: 0.8,
        }),
        model: "gpt-4",
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      });

      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        crm_data: {
          opportunity: { id: "opp-1", name: "Test", stage: "qualified" },
          account: { id: "acc-1", name: "Test Corp" },
          contacts: [],
        },
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      const drivers = result.result.extracted_context.value_driver_candidates;
      expect(drivers[0].driver_name).toBe("Driver A"); // Higher ranked
      expect(drivers[1].driver_name).toBe("Driver B"); // Lower ranked
    });
  });

  describe("input validation", () => {
    it("should validate required context fields", async () => {
      const context = {
        // Missing required fields
      };

      const result = await agent.execute(context as unknown as import("../../../../types/agent.js").LifecycleContext);

      expect(result.status).toBe("failed");
    });

    it("should reject mismatched tenant context", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-2", // Different from agent's org-1
        user_id: "user-1",
        workspace_id: "ws-1",
        crm_data: {
          opportunity: { id: "opp-1", name: "Test" },
          account: { id: "acc-1", name: "Test Corp" },
          contacts: [],
        },
      };

      await expect(agent.execute(context)).rejects.toThrow("Tenant context mismatch");
    });
  });

  describe("getCapabilities", () => {
    it("should return correct capabilities", () => {
      const caps = agent.getCapabilities();
      expect(caps).toContain("extract_stakeholders");
      expect(caps).toContain("extract_use_cases");
      expect(caps).toContain("identify_pain_points");
      expect(caps).toContain("rank_value_drivers");
    });
  });
});
