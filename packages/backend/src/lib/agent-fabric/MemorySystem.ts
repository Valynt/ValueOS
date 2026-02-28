/**
 * Memory System
 *
 * Agent memory management for context retention, retrieval,
 * and knowledge accumulation across task executions.
 *
 * Supports an optional MemoryPersistenceBackend for durable storage.
 * When a backend is configured, writes go to both the local Map cache
 * and the persistent store. Reads prefer the backend when available,
 * falling back to the local cache on error.
 */

import { logger } from "../logger.js";

import type { MemoryPersistenceBackend } from "./MemoryPersistenceBackend.js";

export interface MemorySystemConfig {
  max_memories: number;
  ttl_seconds?: number;
  enable_persistence: boolean;
  vector_search_enabled?: boolean;
}

export interface Memory {
  id: string;
  agent_id: string;
  workspace_id: string;
  content: string;
  memory_type: MemoryType;
  importance: number;
  created_at: string;
  accessed_at: string;
  access_count: number;
  metadata?: Record<string, unknown>;
}

export type MemoryType = "episodic" | "semantic" | "procedural" | "working";

export interface MemoryQuery {
  agent_id: string;
  workspace_id?: string;
  query_text?: string;
  memory_type?: MemoryType;
  limit?: number;
  min_importance?: number;
  /** Required for tenant isolation. All memory queries must be scoped to a tenant. */
  organization_id: string;
}

export interface Episode {
  id: string;
  session_id: string;
  agent_id: string;
  episode_type: string;
  task_intent: string;
  context: Record<string, unknown>;
  initial_state: Record<string, unknown>;
  final_state: Record<string, unknown>;
  success: boolean;
  reward_score: number;
  duration_seconds: number;
  created_at: string;
  summary?: string;
}

export interface EpisodeInput {
  sessionId: string;
  agentId: string;
  episodeType: string;
  taskIntent: string;
  context: Record<string, unknown>;
  initialState: Record<string, unknown>;
  finalState: Record<string, unknown>;
  success: boolean;
  rewardScore: number;
  durationSeconds: number;
}

export interface ConsolidationResult {
  episodicMerged: number;
  semanticCreated: number;
  workingPruned: number;
}

export class MemorySystem {
  private config: MemorySystemConfig;
  private memories: Map<string, Memory>;
  private episodes: Map<string, Episode>;
  private backend: MemoryPersistenceBackend | null;

  constructor(config: MemorySystemConfig, backend?: MemoryPersistenceBackend) {
    this.config = config;
    this.memories = new Map();
    this.episodes = new Map();
    this.backend = backend ?? null;
  }

  /**
   * Attach a persistence backend after construction.
   * Useful when the backend isn't available at MemorySystem creation time.
   */
  setBackend(backend: MemoryPersistenceBackend): void {
    this.backend = backend;
  }

  async store(
    memory: Omit<Memory, "id" | "created_at" | "accessed_at" | "access_count">
  ): Promise<string> {
    const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMemory: Memory = {
      ...memory,
      id: memoryId,
      created_at: new Date().toISOString(),
      accessed_at: new Date().toISOString(),
      access_count: 0,
    };

    // Always write to local cache for fast in-process reads
    this.memories.set(memoryId, fullMemory);

    // Enforce max_memories limit by evicting least important
    if (this.memories.size > this.config.max_memories) {
      this.evictLeastImportant();
    }

    // Persist to backend if available (fire-and-log-error to avoid
    // blocking agent execution on transient storage failures)
    if (this.backend && this.config.enable_persistence) {
      try {
        await this.backend.store(fullMemory);
      } catch (error) {
        logger.warn("Persistent memory store failed, using local cache only", {
          memory_id: memoryId,
          agent_id: memory.agent_id,
          error: (error as Error).message,
        });
      }
    }

    logger.debug("Memory stored", {
      memory_id: memoryId,
      agent_id: memory.agent_id,
      type: memory.memory_type,
      persisted: !!(this.backend && this.config.enable_persistence),
    });

    return memoryId;
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    if (!query.organization_id) {
      throw new Error("organization_id is required for tenant-scoped memory retrieval");
    }

    // Try persistent backend first for cross-session recall
    if (this.backend && this.config.enable_persistence) {
      try {
        const persisted = await this.backend.retrieve(query);
        if (persisted.length > 0) {
          return persisted;
        }
        // Fall through to local cache if backend returned empty
      } catch (error) {
        logger.warn("Persistent memory retrieval failed, falling back to local cache", {
          agent_id: query.agent_id,
          error: (error as Error).message,
        });
      }
    }

    // Local cache fallback
    return this.retrieveFromCache(query);
  }

  private retrieveFromCache(query: MemoryQuery): Memory[] {
    const results: Memory[] = [];

    for (const memory of this.memories.values()) {
      if (memory.agent_id !== query.agent_id) continue;
      // Tenant isolation: always filter by organization_id
      if (memory.metadata?.organization_id !== query.organization_id) continue;
      if (query.workspace_id && memory.workspace_id !== query.workspace_id) continue;
      if (query.memory_type && memory.memory_type !== query.memory_type) continue;
      if (query.min_importance && memory.importance < query.min_importance) continue;

      memory.accessed_at = new Date().toISOString();
      memory.access_count++;
      results.push(memory);
    }

    results.sort((a, b) => b.importance - a.importance);

    const limit = query.limit || 10;
    return results.slice(0, limit);
  }

  async storeSemanticMemory(
    sessionId: string,
    agentId: string,
    type: MemoryType,
    content: string,
    metadata: Record<string, unknown>,
    organizationId: string
  ): Promise<string> {
    return this.store({
      agent_id: agentId,
      workspace_id: sessionId,
      content,
      memory_type: type,
      importance: (metadata.importance as number) || 0.5,
      metadata: { ...metadata, organization_id: organizationId },
    });
  }

  /**
   * Store an episodic memory entry for quick retrieval by content similarity.
   */
  async storeEpisodicMemory(
    sessionId: string,
    agentId: string,
    content: string,
    metadata: Record<string, unknown>,
    organizationId: string,
    extra?: Record<string, unknown>
  ): Promise<string> {
    return this.store({
      agent_id: agentId,
      workspace_id: sessionId,
      content,
      memory_type: "episodic",
      importance: 0.6,
      metadata: {
        ...metadata,
        ...extra,
        organization_id: organizationId,
      },
    });
  }

  /**
   * Store a full episode record (agent invocation lifecycle).
   */
  async storeEpisode(input: EpisodeInput, organizationId: string): Promise<string> {
    const episodeId = `ep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const episode: Episode = {
      id: episodeId,
      session_id: input.sessionId,
      agent_id: input.agentId,
      episode_type: input.episodeType,
      task_intent: input.taskIntent,
      context: { ...input.context, organizationId },
      initial_state: input.initialState,
      final_state: input.finalState,
      success: input.success,
      duration_seconds: input.durationSeconds,
      created_at: new Date().toISOString(),
    };

    this.episodes.set(episodeId, episode);

    logger.debug("Episode stored", {
      episode_id: episodeId,
      agent_id: input.agentId,
      success: input.success,
      organization_id: organizationId,
    });

    return episodeId;
  }

  /**
   * Retrieve similar past episodes for context enrichment.
   * Matches by agent type and task intent similarity.
   */
  async retrieveSimilarEpisodes(
    context: Record<string, unknown>,
    organizationId: string,
    limit: number = 5
  ): Promise<Episode[]> {
    const agentId = context.agent as string | undefined;
    const query = context.query as string | undefined;

    const results: Episode[] = [];

    for (const episode of this.episodes.values()) {
      if (agentId && episode.agent_id !== agentId) continue;

      // Strict tenant isolation
      const epOrgId = episode.context?.organizationId ?? episode.context?.tenantId;
      if (!epOrgId || epOrgId !== organizationId) continue;

      // Simple text similarity: check if query terms appear in task_intent
      if (query) {
        const queryTerms = query.toLowerCase().split(/\s+/);
        const intentLower = episode.task_intent.toLowerCase();
        const matchCount = queryTerms.filter((term) => intentLower.includes(term)).length;
        if (matchCount === 0) continue;
      }

      results.push(episode);
    }

    results.sort((a, b) => b.reward_score - a.reward_score);
    return results.slice(0, limit);
  }

  /**
   * Consolidate memory: merge short-term episodic into long-term semantic.
   *
   * 1. Find episodic memories with high access counts (frequently retrieved)
   * 2. Merge them into semantic memories with higher importance
   * 3. Prune working memory entries older than TTL
   */
  async consolidate(organizationId: string): Promise<ConsolidationResult> {
    let episodicMerged = 0;
    let semanticCreated = 0;
    let workingPruned = 0;

    const now = Date.now();
    const ttlMs = (this.config.ttl_seconds || 3600) * 1000;

    const episodicByAgent = new Map<string, Memory[]>();
    for (const memory of this.memories.values()) {
      if (memory.metadata?.organization_id !== organizationId) continue;

      // Prune expired working memory
      if (memory.memory_type === "working") {
        const createdAt = new Date(memory.created_at).getTime();
        if (now - createdAt > ttlMs) {
          this.memories.delete(memory.id);
          workingPruned++;
          continue;
        }
      }

      // Collect frequently-accessed episodic memories for promotion
      if (memory.memory_type === "episodic" && memory.access_count >= 3) {
        const agentMemories = episodicByAgent.get(memory.agent_id) || [];
        agentMemories.push(memory);
        episodicByAgent.set(memory.agent_id, agentMemories);
      }
    }

    for (const [agentId, memories] of episodicByAgent) {
      if (memories.length < 2) continue;

      const mergedContent = memories.map((m) => m.content).join(" | ");
      const avgImportance = memories.reduce((sum, m) => sum + m.importance, 0) / memories.length;

      await this.store({
        agent_id: agentId,
        workspace_id: memories[0].workspace_id,
        content: `[Consolidated] ${mergedContent}`,
        memory_type: "semantic",
        importance: Math.min(avgImportance + 0.2, 1.0),
        metadata: {
          organization_id: organizationId,
          consolidated_from: memories.map((m) => m.id),
          consolidated_at: new Date().toISOString(),
        },
      });

      semanticCreated++;
      episodicMerged += memories.length;

      for (const memory of memories) {
        this.memories.delete(memory.id);
      }
    }

    if (episodicMerged > 0 || workingPruned > 0) {
      logger.info("Memory consolidation complete", {
        organization_id: organizationId,
        episodic_merged: episodicMerged,
        semantic_created: semanticCreated,
        working_pruned: workingPruned,
      });
    }

    return { episodicMerged, semanticCreated, workingPruned };
  }

  /**
   * Get memory statistics for monitoring.
   */
  getStats(): { totalMemories: number; totalEpisodes: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const memory of this.memories.values()) {
      byType[memory.memory_type] = (byType[memory.memory_type] || 0) + 1;
    }
    return {
      totalMemories: this.memories.size,
      totalEpisodes: this.episodes.size,
      byType,
    };
  }

  async clear(agentId: string, organizationId: string, workspaceId?: string): Promise<number> {
    let count = 0;
    for (const [id, memory] of this.memories.entries()) {
      if (
        memory.agent_id === agentId &&
        memory.metadata?.organization_id === organizationId &&
        (!workspaceId || memory.workspace_id === workspaceId)
      ) {
        this.memories.delete(id);
        count++;
      }
    }

    // Delegate to backend (which may no-op for persistent stores)
    if (this.backend && this.config.enable_persistence) {
      try {
        await this.backend.clear(agentId, organizationId, workspaceId);
      } catch (error) {
        logger.warn("Persistent memory clear failed", {
          agent_id: agentId,
          error: (error as Error).message,
        });
      }
    }

    logger.info("Memories cleared", { agent_id: agentId, organization_id: organizationId, count });
    return count;
  }

  private evictLeastImportant(): void {
    let leastImportant: Memory | null = null;
    for (const memory of this.memories.values()) {
      if (!leastImportant || memory.importance < leastImportant.importance) {
        leastImportant = memory;
      }
    }
    if (leastImportant) {
      this.memories.delete(leastImportant.id);
    }
  }
}

export function createMemorySystem(
  config: MemorySystemConfig,
  backend?: MemoryPersistenceBackend,
): MemorySystem {
  return new MemorySystem(config, backend);
}
