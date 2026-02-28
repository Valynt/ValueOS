/**
 * Agent Pre-Fetch Service
 *
 * Fetches CRM context (account, opportunity), benchmark overlays,
 * similar deals, and objection patterns for a newly scaffolded ValueCase.
 * Writes suggestions with confidence scores and provenance records.
 */

import { createLogger } from '../../lib/logger.js';
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

    return data.map((b: any) => ({
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
   * Fetch similar deals. Stub for future vector search implementation.
   */
  private async fetchSimilarDeals(
    _tenantId: string,
    _opportunityExternalId: string,
  ): Promise<SimilarDealSuggestion[]> {
    // Future: use VectorSearchService to find similar deals
    return [];
  }

  /**
   * Fetch objection patterns. Stub for future RedTeam integration.
   */
  private async fetchObjectionPatterns(
    _tenantId: string,
    _account: CanonicalAccount | null,
  ): Promise<ObjectionSuggestion[]> {
    // Future: query objection patterns from RedTeam agent
    return [];
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
