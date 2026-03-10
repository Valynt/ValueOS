/**
 * Supabase Memory Backend
 *
 * Bridges agent-fabric MemorySystem to the Supabase-backed semantic_memory
 * table via SemanticMemoryService. Agent memory types (episodic, semantic,
 * procedural, working) are stored as `workflow_result` in the DB type column
 * (to satisfy the existing CHECK constraint) with the original memory_type
 * preserved in metadata.
 */

import type { SemanticMemoryService } from "@valueos/shared";

import { logger } from "../logger.js";

import type { MemoryPersistenceBackend } from "./MemoryPersistenceBackend.js";
import type { Memory, MemoryQuery, MemoryType } from "./MemorySystem.js";

/**
 * The DB type used for all agent-fabric memories. The semantic_memory table
 * has a CHECK constraint limiting types; `workflow_result` is the most
 * general bucket. The actual agent memory_type is stored in metadata.
 */
const DB_TYPE = "workflow_result" as const;

/**
 * Extended metadata stored alongside each agent memory in Supabase.
 * These fields live in the JSONB `metadata` column and enable
 * round-trip fidelity when reading memories back.
 */
interface AgentMemoryMetadata {
  agentType: string;
  timestamp: Date;
  organization_id: string;
  session_id: string;
  agent_memory_type: MemoryType;
  agent_memory_id: string;
  importance: number;
  access_count: number;
  [key: string]: unknown;
}

export class SupabaseMemoryBackend implements MemoryPersistenceBackend {
  constructor(private semanticMemory: SemanticMemoryService) {}

  async store(memory: Memory): Promise<string> {
    const organizationId = memory.organization_id;
    if (!organizationId) {
      throw new Error("organization_id required on memory for persistent storage");
    }

    try {
      const metadata: AgentMemoryMetadata = {
        agentType: memory.agent_id,
        timestamp: new Date(memory.created_at),
        organization_id: organizationId,
        session_id: memory.workspace_id,
        agent_memory_type: memory.memory_type,
        agent_memory_id: memory.id,
        importance: memory.importance,
        access_count: memory.access_count,
        ...(memory.metadata ?? {}),
      };

      // SemanticMemoryService.store expects a typed metadata shape, but
      // the JSONB column accepts arbitrary keys. Cast to satisfy the
      // compiler while preserving all agent-fabric fields.
      const id = await this.semanticMemory.store({
        type: DB_TYPE,
        content: memory.content,
        metadata: metadata as unknown as Parameters<SemanticMemoryService["store"]>[0]["metadata"],
      });

      logger.debug("Memory persisted to Supabase", {
        memory_id: memory.id,
        supabase_id: id,
        agent_id: memory.agent_id,
        type: memory.memory_type,
      });

      return id;
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
      // Use semantic search with the agent_id as query text for relevance,
      // or fall back to a general query if no query_text is provided.
      const searchText = query.query_text || `agent:${query.agent_id} memories`;

      const results = await this.semanticMemory.search(searchText, {
        type: DB_TYPE,
        organizationId: query.organization_id,
        sessionId: query.workspace_id,
        limit: query.limit || 10,
        minScore: 0.3, // Lower threshold for agent memory retrieval
      });

      // Map SemanticMemoryService results back to agent-fabric Memory shape.
      // The metadata column is JSONB so we treat it as Record<string, unknown>.
      const memories: Memory[] = [];
      for (const result of results) {
        const meta = (result.entry.metadata ?? {}) as unknown as Record<string, unknown>;

        // Filter by agent_id — the DB doesn't have a dedicated column for this
        if (meta.agentType !== query.agent_id) continue;

        // Filter by memory_type if specified
        if (query.memory_type && meta.agent_memory_type !== query.memory_type) continue;

        const importance = typeof meta.score === "number"
          ? meta.score
          : (typeof meta.importance === "number" ? meta.importance : 0.5);

        // Filter by min_importance
        if (query.min_importance && importance < query.min_importance) continue;

        memories.push({
          id: (meta.agent_memory_id as string) || result.entry.id,
          agent_id: String(meta.agentType || ""),
          organization_id: query.organization_id,
          workspace_id: String(meta.session_id || ""),
          content: result.entry.content,
          memory_type: (meta.agent_memory_type as MemoryType) || "episodic",
          importance,
          created_at: result.entry.createdAt.toISOString(),
          accessed_at: new Date().toISOString(),
          access_count: typeof meta.access_count === "number" ? meta.access_count : 0,
          metadata: {
            ...meta,
            organization_id: meta.organization_id,
            similarity: result.similarity,
          },
        });
      }

      // Sort by importance descending (matching in-memory behavior)
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
    // Supabase-backed clear is intentionally a no-op. Agent memories in the
    // persistent store serve as cross-session learning data and should not
    // be deleted by routine agent lifecycle calls. Use SemanticMemoryService
    // pruneMemories() for explicit cleanup.
    logger.debug("SupabaseMemoryBackend.clear is a no-op for persistent storage", {
      agent_id: _agentId,
      organization_id: _organizationId,
      workspace_id: _workspaceId,
    });
    return 0;
  }
}
