/**
 * useCrossGraphPatterns — Hook for cross-case pattern discovery
 *
 * Phase 5.4: Value Graph Polish
 *
 * Detects shared drivers and patterns across multiple cases for benchmarking.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

export interface CrossGraphPattern {
  /** Driver label that appears across cases */
  driverLabel: string;
  /** Occurrences of this driver in each case */
  occurrences: Array<{
    caseId: string;
    caseName: string;
    nodeId: string;
    value: number;
    confidence: number;
  }>;
  /** Aggregate value across all occurrences */
  aggregateValue: number;
  /** Industry benchmark data (if available) */
  industryBenchmark?: {
    median: number;
    p25: number;
    p75: number;
    sampleSize: number;
  };
}

interface UseCrossGraphPatternsResult {
  /** Detected patterns */
  patterns: CrossGraphPattern[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether query is enabled (requires 2+ cases) */
  isEnabled: boolean;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Fetch cross-graph patterns for multiple cases.
 *
 * @param caseIds — Array of case IDs to analyze
 * @returns Patterns with loading/error states
 */
export function useCrossGraphPatterns(
  caseIds: string[]
): UseCrossGraphPatternsResult {
  const isEnabled = caseIds.length >= 2;
  const sortedCaseIds = [...caseIds].sort();

  const query = useQuery<CrossGraphPattern[]>({
    queryKey: ["cross-graph-patterns", ...sortedCaseIds],
    queryFn: async () => {
      if (caseIds.length < 2) return [];

      // TODO: Replace with actual API call
      // const response = await fetch('/api/graphs/patterns', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ caseIds: sortedCaseIds }),
      // });
      // if (!response.ok) throw new Error("Failed to fetch patterns");
      // return response.json();

      // Return mock data for development
      return generateMockPatterns(sortedCaseIds);
    },
    enabled: isEnabled,
    staleTime: 120_000, // 2 minutes
  });

  return {
    patterns: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
    isEnabled,
    refetch: query.refetch,
  };
}

/**
 * Generate mock pattern data for development.
 *
 * @param caseIds — Case IDs
 * @returns Mock patterns
 */
function generateMockPatterns(caseIds: string[]): CrossGraphPattern[] {
  const patterns: CrossGraphPattern[] = [
    {
      driverLabel: "Cost Savings",
      occurrences: caseIds.map((caseId, i) => ({
        caseId,
        caseName: `Case ${i + 1}`,
        nodeId: `node-cost-${i}`,
        value: 500000 + i * 100000,
        confidence: 0.8 + i * 0.05,
      })),
      aggregateValue: caseIds.reduce((sum, _, i) => sum + 500000 + i * 100000, 0),
      industryBenchmark: {
        median: 600000,
        p25: 400000,
        p75: 800000,
        sampleSize: 12,
      },
    },
    {
      driverLabel: "Revenue Growth",
      occurrences: caseIds.slice(0, 2).map((caseId, i) => ({
        caseId,
        caseName: `Case ${i + 1}`,
        nodeId: `node-revenue-${i}`,
        value: 1200000 + i * 200000,
        confidence: 0.75 + i * 0.1,
      })),
      aggregateValue: caseIds.slice(0, 2).reduce((sum, _, i) => sum + 1200000 + i * 200000, 0),
    },
  ];

  return patterns;
}

/**
 * Calculate aggregate statistics for a pattern.
 *
 * @param pattern — Cross-graph pattern
 * @returns Statistics
 */
export function calculatePatternStats(pattern: CrossGraphPattern): {
  averageValue: number;
  averageConfidence: number;
  valueRange: { min: number; max: number };
  confidenceRange: { min: number; max: number };
} {
  const values = pattern.occurrences.map((o) => o.value);
  const confidences = pattern.occurrences.map((o) => o.confidence);

  return {
    averageValue: values.reduce((a, b) => a + b, 0) / values.length,
    averageConfidence: confidences.reduce((a, b) => a + b, 0) / confidences.length,
    valueRange: {
      min: Math.min(...values),
      max: Math.max(...values),
    },
    confidenceRange: {
      min: Math.min(...confidences),
      max: Math.max(...confidences),
    },
  };
}

/**
 * Fuzzy match driver labels to find similar drivers.
 *
 * @param label1 — First label
 * @param label2 — Second label
 * @returns Similarity score 0-1
 */
export function fuzzyMatchLabels(label1: string, label2: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, "");

  const n1 = normalize(label1);
  const n2 = normalize(label2);

  if (n1 === n2) return 1;

  // Simple substring matching
  if (n1.includes(n2) || n2.includes(n1)) {
    return 0.8;
  }

  // Calculate Levenshtein distance (simplified)
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(n1, n2);
  return 1 - distance / maxLen;
}

/**
 * Calculate Levenshtein distance between two strings.
 */
function levenshteinDistance(s1: string, s2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      const cost = s2[i - 1] === s1[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[s2.length][s1.length];
}
