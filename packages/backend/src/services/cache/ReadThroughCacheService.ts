import crypto from "node:crypto";

import {
  CACHE_TTL_TIERS_SECONDS,
  CacheTtlTier,
  MissingTenantContextError,
  tenantReadCacheKey,
  tenantReadCachePattern,
} from "@shared/lib/redisKeys";

import {
  cacheCoalescedWaitersTotal,
  cacheEvictionsTotal,
  cacheFallbackModeTotal,
  cacheFillDurationMs,
  cacheHitRate,
  cacheLoaderDurationMs,
  cacheRequestsTotal,
} from "../../lib/metrics/cacheMetrics.js";
import { readCacheEventsTotal } from "../../lib/metrics/httpMetrics.js";
import { getRedisClient } from "../../lib/redis.js";
import { logger } from "../../lib/logger.js";
import {
  CacheMetricLabels,
  getNearCacheTtlSeconds,
  normalizeCacheKeyPayload,
} from "./CachePolicy.js";

interface RedisDeletionPipeline {
  unlink: (key: string) => RedisDeletionPipeline;
  del: (key: string) => RedisDeletionPipeline;
  exec: () => Promise<Array<number | null>>;
}

interface RedisWithScanAndMulti {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, options: { EX: number }) => Promise<unknown>;
  scan: (
    cursor: string,
    options: { MATCH: string; COUNT: number }
  ) => Promise<[string, string[]]>;
  multi: () => RedisDeletionPipeline;
}

interface NearCacheEntry {
  value: string;
  expiresAt: number;
  labels: CacheMetricLabels;
}

export interface ReadCacheNearCacheConfig {
  enabled?: boolean;
  ttlSeconds?: number;
  maxEntries?: number;
}

export interface ReadCacheConfig {
  endpoint: string;
  tenantId: string;
  namespace?: string;
  scope?: string;
  tier: CacheTtlTier;
  keyPayload?: unknown;
  nearCache?: ReadCacheNearCacheConfig;
}

export class ReadThroughCacheService {
  private static readonly INVALIDATION_SCAN_BATCH_SIZE = 100;
  private static readonly INVALIDATION_DELETE_BATCH_SIZE = 100;
  private static readonly DEFAULT_NEAR_CACHE_TTL_SECONDS = 15;
  private static readonly DEFAULT_NEAR_CACHE_MAX_ENTRIES = 128;
  private static readonly inFlightLoads = new Map<string, Promise<unknown>>();
  private static readonly nearCache = new Map<string, NearCacheEntry>();
  private static readonly stats = new Map<string, { hits: number; misses: number }>();

  private static async deleteKeysWithCommand(
    keys: string[],
    command: "unlink" | "del",
    createPipeline: () => RedisDeletionPipeline
  ): Promise<number> {
    let deleted = 0;

    for (
      let index = 0;
      index < keys.length;
      index += this.INVALIDATION_DELETE_BATCH_SIZE
    ) {
      const keyBatch = keys.slice(
        index,
        index + this.INVALIDATION_DELETE_BATCH_SIZE
      );
      const pipeline = createPipeline();

      for (const key of keyBatch) {
        if (command === "unlink") {
          pipeline.unlink(key);
        } else {
          pipeline.del(key);
        }
      }

      const result = await pipeline.exec();
      deleted += result.reduce(
        (count, item) => count + (typeof item === "number" ? item : 0),
        0
      );
    }

    return deleted;
  }

  private static async deleteKeys(
    redis: RedisWithScanAndMulti,
    keys: string[]
  ): Promise<number> {
    try {
      return await this.deleteKeysWithCommand(keys, "unlink", () => redis.multi());
    } catch {
      return this.deleteKeysWithCommand(keys, "del", () => redis.multi());
    }
  }

  private static hashPayload(payload: unknown): string {
    const serialized = JSON.stringify(normalizeCacheKeyPayload(payload ?? {}));
    return crypto.createHash("sha1").update(serialized).digest("hex");
  }

  private static createKey(config: ReadCacheConfig): string {
    try {
      const queryHash = this.hashPayload(config.keyPayload);
      return tenantReadCacheKey({
        tenantId: config.tenantId,
        endpoint: config.endpoint,
        scope: config.scope,
        queryHash,
      });
    } catch (error) {
      if (error instanceof MissingTenantContextError) {
        // Convert to a 500-equivalent error for API layer
        const securityError = new Error(
          `Cache operation failed: Missing tenant context. ${error.message}`
        );
        (securityError as Error & { statusCode: number }).statusCode = 500;
        throw securityError;
      }
      throw error;
    }
  }

  private static cacheMetricLabels(config: ReadCacheConfig): CacheMetricLabels {
    return {
      cache_name: `read-through:${config.endpoint}`,
      cache_namespace: config.namespace ?? config.endpoint,
    };
  }

  private static getNearCacheSettings(config: ReadCacheConfig): Required<ReadCacheNearCacheConfig> {
    return {
      enabled: config.nearCache?.enabled ?? false,
      ttlSeconds: getNearCacheTtlSeconds(
        config.nearCache?.ttlSeconds ?? this.DEFAULT_NEAR_CACHE_TTL_SECONDS
      ),
      maxEntries:
        config.nearCache?.maxEntries ?? this.DEFAULT_NEAR_CACHE_MAX_ENTRIES,
    };
  }

  private static updateHitRate(
    labels: CacheMetricLabels,
    outcome: "hit" | "miss"
  ): void {
    const key = `${labels.cache_name}:${labels.cache_namespace}`;
    const current = this.stats.get(key) ?? { hits: 0, misses: 0 };

    if (outcome === "hit") {
      current.hits += 1;
    } else {
      current.misses += 1;
    }

    this.stats.set(key, current);
    const total = current.hits + current.misses;
    cacheHitRate.set(labels, total > 0 ? current.hits / total : 0);
  }

  private static getNearCachedValue<T>(
    key: string,
    config: ReadCacheConfig,
    labels: CacheMetricLabels
  ): T | null {
    const settings = this.getNearCacheSettings(config);
    if (!settings.enabled) {
      return null;
    }

    const cached = this.nearCache.get(key);
    if (!cached) {
      return null;
    }

    if (cached.expiresAt < Date.now()) {
      this.nearCache.delete(key);
      return null;
    }

    this.nearCache.delete(key);
    this.nearCache.set(key, cached);
    cacheRequestsTotal.inc({
      ...labels,
      cache_layer: "near",
      outcome: "hit",
    });
    this.updateHitRate(labels, "hit");
    return JSON.parse(cached.value) as T;
  }

  private static setNearCachedValue(
    key: string,
    value: string,
    config: ReadCacheConfig
  ): void {
    const settings = this.getNearCacheSettings(config);
    if (!settings.enabled) {
      return;
    }

    this.pruneExpiredNearCacheEntries();

    while (this.nearCache.size >= settings.maxEntries) {
      const oldestKey = this.nearCache.keys().next().value;
      if (typeof oldestKey !== "string") {
        break;
      }
      this.nearCache.delete(oldestKey);
      cacheEvictionsTotal.inc({
        cache_name: `read-through:${config.endpoint}`,
        cache_namespace: config.namespace ?? config.endpoint,
        cache_layer: "near",
        reason: "capacity",
      });
    }

    this.nearCache.set(key, {
      value,
      expiresAt: Date.now() + settings.ttlSeconds * 1000,
      labels: this.cacheMetricLabels(config),
    });
  }

  private static pruneExpiredNearCacheEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.nearCache.entries()) {
      if (entry.expiresAt < now) {
        this.nearCache.delete(key);
        cacheEvictionsTotal.inc({
          ...entry.labels,
          cache_layer: "near",
          reason: "ttl",
        });
      }
    }
  }

  private static deleteNearCachedKey(key: string): void {
    this.nearCache.delete(key);
  }

  private static deleteNearCachedEndpoint(tenantId: string, endpoint: string): number {
    try {
      const prefix = tenantReadCachePattern({ tenantId, endpoint }).replace(/\*$/, "");
      let deleted = 0;

      for (const key of this.nearCache.keys()) {
        if (!key.startsWith(prefix)) {
          continue;
        }

        this.nearCache.delete(key);
        deleted += 1;
      }

      return deleted;
    } catch (error) {
      if (error instanceof MissingTenantContextError) {
        // Log and return 0 - invalidation is best-effort
        logger.warn("Cache invalidation skipped: missing tenant context", { tenantId, endpoint });
        return 0;
      }
      throw error;
    }
  }

  static async getOrLoad<T>(
    config: ReadCacheConfig,
    loader: () => Promise<T>
  ): Promise<T> {
    const key = this.createKey(config);
    const labels = this.cacheMetricLabels(config);
    const redis = (await getRedisClient()) as RedisWithScanAndMulti | null;

    const inFlightLoad = this.inFlightLoads.get(key) as Promise<T> | undefined;
    if (inFlightLoad) {
      cacheCoalescedWaitersTotal.inc(labels);
      cacheRequestsTotal.inc({
        ...labels,
        cache_layer: "process",
        outcome: "coalesced",
      });
      return inFlightLoad;
    }

    if (!redis) {
      cacheFallbackModeTotal.inc({
        ...labels,
        fallback_mode: "bypass",
        reason: "redis_unavailable",
      });
      const loadPromise = (async () => {
        const startedAt = Date.now();
        try {
          return await loader();
        } finally {
          cacheLoaderDurationMs.observe(labels, Date.now() - startedAt);
          this.inFlightLoads.delete(key);
        }
      })();
      this.inFlightLoads.set(key, loadPromise);
      return loadPromise;
    }

    const nearCached = this.getNearCachedValue<T>(key, config, labels);
    if (nearCached !== null) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      return nearCached;
    }

    const cached = await redis.get(key);
    if (cached) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      cacheRequestsTotal.inc({
        ...labels,
        cache_layer: "redis",
        outcome: "hit",
      });
      this.updateHitRate(labels, "hit");
      this.setNearCachedValue(key, cached, config);
      return JSON.parse(cached) as T;
    }

    readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "miss" });
    cacheRequestsTotal.inc({
      ...labels,
      cache_layer: "redis",
      outcome: "miss",
    });
    this.updateHitRate(labels, "miss");

    const coalescedAfterMiss = this.inFlightLoads.get(key) as Promise<T> | undefined;
    if (coalescedAfterMiss) {
      cacheCoalescedWaitersTotal.inc(labels);
      cacheRequestsTotal.inc({
        ...labels,
        cache_layer: "process",
        outcome: "coalesced",
      });
      return coalescedAfterMiss;
    }

    const loadPromise = (async () => {
      const startedAt = Date.now();
      try {
        const loaded = await loader();

        if (loaded !== undefined) {
          const serialized = JSON.stringify(loaded);
          const ttl = CACHE_TTL_TIERS_SECONDS[config.tier];
          await redis.set(key, serialized, { EX: ttl });
          cacheFillDurationMs.observe(labels, Date.now() - startedAt);
          this.setNearCachedValue(key, serialized, config);
        } else {
          this.deleteNearCachedKey(key);
        }

        return loaded;
      } finally {
        cacheLoaderDurationMs.observe(labels, Date.now() - startedAt);
        this.inFlightLoads.delete(key);
      }
    })();

    this.inFlightLoads.set(key, loadPromise);
    return loadPromise;
  }

  static async invalidateEndpoint(
    tenantId: string,
    endpoint: string
  ): Promise<number> {
    let pattern: string;
    try {
      pattern = tenantReadCachePattern({ tenantId, endpoint });
    } catch (error) {
      if (error instanceof MissingTenantContextError) {
        const securityError = new Error(
          `Cache invalidation failed: Missing tenant context. ${error.message}`
        );
        (securityError as Error & { statusCode: number }).statusCode = 500;
        throw securityError;
      }
      throw error;
    }

    const redis = (await getRedisClient()) as RedisWithScanAndMulti | null;
    let cursor = "0";
    const nearDeleted = this.deleteNearCachedEndpoint(tenantId, endpoint);
    let redisDeleted = 0;

    if (nearDeleted > 0) {
      cacheEvictionsTotal.inc(
        {
          cache_name: `read-through:${endpoint}`,
          cache_namespace: endpoint,
          cache_layer: "near",
          reason: "invalidation",
        },
        nearDeleted
      );
    }

    if (!redis) {
      cacheFallbackModeTotal.inc({
        cache_name: `read-through:${endpoint}`,
        cache_namespace: endpoint,
        fallback_mode: "bypass",
        reason: "redis_unavailable",
      });
      return nearDeleted;
    }

    do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: this.INVALIDATION_SCAN_BATCH_SIZE,
      });
      cursor = nextCursor;

      if (!keys.length) {
        continue;
      }

      redisDeleted += await this.deleteKeys(redis, keys);
    } while (cursor !== "0");

    const deleted = nearDeleted + redisDeleted;

    if (!deleted) {
      return 0;
    }

    readCacheEventsTotal.inc({ endpoint, event: "eviction" }, deleted);
    cacheEvictionsTotal.inc(
      {
        cache_name: `read-through:${endpoint}`,
        cache_namespace: endpoint,
        cache_layer: "redis",
        reason: "invalidation",
      },
      redisDeleted
    );
    return deleted;
  }

  static clearNearCacheForTesting(): void {
    this.nearCache.clear();
    this.inFlightLoads.clear();
  }
}

export function getTenantIdFromRequest(req: {
  tenantId?: string;
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const tenantHeader = req.headers["x-tenant-id"];
  const organizationHeader = req.headers["x-organization-id"];

  const tenant =
    (Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader) ||
    (Array.isArray(organizationHeader)
      ? organizationHeader[0]
      : organizationHeader) ||
    req.tenantId;

  return tenant || undefined;
}
