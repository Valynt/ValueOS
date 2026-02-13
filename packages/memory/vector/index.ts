/**
 * @valueos/memory/vector
 *
 * Vector store adapters for embeddings and hybrid retrieval.
 *
 * Wraps the `memory_hybrid_search_chunks()` and `memory_match_chunks()`
 * DB functions with a TypeScript API. Defaults to 70/30 vector/BM25
 * weighting — pure vector search misses specific terms and SKU numbers
 * that keyword search catches.
 *
 * Every search result can carry its provenance chain so the "CFO Defence"
 * holds end-to-end: a value is only as good as its lowest-confidence link.
 */

import { z } from 'zod';
import type { ProvenanceRecord } from '../provenance/index.js';

// ============================================================================
// Types
// ============================================================================

export interface VectorChunk {
  id: string;
  artifactId: string;
  content: string;
  embedding: number[];
  chunkIndex: number;
  metadata: Record<string, unknown>;
  tenantId: string;
}

export interface HybridSearchResult {
  chunk: VectorChunk;
  /** Cosine similarity score (0–1) */
  similarity: number;
  /** BM25 full-text rank */
  ftsRank: number;
  /** Weighted combination of similarity and ftsRank */
  combinedScore: number;
  /** Attached when `attachProvenance` is true */
  provenance?: ProvenanceRecord | null;
  /** Confidence assessment for the transparency layer */
  confidence: ConfidenceAssessment;
}

export interface VectorSearchResult {
  chunk: VectorChunk;
  similarity: number;
  provenance?: ProvenanceRecord | null;
  confidence: ConfidenceAssessment;
}

export interface ConfidenceAssessment {
  score: number;
  isLowConfidence: boolean;
  /** Human-readable explanation for the UI transparency layer */
  label: string;
}

// ============================================================================
// Constants
// ============================================================================

/** Default vector weight in hybrid search (70%) */
const DEFAULT_VECTOR_WEIGHT = 0.7;

/** Default BM25 weight in hybrid search (30%) */
const DEFAULT_FTS_WEIGHT = 0.3;

/**
 * Below this threshold, results are flagged as low-confidence.
 * The system must explicitly state: "I'm making a low-confidence
 * hypothesis based on [X]."
 */
const LOW_CONFIDENCE_THRESHOLD = 0.7;

// ============================================================================
// Zod Schemas
// ============================================================================

export const HybridSearchOptionsSchema = z.object({
  queryText: z.string().min(1).max(10_000),
  queryEmbedding: z.array(z.number()).length(1536),
  tenantId: z.string().uuid(),
  valueCaseId: z.string().uuid().optional(),
  threshold: z.number().min(0).max(1).default(0.7),
  limit: z.number().int().min(1).max(100).default(10),
  vectorWeight: z.number().min(0).max(1).default(DEFAULT_VECTOR_WEIGHT),
  ftsWeight: z.number().min(0).max(1).default(DEFAULT_FTS_WEIGHT),
  attachProvenance: z.boolean().default(true),
});

export type HybridSearchOptions = z.infer<typeof HybridSearchOptionsSchema>;

export const VectorSearchOptionsSchema = z.object({
  queryEmbedding: z.array(z.number()).length(1536),
  tenantId: z.string().uuid(),
  valueCaseId: z.string().uuid().optional(),
  threshold: z.number().min(0).max(1).default(0.7),
  limit: z.number().int().min(1).max(100).default(10),
  attachProvenance: z.boolean().default(true),
});

export type VectorSearchOptions = z.infer<typeof VectorSearchOptionsSchema>;

export const ChunkInputSchema = z.object({
  artifactId: z.string().uuid(),
  content: z.string().min(1).max(50_000),
  embedding: z.array(z.number()).length(1536),
  chunkIndex: z.number().int().min(0),
  metadata: z.record(z.unknown()).default({}),
  tenantId: z.string().uuid(),
});

export type ChunkInput = z.infer<typeof ChunkInputSchema>;

// ============================================================================
// Persistence Interface (dependency injection)
// ============================================================================

export interface VectorStore {
  insertChunk(chunk: VectorChunk): Promise<void>;
  insertChunks(chunks: VectorChunk[]): Promise<void>;

  /**
   * Hybrid search combining cosine similarity + BM25 full-text ranking.
   * Maps to `memory_hybrid_search_chunks()`.
   */
  hybridSearch(
    queryText: string,
    queryEmbedding: number[],
    tenantId: string,
    options: {
      threshold: number;
      limit: number;
      vectorWeight: number;
      ftsWeight: number;
      valueCaseId?: string;
    },
  ): Promise<Array<{ chunk: VectorChunk; similarity: number; ftsRank: number; combinedScore: number }>>;

  /**
   * Pure vector similarity search.
   * Maps to `memory_match_chunks()`.
   */
  vectorSearch(
    queryEmbedding: number[],
    tenantId: string,
    options: {
      threshold: number;
      limit: number;
      valueCaseId?: string;
    },
  ): Promise<Array<{ chunk: VectorChunk; similarity: number }>>;

  /** Fetch provenance for a chunk (via memory_provenance table) */
  getProvenance(chunkId: string): Promise<ProvenanceRecord | null>;

  /** Delete all chunks for an artifact (used during re-indexing) */
  deleteByArtifactId(artifactId: string): Promise<number>;
}

// ============================================================================
// Confidence Assessment
// ============================================================================

function assessConfidence(score: number): ConfidenceAssessment {
  if (score >= 0.9) {
    return { score, isLowConfidence: false, label: 'High confidence' };
  }
  if (score >= LOW_CONFIDENCE_THRESHOLD) {
    return { score, isLowConfidence: false, label: 'Moderate confidence' };
  }
  return {
    score,
    isLowConfidence: true,
    label: `Low-confidence hypothesis (${(score * 100).toFixed(0)}%)`,
  };
}

// ============================================================================
// VectorMemory
// ============================================================================

export class VectorMemory {
  private store: VectorStore;

  constructor(store: VectorStore) {
    this.store = store;
  }

  // --------------------------------------------------------------------------
  // Write path
  // --------------------------------------------------------------------------

  /**
   * Index a single document chunk into the vector store.
   */
  async indexChunk(input: ChunkInput): Promise<VectorChunk> {
    const validated = ChunkInputSchema.parse(input);

    const chunk: VectorChunk = {
      id: crypto.randomUUID(),
      artifactId: validated.artifactId,
      content: validated.content,
      embedding: validated.embedding,
      chunkIndex: validated.chunkIndex,
      metadata: validated.metadata,
      tenantId: validated.tenantId,
    };

    await this.store.insertChunk(chunk);
    return chunk;
  }

  /**
   * Index multiple chunks in a batch (e.g., after chunking a document).
   */
  async indexChunks(inputs: ChunkInput[]): Promise<VectorChunk[]> {
    const chunks: VectorChunk[] = inputs.map((input) => {
      const validated = ChunkInputSchema.parse(input);
      return {
        id: crypto.randomUUID(),
        artifactId: validated.artifactId,
        content: validated.content,
        embedding: validated.embedding,
        chunkIndex: validated.chunkIndex,
        metadata: validated.metadata,
        tenantId: validated.tenantId,
      };
    });

    await this.store.insertChunks(chunks);
    return chunks;
  }

  /**
   * Re-index an artifact by deleting existing chunks and inserting new ones.
   */
  async reindex(artifactId: string, inputs: ChunkInput[]): Promise<VectorChunk[]> {
    await this.store.deleteByArtifactId(artifactId);
    return this.indexChunks(inputs);
  }

  // --------------------------------------------------------------------------
  // Read path: hybrid search (default) and pure vector search
  // --------------------------------------------------------------------------

  /**
   * Hybrid search — the primary retrieval path.
   *
   * Combines vector cosine similarity (70% default) with BM25 full-text
   * ranking (30% default). Pure vector search often misses specific
   * technical terms or SKU numbers that keyword search catches.
   *
   * Results below the confidence threshold are flagged so the system
   * can state: "I'm making a low-confidence hypothesis based on [X]."
   */
  async hybridSearch(options: HybridSearchOptions): Promise<HybridSearchResult[]> {
    const validated = HybridSearchOptionsSchema.parse(options);

    const raw = await this.store.hybridSearch(
      validated.queryText,
      validated.queryEmbedding,
      validated.tenantId,
      {
        threshold: validated.threshold,
        limit: validated.limit,
        vectorWeight: validated.vectorWeight,
        ftsWeight: validated.ftsWeight,
        valueCaseId: validated.valueCaseId,
      },
    );

    const results: HybridSearchResult[] = [];

    for (const entry of raw) {
      let provenance: ProvenanceRecord | null | undefined;

      if (validated.attachProvenance) {
        provenance = await this.store.getProvenance(entry.chunk.id);
      }

      results.push({
        chunk: entry.chunk,
        similarity: entry.similarity,
        ftsRank: entry.ftsRank,
        combinedScore: entry.combinedScore,
        provenance: validated.attachProvenance ? provenance : undefined,
        confidence: assessConfidence(entry.combinedScore),
      });
    }

    return results;
  }

  /**
   * Pure vector similarity search.
   *
   * Use when you only have an embedding (no query text) or when BM25
   * ranking is not applicable. Prefer `hybridSearch` for most cases.
   */
  async vectorSearch(options: VectorSearchOptions): Promise<VectorSearchResult[]> {
    const validated = VectorSearchOptionsSchema.parse(options);

    const raw = await this.store.vectorSearch(
      validated.queryEmbedding,
      validated.tenantId,
      {
        threshold: validated.threshold,
        limit: validated.limit,
        valueCaseId: validated.valueCaseId,
      },
    );

    const results: VectorSearchResult[] = [];

    for (const entry of raw) {
      let provenance: ProvenanceRecord | null | undefined;

      if (validated.attachProvenance) {
        provenance = await this.store.getProvenance(entry.chunk.id);
      }

      results.push({
        chunk: entry.chunk,
        similarity: entry.similarity,
        provenance: validated.attachProvenance ? provenance : undefined,
        confidence: assessConfidence(entry.similarity),
      });
    }

    return results;
  }
}
