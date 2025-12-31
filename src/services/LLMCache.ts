/**
 * LLM Response Caching Service
 * 
 * Caches Together.ai responses in Redis to reduce costs and improve performance.
 * Implements intelligent cache key generation and TTL management.
 */

import { createClient, RedisClientType } from 'redis';
import crypto from 'crypto';
import { logger } from '../utils/logger';

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
    
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    });
    
    this.client.on('error', (err) => {
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
      await this.client.connect();
    }
  }
  
  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }
  
  /**
   * Generate cache key from prompt and model
   */
  private generateCacheKey(prompt: string, model: string, options?: any): string {
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
    options?: any
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
      
      // Increment hit count
      entry.hitCount++;
      await this.client.set(key, JSON.stringify(entry), {
        EX: this.config.ttl
      });
      
      logger.cache('hit', key, {
        model,
        hitCount: entry.hitCount,
        cost: entry.cost
      });
      
      return entry;
    } catch (error) {
      logger.error('Failed to get from cache', error as Error);
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
    options?: any
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
        EX: this.config.ttl
      });
      
      logger.cache('set', key, {
        model,
        cost: metadata.cost,
        ttl: this.config.ttl
      });
    } catch (error) {
      logger.error('Failed to set cache', error as Error);
    }
  }
  
  /**
   * Delete cached response
   */
  async delete(prompt: string, model: string, options?: any): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }
    
    try {
      const key = this.generateCacheKey(prompt, model, options);
      await this.client.del(key);
      
      logger.cache('delete', key);
    } catch (error) {
      logger.error('Failed to delete from cache', error as Error);
    }
  }
  
  /**
   * Clear all LLM cache entries
   */
  async clear(): Promise<void> {
    if (!this.config.enabled || !this.connected) {
      return;
    }
    
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} cache entries`);
      }
    } catch (error) {
      logger.error('Failed to clear cache', error as Error);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalHits: number;
    totalCostSaved: number;
    cacheSize: number;
  }> {
    if (!this.config.enabled || !this.connected) {
      return {
        totalEntries: 0,
        totalHits: 0,
        totalCostSaved: 0,
        cacheSize: 0
      };
    }
    
    try {
      const keys = await this.client.keys(`${this.config.keyPrefix}*`);
      let totalHits = 0;
      let totalCostSaved = 0;
      
      for (const key of keys) {
        const cached = await this.client.get(key);
        if (cached) {
          const entry: LLMCacheEntry = JSON.parse(cached);
          totalHits += entry.hitCount;
          totalCostSaved += entry.cost * entry.hitCount;
        }
      }
      
      // Get approximate memory usage
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const cacheSize = memoryMatch ? parseInt(memoryMatch[1]) : 0;
      
      return {
        totalEntries: keys.length,
        totalHits,
        totalCostSaved,
        cacheSize
      };
    } catch (error) {
      logger.error('Failed to get cache stats', error as Error);
      return {
        totalEntries: 0,
        totalHits: 0,
        totalCostSaved: 0,
        cacheSize: 0
      };
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
   * Warm cache with common prompts
   */
  async warmCache(prompts: Array<{ prompt: string; model: string }>): Promise<void> {
    logger.info(`Warming cache with ${prompts.length} prompts`);
    
    // This would typically call the LLM service to populate cache
    // Implementation depends on your LLM service structure
    logger.warn('Cache warming not implemented - requires LLM service integration');
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
    options?: any
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
    } catch (error) {
      logger.error('Failed to set cache with TTL', error as Error);
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
  } catch (error) {
    logger.error('Failed to initialize LLM cache', error as Error);
    logger.warn('LLM caching will be disabled');
  }
}
