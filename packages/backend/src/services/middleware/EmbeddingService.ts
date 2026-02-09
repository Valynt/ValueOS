/**
 * Embedding Service
 *
 * Abstraction over Together AI embedding generation.
 * Reuses the same model/config as SemanticMemoryService.
 * Includes an LRU cache with TTL to avoid redundant API calls.
 */

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
  apiKey?: string;
  apiUrl?: string;
  cacheMaxSize?: number;
  cacheTtlMs?: number;
}

export class EmbeddingService {
  private readonly model: string;
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private readonly cache: LRUCache;

  constructor(config: EmbeddingServiceConfig = {}) {
    this.model = config.model ?? 'togethercomputer/m2-bert-80M-8k-retrieval';
    this.apiKey = config.apiKey ?? process.env.TOGETHER_API_KEY ?? '';
    this.apiUrl = config.apiUrl ?? 'https://api.together.xyz/v1/embeddings';
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
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Together AI embedding API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const embedding: number[] = data.data[0].embedding;

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
