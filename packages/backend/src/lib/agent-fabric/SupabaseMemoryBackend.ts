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

import type { SemanticFact } from "@valueos/memory";

import type { MemoryPersistenceBackend } from "./MemoryPersistenceBackend.js";
import type { Memory, MemoryQuery, MemoryType } from "./MemorySystem.js";

/**
 * The DB type used for all agent-fabric memories. The semantic_memory table
 * has a CHECK constraint limiting types; `workflow_result` is the most
 * general bucket. The actual agent memory_type is stored in metadata.
 */
const DB_TYPE = "workflow_result" as const;

/**
 * Organization IDs permitted to use cross-workspace memory reads.
 * Populated from CROSS_WORKSPACE_MEMORY_ALLOWLIST env var (comma-separated).
 * Defaults to empty — cross-workspace reads are tenant-scoped only unless
 * an org is explicitly allowlisted.
 *
 * Memoized at module level so the Set is not rebuilt on every retrieve() call.
 * Call resetCrossWorkspaceAllowlistCache() in tests to clear the cached value.
 */
let _crossWorkspaceAllowlistCache: Set<string> | null = null;

export function resetCrossWorkspaceAllowlistCache(): void {
  _crossWorkspaceAllowlistCache = null;
}

function getCrossWorkspaceAllowlist(): Set<string> {
  if (_crossWorkspaceAllowlistCache !== null) return _crossWorkspaceAllowlistCache;
  const raw = process.env.CROSS_WORKSPACE_MEMORY_ALLOWLIST ?? "";
  _crossWorkspaceAllowlistCache = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return _crossWorkspaceAllowlistCache;
}

interface SemanticMemoryReadFilters {
  organizationId: string;
  type: SemanticFact["type"];
  agentType?: string;
  sessionId?: string;
  memoryType?: MemoryType;
  minImportance?: number;
  limit: number;
}

interface SemanticMemoryStore {
  insert(fact: SemanticFact): Promise<void>;
  findFiltered(filters: SemanticMemoryReadFilters): Promise<SemanticFact[]>;
}

export class SupabaseMemoryBackend implements MemoryPersistenceBackend {
  private semanticStore: SemanticMemoryStore;

  constructor(semanticStore?: SemanticMemoryStore) {
    this.semanticStore = semanticStore ?? new SupabaseSemanticStore();
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

    if (query.include_cross_workspace && !query.cross_workspace_reason) {
      throw new Error("cross_workspace_reason is required when include_cross_workspace is true");
    }

    // Access control gate: cross-workspace reads require the organization to be
    // on the explicit allowlist (CROSS_WORKSPACE_MEMORY_ALLOWLIST env var).
    // Without an allowlist entry the query is silently downgraded to tenant-scoped.
    if (query.include_cross_workspace) {
      const allowlist = getCrossWorkspaceAllowlist();
      if (!allowlist.has(query.organization_id)) {
        logger.warn("SupabaseMemoryBackend: cross-workspace read blocked — org not in allowlist", {
          organization_id: query.organization_id,
          cross_workspace_reason: query.cross_workspace_reason,
        });
        // Downgrade to tenant-scoped rather than throwing, so agent execution continues.
        query = { ...query, include_cross_workspace: false };
      }
    }

    try {
      const results = await this.semanticStore.findFiltered({
        organizationId: query.organization_id,
        type: DB_TYPE,
        agentType: query.agent_id,
        sessionId: query.include_cross_workspace ? undefined : query.workspace_id,
        memoryType: query.memory_type,
        minImportance: query.min_importance,
        limit: query.limit || 10,
      });

      const memories: Memory[] = [];
      for (const fact of results) {
        const meta = fact.metadata as Record<string, unknown>;
        const workspaceId = String(meta["session_id"] || "");
        const importance =
          typeof meta["importance"] === "number" ? meta["importance"] : 0.5;

        memories.push({
          id: (meta["agent_memory_id"] as string) || fact.id,
          agent_id: String(meta["agentType"] || ""),
          organization_id: query.organization_id,
          workspace_id: workspaceId,
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

      return memories;
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
