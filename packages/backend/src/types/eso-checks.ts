// ============================================================================
// Benchmark Alignment, Severity Classification, Feasibility Scoring,
// Composite Health, and Confidence Model
//
// Production implementations for the ESO ground truth system.
// ============================================================================

import type {
  ClaimSeverity,
  CompositeHealthResult,
  ConfidenceFactors,
  ConfidenceScore,
  ESOEdge,
  ESOKPINode,
  FeasibilityResult,
  KPIHealthEntry,
} from "./eso";
import { ALL_ESO_KPIS, EXTENDED_ESO_EDGES } from "./eso-data";

export interface BenchmarkAlignmentResult {
  aligned: boolean;
  percentile: string;
  warning?: string;
}

// ============================================================================
// Percentile helpers (shared across functions)
// ============================================================================

function resolvePercentile(kpi: ESOKPINode, value: number): string {
  const { p25, p50, p75, worldClass } = kpi.benchmarks;
  const hib = kpi.improvementDirection === "higher_is_better";

  if (hib) {
    if (value >= (worldClass ?? Infinity)) return "world_class";
    if (value >= p75) return "p75+";
    if (value >= p50) return "p50-p75";
    if (value >= p25) return "p25-p50";
    return "below_p25";
  }
  if (value <= (worldClass ?? -Infinity)) return "world_class";
  if (value <= p25) return "p75+";
  if (value <= p50) return "p50-p75";
  if (value <= p75) return "p25-p50";
  return "below_p25";
}

function normalizeScore(kpi: ESOKPINode, value: number): number {
  const { p25, p75 } = kpi.benchmarks;
  const hib = kpi.improvementDirection === "higher_is_better";
  const range = Math.abs(p75 - p25);
  if (range === 0) return 0.5;

  const raw = hib ? (value - p25) / range : (p25 - value) / range;

  return Math.max(0, Math.min(1, raw));
}

// ============================================================================
// 1. Benchmark Alignment Check
// ============================================================================

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
  const kpi: ESOKPINode | undefined = ALL_ESO_KPIS.find(
    (k) => k.id === metricId,
  );
  if (!kpi) {
    return {
      aligned: false,
      percentile: "unknown",
      warning: `Unknown metric: ${metricId}`,
    };
  }

  const { p25, p75 } = kpi.benchmarks;
  const higherIsBetter = kpi.improvementDirection === "higher_is_better";
  const percentile = resolvePercentile(kpi, claimedValue);

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

// ============================================================================
// 2. Severity Classification
// ============================================================================

/**
 * Classify a claimed value into a severity band rather than binary pass/fail.
 * Provides granular feedback for agent reasoning.
 */
export function classifyClaimSeverity(
  metricId: string,
  claimedValue: number,
): { severity: ClaimSeverity; percentile: string; detail: string } {
  const kpi = ALL_ESO_KPIS.find((k) => k.id === metricId);
  if (!kpi) {
    return {
      severity: "implausible",
      percentile: "unknown",
      detail: `Unknown metric: ${metricId}`,
    };
  }

  const { p25, p75, worldClass } = kpi.benchmarks;
  const hib = kpi.improvementDirection === "higher_is_better";
  const percentile = resolvePercentile(kpi, claimedValue);
  const iqr = Math.abs(p75 - p25);
  const fence = hib ? p75 + iqr * 1.5 : p25 - iqr * 1.5;

  const beyondFence = hib ? claimedValue > fence : claimedValue < fence;
  const atWorldClass =
    worldClass != null &&
    (hib ? claimedValue >= worldClass : claimedValue <= worldClass);
  const aboveP75 = hib ? claimedValue >= p75 : claimedValue <= p25;
  const inIqr = hib
    ? claimedValue >= p25 && claimedValue <= p75
    : claimedValue >= p75 && claimedValue <= p25;

  let severity: ClaimSeverity;
  let detail: string;

  if (beyondFence) {
    severity = "implausible";
    detail = `Value ${claimedValue} exceeds the statistical fence (${fence.toFixed(2)}). This claim requires extraordinary evidence.`;
  } else if (atWorldClass) {
    severity = "aspirational";
    detail = `Value ${claimedValue} is at or beyond world-class (${worldClass}). Achievable but rare — only top ~5% of organizations.`;
  } else if (aboveP75 && !inIqr) {
    severity = "optimistic";
    detail = `Value ${claimedValue} is above p75 (${p75}). Top-quartile performance — ambitious but attainable.`;
  } else {
    severity = "plausible";
    detail = `Value ${claimedValue} falls within the interquartile range (${p25}–${p75}). Well-grounded claim.`;
  }

  return { severity, percentile, detail };
}

// ============================================================================
// 3. Improvement Feasibility Scoring
// ============================================================================

const PERCENTILE_BANDS = [
  "below_p25",
  "p25-p50",
  "p50-p75",
  "p75+",
  "world_class",
] as const;

function bandIndex(percentile: string): number {
  const idx = PERCENTILE_BANDS.indexOf(
    percentile as (typeof PERCENTILE_BANDS)[number],
  );
  return idx >= 0 ? idx : 0;
}

/**
 * Given a current value and a target value for a KPI, assess how feasible
 * the improvement is. Uses percentile distance, causal lag times, and
 * the magnitude of the jump to produce a composite feasibility score.
 */
export function assessImprovementFeasibility(
  metricId: string,
  currentValue: number,
  targetValue: number,
): FeasibilityResult {
  const kpi = ALL_ESO_KPIS.find((k) => k.id === metricId);
  if (!kpi) {
    return {
      feasible: false,
      score: 0,
      percentileJump: 0,
      estimatedMonths: 0,
      riskLevel: "extreme",
      rationale: `Unknown metric: ${metricId}`,
    };
  }

  const currentPercentile = resolvePercentile(kpi, currentValue);
  const targetPercentile = resolvePercentile(kpi, targetValue);
  const percentileJump = Math.abs(
    bandIndex(targetPercentile) - bandIndex(currentPercentile),
  );

  // Magnitude as fraction of IQR
  const iqr = Math.abs(kpi.benchmarks.p75 - kpi.benchmarks.p25);
  const magnitude = iqr > 0 ? Math.abs(targetValue - currentValue) / iqr : 0;

  // Find max lag from upstream edges — improvement needs time to propagate
  const upstreamEdges: ESOEdge[] = EXTENDED_ESO_EDGES.filter(
    (e) => e.targetId === metricId || e.sourceId === metricId,
  );
  const maxLag = upstreamEdges.reduce(
    (max, e) => Math.max(max, e.lagMonths ?? 0),
    0,
  );

  // Base time estimate: 3 months per percentile band + upstream lag
  const estimatedMonths = Math.max(
    3,
    percentileJump * 3 + maxLag + Math.floor(magnitude * 2),
  );

  // Score: penalize large jumps and extreme targets
  const jumpPenalty = percentileJump * 0.15;
  const magnitudePenalty = Math.min(magnitude * 0.2, 0.4);
  const aspirationalPenalty =
    targetPercentile === "world_class" ? 0.15 : 0;
  const score = Math.max(
    0,
    Math.min(1, 1 - jumpPenalty - magnitudePenalty - aspirationalPenalty),
  );

  let riskLevel: FeasibilityResult["riskLevel"];
  if (score >= 0.7) riskLevel = "low";
  else if (score >= 0.5) riskLevel = "moderate";
  else if (score >= 0.3) riskLevel = "high";
  else riskLevel = "extreme";

  const feasible = score >= 0.3;

  const rationale = [
    `Moving ${kpi.name} from ${currentPercentile} to ${targetPercentile} (${percentileJump} band${percentileJump !== 1 ? "s" : ""}).`,
    `Magnitude: ${magnitude.toFixed(1)}× IQR.`,
    maxLag > 0 ? `Upstream effects have up to ${maxLag}-month lag.` : null,
    `Estimated timeline: ~${estimatedMonths} months.`,
    `Risk: ${riskLevel}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    feasible,
    score,
    percentileJump,
    estimatedMonths,
    riskLevel,
    rationale,
  };
}

// ============================================================================
// 4. Composite KPI Health Score
// ============================================================================

/**
 * Score an organization's health across a set of KPIs.
 * Weights are derived from causal edge connectivity (more downstream
 * dependents = higher weight).
 */
export function computeCompositeHealth(
  metrics: Array<{ metricId: string; value: number }>,
): CompositeHealthResult {
  // Build connectivity weights from causal graph
  const connectivityCount = new Map<string, number>();
  for (const edge of EXTENDED_ESO_EDGES) {
    connectivityCount.set(
      edge.sourceId,
      (connectivityCount.get(edge.sourceId) ?? 0) + 1,
    );
  }

  const entries: KPIHealthEntry[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const { metricId, value } of metrics) {
    const kpi = ALL_ESO_KPIS.find((k) => k.id === metricId);
    if (!kpi) continue;

    const percentile = resolvePercentile(kpi, value);
    const score = normalizeScore(kpi, value);
    const { severity } = classifyClaimSeverity(metricId, value);
    const hib = kpi.improvementDirection === "higher_is_better";
    const gap = hib
      ? Math.max(0, kpi.benchmarks.p75 - value)
      : Math.max(0, value - kpi.benchmarks.p25);

    entries.push({
      metricId,
      name: kpi.name,
      currentPercentile: percentile,
      score,
      severity,
      gap,
    });

    const weight =
      1 + (connectivityCount.get(metricId) ?? 0) * 0.5;
    weightedSum += score * weight;
    totalWeight += weight;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  let grade: CompositeHealthResult["grade"];
  if (overallScore >= 0.8) grade = "A";
  else if (overallScore >= 0.6) grade = "B";
  else if (overallScore >= 0.4) grade = "C";
  else if (overallScore >= 0.2) grade = "D";
  else grade = "F";

  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const strongestKPIs = sorted.slice(0, 3).map((e) => e.metricId);
  const weakestKPIs = sorted
    .slice(-3)
    .reverse()
    .map((e) => e.metricId);

  // Priority: largest gap × connectivity weight
  const improvementPriority = [...entries]
    .map((e) => ({
      metricId: e.metricId,
      priority:
        e.gap * (1 + (connectivityCount.get(e.metricId) ?? 0) * 0.5),
    }))
    .sort((a, b) => b.priority - a.priority)
    .map((e) => e.metricId);

  return {
    overallScore,
    grade,
    entries,
    strongestKPIs,
    weakestKPIs,
    improvementPriority,
  };
}

// ============================================================================
// 5. Confidence Model
// ============================================================================

const SOURCE_YEAR_REGEX = /(\d{4})/;

/**
 * Compute a data-quality-aware confidence score for a benchmark.
 * Factors: source tier, data freshness, sample coverage, and specificity.
 */
export function computeConfidenceScore(
  kpi: ESOKPINode,
  overrides?: Partial<ConfidenceFactors>,
): ConfidenceScore {
  // Infer freshness from source string (e.g. "OpenView 2024")
  const yearMatch = SOURCE_YEAR_REGEX.exec(kpi.benchmarks.source);
  const sourceYear = yearMatch?.[1]
    ? parseInt(yearMatch[1], 10)
    : 2023;
  const currentYear = 2026; // pinned for reproducibility
  const freshnessYears = currentYear - sourceYear;

  const factors: ConfidenceFactors = {
    sourceTier: overrides?.sourceTier ?? 2,
    dataFreshnessYears: overrides?.dataFreshnessYears ?? freshnessYears,
    sampleSize: overrides?.sampleSize ?? "medium",
    industrySpecific: overrides?.industrySpecific ?? false,
    sizeAdjusted: overrides?.sizeAdjusted ?? false,
  };

  // Base confidence by source tier: 1 → 0.95, 2 → 0.85, 3 → 0.70
  const tierScore =
    factors.sourceTier === 1
      ? 0.95
      : factors.sourceTier === 2
        ? 0.85
        : 0.7;

  // Freshness decay: -0.05 per year beyond 1
  const freshnessPenalty = Math.max(
    0,
    (factors.dataFreshnessYears - 1) * 0.05,
  );

  // Sample size bonus/penalty
  const sampleModifier =
    factors.sampleSize === "large"
      ? 0.05
      : factors.sampleSize === "small"
        ? -0.1
        : factors.sampleSize === "unknown"
          ? -0.15
          : 0;

  // Specificity bonuses
  const specificityBonus =
    (factors.industrySpecific ? 0.05 : 0) +
    (factors.sizeAdjusted ? 0.03 : 0);

  const value = Math.max(
    0,
    Math.min(
      1,
      tierScore - freshnessPenalty + sampleModifier + specificityBonus,
    ),
  );

  const parts: string[] = [];
  parts.push(
    `Source tier ${factors.sourceTier} (base ${tierScore.toFixed(2)})`,
  );
  if (freshnessPenalty > 0)
    parts.push(`freshness penalty -${freshnessPenalty.toFixed(2)}`);
  if (sampleModifier !== 0)
    parts.push(
      `sample size ${sampleModifier > 0 ? "+" : ""}${sampleModifier.toFixed(2)}`,
    );
  if (specificityBonus > 0)
    parts.push(`specificity bonus +${specificityBonus.toFixed(2)}`);

  return {
    value,
    factors,
    explanation: `Confidence ${value.toFixed(2)}: ${parts.join(", ")}.`,
  };
}
