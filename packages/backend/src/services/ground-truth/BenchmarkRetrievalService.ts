/**
 * BenchmarkRetrievalService
 *
 * Retrieves industry benchmarks as p25/p50/p75/p90 distributions.
 * Supports size-adjusted benchmarks and persona-specific KPI retrieval.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §3
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { ExternalCircuitBreaker } from "../post-v1/ExternalCircuitBreaker.js";
import { getRedisClient } from "../../lib/redisClient.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const BenchmarkDistributionSchema = z.object({
  p25: z.number(),
  p50: z.number(),
  p75: z.number(),
  p90: z.number(),
});

export const BenchmarkSchema = z.object({
  metricId: z.string(),
  metricName: z.string(),
  industry: z.string(),
  companySize: z.enum(["small", "medium", "large", "enterprise"]).optional(),
  distribution: BenchmarkDistributionSchema,
  source: z.string(),
  date: z.string(),
  sampleSize: z.number(),
  confidence: z.number(),
  unit: z.string(),
});

export const BenchmarkQuerySchema = z.object({
  industry: z.string(),
  companySize: z.enum(["small", "medium", "large", "enterprise"]).optional(),
  kpi: z.string(),
  persona: z.enum(["CFO", "CIO", "VP_Ops", "CEO", "VP_Sales"]).optional(),
});

export type BenchmarkDistribution = z.infer<typeof BenchmarkDistributionSchema>;
export type Benchmark = z.infer<typeof BenchmarkSchema>;
export type BenchmarkQuery = z.infer<typeof BenchmarkQuerySchema>;

// ---------------------------------------------------------------------------
// Persona-specific KPI mappings
// ---------------------------------------------------------------------------

const PERSONA_KPIS: Record<string, string[]> = {
  CFO: ["revenue", "net_income", "operating_margin", "cash_flow", "roe", "debt_ratio"],
  CIO: ["it_spend_ratio", "cloud_spend", "digital_revenue", "automation_rate", "uptime"],
  VP_Ops: ["operating_efficiency", "inventory_turnover", "order_fulfillment", "quality_score"],
  CEO: ["revenue_growth", "market_share", "employee_satisfaction", "customer_nps"],
  VP_Sales: ["sales_productivity", "win_rate", "pipeline_velocity", "customer_acquisition_cost"],
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class BenchmarkRetrievalService {
  private static instance: BenchmarkRetrievalService;
  private circuitBreaker: ExternalCircuitBreaker;
  private readonly breakerKey = "external:benchmarks:api";
  private readonly breakerConfig = {
    minimumSamples: 3,
    failureRateThreshold: 0.5,
  };

  // Cache TTLs
  private readonly BENCHMARK_CACHE_TTL_SECONDS = 60 * 60; // 1 hour

  private constructor() {
    this.circuitBreaker = new ExternalCircuitBreaker("benchmarks");
  }

  static getInstance(): BenchmarkRetrievalService {
    if (!BenchmarkRetrievalService.instance) {
      BenchmarkRetrievalService.instance = new BenchmarkRetrievalService();
    }
    return BenchmarkRetrievalService.instance;
  }

  /**
   * Retrieve benchmark for a specific industry and KPI
   */
  async retrieveBenchmark(query: BenchmarkQuery): Promise<Benchmark | null> {
    const cacheKey = this.buildCacheKey(query);

    try {
      // Check cache first
      const redis = await getRedisClient();
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            ...parsed,
            _cache: { hit: true, retrievedAt: new Date().toISOString() },
          } as Benchmark;
        }
      }

      // Fetch from external source with circuit breaker
      const benchmark = await this.fetchBenchmark(query);

      // Cache the result
      if (benchmark && redis) {
        await redis.set(
          cacheKey,
          JSON.stringify(benchmark),
          { EX: this.BENCHMARK_CACHE_TTL_SECONDS }
        );
      }

      return benchmark;
    } catch (error) {
      logger.error("Failed to retrieve benchmark", {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Retrieve multiple benchmarks for an industry
   */
  async retrieveBenchmarksForIndustry(
    industry: string,
    kpis: string[],
    companySize?: BenchmarkQuery["companySize"]
  ): Promise<Benchmark[]> {
    const results = await Promise.all(
      kpis.map((kpi) =>
        this.retrieveBenchmark({ industry, kpi, companySize })
      )
    );

    return results.filter((b): b is Benchmark => b !== null);
  }

  /**
   * Get persona-specific KPI benchmarks
   */
  async retrievePersonaBenchmarks(
    industry: string,
    persona: BenchmarkQuery["persona"],
    companySize?: BenchmarkQuery["companySize"]
  ): Promise<Benchmark[]> {
    const kpis = persona ? PERSONA_KPIS[persona] || [] : [];

    if (kpis.length === 0) {
      logger.warn("No KPIs defined for persona", { persona });
      return [];
    }

    return this.retrieveBenchmarksForIndustry(industry, kpis, companySize);
  }

  /**
   * Get size-adjusted benchmark
   */
  async getSizeAdjustedBenchmark(
    metricId: string,
    industry: string,
    targetSize: BenchmarkQuery["companySize"],
    referenceSize: BenchmarkQuery["companySize"]
  ): Promise<Benchmark | null> {
    const [target, reference] = await Promise.all([
      this.retrieveBenchmark({ industry, kpi: metricId, companySize: targetSize }),
      this.retrieveBenchmark({ industry, kpi: metricId, companySize: referenceSize }),
    ]);

    if (!target || !reference) return target;

    // Apply size adjustment factor based on reference vs target
    const adjustmentFactor = this.computeSizeAdjustment(referenceSize, targetSize);

    return {
      ...target,
      distribution: {
        p25: target.distribution.p25 * adjustmentFactor,
        p50: target.distribution.p50 * adjustmentFactor,
        p75: target.distribution.p75 * adjustmentFactor,
        p90: target.distribution.p90 * adjustmentFactor,
      },
      _adjusted: {
        fromSize: referenceSize,
        toSize: targetSize,
        factor: adjustmentFactor,
      },
    } as Benchmark;
  }

  /**
   * Get circuit breaker status
   */
  getCircuitStatus(): ReturnType<ExternalCircuitBreaker["getMetrics"]> {
    return this.circuitBreaker.getMetrics(this.breakerKey);
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private async fetchBenchmark(query: BenchmarkQuery): Promise<Benchmark | null> {
    return this.circuitBreaker.execute(
      this.breakerKey,
      async () => {
        // In a production implementation, this would call external APIs
        // like McKinsey, Gartner, or industry-specific data providers.
        // For now, we return simulated data based on the query.

        const simulated = this.simulateBenchmarkData(query);
        return simulated;
      },
      {
        config: this.breakerConfig,
        fallback: async (error, state) => {
          logger.warn("Benchmark circuit breaker fallback activated", {
            query,
            breakerState: state,
            error: error.message,
          });
          return Promise.resolve(null) as unknown as Promise<Benchmark>;
        },
      }
    );
  }

  private simulateBenchmarkData(query: BenchmarkQuery): Benchmark {
    // Simulated benchmark data for development/testing
    // In production, this would call real benchmark APIs

    const baseValues: Record<string, { p50: number; unit: string }> = {
      revenue: { p50: 100000000, unit: "USD" },
      net_income: { p50: 10000000, unit: "USD" },
      operating_margin: { p50: 0.15, unit: "percentage" },
      cash_flow: { p50: 25000000, unit: "USD" },
      roe: { p50: 0.12, unit: "percentage" },
      debt_ratio: { p50: 0.4, unit: "percentage" },
      it_spend_ratio: { p50: 0.035, unit: "percentage" },
      cloud_spend: { p50: 5000000, unit: "USD" },
      operating_efficiency: { p50: 0.85, unit: "percentage" },
      revenue_growth: { p50: 0.12, unit: "percentage" },
      sales_productivity: { p50: 500000, unit: "USD/rep" },
    };

    const base = baseValues[query.kpi] || { p50: 100, unit: "count" };

    // Size adjustment
    const sizeMultiplier = this.getSizeMultiplier(query.companySize);

    const p50 = base.p50 * sizeMultiplier;

    return {
      metricId: query.kpi,
      metricName: query.kpi.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      industry: query.industry,
      companySize: query.companySize,
      distribution: {
        p25: p50 * 0.5,
        p50,
        p75: p50 * 1.5,
        p90: p50 * 2.0,
      },
      source: "Simulated Benchmark Provider",
      date: new Date().toISOString().split("T")[0],
      sampleSize: 150 + Math.floor(Math.random() * 100),
      confidence: 0.85,
      unit: base.unit,
    };
  }

  private getSizeMultiplier(size?: BenchmarkQuery["companySize"]): number {
    switch (size) {
      case "small":
        return 0.1;
      case "medium":
        return 0.5;
      case "large":
        return 1.0;
      case "enterprise":
        return 5.0;
      default:
        return 1.0;
    }
  }

  private computeSizeAdjustment(
    from: BenchmarkQuery["companySize"],
    to: BenchmarkQuery["companySize"]
  ): number {
    return this.getSizeMultiplier(to) / this.getSizeMultiplier(from);
  }

  private buildCacheKey(query: BenchmarkQuery): string {
    const parts = ["benchmark", query.industry, query.kpi];
    if (query.companySize) parts.push(query.companySize);
    if (query.persona) parts.push(query.persona);
    return parts.join(":");
  }
}

// Singleton export
export const benchmarkRetrievalService = BenchmarkRetrievalService.getInstance();
