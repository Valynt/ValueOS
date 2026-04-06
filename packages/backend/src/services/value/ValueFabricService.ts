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
import { supabase } from "../../lib/supabase.js";
import type {
  Benchmark,
  Capability,
  UseCase,
  ValueFabricSnapshot,
  VMRTTrace,
} from "../../types/vos";
import { ReadThroughCacheService } from "../cache/ReadThroughCacheService.js";

import { llmProxyClient } from "./LlmProxyClient.js";

type ProjectionFields<T> = readonly (keyof T & string)[];

const CAPABILITY_LIST_PROJECTION = [
  "id",
  "name",
  "description",
  "tags",
  "category",
  "is_active",
  "created_at",
  "updated_at",
] as const satisfies ProjectionFields<Capability>;

const CAPABILITY_DETAIL_PROJECTION = [
  "id",
  "name",
  "description",
  "tags",
  "category",
  "is_active",
  "created_at",
  "updated_at",
] as const satisfies ProjectionFields<Capability>;

const USE_CASE_LIST_PROJECTION = [
  "id",
  "name",
  "description",
  "persona",
  "industry",
  "is_template",
  "created_at",
  "updated_at",
] as const satisfies ProjectionFields<UseCase>;

const USE_CASE_DETAIL_PROJECTION = [
  "id",
  "name",
  "description",
  "persona",
  "industry",
  "is_template",
  "created_at",
  "updated_at",
] as const satisfies ProjectionFields<UseCase>;

function projectionSelect<T>(projection: readonly (keyof T & string)[]): string {
  return projection.join(", ");
}

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

export class ValueFabricService {
  private supabase: SupabaseClient;
  private static readonly CAPABILITIES_CACHE_ENDPOINT = "value-fabric/capabilities";
  private static readonly USE_CASES_CACHE_ENDPOINT = "value-fabric/use-cases";
  private static readonly LIST_NEAR_CACHE = {
    enabled: true,
    ttlSeconds: 15,
    maxEntries: 64,
  } as const;

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
    return ReadThroughCacheService.getOrLoad(
      {
        endpoint: ValueFabricService.CAPABILITIES_CACHE_ENDPOINT,
        namespace: "value-fabric-capabilities",
        tenantId: organizationId,
        scope: "list",
        tier: "warm",
        nearCache: ValueFabricService.LIST_NEAR_CACHE,
        keyPayload: { filters, page, pageSize },
      },
      async () => {
        let query = this.supabase
          .from("capabilities")
          .select(projectionSelect(CAPABILITY_LIST_PROJECTION))
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

        if (error) {
          throw error;
        }

        return data || [];
      }
    );
  }

  async getCapabilityById(organizationId: string, id: string): Promise<Capability | null> {
    this.requireOrganizationId(organizationId);
    return ReadThroughCacheService.getOrLoad(
      {
        endpoint: ValueFabricService.CAPABILITIES_CACHE_ENDPOINT,
        namespace: "value-fabric-capabilities",
        tenantId: organizationId,
        scope: "detail",
        tier: "hot",
        nearCache: ValueFabricService.LIST_NEAR_CACHE,
        keyPayload: { id },
      },
      async () => {
        const { data, error } = await this.supabase
          .from("capabilities")
          .select(projectionSelect(CAPABILITY_DETAIL_PROJECTION))
          .eq("organization_id", organizationId)
          .eq("id", id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data;
      }
    );
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
    await ValueFabricService.invalidateCapabilityCache(organizationId);
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
    await ValueFabricService.invalidateCapabilityCache(organizationId);
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
    return ReadThroughCacheService.getOrLoad(
      {
        endpoint: ValueFabricService.USE_CASES_CACHE_ENDPOINT,
        namespace: "value-fabric-use-cases",
        tenantId: organizationId,
        scope: "list",
        tier: "warm",
        nearCache: ValueFabricService.LIST_NEAR_CACHE,
        keyPayload: { filters, page, pageSize },
      },
      async () => {
        let query = this.supabase
          .from("use_cases")
          .select(projectionSelect(USE_CASE_LIST_PROJECTION))
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

        if (error) {
          throw error;
        }

        return data || [];
      }
    );
  }

  async getUseCaseById(organizationId: string, id: string): Promise<UseCase | null> {
    this.requireOrganizationId(organizationId);
    return ReadThroughCacheService.getOrLoad(
      {
        endpoint: ValueFabricService.USE_CASES_CACHE_ENDPOINT,
        namespace: "value-fabric-use-cases",
        tenantId: organizationId,
        scope: "detail",
        tier: "hot",
        nearCache: ValueFabricService.LIST_NEAR_CACHE,
        keyPayload: { id },
      },
      async () => {
        const { data, error } = await this.supabase
          .from("use_cases")
          .select(projectionSelect(USE_CASE_DETAIL_PROJECTION))
          .eq("organization_id", organizationId)
          .eq("id", id)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return data;
      }
    );
  }

  async getUseCaseWithCapabilities(organizationId: string, useCaseId: string): Promise<{
    useCase: UseCase;
    capabilities: Capability[];
  }> {
    this.requireOrganizationId(organizationId);
    return ReadThroughCacheService.getOrLoad(
      {
        endpoint: ValueFabricService.USE_CASES_CACHE_ENDPOINT,
        namespace: "value-fabric-use-cases",
        tenantId: organizationId,
        scope: "with-capabilities",
        tier: "warm",
        nearCache: ValueFabricService.LIST_NEAR_CACHE,
        keyPayload: { useCaseId },
      },
      async () => {
        const { data: useCase, error: useCaseError } = await this.supabase
          .from("use_cases")
          .select(projectionSelect(USE_CASE_DETAIL_PROJECTION))
          .eq("organization_id", organizationId)
          .eq("id", useCaseId)
          .single();

        if (useCaseError) {
          throw useCaseError;
        }

        const { data: capabilityLinks, error: linksError } = await this.supabase
          .from("use_case_capabilities")
          .select("capability_id, relevance_score")
          .eq("use_case_id", useCaseId);

        if (linksError) {
          throw linksError;
        }

        const capabilityIds = capabilityLinks?.map((link) => link.capability_id) || [];
        if (capabilityIds.length === 0) {
          return { useCase, capabilities: [] };
        }

        const { data: capabilities, error: capError } = await this.supabase
          .from("capabilities")
          .select(projectionSelect(CAPABILITY_DETAIL_PROJECTION))
          .eq("organization_id", organizationId)
          .in("id", capabilityIds);

        if (capError) {
          throw capError;
        }

        return { useCase, capabilities: capabilities || [] };
      }
    );
  }

  async linkCapabilityToUseCase(
    organizationId: string,
    useCaseId: string,
    capabilityId: string,
    relevanceScore: number = 1.0
  ): Promise<void> {
    await this.linkCapabilitiesToUseCase(organizationId, useCaseId, [{ id: capabilityId, relevanceScore }]);
  }

  async linkCapabilitiesToUseCase(
    organizationId: string,
    useCaseId: string,
    capabilities: { id: string; relevanceScore?: number }[]
  ): Promise<void> {
    this.requireOrganizationId(organizationId);
    if (capabilities.length === 0) return;

    const { error } = await this.supabase.from("use_case_capabilities").insert(
      capabilities.map((cap) => ({
        organization_id: organizationId,
        use_case_id: useCaseId,
        capability_id: cap.id,
        relevance_score: cap.relevanceScore ?? 1.0,
      }))
    );

    if (error) throw error;

    await ValueFabricService.invalidateUseCaseCache(organizationId);
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

    await ValueFabricService.invalidateUseCaseCache(organizationId);

    await this.linkCapabilitiesToUseCase(
      organizationId,
      newUseCase.id,
      template.capabilities.map((c) => ({ id: c.id }))
    );

    return {
      useCase: newUseCase,
      capabilities: template.capabilities,
    };
  }

  private static async invalidateCapabilityCache(organizationId: string): Promise<void> {
    await Promise.all([
      ReadThroughCacheService.invalidateEndpoint(
        organizationId,
        this.CAPABILITIES_CACHE_ENDPOINT
      ),
      ReadThroughCacheService.invalidateEndpoint(
        organizationId,
        this.USE_CASES_CACHE_ENDPOINT
      ),
    ]);
  }

  private static async invalidateUseCaseCache(organizationId: string): Promise<void> {
    await ReadThroughCacheService.invalidateEndpoint(
      organizationId,
      this.USE_CASES_CACHE_ENDPOINT
    );
  }

  public static clearCachesForTesting(): void {
    ReadThroughCacheService.clearNearCacheForTesting();
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
