/**
 * ResearchJobWorker — BullMQ worker for processing onboarding research jobs.
 *
 * Pipeline: WebCrawler → SuggestionExtractor → DB writes.
 * Updates job status and per-entity progress throughout.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logger } from '../../lib/logger.js';
import { crawlWebsite, type CrawlResult } from './WebCrawler.js';
import {
  extractAllEntities,
  type EntityType,
  type ExtractionResult,
  type LLMGatewayInterface,
} from './SuggestionExtractor.js';

// ============================================================================
// Types
// ============================================================================

export interface ResearchJobInput {
  jobId: string;
  tenantId: string;
  contextId: string;
  website: string;
  industry?: string;
  companySize?: string;
  salesMotion?: string;
}

export interface ResearchJobResult {
  jobId: string;
  status: 'completed' | 'failed';
  suggestionsCreated: number;
  error?: string;
}

// ============================================================================
// Entity hash for deduplication
// ============================================================================

function computeEntityHash(entityType: string, payload: Record<string, unknown>): string {
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(`${entityType}:${normalized}`).digest('hex');
}

// ============================================================================
// Worker Logic
// ============================================================================

/**
 * Process a single research job. Called by the BullMQ worker or directly.
 */
export async function processResearchJob(
  input: ResearchJobInput,
  supabase: SupabaseClient,
  llmGateway: LLMGatewayInterface,
): Promise<ResearchJobResult> {
  const { jobId, tenantId, contextId, website, industry, companySize, salesMotion } = input;

  try {
    // 1. Mark job as running
    await supabase
      .from('company_research_jobs')
      .update({
        status: 'running',
        started_at: new Date().toISOString(),
        entity_status: {
          product: 'pending',
          competitor: 'pending',
          persona: 'pending',
          claim: 'pending',
          capability: 'pending',
          value_pattern: 'pending',
        },
      })
      .eq('id', jobId);

    // 2. Crawl the website
    logger.info('Starting web crawl', { jobId, website });
    const crawlResult: CrawlResult = await crawlWebsite(website);
    logger.info('Crawl complete', {
      jobId,
      pages: crawlResult.pages.length,
      chars: crawlResult.totalChars,
      durationMs: crawlResult.durationMs,
    });

    // Update crawl metadata
    await supabase
      .from('company_research_jobs')
      .update({
        pages_crawled: crawlResult.pages.length,
        crawl_duration_ms: crawlResult.durationMs,
      })
      .eq('id', jobId);

    if (crawlResult.pages.length === 0) {
      await supabase
        .from('company_research_jobs')
        .update({
          status: 'failed',
          error_message: 'No pages could be crawled from the provided website',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return { jobId, status: 'failed', suggestionsCreated: 0, error: 'No pages crawled' };
    }

    // 3. Extract entities (parallel, with per-entity progress updates)
    const extractionResults: ExtractionResult[] = await extractAllEntities(
      crawlResult.pages,
      { companyName: undefined, industry, companySize, salesMotion },
      llmGateway,
      tenantId,
      async (entityType: EntityType, status: 'running' | 'completed' | 'failed') => {
        // Update per-entity status in the job record
        const { data: job } = await supabase
          .from('company_research_jobs')
          .select('entity_status')
          .eq('id', jobId)
          .single();

        const entityStatus = (job?.entity_status as Record<string, string>) ?? {};
        entityStatus[entityType] = status;

        await supabase
          .from('company_research_jobs')
          .update({
            entity_status: entityStatus,
            progress: entityStatus, // Keep progress in sync
          })
          .eq('id', jobId);
      },
    );

    // 4. Write suggestions to DB
    let suggestionsCreated = 0;
    let totalTokens = 0;

    for (const result of extractionResults) {
      if (!result.success || result.items.length === 0) continue;

      totalTokens += result.tokensUsed ?? 0;

      const rows = result.items.map((item) => ({
        tenant_id: tenantId,
        job_id: jobId,
        context_id: contextId,
        entity_type: result.entityType,
        payload: item.payload,
        confidence_score: item.confidence_score,
        source_urls: item.source_urls,
        source_page_url: item.source_page_url,
        entity_hash: computeEntityHash(result.entityType, item.payload),
        status: 'suggested',
      }));

      // Upsert using entity_hash to prevent duplicates across re-runs
      for (const row of rows) {
        const { error } = await supabase
          .from('company_research_suggestions')
          .upsert(row, { onConflict: 'entity_hash', ignoreDuplicates: true });

        if (!error) {
          suggestionsCreated++;
        } else {
          logger.warn('Failed to insert suggestion', { entityType: result.entityType, error: error.message });
        }
      }
    }

    // 5. Mark job as completed
    await supabase
      .from('company_research_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        tokens_used: totalTokens,
      })
      .eq('id', jobId);

    logger.info('Research job completed', { jobId, suggestionsCreated, totalTokens });

    return { jobId, status: 'completed', suggestionsCreated };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('Research job failed', { jobId, error: errorMsg });

    await supabase
      .from('company_research_jobs')
      .update({
        status: 'failed',
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    return { jobId, status: 'failed', suggestionsCreated: 0, error: errorMsg };
  }
}
