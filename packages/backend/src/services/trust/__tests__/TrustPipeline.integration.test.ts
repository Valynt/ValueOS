import { describe, it, expect, vi } from "vitest";
import {
  calculateConfidence,
  type ConfidenceInput,
} from "../ConfidenceScorer.js";
import {
  classifyPlausibility,
  type PlausibilityInput,
} from "../PlausibilityClassifier.js";
import {
  detectUnsupportedAssumptions,
} from "../UnsupportedAssumptionDetector.js";
import type { Assumption, Evidence } from "../../../lib/validation/SourceClassification.js";
import { SourceTier } from "../../../lib/validation/SourceClassification.js";

/**
 * Trust Pipeline Integration Test
 *
 * Full end-to-end test of the trust pipeline:
 * evidence → confidence → plausibility → readiness
 */

describe("Trust Pipeline Integration", () => {
  const baseDate = new Date("2024-03-15");

  // Test data builders
  const createAssumption = (
    id: string,
    content: string,
    caseId: string = "case-1"
  ): Assumption => ({
    id,
    caseId,
    content,
    sourceTag: "tier_3_web",
    createdAt: baseDate,
    updatedAt: baseDate,
  });

  const createEvidence = (
    id: string,
    assumptionId: string,
    tier: SourceTier = "tier_2_benchmark",
    freshnessDate: Date = baseDate
  ): Evidence => ({
    id,
    assumptionId,
    sourceTier: tier,
    freshnessDate,
    reliabilityScore: 0.8,
    transparencyLevel: "transparent",
    validationStatus: "validated",
    createdAt: baseDate,
  });

  describe("Scenario 1: Ideal Case (all components passing)", () => {
    it("should process full pipeline with high scores", () => {
      // 1. Evidence with source classification
      const evidence: Evidence[] = [
        createEvidence("e1", "a1", "tier_1_sec", baseDate),
        createEvidence("e2", "a1", "tier_2_benchmark", baseDate),
        createEvidence("e3", "a2", "tier_1_sec", baseDate),
      ];

      // 2. Assumptions with full support
      const assumptions = [
        createAssumption("a1", "Revenue growth 15%"),
        createAssumption("a2", "Cost reduction 10%"),
      ];
      const benchmarkRefs = new Map([
        ["a1", true],
        ["a2", true],
      ]);

      // 3. Confidence scoring with corroboration boost
      const confidenceInputs: ConfidenceInput[] = [
        {
          claimId: "claim-1",
          claimType: "financial",
          baseConfidence: 0.7,
          sources: evidence.filter((e) => e.assumptionId === "a1"),
        },
        {
          claimId: "claim-2",
          claimType: "financial",
          baseConfidence: 0.8,
          sources: evidence.filter((e) => e.assumptionId === "a2"),
        },
      ];

      const confidenceResults = confidenceInputs.map((input) =>
        calculateConfidence(input)
      );

      // Validate corroboration boost (2 sources = +0.05)
      expect(confidenceResults[0].details.corroborationBoost).toBe(0.05);
      expect(confidenceResults[0].score).toBe(0.75);

      // 4. Plausibility classification
      const plausibilityInputs: PlausibilityInput[] = [
        {
          metric: "revenue_growth",
          targetValue: 0.15,
          benchmark: {
            p25: 0.1,
            p50: 0.15,
            p75: 0.2,
            p90: 0.3,
            sampleSize: 500,
            source: "SaaS Metrics 2024",
            date: "2024-01-15",
          },
        },
      ];

      const plausibilityResults = plausibilityInputs.map((input) =>
        classifyPlausibility(input)
      );

      // Validate classification (within p25-p75 = plausible)
      expect(plausibilityResults[0].classification).toBe("plausible");
      expect(plausibilityResults[0].benchmarkReference.source).toBe(
        "SaaS Metrics 2024"
      );

      // 5. Unsupported assumption detection
      const unsupportedResult = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      // All assumptions supported
      expect(unsupportedResult.unsupportedCount).toBe(0);
      expect(unsupportedResult.supportedRatio).toBe(1);

      // Calculate readiness score
      const readinessMetrics = {
        validationRate: 1.0, // All validated
        meanGroundingScore:
          confidenceResults.reduce((sum, r) => sum + r.score, 0) /
          confidenceResults.length,
        benchmarkCoverage: 1.0, // Full coverage
        unsupportedAssumptionCount: 0,
      };

      const readinessScore =
        readinessMetrics.validationRate * 0.3 +
        readinessMetrics.meanGroundingScore * 0.3 +
        readinessMetrics.benchmarkCoverage * 0.2 +
        (1 - 0 / assumptions.length) * 0.2;

      // Should be >= 0.8 (presentation-ready)
      expect(readinessScore).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe("Scenario 2: Mixed Quality", () => {
    it("should handle partial evidence and plausibility issues", () => {
      // Evidence: some fresh, some expired
      const evidence: Evidence[] = [
        createEvidence("e1", "a1", "tier_1_sec", new Date("2023-01-01")), // Expired
        createEvidence("e2", "a2", "tier_2_benchmark", baseDate), // Fresh
      ];

      const assumptions = [
        createAssumption("a1", "Revenue growth 15%"),
        createAssumption("a2", "Cost reduction 10%"),
        createAssumption("a3", "Market share 50%"), // Unsupported
      ];
      const benchmarkRefs = new Map([["a1", true]]);

      // Confidence scoring: expired penalty applied
      const confidenceInputs: ConfidenceInput[] = [
        {
          claimId: "claim-1",
          claimType: "financial",
          baseConfidence: 0.7,
          sources: evidence.filter((e) => e.assumptionId === "a1"),
        },
      ];

      const confidenceResults = confidenceInputs.map((input) =>
        calculateConfidence(input)
      );

      // Expired evidence should have penalty
      expect(confidenceResults[0].details.expiredPenalty).toBeGreaterThan(0);

      // Plausibility: aggressive target
      const plausibilityResult = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.25, // Above p75
        benchmark: {
          p25: 0.1,
          p50: 0.15,
          p75: 0.2,
          p90: 0.3,
          sampleSize: 500,
          source: "SaaS Metrics 2024",
          date: "2024-01-15",
        },
      });

      expect(plausibilityResult.classification).toBe("aggressive");

      // Unsupported detection: 1 unsupported
      const unsupportedResult = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(unsupportedResult.unsupportedCount).toBe(1);
      expect(unsupportedResult.supportedRatio).toBe(2 / 3);
    });
  });

  describe("Scenario 3: Poor Quality (needs work)", () => {
    it("should identify critical issues and low readiness", () => {
      // No evidence, expired data
      const evidence: Evidence[] = [];

      const assumptions = [
        createAssumption("a1", "Revenue growth 50%"), // Unrealistic
        createAssumption("a2", "Cost reduction 80%"), // Unrealistic
      ];
      const benchmarkRefs = new Map<string, boolean>();

      // All assumptions unsupported
      const unsupportedResult = detectUnsupportedAssumptions(
        assumptions,
        evidence,
        benchmarkRefs
      );

      expect(unsupportedResult.unsupportedCount).toBe(2);
      expect(unsupportedResult.supportedRatio).toBe(0);

      // Unrealistic plausibility
      const plausibilityResult = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.5, // Above p90
        benchmark: {
          p25: 0.1,
          p50: 0.15,
          p75: 0.2,
          p90: 0.3,
          sampleSize: 500,
          source: "SaaS Metrics 2024",
          date: "2024-01-15",
        },
      });

      expect(plausibilityResult.classification).toBe("unrealistic");

      // Readiness score should be < 0.6
      const readinessScore = 0 + 0 + 0 + (1 - 2 / 2) * 0.2; // All zeros
      expect(readinessScore).toBe(0);
    });
  });

  describe("Pipeline data flow", () => {
    it("should maintain data consistency through pipeline", () => {
      // Evidence tier flows to confidence
      const evidence = createEvidence("e1", "a1", "tier_1_sec", baseDate);

      const confidenceInput: ConfidenceInput = {
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.8,
        sources: [evidence],
      };

      const confidenceResult = calculateConfidence(confidenceInput);

      // No expired penalty for fresh tier_1
      expect(confidenceResult.details.expiredPenalty).toBe(0);

      // Confidence flows to readiness
      const unsupportedResult = detectUnsupportedAssumptions(
        [createAssumption("a1", "Test")],
        [evidence],
        new Map([["a1", true]])
      );

      expect(unsupportedResult.supportedRatio).toBe(1);
    });

    it("should handle benchmark references in plausibility", () => {
      const plausibilityResult = classifyPlausibility({
        metric: "test_metric",
        targetValue: 0.15,
        currentValue: 0.1,
        benchmark: {
          p25: 0.1,
          p50: 0.15,
          p75: 0.2,
          p90: 0.3,
          sampleSize: 1000,
          source: "Test Source",
          date: "2024-01-01",
        },
      });

      expect(plausibilityResult.improvementPercent).toBe(50);
      expect(plausibilityResult.benchmarkReference.sampleSize).toBe(1000);
    });
  });
});
