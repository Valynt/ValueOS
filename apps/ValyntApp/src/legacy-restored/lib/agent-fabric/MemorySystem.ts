/**
 * Memory System
 *
 * Provides unified memory management for agents with semantic, episodic,
 * vector, and provenance tracking capabilities.
 */

import { logger } from "../../utils/logger";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Memory Types
// ============================================================================

export type MemoryType = "semantic" | "episodic" | "vector" | "provenance";

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
  timestamp: Date;
  agentId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  tags?: string[];
  importance?: number; // 0-1 scale
  expiresAt?: Date;
}

export interface MemoryQuery {
  type?: MemoryType;
  content?: string;
  embedding?: number[];
  tags?: string[];
  agentId?: string;
  sessionId?: string;
  userId?: string;
  tenantId?: string;
  limit?: number;
  threshold?: number; // Similarity threshold for vector search
  timeRange?: {
    start: Date;
    end: Date;
  };
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  total: number;
  hasMore: boolean;
  queryTime: number;
}

export interface MemoryStats {
  totalEntries: number;
  entriesByType: Record<MemoryType, number>;
  averageImportance: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  storageUsage: number;
}

// ============================================================================
// Memory Storage Interface
// ============================================================================

export interface IMemoryStorage {
  store(entry: MemoryEntry): Promise<void>;
  retrieve(id: string): Promise<MemoryEntry | null>;
  search(query: MemoryQuery): Promise<MemorySearchResult>;
  delete(id: string): Promise<boolean>;
  update(id: string, updates: Partial<MemoryEntry>): Promise<boolean>;
  getStats(tenantId?: string): Promise<MemoryStats>;
  cleanup(): Promise<number>; // Returns number of cleaned entries
}

// ============================================================================
// In-Memory Storage Implementation
// ============================================================================

class InMemoryStorage implements IMemoryStorage {
  private entries: Map<string, MemoryEntry> = new Map();
  private vectorIndex: Map<string, number[]> = new Map(); // entryId -> embedding
  private tagIndex: Map<string, Set<string>> = new Map(); // tag -> entryIds

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, entry);

    // Update vector index
    if (entry.embedding) {
      this.vectorIndex.set(entry.id, entry.embedding);
    }

    // Update tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(entry.id);
      }
    }

    logger.debug("Memory entry stored", {
      entryId: entry.id,
      type: entry.type,
      agentId: entry.agentId,
    });
  }

  async retrieve(id: string): Promise<MemoryEntry | null> {
    return this.entries.get(id) || null;
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult> {
    const startTime = Date.now();
    let candidateIds = new Set<string>();

    // Get all entries as candidates
    if (query.type) {
      // Filter by type first
      for (const [id, entry] of this.entries.entries()) {
        if (entry.type === query.type) {
          candidateIds.add(id);
        }
      }
    } else {
      candidateIds = new Set(this.entries.keys());
    }

    // Apply filters
    const filteredEntries: MemoryEntry[] = [];

    for (const entryId of candidateIds) {
      const entry = this.entries.get(entryId)!;

      // Skip expired entries
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        continue;
      }

      // Apply filters
      if (query.agentId && entry.agentId !== query.agentId) continue;
      if (query.sessionId && entry.sessionId !== query.sessionId) continue;
      if (query.userId && entry.userId !== query.userId) continue;
      if (query.tenantId && entry.tenantId !== query.tenantId) continue;

      // Time range filter
      if (query.timeRange) {
        if (entry.timestamp < query.timeRange.start || entry.timestamp > query.timeRange.end) {
          continue;
        }
      }

      // Tag filter
      if (query.tags && query.tags.length > 0) {
        const entryTags = entry.tags || [];
        const hasAllTags = query.tags.every((tag) => entryTags.includes(tag));
        if (!hasAllTags) continue;
      }

      // Content search (simple contains for now)
      if (query.content && !entry.content.toLowerCase().includes(query.content.toLowerCase())) {
        continue;
      }

      // Vector similarity search
      if (query.embedding && entry.embedding) {
        const similarity = this.cosineSimilarity(query.embedding, entry.embedding);
        if (similarity < (query.threshold || 0.7)) continue;
      }

      filteredEntries.push(entry);
    }

    // Sort by importance and timestamp
    filteredEntries.sort((a, b) => {
      const importanceDiff = (b.importance || 0) - (a.importance || 0);
      if (importanceDiff !== 0) return importanceDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    // Apply limit
    const limitedEntries = filteredEntries.slice(0, query.limit || 10);

    return {
      entries: limitedEntries,
      total: filteredEntries.length,
      hasMore: filteredEntries.length > (query.limit || 10),
      queryTime: Date.now() - startTime,
    };
  }

  async delete(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;

    this.entries.delete(id);
    this.vectorIndex.delete(id);

    // Remove from tag index
    if (entry.tags) {
      for (const tag of entry.tags) {
        const tagEntries = this.tagIndex.get(tag);
        if (tagEntries) {
          tagEntries.delete(id);
          if (tagEntries.size === 0) {
            this.tagIndex.delete(tag);
          }
        }
      }
    }

    logger.debug("Memory entry deleted", { entryId: id });
    return true;
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;

    const updatedEntry = { ...entry, ...updates };
    this.entries.set(id, updatedEntry);

    // Update indexes if needed
    if (updates.embedding) {
      this.vectorIndex.set(id, updates.embedding);
    }
    if (updates.tags) {
      // Remove old tag associations
      if (entry.tags) {
        for (const tag of entry.tags) {
          const tagEntries = this.tagIndex.get(tag);
          if (tagEntries) {
            tagEntries.delete(id);
          }
        }
      }
      // Add new tag associations
      for (const tag of updates.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(id);
      }
    }

    logger.debug("Memory entry updated", { entryId: id });
    return true;
  }

  async getStats(tenantId?: string): Promise<MemoryStats> {
    let entries = Array.from(this.entries.values());

    if (tenantId) {
      entries = entries.filter((entry) => entry.tenantId === tenantId);
    }

    const entriesByType: Record<MemoryType, number> = {
      semantic: 0,
      episodic: 0,
      vector: 0,
      provenance: 0,
    };

    let totalImportance = 0;
    let oldestDate: Date | undefined;
    let newestDate: Date | undefined;

    for (const entry of entries) {
      entriesByType[entry.type]++;
      totalImportance += entry.importance || 0;

      if (!oldestDate || entry.timestamp < oldestDate) {
        oldestDate = entry.timestamp;
      }
      if (!newestDate || entry.timestamp > newestDate) {
        newestDate = entry.timestamp;
      }
    }

    return {
      totalEntries: entries.length,
      entriesByType,
      averageImportance: entries.length > 0 ? totalImportance / entries.length : 0,
      oldestEntry: oldestDate,
      newestEntry: newestDate,
      storageUsage: JSON.stringify(entries).length, // Rough estimate
    };
  }

  async cleanup(): Promise<number> {
    let cleanedCount = 0;
    const now = new Date();

    for (const [id, entry] of this.entries.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        await this.delete(id);
        cleanedCount++;
      }
    }

    logger.info("Memory cleanup completed", { cleanedCount });
    return cleanedCount;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// Memory System Implementation
// ============================================================================

export class MemorySystem {
  private storage: IMemoryStorage;
  private defaultTTL: number; // in milliseconds
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(storage?: IMemoryStorage, defaultTTL: number = 24 * 60 * 60 * 1000) {
    this.storage = storage || new InMemoryStorage();
    this.defaultTTL = defaultTTL;

    // Start cleanup interval (every hour)
    this.cleanupInterval = setInterval(
      () => {
        this.cleanup();
      },
      60 * 60 * 1000
    );

    logger.info("Memory System initialized", {
      storageType: this.storage.constructor.name,
      defaultTTL: this.defaultTTL,
    });
  }

  async storeSemantic(
    content: string,
    metadata?: Record<string, unknown>,
    context?: Partial<MemoryEntry>
  ): Promise<string> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      type: "semantic",
      content,
      metadata,
      timestamp: new Date(),
      importance: 0.8, // Default importance for semantic memories
      expiresAt: new Date(Date.now() + this.defaultTTL),
      ...context,
    };

    await this.storage.store(entry);
    return entry.id;
  }

  async storeEpisodic(
    content: string,
    metadata?: Record<string, unknown>,
    context?: Partial<MemoryEntry>
  ): Promise<string> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      type: "episodic",
      content,
      metadata,
      timestamp: new Date(),
      importance: 0.6, // Default importance for episodic memories
      expiresAt: new Date(Date.now() + this.defaultTTL * 2), // Episodic memories last longer
      ...context,
    };

    await this.storage.store(entry);
    return entry.id;
  }

  async storeVector(
    content: string,
    embedding: number[],
    metadata?: Record<string, unknown>,
    context?: Partial<MemoryEntry>
  ): Promise<string> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      type: "vector",
      content,
      embedding,
      metadata,
      timestamp: new Date(),
      importance: 0.7, // Default importance for vector memories
      expiresAt: new Date(Date.now() + this.defaultTTL),
      ...context,
    };

    await this.storage.store(entry);
    return entry.id;
  }

  async storeProvenance(
    content: string,
    metadata?: Record<string, unknown>,
    context?: Partial<MemoryEntry>
  ): Promise<string> {
    const entry: MemoryEntry = {
      id: uuidv4(),
      type: "provenance",
      content,
      metadata,
      timestamp: new Date(),
      importance: 0.9, // High importance for provenance
      expiresAt: new Date(Date.now() + this.defaultTTL * 3), // Provenance memories last longest
      ...context,
    };

    await this.storage.store(entry);
    return entry.id;
  }

  async retrieve(id: string): Promise<MemoryEntry | null> {
    return await this.storage.retrieve(id);
  }

  async search(query: MemoryQuery): Promise<MemorySearchResult> {
    return await this.storage.search(query);
  }

  async delete(id: string): Promise<boolean> {
    return await this.storage.delete(id);
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<boolean> {
    return await this.storage.update(id, updates);
  }

  async getStats(tenantId?: string): Promise<MemoryStats> {
    return await this.storage.getStats(tenantId);
  }

  async cleanup(): Promise<number> {
    return await this.storage.cleanup();
  }

  async searchByEmbedding(
    embedding: number[],
    context?: Partial<MemoryQuery>,
    threshold: number = 0.7
  ): Promise<MemorySearchResult> {
    return await this.search({
      embedding,
      threshold,
      type: "vector",
      ...context,
    });
  }

  async searchByTags(tags: string[], context?: Partial<MemoryQuery>): Promise<MemorySearchResult> {
    return await this.search({
      tags,
      ...context,
    });
  }

  async searchByContent(
    content: string,
    context?: Partial<MemoryQuery>
  ): Promise<MemorySearchResult> {
    return await this.search({
      content,
      ...context,
    });
  }

  // Agent-specific memory operations
  async getAgentMemory(agentId: string, limit: number = 50): Promise<MemorySearchResult> {
    return await this.search({
      agentId,
      limit,
    });
  }

  async getSessionMemory(sessionId: string, limit: number = 100): Promise<MemorySearchResult> {
    return await this.search({
      sessionId,
      limit,
    });
  }

  async getUserMemory(userId: string, limit: number = 200): Promise<MemorySearchResult> {
    return await this.search({
      userId,
      limit,
    });
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info("Memory System destroyed");
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createMemorySystem(storage?: IMemoryStorage): MemorySystem {
  return new MemorySystem(storage);
}
