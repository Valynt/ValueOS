/**
 * ResearchJobWorker — BullMQ worker for processing onboarding research jobs.
 *
 * Pipeline: WebCrawler → SuggestionExtractor → DB writes.
 * Updates job status and per-entity progress throughout.
 */

import { type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { logger } from '../../lib/logger.js';
import { crawlWebsite, type CrawlResult } from './WebCrawler.js';
import {
  extractAllEntities,
  type EntityType,
  type ExtractionResult,
  type LLMGatewayInterface,
} from './SuggestionExtractor.js';
import { mcpGroundTruthService } from '../MCPGroundTruthService.js';
import { semanticMemory } from '../SemanticMemory.js';

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
// Helpers
// ============================================================================

function chunkText(text: string, size: number = 2000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  if (!text) return chunks;
  
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.substring(start, end));
    if (end === text.length) break;
    start += size - overlap;
  }
  return chunks;
}

function computeEntityHash(entityType: string, payload: Record<string, unknown>): string {

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
          sec_filing: 'pending', // Added SEC status
        },
      })
      .eq('id', jobId);

    // 2. SEC EDGAR Ingestion (R1.1, R1.2)
    logger.info('Starting SEC ingestion', { jobId, website });
    let secContent = '';
    try {
      const domain = new URL(website).hostname.replace('www.', '');
      
      // Resolve ticker
      const tickerResult = await mcpGroundTruthService.callMcpTool<any>('financialsMcp', 'resolve_ticker_from_domain', {
        domain
      }, d => d);

      if (tickerResult?.value) {
        const ticker = tickerResult.value;
        logger.info('Resolved ticker', { domain, ticker });

        // Fetch sections
        const sections = await mcpGroundTruthService.getFilingSections({
          identifier: ticker,
          sections: ['business', 'risk_factors', 'mda']
        });

        if (sections) {
          secContent = Object.entries(sections)
            .map(([name, text]) => `## SEC 10-K Section: ${name}\n\n${text}`)
            .join('\n\n');
          
          logger.info('SEC sections retrieved', { jobId, sections: Object.keys(sections) });
          
          // Vector Ingestion for SEC (R2.2)
          for (const [name, text] of Object.entries(sections)) {
            const chunks = chunkText(text);
            for (let i = 0; i < chunks.length; i++) {
              await semanticMemory.storeChunk({
                type: 'sec_filing_chunk',
                content: chunks[i],
                sourceUrl: `sec://edgar/${ticker}/${name}`,
                tenantId,
                contextId,
                metadata: {
                  section: name,
                  chunk_index: i,
                  total_chunks: chunks.length,
                  ticker
                }
              });
            }
          }

          // Update status
          await updateEntityStatus(supabase, jobId, 'sec_filing', 'completed');
        }
      }
    } catch (secErr) {
      logger.warn('SEC ingestion failed, continuing with web crawl only', { jobId, error: (secErr as any).message });
      await updateEntityStatus(supabase, jobId, 'sec_filing', 'failed');
    }

    // 3. Crawl the website
    logger.info('Starting web crawl', { jobId, website });
    const crawlResult: CrawlResult = await crawlWebsite(website);
    
    // Vector Ingestion for Web (R2.2)
    for (const page of crawlResult.pages) {
      const chunks = chunkText(page.content);
      for (let i = 0; i < chunks.length; i++) {
        await semanticMemory.storeChunk({
          type: 'web_chunk',
          content: chunks[i],
          sourceUrl: page.url,
          tenantId,
          contextId,
          metadata: {
            title: page.title,
            chunk_index: i,
            total_chunks: chunks.length
          }
        });
      }
    }

    logger.info('Crawl and Vector Ingestion complete', {
      jobId,
      pages: crawlResult.pages.length,
      chars: crawlResult.totalChars,
    });

    // Update crawl metadata
    await supabase
      .from('company_research_jobs')
      .update({
        pages_crawled: crawlResult.pages.length,
        crawl_duration_ms: crawlResult.durationMs,
      })
      .eq('id', jobId);

    // Combine web and SEC content for extraction
    const allPages = [...crawlResult.pages];
    if (secContent) {
      allPages.push({
        url: 'https://www.sec.gov/edgar',
        content: secContent,
        title: 'SEC 10-K Filing',
      });
    }

    if (allPages.length === 0) {
      await supabase
        .from('company_research_jobs')
        .update({
          status: 'failed',
          error_message: 'No data could be retrieved (Web or SEC)',
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      return { jobId, status: 'failed', suggestionsCreated: 0, error: 'No data retrieved' };
    }

    // 4. Extract entities (parallel, with per-entity progress updates)
    const extractionResults: ExtractionResult[] = await extractAllEntities(
      allPages,
      { companyName: undefined, industry, companySize, salesMotion },
      llmGateway,
      tenantId,
      async (entityType: EntityType, status: 'running' | 'completed' | 'failed') => {
        await updateEntityStatus(supabase, jobId, entityType, status);
      },
    );

    // ... (rest of the worker logic remains same) ...
  } catch (err) {
    // ... (error handling remains same) ...
  }
}

async function updateEntityStatus(supabase: SupabaseClient, jobId: string, entityType: string, status: string) {
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
      progress: entityStatus,
    })
    .eq('id', jobId);
}


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
