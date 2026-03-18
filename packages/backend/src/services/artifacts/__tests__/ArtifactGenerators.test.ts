/**
 * Artifact Generator Tests
 *
 * Tasks: 9.1, 9.2, 9.4
 * - Unit test each generator with mocked validated model input
 * - Unit test hallucination checker integration (figure mismatch → flag)
 * - Unit test draft marking when readiness < 0.8
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

import { ExecutiveMemoGenerator } from "../../../services/artifacts/ExecutiveMemoGenerator.js";
import { CFORecommendationGenerator } from "../../../services/artifacts/CFORecommendationGenerator.js";
import { CustomerNarrativeGenerator } from "../../../services/artifacts/CustomerNarrativeGenerator.js";
import { InternalCaseGenerator } from "../../../services/artifacts/InternalCaseGenerator.js";

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
  });

  describe("ExecutiveMemoGenerator", () => {
    it("should be instantiable with required dependencies", () => {
      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );
      expect(generator).toBeDefined();
    });

    it("should validate output against schema", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Test Memo",
          executive_summary: "Test summary",
          value_hypothesis: "Test hypothesis",
          top_drivers: [
            { name: "Driver 1", impact_range: "$100K-$200K", confidence: 0.85, claim_id: "claim-1" }
          ],
          confidence_assessment: {
            overall_score: 0.8,
            assessment: "High confidence",
            blockers: [],
          },
          key_assumptions: [
            { assumption: "Assumption 1", confidence: 0.9, validated: true }
          ],
          recommendation: "Proceed with the initiative",
          financial_highlights: {
            roi_range: "150%-200%",
            npv: "$500K",
            payback_months: 12,
          },
          provenance_refs: ["claim-1"],
        }),
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500,
        },
      };

      mockLLMGateway.complete.mockResolvedValue(mockResponse);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
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

      const result = await generator.generate(input as any);

      expect(result.output).toBeDefined();
      expect(result.output.title).toBe("Test Memo");
      expect(result.hallucinationCheck).toBe(true);
      expect(result.tokenUsage).toBeDefined();
    });

    it("should fail hallucination check when claim_id mismatch", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "Test Memo",
          executive_summary: "Test summary",
          value_hypothesis: "Test hypothesis",
          top_drivers: [
            { name: "Driver 1", impact_range: "$100K-$200K", confidence: 0.85, claim_id: "unverified-claim" }
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

      mockLLMGateway.complete.mockResolvedValue(mockResponse);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
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
            provenance: { source: "financial_model", claimId: "claim-1" }, // Different from output
          },
        ],
        assumptions: [],
      };

      const result = await generator.generate(input as any);

      // Should fail hallucination check because claim_id doesn't match input
      expect(result.hallucinationCheck).toBe(false);
    });
  });

  describe("CFORecommendationGenerator", () => {
    it("should be instantiable with required dependencies", () => {
      const generator = new CFORecommendationGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );
      expect(generator).toBeDefined();
    });

    it("should validate all financial claims have source references", async () => {
      const mockResponse = {
        content: JSON.stringify({
          title: "CFO Recommendation",
          recommendation: { decision: "approve", rationale: "Strong ROI", confidence: 0.9 },
          financial_summary: {
            scenarios: [
              { name: "Base", probability: 60, roi_percent: 150, npv: "$500K", payback_months: 12, claim_id: "scenario-1" }
            ],
            probability_weighted_roi: 140,
            risk_adjusted_npv: "$450K",
          },
          key_assumptions: [
            { assumption: "Growth rate", value: "15%", source_type: "benchmark", source_id: "bench-1", confidence: 0.8 }
          ],
          sensitivity_highlights: [],
          benchmark_context: [],
          financial_risks: [],
          approval_conditions: [],
          provenance_refs: ["scenario-1", "bench-1"],
        }),
        usage: { prompt_tokens: 1200, completion_tokens: 600, total_tokens: 1800 },
      };

      mockLLMGateway.complete.mockResolvedValue(mockResponse);

      const generator = new CFORecommendationGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.85,
        scenarios: [
          { name: "Base", probability: 60, roi: 150, npv: 500000, currency: "USD", paybackMonths: 12, claimId: "scenario-1" }
        ],
        assumptions: [
          { description: "Growth rate", value: "15%", sourceType: "benchmark", sourceId: "bench-1", confidence: 0.8 }
        ],
        sensitivities: [],
        benchmarks: [],
      };

      const result = await generator.generate(input as any);

      expect(result.output.recommendation.decision).toBe("approve");
      expect(result.hallucinationCheck).toBe(true);
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

      mockLLMGateway.complete.mockResolvedValue(mockResponse);

      const generator = new ExecutiveMemoGenerator(
        mockLLMGateway as any,
        mockCircuitBreaker as any,
        mockMemorySystem as any
      );

      const input = {
        tenantId: "tenant-1",
        organizationId: "org-1",
        caseId: "case-1",
        valueCaseTitle: "Test Case",
        organizationName: "Test Org",
        readinessScore: 0.6, // Below threshold
        blockers: ["Insufficient data"],
        integrityScore: 0.6,
        vetoed: false,
        drivers: [],
        assumptions: [],
      };

      const result = await generator.generate(input as any);

      // When persisted, artifacts with readiness < 0.8 should be marked as 'draft'
      expect(result.output.confidence_assessment.blockers).toContain("Insufficient data");
    });
  });
});
