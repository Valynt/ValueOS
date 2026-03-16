// ============================================================================
// Benchmark Alignment Check
//
// Separated from eso.ts to avoid a circular import with eso-data.ts.
// ============================================================================

import type { ESOKPINode } from './eso';
import { ALL_ESO_KPIS } from './eso-data';

export interface BenchmarkAlignmentResult {
  aligned: boolean;
  percentile: string;
  warning?: string;
}

/**
 * Check whether a claimed metric value aligns with known industry benchmarks.
 *
 * Returns the approximate percentile and a warning when the value is
 * suspiciously high (above world-class or p75 + 50 % of IQR).
 */
export function checkBenchmarkAlignment(
  metricId: string,
  claimedValue: number,
): BenchmarkAlignmentResult {
  const kpi: ESOKPINode | undefined = ALL_ESO_KPIS.find((k) => k.id === metricId);
  if (!kpi) {
    return { aligned: false, percentile: 'unknown', warning: `Unknown metric: ${metricId}` };
  }

  const { p25, p50, p75, worldClass } = kpi.benchmarks;
  const higherIsBetter = kpi.improvementDirection === 'higher_is_better';

  // Determine percentile bucket
  let percentile: string;
  if (higherIsBetter) {
    if (claimedValue >= (worldClass ?? Infinity)) percentile = 'world_class';
    else if (claimedValue >= p75) percentile = 'p75+';
    else if (claimedValue >= p50) percentile = 'p50-p75';
    else if (claimedValue >= p25) percentile = 'p25-p50';
    else percentile = 'below_p25';
  } else {
    if (claimedValue <= (worldClass ?? -Infinity)) percentile = 'world_class';
    else if (claimedValue <= p25) percentile = 'p75+';
    else if (claimedValue <= p50) percentile = 'p50-p75';
    else if (claimedValue <= p75) percentile = 'p25-p50';
    else percentile = 'below_p25';
  }

  // Warn on suspiciously extreme values
  const iqr = Math.abs(p75 - p25);
  const upperFence = higherIsBetter ? p75 + iqr * 1.5 : p25 - iqr * 1.5;
  const suspicious = higherIsBetter
    ? claimedValue > upperFence
    : claimedValue < upperFence;

  return {
    aligned: !suspicious,
    percentile,
    warning: suspicious
      ? `Claimed value ${claimedValue} exceeds statistical fence (${upperFence.toFixed(2)}) for ${kpi.name}`
      : undefined,
  };
}
