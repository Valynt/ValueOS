/**
 * Supabase Memory Backend
 *
 * Bridges agent-fabric MemorySystem to the semantic_memory table via
 * SupabaseSemanticStore (packages/memory adapter). Agent memory types
 * (episodic, semantic, procedural, working) are stored as `workflow_result`
 * in the DB type column (to satisfy the existing CHECK constraint) with the
 * original memory_type preserved in metadata.
 *
 * ADR-0013: packages/memory is the canonical persistent layer.
 */

import { logger } from "../logger.js";
import { SupabaseSemanticStore } from "../memory/SupabaseSemanticStore.js";

import type { MemoryPersistenceBackend } from "./MemoryPersistenceBackend.js";
import type { Memory, MemoryQuery, MemoryType } from "./MemorySystem.js";

/**
 * The DB type used for all agent-fabric memories. The semantic_memory table
 * has a CHECK constraint limiting types; `workflow_result` is the most
 * general bucket. The actual agent memory_type is stored in metadata.
 */
const DB_TYPE = "workflow_result" as const;

export class SupabaseMemoryBackend implements MemoryPersistenceBackend {
  private semanticStore: SupabaseSemanticStore;

  constructor() {
    this.semanticStore = new SupabaseSemanticStore();
  }

  async store(memory: Memory): Promise<string> {
    const organizationId = memory.organization_id;
    if (!organizationId) {
      throw new Error("organization_id required on memory for persistent storage");
    }

    try {
      const fact = {
        id: memory.id,
        type: DB_TYPE as "workflow_result",
        content: memory.content,
        embedding: [] as number[],
        metadata: {
          agentType: memory.agent_id,
          timestamp: new Date(memory.created_at).toISOString(),
          organization_id: organizationId,
          session_id: memory.workspace_id,
          agent_memory_type: memory.memory_type,
          agent_memory_id: memory.id,
          importance: memory.importance,
          access_count: memory.access_count,
          source_agent: memory.agent_id,
          ...(memory.metadata ?? {}),
        },
        status: "approved" as const,
        version: 1,
        organizationId,
        confidenceScore: memory.importance,
        createdAt: memory.created_at,
        updatedAt: memory.created_at,
      };

      await this.semanticStore.insert(fact);

      logger.debug("Memory persisted to Supabase via SupabaseSemanticStore", {
        memory_id: memory.id,
        agent_id: memory.agent_id,
        type: memory.memory_type,
      });

      return memory.id;
    } catch (error) {
      logger.error("Failed to persist memory to Supabase", error as Error, {
        memory_id: memory.id,
        agent_id: memory.agent_id,
      });
      throw error;
    }
  }

  async retrieve(query: MemoryQuery): Promise<Memory[]> {
    if (!query.organization_id) {
      throw new Error("organization_id is required for tenant-scoped memory retrieval");
    }

    try {
      const results = await this.semanticStore.findByOrganization(
        query.organization_id,
        DB_TYPE,
      );

      const memories: Memory[] = [];
      for (const fact of results) {
        const meta = fact.metadata as Record<string, unknown>;

        if (query.agent_id && meta["agentType"] !== query.agent_id) continue;
        if (query.memory_type && meta["agent_memory_type"] !== query.memory_type) continue;

        const importance =
          typeof meta["importance"] === "number" ? meta["importance"] : 0.5;

        if (query.min_importance && importance < query.min_importance) continue;

        memories.push({
          id: (meta["agent_memory_id"] as string) || fact.id,
          agent_id: String(meta["agentType"] || ""),
          organization_id: query.organization_id,
          workspace_id: String(meta["session_id"] || ""),
          content: fact.content,
          memory_type: (meta["agent_memory_type"] as MemoryType) || "episodic",
          importance,
          created_at: fact.createdAt,
          accessed_at: new Date().toISOString(),
          access_count:
            typeof meta["access_count"] === "number" ? meta["access_count"] : 0,
          metadata: meta,
        });
      }

      memories.sort((a, b) => b.importance - a.importance);
      return memories.slice(0, query.limit || 10);
    } catch (error) {
      logger.error("Failed to retrieve memories from Supabase", error as Error, {
        agent_id: query.agent_id,
        organization_id: query.organization_id,
      });
      throw error;
    }
  }

  async clear(_agentId: string, _organizationId: string, _workspaceId?: string): Promise<number> {
    // Intentional no-op: agent memories serve as cross-session learning data.
    // Use SupabaseSemanticStore directly for explicit cleanup.
    logger.debug("SupabaseMemoryBackend.clear is a no-op for persistent storage", {
      agent_id: _agentId,
      organization_id: _organizationId,
    });
    return 0;
  }
}
