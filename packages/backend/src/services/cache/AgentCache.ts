/**
 * Agent Cache Service
 *
 * Redis-first cache for agent responses and coordination data with an optional,
 * very small in-process near-cache for ultra-hot keys.
 */

import { EventEmitter } from "events";

import {
  cacheEvictionsTotal,
  cacheFallbackModeTotal,
  cacheFillDurationMs,
  cacheHitRate,
  cacheRequestsTotal,
} from "../../lib/metrics/cacheMetrics.js";
import { logger } from "../../lib/logger.js";
import { logSecurityEvent } from "../security/auditLogger.js";
import {
  deleteCache,
  deleteCachePattern,
  getCache,
  isRedisConnected,
  setCache,
} from "../../lib/redis.js";
import { getRedisKey } from "../../lib/redisClient.js";
import { getNearCacheTtlSeconds } from "./CachePolicy.js";

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

/**
 * Rate limiter for cache invalidation operations (S1-4)
 * Prevents abuse of cache invalidation APIs
 */
class CacheInvalidationRateLimiter {
  private attempts = new Map<string, { count: number; resetTime: number }>();
  private maxAttempts: number;
  private windowMs: number;

  constructor(maxAttempts = 10, windowMs = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(key: string): boolean {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record || now > record.resetTime) {
      this.attempts.set(key, { count: 1, resetTime: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxAttempts) {
      return false;
    }

    record.count++;
    return true;
  }

  getRemainingAttempts(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return this.maxAttempts;
    return Math.max(0, this.maxAttempts - record.count);
  }
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

  private rateLimiter = new CacheInvalidationRateLimiter();

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
    const labels = this.metricLabels();
    const redisAvailable = this.config.l2Enabled && isRedisConnected();

    const nearEntry = redisAvailable ? this.nearCache.get(key) : null;
    if (nearEntry && !this.isExpired(nearEntry)) {
      nearEntry.accessCount += 1;
      nearEntry.lastAccessed = Date.now();
      this.stats.hits += 1;
      this.incrementRequestMetric("near", "hit");
      this.updateHitRateMetric();
      this.emit("cacheHit", { key, level: "near" });
      return nearEntry.value as T;
    }

    if (nearEntry && this.isExpired(nearEntry)) {
      this.nearCache.delete(key);
    }

    if (this.config.l2Enabled && redisAvailable) {
      const l2Value = await getCache<CacheEntry<T>>(this.getDistributedKey(key));
      if (l2Value && !this.isExpired(l2Value)) {
        this.stats.hits += 1;
        this.incrementRequestMetric("redis", "hit");
        this.updateHitRateMetric();
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

    if (this.config.l2Enabled && !redisAvailable) {
      cacheFallbackModeTotal.inc({
        ...labels,
        fallback_mode: "bypass",
        reason: "redis_unavailable",
      });
    }

    this.stats.misses += 1;
    this.incrementRequestMetric("redis", "miss");
    this.updateHitRateMetric();
    this.emit("cacheMiss", { key });
    return null;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    this.stats.sets += 1;
    const labels = this.metricLabels();
    const redisAvailable = this.config.l2Enabled && isRedisConnected();
    if (redisAvailable) {
      this.writeNearCache(key, value, options);
    } else if (this.config.l2Enabled) {
      cacheFallbackModeTotal.inc({
        ...labels,
        fallback_mode: "bypass",
        reason: "redis_unavailable",
      });
    }

    if (this.config.l2Enabled && redisAvailable) {
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
      const fillStartedAt = Date.now();
      await setCache(this.getDistributedKey(key), entry, ttl);
      cacheFillDurationMs.observe(labels, Date.now() - fillStartedAt);
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

  /**
   * Invalidate cache for a tenant with caller verification (S1-4)
   *
   * Requires the caller to provide their tenant ID, and verifies that
   * the caller owns the target tenant before allowing invalidation.
   * Includes audit logging and rate limiting.
   *
   * @param tenantId - The tenant whose cache should be invalidated
   * @param callerTenantId - The caller's tenant ID for verification
   * @param callerContext - Additional context for audit logging
   * @returns Number of entries cleared
   * @throws Error if caller doesn't own the tenant or rate limit exceeded
   */
  async invalidateTenant(
    tenantId: string,
    callerTenantId: string,
    callerContext?: { userId?: string; requestId?: string; reason?: string }
  ): Promise<number> {
    // S1-4: Rate limiting check
    const rateLimitKey = `invalidate:${callerTenantId}`;
    if (!this.rateLimiter.isAllowed(rateLimitKey)) {
      logger.warn("Cache invalidation rate limit exceeded", {
        callerTenantId,
        targetTenantId: tenantId,
        requestId: callerContext?.requestId,
      });
      throw new Error("Rate limit exceeded for cache invalidation");
    }

    // S1-4: Verify caller owns the target tenant
    if (callerTenantId !== tenantId) {
      // In a multi-tenant system, we need to verify the caller can access this tenant
      // For now, we only allow invalidating own tenant cache
      // Future: Add admin/service_role capability to invalidate any tenant
      logger.error("Cache invalidation rejected - caller doesn't own tenant", {
        callerTenantId,
        targetTenantId: tenantId,
        requestId: callerContext?.requestId,
        userId: callerContext?.userId,
      });

      // S1-4: Emit audit log for rejected invalidation attempt
      try {
        await logSecurityEvent({
          timestamp: new Date().toISOString(),
          action: "cache_invalidation_rejected",
          resource: "cache",
          resourceType: "cache",
          userId: callerContext?.userId || "system",
          organizationId: callerTenantId,
          tenantId: callerTenantId,
          sessionId: callerContext?.requestId,
          outcome: "blocked",
          severity: "medium",
          details: {
            target_tenant_id: tenantId,
            reason: "caller_does_not_own_tenant",
            rate_limit_remaining: this.rateLimiter.getRemainingAttempts(rateLimitKey),
          },
        });
      } catch (auditErr) {
        logger.error("Failed to emit audit log for rejected cache invalidation", { error: auditErr });
      }

      throw new Error("Cache invalidation rejected: caller does not own the target tenant");
    }

    // Perform the invalidation
    const clearedCount = await this.clear(`${tenantId}:*`);

    // S1-4: Emit audit log for successful invalidation
    try {
      await logSecurityEvent({
        timestamp: new Date().toISOString(),
        action: "cache_invalidation",
        resource: "cache",
        resourceType: "cache",
        userId: callerContext?.userId || "system",
        organizationId: tenantId,
        tenantId,
        sessionId: callerContext?.requestId,
        outcome: "success",
        severity: "low",
        details: {
          entries_cleared: clearedCount,
          reason: callerContext?.reason || "explicit_invalidation",
          rate_limit_remaining: this.rateLimiter.getRemainingAttempts(rateLimitKey),
        },
      });
    } catch (auditErr) {
      logger.error("Failed to emit audit log for cache invalidation", { error: auditErr });
    }

    logger.info("Cache invalidated for tenant", {
      tenantId,
      callerUserId: callerContext?.userId,
      entriesCleared: clearedCount,
      requestId: callerContext?.requestId,
    });

    return clearedCount;
  }

  /**
   * Legacy invalidateTenant - deprecated, use invalidateTenant with caller verification
   * @deprecated Use invalidateTenant(tenantId, callerTenantId, callerContext) instead
   */
  async invalidateTenantLegacy(tenantId: string): Promise<number> {
    logger.warn("Using deprecated invalidateTenant without caller verification", { tenantId });
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
      ttl:
        getNearCacheTtlSeconds(
          options.ttl ?? this.config.nearCacheDefaultTtl
        ) * 1000,
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
      cacheEvictionsTotal.inc({
        ...this.metricLabels(),
        cache_layer: "near",
        reason: "capacity",
      });
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
    // SECURITY: AgentCache uses a global namespace for agent coordination keys
    // that are not tenant-scoped (e.g., kill switches, agent registry).
    // For tenant-scoped data, use ReadThroughCacheService with explicit tenantId.
    return `${this.config.l2KeyPrefix}${this.config.namespace}:${key}`;
  }

  private getDistributedPattern(pattern: string): string {
    return `${this.config.l2KeyPrefix}${this.config.namespace}:${pattern}`;
  }

  private incrementRequestMetric(layer: string, outcome: string): void {
    cacheRequestsTotal.inc({
      ...this.metricLabels(),
      cache_layer: layer,
      outcome,
    });
  }

  private metricLabels(): { cache_name: string; cache_namespace: string } {
    return {
      cache_name: "agent-cache",
      cache_namespace: this.config.namespace,
    };
  }

  private updateHitRateMetric(): void {
    const total = this.stats.hits + this.stats.misses;
    cacheHitRate.set(this.metricLabels(), total > 0 ? this.stats.hits / total : 0);
  }
}

let agentCacheInstance: AgentCache | null = null;

export function getAgentCache(config?: Partial<CacheConfig>): AgentCache {
  if (!agentCacheInstance) {
    agentCacheInstance = new AgentCache(config);
  }
  return agentCacheInstance;
}
