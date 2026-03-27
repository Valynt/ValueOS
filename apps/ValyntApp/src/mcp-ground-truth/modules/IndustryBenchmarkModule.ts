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

import { logger } from '../../lib/logger';
import { BaseModule } from '../core/BaseModule';
import {
  ErrorCodes,
  FinancialMetric,
  GroundTruthError,
  IndustryBenchmark,
  ModuleRequest,
  ModuleResponse,
  WageData,
} from '../types';

interface BenchmarkConfig {
  blsApiKey?: string;
  censusApiKey?: string;
  enableStaticData: boolean; // Use embedded benchmark data
  cacheTTL: number; // Cache time in seconds (benchmarks change infrequently)
}

interface BenchmarkQueryPolicy {
  requireAuthoritativeExternal: boolean;
  allowStaticFallback: boolean;
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
  private benchmarkCache: Map<string, { data: IndustryBenchmark | WageData; timestamp: number }> = new Map();

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

  override async initialize(config: Record<string, unknown>): Promise<void> {
    await super.initialize(config);

    const benchmarkConfig = config as unknown as BenchmarkConfig;
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
      const queryOptions = (options ?? {}) as Record<string, unknown>;
      const policy: BenchmarkQueryPolicy = {
        requireAuthoritativeExternal: Boolean(queryOptions.require_authoritative_external_benchmark),
        allowStaticFallback: queryOptions.allow_static_fallback !== false,
      };

      // Determine if identifier is NAICS or occupation code
      const isNAICS = /^\d{6}$/.test(identifier);
      const isOccupation = /^\d{2}-\d{4}$/.test(identifier);

      if (isNAICS) {
        return await this.getIndustryBenchmark(identifier, metric, policy);
      } else if (isOccupation) {
        return await this.getWageData(
          identifier,
          typeof queryOptions.metro_area === 'string' ? queryOptions.metro_area : undefined,
          policy
        );
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
    metric: string | undefined,
    policy: BenchmarkQueryPolicy
  ): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `naics:${naicsCode}:${metric || 'all'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug('Industry benchmark cache hit', { naicsCode, metric });
      const benchmark = cached as IndustryBenchmark;
      return this.createMetricFromBenchmark(
        benchmark,
        true,
        this.isFallbackBenchmarkSource(benchmark.source),
        'cache'
      );
    }

    // Try static data first
    const staticAllowed = this.enableStaticData && policy.allowStaticFallback && !policy.requireAuthoritativeExternal;
    if (staticAllowed && this.STATIC_BENCHMARKS[naicsCode]) {
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
      if (!benchmark) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No benchmark data for NAICS ${naicsCode}, metric ${metric}`
        );
      }
      this.setCachedData(cacheKey, benchmark);

      return this.createMetricFromBenchmark(benchmark, false, true, 'static');
    }

    // Try Census API
    try {
      const benchmark = await this.getCensusBenchmark(naicsCode, metric);
      this.setCachedData(cacheKey, benchmark);
      return this.createMetricFromBenchmark(benchmark, false, false, 'live_api');
    } catch (error: unknown) {
      const typedError = error instanceof GroundTruthError
        ? error
        : new GroundTruthError(ErrorCodes.UPSTREAM_FAILURE, 'Census provider error', { error });
      logger.warn('Census API lookup failed', { naicsCode, error: typedError.message, code: typedError.code });

      if (typedError.code === ErrorCodes.INVALID_CLASSIFICATION_CODE) {
        throw typedError;
      }

      if (policy.requireAuthoritativeExternal) {
        throw new GroundTruthError(
          ErrorCodes.EVIDENCE_REQUIRED,
          `Authoritative Census benchmark required for NAICS ${naicsCode}, but live lookup failed`,
          { naicsCode, reason: typedError.code, provider: 'census' }
        );
      }

      if (!policy.allowStaticFallback) {
        throw typedError;
      }
    }

    throw new GroundTruthError(
      ErrorCodes.EXTERNAL_NO_DATA,
      `No benchmark data available for NAICS ${naicsCode}`,
      {
        naicsCode,
        provider: 'census',
        staticFallbackAllowed: this.enableStaticData && policy.allowStaticFallback,
      }
    );
  }

  /**
   * Get wage data for an occupation code
   */
  private async getWageData(
    occupationCode: string,
    metroArea: string | undefined,
    policy: BenchmarkQueryPolicy
  ): Promise<FinancialMetric> {
    // Check cache first
    const cacheKey = `wage:${occupationCode}:${metroArea || 'national'}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      logger.debug('Wage data cache hit', { occupationCode, metroArea });
      const wageData = cached as WageData;
      return this.createMetricFromWageData(
        wageData,
        true,
        this.isFallbackWageSource(wageData.source),
        'cache'
      );
    }

    // Try static data first
    const staticAllowed = this.enableStaticData && policy.allowStaticFallback && !policy.requireAuthoritativeExternal;
    if (staticAllowed && this.STATIC_WAGE_DATA[occupationCode]) {
      const wageData = this.STATIC_WAGE_DATA[occupationCode];
      this.setCachedData(cacheKey, wageData);

      return this.createMetricFromWageData(wageData, false, true, 'static');
    }

    // Try BLS API
    try {
      const wageData = await this.getBLSWageData(occupationCode, metroArea);
      this.setCachedData(cacheKey, wageData);
      return this.createMetricFromWageData(wageData, false, false, 'live_api');
    } catch (error: unknown) {
      const typedError = error instanceof GroundTruthError
        ? error
        : new GroundTruthError(ErrorCodes.UPSTREAM_FAILURE, 'BLS provider error', { error });
      logger.warn('BLS API lookup failed', {
        occupationCode,
        metroArea,
        error: typedError.message,
        code: typedError.code,
      });

      if (policy.requireAuthoritativeExternal) {
        throw new GroundTruthError(
          ErrorCodes.EVIDENCE_REQUIRED,
          `Authoritative BLS wage data required for occupation ${occupationCode}, but live lookup failed`,
          { occupationCode, reason: typedError.code, provider: 'bls' }
        );
      }

      if (typedError.code === ErrorCodes.INVALID_CLASSIFICATION_CODE || !policy.allowStaticFallback) {
        throw typedError;
      }
    }

    throw new GroundTruthError(
      ErrorCodes.EXTERNAL_NO_DATA,
      `No wage data available for occupation ${occupationCode}`,
      {
        occupationCode,
        provider: 'bls',
        staticFallbackAllowed: this.enableStaticData && policy.allowStaticFallback,
      }
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
    const comparison: Record<string, {
      company_value: number;
      industry_median: number;
      percentile: number;
      delta: number;
      delta_percent: number;
    }> = {};

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
        if (deltaPercent > 50) percentile = 90;
        else if (deltaPercent > 25) percentile = 75;
        else if (deltaPercent < -50) percentile = 10;
        else if (deltaPercent < -25) percentile = 25;

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
  // External API Integrations
  //
  // Census Bureau API
  //   Docs:    https://www.census.gov/data/developers/data-sets.html
  //   Key env: CENSUS_API_KEY (set in .env.local.example)
  //   Endpoint: https://api.census.gov/data/{year}/cbp
  //   Use case: industry revenue, establishment counts, payroll by NAICS code.
  //
  // BLS API
  //   Docs:    https://www.bls.gov/developers/
  //   Key env: BLS_API_KEY (set in .env.local.example)
  //   Endpoint: https://api.bls.gov/publicAPI/v2/timeseries/data/
  //   Use case: occupation wage percentiles by SOC code and metro area.
  // ============================================================================

  private async getCensusBenchmark(
    naicsCode: string,
    metric?: string
  ): Promise<IndustryBenchmark> {
    if (!this.censusApiKey) {
      throw new GroundTruthError(
        ErrorCodes.MISSING_API_KEY,
        'Census API key not configured. Set CENSUS_API_KEY to enable live benchmark data.',
        { provider: 'census' }
      );
    }

    const year = new Date().getUTCFullYear() - 1;
    const selectedMetric = metric ?? 'revenue_per_employee';
    const fields = selectedMetric === 'payroll_per_employee'
      ? 'PAYANN,EMP,NAICS2017_LABEL'
      : 'RCPTOT,EMP,NAICS2017_LABEL';
    const url = `https://api.census.gov/data/${year}/cbp?get=${encodeURIComponent(fields)}&for=us:1&NAICS2017=${encodeURIComponent(naicsCode)}&key=${encodeURIComponent(this.censusApiKey)}`;

    logger.debug('Census API lookup', { naicsCode, metric: selectedMetric, year });

    // eslint-disable-next-line no-restricted-globals
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 400 || response.status === 422) {
        throw new GroundTruthError(
          ErrorCodes.INVALID_CLASSIFICATION_CODE,
          `Invalid NAICS code ${naicsCode}`,
          { naicsCode, provider: 'census', status: response.status }
        );
      }
      throw new GroundTruthError(
        ErrorCodes.PROVIDER_OUTAGE,
        `Census API returned ${response.status}`,
        { provider: 'census', status: response.status }
      );
    }

    const payload = await response.json() as unknown;
    if (!Array.isArray(payload) || payload.length < 2) {
      throw new GroundTruthError(
        ErrorCodes.EXTERNAL_NO_DATA,
        `No Census data available for NAICS ${naicsCode}`,
        { naicsCode, provider: 'census', year }
      );
    }

    const [headerRow, firstRow] = payload as Array<unknown>;
    if (!Array.isArray(headerRow) || !Array.isArray(firstRow)) {
      throw new GroundTruthError(
        ErrorCodes.PARSE_ERROR,
        'Unexpected Census payload shape',
        { provider: 'census', payload }
      );
    }

    const row = Object.fromEntries(headerRow.map((key, idx) => [String(key), firstRow[idx]])) as Record<string, string>;
    const emp = Number(row.EMP);
    if (!Number.isFinite(emp) || emp <= 0) {
      throw new GroundTruthError(
        ErrorCodes.EXTERNAL_NO_DATA,
        `Census returned no employment data for NAICS ${naicsCode}`,
        { naicsCode, provider: 'census', year }
      );
    }

    const receipts = Number(row.RCPTOT);
    const payroll = Number(row.PAYANN);
    const metricName = selectedMetric === 'payroll_per_employee' || !Number.isFinite(receipts)
      ? 'payroll_per_employee'
      : 'revenue_per_employee';
    const numerator = metricName === 'revenue_per_employee' ? receipts : payroll;

    if (!Number.isFinite(numerator)) {
      throw new GroundTruthError(
        ErrorCodes.EXTERNAL_NO_DATA,
        `Census returned no ${metricName === 'revenue_per_employee' ? 'receipts' : 'payroll'} for NAICS ${naicsCode}`,
        { naicsCode, provider: 'census', year }
      );
    }

    return {
      naics_code: naicsCode,
      industry_name: row.NAICS2017_LABEL || `NAICS ${naicsCode}`,
      metric_name: metricName,
      value: Math.round((numerator * 1000) / emp),
      unit: 'USD',
      year,
      source: 'US Census CBP API',
      percentile: 50,
    };
  }

  private async getBLSWageData(
    occupationCode: string,
    metroArea?: string
  ): Promise<WageData> {
    if (!this.blsApiKey) {
      throw new GroundTruthError(
        ErrorCodes.MISSING_API_KEY,
        'BLS API key not configured. Set BLS_API_KEY to enable live wage data.',
        { provider: 'bls' }
      );
    }

    logger.debug('BLS API lookup', { occupationCode, metroArea });

    const seriesId = `OEUN000000000000000000${occupationCode.replace('-', '')}01`;
    // eslint-disable-next-line no-restricted-globals
    const response = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: [seriesId],
        registrationkey: this.blsApiKey,
        latest: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 422) {
        throw new GroundTruthError(
          ErrorCodes.INVALID_CLASSIFICATION_CODE,
          `Invalid SOC code ${occupationCode}`,
          { occupationCode, provider: 'bls', status: response.status }
        );
      }
      throw new GroundTruthError(
        ErrorCodes.PROVIDER_OUTAGE,
        `BLS API returned ${response.status}`,
        { provider: 'bls', status: response.status }
      );
    }

    const payload = await response.json() as {
      status?: string;
      message?: string[];
      Results?: { series?: Array<{ data?: Array<Record<string, string>> }> };
    };

    if (payload.status !== 'REQUEST_SUCCEEDED') {
      const invalidSeries = (payload.message || []).some((msg) => msg.toLowerCase().includes('invalid'));
      throw new GroundTruthError(
        invalidSeries ? ErrorCodes.INVALID_CLASSIFICATION_CODE : ErrorCodes.PROVIDER_OUTAGE,
        payload.message?.join('; ') || 'BLS request failed',
        { provider: 'bls', occupationCode, message: payload.message }
      );
    }

    const latest = payload.Results?.series?.[0]?.data?.[0];
    if (!latest) {
      throw new GroundTruthError(
        ErrorCodes.EXTERNAL_NO_DATA,
        `No wage data available from BLS for SOC ${occupationCode}`,
        { provider: 'bls', occupationCode }
      );
    }

    const medianWage = Number(latest.median_wage ?? latest.value);
    const meanWage = Number(latest.mean_wage ?? latest.value);
    const year = Number(latest.year);

    if (!Number.isFinite(medianWage) || !Number.isFinite(meanWage) || !Number.isFinite(year)) {
      throw new GroundTruthError(
        ErrorCodes.PARSE_ERROR,
        'Unable to parse BLS wage payload',
        { provider: 'bls', occupationCode, latest }
      );
    }

    return {
      occupation_code: occupationCode,
      occupation_title: latest.occupation_title || `SOC ${occupationCode}`,
      metro_area: metroArea,
      median_wage: medianWage,
      mean_wage: meanWage,
      percentile_10: Number(latest.percentile_10 || latest.p10) || undefined,
      percentile_25: Number(latest.percentile_25 || latest.p25) || undefined,
      percentile_75: Number(latest.percentile_75 || latest.p75) || undefined,
      percentile_90: Number(latest.percentile_90 || latest.p90) || undefined,
      employment_count: Number(latest.employment_count || latest.employment) || undefined,
      year,
      source: 'BLS Public Data API v2',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private createMetricFromBenchmark(
    benchmark: IndustryBenchmark,
    cacheHit: boolean,
    isFallbackData: boolean,
    dataMode: 'static' | 'live_api' | 'cache'
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
        is_fallback_data: isFallbackData,
        data_mode: dataMode,
        authoritative_external: !isFallbackData,
        cache_hit: cacheHit,
      },
      JSON.stringify(benchmark)
    );
  }

  private createMetricFromWageData(
    wageData: WageData,
    cacheHit: boolean,
    isFallbackData: boolean,
    dataMode: 'static' | 'live_api' | 'cache'
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
        source: wageData.source ?? 'Static Wage Benchmark',
        is_fallback_data: isFallbackData,
        data_mode: dataMode,
        authoritative_external: !isFallbackData,
        cache_hit: cacheHit,
      },
      JSON.stringify(wageData)
    );
  }

  private getCachedData(key: string): IndustryBenchmark | WageData | null {
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

  private setCachedData(key: string, data: IndustryBenchmark | WageData): void {
    this.benchmarkCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clearCache(): void {
    this.benchmarkCache.clear();
    logger.info('Industry benchmark cache cleared');
  }

  private isFallbackBenchmarkSource(source: string): boolean {
    return source !== 'US Census CBP API';
  }

  private isFallbackWageSource(source?: string): boolean {
    return source !== 'BLS Public Data API v2';
  }
}
