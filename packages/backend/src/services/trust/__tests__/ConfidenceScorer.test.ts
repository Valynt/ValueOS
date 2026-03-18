import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  calculateConfidence,
  calculateConfidenceBatch,
  validateFinancialClaimsHaveScores,
  ValidationError,
  ConfidenceScorer,
} from "../ConfidenceScorer.js";
import type { Evidence } from "../../../lib/validation/SourceClassification.js";
import { SourceTier } from "../../../lib/validation/SourceClassification.js";

describe("ConfidenceScorer", () => {
  const baseDate = new Date("2024-03-15");

  const createEvidence = (
    tier: SourceTier,
    freshnessDate: Date,
    reliabilityScore: number
  ): Evidence => ({
    id: "e1",
    assumptionId: "a1",
    sourceTier: tier,
    freshnessDate,
    reliabilityScore,
    transparencyLevel: "transparent",
    validationStatus: "validated",
    createdAt: baseDate,
  });

  describe("corroboration boost", () => {
    it("should add 0.05 boost for 2 unique tiers", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
        createEvidence("tier_2_benchmark", baseDate, 0.8),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.corroborationBoost).toBe(0.05);
      expect(result.score).toBe(0.75);
    });

    it("should add 0.10 boost for 3 unique tiers", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
        createEvidence("tier_2_benchmark", baseDate, 0.8),
        createEvidence("tier_3_web", baseDate, 0.7),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.corroborationBoost).toBe(0.1);
      expect(result.score).toBe(0.8);
    });

    it("should cap boost at 0.15 for 4+ unique tiers", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
        createEvidence("tier_2_benchmark", baseDate, 0.8),
        createEvidence("tier_3_web", baseDate, 0.7),
        createEvidence("tier_4_llm", baseDate, 0.6),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.corroborationBoost).toBe(0.15);
    });

    it("should not count duplicate tiers", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
        createEvidence("tier_1_sec", baseDate, 0.8), // Same tier
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.corroborationBoost).toBe(0);
    });
  });

  describe("expired evidence penalty", () => {
    it("should apply penalty for expired tier_1_sec evidence (>1 year)", () => {
      const oldDate = new Date("2023-01-01"); // >1 year old
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", oldDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.expiredPenalty).toBeGreaterThan(0);
      expect(result.score).toBeLessThan(0.7);
    });

    it("should apply higher penalty for very expired evidence", () => {
      const veryOldDate = new Date("2022-01-01"); // >2 years old
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", veryOldDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.expiredPenalty).toBeGreaterThan(0.05);
    });

    it("should not apply penalty for fresh evidence", () => {
      const recentDate = new Date("2024-03-01"); // Recent
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", recentDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources,
      });

      expect(result.details.expiredPenalty).toBe(0);
    });

    it("should cap penalty at 0.3", () => {
      const veryOldDate = new Date("2020-01-01"); // Very old
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", veryOldDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.9,
        sources,
      });

      expect(result.details.expiredPenalty).toBeLessThanOrEqual(0.3);
    });
  });

  describe("confidence threshold flagging", () => {
    it("should flag claims with confidence < 0.5", () => {
      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.4,
        sources: [],
      });

      expect(result.score).toBe(0.4);
      expect(result.requiresAdditionalEvidence).toBe(true);
    });

    it("should not flag claims with confidence >= 0.5", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.5,
        sources,
      });

      expect(result.requiresAdditionalEvidence).toBe(false);
    });

    it("should flag exactly at boundary 0.5", () => {
      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.5,
        sources: [],
      });

      expect(result.score).toBe(0.5);
      expect(result.requiresAdditionalEvidence).toBe(false);
    });
  });

  describe("financial claim validation", () => {
    it("should throw error for financial claim without confidence score", () => {
      const claims = [
        { claimId: "c1", claimType: "financial" },
        { claimId: "c2", claimType: "operational", confidenceScore: 0.7 },
      ];

      expect(() => validateFinancialClaimsHaveScores(claims)).toThrow(
        ValidationError
      );
      expect(() => validateFinancialClaimsHaveScores(claims)).toThrow(
        /Financial claim c1 must have a confidence score/
      );
    });

    it("should pass for all financial claims with scores", () => {
      const claims = [
        { claimId: "c1", claimType: "financial", confidenceScore: 0.7 },
        { claimId: "c2", claimType: "financial", confidenceScore: 0.8 },
      ];

      expect(() => validateFinancialClaimsHaveScores(claims)).not.toThrow();
    });

    it("should not require scores for non-financial claims", () => {
      const claims = [
        { claimId: "c1", claimType: "operational" },
        { claimId: "c2", claimType: "strategic" },
      ];

      expect(() => validateFinancialClaimsHaveScores(claims)).not.toThrow();
    });
  });

  describe("batch processing", () => {
    it("should calculate confidence for multiple claims", () => {
      const inputs = [
        {
          claimId: "c1",
          claimType: "financial" as const,
          baseConfidence: 0.6,
          sources: [createEvidence("tier_1_sec", baseDate, 0.9)],
        },
        {
          claimId: "c2",
          claimType: "financial" as const,
          baseConfidence: 0.7,
          sources: [],
        },
      ];

      const results = calculateConfidenceBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].claimId).toBe("c1");
      expect(results[1].claimId).toBe("c2");
    });
  });

  describe("score clamping", () => {
    it("should clamp score to maximum 1.0", () => {
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", baseDate, 0.9),
        createEvidence("tier_2_benchmark", baseDate, 0.8),
        createEvidence("tier_3_web", baseDate, 0.7),
        createEvidence("tier_4_llm", baseDate, 0.6),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.95,
        sources,
      });

      expect(result.score).toBe(1.0);
    });

    it("should clamp score to minimum 0.0", () => {
      const oldDate = new Date("2020-01-01");
      const sources: Evidence[] = [
        createEvidence("tier_1_sec", oldDate, 0.9),
      ];

      const result = calculateConfidence({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.1,
        sources,
      });

      expect(result.score).toBe(0);
    });
  });

  describe("ConfidenceScorer class", () => {
    const scorer = new ConfidenceScorer();

    it("should calculate single confidence", () => {
      const result = scorer.calculate({
        claimId: "c1",
        claimType: "financial",
        baseConfidence: 0.7,
        sources: [createEvidence("tier_1_sec", baseDate, 0.9)],
      });

      expect(result.score).toBe(0.7);
    });

    it("should calculate batch confidence", () => {
      const inputs = [
        {
          claimId: "c1",
          claimType: "financial" as const,
          baseConfidence: 0.6,
          sources: [],
        },
        {
          claimId: "c2",
          claimType: "financial" as const,
          baseConfidence: 0.7,
          sources: [],
        },
      ];

      const results = scorer.calculateBatch(inputs);
      expect(results).toHaveLength(2);
    });
  });
});
