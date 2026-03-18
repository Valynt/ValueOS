/**
 * LLM Response Caching Service
 * 
 * Caches Together.ai responses in Redis to reduce costs and improve performance.
 * Implements intelligent cache key generation and TTL management.
 */

import crypto from 'crypto';

import Redis, { type Redis as RedisClientType } from 'ioredis';

import { logger } from '../utils/logger.js'

export interface CacheConfig {
  ttl: number; // Time to live in seconds
  enabled: boolean;
  keyPrefix: string;
}

export interface LLMCacheEntry {
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  cachedAt: string;
  hitCount: number;
}

export class LLMCache {
  private client: RedisClientType;
  private config: CacheConfig;
  private connected: boolean = false;
  
  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ttl: 24 * 60 * 60, // 24 hours default
      enabled: process.env.ENABLE_LLM_CACHE !== 'false',
      keyPrefix: 'llm:cache:',
      ...config
    };
    
    this.client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryStrategy: (retries: number) => Math.min(retries * 50, 500),
    });
    
    this.client.on('error', (err: unknown) => {
      logger.error('Redis client error', err);
      this.connected = false;
    });
    
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.connected = true;
    });
    
    this.client.on('disconnect', () => {
      logger.warn('Redis client disconnected');
      this.connected = false;
    });
  }
  
  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      // ioredis connects automatically;
    }
  }
  
  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
    }
  }
  
  /**
   * Generate cache key from prompt and model
   */
  private generateCacheKey(prompt: string, model: string, options?: Record<string, unknown>): string {
    // Create a hash of the prompt + model + options
    const content = JSON.stringify({
      prompt: prompt.trim().toLowerCase(),
      model,
      options: options || {}
    });
    
    const hash = crypto
      .createHash('sha256')
      .update(content)
      .digest('hex')
      .substring(0, 16);
    
    return `${this.config.keyPrefix}${model}:${hash}`;
  }
  
  /**
   * Get cached response
   */
  async get(
    prompt: string,
    model: string,
    options?: Record<string, unknown>
  ): Promise<LLMCacheEntry | null> {
    if (!this.config.enabled || !this.connected) {
      return null;
    }
    
    try {
      const key = this.generateCacheKey(prompt, model, options);
      const cached = await this.client.get(key);
      
      if (!cached) {
        logger.cache('miss', key);
        return null;
      }
      
      const entry: LLMCacheEntry = JSON.parse(cached);

      // Update aggregate stats atomically. We do NOT write the entry back with
      // an incremented hitCount — that read-modify-write is racy under concurrent
      // requests and would cause lost updates. totalHits in the stats hash is the
      // authoritative hit counter; entry.hitCount is intentionally not mutated.
      const statsKey = `${this.config.keyPrefix}stats`;
      const tx = this.client.multi();
      tx.hincrby(statsKey, 'totalHits', 1);
      tx.hIncrByFloat(statsKey, 'totalCostSaved', entry.cost);
      await tx.exec();

      logger.cache('hit', key, {
        model,
        cost: entry.cost,
      });

      return entry;
    } catch (error: unknown) {
      logger.error('Failed to get from cache', error instanceof Error ? error : new Error(String(error)));
      return null;
    }
  }
  
  /**
   * Set cached response
   */
  async set(
    prompt: string,
    model: string,
    response: string,
    metadata: {
      promptTokens: number;
      completionTokens: number;
      cost: number;
    },
    options?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }
    
    try {
      const key = this.generateCacheKey(prompt, model, options);
      
      const entry: LLMCacheEntry = {
        response,
        model,
        promptTokens: metadata.promptTokens,
        completionTokens: metadata.completionTokens,
        cost: metadata.cost,
        cachedAt: new Date().toISOString(),
        hitCount: 0
      };
      
      const statsKey = `${this.config.keyPrefix}stats`;
      await Promise.all([
        this.client.set(key, JSON.stringify(entry), { EX: this.config.ttl }),
        this.client.hincrby(statsKey, 'totalEntries', 1),
      ]);

      logger.cache('set', key, {
        model,
        cost: metadata.cost,
        ttl: this.config.ttl
      });
    } catch (error: unknown) {
      logger.error('Failed to set cache', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Delete cached response
   */
  async delete(prompt: string, model: string, options?: Record<string, unknown>): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }
    
    try {
      const key = this.generateCacheKey(prompt, model, options);
      await this.client.del(key);
      
      logger.cache('delete', key);
    } catch (error: unknown) {
      logger.error('Failed to delete from cache', error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Clear all LLM cache entries.
   * Uses SCAN instead of KEYS to avoid blocking Redis on large keyspaces.
   */
  async clear(): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }

    try {
      let cursor = 0;
      let totalDeleted = 0;

      do {
        const reply = await this.client.scan(cursor, {
          MATCH: `${this.config.keyPrefix}*`,
          COUNT: 100,
        });
        cursor = reply.cursor;
        if (reply.keys.length > 0) {
          await this.client.del(reply.keys);
          totalDeleted += reply.keys.length;
        }
      } while (cursor !== 0);

      // Reset the stats hash alongside the cache entries
      await this.client.del(`${this.config.keyPrefix}stats`);

      logger.info(`Cleared ${totalDeleted} cache entries`);
    } catch (error: unknown) {
      logger.error('Failed to clear cache', error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Get cache statistics.
   * Aggregates (hits, cost saved, entry count) are maintained in a Redis hash
   * updated on each cache set/hit, so this method is O(1) instead of O(N).
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    totalCostSaved: number;
    cacheSize: number;
  }> {
    if (!this.config.enabled || !this.connected) {
      return { totalEntries: 0, totalHits: 0, totalCostSaved: 0, cacheSize: 0 };
    }

    try {
      const statsKey = `${this.config.keyPrefix}stats`;
      const [statsHash, memInfo] = await Promise.all([
        this.client.hgetall(statsKey),
        this.client.info('memory'),
      ]);

      const memoryMatch = memInfo.match(/used_memory:(\d+)/);
      const cacheSize = memoryMatch ? parseInt(memoryMatch[1], 10) : 0;

      return {
        totalEntries: parseInt(statsHash.totalEntries ?? '0', 10),
        totalHits: parseInt(statsHash.totalHits ?? '0', 10),
        totalCostSaved: parseFloat(statsHash.totalCostSaved ?? '0'),
        cacheSize,
      };
    } catch (error: unknown) {
      logger.error('Failed to get cache stats', error instanceof Error ? error : new Error(String(error)));
      return { totalEntries: 0, totalHits: 0, totalCostSaved: 0, cacheSize: 0 };
    }
  }
  
  /**
   * Get cache hit rate
   */
  async getHitRate(): Promise<number> {
    const stats = await this.getStats();
    
    if (stats.totalEntries === 0) {
      return 0;
    }
    
    // Approximate hit rate based on hit count vs entries
    return (stats.totalHits / (stats.totalEntries + stats.totalHits)) * 100;
  }
  
  /**
   * Warm cache with common prompts.
   *
   * Callers must supply an `llmCaller` that executes the actual LLM request and
   * returns the response string. This keeps LLMCache decoupled from LLMGateway
   * and avoids the tenant-context requirement that LLMGateway.complete enforces.
   *
   * Prompts that are already cached are skipped. Failures on individual prompts
   * are logged and skipped — a partial warm is better than no warm.
   *
   * @example
   * await cache.warmCache(prompts, async ({ prompt, model }) => {
   *   const res = await llmGateway.complete({
   *     messages: [{ role: 'user', content: prompt }],
   *     model,
   *     metadata: { tenantId: SYSTEM_TENANT_ID },
   *   });
   *   return res.content;
   * });
   */
  async warmCache(
    prompts: Array<{ prompt: string; model: string }>,
    llmCaller?: (entry: { prompt: string; model: string }) => Promise<string>
  ): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      logger.info('Cache warming skipped — cache disabled or Redis not connected');
      return;
    }

    if (!llmCaller) {
      logger.warn('warmCache called without llmCaller — skipping. Pass an llmCaller to populate the cache.');
      return;
    }

    logger.info('Starting cache warm', { count: prompts.length });

    let warmed = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of prompts) {
      try {
        const existing = await this.get(entry.prompt, entry.model);
        if (existing !== null) {
          skipped++;
          continue;
        }

        const response = await llmCaller(entry);

        await this.set(entry.prompt, entry.model, response, {
          promptTokens: 0,
          completionTokens: 0,
          cost: 0,
        });

        warmed++;
      } catch (error: unknown) {
        failed++;
        logger.error('Cache warm failed for prompt', {
          model: entry.model,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Cache warm complete', { warmed, skipped, failed });
  }
  
  /**
   * Set custom TTL for specific cache entry
   */
  async setWithTTL(
    prompt: string,
    model: string,
    response: string,
    metadata: {
      promptTokens: number;
      completionTokens: number;
      cost: number;
    },
    ttl: number,
    options?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }
    
    try {
      const key = this.generateCacheKey(prompt, model, options);
      
      const entry: LLMCacheEntry = {
        response,
        model,
        promptTokens: metadata.promptTokens,
        completionTokens: metadata.completionTokens,
        cost: metadata.cost,
        cachedAt: new Date().toISOString(),
        hitCount: 0
      };
      
      await this.client.set(key, JSON.stringify(entry), {
        EX: ttl
      });
      
      logger.cache('set', key, {
        model,
        cost: metadata.cost,
        ttl
      });
    } catch (error: unknown) {
      logger.error('Failed to set cache with TTL', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

// Export singleton instance
export const llmCache = new LLMCache();

/**
 * Initialize cache on application startup
 */
export async function initializeLLMCache(): Promise<void> {
  try {
    await llmCache.connect();
    logger.info('✅ LLM cache initialized');
    
    // Log initial stats
    const stats = await llmCache.getStats();
    logger.info('Cache stats', stats);
  } catch (error: unknown) {
    logger.error('Failed to initialize LLM cache', error instanceof Error ? error : new Error(String(error)));
    logger.warn('LLM caching will be disabled');
  }
}