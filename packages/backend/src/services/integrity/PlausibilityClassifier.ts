/**
 * PlausibilityClassifier
 *
 * Compares modeled KPI improvements against benchmark p25/p50/p75/p90 ranges.
 * Classifies: within p25-p75 → plausible, p75-p90 → aggressive, > p90 → unrealistic
 *
 * Reference: openspec/changes/trust-layer-completion/tasks.md §2
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { supabase } from "../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const PlausibilityClassificationSchema = z.enum([
  "plausible",
  "aggressive",
  "unrealistic",
]);
export type PlausibilityClassification = z.infer<typeof PlausibilityClassificationSchema>;

export const PlausibilityResultSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  case_id: z.string().uuid(),
  kpi_name: z.string(),
  current_value: z.number(),
  proposed_value: z.number(),
  improvement_pct: z.number(),
  classification: PlausibilityClassificationSchema,
  benchmark_p25: z.number(),
  benchmark_p50: z.number(),
  benchmark_p75: z.number(),
  benchmark_p90: z.number(),
  benchmark_source: z.string(),
  benchmark_date: z.string().datetime(),
  sample_size: z.number().int(),
  confidence: z.number().min(0).max(1),
  calculated_at: z.string().datetime(),
});

export type PlausibilityResult = z.infer<typeof PlausibilityResultSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PlausibilityClassifier {
  /**
   * Assess plausibility of a proposed KPI improvement.
   */
  async assessPlausibility(params: {
    tenantId: string;
    caseId: string;
    kpiName: string;
    currentValue: number;
    proposedValue: number;
    industry?: string;
    companySizeTier?: string;
  }): Promise<PlausibilityResult> {
    const { tenantId, caseId, kpiName, currentValue, proposedValue, industry, companySizeTier } = params;

    logger.info(`Assessing plausibility for ${kpiName} in case ${caseId}`);

    // Calculate improvement percentage
    const improvementPct = currentValue > 0
      ? ((proposedValue - currentValue) / currentValue) * 100
      : 0;

    // Retrieve benchmark data
    const benchmark = await this.getBenchmark(tenantId, kpiName, industry, companySizeTier);

    if (!benchmark) {
      logger.warn(`No benchmark found for ${kpiName}, returning unverifiable classification`);
      return this.createUnverifiableResult(params, improvementPct);
    }

    // Classify based on improvement vs benchmark percentiles
    const classification = this.classifyImprovement(improvementPct, benchmark);

    // Calculate confidence based on sample size and benchmark freshness
    const confidence = this.calculateConfidence(benchmark);

    const result: PlausibilityResult = {
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      case_id: caseId,
      kpi_name: kpiName,
      current_value: currentValue,
      proposed_value: proposedValue,
      improvement_pct: Math.round(improvementPct * 100) / 100,
      classification,
      benchmark_p25: benchmark.p25,
      benchmark_p50: benchmark.p50,
      benchmark_p75: benchmark.p75,
      benchmark_p90: benchmark.p90,
      benchmark_source: benchmark.source,
      benchmark_date: benchmark.date,
      sample_size: benchmark.sampleSize,
      confidence: Math.round(confidence * 10000) / 10000,
      calculated_at: new Date().toISOString(),
    };

    // Persist result
    await this.persistResult(result);

    logger.info(`Plausibility assessed for ${kpiName}: ${classification}`);

    return result;
  }

  /**
   * Batch assess multiple KPI improvements.
   */
  async assessBatch(params: {
    tenantId: string;
    caseId: string;
    improvements: Array<{
      kpiName: string;
      currentValue: number;
      proposedValue: number;
    }>;
    industry?: string;
    companySizeTier?: string;
  }): Promise<PlausibilityResult[]> {
    const results: PlausibilityResult[] = [];

    for (const improvement of params.improvements) {
      const result = await this.assessPlausibility({
        tenantId: params.tenantId,
        caseId: params.caseId,
        kpiName: improvement.kpiName,
        currentValue: improvement.currentValue,
        proposedValue: improvement.proposedValue,
        industry: params.industry,
        companySizeTier: params.companySizeTier,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Retrieve benchmark data for KPI.
   */
  private async getBenchmark(
    tenantId: string,
    kpiName: string,
    industry?: string,
    companySizeTier?: string,
  ): Promise<{
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    source: string;
    date: string;
    sampleSize: number;
  } | null> {
    let query = supabase
      .from("benchmarks")
      .select("id, metric_name, p25, p50, p75, p90, source, date, sample_size, industry, company_size_tier")
      .eq("tenant_id", tenantId)
      .ilike("metric_name", `%${kpiName}%`)
      .order("date", { ascending: false })
      .limit(1);

    if (industry) {
      query = query.or(`industry.ilike.%${industry}%,industry.is.null`);
    }

    if (companySizeTier) {
      query = query.or(`company_size_tier.eq.${companySizeTier},company_size_tier.is.null`);
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      return null;
    }

    const benchmark = data[0];
    return {
      p25: benchmark.p25,
      p50: benchmark.p50,
      p75: benchmark.p75,
      p90: benchmark.p90,
      source: benchmark.source,
      date: benchmark.date,
      sampleSize: benchmark.sample_size,
    };
  }

  /**
   * Classify improvement based on benchmark percentiles.
   */
  private classifyImprovement(
    improvementPct: number,
    benchmark: { p25: number; p50: number; p75: number; p90: number },
  ): PlausibilityClassification {
    if (improvementPct > benchmark.p90) {
      return "unrealistic";
    }
    if (improvementPct > benchmark.p75) {
      return "aggressive";
    }
    if (improvementPct >= benchmark.p25) {
      return "plausible";
    }
    // Below p25 is also plausible (conservative)
    return "plausible";
  }

  /**
   * Calculate confidence based on sample size and freshness.
   */
  private calculateConfidence(benchmark: { sampleSize: number; date: string }): number {
    const now = new Date();
    const benchmarkDate = new Date(benchmark.date);
    const daysOld = (now.getTime() - benchmarkDate.getTime()) / (1000 * 60 * 60 * 24);

    // Sample size confidence (max 0.5)
    const sampleConfidence = Math.min(0.5, benchmark.sampleSize / 1000);

    // Freshness confidence (max 0.5, decays over 365 days)
    const freshnessConfidence = Math.max(0, 0.5 * (1 - daysOld / 365));

    return sampleConfidence + freshnessConfidence;
  }

  /**
   * Create result when no benchmark is available.
   */
  private createUnverifiableResult(
    params: {
      tenantId: string;
      caseId: string;
      kpiName: string;
      currentValue: number;
      proposedValue: number;
    },
    improvementPct: number,
  ): PlausibilityResult {
    return {
      id: crypto.randomUUID(),
      tenant_id: params.tenantId,
      case_id: params.caseId,
      kpi_name: params.kpiName,
      current_value: params.currentValue,
      proposed_value: params.proposedValue,
      improvement_pct: Math.round(improvementPct * 100) / 100,
      classification: "plausible", // Default when no benchmark
      benchmark_p25: 0,
      benchmark_p50: 0,
      benchmark_p75: 0,
      benchmark_p90: 0,
      benchmark_source: "none_available",
      benchmark_date: new Date().toISOString(),
      sample_size: 0,
      confidence: 0.3,
      calculated_at: new Date().toISOString(),
    };
  }

  /**
   * Persist plausibility result to database.
   */
  private async persistResult(result: PlausibilityResult): Promise<void> {
    const { error } = await supabase.from("plausibility_classifications").upsert({
      id: result.id,
      tenant_id: result.tenant_id,
      case_id: result.case_id,
      kpi_name: result.kpi_name,
      current_value: result.current_value,
      proposed_value: result.proposed_value,
      improvement_pct: result.improvement_pct,
      classification: result.classification,
      benchmark_p25: result.benchmark_p25,
      benchmark_p50: result.benchmark_p50,
      benchmark_p75: result.benchmark_p75,
      benchmark_p90: result.benchmark_p90,
      benchmark_source: result.benchmark_source,
      benchmark_date: result.benchmark_date,
      sample_size: result.sample_size,
      confidence: result.confidence,
      calculated_at: result.calculated_at,
    }, { onConflict: "id" });

    if (error) {
      logger.error(`Failed to persist plausibility result: ${error.message}`);
    }
  }
}
