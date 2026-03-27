/**
 * ChunkEmbedPipeline
 *
 * Pipeline for semantic chunking and embedding of ground truth content.
 * Chunks SEC filings and web content, embeds using configured model,
 * and stores in semantic_memory with metadata.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §4
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";
// service-role:justified worker/service requires elevated DB access for background processing
import { createServerSupabaseClient } from "../../lib/supabase.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const ChunkMetadataSchema = z.object({
  source: z.enum(["sec_filing", "web_content", "benchmark_report", "internal"]),
  tier: z.enum(["tier_1_sec", "tier_2_benchmark", "tier_3_internal"]),
  tenantId: z.string(),
  date: z.string(),
  sourceUrl: z.string().optional(),
  section: z.string().optional(),
  documentId: z.string(),
  chunkIndex: z.number(),
  totalChunks: z.number(),
});

export const ChunkSchema = z.object({
  id: z.string(),
  content: z.string(),
  metadata: ChunkMetadataSchema,
  embedding: z.array(z.number()).optional(),
  tokenCount: z.number(),
  charCount: z.number(),
});

export type ChunkMetadata = z.infer<typeof ChunkMetadataSchema>;
export type Chunk = z.infer<typeof ChunkSchema>;

export interface ChunkConfig {
  chunkSize: number; // Target chunk size in characters
  chunkOverlap: number; // Overlap between chunks in characters
  maxChunkSize: number; // Maximum chunk size
  embeddingModel?: string; // Model to use for embedding
}

export interface PipelineInput {
  content: string;
  metadata: Omit<ChunkMetadata, "chunkIndex" | "totalChunks">;
  config?: Partial<ChunkConfig>;
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ChunkConfig = {
  chunkSize: 1000,
  chunkOverlap: 200,
  maxChunkSize: 2000,
  embeddingModel: "text-embedding-3-small",
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ChunkEmbedPipeline {
  private static instance: ChunkEmbedPipeline;
  private config: ChunkConfig;

  private constructor(config: Partial<ChunkConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static getInstance(config?: Partial<ChunkConfig>): ChunkEmbedPipeline {
    if (!ChunkEmbedPipeline.instance) {
      ChunkEmbedPipeline.instance = new ChunkEmbedPipeline(config);
    }
    return ChunkEmbedPipeline.instance;
  }

  /**
   * Process content through chunk and embed pipeline
   */
  async process(input: PipelineInput): Promise<Chunk[]> {
    const config = { ...this.config, ...input.config };

    // Step 1: Chunk the content
    const chunks = this.chunkContent(input.content, input.metadata, config);

    // Step 2: Generate embeddings
    const chunksWithEmbeddings = await this.embedChunks(chunks);

    logger.info("ChunkEmbedPipeline processed content", {
      documentId: input.metadata.documentId,
      chunksCreated: chunks.length,
      totalChars: input.content.length,
    });

    return chunksWithEmbeddings;
  }

  /**
   * Chunk SEC filing content by section
   */
  async processSECFiling(
    content: string,
    metadata: Omit<ChunkMetadata, "chunkIndex" | "totalChunks" | "source" | "tier">,
    config?: Partial<ChunkConfig>
  ): Promise<Chunk[]> {
    // First extract sections
    const sections = this.extractFilingSections(content);

    const allChunks: Chunk[] = [];
    for (const [sectionName, sectionContent] of Object.entries(sections)) {
      if (!sectionContent) continue;

      const sectionChunks = await this.process({
        content: sectionContent,
        metadata: {
          ...metadata,
          source: "sec_filing",
          tier: "tier_1_sec",
          section: sectionName,
        },
        config,
      });

      allChunks.push(...sectionChunks);
    }

    return allChunks;
  }

  /**
   * Chunk web content by paragraph
   */
  async processWebContent(
    content: string,
    metadata: Omit<ChunkMetadata, "chunkIndex" | "totalChunks" | "source" | "tier"> & { pageTitle: string },
    config?: Partial<ChunkConfig>
  ): Promise<Chunk[]> {
    // Split by paragraphs first
    const paragraphs = content.split(/\n\s*\n/).filter((p) => p.trim().length > 50);

    const allChunks: Chunk[] = [];
    let currentChunk = "";
    const targetSize = config?.chunkSize || this.config.chunkSize;

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > targetSize && currentChunk.length > 0) {
        // Process current chunk
        const chunks = await this.process({
          content: currentChunk,
          metadata: {
            ...metadata,
            source: "web_content",
            tier: "tier_2_benchmark",
            section: metadata.pageTitle,
          },
          config,
        });
        allChunks.push(...chunks);
        currentChunk = paragraph;
      } else {
        currentChunk += "\n\n" + paragraph;
      }
    }

    // Process remaining content
    if (currentChunk.trim().length > 0) {
      const chunks = await this.process({
        content: currentChunk,
        metadata: {
          ...metadata,
          source: "web_content",
          tier: "tier_2_benchmark",
          section: metadata.pageTitle,
        },
        config,
      });
      allChunks.push(...chunks);
    }

    return allChunks;
  }

  /**
   * Store chunks in semantic_memory
   */
  async storeChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const tenantId = chunks[0]?.metadata.tenantId;
    const documentId = chunks[0]?.metadata.documentId;

    logger.info("ChunkEmbedPipeline: inserting chunks into semantic_memory", {
      chunkCount: chunks.length,
      tenantId,
      documentId,
    });

    const supabase = createServerSupabaseClient();

    const rows = chunks.map((chunk) => ({
      content: chunk.content,
      embedding: chunk.embedding ?? null,
      metadata: {
        documentId: chunk.metadata.documentId,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
        source: chunk.metadata.source,
        sourceType: chunk.metadata.sourceType,
        title: chunk.metadata.title,
        url: chunk.metadata.url,
        language: chunk.metadata.language,
        tokenCount: chunk.metadata.tokenCount,
      },
      tenant_id: chunk.metadata.tenantId,
    }));

    // Insert in batches of 100 to stay within Supabase request size limits.
    const BATCH_SIZE = 100;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);

      const { error } = await supabase.from("semantic_memory").insert(batch);

      if (error) {
        logger.error("ChunkEmbedPipeline: failed to insert chunk batch", {
          tenantId,
          documentId,
          batchStart: i,
          batchSize: batch.length,
          error: error.message,
        });
        throw new Error(`Failed to store chunks in semantic_memory: ${error.message}`);
      }
    }

    logger.info("ChunkEmbedPipeline: chunks stored successfully", {
      chunkCount: chunks.length,
      tenantId,
      documentId,
    });
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private chunkContent(
    content: string,
    baseMetadata: Omit<ChunkMetadata, "chunkIndex" | "totalChunks">,
    config: ChunkConfig
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const { chunkSize, chunkOverlap, maxChunkSize } = config;

    // Clean content
    const cleanContent = this.cleanContent(content);

    // Split into sentences (rough approximation)
    const sentences = cleanContent.match(/[^.!?]+[.!?]+/g) || [cleanContent];

    let currentChunk = "";
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;

      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(this.createChunk(currentChunk, baseMetadata, chunkIndex, config));
        chunkIndex++;

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, chunkOverlap);
        currentChunk = overlapText + sentence;
      } else {
        currentChunk += (currentChunk ? " " : "") + sentence;
      }

      // Force chunk if max size reached
      if (currentChunk.length > maxChunkSize) {
        chunks.push(this.createChunk(currentChunk, baseMetadata, chunkIndex, config));
        chunkIndex++;
        currentChunk = "";
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push(this.createChunk(currentChunk, baseMetadata, chunkIndex, config));
    }

    // Update total chunks count
    const totalChunks = chunks.length;
    return chunks.map((chunk) => ({
      ...chunk,
      metadata: { ...chunk.metadata, totalChunks },
    }));
  }

  private createChunk(
    content: string,
    baseMetadata: Omit<ChunkMetadata, "chunkIndex" | "totalChunks">,
    chunkIndex: number,
    config: ChunkConfig
  ): Chunk {
    return {
      id: `${baseMetadata.documentId}-${chunkIndex}`,
      content: content.trim(),
      metadata: {
        ...baseMetadata,
        chunkIndex,
        totalChunks: 0, // Will be updated later
      },
      tokenCount: this.estimateTokenCount(content),
      charCount: content.length,
    };
  }

  private async embedChunks(chunks: Chunk[]): Promise<Chunk[]> {
    // In production, this would call the embedding service
    // For now, return chunks without embeddings (they'll be generated on store)
    return chunks.map((chunk) => ({
      ...chunk,
      embedding: undefined, // Will be generated during storage
    }));
  }

  private extractFilingSections(content: string): Record<string, string> {
    const sections: Record<string, string> = {
      full_text: content,
    };

    // Try to extract Item 1 (Business)
    const item1Match = content.match(/ITEM\s+1[.\s]+BUSINESS/i);
    if (item1Match) {
      const start = item1Match.index ?? 0;
      const end = content.search(/ITEM\s+1A[.\s]+RISK/i) || content.search(/ITEM\s+2[.\s]/i) || start + 10000;
      sections.item_1_business = content.slice(start, end).substring(0, 8000);
    }

    // Try to extract Item 1A (Risk Factors)
    const item1aMatch = content.match(/ITEM\s+1A[.\s]+RISK\s+FACTORS/i);
    if (item1aMatch) {
      const start = item1aMatch.index ?? 0;
      const end = content.search(/ITEM\s+1B[.\s]/i) || content.search(/ITEM\s+2[.\s]/i) || start + 10000;
      sections.item_1a_risk_factors = content.slice(start, end).substring(0, 8000);
    }

    // Try to extract Item 7 (MD&A)
    const item7Match = content.match(/ITEM\s+7[.\s]+MANAGEMENT.*?DISCUSSION/i);
    if (item7Match) {
      const start = item7Match.index ?? 0;
      const end = content.search(/ITEM\s+7A[.\s]/i) || content.search(/ITEM\s+8[.\s]/i) || start + 10000;
      sections.item_7_md_and_a = content.slice(start, end).substring(0, 8000);
    }

    return sections;
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, " ") // Normalize whitespace
      .replace(/\n+/g, "\n") // Normalize newlines
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .trim();
  }

  private getOverlapText(content: string, overlapSize: number): string {
    // Get the last N characters for overlap
    const sentences = content.match(/[^.!?]+[.!?]+/g) || [];
    let overlap = "";

    for (let i = sentences.length - 1; i >= 0; i--) {
      const candidate = sentences[i] + overlap;
      if (candidate.length > overlapSize) break;
      overlap = candidate;
    }

    return overlap;
  }

  private estimateTokenCount(content: string): number {
    // Rough approximation: ~4 characters per token for English text
    return Math.ceil(content.length / 4);
  }
}

// Singleton export
export const chunkEmbedPipeline = ChunkEmbedPipeline.getInstance();
