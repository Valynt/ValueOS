/**
 * Value Fabric Service
 *
 * Manages the canonical Value Fabric ontology - the semantic knowledge layer for VOS.
 *
 * Responsibilities:
 * - Capability catalog management
 * - Use case template library
 * - KPI canonical definitions
 * - Semantic search with pgvector embeddings
 * - Industry domain knowledge
 * - Ontology versioning
 */

import { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";
import { createCounter } from "../../lib/observability/index.js";
import { supabase } from "../../lib/supabase.js";
import type {
  Benchmark,
  Capability,
  UseCase,
  ValueFabricSnapshot,
  VMRTTrace,
} from "../../types/vos";

import { llmProxyClient } from "./LlmProxyClient.js";

export interface SemanticSearchResult<T> {
  item: T;
  similarity: number;
}

export interface OntologyStats {
  total_capabilities: number;
  total_use_cases: number;
  total_kpis: number;
  industries_covered: string[];
  last_updated: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Small bounded LRU with TTL expiry support.
 *
 * Eviction policy:
 * 1. Expired entries are removed first.
 * 2. If at capacity after expiry cleanup, the least-recently used key is evicted.
 */
class BoundedLruCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private metrics: CacheMetrics = { hits: 0, misses: 0, evictions: 0 };

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.metrics.misses += 1;
      return null;
    }

    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      this.metrics.misses += 1;
      return null;
    }

    this.store.delete(key);
    this.store.set(key, entry);
    this.metrics.hits += 1;
    return entry.data;
  }

  set(key: string, value: T, ttlMs: number): boolean {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.evictExpired();
    const evicted = this.evictIfAtCapacity();

    this.store.set(key, {
      data: value,
      expiresAt: Date.now() + ttlMs,
    });

    return evicted;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }

  capacity(): number {
    return this.maxEntries;
  }

  snapshotMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  private evictExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt >= now) {
        continue;
      }

      this.store.delete(key);
      this.metrics.evictions += 1;
    }
  }

  private evictIfAtCapacity(): boolean {
    if (this.store.size < this.maxEntries) {
      return false;
    }

    const oldestKey = this.store.keys().next().value;
    if (typeof oldestKey !== "string") {
      return false;
    }

    this.store.delete(oldestKey);
    this.metrics.evictions += 1;
    return true;
  }
}

export class ValueFabricService {
  private supabase: SupabaseClient;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  /**
   * In-memory cache budget: bounded to avoid unbounded growth under high-cardinality filters.
   *
   * Budget assumptions:
   * - Capability cache: up to 1,000 entries
   * - Use-case cache: up to 750 entries
   * These bounds target a modest process memory footprint while preserving hot-query reuse.
   */
  private static readonly CAPABILITY_CACHE_MAX_ENTRIES = 1000;
  private static readonly USE_CASE_CACHE_MAX_ENTRIES = 750;
  private static capabilityCache = new BoundedLruCache<Capability[]>(
    ValueFabricService.CAPABILITY_CACHE_MAX_ENTRIES,
  );
  private static useCaseCache = new BoundedLruCache<UseCase[]>(
    ValueFabricService.USE_CASE_CACHE_MAX_ENTRIES,
  );

  private static readonly capabilityCacheHits = createCounter(
    "value_fabric_capability_cache_hits_total",
    "Total capability cache hits",
  );
  private static readonly capabilityCacheMisses = createCounter(
    "value_fabric_capability_cache_misses_total",
    "Total capability cache misses",
  );
  private static readonly capabilityCacheEvictions = createCounter(
    "value_fabric_capability_cache_evictions_total",
    "Total capability cache evictions",
  );
  private static readonly useCaseCacheHits = createCounter(
    "value_fabric_use_case_cache_hits_total",
    "Total use case cache hits",
  );
  private static readonly useCaseCacheMisses = createCounter(
    "value_fabric_use_case_cache_misses_total",
    "Total use case cache misses",
  );
  private static readonly useCaseCacheEvictions = createCounter(
    "value_fabric_use_case_cache_evictions_total",
    "Total use case cache evictions",
  );

  constructor(supabaseClient: SupabaseClient = supabase) {
    this.supabase = supabaseClient;
  }

  // =====================================================
  // CAPABILITY MANAGEMENT
  // =====================================================

  async getCapabilities(organizationId: string, filters?: {
    category?: string;
    tags?: string[];
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Capability[]> {
    this.requireOrganizationId(organizationId);
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const cacheKey = JSON.stringify({ organizationId, ...filters, page, pageSize });

    const cached = this.getCachedData(
      ValueFabricService.capabilityCache,
      cacheKey,
      () => ValueFabricService.capabilityCacheHits.inc(),
      () => ValueFabricService.capabilityCacheMisses.inc(),
    );
    if (cached) return cached;

    let query = this.supabase.from("capabilities").select("*")
      .eq("organization_id", organizationId)
      .eq("is_active", true);

    if (filters?.category) {
      query = query.eq("category", filters.category);
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains("tags", filters.tags);
    }

    if (filters?.search) {
      query = query.ilike("name", `%${filters.search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await query.order("name").range(from, to);

    if (error) throw error;
    const capabilities = data || [];
    this.setCachedData(
      ValueFabricService.capabilityCache,
      cacheKey,
      capabilities,
      () => ValueFabricService.capabilityCacheEvictions.inc(),
    );
    return capabilities;
  }

  async getCapabilityById(organizationId: string, id: string): Promise<Capability | null> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase
      .from("capabilities")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createCapability(
    organizationId: string,
    capability: Omit<Capability, "id" | "created_at" | "updated_at">
  ): Promise<Capability> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase
      .from("capabilities")
      .insert({ ...capability, organization_id: organizationId })
      .select()
      .single();

    if (error) throw error;
    ValueFabricService.invalidateCapabilityCache();
    return data;
  }

  async updateCapability(organizationId: string, id: string, updates: Partial<Capability>): Promise<Capability> {
    this.requireOrganizationId(organizationId);
    const { organization_id: _discard, ...safeUpdates } = updates as Record<string, unknown>;
    const { data, error } = await this.supabase
      .from("capabilities")
      .update(safeUpdates)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    ValueFabricService.invalidateCapabilityCache();
    return data;
  }

  // =====================================================
  // USE CASE MANAGEMENT
  // =====================================================

  async getUseCases(organizationId: string, filters?: {
    persona?: string;
    industry?: string;
    is_template?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<UseCase[]> {
    this.requireOrganizationId(organizationId);
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const cacheKey = JSON.stringify({ organizationId, ...filters, page, pageSize });

    const cached = this.getCachedData(
      ValueFabricService.useCaseCache,
      cacheKey,
      () => ValueFabricService.useCaseCacheHits.inc(),
      () => ValueFabricService.useCaseCacheMisses.inc(),
    );
    if (cached) return cached;

    let query = this.supabase.from("use_cases").select("*")
      .eq("organization_id", organizationId);

    if (filters?.persona) {
      query = query.eq("persona", filters.persona);
    }

    if (filters?.industry) {
      query = query.eq("industry", filters.industry);
    }

    if (filters?.is_template !== undefined) {
      query = query.eq("is_template", filters.is_template);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await query.order("name").range(from, to);

    if (error) throw error;
    const useCases = data || [];
    this.setCachedData(
      ValueFabricService.useCaseCache,
      cacheKey,
      useCases,
      () => ValueFabricService.useCaseCacheEvictions.inc(),
    );
    return useCases;
  }

  async getUseCaseById(organizationId: string, id: string): Promise<UseCase | null> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase
      .from("use_cases")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getUseCaseWithCapabilities(organizationId: string, useCaseId: string): Promise<{
    useCase: UseCase;
    capabilities: Capability[];
  }> {
    this.requireOrganizationId(organizationId);
    const { data: useCase, error: useCaseError } = await this.supabase
      .from("use_cases")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", useCaseId)
      .single();

    if (useCaseError) throw useCaseError;

    const { data: capabilityLinks, error: linksError } = await this.supabase
      .from("use_case_capabilities")
      .select("capability_id, relevance_score")
      .eq("use_case_id", useCaseId);

    if (linksError) throw linksError;

    const capabilityIds = capabilityLinks?.map((l) => l.capability_id) || [];

    if (capabilityIds.length === 0) {
      return { useCase, capabilities: [] };
    }

    const { data: capabilities, error: capError } = await this.supabase
      .from("capabilities")
      .select("*")
      .eq("organization_id", organizationId)
      .in("id", capabilityIds);

    if (capError) throw capError;

    return { useCase, capabilities: capabilities || [] };
  }

  async linkCapabilityToUseCase(
    organizationId: string,
    useCaseId: string,
    capabilityId: string,
    relevanceScore: number = 1.0
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    const { error } = await this.supabase.from("use_case_capabilities").insert({
      organization_id: organizationId,
      use_case_id: useCaseId,
      capability_id: capabilityId,
      relevance_score: relevanceScore,
    });

    if (error) throw error;

    ValueFabricService.invalidateUseCaseCache();
  }

  // =====================================================
  // BENCHMARK DATA
  // =====================================================

  async getBenchmarks(organizationId: string, filters: {
    kpi_name?: string;
    industry?: string;
    vertical?: string;
    company_size?: string;
  }): Promise<Benchmark[]> {
    this.requireOrganizationId(organizationId);
    let query = this.supabase.from("benchmarks").select("*")
      .eq("organization_id", organizationId);

    if (filters.kpi_name) {
      query = query.eq("kpi_name", filters.kpi_name);
    }

    if (filters.industry) {
      query = query.eq("industry", filters.industry);
    }

    if (filters.vertical) {
      query = query.eq("vertical", filters.vertical);
    }

    if (filters.company_size) {
      query = query.eq("company_size", filters.company_size);
    }

    const { data, error } = await query.order("data_date", {
      ascending: false,
    });

    if (error) throw error;
    return data || [];
  }

  async getBenchmarkPercentiles(
    organizationId: string,
    kpiName: string,
    industry: string
  ): Promise<{ p25: number; p50: number; p75: number; p90: number } | null> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase
      .from("benchmarks")
      .select("value, percentile")
      .eq("organization_id", organizationId)
      .eq("kpi_name", kpiName)
      .eq("industry", industry)
      .in("percentile", [25, 50, 75, 90]);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const percentiles = data.reduce(
      (acc, row) => {
        if (row.percentile === 25) acc.p25 = row.value;
        if (row.percentile === 50) acc.p50 = row.value;
        if (row.percentile === 75) acc.p75 = row.value;
        if (row.percentile === 90) acc.p90 = row.value;
        return acc;
      },
      { p25: 0, p50: 0, p75: 0, p90: 0 }
    );

    return percentiles;
  }

  async createBenchmark(
    organizationId: string,
    benchmark: Omit<Benchmark, "id" | "created_at">,
    vmrtTrace?: VMRTTrace,
    userId?: string
  ): Promise<Benchmark> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase
      .from("benchmarks")
      .insert({ ...benchmark, organization_id: organizationId })
      .select()
      .single();

    if (error) throw error;

    if (vmrtTrace) {
      await this.logVMRTMetricChange("benchmark", data.id, vmrtTrace, organizationId, userId);
    }

    return data;
  }

  async updateBenchmark(
    organizationId: string,
    id: string,
    updates: Partial<Benchmark>,
    vmrtTrace?: VMRTTrace,
    userId?: string
  ): Promise<Benchmark> {
    this.requireOrganizationId(organizationId);
    const { organization_id: _discard, ...safeUpdates } = updates as Record<string, unknown>;
    const { data, error } = await this.supabase
      .from("benchmarks")
      .update(safeUpdates)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (vmrtTrace) {
      await this.logVMRTMetricChange("benchmark", id, vmrtTrace, organizationId, userId);
    }

    return data;
  }

  // =====================================================
  // SEMANTIC SEARCH (using pgvector)
  // =====================================================

  async semanticSearchCapabilities(
    organizationId: string,
    queryText: string,
    limit: number = 10
  ): Promise<SemanticSearchResult<Capability>[]> {
    this.requireOrganizationId(organizationId);
    const embedding = await this.generateEmbedding(queryText);

    const { data, error } = await this.supabase.rpc("search_capabilities_by_embedding", {
      query_embedding: embedding,
      match_count: limit,
      p_organization_id: organizationId,
    });

    if (error) {
      logger.warn("Semantic search failed, falling back to text search:", { error });
      return this.fallbackTextSearch(organizationId, queryText, limit);
    }

    const semanticResults = (data || []) as SemanticSearchResult<Capability>[];

    if ((semanticResults?.length || 0) >= limit) {
      return semanticResults;
    }

    const existingIds = new Set(semanticResults.map((result) => result.item.id));
    const fallbackResults = await this.fallbackTextSearch(organizationId, queryText, limit);

    for (const result of fallbackResults) {
      if (existingIds.has(result.item.id)) continue;

      semanticResults.push(result);
      existingIds.add(result.item.id);

      if (semanticResults.length >= limit) break;
    }

    return semanticResults;
  }

  private async fallbackTextSearch(
    organizationId: string,
    queryText: string,
    limit: number
  ): Promise<SemanticSearchResult<Capability>[]> {
    const capabilities = await this.getCapabilities(organizationId, { search: queryText });

    return capabilities.slice(0, limit).map((cap) => ({
      item: cap,
      similarity: 0.5,
    }));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    return llmProxyClient.generateEmbedding({
      input: text,
      provider: "together",
    });
  }

  // =====================================================
  // VALUE FABRIC SNAPSHOTS
  // =====================================================

  async getValueFabricSnapshot(organizationId: string, valueCaseId: string): Promise<ValueFabricSnapshot> {
    this.requireOrganizationId(organizationId);
    const [
      businessObjectives,
      valueTrees,
      roiModels,
      valueCommits,
      telemetryData,
      realizationReports,
      expansionModels,
    ] = await Promise.all([
      this.getBusinessObjectives(organizationId, valueCaseId),
      this.getValueTrees(organizationId, valueCaseId),
      this.getROIModels(organizationId, valueCaseId),
      this.getValueCommits(organizationId, valueCaseId),
      this.getTelemetryCount(organizationId, valueCaseId),
      this.getRealizationReports(organizationId, valueCaseId),
      this.getExpansionModels(organizationId, valueCaseId),
    ]);

    const capabilities = await this.getCapabilities(organizationId);
    const useCases = await this.getUseCases(organizationId, { is_template: true });

    const lifecycleStage = this.determineLifecycleStage({
      businessObjectives,
      valueTrees,
      valueCommits,
      realizationReports,
      expansionModels,
    });

    return {
      value_case_id: valueCaseId,
      lifecycle_stage: lifecycleStage,
      business_objectives: businessObjectives,
      capabilities,
      use_cases: useCases,
      value_trees: valueTrees,
      roi_models: roiModels,
      value_commits: valueCommits,
      telemetry_summary: {
        total_events: telemetryData.count,
        kpis_tracked: telemetryData.unique_kpis,
        last_event_timestamp: telemetryData.last_timestamp,
        coverage_percentage: telemetryData.coverage,
      },
      realization_reports: realizationReports,
      expansion_models: expansionModels,
    };
  }

  private async getBusinessObjectives(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("business_objectives")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);
    return data || [];
  }

  private async getValueTrees(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("value_trees")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);
    return data || [];
  }

  async getValueTreeHierarchy(organizationId: string, valueTreeId: string, maxDepth: number = 5): Promise<Record<string, unknown>[]> {
    this.requireOrganizationId(organizationId);
    const { data, error } = await this.supabase.rpc("get_value_tree_hierarchy", {
      value_tree_uuid: valueTreeId,
      max_depth: maxDepth,
      p_organization_id: organizationId,
    });

    if (error) throw error;
    return data || [];
  }

  private async getROIModels(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("roi_models")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_tree_id", valueCaseId);
    return data || [];
  }

  private async getValueCommits(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("value_commits")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);
    return data || [];
  }

  private async getTelemetryCount(organizationId: string, valueCaseId: string): Promise<{
    count: number;
    unique_kpis: number;
    last_timestamp: string | undefined;
    coverage: number;
  }> {
    const { data, count } = await this.supabase
      .from("telemetry_events")
      .select("kpi_hypothesis_id, event_timestamp", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);

    const uniqueKpis = new Set(data?.map((d) => d.kpi_hypothesis_id) || []).size;
    const lastTimestamp = data?.[0]?.event_timestamp;

    return {
      count: count || 0,
      unique_kpis: uniqueKpis,
      last_timestamp: lastTimestamp,
      coverage: 0,
    };
  }

  private async getRealizationReports(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("realization_reports")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);
    return data || [];
  }

  private async getExpansionModels(organizationId: string, valueCaseId: string): Promise<Record<string, unknown>[]> {
    const { data } = await this.supabase
      .from("expansion_models")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("value_case_id", valueCaseId);
    return data || [];
  }

  private determineLifecycleStage(data: {
    businessObjectives: unknown[];
    valueTrees: unknown[];
    valueCommits: unknown[];
    realizationReports: unknown[];
    expansionModels: unknown[];
  }): "opportunity" | "target" | "realization" | "expansion" {
    if (data.expansionModels.length > 0) return "expansion";
    if (data.realizationReports.length > 0) return "realization";
    if (data.valueCommits.length > 0) return "target";
    return "opportunity";
  }

  // =====================================================
  // ONTOLOGY STATISTICS
  // =====================================================

  async getOntologyStats(organizationId: string): Promise<OntologyStats> {
    this.requireOrganizationId(organizationId);
    const [capabilities, useCases, industries] = await Promise.all([
      this.supabase.from("capabilities").select("id", { count: "exact" }).eq("organization_id", organizationId),
      this.supabase.from("use_cases").select("id", { count: "exact" }).eq("organization_id", organizationId),
      this.supabase.from("use_cases").select("industry").eq("organization_id", organizationId),
    ]);

    const uniqueIndustries = [...new Set(industries.data?.map((u) => u.industry).filter(Boolean))];

    return {
      total_capabilities: capabilities.count || 0,
      total_use_cases: useCases.count || 0,
      total_kpis: 0,
      industries_covered: uniqueIndustries as string[],
      last_updated: new Date().toISOString(),
    };
  }

  // =====================================================
  // TEMPLATE INSTANTIATION
  // =====================================================

  async instantiateUseCaseTemplate(
    organizationId: string,
    templateId: string,
    valueCaseId: string
  ): Promise<{ useCase: UseCase; capabilities: Capability[] }> {
    this.requireOrganizationId(organizationId);
    const template = await this.getUseCaseWithCapabilities(organizationId, templateId);

    if (!template.useCase.is_template) {
      throw new Error("Not a template use case");
    }

    const { data: newUseCase, error } = await this.supabase
      .from("use_cases")
      .insert({
        organization_id: organizationId,
        name: template.useCase.name,
        description: template.useCase.description,
        persona: template.useCase.persona,
        industry: template.useCase.industry,
        is_template: false,
      })
      .select()
      .single();

    if (error) throw error;

    ValueFabricService.invalidateUseCaseCache();

    for (const capability of template.capabilities) {
      await this.linkCapabilityToUseCase(organizationId, newUseCase.id, capability.id);
    }

    return {
      useCase: newUseCase,
      capabilities: template.capabilities,
    };
  }

  private getCachedData<T>(
    cache: BoundedLruCache<T>,
    key: string,
    onHit: () => void,
    onMiss: () => void,
  ): T | null {
    const entry = cache.get(key);
    if (entry) {
      onHit();
      return entry;
    }

    onMiss();
    return null;
  }

  private setCachedData<T>(cache: BoundedLruCache<T>, key: string, data: T, onEvict: () => void): void {
    const evicted = cache.set(key, data, ValueFabricService.CACHE_TTL_MS);
    if (evicted) {
      onEvict();
    }
  }

  private static invalidateCache(cache: BoundedLruCache<unknown>): void {
    cache.clear();
  }

  private static invalidateCapabilityCache(): void {
    this.invalidateCache(this.capabilityCache);
  }

  private static invalidateUseCaseCache(): void {
    this.invalidateCache(this.useCaseCache);
  }

  public static getCacheDiagnostics(): {
    capability: { size: number; capacity: number; metrics: CacheMetrics };
    useCase: { size: number; capacity: number; metrics: CacheMetrics };
  } {
    return {
      capability: {
        size: this.capabilityCache.size(),
        capacity: this.capabilityCache.capacity(),
        metrics: this.capabilityCache.snapshotMetrics(),
      },
      useCase: {
        size: this.useCaseCache.size(),
        capacity: this.useCaseCache.capacity(),
        metrics: this.useCaseCache.snapshotMetrics(),
      },
    };
  }

  public static seedCacheForTesting(cacheType: "capability" | "useCase", key: string): void {
    if (cacheType === "capability") {
      this.capabilityCache.set(key, [], this.CACHE_TTL_MS);
      return;
    }

    this.useCaseCache.set(key, [], this.CACHE_TTL_MS);
  }

  public static clearCachesForTesting(): void {
    this.capabilityCache.clear();
    this.useCaseCache.clear();
  }

  // =====================================================
  // VMRT AUDIT LOGGING
  // =====================================================

  private async logVMRTMetricChange(
    resourceType: string,
    resourceId: string,
    vmrtTrace: VMRTTrace,
    tenantId: string,
    userId?: string
  ): Promise<void> {
    const { error } = await this.supabase.from("audit_log").insert({
      tenant_id: tenantId,
      user_id: userId || null,
      action: "metric_change",
      resource_type: resourceType,
      resource_id: resourceId,
      details: vmrtTrace,
      created_at: new Date().toISOString(),
    });

    if (error) {
      logger.error("Failed to log VMRT metric change:", error);
    }
  }

  private requireOrganizationId(organizationId: string): void {
    if (!organizationId) {
      throw new Error("organizationId is required for tenant-scoped operations");
    }
  }
}
