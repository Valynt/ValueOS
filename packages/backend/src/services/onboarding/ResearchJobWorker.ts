/**
 * ResearchJobWorker — BullMQ worker for processing onboarding research jobs.
 *
 * Pipeline: WebCrawler → SuggestionExtractor → DB writes.
 * Updates job status and per-entity progress throughout.
 */

import { createHash } from "crypto";

import { type SupabaseClient } from "@supabase/supabase-js";
import PQueue from "p-queue";

import { logger } from "../../lib/logger.js";
import { mcpGroundTruthService } from "../MCPGroundTruthService.js";
import { semanticMemory } from "../SemanticMemory.js";
import { chunkEmbedPipeline } from "../ground-truth/ChunkEmbedPipeline.js";

import {
  type EntityType,
  extractAllEntities,
  type ExtractionResult,
  type LLMGatewayInterface,
} from "./SuggestionExtractor.js";
import { generateValueHypotheses } from "./ValueHypothesisGenerator.js";
import { type CrawlResult, crawlWebsite } from "./WebCrawler.js";

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
  status: "completed" | "failed";
  suggestionsCreated: number;
  error?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function computeEntityHash(
  entityType: string,
  payload: Record<string, unknown>
): string {
  const hash = createHash("sha256");
  hash.update(entityType);
  hash.update(JSON.stringify(payload));
  return hash.digest("hex");
}

async function updateEntityStatus(
  supabase: SupabaseClient,
  tenantId: string,
  jobId: string,
  entityType: string,
  status: string
) {
  const { data: job } = await supabase
    .from("company_research_jobs")
    .select("entity_status")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .single();

  const entityStatus = (job?.entity_status as Record<string, string>) ?? {};
  entityStatus[entityType] = status;

  await supabase
    .from("company_research_jobs")
    .update({
      entity_status: entityStatus,
      progress: entityStatus,
    })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);
}

/**
 * Process a single research job. Called by the BullMQ worker or directly.
 */
export async function processResearchJob(
  input: ResearchJobInput,
  supabase: SupabaseClient,
  llmGateway: LLMGatewayInterface
): Promise<ResearchJobResult> {
  const {
    jobId,
    tenantId,
    contextId,
    website,
    industry,
    companySize,
    salesMotion,
  } = input;

  try {
    // 1. Mark job as running
    await supabase
      .from("company_research_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        entity_status: {
          product: "pending",
          competitor: "pending",
          persona: "pending",
          claim: "pending",
          capability: "pending",
          value_pattern: "pending",
          sec_filing: "pending", // Added SEC status
        },
      })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    // 2. SEC EDGAR Ingestion (R1.1, R1.2)
    logger.info("Starting SEC ingestion", { jobId, website });
    let secContent = "";
    try {
      const domain = new URL(website).hostname.replace("www.", "");

      // Resolve ticker
      const tickerResult = await mcpGroundTruthService.resolveTickerFromDomain({
        domain,
      });

      if (tickerResult?.ticker) {
        const ticker = tickerResult.ticker;
        logger.info("Resolved ticker", { domain, ticker });

        // Fetch sections
        const sections = await mcpGroundTruthService.getFilingSections({
          identifier: ticker,
          sections: ["business", "risk_factors", "mda"],
        });

        if (sections) {
          secContent = Object.entries(sections)
            .map(([name, text]) => `## SEC 10-K Section: ${name}\n\n${text}`)
            .join("\n\n");

          logger.info("SEC sections retrieved", {
            jobId,
            sections: Object.keys(sections),
          });

          // Vector Ingestion for SEC using ChunkEmbedPipeline (R2.2)
          const allSecContent = Object.entries(sections)
            .map(([name, text]) => `## SEC 10-K Section: ${name}\n\n${text}`)
            .join("\n\n");

          const secChunks = await chunkEmbedPipeline.processSECFiling(
            allSecContent,
            {
              source: "sec_filing",
              tier: "tier_1_sec",
              tenantId,
              date: new Date().toISOString(),
              documentId: `sec-${ticker}-${jobId}`,
            }
          );

          // Store chunks in semantic memory with proper metadata
          const ingestionQueue = new PQueue({ concurrency: 5 });
          for (const chunk of secChunks) {
            void ingestionQueue.add(async () => {
              await semanticMemory.storeChunk({
                type: "sec_filing_chunk",
                content: chunk.content,
                sourceUrl: `sec://edgar/${ticker}/${chunk.metadata.section || "unknown"}`,
                tenantId,
                contextId,
                metadata: {
                  ...chunk.metadata,
                  tier: "tier_1_sec",
                  chunk_index: chunk.metadata.chunkIndex,
                  total_chunks: chunk.metadata.totalChunks,
                  ticker,
                },
              });
            });
          }
          await ingestionQueue.onIdle();

          // Update status
          await updateEntityStatus(
            supabase,
            tenantId,
            jobId,
            "sec_filing",
            "completed"
          );
        }
      }
    } catch (secErr: unknown) {
      logger.warn("SEC ingestion failed, continuing with web crawl only", {
        jobId,
        error: (secErr as Error).message,
      });
      await updateEntityStatus(
        supabase,
        tenantId,
        jobId,
        "sec_filing",
        "failed"
      );
    }

    // 3. Crawl the website
    logger.info("Starting web crawl", { jobId, website });
    const crawlResult: CrawlResult = await crawlWebsite(website);

    // Vector Ingestion for Web using ChunkEmbedPipeline (R2.2)
    const webIngestionQueue = new PQueue({ concurrency: 5 });

    for (const page of crawlResult.pages) {
      const webChunks = await chunkEmbedPipeline.processWebContent(
        page.content,
        {
          source: "web_content",
          tier: "tier_2_benchmark",
          tenantId,
          date: new Date().toISOString(),
          documentId: `web-${createHash("sha256").update(page.url).digest("hex").slice(0, 16)}`,
          sourceUrl: page.url,
          pageTitle: page.title,
        }
      );

      for (const chunk of webChunks) {
        void webIngestionQueue.add(async () => {
          await semanticMemory.storeChunk({
            type: "web_chunk",
            content: chunk.content,
            sourceUrl: page.url,
            tenantId,
            contextId,
            metadata: {
              ...chunk.metadata,
              title: page.title,
              tier: "tier_2_benchmark",
              chunk_index: chunk.metadata.chunkIndex,
              total_chunks: chunk.metadata.totalChunks,
            },
          });
        });
      }
    }
    await webIngestionQueue.onIdle();

    logger.info("Crawl and Vector Ingestion complete", {
      jobId,
      pages: crawlResult.pages.length,
      chars: crawlResult.totalChars,
    });

    // Update crawl metadata
    await supabase
      .from("company_research_jobs")
      .update({
        pages_crawled: crawlResult.pages.length,
        crawl_duration_ms: crawlResult.durationMs,
      })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    // Combine web and SEC content for extraction
    const allPages = [...crawlResult.pages];
    if (secContent) {
      allPages.push({
        url: "https://www.sec.gov/edgar",
        content: secContent,
        title: "SEC 10-K Filing",
      });
    }

    if (allPages.length === 0) {
      await supabase
        .from("company_research_jobs")
        .update({
          status: "failed",
          error_message: "No data could be retrieved (Web or SEC)",
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .eq("tenant_id", tenantId);

      return {
        jobId,
        status: "failed",
        suggestionsCreated: 0,
        error: "No data retrieved",
      };
    }

    // 4. Extract entities (parallel, with per-entity progress updates)
    const extractionResults: ExtractionResult[] = await extractAllEntities(
      allPages,
      { companyName: undefined, industry, companySize, salesMotion },
      llmGateway,
      tenantId,
      contextId,
      async (
        entityType: EntityType,
        status: "running" | "completed" | "failed"
      ) => {
        await updateEntityStatus(supabase, tenantId, jobId, entityType, status);
      }
    );

    // 4.5 Grounded Value Hypothesis Generation (R3.2)
    const products =
      extractionResults.find(r => r.entityType === "product")?.items || [];
    if (products.length > 0 && contextId) {
      try {
        const hypotheses = await generateValueHypotheses(
          products.map(p => p.payload),
          { industry, companySize, salesMotion },
          llmGateway,
          tenantId,
          contextId
        );

        if (hypotheses.length > 0) {
          extractionResults.push({
            entityType: "value_pattern",
            items: hypotheses.map(h => ({
              payload: h as Record<string, unknown>,
              confidence_score: 0.85,
              source_urls: ["sec://edgar"],
              source_page_url: "https://www.sec.gov/edgar",
            })),
            success: true,
          });
          logger.info("Generated grounded value hypotheses", {
            count: hypotheses.length,
          });
        }
      } catch (hvErr: unknown) {
        logger.warn("Value hypothesis generation failed", {
          error: (hvErr as Error).message,
        });
      }
    }

    // 4. Write suggestions to DB
    let suggestionsCreated = 0;
    let totalTokens = 0;

    for (const result of extractionResults) {
      if (!result.success || result.items.length === 0) continue;

      totalTokens += result.tokensUsed ?? 0;

      const rows = result.items.map(item => ({
        tenant_id: tenantId,
        job_id: jobId,
        context_id: contextId,
        entity_type: result.entityType,
        payload: item.payload,
        confidence_score: item.confidence_score,
        source_urls: item.source_urls,
        source_page_url: item.source_page_url,
        entity_hash: computeEntityHash(result.entityType, item.payload),
        status: "suggested",
      }));

      // Upsert using entity_hash to prevent duplicates across re-runs
      // BATCHED OPTIMIZATION: Use a single .upsert() call instead of individual calls
      const { error } = await supabase
        .from("company_research_suggestions")
        .upsert(rows, { onConflict: "entity_hash", ignoreDuplicates: true });

      if (!error) {
        suggestionsCreated += rows.length;
      } else {
        logger.warn("Failed to insert suggestions batch", {
          entityType: result.entityType,
          error: error.message,
        });
      }
    }

    // 5. Mark job as completed
    await supabase
      .from("company_research_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        tokens_used: totalTokens,
      })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    logger.info("Research job completed", {
      jobId,
      suggestionsCreated,
      totalTokens,
    });

    return { jobId, status: "completed", suggestionsCreated };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error("Research job failed", { jobId, error: errorMsg });

    await supabase
      .from("company_research_jobs")
      .update({
        status: "failed",
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("tenant_id", tenantId);

    return { jobId, status: "failed", suggestionsCreated: 0, error: errorMsg };
  }
}
