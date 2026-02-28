/**
 * Memory Persistence Backend
 *
 * Interface for pluggable persistent storage behind MemorySystem.
 * Implementations bridge agent-fabric memory to durable stores
 * (Supabase, Redis, etc.) while keeping MemorySystem testable
 * with the default in-memory Map fallback.
 */

import type { Memory, MemoryQuery, MemoryType } from "./MemorySystem.js";

export interface MemoryPersistenceBackend {
  /**
   * Persist a memory record. Returns the storage-assigned ID.
   */
  store(memory: Memory): Promise<string>;

  /**
   * Retrieve memories matching the query. Must enforce tenant isolation
   * via organization_id.
   */
  retrieve(query: MemoryQuery): Promise<Memory[]>;

  /**
   * Delete memories for an agent, optionally scoped to a workspace.
   * Returns the count of deleted records.
   */
  clear(agentId: string, organizationId: string, workspaceId?: string): Promise<number>;
}
