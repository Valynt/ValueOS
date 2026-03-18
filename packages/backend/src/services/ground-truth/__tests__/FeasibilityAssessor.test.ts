/**
 * FeasibilityAssessor Tests (Task 11.6)
 *
 * Unit tests for achievable, stretch, and unrealistic classifications.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { feasibilityAssessor, type FeasibilityInput, type FeasibilityClassification } from "../FeasibilityAssessor.js";
import { benchmarkRetrievalService } from "../BenchmarkRetrievalService.js";
import { groundTruthCache } from "../GroundTruthCache.js";

// Mock dependencies
vi.mock("../BenchmarkRetrievalService.js", () => ({
  benchmarkRetrievalService: {
    retrieveBenchmark: vi.fn(),
  },
}));

vi.mock("../GroundTruthCache.js", () => ({
  groundTruthCache: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

describe("FeasibilityAssessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (groundTruthCache.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  describe("assessFeasibility - Achievable classification", () => {
    it("should classify small improvement as achievable", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 1200000, // 20% increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p25: 1000000, p50: 2000000, p75: 5000000, p90: 10000000 },
        historicalRange: { min: 0.1, max: 0.5 }, // 10-50% historical improvement
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("achievable");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should classify improvement within historical range as achievable", async () => {
      const input: FeasibilityInput = {
        metric: "NRR",
        currentValue: 100,
        targetValue: 115, // 15% increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "NRR",
        metricName: "Net Revenue Retention",
        distribution: { p25: 100, p50: 115, p75: 125, p90: 140 },
        historicalRange: { min: 0.05, max: 0.25 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("achievable");
    });
  });

  describe("assessFeasibility - Stretch classification", () => {
    it("should classify moderate improvement as stretch", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 1800000, // 80% increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p25: 1000000, p50: 2000000, p75: 5000000, p90: 10000000 },
        historicalRange: { min: 0.1, max: 0.5 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("stretch");
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should include benchmark reference in stretch rationale", async () => {
      const input: FeasibilityInput = {
        metric: "GrossMargin",
        currentValue: 70,
        targetValue: 85, // 15 percentage point increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "GrossMargin",
        metricName: "Gross Margin",
        distribution: { p25: 70, p50: 80, p75: 85, p90: 90 },
        historicalRange: { min: 0.05, max: 0.15 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("stretch");
      expect(result.rationale).toContain("benchmark");
      expect(result.benchmarkReference).toBeDefined();
    });
  });

  describe("assessFeasibility - Unrealistic classification", () => {
    it("should classify extreme improvement as unrealistic", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 10000000, // 10x increase
        industry: "SaaS",
        timeframe: "1_year",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p25: 1000000, p50: 2000000, p75: 5000000, p90: 10000000 },
        historicalRange: { min: 0.1, max: 0.5 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("unrealistic");
      expect(result.confidence).toBeGreaterThan(0.7);
    });

    it("should classify improvement exceeding historical maximum as unrealistic", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 2000000, // 100% increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p25: 1000000, p50: 1500000, p75: 2000000, p90: 3000000 },
        historicalRange: { min: 0.05, max: 0.3 }, // Max 30% historically
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("unrealistic");
    });
  });

  describe("assessBatch", () => {
    it("should assess multiple improvements in batch", async () => {
      const inputs: FeasibilityInput[] = [
        { metric: "ARR", currentValue: 1000000, targetValue: 1200000, industry: "SaaS" },
        { metric: "NRR", currentValue: 100, targetValue: 115, industry: "SaaS" },
      ];

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          metricId: "ARR",
          historicalRange: { min: 0.1, max: 0.5 },
        })
        .mockResolvedValueOnce({
          metricId: "NRR",
          historicalRange: { min: 0.05, max: 0.2 },
        });

      const results = await feasibilityAssessor.assessBatch(inputs);

      expect(results).toHaveLength(2);
      expect(results[0].classification).toBeDefined();
      expect(results[1].classification).toBeDefined();
    });
  });

  describe("rationale generation", () => {
    it("should include specific rationale for achievable", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 1100000, // 10% increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p50: 2000000 },
        historicalRange: { min: 0.1, max: 0.5 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.rationale).toContain("achievable");
      expect(result.rationale.length).toBeGreaterThan(20);
    });

    it("should include risk factors for unrealistic", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 5000000, // 5x increase
        industry: "SaaS",
      };

      (benchmarkRetrievalService.retrieveBenchmark as ReturnType<typeof vi.fn>).mockResolvedValue({
        metricId: "ARR",
        metricName: "Annual Recurring Revenue",
        distribution: { p90: 3000000 },
        historicalRange: { min: 0.1, max: 0.5 },
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("unrealistic");
      expect(result.rationale).toContain("unrealistic");
    });
  });

  describe("caching", () => {
    it("should use cache when available", async () => {
      const input: FeasibilityInput = {
        metric: "ARR",
        currentValue: 1000000,
        targetValue: 1200000,
        industry: "SaaS",
      };

      const cachedResult = {
        classification: "achievable" as FeasibilityClassification,
        confidence: 0.85,
        rationale: "Cached rationale",
        improvementPercentage: 0.2,
      };

      (groundTruthCache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        hit: true,
        data: cachedResult,
        age: 1000,
      });

      const result = await feasibilityAssessor.assessFeasibility(input);

      expect(result.classification).toBe("achievable");
      expect(benchmarkRetrievalService.retrieveBenchmark).not.toHaveBeenCalled();
    });
  });
});
