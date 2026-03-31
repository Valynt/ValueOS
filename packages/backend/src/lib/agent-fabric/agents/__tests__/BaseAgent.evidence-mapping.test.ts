runner/**
 * Evidence Mapping Enforcement Tests
 *
 * P0 Security Requirement: All numeric outputs must have evidence links
 * for CFO-defensible audit trail.
 *
 * These tests verify that BaseAgent properly enforces evidence mapping
 * requirements before allowing agent execution to complete.
 *
 * Expected Behavior:
 * - Agent execution allowed: non-numeric outputs OR numeric outputs with evidence
 * - Agent execution blocked: numeric outputs without evidence links
 * - Security audit logged: all violations with details of missing evidence
 * - Error messages: clear, actionable, include agent name and missing values
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

  describe("Agent Execution - Allowed Cases", () => {
    it("must allow execution when output contains no numeric values", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        text: "Analysis complete - all systems operational",
        status: "ready",
        category: "informational",
      });

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(mockLogAgentSecurity).not.toHaveBeenCalled();
    });

    it("must allow execution when all numeric values have evidence links", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
        margin_percent: 25,
      }, {
        evidence_links: [
          {
            metric_key: "revenue",
            metric_value: 1000000,
            evidence_source: "financial_statements_q4_2024",
            evidence_url: "https://docs.example.com/evidence/revenue",
            confidence_score: 0.95,
            verified_at: "2024-01-15T10:30:00Z",
          },
          {
            metric_key: "costs",
            metric_value: 750000,
            evidence_source: "expense_reports",
            evidence_url: "https://docs.example.com/evidence/costs",
            confidence_score: 0.90,
            verified_at: "2024-01-15T10:30:00Z",
          },
          {
            metric_key: "profit",
            metric_value: 250000,
            evidence_source: "calculated_from_revenue_costs",
            evidence_url: "https://docs.example.com/evidence/profit",
            confidence_score: 0.85,
            verified_at: "2024-01-15T10:30:00Z",
          },
          {
            metric_key: "margin_percent",
            metric_value: 25,
            evidence_source: "calculated",
            evidence_url: "https://docs.example.com/evidence/margin",
            confidence_score: 0.85,
            verified_at: "2024-01-15T10:30:00Z",
          },
        ],
      });

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(mockAuditLogger.logAgentSecurity).not.toHaveBeenCalled();
    });

    it("must allow execution when output contains only string, boolean, and null values", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        summary: "Quarterly analysis",
        approved: true,
        reviewed_at: null,
        tags: ["finance", "quarterly"],
        metadata: {
          department: "engineering",
          priority: "high",
        },
      });

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
    });
  });

  describe("Agent Execution - Blocked Cases (Evidence Violations)", () => {
    it("must throw EvidenceMappingError when numeric values lack evidence links", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Numeric output without any evidence links
      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
      await expect(agent.execute(context)).rejects.toThrow(/evidence.*required/i);
    });

    it("must throw EvidenceMappingError when only some numeric values have evidence (partial coverage)", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Only revenue has evidence, costs and profit do not
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
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must throw EvidenceMappingError for deeply nested numeric values without evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        company: "Acme Corp",
        financials: {
          revenue: {
            q1: 250000,
            q2: 300000,
            q3: 275000,
            q4: 325000,
          },
          expenses: {
            operations: 500000,
            marketing: 250000,
          },
        },
        metrics: {
          growth_rate: 0.15,
          profit_margin: 0.25,
        },
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must throw EvidenceMappingError for numeric values in arrays without evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        hypotheses: [
          { id: "h1", value: 100000, confidence: 0.8, name: "Cost reduction" },
          { id: "h2", value: 250000, confidence: 0.9, name: "Revenue increase" },
        ],
        quarterly_results: [150000, 175000, 200000, 225000],
        metadata: {
          total_value: 475000,
        },
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must throw EvidenceMappingError for mixed numeric types (integers, floats, decimals)", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        integer_value: 1000000,
        float_value: 750000.50,
        small_decimal: 0.25,
        negative_value: -50000,
        scientific_notation: 1.5e6,
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });
  });

  describe("Security Audit Logging - Violation Records", () => {
    it("must log security audit with correct violation details for missing evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
        profit: 250000,
      });

      try {
        await agent.execute(context);
        expect.fail("Expected EvidenceMappingError to be thrown");
      } catch (error) {
        // Error expected
      }

      // Verify security audit log was created
      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: expect.objectContaining({
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "revenue", value: 1000000 }),
            expect.objectContaining({ key: "costs", value: 750000 }),
            expect.objectContaining({ key: "profit", value: 250000 }),
          ]),
          total_numeric_outputs: 3,
          existing_evidence_count: 0,
          workspace_id: "ws-1",
        }),
        timestamp: expect.any(String),
        severity: "high",
      });
    });

    it("must log security audit with partial evidence details", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

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
        ],
      });

      try {
        await agent.execute(context);
        expect.fail("Expected EvidenceMappingError to be thrown");
      } catch (error) {
        // Expected
      }

      expect(mockLogAgentSecurity).toHaveBeenCalledWith({
        agentName: "TestAgent",
        tenantId: "test-tenant",
        userId: "user-1",
        action: "evidence_mapping_violation",
        details: expect.objectContaining({
          missing_numeric_outputs: expect.arrayContaining([
            expect.objectContaining({ key: "costs", value: 750000 }),
            expect.objectContaining({ key: "profit", value: 250000 }),
          ]),
          total_numeric_outputs: 3,
          existing_evidence_count: 1,
          covered_metrics: ["revenue"],
          uncovered_metrics: ["costs", "profit"],
        }),
      });
    });

    it("must include workspace_id and full context in audit log", async () => {
      const context = {
        workspace_id: "ws-acme-corp-123",
        organization_id: "tenant-acme",
        user_id: "user-john-doe",
        session_id: "sess-abc-123",
        request_id: "req-xyz-789",
      };

      agent.mockExecute({
        projected_savings: 500000,
      });

      try {
        await agent.execute(context);
        expect.fail("Expected EvidenceMappingError");
      } catch (error) {
        // Expected
      }

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

  describe("Error Message Quality and Debugging", () => {
    it("must provide error message containing agent name and violation count", async () => {
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
        expect.fail("Expected EvidenceMappingError");
      } catch (error) {
        expect(error).toBeInstanceOf(EvidenceMappingError);
        expect((error as EvidenceMappingError).message).toContain("TestAgent");
        expect((error as EvidenceMappingError).message).toContain("2");
        expect((error as EvidenceMappingError).message).toMatch(/numeric.*value/i);
        expect((error as EvidenceMappingError).message).toMatch(/evidence/i);
      }
    });

    it("must provide detailed error message listing all missing evidence paths", async () => {
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
        expect.fail("Expected EvidenceMappingError");
      } catch (error) {
        const errorMessage = (error as EvidenceMappingError).message;
        expect(errorMessage).toContain("revenue");
        expect(errorMessage).toContain("1000000");
        expect(errorMessage).toContain("costs");
        expect(errorMessage).toContain("750000");
        expect(errorMessage).toContain("CFO-defensible");
        expect(errorMessage).toContain("audit trail");
      }
    });

    it("must provide error code and structured error data for programmatic handling", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        value: 100000,
      });

      try {
        await agent.execute(context);
        expect.fail("Expected EvidenceMappingError");
      } catch (error) {
        expect(error).toBeInstanceOf(EvidenceMappingError);
        const evidenceError = error as EvidenceMappingError;
        expect(evidenceError.code).toBe("EVIDENCE_MAPPING_VIOLATION");
        expect(evidenceError.missingEvidence).toBeDefined();
        expect(evidenceError.missingEvidence).toHaveLength(1);
        expect(evidenceError.missingEvidence[0]).toMatchObject({
          key: "value",
          value: 100000,
        });
      }
    });

    it("must include remediation guidance in error message", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        projected_roi: 2.5,
      });

      try {
        await agent.execute(context);
        expect.fail("Expected EvidenceMappingError");
      } catch (error) {
        const message = (error as EvidenceMappingError).message;
        expect(message).toMatch(/evidence_links/i);
        expect(message).toMatch(/metric_key/i);
        expect(message).toMatch(/evidence_source/i);
      }
    });
  });

  describe("Edge Cases and Validation", () => {
    it("must handle zero values as numeric requiring evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 0,
        costs: 0,
        profit: 0,
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must handle very large numeric values (BigInt-safe)", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        enterprise_value: 999999999999,
        market_cap: 888888888888,
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must handle empty evidence_links array as no evidence", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        value: 100000,
      }, {
        evidence_links: [], // Empty array
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must ignore evidence_links for non-existent metric keys", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      // Evidence for wrong keys doesn't cover actual numeric outputs
      agent.mockExecute({
        revenue: 1000000,
        costs: 750000,
      }, {
        evidence_links: [
          {
            metric_key: "old_revenue", // Wrong key
            metric_value: 1000000,
            evidence_source: "wrong",
            evidence_url: "https://example.com",
            confidence_score: 0.95,
          },
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must not allow null or undefined as valid evidence values", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        value: 100000,
      }, {
        evidence_links: [
          {
            metric_key: "value",
            metric_value: null as any,
            evidence_source: null,
            evidence_url: undefined,
            confidence_score: null,
          },
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });
  });

  describe("Evidence Link Validation", () => {
    it("must require evidence_source and evidence_url for each evidence link", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 1000000,
      }, {
        evidence_links: [
          {
            metric_key: "revenue",
            metric_value: 1000000,
            // Missing evidence_source and evidence_url
            confidence_score: 0.95,
          },
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });

    it("must require confidence_score between 0 and 1", async () => {
      const context = {
        workspace_id: "ws-1",
        organization_id: "test-tenant",
        user_id: "user-1",
      };

      agent.mockExecute({
        revenue: 1000000,
      }, {
        evidence_links: [
          {
            metric_key: "revenue",
            metric_value: 1000000,
            evidence_source: "financial_statements",
            evidence_url: "https://example.com",
            confidence_score: 1.5, // Invalid: > 1
          },
        ],
      });

      await expect(agent.execute(context)).rejects.toThrow(EvidenceMappingError);
    });
  });
});
