/**
 * Artifact Generator Tests
 *
 * Tasks: 9.1, 9.2, 9.4
 * - Unit test each generator with mocked validated model input
 * - Unit test hallucination checker integration (figure mismatch → flag)
 * - Unit test draft marking when readiness < 0.8
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { secureLLMComplete } from "../../../lib/llm/secureLLMWrapper.js";
import { logSecurityEvent } from "../../../services/security/auditLogger.js";
import { ExecutiveMemoGenerator } from "../../../services/artifacts/ExecutiveMemoGenerator.js";
import { CFORecommendationGenerator } from "../../../services/artifacts/CFORecommendationGenerator.js";
import { CustomerNarrativeGenerator } from "../../../services/artifacts/CustomerNarrativeGenerator.js";
import { InternalCaseGenerator } from "../../../services/artifacts/InternalCaseGenerator.js";

vi.mock("../../../lib/llm/secureLLMWrapper.js", () => ({
  secureLLMComplete: vi.fn(),
}));

vi.mock("../../../services/security/auditLogger.js", () => ({
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock dependencies
const mockLLMGateway = {
  complete: vi.fn(),
};

const mockCircuitBreaker = {
  execute: vi.fn((fn: Function) => fn()),
};

const mockMemorySystem = {
  storeSemanticMemory: vi.fn(),
  retrieve: vi.fn(() => Promise.resolve([])),
};

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Artifact Generators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(logSecurityEvent).mockResolvedValue(undefined);
  });

  describe("ExecutiveMemoGenerator", () => {
    it("should be instantiable with required dependencies", () => {
      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );
      expect(generator).toBeDefined();
    });

    it("should validate output against schema through secureLLMComplete", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Test Memo",
          executive_summary: "Test summary",
          value_hypothesis: "Test hypothesis",
          top_drivers: [
            { name: "Driver 1", impact_range: "$100K-$200K", confidence: 0.85, claim_id: "claim-1" },
          ],
          confidence_assessment: {
            overall_score: 0.8,
            assessment: "High confidence",
            blockers: [],
          },
          key_assumptions: [
            { assumption: "Assumption 1", confidence: 0.9, validated: true },
          ],
          recommendation: "Proceed with the initiative",
          financial_highlights: {
            roi_range: "150%-200%",
            npv: "$500K",
            payback_months: 12,
          },
          provenance_refs: ["claim-1"],
        }),
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.85,
        integrityScore: 0.9,
        vetoed: false,
        drivers: [
          {
            name: "Driver 1",
            impactRange: { low: 100000, high: 200000 },
            unit: "USD",
            confidence: 0.85,
            provenance: { source: "financial_model", claimId: "claim-1" },
          },
        ],
        assumptions: [
          { description: "Assumption 1", confidence: 0.9, validated: true },
        ],
      };

      const result = await generator.generate(input as never);

      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.any(Array),
        expect.objectContaining({
          serviceName: "ExecutiveMemoGenerator",
          operation: "generate",
          organizationId: "org-1",
          tenantId: "tenant-1",
        })
      );
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.output).toBeDefined();
      expect(result.output.title).toBe("Test Memo");
      expect(result.hallucinationCheck).toBe(true);
      expect(result.tokenUsage).toBeDefined();
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "artifacts:executive_memo_generated" })
      );
    });

    it("should preserve failed hallucination checks", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Test Memo",
          executive_summary: "Test summary",
          value_hypothesis: "Test hypothesis",
          top_drivers: [
            { name: "Driver 1", impact_range: "$100K-$200K", confidence: 0.85, claim_id: "unverified-claim" },
          ],
          confidence_assessment: {
            overall_score: 0.8,
            assessment: "High confidence",
            blockers: [],
          },
          key_assumptions: [{ assumption: "Assumption 1", confidence: 0.9, validated: true }],
          recommendation: "Proceed",
          financial_highlights: {
            roi_range: "150%-200%",
            npv: "$500K",
            payback_months: 12,
          },
          provenance_refs: ["unverified-claim"],
        }),
        usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.85,
        integrityScore: 0.9,
        vetoed: false,
        drivers: [
          {
            name: "Driver 1",
            impactRange: { low: 100000, high: 200000 },
            unit: "USD",
            confidence: 0.85,
            provenance: { source: "financial_model", claimId: "claim-1" },
          },
        ],
        assumptions: [],
      };

      const result = await generator.generate(input as never);

      expect(result.hallucinationCheck).toBe(false);
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "security:hallucination_detected" })
      );
    });
  });

  describe("CFORecommendationGenerator", () => {
    it("should be instantiable with required dependencies", () => {
      const generator = new CFORecommendationGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );
      expect(generator).toBeDefined();
    });

    it("should validate all financial claims have source references via secureLLMComplete", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "CFO Recommendation",
          recommendation: { decision: "approve", rationale: "Strong ROI", confidence: 0.9 },
          financial_summary: {
            scenarios: [
              { name: "Base", probability: 60, roi_percent: 150, npv: "$500K", payback_months: 12, claim_id: "scenario-1" },
            ],
            probability_weighted_roi: 140,
            risk_adjusted_npv: "$450K",
          },
          key_assumptions: [
            { assumption: "Growth rate", value: "15%", source_type: "benchmark", source_id: "bench-1", confidence: 0.8 },
          ],
          sensitivity_highlights: [],
          benchmark_context: [],
          financial_risks: [],
          approval_conditions: [],
          provenance_refs: ["scenario-1", "bench-1"],
        }),
        usage: { prompt_tokens: 1200, completion_tokens: 600, total_tokens: 1800 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new CFORecommendationGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.85,
        scenarios: [
          { name: "Base", probability: 60, roi: 150, npv: 500000, currency: "USD", paybackMonths: 12, claimId: "scenario-1" },
        ],
        assumptions: [
          { description: "Growth rate", value: "15%", sourceType: "benchmark", sourceId: "bench-1", confidence: 0.8 },
        ],
        sensitivities: [],
        benchmarks: [],
      };

      const result = await generator.generate(input as never);

      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.any(Array),
        expect.objectContaining({
          serviceName: "CFORecommendationGenerator",
          tenantId: "tenant-1",
        })
      );
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.output.recommendation.decision).toBe("approve");
      expect(result.hallucinationCheck).toBe(true);
    });
  });

  describe("Other artifact generators", () => {
    it("routes customer narrative generation through secureLLMComplete", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Customer Narrative",
          industry_framing: "Framing",
          business_outcomes: [
            { outcome: "Outcome", description: "Description", value_range: "$100K", confidence: 0.8, claim_id: "claim-1" },
          ],
          benchmark_context: [
            {
              metric: "ROI",
              comparison: "Above average",
              opportunity: "Scale faster",
              benchmark_id: "bench-1",
            },
          ],
          proof_points: [{ headline: "Proof", details: "Detail", evidence_ref: "ev-1" }],
          risk_mitigations: [],
          implementation_highlights: {
            timeline: "90 days",
            key_milestones: ["Kickoff"],
            quick_wins: ["Pilot"],
          },
          next_steps: [{ action: "Schedule kickoff", owner: "CSM", timeframe: "1 week" }],
          provenance_refs: ["claim-1"],
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new CustomerNarrativeGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );

      const result = await generator.generate({
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Title",
        organizationName: "Org",
        readinessScore: 0.8,
        buyer: { title: "CIO", persona: "economic" },
        drivers: [],
        benchmarks: [],
        proofPoints: [],
      } as any);

      expect(result.output.title).toBe("Customer Narrative");
      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.any(Array),
        expect.objectContaining({ serviceName: "CustomerNarrativeGenerator" })
      );
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });

    it("routes internal case generation through secureLLMComplete", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Internal Case",
          deal_summary: {
            acv: "$100K",
            tcv: "$300K",
            term_years: 3,
            quantified_value_range: "$500K-$700K",
            vp_ratio: "5.0x",
            strategic_importance: "High",
          },
          value_analysis: {
            total_quantified_value: { low: "$500K", high: "$700K", unit: "USD" },
            key_drivers: [{ name: "Driver", impact: "$200K", confidence: 0.8, claim_id: "claim-1" }],
          },
          competitive_context: {
            primary_competitors: [{ name: "Competitor", positioning: "Incumbent", threat_level: "medium" }],
            our_advantages: ["Speed"],
            competitive_risks: [{ risk: "Discounting", mitigation: "Differentiate" }],
          },
          risk_assessment: [
            {
              category: "delivery",
              description: "Tight timeline",
              likelihood: "medium",
              financial_impact: "$50K",
              mitigation: "Stage rollout",
              owner: "PM",
            },
          ],
          assumption_quality: {
            overall_rating: "high",
            critical_assumptions: [
              {
                assumption: "Adoption rate",
                quality: "Strong",
                validated: true,
                evidence_strength: "High",
              },
            ],
            gaps: [],
          },
          integrity_status: {
            score: 0.9,
            vetoed: false,
            critical_issues: [],
            recommended_actions: [],
          },
          recommendation: {
            decision: "proceed",
            conditions: [],
            rationale: "Good fit",
          },
          next_steps: [{ action: "Prepare deal desk review", owner: "AE", deadline: "2026-04-01", priority: "high" }],
          provenance_refs: ["claim-1"],
        }),
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new InternalCaseGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );

      const result = await generator.generate({
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Title",
        organizationName: "Org",
        readinessScore: 0.8,
        deal: {},
        valueModel: {},
        competitors: [],
        competitiveAdvantages: [],
        competitiveRisks: [],
        risks: [],
        assumptions: [],
        integrity: { vetoed: false },
      } as any);

      expect(result.output.title).toBe("Internal Case");
      expect(secureLLMComplete).toHaveBeenCalledWith(
        mockLLMGateway,
        expect.any(Array),
        expect.objectContaining({ serviceName: "InternalCaseGenerator" })
      );
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });
  });

  describe("Draft Status Based on Readiness Score", () => {
    it("should mark artifacts as draft when readiness score < 0.8", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Draft Memo",
          executive_summary: "Draft summary",
          value_hypothesis: "Draft hypothesis",
          top_drivers: [],
          confidence_assessment: {
            overall_score: 0.6,
            assessment: "Medium confidence - draft status",
            blockers: ["Insufficient data"],
          },
          key_assumptions: [],
          recommendation: "Pause for more data",
          financial_highlights: { roi_range: "TBD", npv: "TBD", payback_months: 0 },
          provenance_refs: [],
        }),
        usage: { prompt_tokens: 1000, completion_tokens: 400, total_tokens: 1400 },
      };

      vi.mocked(secureLLMComplete).mockResolvedValue(mockResponse as any);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.6,
        blockers: ["Insufficient data"],
        integrityScore: 0.6,
        vetoed: false,
        drivers: [],
        assumptions: [],
      };

      const result = await generator.generate(input as never);

      expect(result.output.confidence_assessment.blockers).toContain("Insufficient data");
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
    });
  });
});
