/**
 * @valueos/memory/episodic
 *
 * Episodic memory — events, interactions, experiences.
 *
 * Records are immutable: they can be deprecated but never edited.
 * Retrieval is importance-weighted, not just recency-based, so agents
 * get the most relevant historical context for a given value case.
 *
 * Stored in `agent_memory` with `memory_type: 'episodic'`.
 * Episodic records are exempt from automatic TTL pruning.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface EpisodicRecord {
  id: string;
  sessionId: string;
  agentId: string;
  organizationId: string;
  content: string;
  metadata: Record<string, unknown>;
  importanceScore: number;
  valueCaseId?: string;
  /** Deprecated records are hidden from default queries but never deleted */
  deprecated: boolean;
  createdAt: string;
  /** Last time this record was surfaced in a retrieval query */
  accessedAt: string;
}

export interface EpisodicSearchResult {
  record: EpisodicRecord;
  /** Composite score combining importance and optional similarity */
  relevanceScore: number;
}

export interface EpisodicContext {
  /** The most important historical interactions for the current context */
  records: EpisodicSearchResult[];
  /** Total episodic records available for this scope */
  totalAvailable: number;
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const EpisodicRecordInputSchema = z.object({
  sessionId: z.string().uuid(),
  agentId: z.string().uuid(),
  organizationId: z.string().uuid(),
  content: z.string().min(1).max(100_000),
  metadata: z.record(z.unknown()).default({}),
  importanceScore: z.number().min(0).max(1).default(0.5),
  valueCaseId: z.string().uuid().optional(),
});

export type EpisodicRecordInput = z.infer<typeof EpisodicRecordInputSchema>;

export const EpisodicRetrievalOptionsSchema = z.object({
  organizationId: z.string().uuid(),
  /** Filter to a specific value case for targeted context */
  valueCaseId: z.string().uuid().optional(),
  /** Filter to a specific session */
  sessionId: z.string().uuid().optional(),
  /** Filter to a specific agent */
  agentId: z.string().uuid().optional(),
  /**
   * Number of records to return. Defaults to 3 — the top-importance
   * records, not the most recent. Use `recentCount` for recency.
   */
  limit: z.number().int().min(1).max(50).default(3),
  /**
   * Minimum importance score to include. Filters out low-signal noise.
   */
  minImportance: z.number().min(0).max(1).default(0.0),
  /** Include deprecated records (default: false) */
  includeDeprecated: z.boolean().default(false),
});

export type EpisodicRetrievalOptions = z.infer<typeof EpisodicRetrievalOptionsSchema>;

// ============================================================================
// Persistence Interface (dependency injection)
// ============================================================================

export interface EpisodicStore {
  insert(record: EpisodicRecord): Promise<void>;

  /**
   * Mark a record as deprecated. The store must NOT delete or modify
   * the original content — only set the deprecated flag.
   */
  deprecate(id: string): Promise<void>;

  findById(id: string): Promise<EpisodicRecord | null>;

  /**
   * Retrieve records ordered by importance_score DESC.
   * This is the primary retrieval path — importance over recency.
   */
  findByImportance(
    organizationId: string,
    options: {
      valueCaseId?: string;
      sessionId?: string;
      agentId?: string;
      minImportance: number;
      limit: number;
      includeDeprecated: boolean;
    },
  ): Promise<EpisodicRecord[]>;

  /**
   * Count total records matching the scope (for context metadata).
   */
  count(
    organizationId: string,
    options: {
      valueCaseId?: string;
      sessionId?: string;
      includeDeprecated: boolean;
    },
  ): Promise<number>;

  /**
   * Update the `accessed_at` timestamp when a record is surfaced.
   * This is the only mutation allowed on episodic records.
   */
  touchAccessedAt(ids: string[]): Promise<void>;
}

// ============================================================================
// EpisodicMemory
// ============================================================================

export class EpisodicMemory {
  private store: EpisodicStore;

  constructor(store: EpisodicStore) {
    this.store = store;
  }

  // --------------------------------------------------------------------------
  // Write path: append-only
  // --------------------------------------------------------------------------

  /**
   * Record a new episodic memory entry. Immutable once written.
   */
  async record(input: EpisodicRecordInput): Promise<EpisodicRecord> {
    const validated = EpisodicRecordInputSchema.parse(input);
    const now = new Date().toISOString();

    const record: EpisodicRecord = {
      id: crypto.randomUUID(),
      sessionId: validated.sessionId,
      agentId: validated.agentId,
      organizationId: validated.organizationId,
      content: validated.content,
      metadata: validated.metadata,
      importanceScore: validated.importanceScore,
      valueCaseId: validated.valueCaseId,
      deprecated: false,
      createdAt: now,
      accessedAt: now,
    };

    await this.store.insert(record);
    return record;
  }

  /**
   * Deprecate an episodic record. The record remains in storage
   * but is excluded from default retrieval queries.
   */
  async deprecate(id: string): Promise<void> {
    const record = await this.store.findById(id);
    if (!record) throw new Error(`Episodic record not found: ${id}`);
    await this.store.deprecate(id);
  }

  // --------------------------------------------------------------------------
  // Read path: importance-weighted context injection
  // --------------------------------------------------------------------------

  /**
   * Build episodic context for an agent session.
   *
   * Instead of pulling the last N messages, this returns the top-importance
   * historical interactions relevant to the current scope (value case,
   * session, or organization). This gives agents richer context with
   * less token waste.
   *
   * Automatically updates `accessed_at` on surfaced records.
   */
  async getContext(options: EpisodicRetrievalOptions): Promise<EpisodicContext> {
    const validated = EpisodicRetrievalOptionsSchema.parse(options);

    const [records, totalAvailable] = await Promise.all([
      this.store.findByImportance(validated.organizationId, {
        valueCaseId: validated.valueCaseId,
        sessionId: validated.sessionId,
        agentId: validated.agentId,
        minImportance: validated.minImportance,
        limit: validated.limit,
        includeDeprecated: validated.includeDeprecated,
      }),
      this.store.count(validated.organizationId, {
        valueCaseId: validated.valueCaseId,
        sessionId: validated.sessionId,
        includeDeprecated: validated.includeDeprecated,
      }),
    ]);

    // Touch accessed_at so we can track retrieval frequency
    if (records.length > 0) {
      await this.store.touchAccessedAt(records.map((r) => r.id));
    }

    return {
      records: records.map((record) => ({
        record,
        relevanceScore: record.importanceScore,
      })),
      totalAvailable,
    };
  }

  /**
   * Retrieve a single episodic record by ID.
   */
  async getById(id: string): Promise<EpisodicRecord | null> {
    return this.store.findById(id);
  }
}
