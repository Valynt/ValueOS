/**
 * Embedding Service
 *
 * Abstraction over Together AI embedding generation.
 * Uses the official together-ai SDK via the shared TogetherClient singleton.
 * Includes an LRU cache with TTL to avoid redundant API calls.
 */

import { resolveAlias } from '../../lib/agent-fabric/ModelRegistry.js';
import { getTogetherClient } from '../../lib/agent-fabric/TogetherClient.js';
import { logger } from '../../lib/logger.js';

// ============================================================================
// LRU Cache
// ============================================================================

interface CacheEntry {
  embedding: number[];
  createdAt: number;
}

class LRUCache {
  private map = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private readonly ttlMs: number;

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): number[] | null {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.embedding;
  }

  set(key: string, embedding: number[]): void {
    // Evict oldest if at capacity
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) {
        this.map.delete(oldest);
      }
    }
    this.map.set(key, { embedding, createdAt: Date.now() });
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

// ============================================================================
// EmbeddingService
// ============================================================================

export interface EmbeddingServiceConfig {
  model?: string;
  /** @deprecated apiKey is now read from the shared TogetherClient singleton */
  apiKey?: string;
  /** @deprecated apiUrl is now read from the shared TogetherClient singleton */
  apiUrl?: string;
  cacheMaxSize?: number;
  cacheTtlMs?: number;
}

export class EmbeddingService {
  private readonly model: string;
  private readonly cache: LRUCache;

  constructor(config: EmbeddingServiceConfig = {}) {
    // Default to the registry alias so model swaps only require a registry update
    this.model = config.model ?? resolveAlias('embedding-default').modelId;
    this.cache = new LRUCache(
      config.cacheMaxSize ?? 100,
      config.cacheTtlMs ?? 5 * 60 * 1000 // 5 minutes
    );
  }

  /**
   * Generate an embedding vector for the given text.
   * Returns a cached result if available.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = text.trim().toLowerCase();
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const client = getTogetherClient();
      const response = await client.embeddings.create({
        model: this.model,
        input: text,
      });

      const embedding: number[] = response.data[0].embedding;

      this.cache.set(cacheKey, embedding);
      return embedding;
    } catch (error) {
      logger.error('EmbeddingService: failed to generate embedding', {
        error: error instanceof Error ? error.message : String(error),
        model: this.model,
      });
      throw error;
    }
  }

  /** Expose cache size for testing. */
  getCacheSize(): number {
    return this.cache.size;
  }

  /** Clear the cache. */
  clearCache(): void {
    this.cache.clear();
  }
}
