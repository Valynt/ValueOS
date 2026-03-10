/**
 * SupabaseSemanticStore
 *
 * Implements the SemanticStore interface against the semantic_memory table
 * and match_semantic_memory RPC introduced in Sprint 12.
 *
 * All queries are scoped to organization_id — no cross-tenant reads.
 */

import { createLogger } from '@shared/lib/logger';
import { createServerSupabaseClient } from '../supabase.js';

import type {
  SemanticFact,
  SemanticFactStatus,
  SemanticFactType,
  SemanticStore,
} from '@valueos/memory';
import type { SemanticFactProvenance } from '@valueos/memory';

const logger = createLogger({ service: 'SupabaseSemanticStore' });

// ---------------------------------------------------------------------------
// DB row shape (matches 20260322000000_persistent_memory_tables.sql)
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

function rowToFact(row: SemanticMemoryRow): SemanticFact {
  const meta = row.metadata ?? {};
  return {
    id: row.id,
    type: row.type as SemanticFactType,
    content: row.content,
    embedding: row.embedding ?? [],
    metadata: meta,
    status: (meta['status'] as SemanticFactStatus | undefined) ?? 'draft',
    version: typeof meta['version'] === 'number' ? meta['version'] : 1,
    organizationId: row.organization_id,
    confidenceScore: typeof meta['confidence_score'] === 'number' ? meta['confidence_score'] : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: typeof meta['created_by'] === 'string' ? meta['created_by'] : undefined,
  };
}

// ---------------------------------------------------------------------------
// SupabaseSemanticStore
// ---------------------------------------------------------------------------

export class SupabaseSemanticStore implements SemanticStore {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  async insert(fact: SemanticFact): Promise<void> {
    const { error } = await this.supabase
      .from('semantic_memory')
      .insert({
        id: fact.id,
        organization_id: fact.organizationId,
        type: fact.type,
        content: fact.content,
        embedding: fact.embedding.length > 0 ? fact.embedding : null,
        metadata: {
          ...fact.metadata,
          status: fact.status,
          version: fact.version,
          confidence_score: fact.confidenceScore,
          created_by: fact.createdBy,
        },
        source_agent: (fact.metadata['source_agent'] as string | undefined) ?? 'unknown',
        session_id: (fact.metadata['session_id'] as string | undefined) ?? null,
      });

    if (error) {
      logger.error('SupabaseSemanticStore.insert failed', {
        factId: fact.id,
        orgId: fact.organizationId,
        error: error.message,
      });
      throw new Error(`Failed to insert semantic fact: ${error.message}`);
    }
  }

  async update(
    id: string,
    updates: Partial<Pick<SemanticFact, 'status' | 'version' | 'updatedAt' | 'metadata'>>,
  ): Promise<void> {
    // Fetch current metadata to merge
    const { data: existing, error: fetchError } = await this.supabase
      .from('semantic_memory')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      throw new Error(`Semantic fact not found for update: ${id}`);
    }

    const currentMeta = (existing as { metadata: Record<string, unknown> }).metadata ?? {};
    const mergedMeta: Record<string, unknown> = {
      ...currentMeta,
      ...(updates.metadata ?? {}),
    };
    if (updates.status !== undefined) mergedMeta['status'] = updates.status;
    if (updates.version !== undefined) mergedMeta['version'] = updates.version;

    const { error } = await this.supabase
      .from('semantic_memory')
      .update({
        metadata: mergedMeta,
        updated_at: updates.updatedAt ?? new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      logger.error('SupabaseSemanticStore.update failed', { id, error: error.message });
      throw new Error(`Failed to update semantic fact: ${error.message}`);
    }
  }

  async findById(id: string): Promise<SemanticFact | null> {
    const { data, error } = await this.supabase
      .from('semantic_memory')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('SupabaseSemanticStore.findById failed', { id, error: error.message });
      throw new Error(`Failed to fetch semantic fact: ${error.message}`);
    }

    return data ? rowToFact(data as SemanticMemoryRow) : null;
  }

  async findByOrganization(
    organizationId: string,
    type?: SemanticFactType,
  ): Promise<SemanticFact[]> {
    let query = this.supabase
      .from('semantic_memory')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type) as typeof query;
    }

    const { data, error } = await query;

    if (error) {
      logger.error('SupabaseSemanticStore.findByOrganization failed', {
        organizationId,
        error: error.message,
      });
      throw new Error(`Failed to list semantic facts: ${error.message}`);
    }

    return (data as SemanticMemoryRow[]).map(rowToFact);
  }

  async searchByEmbedding(
    embedding: number[],
    organizationId: string,
    options: {
      threshold: number;
      limit: number;
      type?: SemanticFactType;
      statusFilter?: SemanticFactStatus[];
    },
  ): Promise<Array<{ fact: SemanticFact; similarity: number }>> {
    const { data, error } = await this.supabase.rpc('match_semantic_memory', {
      query_embedding: embedding,
      p_organization_id: organizationId,
      match_threshold: options.threshold,
      match_count: options.limit,
      p_type: options.type ?? null,
    });

    if (error) {
      logger.error('SupabaseSemanticStore.searchByEmbedding failed', {
        organizationId,
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

    // Apply status filter client-side (RPC doesn't expose status column)
    const filtered = options.statusFilter
      ? rows.filter((r) => {
          const status = (r.metadata['status'] as string | undefined) ?? 'draft';
          return options.statusFilter!.includes(status as SemanticFactStatus);
        })
      : rows;

    return filtered.map((r) => ({
      fact: {
        id: r.id,
        type: r.type as SemanticFactType,
        content: r.content,
        embedding: [],
        metadata: r.metadata,
        status: ((r.metadata['status'] as string | undefined) ?? 'draft') as SemanticFactStatus,
        version: typeof r.metadata['version'] === 'number' ? r.metadata['version'] : 1,
        organizationId,
        confidenceScore:
          typeof r.metadata['confidence_score'] === 'number' ? r.metadata['confidence_score'] : 0,
        createdAt: r.created_at,
        updatedAt: r.created_at,
        createdBy:
          typeof r.metadata['created_by'] === 'string' ? r.metadata['created_by'] : undefined,
      },
      similarity: r.similarity,
    }));
  }

  async getProvenance(factId: string): Promise<SemanticFactProvenance | null> {
    // Provenance is stored in metadata.provenance if present
    const { data, error } = await this.supabase
      .from('semantic_memory')
      .select('metadata')
      .eq('id', factId)
      .maybeSingle();

    if (error || !data) return null;

    const meta = (data as { metadata: Record<string, unknown> }).metadata ?? {};
    const prov = meta['provenance'] as Record<string, unknown> | undefined;
    if (!prov) return null;

    return {
      source: (prov['source'] as string | undefined) ?? 'unknown',
      sourceId: prov['source_id'] as string | undefined,
      confidenceScore: typeof prov['confidence_score'] === 'number' ? prov['confidence_score'] : 0,
      evidenceTier: (prov['evidence_tier'] as 1 | 2 | 3 | undefined) ?? 3,
      lineageDepth: typeof prov['lineage_depth'] === 'number' ? prov['lineage_depth'] : 0,
    };
  }
}
