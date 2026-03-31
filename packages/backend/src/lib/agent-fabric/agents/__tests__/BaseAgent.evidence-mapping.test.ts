/**
 * Evidence Mapping Enforcement Tests
 *
 * P0 Security Requirement: All numeric outputs must have evidence links
 * for CFO-defensible audit trail.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (hoisted before imports) ────────────────────────────────────

// AuditLogger wraps AuditLogService which requires a live Supabase connection.
// Replace it with a lightweight stub so tests run without infrastructure.
const mockLogAgentSecurity = vi.fn().mockResolvedValue(undefined);

vi.mock("../AuditLogger.js", () => ({
  AuditLogger: vi.fn().mockImplementation(() => ({
    logAgentSecurity: mockLogAgentSecurity,
    logLLMInvocation: vi.fn().mockResolvedValue(undefined),
    logMemoryStore: vi.fn().mockResolvedValue(undefined),
    logVetoDecision: vi.fn().mockResolvedValue(undefined),
    logAgentEvent: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Supabase — not needed for evidence-mapping logic
vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: vi.fn(),
  supabase: { from: vi.fn() },
}));

// AgentKillSwitchService — not relevant to evidence mapping
vi.mock("../../../services/agents/AgentKillSwitchService.js", () => ({
  agentKillSwitchService: { isKilled: vi.fn().mockResolvedValue(false) },
}));

// ValueGraphService — not relevant to evidence mapping
vi.mock("../../../services/value-graph/ValueGraphService.js", () => ({
  ValueGraphService: vi.fn(),
  valueGraphService: { getGraph: vi.fn() },
}));

import { EvidenceMappingError } from "../BaseAgent";
import { TestAgent } from "./TestAgent";

describe("BaseAgent - Evidence Mapping Enforcement (P0)", () => {
  let agent: TestAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestAgent({ organizationId: "test-tenant" });
  });

  describe("Numeric Output Evidence Requirements", () => {
    it("allows execution when no numeric values are present", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return result without numeric values
      agent.mockExecute({
        text: "Analysis complete",
        status: "ready",
      });

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(mockLogAgentSecurity).not.toHaveBeenCalled();
    });

    it("allows execution when numeric values have evidence links", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return numeric result with evidence
      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
      }, {
        evidence_links: [
          {
            metric_key: "revenue",
            metric_value: 1000000,
            evidence_source: "financial_statements",
            evidence_url: "https://example.com/evidence/1",
            confidence_score: 0.95,
          },
          {
            metric_key: "costs", 
            metric_value: 750000,
            evidence_source: "expense_reports",
            evidence_url: "https://example.com/evidence/2",
            confidence_score: 0.90,
          },
          {
            metric_key: "profit",
            metric_value: 250000,
            evidence_source: "calculated",
            evidence_url: "https://example.com/evidence/3",
            confidence_score: 0.85,
          },
        ],
      });

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(mockLogAgentSecurity).not.toHaveBeenCalled();
    });

    it("throws EvidenceMappingError when numeric values lack evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return numeric result WITHOUT evidence
      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);

      // Verify security audit log was created
      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: {
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "revenue", value: 1000000 }),
            expect.objectContaining({ key: "costs", value: 750000 }),
            expect.objectContaining({ key: "profit", value: 250000 }),
          ]),
          total_numeric_outputs: 3,
          existing_evidence_count: 0,
        },
      });
    });

    it("throws when only some numeric values have evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return partial evidence
      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
      }, {
        evidence_links: [
          {
            metric_key: "revenue",
            metric_value: 1000000,
            evidence_source: "financial_statements",
            evidence_url: "https://example.com/evidence/1",
            confidence_score: 0.95,
          },
          // Missing evidence for costs and profit
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);

      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: {
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "costs", value: 750000 }),
            expect.objectContaining({ key: "profit", value: 250000 }),
          ]),
          total_numeric_outputs: 3,
          existing_evidence_count: 1,
        },
      });
    });

    it("handles nested numeric values in objects", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return nested numeric result
      agent.mockExecute({
        financials: {
          revenue: 1000000,
          costs: {
            operations: 500000,
            marketing: 250000,
          },
          metrics: {
            profit_margin: 0.25,
            growth_rate: 0.15,
          }
        }
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);

      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: {
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "financials.revenue", value: 1000000 }),
            expect.objectContaining({ key: "financials.costs.operations", value: 500000 }),
            expect.objectContaining({ key: "financials.costs.marketing", value: 250000 }),
            expect.objectContaining({ key: "financials.metrics.profit_margin", value: 0.25 }),
            expect.objectContaining({ key: "financials.metrics.growth_rate", value: 0.15 }),
          ]),
          total_numeric_outputs: 5,
          existing_evidence_count: 0,
        },
      });
    });

    it("handles numeric values in arrays", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Mock _execute to return array with numeric values
      agent.mockExecute({
        hypotheses: [
          { id: "h1", value: 100000, confidence: 0.8 },
          { id: "h2", value: 250000, confidence: 0.9 },
          { id: "h3", value: 150000, confidence: 0.7 },
        ]
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);

      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: {
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "hypotheses[0].value", value: 100000 }),
            expect.objectContaining({ key: "hypotheses[0].confidence", value: 0.8 }),
            expect.objectContaining({ key: "hypotheses[1].value", value: 250000 }),
            expect.objectContaining({ key: "hypotheses[1].confidence", value: 0.9 }),
            expect.objectContaining({ key: "hypotheses[2].value", value: 150000 }),
            expect.objectContaining({ key: "hypotheses[2].confidence", value: 0.7 }),
          ]),
          total_numeric_outputs: 6,
          existing_evidence_count: 0,
        },
      });
    });
  });

  describe("Error Message Quality", () => {
    it("provides detailed error message with missing values", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
      });

      try {
        await agent.execute(context);
        fail("Expected EvidenceMappingError");
      } catch (error) {
        expect(error).toBeInstanceOf(EvidenceMappingError);
        expect((error as EvidenceMappingError).message).toContain("TestAgent");
        expect((error as EvidenceMappingError).message).toContain("2 numeric value(s) without required evidence links");
        expect((error as EvidenceMappingError).message).toContain("revenue=1000000");
        expect((error as EvidenceMappingError).message).toContain("costs=750000");
        expect((error as EvidenceMappingError).message).toContain("CFO-defensible audit trail");
      }
    });
  });
});
