import { createMCPServer } from "../../../mcp-ground-truth";
import type {
  ClaimSeverity,
  CompanySize,
  ESOIndustry,
} from "../../../types/eso";

// ============================================================================
// Response Types
// ============================================================================

export interface GroundTruthMetric {
  metricId: string;
  name: string;
  value: number;
  unit: string;
  confidence: number;
  source: string;
  benchmarks: {
    p25: number;
    p50: number;
    p75: number;
    worldClass?: number;
  };
}

export interface ValidationResult {
  valid: boolean;
  percentile: string;
  severity: ClaimSeverity;
  detail: string;
  warning?: string;
  benchmark: { p25: number; p50: number; p75: number };
}

export interface FeasibilityResult {
  feasible: boolean;
  score: number;
  percentileJump: number;
  estimatedMonths: number;
  riskLevel: string;
  rationale: string;
}

export interface CompositeHealthResult {
  overallScore: number;
  grade: string;
  entries: Array<{
    metricId: string;
    name: string;
    score: number;
    severity: ClaimSeverity;
    gap: number;
  }>;
  strongestKPIs: string[];
  weakestKPIs: string[];
  improvementPriority: string[];
}

// ============================================================================
// Cache
// ============================================================================

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = 200;

// ============================================================================
// Service
// ============================================================================

export class GroundTruthService {
  private static instance: GroundTruthService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mcpServer: { executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown> } | null = null;
  private cache = new Map<string, CacheEntry<unknown>>();

  private constructor() {}

  public static getInstance(): GroundTruthService {
    if (!GroundTruthService.instance) {
      GroundTruthService.instance = new GroundTruthService();
    }
    return GroundTruthService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.mcpServer) return;

    this.mcpServer = await createMCPServer({
      industryBenchmark: {
        enableStaticData: true,
      },
    }) as { executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown> };
  }

  // --------------------------------------------------------------------------
  // Cache helpers
  // --------------------------------------------------------------------------

  private getCached<T>(key: string): T | undefined {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCached<T>(key: string, value: T): void {
    // Evict oldest entries when at capacity
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  public clearCache(): void {
    this.cache.clear();
  }

  // --------------------------------------------------------------------------
  // Single metric benchmark
  // --------------------------------------------------------------------------

  public async getMetricBenchmark(
    metricId: string,
    industry?: ESOIndustry,
    companySize?: CompanySize,
  ): Promise<GroundTruthMetric | null> {
    const cacheKey = `metric:${metricId}:${industry ?? ""}:${companySize ?? ""}`;
    const cached = this.getCached<GroundTruthMetric>(cacheKey);
    if (cached) return cached;

    await this.initialize();

    try {
      const result = await this.mcpServer!.executeTool(
        "eso_get_metric_value",
        { metricId, industry, companySize },
      );

      if (result?.success && result.data) {
        const d = result.data;
        const metric: GroundTruthMetric = {
          metricId: d.metricId as string,
          name: d.name as string,
          value: d.value as number,
          unit: d.unit as string,
          confidence: (d.confidence as number) ?? 0.85,
          source: d.source as string,
          benchmarks: d.benchmarks as GroundTruthMetric["benchmarks"],
        };
        this.setCached(cacheKey, metric);
        return metric;
      }
    } catch (error) {
      console.error(`Failed to fetch ground truth for metric ${metricId}`, error);
    }

    return null;
  }

  // --------------------------------------------------------------------------
  // Batch metric fetch
  // --------------------------------------------------------------------------

  public async getMetricBenchmarks(
    metricIds: string[],
    industry?: ESOIndustry,
    companySize?: CompanySize,
  ): Promise<Map<string, GroundTruthMetric>> {
    const results = new Map<string, GroundTruthMetric>();
    const promises = metricIds.map(async (id) => {
      const metric = await this.getMetricBenchmark(id, industry, companySize);
      if (metric) results.set(id, metric);
    });
    await Promise.all(promises);
    return results;
  }

  // --------------------------------------------------------------------------
  // Claim validation with severity
  // --------------------------------------------------------------------------

  public async validateClaim(
    metricId: string,
    claimedValue: number,
  ): Promise<ValidationResult | null> {
    await this.initialize();

    try {
      const result = await this.mcpServer!.executeTool(
        "eso_classify_severity",
        { metricId, claimedValue },
      );
      if (result) return result as unknown as ValidationResult;
    } catch (error) {
      console.error(`Failed to validate claim for ${metricId}`, error);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Feasibility assessment
  // --------------------------------------------------------------------------

  public async assessFeasibility(
    metricId: string,
    currentValue: number,
    targetValue: number,
  ): Promise<FeasibilityResult | null> {
    await this.initialize();

    try {
      const result = await this.mcpServer!.executeTool(
        "eso_assess_feasibility",
        { metricId, currentValue, targetValue },
      );
      if (result) return result as unknown as FeasibilityResult;
    } catch (error) {
      console.error(`Failed to assess feasibility for ${metricId}`, error);
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Composite health scoring
  // --------------------------------------------------------------------------

  public async scoreCompositeHealth(
    metrics: Array<{ metricId: string; value: number }>,
  ): Promise<CompositeHealthResult | null> {
    await this.initialize();

    try {
      const result = await this.mcpServer!.executeTool(
        "eso_composite_health",
        { metrics },
      );
      if (result) return result as unknown as CompositeHealthResult;
    } catch (error) {
      console.error("Failed to compute composite health", error);
    }
    return null;
  }
}
