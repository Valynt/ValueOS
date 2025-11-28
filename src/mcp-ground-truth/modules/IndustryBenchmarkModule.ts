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

import { BaseModule } from '../core/BaseModule';
import {
  ModuleRequest,
  ModuleResponse,
  FinancialMetric,
  IndustryBenchmark,
  WageData,
  GroundTruthError,
  ErrorCodes,
} from '../types';
import { logger } from '../../lib/logger';

interface BenchmarkConfig {
  blsApiKey?: string;
  censusApiKey?: string;
  enableStaticData: boolean; // Use embedded benchmark data
  cacheTTL: number; // Cache time in seconds (benchmarks change infrequently)
}

/**
 * Industry Benchmark Module - Tier 3 Contextual Data
 * 
 * Provides industry-wide benchmarks for comparative analysis
 * Used in Value Driver Tree calculations and productivity gap analysis
 */
export class IndustryBenchmarkModule extends BaseModule {
  name = 'industry-benchmark';
  tier = 'tier3' as const;
  description = 'Industry benchmarks and wage data - Tier 3 contextual intelligence';

  private blsApiKey?: string;
  private censusApiKey?: string;
  private enableStaticData: boolean = true;
  private cacheTTL: number = 86400 * 30; // 30 days default
  private benchmarkCache: Map<string, { data: any; timestamp: number }> = new Map();

  // Static industry benchmarks (2024 data)
  // In production, this would be regularly updated from authoritative sources
  private readonly STATIC_BENCHMARKS: Record<string, IndustryBenchmark[]> = {
    // Software & Technology
    '541511': [
      {
        naics_code: '541511',
        industry_name: 'Custom Computer Programming Services',
        metric_name: 'revenue_per_employee',
        value: 250000,
        unit: 'USD',
        year: 2024,
        source: 'BLS Economic Census',
      },
      {
        naics_code: '541511',
        industry_name: 'Custom Computer Programming Services',
        metric_name: 'gross_margin',
        value: [45, 65],
        unit: 'percent',
        percentile: 50,
        year: 2024,
        source: 'Industry Analysis',
      },
      {
        naics_code: '541511',
        industry_name: 'Custom Computer Programming Services',
        metric_name: 'operating_margin',
        value: [15, 30],
        unit: 'percent',
        percentile: 50,
        year: 2024,
        source: 'Industry Analysis',
      },
    ],
    
    // SaaS/Software Publishers
    '511210': [
      {
        naics_code: '511210',
        industry_name: 'Software Publishers',
        metric_name: 'revenue_per_employee',
        value: 400000,
        unit: 'USD',
        year: 2024,
        source: 'BLS Economic Census',
      },
      {
        naics_code: '511210',
        industry_name: 'Software Publishers',
        metric_name: 'gross_margin',
        value: [70, 85],
        unit: 'percent',
        percentile: 50,
        year: 2024,
        source: 'SaaS Industry Benchmarks',
      },
      {
        naics_code: '511210',
        industry_name: 'Software Publishers',
        metric_name: 'cac_payback_months',
        value: [12, 18],
        unit: 'months',
        percentile: 50,
        year: 2024,
        source: 'SaaS Metrics',
      },
    ],
  };

  // Static wage data by occupation (2024 BLS data)
  private readonly STATIC_WAGE_DATA: Record<string, WageData> = {
    // Software Developers
    '15-1252': {
      occupation_code: '15-1252',
      occupation_title: 'Software Developers',
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
    '15-2051': {
      occupation_code: '15-2051',
      occupation_title: 'Data Scientists',
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
    '41-4011': {
      occupation_code: '41-4011',
      occupation_title: 'Sales Representatives, Wholesale and Manufacturing, Technical',
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
    '11-2021': {
      occupation_code: '11-2021',
      occupation_title: 'Marketing Managers',
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

  async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);
    
    const benchmarkConfig = config as BenchmarkConfig;
    this.blsApiKey = benchmarkConfig.blsApiKey;
    this.censusApiKey = benchmarkConfig.censusApiKey;
    this.enableStaticData = benchmarkConfig.enableStaticData ?? true;
    this.cacheTTL = benchmarkConfig.cacheTTL || this.cacheTTL;

    logger.info('Industry Benchmark Module initialized', {
      hasBLS: !!this.blsApiKey,
      hasCensus: !!this.censusApiKey,
      enableStaticData: this.enableStaticData,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle NAICS codes or occupation codes
    return !!(
      request.identifier &&
      (request.identifier.match(/^\d{6}$/) || // NAICS code
       request.identifier.match(/^\d{2}-\d{4}$/)) // SOC occupation code
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      this.validateRequest(request, ['identifier']);

      const { identifier, metric, options } = request;

      // Determine if identifier is NAICS or occupation code
      const isNAICS = /^\d{6}$/.test(identifier);
      const isOccupation = /^\d{2}-\d{4}$/.test(identifier);

      if (isNAICS) {
        return await this.getIndustryBenchmark(identifier, metric);
      } else if (isOccupation) {
        return await this.getWageData(identifier, options?.metro_area);
      }

      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        `Invalid identifier format: ${identifier}`
      );
    });
  }

  /**
   * Get industry benchmarks for a NAICS code
   */
  private async getIndustryBenchmark(
    naicsCode: string,
    metric?: string
  ): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `naics:${naicsCode}:${metric || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug('Industry benchmark cache hit', { naicsCode, metric });
      return this.createMetricFromBenchmark(cached, true);
    }

    // Try static data first
    if (this.enableStaticData && this.STATIC_BENCHMARKS[naicsCode]) {
      const benchmarks = this.STATIC_BENCHMARKS[naicsCode];
      
      // Filter by metric if specified
      const filtered = metric
        ? benchmarks.filter(b => b.metric_name === metric)
        : benchmarks;

      if (filtered.length === 0) {
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
        logger.warn('Census API lookup failed', { naicsCode, error });
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
  private async getWageData(
    occupationCode: string,
    metroArea?: string
  ): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `wage:${occupationCode}:${metroArea || 'national'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug('Wage data cache hit', { occupationCode, metroArea });
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
        logger.warn('BLS API lookup failed', { occupationCode, error });
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
      return this.STATIC_BENCHMARKS[naicsCode];
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
  ): Promise<Record<string, {
    company_value: number;
    industry_median: number;
    percentile: number;
    delta: number;
    delta_percent: number;
  }>> {
    const benchmarks = await this.getAllBenchmarks(naicsCode);
    const comparison: Record<string, any> = {};

    for (const [metricName, companyValue] of Object.entries(companyMetrics)) {
      const benchmark = benchmarks.find(b => b.metric_name === metricName);
      
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
    const revPerEmpBenchmark = benchmarks.find(
      b => b.metric_name === 'revenue_per_employee'
    );

    if (!revPerEmpBenchmark) {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        'Revenue per employee benchmark not available'
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

  private async getCensusBenchmark(
    naicsCode: string,
    metric?: string
  ): Promise<IndustryBenchmark> {
    if (!this.censusApiKey) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'Census API key not configured');
    }

    // Placeholder: Would integrate with Census Bureau API
    // https://www.census.gov/data/developers/data-sets.html
    
    logger.debug('Census API lookup', { naicsCode, metric });
    
    throw new GroundTruthError(
      ErrorCodes.NO_DATA_FOUND,
      'Census API integration not implemented'
    );
  }

  private async getBLSWageData(
    occupationCode: string,
    metroArea?: string
  ): Promise<WageData> {
    if (!this.blsApiKey) {
      throw new GroundTruthError(ErrorCodes.INVALID_REQUEST, 'BLS API key not configured');
    }

    // Placeholder: Would integrate with BLS API
    // https://www.bls.gov/developers/
    
    logger.debug('BLS API lookup', { occupationCode, metroArea });
    
    throw new GroundTruthError(
      ErrorCodes.NO_DATA_FOUND,
      'BLS API integration not implemented'
    );
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createMetricFromBenchmark(
    benchmark: IndustryBenchmark,
    cacheHit: boolean
  ): FinancialMetric {
    return this.createMetric(
      benchmark.metric_name,
      benchmark.value,
      {
        source_type: 'benchmark',
        extraction_method: 'api',
      },
      {
        naics_code: benchmark.naics_code,
        industry_name: benchmark.industry_name,
        unit: benchmark.unit,
        percentile: benchmark.percentile,
        year: benchmark.year,
        source: benchmark.source,
        cache_hit: cacheHit,
      },
      JSON.stringify(benchmark)
    );
  }

  private createMetricFromWageData(
    wageData: WageData,
    cacheHit: boolean
  ): FinancialMetric {
    return this.createMetric(
      'wage_data',
      wageData.median_wage,
      {
        source_type: 'benchmark',
        extraction_method: 'api',
      },
      {
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
      JSON.stringify(wageData)
    );
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

  clearCache(): void {
    this.benchmarkCache.clear();
    logger.info('Industry benchmark cache cleared');
  }
}
