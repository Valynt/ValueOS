import crypto from "node:crypto";

import {
  CACHE_TTL_TIERS_SECONDS,
  CacheTtlTier,
  tenantReadCacheKey,
  tenantReadCachePattern,
} from "@shared/lib/redisKeys";

import {
  cacheCoalescedWaitersTotal,
  cacheLoaderDurationMs,
  cacheRequestsTotal,
} from "../../lib/metrics/cacheMetrics.js";
import { readCacheEventsTotal } from "../../lib/metrics/httpMetrics.js";
import { getRedisClient } from "../../lib/redisClient.js";

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

interface CacheMetricLabels {
  cache_name: string;
  cache_namespace: string;
}

export class ReadThroughCacheService {
  private static readonly INVALIDATION_SCAN_BATCH_SIZE = 100;
  private static readonly INVALIDATION_DELETE_BATCH_SIZE = 100;
  private static readonly DEFAULT_NEAR_CACHE_TTL_SECONDS = 15;
  private static readonly DEFAULT_NEAR_CACHE_MAX_ENTRIES = 128;
  private static readonly inFlightLoads = new Map<string, Promise<unknown>>();
  private static readonly nearCache = new Map<string, NearCacheEntry>();

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
    const serialized = JSON.stringify(payload ?? {});
    return crypto.createHash("sha1").update(serialized).digest("hex");
  }

  private static createKey(config: ReadCacheConfig): string {
    const queryHash = this.hashPayload(config.keyPayload);
    return tenantReadCacheKey({
      tenantId: config.tenantId,
      endpoint: config.endpoint,
      scope: config.scope,
      queryHash,
    });
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
      ttlSeconds:
        config.nearCache?.ttlSeconds ?? this.DEFAULT_NEAR_CACHE_TTL_SECONDS,
      maxEntries:
        config.nearCache?.maxEntries ?? this.DEFAULT_NEAR_CACHE_MAX_ENTRIES,
    };
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
    }

    this.nearCache.set(key, {
      value,
      expiresAt: Date.now() + settings.ttlSeconds * 1000,
    });
  }

  private static pruneExpiredNearCacheEntries(): void {
    const now = Date.now();
    for (const [key, entry] of this.nearCache.entries()) {
      if (entry.expiresAt < now) {
        this.nearCache.delete(key);
      }
    }
  }

  private static deleteNearCachedKey(key: string): void {
    this.nearCache.delete(key);
  }

  private static deleteNearCachedEndpoint(tenantId: string, endpoint: string): number {
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
  }

  static async getOrLoad<T>(
    config: ReadCacheConfig,
    loader: () => Promise<T>
  ): Promise<T> {
    const redis = (await getRedisClient('cache')) as RedisWithScanAndMulti | null;
    const key = this.createKey(config);
    const labels = this.cacheMetricLabels(config);

    const nearCached = this.getNearCachedValue<T>(key, config, labels);
    if (nearCached !== null) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      return nearCached;
    }

    if (!redis) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: 'bypass' });
      return loader();
    }

    let cached: string | null = null;
    try {
      cached = await redis.get(key);
    } catch {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: 'bypass' });
      return loader();
    }

    if (cached) {
      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      cacheRequestsTotal.inc({
        ...labels,
        cache_layer: "redis",
        outcome: "hit",
      });
      this.setNearCachedValue(key, cached, config);
      return JSON.parse(cached) as T;
    }

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

    readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "miss" });
    cacheRequestsTotal.inc({
      ...labels,
      cache_layer: "redis",
      outcome: "miss",
    });

    const loadPromise = (async () => {
      const startedAt = Date.now();
      try {
        const loaded = await loader();

        if (loaded !== undefined) {
          const serialized = JSON.stringify(loaded);
          const ttl = CACHE_TTL_TIERS_SECONDS[config.tier];
          try {
            await redis.set(key, serialized, { EX: ttl });
          } catch {
            readCacheEventsTotal.inc({ endpoint: config.endpoint, event: 'bypass' });
          }
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
    const redis = (await getRedisClient('cache')) as RedisWithScanAndMulti | null;
    const pattern = tenantReadCachePattern({ tenantId, endpoint });
    let cursor = "0";
    let deleted = this.deleteNearCachedEndpoint(tenantId, endpoint);

    if (!redis) {
      if (deleted) {
        readCacheEventsTotal.inc({ endpoint, event: 'eviction' }, deleted);
      }
      return deleted;
    }

    try {
      do {
      const [nextCursor, keys] = await redis.scan(cursor, {
        MATCH: pattern,
        COUNT: this.INVALIDATION_SCAN_BATCH_SIZE,
      });
      cursor = nextCursor;

      if (!keys.length) {
        continue;
      }

        deleted += await this.deleteKeys(redis, keys);
      } while (cursor !== "0");
    } catch {
      return deleted;
    }

    if (!deleted) {
      return 0;
    }

    readCacheEventsTotal.inc({ endpoint, event: "eviction" }, deleted);
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
