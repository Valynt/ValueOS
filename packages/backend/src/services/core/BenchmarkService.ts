// Migrated from apps/ValyntApp/src/services/BenchmarkService.ts
// and packages/backend/src/services/BenchmarkService.ts (identical logic, import path differed).
// Canonical location: packages/core-services/src/BenchmarkService.ts
//
// The Benchmark type is inlined here because the service uses an extended shape
// (with data_date, value, kpi_hypothesis_id, confidence_level) that differs from
// the minimal packages/shared/src/domain/ definition.

import { SupabaseClient } from '@supabase/supabase-js';

import { CacheService } from '../CacheService.js';

// ---------------------------------------------------------------------------
// Benchmark domain type (extended shape used by this service)
// ---------------------------------------------------------------------------

export interface Benchmark {
  id: string;
  kpi_hypothesis_id: string;
  kpi_name: string;
  industry: string;
  vertical?: string;
  company_size?: string;
  region?: string;
  value: number;
  unit: string;
  percentile?: number;
  source: string;
  sample_size?: number;
  data_date: string;
  confidence_level?: string;
  created_at?: string;
}

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

type Percentiles = { p25?: number; p50?: number; p75?: number; p90?: number };

export class BenchmarkService {
  private supabase: SupabaseClient;
  private organizationId: string;
  // TTL in seconds for the Redis-backed percentile cache (5 minutes).
  private static readonly CACHE_TTL_SECONDS = 5 * 60;
  // Redis-backed cache shared across all pods. Replaces the previous in-memory
  // Map which was instance-scoped and could not be invalidated cross-pod.
  // organizationId is embedded in every cache key to preserve tenant isolation.
  private readonly percentileCache: CacheService;

  constructor(supabase: SupabaseClient, organizationId: string) {
    if (!organizationId) {
      throw new Error("BenchmarkService requires organizationId — tenant isolation is mandatory");
    }
    this.supabase = supabase;
    this.organizationId = organizationId;
    // Namespace includes organizationId so that clear() only invalidates keys
    // for this tenant, even when called outside a request context where
    // tenantContextStorage has no active store (tid would fall back to "global").
    this.percentileCache = new CacheService(
      `benchmark-percentiles:${organizationId}`,
      BenchmarkService.CACHE_TTL_SECONDS,
    );
  }

  async compareToBenchmark(
    kpiName: string,
    actualValue: number,
    unit: string,
    filters: { industry: string; vertical?: string; company_size?: string; region?: string }
  ): Promise<BenchmarkComparison> {
    const benchmarks = await this.getBenchmarks({ kpi_name: kpiName, ...filters });

    if (benchmarks.length === 0) {
      return { kpi_name: kpiName, actual_value: actualValue, unit, performance_level: 'average' };
    }

    const cacheKey = this.getPercentileCacheKey(kpiName, filters);
    let percentiles = await this.getCachedPercentiles(cacheKey);
    if (!percentiles) {
      percentiles = this.calculatePercentiles(benchmarks);
      await this.setPercentileCache(cacheKey, percentiles);
    }

    return {
      kpi_name: kpiName,
      actual_value: actualValue,
      unit,
      benchmark_p25: percentiles.p25,
      benchmark_p50: percentiles.p50,
      benchmark_p75: percentiles.p75,
      benchmark_p90: percentiles.p90,
      percentile_rank: this.calculatePercentileRank(actualValue, benchmarks),
      performance_level: this.determinePerformanceLevel(actualValue, percentiles),
      gap_to_p50: percentiles.p50 != null ? actualValue - percentiles.p50 : undefined,
      gap_to_p75: percentiles.p75 != null ? actualValue - percentiles.p75 : undefined,
    };
  }

  async compareMultipleKPIs(
    kpis: Array<{ kpi_name: string; actual_value: number; unit: string }>,
    filters: { industry: string; vertical?: string; company_size?: string }
  ): Promise<BenchmarkComparison[]> {
    return Promise.all(kpis.map(k => this.compareToBenchmark(k.kpi_name, k.actual_value, k.unit, filters)));
  }

  async getBenchmarks(filters: {
    kpi_name?: string;
    industry?: string;
    vertical?: string;
    company_size?: string;
    region?: string;
    pagination?: { page?: number; pageSize?: number };
  }): Promise<Benchmark[]> {
    let query = this.supabase.from('benchmarks').select('*')
      .eq('organization_id', this.organizationId);

    if (filters.kpi_name) query = query.eq('kpi_name', filters.kpi_name);
    if (filters.industry) query = query.eq('industry', filters.industry);
    if (filters.vertical) query = query.eq('vertical', filters.vertical);
    if (filters.company_size) query = query.eq('company_size', filters.company_size);
    if (filters.region) query = query.eq('region', filters.region);

    const page = filters.pagination?.page ?? 1;
    const pageSize = filters.pagination?.pageSize ?? 100;
    const from = (page - 1) * pageSize;

    const { data, error } = await query
      .order('data_date', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    return (data ?? []) as Benchmark[];
  }

  async createBenchmark(benchmark: Omit<Benchmark, 'id' | 'created_at'>): Promise<Benchmark> {
    const data = await this.insertBenchmarkRow(benchmark);
    await this.invalidatePercentileCache();
    return data;
  }

  async importBenchmarks(
    benchmarks: Array<Omit<Benchmark, 'id' | 'created_at'>>,
    options?: { skip_duplicates?: boolean }
  ): Promise<BenchmarkImportResult> {
    const result: BenchmarkImportResult = { success: true, imported_count: 0, skipped_count: 0, errors: [] };

    for (const benchmark of benchmarks) {
      try {
        if (options?.skip_duplicates) {
          const existing = await this.findDuplicateBenchmark(benchmark);
          if (existing) { result.skipped_count++; continue; }
        }
        // Use insertBenchmarkRow directly to avoid per-item cache invalidation.
        // A single invalidation is issued after all rows are processed below.
        await this.insertBenchmarkRow(benchmark);
        result.imported_count++;
      } catch (err) {
        result.errors.push(`Failed to import ${benchmark.kpi_name}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    result.success = result.errors.length === 0;
    // Invalidate once after the full import, not once per row.
    await this.invalidatePercentileCache();
    return result;
  }

  /** Inserts a single benchmark row without touching the cache. */
  private async insertBenchmarkRow(benchmark: Omit<Benchmark, 'id' | 'created_at'>): Promise<Benchmark> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .insert({ ...benchmark, organization_id: this.organizationId })
      .select()
      .single();
    if (error) throw error;
    return data as Benchmark;
  }

  private async findDuplicateBenchmark(benchmark: Omit<Benchmark, 'id' | 'created_at'>): Promise<Benchmark | null> {
    const { data } = await this.supabase
      .from('benchmarks')
      .select('*')
      .eq('organization_id', this.organizationId)
      .eq('kpi_name', benchmark.kpi_name)
      .eq('industry', benchmark.industry ?? '')
      .eq('vertical', benchmark.vertical ?? '')
      .eq('company_size', benchmark.company_size ?? '')
      .eq('region', benchmark.region ?? '')
      .eq('data_date', benchmark.data_date ?? '')
      .maybeSingle();
    return data as Benchmark | null;
  }

  private calculatePercentiles(benchmarks: Benchmark[]): Percentiles {
    if (benchmarks.length === 0) return {};

    const predefined = benchmarks.filter(b => b.percentile != null);
    if (predefined.length >= 3) {
      return {
        p25: predefined.find(b => b.percentile === 25)?.value,
        p50: predefined.find(b => b.percentile === 50)?.value,
        p75: predefined.find(b => b.percentile === 75)?.value,
        p90: predefined.find(b => b.percentile === 90)?.value,
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

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    return sorted[lower] * (1 - (index - lower)) + sorted[upper] * (index - lower);
  }

  private calculatePercentileRank(value: number, benchmarks: Benchmark[]): number {
    const values = benchmarks.map(b => b.value).sort((a, b) => a - b);
    const below = values.filter(v => v < value).length;
    const equal = values.filter(v => v === value).length;
    return Math.round(((below + equal / 2) / values.length) * 100);
  }

  private determinePerformanceLevel(value: number, p: Percentiles): BenchmarkComparison['performance_level'] {
    if (!p.p50) return 'average';
    if (p.p90 != null && value >= p.p90) return 'top_performer';
    if (p.p75 != null && value >= p.p75) return 'above_average';
    if (p.p25 != null && value >= p.p25) return 'average';
    return 'below_average';
  }

  private getPercentileCacheKey(kpiName: string, filters: { industry: string; vertical?: string; company_size?: string; region?: string }): string {
    // Tenant isolation is enforced by the CacheService namespace
    // (benchmark-percentiles:{organizationId}), so the key itself only needs
    // to encode the query dimensions.
    return [kpiName, filters.industry, filters.vertical ?? '', filters.company_size ?? '', filters.region ?? ''].join('|');
  }

  private async getCachedPercentiles(key: string): Promise<Percentiles | null> {
    return this.percentileCache.get<Percentiles>(key);
  }

  private async setPercentileCache(key: string, percentiles: Percentiles): Promise<void> {
    await this.percentileCache.set(key, percentiles, {
      ttl: BenchmarkService.CACHE_TTL_SECONDS,
    });
  }

  private async invalidatePercentileCache(): Promise<void> {
    // clear() increments the Redis namespace version counter atomically,
    // making all existing keys unreachable across all pods in O(1).
    await this.percentileCache.clear();
  }

  async checkBenchmarkFreshness(filters: { industry: string; kpi_name?: string }): Promise<{
    is_fresh: boolean;
    oldest_data_date?: string;
    newest_data_date?: string;
    days_since_update?: number;
  }> {
    const benchmarks = await this.getBenchmarks(filters);
    if (benchmarks.length === 0) return { is_fresh: false };

    const dates = benchmarks.map(b => b.data_date).filter(Boolean).sort();
    if (dates.length === 0) return { is_fresh: false };

    const newestDate = dates[dates.length - 1];
    const daysSinceUpdate = Math.floor((Date.now() - new Date(newestDate).getTime()) / (1000 * 60 * 60 * 24));

    return {
      is_fresh: daysSinceUpdate < 180,
      oldest_data_date: dates[0],
      newest_data_date: newestDate,
      days_since_update: daysSinceUpdate,
    };
  }

  async getSupportedIndustries(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .select('industry')
      .eq('organization_id', this.organizationId)
      .not('industry', 'is', null);
    if (error) throw error;
    return [...new Set((data ?? []).map((b: { industry: string }) => b.industry).filter(Boolean))] as string[];
  }

  async getSupportedKPIs(industry?: string): Promise<string[]> {
    let query = this.supabase.from('benchmarks').select('kpi_name')
      .eq('organization_id', this.organizationId);
    if (industry) query = query.eq('industry', industry);
    const { data, error } = await query;
    if (error) throw error;
    return [...new Set((data ?? []).map((b: { kpi_name: string }) => b.kpi_name))];
  }
}
