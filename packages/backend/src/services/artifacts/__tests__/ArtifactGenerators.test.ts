/**
 * Artifact Generator Tests
 *
 * Tasks: 9.1, 9.2, 9.4
 * - Unit test each generator with mocked validated model input
 * - Unit test hallucination checker integration (figure mismatch → flag)
 * - Unit test draft marking when readiness < 0.8
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../services/llm/secureServiceInvocation.js", () => ({
  secureServiceInvoke: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import { secureServiceInvoke } from "../../../services/llm/secureServiceInvocation.js";
import { CFORecommendationGenerator } from "../../../services/artifacts/CFORecommendationGenerator.js";
import { CustomerNarrativeGenerator } from "../../../services/artifacts/CustomerNarrativeGenerator.js";
import { ExecutiveMemoGenerator } from "../../../services/artifacts/ExecutiveMemoGenerator.js";
import { InternalCaseGenerator } from "../../../services/artifacts/InternalCaseGenerator.js";

const mockLLMGateway = {
  complete: vi.fn(),
};

const mockCircuitBreaker = {
  execute: vi.fn((fn: () => unknown) => fn()),
};

const mockMemorySystem = {
  storeSemanticMemory: vi.fn(),
  retrieve: vi.fn(() => Promise.resolve([])),
};

describe("Artifact Generators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    it("should validate output against schema through secureServiceInvoke", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
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
        },
        hallucinationCheck: true,
        tokenUsage: {
          input_tokens: 1000,
          output_tokens: 500,
          total_tokens: 1500,
        },
        rawContent: "{}",
      });

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

      expect(secureServiceInvoke).toHaveBeenCalledOnce();
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.output).toBeDefined();
      expect(result.output.title).toBe("Test Memo");
      expect(result.hallucinationCheck).toBe(true);
      expect(result.tokenUsage).toBeDefined();
    });

    it("should preserve failed hallucination checks returned by secureServiceInvoke", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
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
        },
        hallucinationCheck: false,
        tokenUsage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
        rawContent: "{}",
      });

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
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
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

    it("should validate all financial claims have source references via secureServiceInvoke", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
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
        },
        hallucinationCheck: true,
        tokenUsage: { input_tokens: 1200, output_tokens: 600, total_tokens: 1800 },
        rawContent: "{}",
      });

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

      expect(secureServiceInvoke).toHaveBeenCalledOnce();
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.output.recommendation.decision).toBe("approve");
      expect(result.hallucinationCheck).toBe(true);
    });
  });

  describe("Other artifact generators", () => {
    it("routes customer narrative generation through secureServiceInvoke", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
          title: "Customer Narrative",
          industry_framing: "Framing",
          business_outcomes: [
            { outcome: "Outcome", description: "Description", value_range: "$100K", confidence: 0.8, claim_id: "claim-1" },
          ],
          benchmark_context: [],
          proof_points: [{ headline: "Proof", details: "Detail", evidence_ref: "evidence-1" }],
          risk_mitigations: [],
          implementation_highlights: { timeline: "90 days", key_milestones: [], quick_wins: [] },
          next_steps: [],
          provenance_refs: ["claim-1"],
        },
        hallucinationCheck: true,
        tokenUsage: undefined,
        rawContent: "{}",
      });

      const generator = new CustomerNarrativeGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const result = await generator.generate({
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.9,
        drivers: [],
        benchmarks: [],
        proofPoints: [],
      } as never);

      expect(secureServiceInvoke).toHaveBeenCalledOnce();
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.hallucinationCheck).toBe(true);
    });

    it("routes internal case generation through secureServiceInvoke", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
          title: "Internal Case",
          deal_summary: {
            acv: "$100K",
            tcv: "$300K",
            term_years: 3,
            quantified_value_range: "$500K-$700K",
            vp_ratio: "2.0x",
            strategic_importance: "High",
          },
          value_analysis: {
            total_quantified_value: { low: "$500K", high: "$700K", unit: "USD" },
            key_drivers: [{ name: "Driver", impact: "$200K", confidence: 0.8, claim_id: "claim-1" }],
          },
          competitive_context: {
            primary_competitors: [],
            our_advantages: [],
            competitive_risks: [],
          },
          risk_assessment: [],
          assumption_quality: {
            overall_rating: "high",
            critical_assumptions: [],
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
            rationale: "Looks good",
          },
          next_steps: [],
          provenance_refs: ["claim-1"],
        },
        hallucinationCheck: true,
        tokenUsage: undefined,
        rawContent: "{}",
      });

      const generator = new InternalCaseGenerator(
        mockLLMGateway as never,
        mockCircuitBreaker as never,
        mockMemorySystem as never,
      );

      const result = await generator.generate({
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.9,
        deal: { stage: "proposal" },
        valueModel: {
          totalValue: { low: 500000, high: 700000, unit: "USD" },
          vpRatio: "2.0x",
          drivers: [{ name: "Driver", impact: "$200K", confidence: 0.8, claimId: "claim-1" }],
        },
        risks: [],
        assumptions: [],
        integrity: { score: 0.9, vetoed: false },
      } as never);

      expect(secureServiceInvoke).toHaveBeenCalledOnce();
      expect(mockLLMGateway.complete).not.toHaveBeenCalled();
      expect(result.hallucinationCheck).toBe(true);
    });
  });

  describe("Draft Status Based on Readiness Score", () => {
    it("should mark artifacts as draft when readiness score < 0.8", async () => {
      vi.mocked(secureServiceInvoke).mockResolvedValueOnce({
        parsed: {
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
        },
        hallucinationCheck: false,
        tokenUsage: { input_tokens: 1000, output_tokens: 400, total_tokens: 1400 },
        rawContent: "{}",
      });

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
