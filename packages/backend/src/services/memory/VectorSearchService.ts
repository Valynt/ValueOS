/**
 * Vector Search Service
 *
 * Production-ready service for querying semantic_memory table with pgvector.
 *
 * Features:
 * - Type-safe query methods
 * - Configurable thresholds
 * - Redis-backed shared caching in production
 * - Per-query telemetry for durations, result counts, and cache outcomes
 * - Error handling
 */

import { createHash } from "node:crypto";

import { Counter, Histogram, metrics } from "@opentelemetry/api";
import { logger } from "@shared/lib/logger";
import { getRedisClient } from "@shared/lib/redisClient";
import type { Redis } from "ioredis";

import { getSemanticThreshold, semanticMemoryConfig } from "../config/llm.js";
import { supabase } from "../lib/supabase";

// ============================================================================
// Types
// ============================================================================

export interface SemanticMemory {
  id: string;
  type:
    | "value_proposition"
    | "target_definition"
    | "opportunity"
    | "integrity_check"
    | "workflow_result";
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
  similarity?: number;
}

export type FilterScalar = string | number | boolean | null;
export type FilterRangeValue = string | number;
export type FilterRange = Partial<Record<"gt" | "gte" | "lt" | "lte", FilterRangeValue>>;
export type FilterValue = FilterScalar | FilterScalar[] | FilterRange;
export type SearchFilters = Record<string, FilterValue>;

export interface SearchOptions {
  /** Memory type to filter */
  type?: SemanticMemory["type"];
  /** Similarity threshold (0-1), defaults to type-specific threshold */
  threshold?: number;
  /** Maximum results */
  limit?: number;
  /** Metadata filters */
  filters?: Record<string, unknown>;
  /** Enable caching */
  useCache?: boolean;
  /** Require lineage metadata */
  requireLineage?: boolean;
  /** Explicit tenant scope for cache and query isolation */
  tenantId?: string;
  /** Service name for telemetry correlation */
  callerService?: string;
}

export interface SearchResult {
  memory: SemanticMemory;
  similarity: number;
  lineage?: {
    source_origin?: string;
    data_sensitivity_level?: string;
  };
  evidenceLog?: string;
}

type CacheOutcome = "hit" | "miss" | "bypass";

type NormalizedSearchOptions = {
  callerService: string;
  filters: SearchFilters;
  limit: number;
  organizationId: string | null;
  requireLineage: boolean;
  tenantId: string | null;
  threshold?: number;
  type?: SemanticMemory["type"];
  useCache: boolean;
};

type SearchExecutionContext = {
  cacheKey: string;
  cacheOutcome: CacheOutcome;
  callerService: string;
  effectiveThreshold: number;
  fingerprint: string;
  limit: number;
  organizationId: string | null;
  redisCacheEnabled: boolean;
  rpcFilters: SearchFilters;
  tenantScope: string;
};

type VectorSearchRpcRow = {
  content: string;
  created_at: string;
  embedding: number[];
  id: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
  type: SemanticMemory["type"];
};

// ============================================================================
// Vector Search Service
// ============================================================================

export class VectorSearchService {
  private static readonly CACHE_PREFIX = "vector-search";
  private static readonly CACHE_TTL_SECONDS = 5 * 60;
  private static readonly QUERY_FINGERPRINT_LENGTH = 16;
  private static readonly VALID_TYPES: ReadonlySet<string> = new Set([
    "value_proposition",
    "target_definition",
    "opportunity",
    "integrity_check",
    "workflow_result",
  ]);

  private readonly meter = metrics.getMeter("valueos.vector-search");
  private readonly queryDurationHistogram: Histogram = this.meter.createHistogram(
    "vector_search_query_duration_ms",
    {
      description: "Duration of semantic vector search queries in milliseconds",
      unit: "ms",
    }
  );
  private readonly resultCountHistogram: Histogram = this.meter.createHistogram(
    "vector_search_result_count",
    {
      description: "Number of results returned by semantic vector search queries",
      unit: "{result}",
    }
  );
  private readonly cacheEventsCounter: Counter = this.meter.createCounter(
    "vector_search_cache_events_total",
    {
      description: "Cache hit and miss counts for semantic vector search queries",
      unit: "{event}",
    }
  );

  /**
   * Search semantic memory by query embedding.
   */
  async searchByEmbedding(
    queryEmbedding: number[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const startedAt = Date.now();
    const {
      type,
      limit = semanticMemoryConfig.maxResults,
      useCache = true,
      requireLineage = true,
    } = options;

    try {
      const normalizedOptions = this.normalizeSearchOptions({
        ...options,
        limit,
        requireLineage,
        useCache,
      });
      const effectiveThreshold =
        options.threshold
        ?? (type ? getSemanticThreshold(type) : semanticMemoryConfig.defaultThreshold);
      const embeddingHash = this.hashEmbedding(queryEmbedding);
      const fingerprint = this.buildQueryFingerprint(embeddingHash, normalizedOptions, effectiveThreshold);
      const executionContext: SearchExecutionContext = {
        cacheKey: this.buildCacheKey(embeddingHash, normalizedOptions, effectiveThreshold),
        cacheOutcome: useCache ? "miss" : "bypass",
        callerService: normalizedOptions.callerService,
        effectiveThreshold,
        fingerprint,
        limit,
        organizationId: normalizedOptions.organizationId,
        redisCacheEnabled: this.isRedisCacheEnabled(useCache),
        rpcFilters: normalizedOptions.filters,
        tenantScope: normalizedOptions.tenantId ?? normalizedOptions.organizationId ?? "global",
      };

      if (executionContext.redisCacheEnabled) {
        const cachedResults = await this.getCachedResults(executionContext.cacheKey);
        if (cachedResults) {
          executionContext.cacheOutcome = "hit";
          const duration = Date.now() - startedAt;
          this.recordQueryMetrics(executionContext, cachedResults.length, duration);
          logger.debug("Vector search cache hit", {
            cacheKey: executionContext.cacheKey,
            callerService: executionContext.callerService,
            queryFingerprint: executionContext.fingerprint,
            tenantScope: executionContext.tenantScope,
          });
          return cachedResults;
        }
      }

      const { data, error } = await supabase.rpc("search_semantic_memory_filtered", {
        query_embedding: queryEmbedding,
        match_threshold: effectiveThreshold,
        match_count: limit,
        p_type: type ?? null,
        p_require_lineage: requireLineage,
        p_metadata_filters: executionContext.rpcFilters,
        p_organization_id: executionContext.organizationId,
        p_tenant_id: normalizedOptions.tenantId,
      });

      const duration = Date.now() - startedAt;

      if (error) {
        logger.error("Vector search failed", {
          callerService: executionContext.callerService,
          duration,
          error,
          queryFingerprint: executionContext.fingerprint,
          tenantScope: executionContext.tenantScope,
        });
        throw error;
      }

      const results = this.mapSearchResults((data as VectorSearchRpcRow[] | null) ?? []);

      if (executionContext.redisCacheEnabled) {
        await this.setCachedResults(executionContext.cacheKey, results);
      }

      this.recordQueryMetrics(executionContext, results.length, duration);
      logger.info("Vector search completed", {
        cacheOutcome: executionContext.cacheOutcome,
        callerService: executionContext.callerService,
        duration,
        queryFingerprint: executionContext.fingerprint,
        resultCount: results.length,
        tenantScope: executionContext.tenantScope,
        threshold: effectiveThreshold,
        type,
      });

      return results;
    } catch (error: unknown) {
      logger.error("Vector search error", {
        callerService: options.callerService ?? "unknown",
        error,
        options,
      });
      throw error;
    }
  }

  /**
   * Tenant-scoped semantic search with provenance metadata.
   * All queries filter on tenant_id and return source metadata for RAG retrieval.
   */
  async searchWithTenant(
    queryEmbedding: number[],
    tenantId: string,
    options: Omit<SearchOptions, "filters" | "tenantId"> & {
      minDate?: string;
      sourceUrl?: string;
      tier?: "tier_1_sec" | "tier_2_benchmark" | "tier_3_internal";
    } = {}
  ): Promise<Array<SearchResult & {
    provenance: {
      date: string;
      documentId: string;
      sourceUrl?: string;
      tier: string;
    };
  }>> {
    if (!tenantId) {
      throw new Error("tenantId is required for tenant-scoped search");
    }

    const { tier, sourceUrl, minDate, callerService, ...searchOptions } = options;
    const filters: Record<string, unknown> = {};

    if (tier) {
      filters.tier = tier;
    }

    if (sourceUrl) {
      filters.source_url = sourceUrl;
    }

    if (minDate) {
      filters.date = { gte: minDate };
    }

    const results = await this.searchByEmbedding(queryEmbedding, {
      ...searchOptions,
      callerService: callerService ?? "VectorSearchService.searchWithTenant",
      filters,
      tenantId,
    });

    return results.map((result) => ({
      ...result,
      provenance: {
        tier: (result.memory.metadata.tier as string) || "tier_3_internal",
        sourceUrl: result.memory.metadata.source_url as string | undefined,
        date: (result.memory.metadata.date as string) || result.memory.created_at,
        documentId: (result.memory.metadata.document_id as string) || result.memory.id,
      },
    }));
  }

  /**
   * Search by industry.
   */
  async searchByIndustry(
    queryEmbedding: number[],
    industry: string,
    options: Omit<SearchOptions, "filters"> = {}
  ): Promise<SearchResult[]> {
    return this.searchByEmbedding(queryEmbedding, {
      ...options,
      callerService: options.callerService ?? "VectorSearchService.searchByIndustry",
      filters: { industry },
    });
  }

  /**
   * Search within a specific workflow.
   */
  async searchByWorkflow(
    queryEmbedding: number[],
    workflowId: string,
    options: Omit<SearchOptions, "filters"> = {}
  ): Promise<SearchResult[]> {
    return this.searchByEmbedding(queryEmbedding, {
      ...options,
      callerService: options.callerService ?? "VectorSearchService.searchByWorkflow",
      filters: { workflowId },
    });
  }

  /**
   * Find similar memories to an existing memory.
   */
  async findSimilar(memoryId: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const { data: sourceMemory, error } = await supabase
        .from("semantic_memory")
        .select("embedding, type, organization_id, tenant_id")
        .eq("id", memoryId)
        .single();

      if (error || !sourceMemory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      return this.searchByEmbedding(sourceMemory.embedding as number[], {
        ...options,
        callerService: options.callerService ?? "VectorSearchService.findSimilar",
        filters: {
          ...(options.filters ?? {}),
          organization_id: (sourceMemory.organization_id as string | null) ?? undefined,
        },
        tenantId: options.tenantId ?? (sourceMemory.tenant_id as string | null) ?? undefined,
        type: (options.type ?? sourceMemory.type) as SemanticMemory["type"],
      });
    } catch (error: unknown) {
      logger.error("Find similar memories failed", { error, memoryId });
      throw error;
    }
  }

  /**
   * Check for duplicate or near-duplicate content.
   */
  async checkDuplicate(
    queryEmbedding: number[],
    type: SemanticMemory["type"],
    duplicateThreshold: number = 0.95
  ): Promise<boolean> {
    const results = await this.searchByEmbedding(queryEmbedding, {
      callerService: "VectorSearchService.checkDuplicate",
      threshold: duplicateThreshold,
      limit: 1,
      type,
      useCache: false,
    });

    return results.length > 0;
  }

  /**
   * Get memory statistics scoped to a tenant.
   *
   * Delegates to the `get_semantic_memory_stats` Postgres function which
   * returns total, per-type counts, and a 7-day recent count in a single
   * round-trip. The previous implementation fetched all `type` values and
   * grouped them in JavaScript, transferring O(n) rows for a stats call.
   */
  async getStats(organizationId: string): Promise<{
    total: number;
    byType: Record<string, number>;
    recentCount: number;
  }> {
    if (!organizationId) {
      throw new Error("organizationId is required for tenant-scoped memory stats");
    }

    const { data, error } = await supabase.rpc("get_semantic_memory_stats", {
      p_organization_id: organizationId,
    });

    if (error) {
      logger.error("Failed to get memory stats", { error });
      throw error;
    }

    const result = data as { byType: Record<string, number>; recentCount: number; total: number } | null;

    return {
      total: result?.total ?? 0,
      byType: result?.byType ?? {},
      recentCount: result?.recentCount ?? 0,
    };
  }

  /**
   * Analyze similarity distribution for a query.
   */
  async analyzeSimilarityDistribution(
    queryEmbedding: number[],
    type?: SemanticMemory["type"]
  ): Promise<{
    count: number;
    average: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    distribution: {
      veryHigh: number;
      high: number;
      medium: number;
      low: number;
      veryLow: number;
    };
    recommendedThreshold: number;
  }> {
    try {
      const results = await this.searchByEmbedding(queryEmbedding, {
        callerService: "VectorSearchService.analyzeSimilarityDistribution",
        type,
        threshold: 0.0,
        limit: 100,
        useCache: false,
      });

      if (results.length === 0) {
        throw new Error("No memories found for analysis");
      }

      const similarities = results.map((result) => result.similarity);
      const sorted = similarities.slice().sort((a, b) => b - a);
      const sum = similarities.reduce((accumulator, current) => accumulator + current, 0);
      const average = sum / similarities.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const variance =
        similarities.reduce(
          (accumulator, current) => accumulator + Math.pow(current - average, 2),
          0
        ) / similarities.length;
      const stdDev = Math.sqrt(variance);

      const distribution = {
        veryHigh: similarities.filter((similarity) => similarity >= 0.9).length,
        high: similarities.filter((similarity) => similarity >= 0.8 && similarity < 0.9).length,
        medium: similarities.filter((similarity) => similarity >= 0.7 && similarity < 0.8).length,
        low: similarities.filter((similarity) => similarity >= 0.6 && similarity < 0.7).length,
        veryLow: similarities.filter((similarity) => similarity < 0.6).length,
      };
      const recommendedThreshold = Math.max(0.5, Math.min(0.85, average - stdDev));

      return {
        count: results.length,
        average,
        median: median ?? 0,
        stdDev,
        min: sorted[sorted.length - 1] ?? 0,
        max: sorted[0] ?? 0,
        distribution,
        recommendedThreshold,
      };
    } catch (error: unknown) {
      logger.error("Similarity distribution analysis failed", { error });
      throw error;
    }
  }

  /**
   * Clear shared cache entries only when Redis caching is enabled.
   */
  async clearCache(): Promise<void> {
    if (!this.isRedisCacheEnabled(true)) {
      logger.debug("Vector search cache clear skipped because Redis caching is disabled");
      return;
    }

    const redis = this.getRedis();
    if (!redis) {
      logger.warn("Vector search cache clear skipped because Redis is unavailable");
      return;
    }

    const pattern = `${VectorSearchService.CACHE_PREFIX}:*`;
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");

    logger.debug("Vector search cache cleared", { pattern });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private normalizeSearchOptions(options: Required<Pick<SearchOptions, "limit" | "requireLineage" | "useCache">> & SearchOptions): NormalizedSearchOptions {
    const extractedTenantId = this.normalizeScopeId(options.tenantId);
    const normalizedFilterPayload = this.normalizeFilters(options.filters ?? {});

    return {
      callerService: options.callerService?.trim() || "unknown",
      filters: normalizedFilterPayload.filters,
      limit: options.limit,
      organizationId: normalizedFilterPayload.organizationId,
      requireLineage: options.requireLineage,
      tenantId: extractedTenantId ?? normalizedFilterPayload.tenantId,
      threshold: options.threshold,
      type: options.type,
      useCache: options.useCache,
    };
  }

  private normalizeFilters(filters: Record<string, unknown>): {
    filters: SearchFilters;
    organizationId: string | null;
    tenantId: string | null;
  } {
    let organizationId: string | null = null;
    let tenantId: string | null = null;
    const normalizedEntries: Array<[string, FilterValue]> = [];

    for (const [key, value] of Object.entries(filters).sort(([left], [right]) => left.localeCompare(right))) {
      if (value === undefined) {
        continue;
      }

      if (key === "organization_id") {
        organizationId = this.normalizeScopeId(value);
        continue;
      }

      if (key === "tenant_id") {
        tenantId = this.normalizeScopeId(value);
        continue;
      }

      const normalizedValue = this.normalizeFilterValue(value);
      if (normalizedValue === undefined) {
        logger.warn("Skipping unsupported vector search filter", { key, valueType: typeof value });
        continue;
      }

      normalizedEntries.push([key, normalizedValue]);
    }

    return {
      filters: Object.fromEntries(normalizedEntries),
      organizationId,
      tenantId,
    };
  }

  private normalizeScopeId(value: unknown): string | null {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }

  private normalizeFilterValue(value: unknown): FilterValue | undefined {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (Array.isArray(value)) {
      const normalizedArray = value
        .map((entry) => this.normalizeFilterScalar(entry))
        .filter((entry): entry is FilterScalar => entry !== undefined);
      return normalizedArray;
    }

    if (!this.isPlainObject(value)) {
      return undefined;
    }

    const normalizedRange: FilterRange = {};
    const gt = this.normalizeFilterRangeValue(value.gt);
    const gte = this.normalizeFilterRangeValue(value.gte);
    const lt = this.normalizeFilterRangeValue(value.lt);
    const lte = this.normalizeFilterRangeValue(value.lte);

    if (gt !== undefined) {
      normalizedRange.gt = gt;
    }

    if (gte !== undefined) {
      normalizedRange.gte = gte;
    }

    if (lt !== undefined) {
      normalizedRange.lt = lt;
    }

    if (lte !== undefined) {
      normalizedRange.lte = lte;
    }

    return Object.keys(normalizedRange).length > 0 ? normalizedRange : undefined;
  }

  private normalizeFilterScalar(value: unknown): FilterScalar | undefined {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return value;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    return undefined;
  }

  private normalizeFilterRangeValue(value: unknown): FilterRangeValue | undefined {
    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    return undefined;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private mapSearchResults(rows: VectorSearchRpcRow[]): SearchResult[] {
    return rows.map((row) => {
      const metadata = row.metadata ?? {};
      const lineage = {
        source_origin: metadata.source_origin as string | undefined,
        data_sensitivity_level: metadata.data_sensitivity_level as string | undefined,
      };
      const evidenceLog = lineage.source_origin
        ? `Source: ${lineage.source_origin} (sensitivity: ${lineage.data_sensitivity_level || "unspecified"})`
        : "Lineage unavailable";

      return {
        memory: {
          id: row.id,
          type: row.type,
          content: row.content,
          embedding: row.embedding,
          metadata,
          created_at: row.created_at,
        },
        similarity: row.similarity,
        lineage,
        evidenceLog,
      };
    });
  }

  private buildCacheKey(
    embeddingHash: string,
    normalizedOptions: NormalizedSearchOptions,
    effectiveThreshold: number
  ): string {
    const normalizedPayload = this.stableStringify({
      embeddingHash,
      filters: normalizedOptions.filters,
      limit: normalizedOptions.limit,
      organizationId: normalizedOptions.organizationId,
      requireLineage: normalizedOptions.requireLineage,
      tenantId: normalizedOptions.tenantId,
      threshold: effectiveThreshold,
      type: normalizedOptions.type ?? null,
    });

    return [
      VectorSearchService.CACHE_PREFIX,
      normalizedOptions.tenantId ?? normalizedOptions.organizationId ?? "global",
      this.hashString(normalizedPayload),
    ].join(":");
  }

  private buildQueryFingerprint(
    embeddingHash: string,
    normalizedOptions: NormalizedSearchOptions,
    effectiveThreshold: number
  ): string {
    const normalizedPayload = this.stableStringify({
      callerService: normalizedOptions.callerService,
      embeddingHash,
      filters: normalizedOptions.filters,
      limit: normalizedOptions.limit,
      requireLineage: normalizedOptions.requireLineage,
      threshold: effectiveThreshold,
      type: normalizedOptions.type ?? null,
    });

    return this.hashString(normalizedPayload).slice(0, VectorSearchService.QUERY_FINGERPRINT_LENGTH);
  }

  private stableStringify(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableStringify(entry)).join(",")}]`;
    }

    if (this.isPlainObject(value)) {
      const sortedEntries = Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right));
      return `{${sortedEntries.map(([key, entryValue]) => `${JSON.stringify(key)}:${this.stableStringify(entryValue)}`).join(",")}}`;
    }

    return JSON.stringify(value);
  }

  private hashEmbedding(embedding: number[]): string {
    if (embedding.length === 0) {
      return "empty";
    }

    const buffer = Buffer.from(new Float32Array(embedding).buffer);
    return createHash("sha256").update(buffer).digest("hex").slice(0, 16);
  }

  private hashString(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private isRedisCacheEnabled(useCache: boolean): boolean {
    return useCache && process.env.NODE_ENV === "production" && Boolean(process.env.REDIS_URL);
  }

  private getRedis(): Redis | null {
    try {
      return this.isRedisCacheEnabled(true) ? getRedisClient() : null;
    } catch (error: unknown) {
      logger.warn("Vector search Redis cache unavailable", { error });
      return null;
    }
  }

  private async getCachedResults(cacheKey: string): Promise<SearchResult[] | null> {
    const redis = this.getRedis();
    if (!redis) {
      return null;
    }

    try {
      const cachedValue = await redis.get(cacheKey);
      if (!cachedValue) {
        return null;
      }

      return this.parseCachedResults(cachedValue);
    } catch (error: unknown) {
      logger.warn("Vector search cache read failed", { cacheKey, error });
      return null;
    }
  }

  private async setCachedResults(cacheKey: string, results: SearchResult[]): Promise<void> {
    const redis = this.getRedis();
    if (!redis) {
      return;
    }

    try {
      await redis.setex(cacheKey, VectorSearchService.CACHE_TTL_SECONDS, JSON.stringify(results));
    } catch (error: unknown) {
      logger.warn("Vector search cache write failed", { cacheKey, error });
    }
  }

  private parseCachedResults(cachedValue: string): SearchResult[] | null {
    try {
      const parsed = JSON.parse(cachedValue) as unknown;
      return Array.isArray(parsed) ? (parsed as SearchResult[]) : null;
    } catch (error: unknown) {
      logger.warn("Vector search cache payload could not be parsed", { error });
      return null;
    }
  }

  private recordQueryMetrics(
    executionContext: SearchExecutionContext,
    resultCount: number,
    duration: number
  ): void {
    const attributes = {
      cache_outcome: executionContext.cacheOutcome,
      caller_service: executionContext.callerService,
      query_fingerprint: executionContext.fingerprint,
    };

    this.cacheEventsCounter.add(1, attributes);
    this.queryDurationHistogram.record(duration, attributes);
    this.resultCountHistogram.record(resultCount, attributes);
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const vectorSearchService = new VectorSearchService();
