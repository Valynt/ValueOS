/**
 * @valueos/memory/lifecycle
 *
 * Memory lifecycle management — TTL enforcement, consolidation,
 * and promotion rules across all memory types.
 *
 * Prevents "memory bloat" by enforcing retention policies:
 * - Working memory: short TTL (hours), auto-pruned
 * - Procedural memory: medium TTL (days), consolidatable
 * - Semantic memory: long-lived, version-managed
 * - Episodic memory: immutable, never auto-pruned (deprecation only)
 *
 * The AgentMemoryManager (runtime) handles process-level memory pressure.
 * This module handles persistent storage lifecycle.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export type AgentMemoryType = 'episodic' | 'semantic' | 'working' | 'procedural';

export interface AgentMemoryRecord {
  id: string;
  sessionId?: string;
  agentId?: string;
  organizationId?: string;
  memoryType: AgentMemoryType;
  content: string;
  metadata: Record<string, unknown>;
  importanceScore: number;
  expiresAt?: string;
  createdAt: string;
  accessedAt: string;
}

export interface RetentionPolicy {
  memoryType: AgentMemoryType;
  /** Max age in milliseconds before eligible for pruning. null = never expires. */
  maxAge: number | null;
  /** Default TTL applied to new records of this type (ms). null = no default TTL. */
  defaultTtl: number | null;
  /** Records below this importance score are pruned first */
  minImportanceForRetention: number;
  /** Whether automatic pruning is allowed for this type */
  pruneable: boolean;
}

export interface PruneResult {
  deletedCount: number;
  memoryType: AgentMemoryType;
  prunedAt: string;
}

export interface ConsolidationResult {
  sourceIds: string[];
  consolidatedId: string;
  memoryType: AgentMemoryType;
  consolidatedAt: string;
}

export interface PromotionResult {
  sourceId: string;
  promotedId: string;
  fromType: AgentMemoryType;
  toType: AgentMemoryType;
  promotedAt: string;
}

// ============================================================================
// Default Retention Policies
// ============================================================================

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

export const DEFAULT_RETENTION_POLICIES: readonly RetentionPolicy[] = [
  {
    memoryType: 'working',
    maxAge: 4 * ONE_HOUR,
    defaultTtl: 2 * ONE_HOUR,
    minImportanceForRetention: 0.0,
    pruneable: true,
  },
  {
    memoryType: 'procedural',
    maxAge: 30 * ONE_DAY,
    defaultTtl: 7 * ONE_DAY,
    minImportanceForRetention: 0.3,
    pruneable: true,
  },
  {
    memoryType: 'semantic',
    maxAge: null,
    defaultTtl: null,
    minImportanceForRetention: 0.0,
    pruneable: false,
  },
  {
    memoryType: 'episodic',
    maxAge: null,
    defaultTtl: null,
    minImportanceForRetention: 0.0,
    // Episodic memory is immutable — never auto-pruned
    pruneable: false,
  },
] as const;

// ============================================================================
// Zod Schemas
// ============================================================================

export const AgentMemoryInputSchema = z.object({
  sessionId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  memoryType: z.enum(['episodic', 'semantic', 'working', 'procedural']),
  content: z.string().min(1).max(100_000),
  metadata: z.record(z.unknown()).default({}),
  importanceScore: z.number().min(0).max(1).default(0.5),
  /** Override the default TTL for this record (ms from now) */
  ttlMs: z.number().int().positive().optional(),
});

export type AgentMemoryInput = z.infer<typeof AgentMemoryInputSchema>;

// ============================================================================
// Persistence Interface (dependency injection)
// ============================================================================

export interface LifecycleStore {
  /** Insert a new agent_memory record with computed expires_at */
  insert(record: AgentMemoryRecord): Promise<void>;

  /**
   * Delete expired records for a given memory type.
   * Maps to `prune_expired_agent_memories()` — skips episodic.
   */
  pruneExpired(memoryType: AgentMemoryType, limit: number): Promise<number>;

  /**
   * Delete records older than maxAge with importance below threshold.
   * Used for age-based retention enforcement.
   */
  pruneByAge(
    memoryType: AgentMemoryType,
    maxAgeMs: number,
    minImportance: number,
    limit: number,
  ): Promise<number>;

  /**
   * Find records eligible for consolidation: same type, same scope,
   * similar content that can be merged into a single record.
   */
  findConsolidationCandidates(
    memoryType: AgentMemoryType,
    organizationId: string,
    options: { minAge: number; limit: number },
  ): Promise<AgentMemoryRecord[]>;

  /** Replace multiple records with a single consolidated record */
  consolidate(sourceIds: string[], consolidated: AgentMemoryRecord): Promise<void>;

  /** Set TTL on an existing record. Maps to `set_memory_ttl()`. */
  setTtl(id: string, expiresAt: string): Promise<void>;

  /** Find working memory records with high importance for promotion */
  findPromotionCandidates(
    organizationId: string,
    options: { fromType: AgentMemoryType; minImportance: number; limit: number },
  ): Promise<AgentMemoryRecord[]>;
}

// ============================================================================
// MemoryLifecycle
// ============================================================================

export class MemoryLifecycle {
  private store: LifecycleStore;
  private policies: Map<AgentMemoryType, RetentionPolicy>;

  constructor(store: LifecycleStore, policies?: RetentionPolicy[]) {
    this.store = store;
    this.policies = new Map(
      (policies ?? DEFAULT_RETENTION_POLICIES).map((p) => [p.memoryType, p]),
    );
  }

  // --------------------------------------------------------------------------
  // Write: create with automatic TTL
  // --------------------------------------------------------------------------

  /**
   * Create a new agent memory record with lifecycle-aware TTL.
   *
   * If no explicit TTL is provided, the default for the memory type
   * is applied. Episodic and semantic records get no TTL by default.
   */
  async create(input: AgentMemoryInput): Promise<AgentMemoryRecord> {
    const validated = AgentMemoryInputSchema.parse(input);
    const policy = this.policies.get(validated.memoryType);
    const now = new Date();

    let expiresAt: string | undefined;
    if (validated.ttlMs) {
      expiresAt = new Date(now.getTime() + validated.ttlMs).toISOString();
    } else if (policy?.defaultTtl) {
      expiresAt = new Date(now.getTime() + policy.defaultTtl).toISOString();
    }

    const record: AgentMemoryRecord = {
      id: crypto.randomUUID(),
      sessionId: validated.sessionId,
      agentId: validated.agentId,
      organizationId: validated.organizationId,
      memoryType: validated.memoryType,
      content: validated.content,
      metadata: validated.metadata,
      importanceScore: validated.importanceScore,
      expiresAt,
      createdAt: now.toISOString(),
      accessedAt: now.toISOString(),
    };

    await this.store.insert(record);
    return record;
  }

  // --------------------------------------------------------------------------
  // Prune: enforce retention policies
  // --------------------------------------------------------------------------

  /**
   * Run retention enforcement for all pruneable memory types.
   *
   * Should be called on a schedule (e.g., every 15 minutes) or
   * triggered by the AgentMemoryManager when memory pressure rises.
   * Runs silently between user interactions — never during a calculation.
   */
  async enforceRetention(batchLimit: number = 1000): Promise<PruneResult[]> {
    const results: PruneResult[] = [];

    for (const [memoryType, policy] of this.policies) {
      if (!policy.pruneable) continue;

      // Phase 1: prune records past their explicit expires_at
      const expiredCount = await this.store.pruneExpired(memoryType, batchLimit);

      // Phase 2: prune records past maxAge with low importance
      let ageCount = 0;
      if (policy.maxAge !== null) {
        ageCount = await this.store.pruneByAge(
          memoryType,
          policy.maxAge,
          policy.minImportanceForRetention,
          batchLimit,
        );
      }

      const totalDeleted = expiredCount + ageCount;
      if (totalDeleted > 0) {
        results.push({
          deletedCount: totalDeleted,
          memoryType,
          prunedAt: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Consolidate: merge redundant records
  // --------------------------------------------------------------------------

  /**
   * Consolidate older procedural/working memories into fewer records.
   *
   * The caller provides a `mergeFn` that combines multiple records
   * into a single content string (e.g., summarization via LLM).
   */
  async consolidate(
    memoryType: 'working' | 'procedural',
    organizationId: string,
    mergeFn: (records: AgentMemoryRecord[]) => Promise<string>,
    options: { minAgeMs?: number; limit?: number } = {},
  ): Promise<ConsolidationResult | null> {
    const candidates = await this.store.findConsolidationCandidates(
      memoryType,
      organizationId,
      {
        minAge: options.minAgeMs ?? ONE_HOUR,
        limit: options.limit ?? 10,
      },
    );

    if (candidates.length < 2) return null;

    const mergedContent = await mergeFn(candidates);
    const maxImportance = Math.max(...candidates.map((c) => c.importanceScore));

    const consolidated: AgentMemoryRecord = {
      id: crypto.randomUUID(),
      sessionId: candidates[0].sessionId,
      agentId: candidates[0].agentId,
      organizationId,
      memoryType,
      content: mergedContent,
      metadata: { consolidatedFrom: candidates.map((c) => c.id) },
      importanceScore: maxImportance,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
    };

    const policy = this.policies.get(memoryType);
    if (policy?.defaultTtl) {
      consolidated.expiresAt = new Date(
        Date.now() + policy.defaultTtl,
      ).toISOString();
    }

    await this.store.consolidate(
      candidates.map((c) => c.id),
      consolidated,
    );

    return {
      sourceIds: candidates.map((c) => c.id),
      consolidatedId: consolidated.id,
      memoryType,
      consolidatedAt: consolidated.createdAt,
    };
  }

  // --------------------------------------------------------------------------
  // Promote: working → procedural, procedural → semantic
  // --------------------------------------------------------------------------

  /**
   * Promote high-importance working memories to procedural,
   * or procedural memories to semantic.
   *
   * Promotion preserves the original record (deprecated) and creates
   * a new record in the target type. This maintains the audit trail.
   */
  async promote(
    fromType: 'working' | 'procedural',
    toType: 'procedural' | 'semantic',
    organizationId: string,
    options: { minImportance?: number; limit?: number } = {},
  ): Promise<PromotionResult[]> {
    const candidates = await this.store.findPromotionCandidates(
      organizationId,
      {
        fromType,
        minImportance: options.minImportance ?? 0.8,
        limit: options.limit ?? 10,
      },
    );

    const results: PromotionResult[] = [];

    for (const source of candidates) {
      const promoted: AgentMemoryRecord = {
        id: crypto.randomUUID(),
        sessionId: source.sessionId,
        agentId: source.agentId,
        organizationId,
        memoryType: toType,
        content: source.content,
        metadata: { ...source.metadata, promotedFrom: source.id },
        importanceScore: source.importanceScore,
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
      };

      // Semantic and episodic records have no default TTL
      const policy = this.policies.get(toType);
      if (policy?.defaultTtl) {
        promoted.expiresAt = new Date(
          Date.now() + policy.defaultTtl,
        ).toISOString();
      }

      await this.store.insert(promoted);
      // Set a short TTL on the source so it gets cleaned up
      await this.store.setTtl(
        source.id,
        new Date(Date.now() + ONE_HOUR).toISOString(),
      );

      results.push({
        sourceId: source.id,
        promotedId: promoted.id,
        fromType,
        toType,
        promotedAt: promoted.createdAt,
      });
    }

    return results;
  }

  /**
   * Get the retention policy for a memory type.
   */
  getPolicy(memoryType: AgentMemoryType): RetentionPolicy | undefined {
    return this.policies.get(memoryType);
  }
}
