/**
 * BenchmarkRetrievalService
 *
 * Retrieves industry benchmarks as p25/p50/p75/p90 distributions.
 * Supports size-adjusted benchmarks and persona-specific KPI retrieval.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §3
 */

import { logger } from "../../lib/logger.js";
import { ExternalCircuitBreaker } from "../post-v1/ExternalCircuitBreaker.js";
import { groundTruthCache } from "./GroundTruthCache.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export interface BenchmarkDistribution {
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

export interface Benchmark {
  metric: string;
  metricId: string;
  metricName: string;
  industry: string;
  companySize?: "small" | "medium" | "large" | "enterprise";
  sizeRange?: string;
  distribution: BenchmarkDistribution;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  source: string;
  date: string;
  dateRetrieved: string;
  sampleSize: number;
  confidence: number;
  unit: string;
  isFallback?: boolean;
  isSizeAdjusted?: boolean;
  originalSize?: string;
}

export interface BenchmarkQuery {
  industry: string;
  companySize?: "small" | "medium" | "large" | "enterprise";
  sizeRange?: string;
  kpi?: string;
  metric?: string;
  persona?: "CFO" | "CIO" | "VP_Ops" | "CEO" | "VP_Sales";
}

// ---------------------------------------------------------------------------
// Persona-specific KPI mappings
// ---------------------------------------------------------------------------

const PERSONA_KPIS: Record<string, string[]> = {
  CFO: ["revenue_growth", "gross_margin", "burn_rate", "cash_flow", "roe", "debt_ratio"],
  CIO: ["it_spend", "cloud_adoption", "digital_revenue", "automation_rate", "uptime"],
  VP_Ops: ["cycle_time", "throughput", "inventory_turnover", "quality_score"],
  CEO: ["revenue_growth", "market_share", "employee_satisfaction", "customer_nps"],
  VP_Sales: ["sales_productivity", "win_rate", "pipeline_velocity", "customer_acquisition_cost"],
};

const SIZE_RANGE_TO_COMPANY_SIZE: Record<string, Benchmark["companySize"]> = {
  "$1M-$10M": "medium",
  "$10M-$50M": "large",
  "$50M-$250M": "enterprise",
};

const SIZE_ALIAS_TO_COMPANY_SIZE: Record<string, Benchmark["companySize"]> = {
  startup: "small",
  smb: "small",
  mid_market: "medium",
  medium: "medium",
  large: "large",
  enterprise: "enterprise",
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
    const normalizedQuery = this.normalizeQuery(query);
    const cacheKey = this.buildCacheKey(normalizedQuery);

    try {
      const cached = await groundTruthCache.get<Benchmark | { data: Benchmark }>(cacheKey);
      if (cached) {
        const cachedPayload =
          "data" in cached && cached.data && typeof cached.data === "object" && "metric" in cached.data
            ? (cached.data as Benchmark)
            : "data" in cached && cached.data && typeof cached.data === "object" && "data" in cached.data
              ? (cached.data.data as Benchmark)
              : null;
        if (cachedPayload) {
          return cachedPayload;
        }
      }

      const benchmark = await this.fetchBenchmark(normalizedQuery);

      if (benchmark) {
        await groundTruthCache.set(
          cacheKey,
          { data: benchmark },
          this.BENCHMARK_CACHE_TTL_SECONDS,
        );
      }

      return benchmark;
    } catch (error) {
      logger.error("Failed to retrieve benchmark", {
        query: normalizedQuery,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.createFallbackBenchmark(normalizedQuery);
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
      p25: target.distribution.p25 * adjustmentFactor,
      p50: target.distribution.p50 * adjustmentFactor,
      p75: target.distribution.p75 * adjustmentFactor,
      p90: target.distribution.p90 * adjustmentFactor,
      isSizeAdjusted: true,
      originalSize: referenceSize,
    };
  }

  async getPersonaKPIs(persona: string): Promise<string[]> {
    const normalizedPersona = persona === "VP Ops" ? "VP_Ops" : persona;
    return PERSONA_KPIS[normalizedPersona] ?? ["revenue_growth", "operating_margin", "cash_flow"];
  }

  async adjustBenchmarkForSize(
    benchmark: Benchmark,
    size: string,
  ): Promise<Benchmark> {
    const normalizedSize = this.normalizeCompanySize(size);
    const adjustmentFactor = this.getSizeMultiplier(normalizedSize);

    const p25 = benchmark.p25 * adjustmentFactor;
    const p50 = benchmark.p50 * adjustmentFactor;
    const p75 = benchmark.p75 * adjustmentFactor;
    const p90 = benchmark.p90 * adjustmentFactor;

    return {
      ...benchmark,
      companySize: normalizedSize,
      distribution: { p25, p50, p75, p90 },
      p25,
      p50,
      p75,
      p90,
      isSizeAdjusted: true,
      originalSize: benchmark.companySize ?? benchmark.sizeRange ?? "baseline",
    };
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

  private async fetchBenchmark(query: Required<Pick<BenchmarkQuery, "industry" | "kpi">> & BenchmarkQuery): Promise<Benchmark | null> {
    return this.circuitBreaker.execute(
      this.breakerKey,
      async () => {
        if (this.shouldUseFallbackBenchmark(query)) {
          return this.createFallbackBenchmark(query);
        }

        return this.simulateBenchmarkData(query);
      },
      {
        config: this.breakerConfig,
        fallback: async (error, state) => {
          logger.warn("Benchmark circuit breaker fallback activated", {
            query,
            breakerState: state,
            error: error.message,
          });
          return Promise.resolve(this.createFallbackBenchmark(query));
        },
      }
    );
  }

  private simulateBenchmarkData(
    query: Required<Pick<BenchmarkQuery, "industry" | "kpi">> & BenchmarkQuery
  ): Benchmark {
    const baseValues: Record<string, { p50: number; unit: string }> = {
      arr: { p50: 5_000_000, unit: "USD" },
      revenue: { p50: 100_000_000, unit: "USD" },
      revenue_growth: { p50: 0.12, unit: "percentage" },
      gross_margin: { p50: 0.7, unit: "percentage" },
      burn_rate: { p50: 250_000, unit: "USD/month" },
      net_income: { p50: 10_000_000, unit: "USD" },
      operating_margin: { p50: 0.15, unit: "percentage" },
      cash_flow: { p50: 25_000_000, unit: "USD" },
      roe: { p50: 0.12, unit: "percentage" },
      debt_ratio: { p50: 0.4, unit: "percentage" },
      it_spend: { p50: 0.035, unit: "percentage" },
      cloud_adoption: { p50: 0.6, unit: "percentage" },
      cloud_spend: { p50: 5_000_000, unit: "USD" },
      cycle_time: { p50: 14, unit: "days" },
      throughput: { p50: 120, unit: "units/week" },
      operating_efficiency: { p50: 0.85, unit: "percentage" },
      sales_productivity: { p50: 500_000, unit: "USD/rep" },
    };

    const base = baseValues[query.kpi] || { p50: 100, unit: "count" };
    const sizeMultiplier = this.getSizeMultiplier(query.companySize);
    const p50 = base.p50 * sizeMultiplier;
    const dateRetrieved = new Date().toISOString().split("T")[0];
    const distribution = {
      p25: p50 * 0.5,
      p50,
      p75: p50 * 1.5,
      p90: p50 * 2.0,
    };

    return {
      metric: query.kpi.toUpperCase(),
      metricId: query.kpi,
      metricName: query.kpi.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      industry: query.industry,
      companySize: query.companySize,
      sizeRange: query.sizeRange,
      distribution,
      p25: distribution.p25,
      p50: distribution.p50,
      p75: distribution.p75,
      p90: distribution.p90,
      source: "Simulated Benchmark Provider",
      date: dateRetrieved,
      dateRetrieved,
      sampleSize: 250,
      confidence: 0.85,
      unit: base.unit,
    };
  }

  private createFallbackBenchmark(
    query: Required<Pick<BenchmarkQuery, "industry" | "kpi">> & BenchmarkQuery
  ): Benchmark {
    const benchmark = this.simulateBenchmarkData({
      ...query,
      kpi: query.kpi || "revenue_growth",
      companySize: query.companySize ?? "medium",
    });
    return {
      ...benchmark,
      isFallback: true,
    };
  }

  private shouldUseFallbackBenchmark(
    query: Required<Pick<BenchmarkQuery, "industry" | "kpi">> & BenchmarkQuery
  ): boolean {
    return query.kpi.startsWith("unknown") || query.industry.startsWith("UNKNOWN");
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

  private normalizeCompanySize(size?: string): Benchmark["companySize"] | undefined {
    if (!size) {
      return undefined;
    }

    if (size in SIZE_ALIAS_TO_COMPANY_SIZE) {
      return SIZE_ALIAS_TO_COMPANY_SIZE[size];
    }

    if (size in SIZE_RANGE_TO_COMPANY_SIZE) {
      return SIZE_RANGE_TO_COMPANY_SIZE[size];
    }

    if (size === "small" || size === "medium" || size === "large" || size === "enterprise") {
      return size;
    }

    return undefined;
  }

  private computeSizeAdjustment(
    from: BenchmarkQuery["companySize"],
    to: BenchmarkQuery["companySize"]
  ): number {
    return this.getSizeMultiplier(to) / this.getSizeMultiplier(from);
  }

  private buildCacheKey(query: BenchmarkQuery): string {
    const parts = ["benchmark", query.industry, query.kpi ?? query.metric ?? "unknown"];
    if (query.companySize) parts.push(query.companySize);
    if (query.persona) parts.push(query.persona);
    return parts.join(":");
  }

  private normalizeQuery(
    query: BenchmarkQuery,
  ): Required<Pick<BenchmarkQuery, "industry" | "kpi">> & BenchmarkQuery {
    const kpi = (query.kpi ?? query.metric ?? "revenue_growth").toLowerCase();
    const companySize = this.normalizeCompanySize(query.companySize ?? query.sizeRange);

    return {
      ...query,
      kpi,
      metric: query.metric ?? query.kpi,
      companySize,
      sizeRange: query.sizeRange,
      industry: query.industry,
    };
  }
}

// Singleton export
export const benchmarkRetrievalService = BenchmarkRetrievalService.getInstance();
