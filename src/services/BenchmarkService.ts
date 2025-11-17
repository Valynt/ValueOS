/**
 * Benchmark Service
 *
 * Manages industry benchmark data for KPI comparison and target setting.
 *
 * Responsibilities:
 * - Import benchmark data from external sources
 * - Compare actual values against industry benchmarks
 * - Provide percentile calculations
 * - Track benchmark data freshness
 * - Support multiple benchmark providers
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { Benchmark, ConfidenceLevel } from '../types/vos';

export interface BenchmarkComparison {
  kpi_name: string;
  actual_value: number;
  unit: string;
  benchmark_p25?: number;
  benchmark_p50?: number;
  benchmark_p75?: number;
  benchmark_p90?: number;
  percentile_rank?: number;
  performance_level: 'below_average' | 'average' | 'above_average' | 'top_performer';
  gap_to_p50?: number;
  gap_to_p75?: number;
}

export interface BenchmarkImportResult {
  success: boolean;
  imported_count: number;
  skipped_count: number;
  errors: string[];
}

export interface BenchmarkProvider {
  name: string;
  url?: string;
  api_key?: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class BenchmarkService {
  private supabase: SupabaseClient;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static percentileCache = new Map<
    string,
    CacheEntry<{ p25?: number; p50?: number; p75?: number; p90?: number }>
  >();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // =====================================================
  // BENCHMARK COMPARISON
  // =====================================================

  async compareToBenchmark(
    kpiName: string,
    actualValue: number,
    unit: string,
    filters: {
      industry: string;
      vertical?: string;
      company_size?: string;
      region?: string;
    }
  ): Promise<BenchmarkComparison> {
    const benchmarks = await this.getBenchmarks({
      kpi_name: kpiName,
      ...filters,
    });

    if (benchmarks.length === 0) {
      return {
        kpi_name: kpiName,
        actual_value: actualValue,
        unit,
        performance_level: 'average',
      };
    }

    const cacheKey = this.getPercentileCacheKey(kpiName, filters);
    let percentiles = this.getCachedPercentiles(cacheKey);

    if (!percentiles) {
      percentiles = this.calculatePercentiles(benchmarks);
      this.setPercentileCache(cacheKey, percentiles);
    }

    const percentileRank = this.calculatePercentileRank(actualValue, benchmarks);

    const performanceLevel = this.determinePerformanceLevel(actualValue, percentiles);

    const gapToP50 = percentiles.p50 ? actualValue - percentiles.p50 : undefined;
    const gapToP75 = percentiles.p75 ? actualValue - percentiles.p75 : undefined;

    return {
      kpi_name: kpiName,
      actual_value: actualValue,
      unit,
      benchmark_p25: percentiles.p25,
      benchmark_p50: percentiles.p50,
      benchmark_p75: percentiles.p75,
      benchmark_p90: percentiles.p90,
      percentile_rank: percentileRank,
      performance_level: performanceLevel,
      gap_to_p50: gapToP50,
      gap_to_p75: gapToP75,
    };
  }

  async compareMultipleKPIs(
    kpis: Array<{ kpi_name: string; actual_value: number; unit: string }>,
    filters: {
      industry: string;
      vertical?: string;
      company_size?: string;
    }
  ): Promise<BenchmarkComparison[]> {
    return Promise.all(
      kpis.map(kpi =>
        this.compareToBenchmark(kpi.kpi_name, kpi.actual_value, kpi.unit, filters)
      )
    );
  }

  // =====================================================
  // BENCHMARK DATA MANAGEMENT
  // =====================================================

  async getBenchmarks(filters: {
    kpi_name?: string;
    industry?: string;
    vertical?: string;
    company_size?: string;
    region?: string;
    pagination?: { page?: number; pageSize?: number };
  }): Promise<Benchmark[]> {
    let query = this.supabase.from('benchmarks').select('*');

    if (filters.kpi_name) {
      query = query.eq('kpi_name', filters.kpi_name);
    }

    if (filters.industry) {
      query = query.eq('industry', filters.industry);
    }

    if (filters.vertical) {
      query = query.eq('vertical', filters.vertical);
    }

    if (filters.company_size) {
      query = query.eq('company_size', filters.company_size);
    }

    if (filters.region) {
      query = query.eq('region', filters.region);
    }

    const page = filters.pagination?.page ?? 1;
    const pageSize = filters.pagination?.pageSize ?? 100;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await query.order('data_date', { ascending: false }).range(from, to);

    if (error) throw error;
    return data || [];
  }

  async createBenchmark(
    benchmark: Omit<Benchmark, 'id' | 'created_at'>
  ): Promise<Benchmark> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .insert(benchmark)
      .select()
      .single();

    if (error) throw error;
    BenchmarkService.invalidatePercentileCache();
    return data;
  }

  async importBenchmarks(
    benchmarks: Array<Omit<Benchmark, 'id' | 'created_at'>>,
    options?: {
      skip_duplicates?: boolean;
      update_existing?: boolean;
    }
  ): Promise<BenchmarkImportResult> {
    const result: BenchmarkImportResult = {
      success: true,
      imported_count: 0,
      skipped_count: 0,
      errors: [],
    };

    for (const benchmark of benchmarks) {
      try {
        if (options?.skip_duplicates) {
          const existing = await this.findDuplicateBenchmark(benchmark);
          if (existing) {
            result.skipped_count++;
            continue;
          }
        }

        await this.createBenchmark(benchmark);
        result.imported_count++;
      } catch (error) {
        result.errors.push(
          `Failed to import benchmark for ${benchmark.kpi_name}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    result.success = result.errors.length === 0;
    BenchmarkService.invalidatePercentileCache();
    return result;
  }

  private async findDuplicateBenchmark(
    benchmark: Omit<Benchmark, 'id' | 'created_at'>
  ): Promise<Benchmark | null> {
    const { data } = await this.supabase
      .from('benchmarks')
      .select('*')
      .eq('kpi_name', benchmark.kpi_name)
      .eq('industry', benchmark.industry || '')
      .eq('vertical', benchmark.vertical || '')
      .eq('company_size', benchmark.company_size || '')
      .eq('region', benchmark.region || '')
      .eq('data_date', benchmark.data_date || '')
      .maybeSingle();

    return data;
  }

  // =====================================================
  // BENCHMARK CALCULATIONS
  // =====================================================

  private calculatePercentiles(benchmarks: Benchmark[]): {
    p25?: number;
    p50?: number;
    p75?: number;
    p90?: number;
  } {
    if (benchmarks.length === 0) return {};

    const predefinedPercentiles = benchmarks.filter(b => b.percentile !== null);

    if (predefinedPercentiles.length >= 3) {
      return {
        p25: predefinedPercentiles.find(b => b.percentile === 25)?.value,
        p50: predefinedPercentiles.find(b => b.percentile === 50)?.value,
        p75: predefinedPercentiles.find(b => b.percentile === 75)?.value,
        p90: predefinedPercentiles.find(b => b.percentile === 90)?.value,
      };
    }

    const values = benchmarks.map(b => b.value).sort((a, b) => a - b);

    return {
      p25: this.percentile(values, 25),
      p50: this.percentile(values, 50),
      p75: this.percentile(values, 75),
      p90: this.percentile(values, 90),
    };
  }

  private percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower];
    }

    const fraction = index - lower;
    return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
  }

  private calculatePercentileRank(value: number, benchmarks: Benchmark[]): number {
    const values = benchmarks.map(b => b.value).sort((a, b) => a - b);

    const belowCount = values.filter(v => v < value).length;
    const equalCount = values.filter(v => v === value).length;

    const rank = ((belowCount + equalCount / 2) / values.length) * 100;

    return Math.round(rank);
  }

  private determinePerformanceLevel(
    actualValue: number,
    percentiles: { p25?: number; p50?: number; p75?: number; p90?: number }
  ): 'below_average' | 'average' | 'above_average' | 'top_performer' {
    if (!percentiles.p50) return 'average';

    if (percentiles.p90 && actualValue >= percentiles.p90) {
      return 'top_performer';
    }

    if (percentiles.p75 && actualValue >= percentiles.p75) {
      return 'above_average';
    }

    if (percentiles.p25 && actualValue >= percentiles.p25) {
      return 'average';
    }

    return 'below_average';
  }

  private getPercentileCacheKey(
    kpiName: string,
    filters: { industry: string; vertical?: string; company_size?: string; region?: string }
  ): string {
    return [
      kpiName,
      filters.industry || '',
      filters.vertical || '',
      filters.company_size || '',
      filters.region || '',
    ].join('|');
  }

  private getCachedPercentiles(
    cacheKey: string
  ): { p25?: number; p50?: number; p75?: number; p90?: number } | null {
    const entry = BenchmarkService.percentileCache.get(cacheKey);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      BenchmarkService.percentileCache.delete(cacheKey);
      return null;
    }

    return entry.data;
  }

  private setPercentileCache(
    cacheKey: string,
    percentiles: { p25?: number; p50?: number; p75?: number; p90?: number }
  ): void {
    BenchmarkService.percentileCache.set(cacheKey, {
      data: percentiles,
      expiresAt: Date.now() + BenchmarkService.CACHE_TTL_MS,
    });
  }

  private static invalidatePercentileCache(): void {
    this.percentileCache.clear();
  }

  // =====================================================
  // DATA FRESHNESS
  // =====================================================

  async checkBenchmarkFreshness(filters: {
    industry: string;
    kpi_name?: string;
  }): Promise<{
    is_fresh: boolean;
    oldest_data_date?: string;
    newest_data_date?: string;
    days_since_update?: number;
  }> {
    const benchmarks = await this.getBenchmarks(filters);

    if (benchmarks.length === 0) {
      return { is_fresh: false };
    }

    const dates = benchmarks
      .map(b => b.data_date)
      .filter((d): d is string => d !== undefined && d !== null)
      .sort();

    if (dates.length === 0) {
      return { is_fresh: false };
    }

    const oldestDate = dates[0];
    const newestDate = dates[dates.length - 1];

    const daysSinceUpdate = Math.floor(
      (new Date().getTime() - new Date(newestDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    const isFresh = daysSinceUpdate < 180;

    return {
      is_fresh: isFresh,
      oldest_data_date: oldestDate,
      newest_data_date: newestDate,
      days_since_update: daysSinceUpdate,
    };
  }

  // =====================================================
  // SEEDING AND TEMPLATES
  // =====================================================

  async seedCommonBenchmarks(): Promise<BenchmarkImportResult> {
    const commonBenchmarks: Array<Omit<Benchmark, 'id' | 'created_at'>> = [
      {
        kpi_hypothesis_id: '',
        kpi_name: 'Customer Acquisition Cost',
        industry: 'SaaS',
        vertical: 'B2B',
        company_size: 'SMB',
        value: 1200,
        unit: 'USD',
        percentile: 50,
        source: 'Industry Standard',
        sample_size: 500,
        data_date: new Date().toISOString().split('T')[0],
        confidence_level: 'medium',
      },
      {
        kpi_hypothesis_id: '',
        kpi_name: 'Customer Lifetime Value',
        industry: 'SaaS',
        vertical: 'B2B',
        company_size: 'SMB',
        value: 15000,
        unit: 'USD',
        percentile: 50,
        source: 'Industry Standard',
        sample_size: 500,
        data_date: new Date().toISOString().split('T')[0],
        confidence_level: 'medium',
      },
      {
        kpi_hypothesis_id: '',
        kpi_name: 'Net Revenue Retention',
        industry: 'SaaS',
        vertical: 'B2B',
        company_size: 'SMB',
        value: 110,
        unit: 'percent',
        percentile: 50,
        source: 'Industry Standard',
        sample_size: 500,
        data_date: new Date().toISOString().split('T')[0],
        confidence_level: 'medium',
      },
      {
        kpi_hypothesis_id: '',
        kpi_name: 'Churn Rate',
        industry: 'SaaS',
        vertical: 'B2B',
        company_size: 'SMB',
        value: 5,
        unit: 'percent',
        percentile: 50,
        source: 'Industry Standard',
        sample_size: 500,
        data_date: new Date().toISOString().split('T')[0],
        confidence_level: 'medium',
      },
    ];

    return this.importBenchmarks(commonBenchmarks, { skip_duplicates: true });
  }

  async getSupportedIndustries(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .select('industry')
      .not('industry', 'is', null);

    if (error) throw error;

    const industries = [...new Set(data?.map(b => b.industry).filter(Boolean))];
    return industries as string[];
  }

  async getSupportedKPIs(industry?: string): Promise<string[]> {
    let query = this.supabase.from('benchmarks').select('kpi_name');

    if (industry) {
      query = query.eq('industry', industry);
    }

    const { data, error } = await query;

    if (error) throw error;

    const kpis = [...new Set(data?.map(b => b.kpi_name))];
    return kpis;
  }
}
