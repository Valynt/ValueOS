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

import { logger } from '../lib/logger';
import { SupabaseClient } from '@supabase/supabase-js';
import { llmProxyClient } from './LlmProxyClient';
import type {
  Capability,
  UseCase,
  UseCaseCapability,
  Benchmark,
  ValueFabricQuery,
  ValueFabricSnapshot
} from '../types/vos';

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

export class ValueFabricService {
  private supabase: SupabaseClient;
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000;
  private static capabilityCache = new Map<string, CacheEntry<Capability[]>>();
  private static useCaseCache = new Map<string, CacheEntry<UseCase[]>>();

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  // =====================================================
  // CAPABILITY MANAGEMENT
  // =====================================================

  async getCapabilities(filters?: {
    category?: string;
    tags?: string[];
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<Capability[]> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const cacheKey = JSON.stringify({ ...filters, page, pageSize });

    const cached = this.getCachedData(ValueFabricService.capabilityCache, cacheKey);
    if (cached) return cached;

    let query = this.supabase
      .from('capabilities')
      .select('*')
      .eq('is_active', true);

    if (filters?.category) {
      query = query.eq('category', filters.category);
    }

    if (filters?.tags && filters.tags.length > 0) {
      query = query.contains('tags', filters.tags);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await query.order('name').range(from, to);

    if (error) throw error;
    const capabilities = data || [];
    this.setCachedData(ValueFabricService.capabilityCache, cacheKey, capabilities);
    return capabilities;
  }

  async getCapabilityById(id: string): Promise<Capability | null> {
    const { data, error } = await this.supabase
      .from('capabilities')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async createCapability(capability: Omit<Capability, 'id' | 'created_at' | 'updated_at'>): Promise<Capability> {
    const { data, error } = await this.supabase
      .from('capabilities')
      .insert(capability)
      .select()
      .single();

    if (error) throw error;
    ValueFabricService.invalidateCapabilityCache();
    return data;
  }

  async updateCapability(id: string, updates: Partial<Capability>): Promise<Capability> {
    const { data, error } = await this.supabase
      .from('capabilities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    ValueFabricService.invalidateCapabilityCache();
    return data;
  }

  // =====================================================
  // USE CASE MANAGEMENT
  // =====================================================

  async getUseCases(filters?: {
    persona?: string;
    industry?: string;
    is_template?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<UseCase[]> {
    const page = filters?.page ?? 1;
    const pageSize = filters?.pageSize ?? 50;
    const cacheKey = JSON.stringify({ ...filters, page, pageSize });

    const cached = this.getCachedData(ValueFabricService.useCaseCache, cacheKey);
    if (cached) return cached;

    let query = this.supabase.from('use_cases').select('*');

    if (filters?.persona) {
      query = query.eq('persona', filters.persona);
    }

    if (filters?.industry) {
      query = query.eq('industry', filters.industry);
    }

    if (filters?.is_template !== undefined) {
      query = query.eq('is_template', filters.is_template);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error } = await query.order('name').range(from, to);

    if (error) throw error;
    const useCases = data || [];
    this.setCachedData(ValueFabricService.useCaseCache, cacheKey, useCases);
    return useCases;
  }

  async getUseCaseById(id: string): Promise<UseCase | null> {
    const { data, error } = await this.supabase
      .from('use_cases')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  async getUseCaseWithCapabilities(useCaseId: string): Promise<{
    useCase: UseCase;
    capabilities: Capability[];
  }> {
    const { data: useCase, error: useCaseError } = await this.supabase
      .from('use_cases')
      .select('*')
      .eq('id', useCaseId)
      .single();

    if (useCaseError) throw useCaseError;

    const { data: capabilityLinks, error: linksError } = await this.supabase
      .from('use_case_capabilities')
      .select('capability_id, relevance_score')
      .eq('use_case_id', useCaseId);

    if (linksError) throw linksError;

    const capabilityIds = capabilityLinks?.map(l => l.capability_id) || [];

    if (capabilityIds.length === 0) {
      return { useCase, capabilities: [] };
    }

    const { data: capabilities, error: capError } = await this.supabase
      .from('capabilities')
      .select('*')
      .in('id', capabilityIds);

    if (capError) throw capError;

    return { useCase, capabilities: capabilities || [] };
  }

  async linkCapabilityToUseCase(
    useCaseId: string,
    capabilityId: string,
    relevanceScore: number = 1.0
  ): Promise<void> {
    const { error } = await this.supabase
      .from('use_case_capabilities')
      .insert({
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

  async getBenchmarks(filters: {
    kpi_name?: string;
    industry?: string;
    vertical?: string;
    company_size?: string;
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

    const { data, error } = await query.order('data_date', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async getBenchmarkPercentiles(
    kpiName: string,
    industry: string
  ): Promise<{ p25: number; p50: number; p75: number; p90: number } | null> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .select('value, percentile')
      .eq('kpi_name', kpiName)
      .eq('industry', industry)
      .in('percentile', [25, 50, 75, 90]);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const percentiles = data.reduce((acc, row) => {
      if (row.percentile === 25) acc.p25 = row.value;
      if (row.percentile === 50) acc.p50 = row.value;
      if (row.percentile === 75) acc.p75 = row.value;
      if (row.percentile === 90) acc.p90 = row.value;
      return acc;
    }, { p25: 0, p50: 0, p75: 0, p90: 0 });

    return percentiles;
  }

  async createBenchmark(benchmark: Omit<Benchmark, 'id' | 'created_at'>): Promise<Benchmark> {
    const { data, error } = await this.supabase
      .from('benchmarks')
      .insert(benchmark)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // =====================================================
  // SEMANTIC SEARCH (using pgvector)
  // =====================================================

  async semanticSearchCapabilities(
    queryText: string,
    limit: number = 10
  ): Promise<SemanticSearchResult<Capability>[]> {
    const embedding = await this.generateEmbedding(queryText);

    const { data, error } = await this.supabase.rpc('search_capabilities_by_embedding', {
      query_embedding: embedding,
      match_count: limit,
    });

    if (error) {
      logger.warn('Semantic search failed, falling back to text search:', error);
      return this.fallbackTextSearch(queryText, limit);
    }

    const semanticResults = (data || []) as SemanticSearchResult<Capability>[];

    if ((semanticResults?.length || 0) >= limit) {
      return semanticResults;
    }

    const existingIds = new Set(semanticResults.map(result => result.item.id));
    const fallbackResults = await this.fallbackTextSearch(queryText, limit);

    for (const result of fallbackResults) {
      if (existingIds.has(result.item.id)) continue;

      semanticResults.push(result);
      existingIds.add(result.item.id);

      if (semanticResults.length >= limit) break;
    }

    return semanticResults;
  }

  private async fallbackTextSearch(
    queryText: string,
    limit: number
  ): Promise<SemanticSearchResult<Capability>[]> {
    const capabilities = await this.getCapabilities({ search: queryText });

    return capabilities.slice(0, limit).map(cap => ({
      item: cap,
      similarity: 0.5,
    }));
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    return llmProxyClient.generateEmbedding({ input: text, provider: 'openai' });
  }

  // =====================================================
  // VALUE FABRIC SNAPSHOTS
  // =====================================================

  async getValueFabricSnapshot(valueCaseId: string): Promise<ValueFabricSnapshot> {
    const [
      businessObjectives,
      valueTrees,
      roiModels,
      valueCommits,
      telemetryData,
      realizationReports,
      expansionModels,
    ] = await Promise.all([
      this.getBusinessObjectives(valueCaseId),
      this.getValueTrees(valueCaseId),
      this.getROIModels(valueCaseId),
      this.getValueCommits(valueCaseId),
      this.getTelemetryCount(valueCaseId),
      this.getRealizationReports(valueCaseId),
      this.getExpansionModels(valueCaseId),
    ]);

    const capabilities = await this.getCapabilities();
    const useCases = await this.getUseCases({ is_template: true });

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

  private async getBusinessObjectives(valueCaseId: string) {
    const { data } = await this.supabase
      .from('business_objectives')
      .select('*')
      .eq('value_case_id', valueCaseId);
    return data || [];
  }

  private async getValueTrees(valueCaseId: string) {
    const { data } = await this.supabase
      .from('value_trees')
      .select('*')
      .eq('value_case_id', valueCaseId);
    return data || [];
  }

  async getValueTreeHierarchy(valueTreeId: string, maxDepth: number = 5) {
    const { data, error } = await this.supabase.rpc('get_value_tree_hierarchy', {
      value_tree_uuid: valueTreeId,
      max_depth: maxDepth,
    });

    if (error) throw error;
    return data || [];
  }

  private async getROIModels(valueCaseId: string) {
    const { data } = await this.supabase
      .from('roi_models')
      .select('*')
      .eq('value_tree_id', valueCaseId);
    return data || [];
  }

  private async getValueCommits(valueCaseId: string) {
    const { data } = await this.supabase
      .from('value_commits')
      .select('*')
      .eq('value_case_id', valueCaseId);
    return data || [];
  }

  private async getTelemetryCount(valueCaseId: string) {
    const { data, count } = await this.supabase
      .from('telemetry_events')
      .select('kpi_hypothesis_id, event_timestamp', { count: 'exact' })
      .eq('value_case_id', valueCaseId);

    const uniqueKpis = new Set(data?.map(d => d.kpi_hypothesis_id) || []).size;
    const lastTimestamp = data?.[0]?.event_timestamp;

    return {
      count: count || 0,
      unique_kpis: uniqueKpis,
      last_timestamp: lastTimestamp,
      coverage: 0,
    };
  }

  private async getRealizationReports(valueCaseId: string) {
    const { data } = await this.supabase
      .from('realization_reports')
      .select('*')
      .eq('value_case_id', valueCaseId);
    return data || [];
  }

  private async getExpansionModels(valueCaseId: string) {
    const { data } = await this.supabase
      .from('expansion_models')
      .select('*')
      .eq('value_case_id', valueCaseId);
    return data || [];
  }

  private determineLifecycleStage(data: {
    businessObjectives: any[];
    valueTrees: any[];
    valueCommits: any[];
    realizationReports: any[];
    expansionModels: any[];
  }): 'opportunity' | 'target' | 'realization' | 'expansion' {
    if (data.expansionModels.length > 0) return 'expansion';
    if (data.realizationReports.length > 0) return 'realization';
    if (data.valueCommits.length > 0) return 'target';
    return 'opportunity';
  }

  // =====================================================
  // ONTOLOGY STATISTICS
  // =====================================================

  async getOntologyStats(): Promise<OntologyStats> {
    const [capabilities, useCases, industries] = await Promise.all([
      this.supabase.from('capabilities').select('id', { count: 'exact' }),
      this.supabase.from('use_cases').select('id', { count: 'exact' }),
      this.supabase.from('use_cases').select('industry'),
    ]);

    const uniqueIndustries = [...new Set(industries.data?.map(u => u.industry).filter(Boolean))];

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
    templateId: string,
    valueCaseId: string
  ): Promise<{ useCase: UseCase; capabilities: Capability[] }> {
    const template = await this.getUseCaseWithCapabilities(templateId);

    if (!template.useCase.is_template) {
      throw new Error('Not a template use case');
    }

    const { data: newUseCase, error } = await this.supabase
      .from('use_cases')
      .insert({
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
      await this.linkCapabilityToUseCase(newUseCase.id, capability.id);
    }

    return {
      useCase: newUseCase,
      capabilities: template.capabilities,
    };
  }

  private getCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCachedData<T>(cache: Map<string, CacheEntry<T>>, key: string, data: T): void {
    cache.set(key, { data, expiresAt: Date.now() + ValueFabricService.CACHE_TTL_MS });
  }

  private static invalidateCache(cache: Map<string, CacheEntry<any>>): void {
    cache.clear();
  }

  private static invalidateCapabilityCache(): void {
    this.invalidateCache(this.capabilityCache);
  }

  private static invalidateUseCaseCache(): void {
    this.invalidateCache(this.useCaseCache);
  }
}
