import { describe, it, expect } from "vitest";
import {
  classifyPlausibility,
  classifyPlausibilityBatch,
  getUnrealisticAssumptions,
  PlausibilityClassifier,
  type PlausibilityInput,
} from "../PlausibilityClassifier";

describe("PlausibilityClassifier", () => {
  const baseBenchmark = {
    p25: 0.1,
    p50: 0.2,
    p75: 0.3,
    p90: 0.5,
    sampleSize: 500,
    source: "Industry Report 2024",
    date: "2024-03-01",
  };

  describe("classification boundaries", () => {
    it("should classify at p25 as plausible", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.1,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("plausible");
    });

    it("should classify at p50 as plausible", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.2,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("plausible");
    });

    it("should classify at p75 as plausible", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.3,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("plausible");
    });

    it("should classify between p75-p90 as aggressive", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.4,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("aggressive");
    });

    it("should classify at p90 as aggressive", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.5,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("aggressive");
    });

    it("should classify above p90 as unrealistic", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.6,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("unrealistic");
    });

    it("should classify below p25 as plausible", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.05,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("plausible");
    });
  });

  describe("benchmark reference", () => {
    it("should include benchmark reference in result", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.25,
        benchmark: baseBenchmark,
      });

      expect(result.benchmarkReference.source).toBe("Industry Report 2024");
      expect(result.benchmarkReference.date).toBe("2024-03-01");
      expect(result.benchmarkReference.sampleSize).toBe(500);
      expect(result.benchmarkReference.percentiles).toEqual({
        p25: 0.1,
        p50: 0.2,
        p75: 0.3,
        p90: 0.5,
      });
    });
  });

  describe("improvement percentage", () => {
    it("should calculate improvement when current value provided", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.2,
        currentValue: 0.1,
        benchmark: baseBenchmark,
      });

      expect(result.improvementPercent).toBe(100);
    });

    it("should not include improvement when current value not provided", () => {
      const result = classifyPlausibility({
        metric: "revenue_growth",
        targetValue: 0.2,
        benchmark: baseBenchmark,
      });

      expect(result.improvementPercent).toBeUndefined();
    });

    it("should handle negative improvement (decrease)", () => {
      const result = classifyPlausibility({
        metric: "cost_reduction",
        targetValue: 0.05,
        currentValue: 0.1,
        benchmark: baseBenchmark,
      });

      expect(result.improvementPercent).toBe(-50);
    });
  });

  describe("batch processing", () => {
    it("should classify multiple metrics", () => {
      const inputs: PlausibilityInput[] = [
        {
          metric: "revenue_growth",
          targetValue: 0.15,
          benchmark: baseBenchmark,
        },
        {
          metric: "cost_reduction",
          targetValue: 0.4,
          benchmark: baseBenchmark,
        },
        {
          metric: "market_share",
          targetValue: 0.6,
          benchmark: baseBenchmark,
        },
      ];

      const results = classifyPlausibilityBatch(inputs);

      expect(results).toHaveLength(3);
      expect(results[0].classification).toBe("plausible");
      expect(results[1].classification).toBe("aggressive");
      expect(results[2].classification).toBe("unrealistic");
    });
  });

  describe("unrealistic assumptions", () => {
    it("should filter unrealistic assumptions", () => {
      const results = [
        classifyPlausibility({
          metric: "r1",
          targetValue: 0.1,
          benchmark: baseBenchmark,
        }),
        classifyPlausibility({
          metric: "r2",
          targetValue: 0.4,
          benchmark: baseBenchmark,
        }),
        classifyPlausibility({
          metric: "r3",
          targetValue: 0.6,
          benchmark: baseBenchmark,
        }),
      ];

      const unrealistic = getUnrealisticAssumptions(results);

      expect(unrealistic).toHaveLength(1);
      expect(unrealistic[0].metric).toBe("r3");
    });
  });

  describe("PlausibilityClassifier class", () => {
    const classifier = new PlausibilityClassifier();

    it("should classify single metric", () => {
      const result = classifier.classify({
        metric: "revenue_growth",
        targetValue: 0.25,
        benchmark: baseBenchmark,
      });

      expect(result.classification).toBe("plausible");
    });

    it("should classify batch", () => {
      const inputs: PlausibilityInput[] = [
        {
          metric: "m1",
          targetValue: 0.1,
          benchmark: baseBenchmark,
        },
        {
          metric: "m2",
          targetValue: 0.6,
          benchmark: baseBenchmark,
        },
      ];

      const results = classifier.classifyBatch(inputs);
      expect(results).toHaveLength(2);
    });

    it("should get unrealistic assumptions", () => {
      const results = [
        classifyPlausibility({
          metric: "m1",
          targetValue: 0.1,
          benchmark: baseBenchmark,
        }),
        classifyPlausibility({
          metric: "m2",
          targetValue: 0.6,
          benchmark: baseBenchmark,
        }),
      ];

      const unrealistic = classifier.getUnrealistic(results);
      expect(unrealistic).toHaveLength(1);
    });
  });
});
