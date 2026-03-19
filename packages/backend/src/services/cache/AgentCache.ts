/**
 * Agent Cache Service
 *
 * Redis-first cache for agent responses and coordination data with an optional,
 * very small in-process near-cache for ultra-hot keys.
 */

import { EventEmitter } from "events";

import {
  cacheRequestsTotal,
} from "../../lib/metrics/cacheMetrics.js";
import { logger } from "../../lib/logger.js";
import {
  deleteCache,
  deleteCachePattern,
  getCache,
  isRedisConnected,
  setCache,
} from "../../lib/redis.js";
import { getRedisKey } from "../../lib/redisClient.js";

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  evictionRate: number;
  totalSize: number;
  averageTtl: number;
  oldestEntry: number;
  newestEntry: number;
}

export interface CacheConfig {
  namespace: string;
  nearCacheEnabled: boolean;
  nearCacheMaxSizeMb: number;
  nearCacheMaxEntries: number;
  nearCacheDefaultTtl: number;
  l2Enabled: boolean;
  l2DefaultTtl: number;
  l2KeyPrefix: string;
  evictionPolicy: "lru" | "lfu" | "ttl" | "random";
  compressionEnabled: boolean;
  serializationFormat: "json" | "binary";
  cleanupInterval: number;
  statsReportingInterval: number;
}

export interface CacheOptions {
  ttl?: number;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
}

export class AgentCache extends EventEmitter {
  private config: CacheConfig;
  private nearCache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    sets: 0,
    gets: 0,
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    super();

    this.config = {
      namespace: "agent-cache",
      nearCacheEnabled: false,
      nearCacheMaxSizeMb: 16,
      nearCacheMaxEntries: 256,
      nearCacheDefaultTtl: 15,
      l2Enabled: isRedisConnected(),
      l2DefaultTtl: 1800,
      l2KeyPrefix: "agent-cache:",
      evictionPolicy: "lru",
      compressionEnabled: false,
      serializationFormat: "json",
      cleanupInterval: 60,
      statsReportingInterval: 300,
      ...config,
    };

    logger.info("AgentCache initialized", {
      namespace: this.config.namespace,
      nearCacheEnabled: this.config.nearCacheEnabled,
      nearCacheMaxEntries: this.config.nearCacheMaxEntries,
      l2Enabled: this.config.l2Enabled,
      redisConnected: isRedisConnected(),
    });

    this.startCleanup();
    this.startStatsReporting();
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    this.stats.gets += 1;

    const nearEntry = this.nearCache.get(key);
    if (nearEntry && !this.isExpired(nearEntry)) {
      nearEntry.accessCount += 1;
      nearEntry.lastAccessed = Date.now();
      this.stats.hits += 1;
      this.incrementRequestMetric("near", "hit");
      this.emit("cacheHit", { key, level: "near" });
      return nearEntry.value as T;
    }

    if (nearEntry && this.isExpired(nearEntry)) {
      this.nearCache.delete(key);
    }

    if (this.config.l2Enabled && isRedisConnected()) {
      const l2Value = await getCache<CacheEntry<T>>(this.getDistributedKey(key));
      if (l2Value && !this.isExpired(l2Value)) {
        this.stats.hits += 1;
        this.incrementRequestMetric("redis", "hit");
        this.writeNearCache(key, l2Value.value, {
          ttl: Math.min(
            Math.max(1, Math.floor(l2Value.ttl / 1000)),
            this.config.nearCacheDefaultTtl
          ),
          metadata: { ...l2Value.metadata, promotedFrom: "redis" },
        });
        this.emit("cacheHit", { key, level: "redis" });
        return l2Value.value;
      }

      if (l2Value && this.isExpired(l2Value)) {
        await deleteCache(this.getDistributedKey(key));
      }
    }

    this.stats.misses += 1;
    this.incrementRequestMetric("redis", "miss");
    this.emit("cacheMiss", { key });
    return null;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    this.stats.sets += 1;
    this.writeNearCache(key, value, options);

    if (this.config.l2Enabled && isRedisConnected()) {
      const ttl = options.ttl ?? this.config.l2DefaultTtl;
      const entry: CacheEntry<T> = {
        key,
        value,
        timestamp: Date.now(),
        ttl: ttl * 1000,
        accessCount: 0,
        lastAccessed: Date.now(),
        size: this.calculateSize(value),
        metadata: options.metadata,
      };
      await setCache(this.getDistributedKey(key), entry, ttl);
    }

    this.emit("cacheSet", {
      key,
      ttl: options.ttl ?? this.config.l2DefaultTtl,
      namespace: this.config.namespace,
    });
  }

  async delete(key: string): Promise<boolean> {
    const nearDeleted = this.nearCache.delete(key);
    const l2Deleted = await deleteCache(this.getDistributedKey(key));
    const deleted = nearDeleted || l2Deleted;

    if (deleted) {
      this.emit("cacheDelete", { key, namespace: this.config.namespace });
    }

    return deleted;
  }

  async clear(pattern?: string): Promise<number> {
    let deleted = 0;

    if (!pattern) {
      deleted = this.nearCache.size;
      this.nearCache.clear();
      if (this.config.l2Enabled && isRedisConnected()) {
        deleted += await deleteCachePattern(`${this.config.l2KeyPrefix}*`);
      }
      this.emit("cacheClear", { pattern, deleted, namespace: this.config.namespace });
      return deleted;
    }

    const regex = new RegExp(pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"));
    for (const key of this.nearCache.keys()) {
      if (!regex.test(key)) {
        continue;
      }
      this.nearCache.delete(key);
      deleted += 1;
    }

    if (this.config.l2Enabled && isRedisConnected()) {
      deleted += await deleteCachePattern(this.getDistributedPattern(pattern));
    }

    this.emit("cacheClear", { pattern, deleted, namespace: this.config.namespace });
    return deleted;
  }

  async invalidateTenant(tenantId: string): Promise<number> {
    return this.clear(`${tenantId}:*`);
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const missRate = total > 0 ? this.stats.misses / total : 0;
    const evictionRate = this.stats.sets > 0 ? this.stats.evictions / this.stats.sets : 0;
    const entries = Array.from(this.nearCache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageTtl = entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length
      : 0;
    const timestamps = entries.map((entry) => entry.timestamp);

    return {
      totalEntries: this.nearCache.size,
      hitRate,
      missRate,
      evictionRate,
      totalSize,
      averageTtl,
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : 0,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : 0,
    };
  }

  async warmup<T = unknown>(
    entries: Array<{ key: string; value: T; ttl?: number }>
  ): Promise<void> {
    logger.info("Starting cache warmup", {
      entries: entries.length,
      namespace: this.config.namespace,
    });

    for (const entry of entries) {
      await this.set(entry.key, entry.value, { ttl: entry.ttl });
    }

    logger.info("Cache warmup completed", {
      entries: entries.length,
      namespace: this.config.namespace,
    });
  }

  shutdown(): void {
    this.stopCleanup();
    this.stopStatsReporting();
    this.removeAllListeners();
    this.nearCache.clear();
    logger.info("Agent cache service shutdown", {
      namespace: this.config.namespace,
    });
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval * 1000);
  }

  private stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit("stats", stats);

      if (stats.hitRate < 0.5) {
        logger.warn("Low cache hit rate", {
          namespace: this.config.namespace,
          hitRate: stats.hitRate,
        });
      }

      if (stats.evictionRate > 0.1) {
        logger.warn("High cache eviction rate", {
          namespace: this.config.namespace,
          evictionRate: stats.evictionRate,
        });
      }
    }, this.config.statsReportingInterval * 1000);
  }

  private stopStatsReporting(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  private cleanupExpiredEntries(): void {
    let cleaned = 0;

    for (const [key, entry] of this.nearCache.entries()) {
      if (!this.isExpired(entry)) {
        continue;
      }

      this.nearCache.delete(key);
      cleaned += 1;
    }

    if (cleaned > 0) {
      this.emit("cleanup", { cleaned, namespace: this.config.namespace });
      logger.debug("AgentCache cleanup completed", {
        cleaned,
        namespace: this.config.namespace,
      });
    }
  }

  private writeNearCache<T>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): void {
    if (!this.config.nearCacheEnabled) {
      return;
    }

    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl: (options.ttl ?? this.config.nearCacheDefaultTtl) * 1000,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.calculateSize(value),
      metadata: options.metadata,
    };

    if (this.shouldEvictNearCache(entry)) {
      this.evictNearCacheEntries();
    }

    this.nearCache.set(key, entry);
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private shouldEvictNearCache(newEntry: CacheEntry): boolean {
    const currentSize = Array.from(this.nearCache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    return (
      this.nearCache.size >= this.config.nearCacheMaxEntries ||
      currentSize + newEntry.size > this.config.nearCacheMaxSizeMb * 1024 * 1024
    );
  }

  private evictNearCacheEntries(): void {
    const entries = Array.from(this.nearCache.entries());

    switch (this.config.evictionPolicy) {
      case "lfu":
        this.evictLFU(entries);
        break;
      case "ttl":
        this.evictByTTL(entries);
        break;
      case "random":
        this.evictRandom(entries);
        break;
      case "lru":
      default:
        this.evictLRU(entries);
        break;
    }
  }

  private evictLRU(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    this.deleteEvictionBatch(entries);
  }

  private evictLFU(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
    this.deleteEvictionBatch(entries);
  }

  private evictByTTL(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.ttl - b.ttl);
    this.deleteEvictionBatch(entries);
  }

  private evictRandom(entries: Array<[string, CacheEntry]>): void {
    const randomised = [...entries].sort(() => Math.random() - 0.5);
    this.deleteEvictionBatch(randomised);
  }

  private deleteEvictionBatch(entries: Array<[string, CacheEntry]>): void {
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));
    for (let index = 0; index < evictCount; index += 1) {
      const key = entries[index]?.[0];
      if (!key) {
        continue;
      }
      this.nearCache.delete(key);
      this.stats.evictions += 1;
    }
  }

  private calculateSize(value: unknown): number {
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024;
    }
  }

  private getDistributedKey(key: string): string {
    return getRedisKey(undefined, `${this.config.l2KeyPrefix}${this.config.namespace}:${key}`);
  }

  private getDistributedPattern(pattern: string): string {
    return getRedisKey(undefined, `${this.config.l2KeyPrefix}${this.config.namespace}:${pattern}`);
  }

  private incrementRequestMetric(layer: string, outcome: string): void {
    cacheRequestsTotal.inc({
      cache_name: "agent-cache",
      cache_namespace: this.config.namespace,
      cache_layer: layer,
      outcome,
    });
  }
}

let agentCacheInstance: AgentCache | null = null;

export function getAgentCache(config?: Partial<CacheConfig>): AgentCache {
  if (!agentCacheInstance) {
    agentCacheInstance = new AgentCache(config);
  }
  return agentCacheInstance;
}
