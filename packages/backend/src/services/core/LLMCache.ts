// Migrated from apps/ValyntApp/src/services/LLMCache.ts
// and packages/backend/src/services/LLMCache.ts (identical logic, import paths differed).
// Canonical location: packages/core-services/src/LLMCache.ts

import crypto from 'crypto';

import Redis, { type Redis as RedisClientType } from 'ioredis';

export interface CacheConfig {
  ttl: number;
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
  private connected = false;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      ttl: 24 * 60 * 60,
      enabled: process.env.ENABLE_LLM_CACHE !== 'false',
      keyPrefix: 'llm:cache:',
      ...config,
    };

    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      retryStrategy: (retries) => Math.min(retries * 50, 500),
    });

    this.client.on('error', () => { this.connected = false; });
    this.client.on('connect', () => { this.connected = true; });
    this.client.on('close', () => { this.connected = false; });
  }

  async connect(): Promise<void> {
    // ioredis connects automatically
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (this.connected) await this.client.quit();
  }

  private generateCacheKey(prompt: string, model: string, options?: unknown): string {
    const content = JSON.stringify({ prompt: prompt.trim().toLowerCase(), model, options: options ?? {} });
    const hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
    return `${this.config.keyPrefix}${model}:${hash}`;
  }

  async get(prompt: string, model: string, options?: unknown): Promise<LLMCacheEntry | null> {
    if (!this.config.enabled || !this.connected) return null;

    try {
      const key = this.generateCacheKey(prompt, model, options);
      const cached = await this.client.get(key);
      if (!cached) return null;

      const entry: LLMCacheEntry = JSON.parse(cached);
      entry.hitCount++;
      await this.client.set(key, JSON.stringify(entry), { EX: this.config.ttl });
      return entry;
    } catch {
      return null;
    }
  }

  async set(
    prompt: string,
    model: string,
    response: string,
    metadata: { promptTokens: number; completionTokens: number; cost: number },
    options?: unknown
  ): Promise<void> {
    if (!this.config.enabled || !this.connected) return;

    try {
      const key = this.generateCacheKey(prompt, model, options);
      const entry: LLMCacheEntry = {
        response, model,
        promptTokens: metadata.promptTokens,
        completionTokens: metadata.completionTokens,
        cost: metadata.cost,
        cachedAt: new Date().toISOString(),
        hitCount: 0,
      };
      await this.client.set(key, JSON.stringify(entry), { EX: this.config.ttl });
    } catch {
      // Cache write failure is non-fatal
    }
  }

  async delete(prompt: string, model: string, options?: unknown): Promise<void> {
    if (!this.config.enabled || !this.connected) return;
    try {
      await this.client.del(this.generateCacheKey(prompt, model, options));
    } catch {
      // Cache delete failure is non-fatal
    }
  }

  async clear(): Promise<void> {
    if (!this.config.enabled || !this.connected) return;
    try {
      const keys: string[] = [];
      for await (const key of this.client.scanIterator({ MATCH: `${this.config.keyPrefix}*`, COUNT: 100 })) {
        keys.push(key);
      }
      if (keys.length > 0) await this.client.del(keys);
    } catch {
      // Cache clear failure is non-fatal
    }
  }

  async getStats(): Promise<{ totalEntries: number; totalHits: number; totalCostSaved: number; cacheSize: number }> {
    if (!this.config.enabled || !this.connected) {
      return { totalEntries: 0, totalHits: 0, totalCostSaved: 0, cacheSize: 0 };
    }

    try {
      // Collect keys with SCAN (non-blocking) instead of KEYS (O(N), blocks Redis).
      const keys: string[] = [];
      for await (const key of this.client.scanIterator({ MATCH: `${this.config.keyPrefix}*`, COUNT: 100 })) {
        keys.push(key);
      }

      let totalHits = 0;
      let totalCostSaved = 0;

      if (keys.length > 0) {
        // Batch all GETs into a single MGET round-trip.
        const values = await this.client.mget(keys);
        for (const raw of values) {
          if (raw) {
            const entry: LLMCacheEntry = JSON.parse(raw);
            totalHits += entry.hitCount;
            totalCostSaved += entry.cost * entry.hitCount;
          }
        }
      }

      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const cacheSize = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return { totalEntries: keys.length, totalHits, totalCostSaved, cacheSize };
    } catch {
      return { totalEntries: 0, totalHits: 0, totalCostSaved: 0, cacheSize: 0 };
    }
  }

  async getHitRate(): Promise<number> {
    const stats = await this.getStats();
    if (stats.totalEntries === 0) return 0;
    return (stats.totalHits / (stats.totalEntries + stats.totalHits)) * 100;
  }

  async setWithTTL(
    prompt: string,
    model: string,
    response: string,
    metadata: { promptTokens: number; completionTokens: number; cost: number },
    ttl: number,
    options?: unknown
  ): Promise<void> {
    if (!this.config.enabled || !this.connected) return;
    try {
      const key = this.generateCacheKey(prompt, model, options);
      const entry: LLMCacheEntry = {
        response, model,
        promptTokens: metadata.promptTokens,
        completionTokens: metadata.completionTokens,
        cost: metadata.cost,
        cachedAt: new Date().toISOString(),
        hitCount: 0,
      };
      await this.client.set(key, JSON.stringify(entry), { EX: ttl });
    } catch {
      // Cache write failure is non-fatal
    }
  }
}

export const llmCache = new LLMCache();

export async function initializeLLMCache(): Promise<void> {
  try {
    await llmCache.connect();
  } catch {
    // LLM caching will be disabled if Redis is unavailable
  }
}
