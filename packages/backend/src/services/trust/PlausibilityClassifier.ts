/**
 * Plausibility Classifier Service
 *
 * Compares modeled KPI improvements against benchmark percentiles and classifies:
 * - within p25-p75 → plausible
 * - p75-p90 → aggressive
 * - > p90 → unrealistic
 */

export interface BenchmarkPercentiles {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  sampleSize: number;
  source: string;
  date: string;
}

export interface PlausibilityInput {
  metric: string;
  targetValue: number;
  currentValue?: number;
  benchmark: BenchmarkPercentiles;
}

export type PlausibilityClassification = "plausible" | "aggressive" | "unrealistic";

export interface PlausibilityResult {
  metric: string;
  targetValue: number;
  classification: PlausibilityClassification;
  benchmarkReference: {
    source: string;
    date: string;
    sampleSize: number;
    percentiles: {
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
  };
  improvementPercent?: number;
}

/**
 * Classify target value against benchmark percentiles
 */
export function classifyPlausibility(input: PlausibilityInput): PlausibilityResult {
  const { metric, targetValue, currentValue, benchmark } = input;

  let classification: PlausibilityClassification;

  if (targetValue <= benchmark.p75) {
    classification = "plausible";
  } else if (targetValue <= benchmark.p90) {
    classification = "aggressive";
  } else {
    classification = "unrealistic";
  }

  const improvementPercent = currentValue
    ? ((targetValue - currentValue) / currentValue) * 100
    : undefined;

  return {
    metric,
    targetValue,
    classification,
    benchmarkReference: {
      source: benchmark.source,
      date: benchmark.date,
      sampleSize: benchmark.sampleSize,
      percentiles: {
        p25: benchmark.p25,
        p50: benchmark.p50,
        p75: benchmark.p75,
        p90: benchmark.p90,
      },
    },
    improvementPercent,
  };
}

/**
 * Batch classify multiple KPIs
 */
export function classifyPlausibilityBatch(
  inputs: PlausibilityInput[]
): PlausibilityResult[] {
  return inputs.map((input) => classifyPlausibility(input));
}

/**
 * Get assumptions that need plausibility review
 */
export function getUnrealisticAssumptions(
  results: PlausibilityResult[]
): PlausibilityResult[] {
  return results.filter((r) => r.classification === "unrealistic");
}

/**
 * PlausibilityClassifier service class
 */
export class PlausibilityClassifier {
  /**
   * Classify single KPI
   */
  classify(input: PlausibilityInput): PlausibilityResult {
    return classifyPlausibility(input);
  }

  /**
   * Classify multiple KPIs
   */
  classifyBatch(inputs: PlausibilityInput[]): PlausibilityResult[] {
    return classifyPlausibilityBatch(inputs);
  }

  /**
   * Get unrealistic assumptions for review
   */
  getUnrealistic(results: PlausibilityResult[]): PlausibilityResult[] {
    return getUnrealisticAssumptions(results);
  }
}

// Singleton instance
export const plausibilityClassifier = new PlausibilityClassifier();
