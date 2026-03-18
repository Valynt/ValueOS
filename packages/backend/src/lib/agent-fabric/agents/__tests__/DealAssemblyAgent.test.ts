/**
 * DealAssemblyAgent Unit Tests
 *
 * Tests for deal assembly orchestration with context extraction and persistence.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import { DealAssemblyAgent } from "../../../../lib/agent-fabric/agents/DealAssemblyAgent.js";
import { CRMConnector } from "../../../../services/deal/CRMConnector.js";

// Mocks
vi.mock("../../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../../../services/deal/CRMConnector.js", () => ({
  CRMConnector: vi.fn().mockImplementation(() => ({
    fetchDealContext: vi.fn().mockResolvedValue({
      opportunity: {
        id: "opp-1",
        name: "Test Deal",
        stage: "qualified",
        amount: 150000,
        owner: { id: "owner-1", name: "Rep", email: "rep@test.com" },
      },
      account: {
        id: "acc-1",
        name: "Test Corp",
        industry: "Technology",
        size_employees: 500,
      },
      contacts: [
        { id: "c1", first_name: "John", last_name: "Smith", email: "john@test.com", job_title: "VP", role: "economic_buyer", is_primary: true },
      ],
      fetchedAt: new Date().toISOString(),
      sourceType: "crm-opportunity",
    }),
  })),
}));

describe("DealAssemblyAgent", () => {
  const mockMemorySystem = {
    storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
    retrieve: vi.fn().mockResolvedValue([]),
  };

  const mockLLMGateway = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        stakeholders: [
          { name: "John Smith", role: "economic_buyer", priority: 9, source_type: "crm-derived", contact_info: { email: "john@test.com", job_title: "VP" } },
        ],
        use_cases: [
          { name: "Efficiency", description: "Improve process", pain_signals: ["slow"], expected_outcomes: ["fast"], source_type: "crm-derived" },
        ],
        pain_points: ["slow processes"],
        baseline_clues: { processing_time: 48 },
        value_driver_candidates: [
          { driver_name: "Automation", impact_estimate_low: 100000, impact_estimate_high: 200000, evidence_strength: 0.8, signal_sources: ["crm"], confidence_score: 0.85 },
        ],
        objection_signals: [],
        missing_data: [],
        extraction_confidence: 0.8,
      }),
      model: "gpt-4",
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    }),
  };

  const mockCircuitBreaker = {
    execute: vi.fn((fn: () => Promise<unknown>) => fn()),
  };

  let agent: DealAssemblyAgent;

  beforeEach(() => {
    agent = new DealAssemblyAgent(
      {
        name: "DealAssemblyAgent",
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
    it("should assemble deal context from CRM data", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
        crm_connection_id: "conn-1",
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(result.result.deal_context).toBeDefined();
      expect(result.result.deal_context.tenant_id).toBe("org-1");
      expect(result.result.deal_context.opportunity_id).toBe("opp-1");
    });

    it("should fail when no opportunity_id provided", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        // No opportunity_id
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("failed");
      expect(result.result.error).toContain("opportunity_id");
    });

    it("should include assembly summary in result", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
      };

      const result = await agent.execute(context);

      expect(result.result.assembly_summary).toBeDefined();
      expect(result.result.assembly_summary.sources_consulted).toContain("crm");
      expect(result.result.assembly_summary.stakeholders_identified).toBeGreaterThan(0);
    });

    it("should persist deal context to memory", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
      };

      await agent.execute(context);

      expect(mockMemorySystem.storeSemanticMemory).toHaveBeenCalledWith(
        expect.any(String), // sessionId
        "DealAssemblyAgent",
        "semantic",
        expect.stringContaining("DealContext assembled"),
        expect.objectContaining({
          deal_context: expect.any(Object),
          tenant_id: "org-1",
          opportunity_id: "opp-1",
        }),
        "org-1"
      );
    });

    it("should apply conflict resolution for duplicate stakeholders", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
      };

      const result = await agent.execute(context);

      const stakeholders = result.result.deal_context.context_json.stakeholders;
      // Should merge duplicates based on name
      const johnStakeholders = stakeholders.filter((s: { name: string }) => s.name === "John Smith");
      expect(johnStakeholders).toHaveLength(1);
    });
  });

  describe("source classification", () => {
    it("should tag data with source types", async () => {
      const context = {
        case_id: "case-1",
        organization_id: "org-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
      };

      const result = await agent.execute(context);

      const sourceFragments = result.result.deal_context.source_fragments;
      expect(sourceFragments).toHaveLength(1);
      expect(sourceFragments[0].source_type).toBe("crm-derived");
    });
  });

  describe("getCapabilities", () => {
    it("should return correct capabilities", () => {
      const caps = agent.getCapabilities();
      expect(caps).toContain("fetch_crm_data");
      expect(caps).toContain("extract_context");
      expect(caps).toContain("merge_fragments");
      expect(caps).toContain("assemble_deal_context");
      expect(caps).toContain("persist_context");
    });
  });
});
