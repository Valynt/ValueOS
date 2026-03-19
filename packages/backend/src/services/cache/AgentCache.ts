/**
 * Agent Cache Service
 *
 * Redis-backed cache for shared agent artifacts. A tiny optional process-local
 * near-cache can be enabled for ultra-hot keys, but Redis remains the primary
 * source of truth so cache effectiveness is preserved across backend replicas.
 */

import { EventEmitter } from "events";

import {
  cacheInvalidationsTotal,
  cacheNamespaceRequestsTotal,
} from "../../lib/metrics/cacheMetrics.js";
import { logger } from "../../lib/logger.js";
import {
  deleteCache,
  deleteCachePattern,
  getCache,
  getRedisKey,
  isRedisConnected,
  setCache,
} from "../../lib/redis.js";

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
  l1MaxSize: number;
  l1MaxEntries: number;
  l1DefaultTtl: number;
  l1Enabled: boolean;
  l2Enabled: boolean;
  l2DefaultTtl: number;
  l2KeyPrefix: string;
  evictionPolicy: "lru" | "lfu" | "ttl" | "random";
  compressionEnabled: boolean;
  serializationFormat: "json" | "binary";
  cleanupInterval: number;
  statsReportingInterval: number;
}

export interface CacheScope {
  tenantId?: string;
  namespace?: string;
}

export interface CacheOptions extends CacheScope {
  ttl?: number;
  tags?: string[];
  priority?: "low" | "medium" | "high";
  metadata?: Record<string, unknown>;
  nearCacheTtl?: number;
}

export class AgentCache extends EventEmitter {
  private config: CacheConfig;
  private l1Cache = new Map<string, CacheEntry>();

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
      l1MaxSize: 16,
      l1MaxEntries: 128,
      l1DefaultTtl: 15,
      l1Enabled: true,
      l2Enabled: isRedisConnected(),
      l2DefaultTtl: 300,
      l2KeyPrefix: "agent-cache:",
      evictionPolicy: "lru",
      compressionEnabled: true,
      serializationFormat: "json",
      cleanupInterval: 60,
      statsReportingInterval: 300,
      ...config,
    };

    logger.info("AgentCache initialized", {
      l1Enabled: this.config.l1Enabled,
      l1MaxSize: this.config.l1MaxSize,
      l1MaxEntries: this.config.l1MaxEntries,
      l2Enabled: this.config.l2Enabled,
      redisConnected: isRedisConnected(),
    });

    this.startCleanup();
    this.startStatsReporting();
  }

  async get<T = unknown>(key: string, scope: CacheScope = {}): Promise<T | null> {
    this.stats.gets++;
    const scopedKey = this.buildScopedKey(key, scope);
    const namespace = this.resolveNamespace(scope.namespace);

    if (this.config.l1Enabled) {
      const l1Entry = this.l1Cache.get(scopedKey);
      if (l1Entry && !this.isExpired(l1Entry)) {
        l1Entry.accessCount++;
        l1Entry.lastAccessed = Date.now();
        this.stats.hits++;
        this.recordNamespaceRequest(namespace, "near", "hit");
        this.emit("cacheHit", { key, level: "L1", namespace, tenantId: scope.tenantId });
        return l1Entry.value as T;
      }

      if (l1Entry && this.isExpired(l1Entry)) {
        this.l1Cache.delete(scopedKey);
      }

      this.recordNamespaceRequest(namespace, "near", "miss");
    }

    if (this.config.l2Enabled && isRedisConnected()) {
      const l2Value = await getCache<CacheEntry<T>>(scopedKey);

      if (l2Value && !this.isExpired(l2Value)) {
        this.promoteToNearCache(scopedKey, l2Value);
        this.stats.hits++;
        this.recordNamespaceRequest(namespace, "redis", "hit");
        this.emit("cacheHit", { key, level: "L2", namespace, tenantId: scope.tenantId });
        return l2Value.value;
      }

      if (l2Value && this.isExpired(l2Value)) {
        await deleteCache(scopedKey);
      }

      this.recordNamespaceRequest(namespace, "redis", "miss");
    }

    this.stats.misses++;
    this.emit("cacheMiss", { key, namespace, tenantId: scope.tenantId });
    return null;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const namespace = this.resolveNamespace(options.namespace);
    const scopedKey = this.buildScopedKey(key, options);
    const l2TtlSeconds = options.ttl ?? this.config.l2DefaultTtl;
    const nearCacheTtlSeconds = Math.min(
      options.nearCacheTtl ?? this.config.l1DefaultTtl,
      l2TtlSeconds
    );
    const size = this.calculateSize(value);

    const entry: CacheEntry<T> = {
      key: scopedKey,
      value,
      timestamp: Date.now(),
      ttl: l2TtlSeconds * 1000,
      accessCount: 0,
      lastAccessed: Date.now(),
      size,
      metadata: options.metadata,
    };

    if (this.config.l2Enabled && isRedisConnected()) {
      await setCache(scopedKey, entry, l2TtlSeconds);
    }

    if (this.config.l1Enabled) {
      this.setNearCacheEntry(scopedKey, {
        ...entry,
        ttl: nearCacheTtlSeconds * 1000,
      });
    }

    this.stats.sets++;
    this.emit("cacheSet", {
      key,
      namespace,
      tenantId: options.tenantId,
      size,
      ttl: l2TtlSeconds,
    });
  }

  async delete(key: string, scope: CacheScope = {}): Promise<boolean> {
    const scopedKey = this.buildScopedKey(key, scope);
    const namespace = this.resolveNamespace(scope.namespace);
    const l1Deleted = this.l1Cache.delete(scopedKey);
    let l2Deleted = false;

    if (this.config.l2Enabled && isRedisConnected()) {
      l2Deleted = await deleteCache(scopedKey);
    }

    const deleted = l1Deleted || l2Deleted;
    if (deleted) {
      cacheInvalidationsTotal.inc(
        {
          cache_name: this.cacheMetricName(),
          cache_namespace: namespace,
          scope: "key",
        },
        1
      );
      this.emit("cacheDelete", { key, namespace, tenantId: scope.tenantId });
    }

    return deleted;
  }

  async clear(pattern?: string, scope: CacheScope = {}): Promise<number> {
    const namespace = this.resolveNamespace(scope.namespace);
    const localPrefix = this.buildScopedKey(pattern ?? "", scope);
    let deleted = 0;

    if (!pattern) {
      for (const key of this.l1Cache.keys()) {
        if (!key.startsWith(localPrefix)) {
          continue;
        }
        this.l1Cache.delete(key);
        deleted += 1;
      }
    } else {
      const matcher = this.createPatternMatcher(this.buildScopedKey(pattern, scope));
      for (const key of this.l1Cache.keys()) {
        if (!matcher(key)) {
          continue;
        }
        this.l1Cache.delete(key);
        deleted += 1;
      }
    }

    if (this.config.l2Enabled && isRedisConnected()) {
      const deletePattern = this.buildScopedPattern(pattern ?? "*", scope);
      deleted += await deleteCachePattern(deletePattern);
    }

    if (deleted > 0) {
      cacheInvalidationsTotal.inc(
        {
          cache_name: this.cacheMetricName(),
          cache_namespace: namespace,
          scope: pattern ? "pattern" : "namespace",
        },
        deleted
      );
    }

    this.emit("cacheClear", { pattern, namespace, tenantId: scope.tenantId, deleted });
    return deleted;
  }

  async invalidateNamespace(tenantId: string, namespace: string): Promise<number> {
    return this.clear("*", { tenantId, namespace });
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total : 0;
    const missRate = total > 0 ? this.stats.misses / total : 0;
    const evictionRate =
      this.stats.sets > 0 ? this.stats.evictions / this.stats.sets : 0;

    const entries = Array.from(this.l1Cache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageTtl =
      entries.length > 0
        ? entries.reduce((sum, entry) => sum + entry.ttl, 0) / entries.length
        : 0;

    const timestamps = entries.map((entry) => entry.timestamp);
    const oldestEntry = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestEntry = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      totalEntries: this.l1Cache.size,
      hitRate,
      missRate,
      evictionRate,
      totalSize,
      averageTtl,
      oldestEntry,
      newestEntry,
    };
  }

  async warmup<T = unknown>(
    entries: Array<{ key: string; value: T; ttl?: number; tenantId?: string; namespace?: string }>
  ): Promise<void> {
    logger.info("Starting cache warmup", { entries: entries.length });

    for (const entry of entries) {
      await this.set(entry.key, entry.value, {
        ttl: entry.ttl,
        tenantId: entry.tenantId,
        namespace: entry.namespace,
      });
    }

    logger.info("Cache warmup completed", { entries: entries.length });
  }

  shutdown(): void {
    this.stopCleanup();
    this.stopStatsReporting();
    this.removeAllListeners();
    this.l1Cache.clear();
    logger.info("Agent cache service shutdown");
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, this.config.cleanupInterval * 1000);
    this.cleanupInterval.unref?.();
  }

  private stopCleanup(): void {
    if (!this.cleanupInterval) {
      return;
    }

    clearInterval(this.cleanupInterval);
    this.cleanupInterval = null;
  }

  private startStatsReporting(): void {
    this.statsInterval = setInterval(() => {
      const stats = this.getStats();
      this.emit("stats", stats);

      if (stats.hitRate < 0.5) {
        logger.warn("Low cache hit rate", { hitRate: stats.hitRate });
      }

      if (stats.evictionRate > 0.1) {
        logger.warn("High eviction rate", { evictionRate: stats.evictionRate });
      }
    }, this.config.statsReportingInterval * 1000);
    this.statsInterval.unref?.();
  }

  private stopStatsReporting(): void {
    if (!this.statsInterval) {
      return;
    }

    clearInterval(this.statsInterval);
    this.statsInterval = null;
  }

  private cleanupExpiredEntries(): void {
    let cleaned = 0;

    for (const [key, entry] of this.l1Cache.entries()) {
      if (!this.isExpired(entry)) {
        continue;
      }

      this.l1Cache.delete(key);
      cleaned += 1;
    }

    if (cleaned > 0) {
      this.emit("cleanup", { cleaned });
      logger.debug("Cache cleanup completed", { cleaned });
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private shouldEvictL1(newEntry: CacheEntry): boolean {
    const currentSize = Array.from(this.l1Cache.values()).reduce(
      (sum, entry) => sum + entry.size,
      0
    );

    return (
      this.l1Cache.size >= this.config.l1MaxEntries ||
      currentSize + newEntry.size > this.config.l1MaxSize * 1024 * 1024
    );
  }

  private evictL1Entries(): void {
    const entries = Array.from(this.l1Cache.entries());

    switch (this.config.evictionPolicy) {
      case "lru":
        this.evictLRU(entries);
        break;
      case "lfu":
        this.evictLFU(entries);
        break;
      case "ttl":
        this.evictByTTL(entries);
        break;
      case "random":
        this.evictRandom(entries);
        break;
    }
  }

  private evictLRU(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let index = 0; index < evictCount; index += 1) {
      const key = entries[index]?.[0];
      if (!key) {
        continue;
      }

      this.l1Cache.delete(key);
      this.stats.evictions++;
    }
  }

  private evictLFU(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.accessCount - b.accessCount);
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let index = 0; index < evictCount; index += 1) {
      const key = entries[index]?.[0];
      if (!key) {
        continue;
      }

      this.l1Cache.delete(key);
      this.stats.evictions++;
    }
  }

  private evictByTTL(entries: Array<[string, CacheEntry]>): void {
    entries.sort(([, a], [, b]) => a.ttl - b.ttl);
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let index = 0; index < evictCount; index += 1) {
      const key = entries[index]?.[0];
      if (!key) {
        continue;
      }

      this.l1Cache.delete(key);
      this.stats.evictions++;
    }
  }

  private evictRandom(entries: Array<[string, CacheEntry]>): void {
    const evictCount = Math.max(1, Math.floor(entries.length * 0.25));

    for (let index = 0; index < evictCount; index += 1) {
      const randomIndex = Math.floor(Math.random() * entries.length);
      const key = entries[randomIndex]?.[0];
      if (!key) {
        continue;
      }

      this.l1Cache.delete(key);
      this.stats.evictions++;
    }
  }

  private buildScopedKey(key: string, scope: CacheScope): string {
    const namespace = this.resolveNamespace(scope.namespace);
    return getRedisKey(
      scope.tenantId,
      `${this.config.l2KeyPrefix}${namespace}:${key}`
    );
  }

  private buildScopedPattern(pattern: string, scope: CacheScope): string {
    const namespace = this.resolveNamespace(scope.namespace);
    return getRedisKey(
      scope.tenantId,
      `${this.config.l2KeyPrefix}${namespace}:${pattern}`
    );
  }

  private resolveNamespace(namespace?: string): string {
    return namespace?.trim() || "default";
  }

  private cacheMetricName(): string {
    return this.config.l2KeyPrefix.replace(/:+$/, "") || "agent-cache";
  }

  private recordNamespaceRequest(
    namespace: string,
    layer: "near" | "redis",
    outcome: "hit" | "miss"
  ): void {
    cacheNamespaceRequestsTotal.inc({
      cache_name: this.cacheMetricName(),
      cache_namespace: namespace,
      layer,
      outcome,
    });
  }

  private promoteToNearCache<T>(scopedKey: string, entry: CacheEntry<T>): void {
    if (!this.config.l1Enabled) {
      return;
    }

    const remainingTtlMs = Math.max(1, entry.ttl - (Date.now() - entry.timestamp));
    const nearCacheTtlMs = Math.min(
      remainingTtlMs,
      this.config.l1DefaultTtl * 1000
    );

    this.setNearCacheEntry(scopedKey, {
      ...entry,
      ttl: nearCacheTtlMs,
      timestamp: Date.now(),
      lastAccessed: Date.now(),
    });
  }

  private setNearCacheEntry(entryKey: string, entry: CacheEntry): void {
    if (this.shouldEvictL1(entry)) {
      this.evictL1Entries();
    }

    this.l1Cache.set(entryKey, entry);
  }

  private createPatternMatcher(pattern: string): (key: string) => boolean {
    const escapedPattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`^${escapedPattern.replace(/\*/g, ".*")}$`);
    return (key: string) => regex.test(key);
  }

  private calculateSize(value: unknown): number {
    try {
      const serialized = JSON.stringify(value);
      return serialized.length * 2;
    } catch {
      return 1024;
    }
  }
}

let agentCacheInstance: AgentCache | null = null;

export function getAgentCache(config?: Partial<CacheConfig>): AgentCache {
  if (!agentCacheInstance) {
    agentCacheInstance = new AgentCache(config);
  }
  return agentCacheInstance;
}
