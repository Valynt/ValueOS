/**
 * SupabaseVectorStore
 *
 * Implements the VectorStore interface against the semantic_memory table
 * using the match_semantic_memory and match_semantic_memory_hybrid RPCs
 * introduced in Sprint 12.
 *
 * Chunks are stored as semantic_memory rows with type='workflow_result'
 * and metadata containing the artifactId, chunkIndex, and tenantId.
 * All queries are scoped to tenantId (organization_id).
 */

import { createLogger } from '@shared/lib/logger';
import type { ProvenanceRecord } from '@valueos/memory';
import type { VectorChunk, VectorStore } from '@valueos/memory';

// service-role:justified worker/service requires elevated DB access for background processing
import { createWorkerServiceSupabaseClient } from '../supabase/privileged/index.js';

const logger = createLogger({ service: 'SupabaseVectorStore' });

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

interface SemanticMemoryRow {
  id: string;
  organization_id: string;
  type: string;
  content: string;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  source_agent: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function rowToChunk(row: SemanticMemoryRow): VectorChunk {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    artifactId: (meta['artifact_id'] as string | undefined) ?? row.id,
    content: row.content,
    embedding: row.embedding ?? [],
    chunkIndex: typeof meta['chunk_index'] === 'number' ? meta['chunk_index'] : 0,
    metadata: meta,
    tenantId: row.organization_id,
  };
}

function chunkToInsert(chunk: VectorChunk): Record<string, unknown> {
  return {
    id: chunk.id,
    organization_id: chunk.tenantId,
    type: 'workflow_result',
    content: chunk.content,
    embedding: chunk.embedding.length > 0 ? chunk.embedding : null,
    metadata: {
      ...chunk.metadata,
      artifact_id: chunk.artifactId,
      chunk_index: chunk.chunkIndex,
    },
    source_agent: (chunk.metadata['source_agent'] as string | undefined) ?? 'unknown',
    session_id: (chunk.metadata['session_id'] as string | undefined) ?? null,
  };
}

// ---------------------------------------------------------------------------
// SupabaseVectorStore
// ---------------------------------------------------------------------------

export class SupabaseVectorStore implements VectorStore {
  private supabase: ReturnType<typeof createWorkerServiceSupabaseClient>;

  constructor() {
    // service-role:justified SupabaseVectorStore writes/reads agent memory embeddings across tenant boundary in worker context
    this.supabase = createWorkerServiceSupabaseClient('SupabaseVectorStore: read/write agent memory embeddings');
  }

  async insertChunk(chunk: VectorChunk): Promise<void> {
    const { error } = await this.supabase
      .from('semantic_memory')
      .insert(chunkToInsert(chunk));

    if (error) {
      logger.error('SupabaseVectorStore.insertChunk failed', {
        chunkId: chunk.id,
        tenantId: chunk.tenantId,
        error: error.message,
      });
      throw new Error(`Failed to insert chunk: ${error.message}`);
    }
  }

  async insertChunks(chunks: VectorChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const { error } = await this.supabase
      .from('semantic_memory')
      .insert(chunks.map(chunkToInsert));

    if (error) {
      logger.error('SupabaseVectorStore.insertChunks failed', {
        count: chunks.length,
        tenantId: chunks[0]?.tenantId,
        error: error.message,
      });
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }

  async hybridSearch(
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
  ): Promise<Array<{ chunk: VectorChunk; similarity: number; ftsRank: number; combinedScore: number }>> {
    const { data, error } = await this.supabase.rpc('match_semantic_memory_hybrid', {
      query_embedding: queryEmbedding,
      query_text: queryText,
      p_organization_id: tenantId,
      match_threshold: options.threshold,
      match_count: options.limit,
      p_type: null,
    });

    if (error) {
      logger.error('SupabaseVectorStore.hybridSearch failed', {
        tenantId,
        error: error.message,
      });
      throw new Error(`Hybrid search failed: ${error.message}`);
    }

    type RpcRow = {
      id: string;
      type: string;
      content: string;
      metadata: Record<string, unknown>;
      source_agent: string;
      session_id: string | null;
      similarity: number;
      created_at: string;
    };

    const rows = (data as RpcRow[]) ?? [];

    // Filter by valueCaseId if provided
    const filtered = options.valueCaseId
      ? rows.filter((r) => r.metadata['artifact_id'] === options.valueCaseId ||
          r.metadata['value_case_id'] === options.valueCaseId)
      : rows;

    return filtered.map((r) => {
      const chunk: VectorChunk = {
        id: r.id,
        artifactId: (r.metadata['artifact_id'] as string | undefined) ?? r.id,
        content: r.content,
        embedding: [],
        chunkIndex: typeof r.metadata['chunk_index'] === 'number' ? r.metadata['chunk_index'] : 0,
        metadata: r.metadata,
        tenantId,
      };
      // The RPC blends vector + FTS internally; expose similarity as combinedScore
      return {
        chunk,
        similarity: r.similarity,
        ftsRank: 0,
        combinedScore: r.similarity,
      };
    });
  }

  async vectorSearch(
    queryEmbedding: number[],
    tenantId: string,
    options: {
      threshold: number;
      limit: number;
      valueCaseId?: string;
    },
  ): Promise<Array<{ chunk: VectorChunk; similarity: number }>> {
    const { data, error } = await this.supabase.rpc('match_semantic_memory', {
      query_embedding: queryEmbedding,
      p_organization_id: tenantId,
      match_threshold: options.threshold,
      match_count: options.limit,
      p_type: null,
    });

    if (error) {
      logger.error('SupabaseVectorStore.vectorSearch failed', {
        tenantId,
        error: error.message,
      });
      throw new Error(`Vector search failed: ${error.message}`);
    }

    type RpcRow = {
      id: string;
      type: string;
      content: string;
      metadata: Record<string, unknown>;
      source_agent: string;
      session_id: string | null;
      similarity: number;
      created_at: string;
    };

    const rows = (data as RpcRow[]) ?? [];

    const filtered = options.valueCaseId
      ? rows.filter((r) => r.metadata['artifact_id'] === options.valueCaseId ||
          r.metadata['value_case_id'] === options.valueCaseId)
      : rows;

    return filtered.map((r) => ({
      chunk: {
        id: r.id,
        artifactId: (r.metadata['artifact_id'] as string | undefined) ?? r.id,
        content: r.content,
        embedding: [],
        chunkIndex: typeof r.metadata['chunk_index'] === 'number' ? r.metadata['chunk_index'] : 0,
        metadata: r.metadata,
        tenantId,
      },
      similarity: r.similarity,
    }));
  }

  async getProvenance(chunkId: string): Promise<ProvenanceRecord | null> {
    const { data, error } = await this.supabase
      .from('semantic_memory')
      .select('metadata, organization_id, created_at')
      .eq('id', chunkId)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as { metadata: Record<string, unknown>; organization_id: string; created_at: string };
    const prov = row.metadata['provenance'] as Record<string, unknown> | undefined;
    if (!prov) return null;

    return {
      id: (prov['id'] as string | undefined) ?? chunkId,
      valueCaseId: (prov['value_case_id'] as string | undefined) ?? '',
      claimId: (prov['claim_id'] as string | undefined) ?? '',
      dataSource: (prov['data_source'] as string | undefined) ?? 'unknown',
      evidenceTier: (prov['evidence_tier'] as 1 | 2 | 3 | undefined) ?? 3,
      formula: prov['formula'] as string | undefined,
      agentId: (prov['agent_id'] as string | undefined) ?? 'unknown',
      agentVersion: (prov['agent_version'] as string | undefined) ?? '0.0.0',
      confidenceScore: typeof prov['confidence_score'] === 'number' ? prov['confidence_score'] : 0,
      createdAt: row.created_at,
      parentRecordId: prov['parent_record_id'] as string | undefined,
    };
  }

  async deleteByArtifactId(artifactId: string, tenantId: string): Promise<number> {
    if (tenantId === '') {
      throw new Error('tenantId is required');
    }

    const query = this.supabase
      .from('semantic_memory')
      .delete()
      .eq('metadata->>artifact_id', artifactId)
      .eq('organization_id', tenantId);

    const { data, error } = await query.select('id');

    if (error) {
      logger.error('SupabaseVectorStore.deleteByArtifactId failed', {
        artifactId,
        tenantId,
        error: error.message,
      });
      throw new Error(`Failed to delete chunks: ${error.message}`);
    }

    return (data as { id: string }[])?.length ?? 0;
  }
}
