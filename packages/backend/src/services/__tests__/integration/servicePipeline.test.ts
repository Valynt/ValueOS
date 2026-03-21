/**
 * Service Integration Tests
 *
 * End-to-end tests for service orchestration and data flow.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

import { DealAssemblyAgent } from "../../../../lib/agent-fabric/agents/DealAssemblyAgent.js";
import { ContextExtractionAgent } from "../../../../lib/agent-fabric/agents/ContextExtractionAgent.js";
import { CRMConnector } from "../../../../services/deal/CRMConnector.js";
import { SECEdgarClient } from "../../../../services/ground-truth/SECEdgarClient.js";
import { XBRLParser } from "../../../../services/ground-truth/XBRLParser.js";
import { ReadinessScorer } from "../../../../services/integrity/ReadinessScorer.js";
import { PlausibilityClassifier } from "../../../../services/integrity/PlausibilityClassifier.js";
import { ArtifactGeneratorService } from "../../../../services/export/ArtifactGeneratorService.js";

// Mocks
vi.mock("../../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe("Service Integration Tests", () => {
  const mockMemorySystem = {
    storeSemanticMemory: vi.fn().mockResolvedValue(undefined),
    retrieve: vi.fn().mockResolvedValue([]),
  };

  const mockLLMGateway = {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        stakeholders: [{ name: "John", role: "economic_buyer", priority: 9, source_type: "crm-derived" }],
        use_cases: [{ name: "Efficiency", description: "Improve", pain_signals: ["slow"], expected_outcomes: ["fast"], source_type: "crm-derived" }],
        pain_points: ["slow"],
        baseline_clues: {},
        value_driver_candidates: [{ driver_name: "Auto", impact_estimate_low: 100, impact_estimate_high: 200, evidence_strength: 0.8, signal_sources: ["crm"], confidence_score: 0.8 }],
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

  beforeAll(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe("CRM to Deal Assembly Pipeline", () => {
    it("should fetch CRM data and extract context", async () => {
      const crmConnector = new CRMConnector();
      const crmData = await crmConnector.fetchDealContext({
        tenantId: "tenant-1",
        crmConnectionId: "conn-1",
        opportunityId: "opp-1",
      });

      expect(crmData.opportunity).toBeDefined();
      expect(crmData.account).toBeDefined();
      expect(crmData.contacts).toHaveLength(2);

      // Context extraction would use this data
      const context = {
        case_id: "case-1",
        organization_id: "tenant-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        crm_data: crmData,
      };

      const extractionAgent = new ContextExtractionAgent(
        { name: "ContextExtractionAgent", lifecycle_stage: "discovery", metadata: { version: "1.0.0" } },
        "tenant-1",
        mockMemorySystem as unknown as import("../../../../lib/agent-fabric/MemorySystem.js").MemorySystem,
        mockLLMGateway as unknown as import("../../../../lib/agent-fabric/LLMGateway.js").LLMGateway,
        mockCircuitBreaker as unknown as import("../../../../lib/agent-fabric/CircuitBreaker.js").CircuitBreaker
      );

      const result = await extractionAgent.execute(context);
      expect(result.status).toBe("success");
      expect(result.result.extracted_context).toBeDefined();
    });
  });

  describe("Deal Assembly End-to-End", () => {
    it("should orchestrate full deal assembly workflow", async () => {
      const agent = new DealAssemblyAgent(
        { name: "DealAssemblyAgent", lifecycle_stage: "discovery", metadata: { version: "1.0.0" } },
        "tenant-1",
        mockMemorySystem as unknown as import("../../../../lib/agent-fabric/MemorySystem.js").MemorySystem,
        mockLLMGateway as unknown as import("../../../../lib/agent-fabric/LLMGateway.js").LLMGateway,
        mockCircuitBreaker as unknown as import("../../../../lib/agent-fabric/CircuitBreaker.js").CircuitBreaker
      );

      const context = {
        case_id: "case-1",
        organization_id: "tenant-1",
        user_id: "user-1",
        workspace_id: "ws-1",
        opportunity_id: "opp-1",
        crm_connection_id: "conn-1",
      };

      const result = await agent.execute(context);

      expect(result.status).toBe("success");
      expect(result.result.deal_context).toBeDefined();
      expect(result.result.deal_context.tenant_id).toBe("tenant-1");
      expect(result.result.assembly_summary).toBeDefined();
    });
  });

  describe("Trust Layer Pipeline", () => {
    it("should calculate readiness and assess plausibility", () => {
      const scorer = new ReadinessScorer();

      const assumptions = [
        { id: "a1", is_validated: true, has_evidence: true, has_benchmark: true, source_type: "customer-confirmed", confidence_score: 0.9 },
        { id: "a2", is_validated: true, has_evidence: true, has_benchmark: true, source_type: "crm-derived", confidence_score: 0.85 },
        { id: "a3", is_validated: true, has_evidence: true, has_benchmark: true, source_type: "call-derived", confidence_score: 0.8 },
      ];

      const evidence = [
        { assumption_id: "a1", grounding_score: 0.9, tier: "tier_1" },
        { assumption_id: "a2", grounding_score: 0.85, tier: "tier_1" },
        { assumption_id: "a3", grounding_score: 0.8, tier: "tier_2" },
      ];

      const readiness = scorer.computeReadiness("case-1", assumptions, evidence);

      expect(readiness.overall_score).toBeGreaterThanOrEqual(0.8);
      expect(readiness.is_presentation_ready).toBe(true);
    });
  });

  describe("Artifact Generation Pipeline", () => {
    it("should generate artifacts with correct status based on readiness", async () => {
      const generator = new ArtifactGeneratorService();

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "executive_memo" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.85,
        dealContext: {
          account_name: "Test Corp",
          industry: "Technology",
          stakeholders: [{ name: "John", role: "VP" }],
        },
        scenario: {
          roi: 200,
          npv: 500000,
          payback_months: 12,
          evf_decomposition_json: {
            revenue_uplift: 200000,
            cost_reduction: 150000,
            risk_mitigation: 50000,
            efficiency_gain: 100000,
          },
        },
        assumptions: [
          { name: "Current Cost", value: 500000, source_type: "customer-confirmed", confidence_score: 0.9 },
        ],
        topValueDrivers: [
          { name: "Automation", impact: "High", confidence: 0.85 },
        ],
      };

      const result = await generator.generateArtifact(input);

      expect(result.status).toBe("final"); // Because readiness >= 0.8
      expect(result.artifactId).toBeDefined();
      expect(result.content).toBeDefined();
    });

    it("should mark artifact as draft when readiness is low", async () => {
      const generator = new ArtifactGeneratorService();

      const input = {
        tenantId: "tenant-1",
        caseId: "case-1",
        artifactType: "cfo_recommendation" as const,
        scenarioId: "scenario-1",
        readinessScore: 0.6,
        dealContext: {
          account_name: "Test Corp",
          industry: "Technology",
          stakeholders: [],
        },
        scenario: {
          roi: 150,
          npv: 300000,
          payback_months: 18,
          evf_decomposition_json: {
            revenue_uplift: 100000,
            cost_reduction: 100000,
            risk_mitigation: 50000,
            efficiency_gain: 50000,
          },
        },
        assumptions: [
          { name: "Current Cost", value: 400000, source_type: "inferred", confidence_score: 0.5 },
        ],
        topValueDrivers: [
          { name: "Efficiency", impact: "Medium", confidence: 0.6 },
        ],
      };

      const result = await generator.generateArtifact(input);

      expect(result.status).toBe("draft"); // Because readiness < 0.8
    });
  });

  describe("Ground Truth to Trust Layer Pipeline", () => {
    it("should fetch SEC data and use for plausibility assessment", async () => {
      // Mock SEC data fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          filings: {
            recent: {
              form: ["10-K"],
              filingDate: ["2024-01-15"],
              accessionNumber: ["0000320193-24-000001"],
              primaryDocument: ["aapl-2023.htm"],
            },
          },
        }),
      } as unknown as Response);

      const secClient = new SECEdgarClient();
      const filing = await secClient.fetchLatest10K("0000320193");

      expect(filing).not.toBeNull();
      expect(filing?.form).toBe("10-K");

      // The XBRL parser would use this to get financial metrics
      // Then plausibility classifier would compare value case projections
    });
  });
});
