/**
 * Agent Pre-Fetch Service
 *
 * Fetches CRM context (account, opportunity), benchmark overlays,
 * similar deals, and objection patterns for a newly scaffolded ValueCase.
 * Writes suggestions with confidence scores and provenance records.
 */

import { createLogger } from '../../lib/logger.js';
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from '../../lib/supabase.js';

import { crmConnectionService } from './CrmConnectionService.js';
import { getCrmProvider } from './CrmProviderRegistry.js';
import type { CanonicalAccount, CrmProvider } from './types.js';

const logger = createLogger({ component: 'AgentPrefetchService' });

export interface PrefetchJobInput {
  valueCaseId: string;
  tenantId: string;
  provider: CrmProvider;
  opportunityExternalId: string;
  accountExternalId?: string | null;
}

export interface PrefetchResult {
  status: 'completed' | 'partial' | 'failed';
  accountContext: CanonicalAccount | null;
  benchmarks: BenchmarkSuggestion[];
  similarDeals: SimilarDealSuggestion[];
  objections: ObjectionSuggestion[];
}

export interface BenchmarkSuggestion {
  metric: string;
  baselineValue: number;
  industry: string;
  source: string;
  confidence: ConfidenceScore;
}

export interface SimilarDealSuggestion {
  dealName: string;
  amount: number;
  outcome: string;
  similarity: number;
  confidence: ConfidenceScore;
}

export interface ObjectionSuggestion {
  objection: string;
  category: string;
  suggestedResponse: string;
  frequency: number;
  confidence: ConfidenceScore;
}

export interface ConfidenceScore {
  dataQuality: number;
  assumptionStability: number;
  historicalAlignment: number;
}

export class AgentPrefetchService {
  private supabase = createServerSupabaseClient();

  /**
   * Run the pre-fetch job for a ValueCase.
   */
  async prefetch(input: PrefetchJobInput): Promise<PrefetchResult> {
    const { valueCaseId, tenantId, provider, opportunityExternalId, accountExternalId } = input;

    logger.info('Starting agent pre-fetch', { valueCaseId, tenantId, provider });

    let accountContext: CanonicalAccount | null = null;
    const benchmarks: BenchmarkSuggestion[] = [];
    const similarDeals: SimilarDealSuggestion[] = [];
    const objections: ObjectionSuggestion[] = [];

    // 1. Fetch CRM account context
    if (accountExternalId) {
      try {
        const tokens = await crmConnectionService.getTokens(tenantId, provider);
        if (tokens) {
          const impl = getCrmProvider(provider);
          accountContext = await impl.fetchAccountById(tokens, accountExternalId);

          if (accountContext) {
            // Write provenance for account context
            await this.writeProvenance(tenantId, provider, 'account', accountExternalId, valueCaseId);
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch account context', {
          error: err instanceof Error ? err.message : String(err),
          accountExternalId,
        });
      }
    }

    // 2. Fetch benchmark overlays (stub — interface for future implementation)
    try {
      const benchmarkResults = await this.fetchBenchmarks(tenantId, accountContext);
      benchmarks.push(...benchmarkResults);
    } catch (err) {
      logger.warn('Benchmark fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 3. Fetch similar deals (stub — interface for future implementation)
    try {
      const similarResults = await this.fetchSimilarDeals(tenantId, opportunityExternalId);
      similarDeals.push(...similarResults);
    } catch (err) {
      logger.warn('Similar deals fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 4. Fetch objection patterns (stub — interface for future implementation)
    try {
      const objectionResults = await this.fetchObjectionPatterns(tenantId, accountContext);
      objections.push(...objectionResults);
    } catch (err) {
      logger.warn('Objection patterns fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 5. Store suggestions in value_case metadata
    const suggestions = {
      accountContext: accountContext ? {
        name: accountContext.name,
        industry: accountContext.industry,
        size: accountContext.size,
        revenue: accountContext.revenue,
        domain: accountContext.domain,
      } : null,
      benchmarks,
      similarDeals,
      objections,
      fetchedAt: new Date().toISOString(),
    };

    await this.supabase
      .from('value_cases')
      .update({
        metadata: this.supabase.rpc ? suggestions : suggestions, // merge with existing
        updated_at: new Date().toISOString(),
      })
      .eq('id', valueCaseId);

    // Use raw SQL-style update to merge metadata
    const { data: existingCase } = await this.supabase
      .from('value_cases')
      .select('metadata')
      .eq('id', valueCaseId)
      .single();

    const mergedMetadata = {
      ...(existingCase?.metadata as Record<string, unknown> || {}),
      prefetch: suggestions,
    };

    await this.supabase
      .from('value_cases')
      .update({ metadata: mergedMetadata, updated_at: new Date().toISOString() })
      .eq('id', valueCaseId);

    // 6. Update saga context with prefetch status
    const status = accountContext || benchmarks.length > 0 || similarDeals.length > 0
      ? 'completed'
      : 'partial';

    await this.updateSagaPrefetchStatus(valueCaseId, status);

    logger.info('Agent pre-fetch completed', {
      valueCaseId,
      status,
      benchmarkCount: benchmarks.length,
      similarDealCount: similarDeals.length,
      objectionCount: objections.length,
    });

    return {
      status: status as 'completed' | 'partial',
      accountContext,
      benchmarks,
      similarDeals,
      objections,
    };
  }

  // ---- Stub interfaces for future implementation ----

  /**
   * Fetch industry benchmarks. Returns stubs for now.
   * Future: query benchmarks table or external benchmark API.
   */
  private async fetchBenchmarks(
    tenantId: string,
    account: CanonicalAccount | null,
  ): Promise<BenchmarkSuggestion[]> {
    if (!account?.industry) return [];

    // Query existing benchmarks table
    const { data } = await this.supabase
      .from('benchmarks')
      .select('*')
      .eq('industry', account.industry)
      .limit(10);

    if (!data || data.length === 0) return [];

    type BenchmarkRow = { metric: string; baseline_value: number; industry: string; source?: string };
    return (data as BenchmarkRow[]).map((b) => ({
      metric: b.metric,
      baselineValue: b.baseline_value,
      industry: b.industry,
      source: b.source || 'internal',
      confidence: {
        dataQuality: 0.7,
        assumptionStability: 0.6,
        historicalAlignment: 0.5,
      },
    }));
  }

  /**
   * Fetch similar deals via pgvector similarity search against semantic_memory.
   *
   * Queries the semantic_memory table for chunks whose embedding is close to
   * the opportunity's description embedding. Falls back to a keyword search
   * when no embedding is available for the opportunity.
   */
  private async fetchSimilarDeals(
    tenantId: string,
    opportunityExternalId: string,
  ): Promise<SimilarDealSuggestion[]> {
    // Look up the opportunity's embedding from semantic_memory (stored during CRM sync).
    const { data: memoryRows, error: memoryError } = await this.supabase
      .from('semantic_memory')
      .select('embedding, content, metadata')
      .eq('tenant_id', tenantId)
      .contains('metadata', { externalId: opportunityExternalId, sourceType: 'crm-opportunity' })
      .limit(1);

    if (memoryError) {
      logger.warn('AgentPrefetchService: failed to fetch opportunity embedding', {
        opportunityExternalId,
        error: memoryError.message,
      });
      return [];
    }

    const embedding = memoryRows?.[0]?.embedding as number[] | null | undefined;

    if (!embedding || embedding.length === 0) {
      logger.info('AgentPrefetchService: no embedding found for opportunity — skipping similar deals', {
        opportunityExternalId,
      });
      return [];
    }

    // Use pgvector cosine similarity to find the top-5 similar deal chunks.
    // The RPC function `match_semantic_memory` must exist in the database.
    const { data: similarRows, error: similarError } = await this.supabase.rpc(
      'match_semantic_memory',
      {
        query_embedding: embedding,
        match_threshold: 0.75,
        match_count: 5,
        filter_tenant_id: tenantId,
        filter_source_type: 'crm-opportunity',
      },
    );

    if (similarError) {
      logger.warn('AgentPrefetchService: vector similarity search failed', {
        error: similarError.message,
      });
      return [];
    }

    type SimilarRow = {
      content: string;
      similarity: number;
      metadata: Record<string, unknown>;
    };

    return ((similarRows ?? []) as SimilarRow[])
      .filter((r) => r.metadata?.externalId !== opportunityExternalId) // exclude self
      .map((r) => ({
        dealName: (r.metadata?.name as string) ?? 'Unknown Deal',
        amount: (r.metadata?.amount as number) ?? 0,
        outcome: (r.metadata?.stage as string) ?? 'unknown',
        similarity: Math.round(r.similarity * 100) / 100,
        confidence: {
          dataQuality: 0.75,
          assumptionStability: 0.65,
          historicalAlignment: r.similarity,
        },
      }));
  }

  /**
   * Fetch objection patterns from the objection_patterns table, filtered by
   * the account's industry and the tenant.
   *
   * Returns an empty array (with a structured log) if the table does not yet
   * contain data for this industry — never silently returns empty without
   * explanation.
   */
  private async fetchObjectionPatterns(
    tenantId: string,
    account: CanonicalAccount | null,
  ): Promise<ObjectionSuggestion[]> {
    const industry = account?.industry;

    let query = this.supabase
      .from('objection_patterns')
      .select('objection, category, suggested_response, frequency, confidence_data_quality, confidence_assumption_stability, confidence_historical_alignment')
      .eq('tenant_id', tenantId)
      .order('frequency', { ascending: false })
      .limit(10);

    if (industry) {
      query = query.eq('industry', industry);
    }

    const { data, error } = await query;

    if (error) {
      logger.warn('AgentPrefetchService: failed to fetch objection patterns', {
        tenantId,
        industry,
        error: error.message,
      });
      return [];
    }

    if (!data || data.length === 0) {
      logger.info('AgentPrefetchService: no objection patterns found for industry', {
        tenantId,
        industry: industry ?? 'any',
      });
      return [];
    }

    type ObjectionRow = {
      objection: string;
      category: string;
      suggested_response: string;
      frequency: number;
      confidence_data_quality: number;
      confidence_assumption_stability: number;
      confidence_historical_alignment: number;
    };

    return (data as ObjectionRow[]).map((r) => ({
      objection: r.objection,
      category: r.category,
      suggestedResponse: r.suggested_response,
      frequency: r.frequency,
      confidence: {
        dataQuality: r.confidence_data_quality ?? 0.6,
        assumptionStability: r.confidence_assumption_stability ?? 0.6,
        historicalAlignment: r.confidence_historical_alignment ?? 0.5,
      },
    }));
  }

  // ---- Helpers ----

  private async writeProvenance(
    tenantId: string,
    provider: CrmProvider,
    objectType: string,
    externalId: string,
    valueCaseId: string,
  ): Promise<void> {
    await this.supabase
      .from('provenance_records')
      .insert({
        tenant_id: tenantId,
        source_type: 'crm',
        source_provider: provider,
        source_provenance: 'crm',
        evidence_tier: 'gold',
        external_object_type: objectType,
        external_object_id: externalId,
        internal_table: 'value_cases',
        internal_id: valueCaseId,
        field_name: 'prefetch.accountContext',
        confidence_data_quality: 0.8,
        confidence_assumption_stability: 0.7,
        confidence_historical_alignment: 0.6,
        metadata: { source: 'agent_prefetch' },
      });
  }

  private async updateSagaPrefetchStatus(
    valueCaseId: string,
    status: string,
  ): Promise<void> {
    const { data: saga } = await this.supabase
      .from('value_case_sagas')
      .select('context')
      .eq('value_case_id', valueCaseId)
      .single();

    if (!saga) return;

    const context = (saga.context as Record<string, unknown>) || {};
    context.prefetchStatus = status;
    context.prefetchCompletedAt = new Date().toISOString();

    await this.supabase
      .from('value_case_sagas')
      .update({ context, updated_at: new Date().toISOString() })
      .eq('value_case_id', valueCaseId);
  }
}

export const agentPrefetchService = new AgentPrefetchService();
