/**
 * Industry Benchmark Module - Tier 3 Contextual Intelligence
 *
 * Provides industry benchmarks, wage data, and productivity metrics from:
 * - U.S. Census Bureau (Economic Census)
 * - Bureau of Labor Statistics (BLS)
 * - Industry research firms (Gartner, IDC, McKinsey)
 *
 * Tier 3 classification: Contextual data for comparison and validation.
 * Not used for direct financial assertions but for benchmarking and analysis.
 *
 * Node Mapping: [NODE: Industry_Benchmark_Module], [NODE: Tier_3_Narrative]
 */

import { logger } from "../../lib/logger.js";
import { BaseModule } from "../core/BaseModule.js";
import { LiveDataFeedService } from "../services/LiveDataFeedService.js";
import {
  ErrorCodes,
  FinancialMetric,
  GroundTruthError,
  IndustryBenchmark,
  ModuleRequest,
  ModuleResponse,
  WageData,
} from "../types/index.js";

import { EXPANDED_INDUSTRY_BENCHMARKS } from "./ExpandedIndustryBenchmarks.js";


interface BenchmarkConfig {
  blsApiKey?: string;
  censusApiKey?: string;
  enableStaticData: boolean; // Use embedded benchmark data
  cacheTTL: number; // Cache time in seconds (benchmarks change infrequently)
}

export type LiveSource = "sec" | "bls" | "census";
export interface DataProvenance {
  source: LiveSource;
  timestamp: string;
  dataPoints: number;
  lastUpdated: string;
  refreshInterval: string;
  confidence: number;
  qualityScore: number;
}

/**
 * Industry Benchmark Module - Tier 3 Contextual Data
 *
 * Provides industry-wide benchmarks for comparative analysis
 * Used in Value Driver Tree calculations and productivity gap analysis
 */
export class IndustryBenchmarkModule extends BaseModule {
  name = "industry-benchmark";
  tier = "tier3" as const;
  description = "Industry benchmarks and wage data - Tier 3 contextual intelligence";

  private blsApiKey?: string;
  private censusApiKey?: string;
  private secApiKey?: string;
  private enableStaticData: boolean = true;
  private cacheTTL: number = 86400 * 30; // 30 days default
  private benchmarkCache: Map<string, { data: any; timestamp: number }> = new Map();
  private liveDataFeed?: LiveDataFeedService;

  // Comprehensive Industry Benchmarks (2024 data) - 50 Industries
  // In production, this would be regularly updated from authoritative sources
  private readonly STATIC_BENCHMARKS: Record<string, IndustryBenchmark[]> = Object.entries(
    EXPANDED_INDUSTRY_BENCHMARKS
  ).reduce(
    (acc, [naics, data]: [string, any]) => {
      const benchmarks: IndustryBenchmark[] = [];

      // Convert the expanded format to IndustryBenchmark format
      Object.entries(data.metrics).forEach(([metricName, metricData]: [string, any]) => {
        const benchmark: IndustryBenchmark = {
          naics_code: data.naics_code,
          industry_name: data.industry_name,
          metric_name: metricName,
          value: (metricData as any).value,
          unit: (metricData as any).unit,
          year: data.year,
          source: (metricData as any).source,
        };

        if ("percentile" in metricData) {
          benchmark.percentile = (metricData as any).percentile;
        }

        benchmarks.push(benchmark);
      });

      acc[naics] = benchmarks;
      return acc;
    },
    {} as Record<string, IndustryBenchmark[]>
  );

  // Static wage data by occupation (2024 BLS data)
  private readonly STATIC_WAGE_DATA: Record<string, WageData> = {
    // Software Developers
    "15-1252": {
      occupation_code: "15-1252",
      occupation_title: "Software Developers",
      median_wage: 120000,
      mean_wage: 130000,
      percentile_10: 75000,
      percentile_25: 95000,
      percentile_75: 155000,
      percentile_90: 185000,
      employment_count: 1847900,
      year: 2024,
    },

    // Data Scientists
    "15-2051": {
      occupation_code: "15-2051",
      occupation_title: "Data Scientists",
      median_wage: 103500,
      mean_wage: 108020,
      percentile_10: 61070,
      percentile_25: 77680,
      percentile_75: 133360,
      percentile_90: 167040,
      employment_count: 168200,
      year: 2024,
    },

    // Sales Representatives (Technical)
    "41-4011": {
      occupation_code: "41-4011",
      occupation_title: "Sales Representatives, Wholesale and Manufacturing, Technical",
      median_wage: 85000,
      mean_wage: 95000,
      percentile_10: 50000,
      percentile_25: 65000,
      percentile_75: 115000,
      percentile_90: 145000,
      employment_count: 300000,
      year: 2024,
    },

    // Marketing Managers
    "11-2021": {
      occupation_code: "11-2021",
      occupation_title: "Marketing Managers",
      median_wage: 140000,
      mean_wage: 153440,
      percentile_10: 77680,
      percentile_25: 100950,
      percentile_75: 191760,
      percentile_90: 239200,
      employment_count: 316800,
      year: 2024,
    },
  };

  override async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);

    const benchmarkConfig = config as BenchmarkConfig;
    this.blsApiKey = benchmarkConfig.blsApiKey;
    this.censusApiKey = benchmarkConfig.censusApiKey;
    this.secApiKey = (config as any).secApiKey;
    this.enableStaticData = benchmarkConfig.enableStaticData ?? true;
    this.cacheTTL = benchmarkConfig.cacheTTL || this.cacheTTL;

    // Initialize live data feed service
    this.liveDataFeed = new LiveDataFeedService({
      secApiKey: this.secApiKey,
      blsApiKey: this.blsApiKey,
      censusApiKey: this.censusApiKey,
      cacheEnabled: true,
      cacheTTLSeconds: this.cacheTTL,
      maxRetries: 3,
      requestTimeoutMs: 30000,
      enableFallbackToStatic: this.enableStaticData,
    });

    logger.info("Industry Benchmark Module initialized", {
      hasSEC: !!this.secApiKey,
      hasBLS: !!this.blsApiKey,
      hasCensus: !!this.censusApiKey,
      enableStaticData: this.enableStaticData,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle NAICS codes or occupation codes
    return !!(
      (
        request.identifier &&
        (request.identifier.match(/^\d{6}$/) || // NAICS code
          request.identifier.match(/^\d{2}-\d{4}$/))
      ) // SOC occupation code
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    // Basic validation
    if (!request.identifier) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, "Identifier is required");
    }

    const { identifier, metric, options } = request;

    // Determine if identifier is NAICS or occupation code
    const isNAICS = /^\d{6}$/.test(identifier);
    const isOccupation = /^\d{2}-\d{4}$/.test(identifier);

    if (isNAICS) {
      const data = await this.getIndustryBenchmark(identifier, metric);
      return { success: true, data };
    } else if (isOccupation) {
      const data = await this.getWageData(identifier, options?.metro_area);
      return { success: true, data };
    }

    throw new GroundTruthError(
      ErrorCodes.INVALID_REQUEST,
      `Invalid identifier format: ${identifier}`
    );
  }

  /**
   * Get industry benchmarks for a NAICS code
   */
  private async getIndustryBenchmark(naicsCode: string, metric?: string): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `naics:${naicsCode}:${metric || "all"}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug("Industry benchmark cache hit", { naicsCode, metric });
      return this.createMetricFromBenchmark(cached, true);
    }

    // Try static data first
    if (this.enableStaticData && this.STATIC_BENCHMARKS[naicsCode]) {
      const benchmarks = this.STATIC_BENCHMARKS[naicsCode];

      // Filter by metric if specified
      const filtered = metric ? benchmarks.filter((b) => b.metric_name === metric) : benchmarks;

      if (!benchmarks || !filtered || filtered.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No benchmark data for NAICS ${naicsCode}, metric ${metric}`
        );
      }

      const benchmark = filtered[0];
      this.setCachedData(cacheKey, benchmark);

      return this.createMetricFromBenchmark(benchmark, false);
    }

    // Try Census API
    if (this.censusApiKey) {
      try {
        const benchmark = await this.getCensusBenchmark(naicsCode, metric);
        this.setCachedData(cacheKey, benchmark);
        return this.createMetricFromBenchmark(benchmark, false);
      } catch (error) {
        logger.warn("Census API lookup failed", { naicsCode, error });
      }
    }

    throw new GroundTruthError(
      ErrorCodes.NO_DATA_FOUND,
      `No benchmark data available for NAICS ${naicsCode}`
    );
  }

  /**
   * Get wage data for an occupation code
   */
  private async getWageData(occupationCode: string, metroArea?: string): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `wage:${occupationCode}:${metroArea || "national"}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug("Wage data cache hit", { occupationCode, metroArea });
      return this.createMetricFromWageData(cached, true);
    }

    // Try static data first
    if (this.enableStaticData && this.STATIC_WAGE_DATA[occupationCode]) {
      const wageData = this.STATIC_WAGE_DATA[occupationCode];
      this.setCachedData(cacheKey, wageData);

      return this.createMetricFromWageData(wageData, false);
    }

    // Try BLS API
    if (this.blsApiKey) {
      try {
        const wageData = await this.getBLSWageData(occupationCode, metroArea);
        this.setCachedData(cacheKey, wageData);
        return this.createMetricFromWageData(wageData, false);
      } catch (error) {
        logger.warn("BLS API lookup failed", { occupationCode, error });
      }
    }

    throw new GroundTruthError(
      ErrorCodes.NO_DATA_FOUND,
      `No wage data available for occupation ${occupationCode}`
    );
  }

  /**
   * Get all benchmarks for an industry
   */
  async getAllBenchmarks(naicsCode: string): Promise<IndustryBenchmark[]> {
    if (this.enableStaticData && this.STATIC_BENCHMARKS[naicsCode]) {
      return this.STATIC_BENCHMARKS[naicsCode] || [];
    }

    if (this.censusApiKey) {
      // Would fetch from Census API
      // Placeholder implementation
    }

    throw new GroundTruthError(
      ErrorCodes.NO_DATA_FOUND,
      `No benchmarks available for NAICS ${naicsCode}`
    );
  }

  /**
   * Compare company metrics against industry benchmarks
   */
  async compareToIndustry(
    naicsCode: string,
    companyMetrics: Record<string, number>
  ): Promise<
    Record<
      string,
      {
        company_value: number;
        industry_median: number;
        percentile: number;
        delta: number;
        delta_percent: number;
      }
    >
  > {
    const benchmarks = await this.getAllBenchmarks(naicsCode);
    const comparison: Record<string, any> = {};

    for (const [metricName, companyValue] of Object.entries(companyMetrics)) {
      const benchmark = benchmarks.find((b) => b.metric_name === metricName);

      if (benchmark) {
        const industryMedian = Array.isArray(benchmark.value)
          ? (benchmark.value[0] + benchmark.value[1]) / 2
          : benchmark.value;

        const delta = companyValue - industryMedian;
        const deltaPercent = (delta / industryMedian) * 100;

        // Estimate percentile (simplified)
        let percentile = 50;
        if (deltaPercent > 25) percentile = 75;
        else if (deltaPercent > 50) percentile = 90;
        else if (deltaPercent < -25) percentile = 25;
        else if (deltaPercent < -50) percentile = 10;

        comparison[metricName] = {
          company_value: companyValue,
          industry_median: industryMedian,
          percentile,
          delta,
          delta_percent: deltaPercent,
        };
      }
    }

    return comparison;
  }

  /**
   * Calculate productivity metrics for value driver analysis
   */
  async calculateProductivityMetrics(
    naicsCode: string,
    headcount: number,
    revenue: number
  ): Promise<{
    revenue_per_employee: number;
    industry_benchmark: number;
    productivity_gap: number;
    productivity_gap_percent: number;
    potential_value: number;
  }> {
    const benchmarks = await this.getAllBenchmarks(naicsCode);
    const revPerEmpBenchmark = benchmarks.find((b) => b.metric_name === "revenue_per_employee");

    if (!revPerEmpBenchmark) {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        "Revenue per employee benchmark not available"
      );
    }

    const industryBenchmark = Array.isArray(revPerEmpBenchmark.value)
      ? (revPerEmpBenchmark.value[0] + revPerEmpBenchmark.value[1]) / 2
      : revPerEmpBenchmark.value;

    const actualRevPerEmp = revenue / headcount;
    const productivityGap = industryBenchmark - actualRevPerEmp;
    const productivityGapPercent = (productivityGap / industryBenchmark) * 100;
    const potentialValue = productivityGap * headcount;

    return {
      revenue_per_employee: actualRevPerEmp,
      industry_benchmark: industryBenchmark,
      productivity_gap: productivityGap,
      productivity_gap_percent: productivityGapPercent,
      potential_value: potentialValue,
    };
  }

  // ============================================================================
  // External API Integrations (Placeholder Implementations)
  // ============================================================================

  private async getCensusBenchmark(naicsCode: string, metric?: string): Promise<IndustryBenchmark> {
    if (!this.liveDataFeed) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "Live data feed service not initialized"
      );
    }

    try {
      // Get business patterns data for the NAICS code
      const businessData = await this.liveDataFeed.getCensusBusinessPatterns([naicsCode]);

      if (!businessData || businessData.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No Census data available for NAICS ${naicsCode}`
        );
      }

      const data = businessData[0];

      // Convert to IndustryBenchmark format
      const benchmark: IndustryBenchmark = {
        naics_code: data.naicsCode,
        industry_name: data.naicsTitle,
        metric_name: metric || "revenue_per_employee",
        value: data.averageAnnualPay || 0, // Use average annual pay as proxy for revenue per employee
        unit: "usd",
        year: data.year,
        source: "U.S. Census Bureau",
      };

      logger.debug("Census data retrieved", { naicsCode, metric, hasData: true });
      return benchmark;
    } catch (error) {
      logger.warn("Census API lookup failed, falling back to static data", {
        source: "census",
        naicsCode,
        error:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
      });
      throw new GroundTruthError(ErrorCodes.NO_DATA_FOUND, "Census API integration failed");
    }
  }

  private async getBLSWageData(occupationCode: string, metroArea?: string): Promise<WageData> {
    if (!this.liveDataFeed) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        "Live data feed service not initialized"
      );
    }

    try {
      // Get wage data for the occupation code
      const wageData = await this.liveDataFeed.getBLSWageData([occupationCode]);

      if (!wageData || wageData.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No BLS wage data available for occupation ${occupationCode}`
        );
      }

      const data = wageData[0];

      // Convert BLS format to WageData format
      const wageEntry: WageData = {
        occupation_code: data.occupationCode,
        occupation_title: data.occupationTitle,
        median_wage: data.medianWage,
        mean_wage: data.meanWage,
        percentile_10: data.percentile10,
        percentile_25: data.percentile25,
        percentile_75: data.percentile75,
        percentile_90: data.percentile90,
        employment_count: data.employmentCount,
        year: data.year,
        metro_area: data.areaTitle !== "National" ? data.areaTitle : undefined,
      };

      logger.debug("BLS wage data retrieved", { occupationCode, metroArea, hasData: true });
      return wageEntry;
    } catch (error) {
      logger.warn("BLS API lookup failed, falling back to static data", {
        source: "bls",
        occupationCode,
        error:
          error instanceof Error ? { name: error.name, message: error.message } : String(error),
      });
      throw new GroundTruthError(ErrorCodes.NO_DATA_FOUND, "BLS API integration failed");
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createMetricFromBenchmark(
    benchmark: IndustryBenchmark,
    cacheHit: boolean
  ): FinancialMetric {
    return {
      type: "metric",
      tier: "tier2",
      source: benchmark.source,
      timestamp: new Date().toISOString(),
      provenance: {
        source_type: "benchmark",
        extraction_method: "api",
        extracted_at: new Date().toISOString(),
      },
      metric_name: benchmark.metric_name,
      value: benchmark.value,
      unit: benchmark.unit,
      confidence: 0.85,
      metadata: {
        naics_code: benchmark.naics_code,
        industry_name: benchmark.industry_name,
        percentile: benchmark.percentile,
        year: benchmark.year,
        cache_hit: cacheHit,
      },
    };
  }

  private createMetricFromWageData(wageData: WageData, cacheHit: boolean): FinancialMetric {
    return {
      type: "metric",
      tier: "tier2",
      source: "BLS",
      timestamp: new Date().toISOString(),
      provenance: {
        source_type: "benchmark",
        extraction_method: "api",
        extracted_at: new Date().toISOString(),
      },
      metric_name: "wage_data",
      value: wageData.median_wage,
      unit: "USD",
      confidence: 0.85,
      metadata: {
        occupation_code: wageData.occupation_code,
        occupation_title: wageData.occupation_title,
        metro_area: wageData.metro_area,
        mean_wage: wageData.mean_wage,
        percentile_10: wageData.percentile_10,
        percentile_25: wageData.percentile_25,
        percentile_75: wageData.percentile_75,
        percentile_90: wageData.percentile_90,
        employment_count: wageData.employment_count,
        year: wageData.year,
        cache_hit: cacheHit,
      },
    };
  }

  private getCachedData(key: string): any | null {
    const cached = this.benchmarkCache.get(key);

    if (!cached) {
      return null;
    }

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTTL * 1000) {
      this.benchmarkCache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCachedData(key: string, data: any): void {
    this.benchmarkCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  // ============================================================================
  // Data Validation and Quality Scoring
  // ============================================================================

  /**
   * Validate benchmark data quality and completeness
   */
  validateBenchmarkData(naicsCode: string): {
    isValid: boolean;
    qualityScore: number;
    issues: string[];
    completenessScore: number;
  } {
    const benchmarks = this.STATIC_BENCHMARKS[naicsCode];
    const issues: string[] = [];

    if (!benchmarks || benchmarks.length === 0) {
      return {
        isValid: false,
        qualityScore: 0,
        issues: ["No benchmark data available"],
        completenessScore: 0,
      };
    }

    const hasRevenuePerEmployee = benchmarks.some((b) => b.metric_name === "revenue_per_employee");
    const hasMarginMetric = benchmarks.some(
      (b) => b.metric_name === "gross_margin" || b.metric_name === "operating_margin"
    );

    if (!hasRevenuePerEmployee) {
      issues.push("Missing revenue_per_employee metric");
    }
    if (!hasMarginMetric) {
      issues.push("Missing margin metrics (gross or operating)");
    }

    // Check data recency (2024 data expected)
    const outdatedBenchmarks = benchmarks.filter((b) => b.year < 2023);
    if (outdatedBenchmarks.length > 0) {
      issues.push(`${outdatedBenchmarks.length} metrics have outdated data (pre-2023)`);
    }

    // Check for reasonable value ranges
    const invalidValues = benchmarks.filter((b) => {
      if (typeof b.value === "number") {
        return b.value <= 0;
      }
      if (Array.isArray(b.value)) {
        return b.value[0] >= b.value[1] || b.value[0] < 0;
      }
      return false;
    });

    if (invalidValues.length > 0) {
      issues.push(`${invalidValues.length} metrics have invalid value ranges`);
    }

    // Calculate quality score (0-100)
    let qualityScore = 100;
    qualityScore -= issues.length * 15; // Deduct 15 points per issue
    qualityScore -= (outdatedBenchmarks.length / benchmarks.length) * 20; // Deduct based on data age
    qualityScore = Math.max(0, Math.min(100, qualityScore));

    // Calculate completeness score
    const completenessScore =
      benchmarks.length >= 3 ? 100 : benchmarks.length >= 2 ? 75 : benchmarks.length >= 1 ? 50 : 0;

    return {
      isValid: issues.length === 0,
      qualityScore,
      issues,
      completenessScore,
    };
  }

  /**
   * Validate live data feed quality and freshness
   */
  validateLiveDataQuality(
    dataSource: "sec" | "bls" | "census",
    data: any
  ): {
    isValid: boolean;
    qualityScore: number;
    issues: string[];
    dataFreshness: "fresh" | "stale" | "outdated";
    confidence: number;
  } {
    const issues: string[] = [];
    let qualityScore = 100;
    let dataFreshness: "fresh" | "stale" | "outdated" = "fresh";
    let confidence = 0.85; // Base confidence for live data

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    switch (dataSource) {
      case "sec":
        // SEC data validation
        if (data && Array.isArray(data)) {
          if (data.length === 0) {
            issues.push("No SEC filings found");
            qualityScore -= 50;
          }

          // Check data recency
          const latestFiling = data[0];
          if (latestFiling && latestFiling.filingDate) {
            const filingDate = new Date(latestFiling.filingDate);
            const monthsDiff =
              (currentYear - filingDate.getFullYear()) * 12 +
              (currentMonth - (filingDate.getMonth() + 1));

            if (monthsDiff > 12) {
              dataFreshness = "outdated";
              qualityScore -= 30;
              confidence -= 0.2;
            } else if (monthsDiff > 3) {
              dataFreshness = "stale";
              qualityScore -= 15;
              confidence -= 0.1;
            }
          }
        } else {
          issues.push("Invalid SEC data format");
          qualityScore -= 40;
        }
        break;

      case "bls":
        // BLS data validation
        if (data && Array.isArray(data)) {
          if (data.length === 0) {
            issues.push("No BLS data found");
            qualityScore -= 50;
          }

          // Check data recency
          const latestData = data[0];
          if (latestData && latestData.year) {
            if (latestData.year > currentYear) {
              issues.push("Future data year detected");
              qualityScore -= 50;
              confidence -= 0.3;
            } else if (latestData.year === currentYear - 1) {
              dataFreshness = "stale";
              qualityScore -= 15;
              confidence -= 0.1;
            } else if (latestData.year < currentYear - 1) {
              dataFreshness = "outdated";
              qualityScore -= 30;
              confidence -= 0.2;
            }
          }

          // Check data completeness
          const requiredFields = ["medianWage", "meanWage", "employmentCount"];
          const completeness =
            data.reduce((acc: number, item: any) => {
              const presentFields = requiredFields.filter((field) => item[field] != null).length;
              return acc + presentFields / requiredFields.length;
            }, 0) / data.length;

          if (completeness < 0.8) {
            issues.push(`Data completeness: ${(completeness * 100).toFixed(1)}%`);
            qualityScore -= 20;
            confidence -= 0.1;
          }
        } else {
          issues.push("Invalid BLS data format");
          qualityScore -= 40;
        }
        break;

      case "census":
        // Census data validation
        if (data && Array.isArray(data)) {
          if (data.length === 0) {
            issues.push("No Census data found");
            qualityScore -= 50;
          }

          // Census ACS data is typically 1-2 years delayed
          const latestData = data[0];
          if (latestData && latestData.year) {
            if (latestData.year === currentYear - 1) {
              dataFreshness = "stale";
              qualityScore -= 10;
              confidence -= 0.05;
            } else if (latestData.year < currentYear - 1) {
              dataFreshness = "outdated";
              qualityScore -= 25;
              confidence -= 0.15;
            }
          }

          // Check for reasonable data ranges
          data.forEach((item: any, index: number) => {
            if (item.totalPopulation && item.totalPopulation < 0) {
              issues.push(`Invalid population data at index ${index}`);
              qualityScore -= 5;
            }
            if (
              item.medianHouseholdIncome &&
              (item.medianHouseholdIncome < 0 || item.medianHouseholdIncome > 500000)
            ) {
              issues.push(`Suspicious income data at index ${index}`);
              qualityScore -= 5;
            }
          });
        } else {
          issues.push("Invalid Census data format");
          qualityScore -= 40;
        }
        break;
    }

    // Ensure quality score stays within bounds
    qualityScore = Math.max(0, Math.min(100, qualityScore));
    confidence = Math.max(0, Math.min(1, confidence));

    return {
      isValid: issues.length === 0,
      qualityScore,
      issues,
      dataFreshness,
      confidence,
    };
  }

  /**
   * Get data provenance information for auditing
   */
  getDataProvenance(dataSource: LiveSource, data: unknown): DataProvenance {
    // Validate dataSource is one of the expected values
    if (!["sec", "bls", "census"].includes(dataSource)) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        `Invalid data source: ${dataSource}. Must be one of: sec, bls, census`
      );
    }

    const now = new Date().toISOString();
    const dataPoints = Array.isArray(data) ? data.length : 1;

    let refreshInterval: string;
    let confidence: number;
    let qualityScore: number;

    switch (dataSource) {
      case "sec":
        refreshInterval = "Real-time to daily";
        confidence = 0.95;
        qualityScore = this.validateLiveDataQuality("sec", data).qualityScore;
        break;
      case "bls":
        refreshInterval = "Monthly to quarterly";
        confidence = 0.9;
        qualityScore = this.validateLiveDataQuality("bls", data).qualityScore;
        break;
      case "census":
        refreshInterval = "Annual (with 1-2 year delay)";
        confidence = 0.85;
        qualityScore = this.validateLiveDataQuality("census", data).qualityScore;
        break;
      default:
        refreshInterval = "Unknown";
        // Unknown data sources get minimal confidence and a neutral-low quality score
        confidence = 0.25;
        qualityScore = 40;
    }

    return {
      source: dataSource,
      timestamp: now,
      dataPoints,
      lastUpdated: now,
      refreshInterval,
      confidence,
      qualityScore,
    };
  }
}

/**
 * Enhanced compare method with quality scoring
 */
// Create module instance for standalone function
const moduleInstance = new IndustryBenchmarkModule();

async function compareToIndustryWithQuality(
  naicsCode: string,
  companyMetrics: Record<string, number>
): Promise<{
  comparison: Record<string, any>;
  dataQuality: {
    industryQualityScore: number;
    benchmarkCompleteness: number;
    confidenceLevel: "high" | "medium" | "low";
  };
}> {
  const comparison = await moduleInstance.compareToIndustry(naicsCode, companyMetrics);
  const qualityReport = moduleInstance.validateBenchmarkData(naicsCode);

  let confidenceLevel: "high" | "medium" | "low" = "low";
  if (qualityReport.qualityScore >= 80 && qualityReport.completenessScore >= 80) {
    confidenceLevel = "high";
  } else if (qualityReport.qualityScore >= 60 && qualityReport.completenessScore >= 60) {
    confidenceLevel = "medium";
  }

  return {
    comparison,
    dataQuality: {
      industryQualityScore: qualityReport.qualityScore,
      benchmarkCompleteness: qualityReport.completenessScore,
      confidenceLevel,
    },
  };
}
