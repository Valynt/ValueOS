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

export class MemorySystem {
  private config: MemorySystemConfig;
  private memories: Map<string, Memory>;
  private backend: MemoryPersistenceBackend | null;

  constructor(config: MemorySystemConfig, backend?: MemoryPersistenceBackend) {
    this.config = config;
    this.memories = new Map();
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

  async clear(agentId: string, workspaceId?: string): Promise<number> {
    let count = 0;
    for (const [id, memory] of this.memories.entries()) {
      if (memory.agent_id === agentId) {
        if (!workspaceId || memory.workspace_id === workspaceId) {
          this.memories.delete(id);
          count++;
        }
      }
    }

    // Delegate to backend (which may no-op for persistent stores)
    if (this.backend && this.config.enable_persistence) {
      try {
        await this.backend.clear(agentId, workspaceId);
      } catch (error) {
        logger.warn("Persistent memory clear failed", {
          agent_id: agentId,
          error: (error as Error).message,
        });
      }
    }

    logger.info("Memories cleared", { agent_id: agentId, count });
    return count;
  }
}

export function createMemorySystem(
  config: MemorySystemConfig,
  backend?: MemoryPersistenceBackend,
): MemorySystem {
  return new MemorySystem(config, backend);
}
