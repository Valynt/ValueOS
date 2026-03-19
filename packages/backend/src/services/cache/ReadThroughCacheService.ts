import crypto from "node:crypto";

import {
  CACHE_TTL_TIERS_SECONDS,
  CacheTtlTier,
  tenantReadCacheKey,
  tenantReadCachePattern,
} from "@shared/lib/redisKeys";

import {
  cacheCoalescedWaitersTotal,
  cacheInvalidationsTotal,
  cacheLoaderDurationMs,
  cacheNamespaceRequestsTotal,
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

interface NearCacheEntry<T> {
  value: T;
  expiresAt: number;
}

class ProcessLocalNearCache<T> {
  private readonly store = new Map<string, NearCacheEntry<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.pruneExpired();

    if (this.store.has(key)) {
      this.store.delete(key);
    }

    while (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.store.delete(oldestKey);
    }

    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  deleteMatching(predicate: (key: string) => boolean): number {
    let deleted = 0;

    for (const key of this.store.keys()) {
      if (!predicate(key)) {
        continue;
      }

      this.store.delete(key);
      deleted += 1;
    }

    return deleted;
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    this.pruneExpired();
    return this.store.size;
  }

  private pruneExpired(): void {
    const now = Date.now();

    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > now) {
        continue;
      }

      this.store.delete(key);
    }
  }
}

export interface NearCacheConfig {
  enabled?: boolean;
  ttlMs: number;
  maxEntries: number;
}

export interface ReadCacheConfig {
  endpoint: string;
  tenantId: string;
  namespace?: string;
  scope?: string;
  tier: CacheTtlTier;
  keyPayload?: unknown;
  nearCache?: NearCacheConfig;
}

export interface NearCacheDiagnostics {
  namespace: string;
  size: number;
}

export class ReadThroughCacheService {
  private static readonly INVALIDATION_SCAN_BATCH_SIZE = 100;
  private static readonly INVALIDATION_DELETE_BATCH_SIZE = 100;
  private static readonly inFlightLoads = new Map<string, Promise<unknown>>();
  private static readonly nearCaches = new Map<string, ProcessLocalNearCache<unknown>>();

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

  private static cacheMetricName(config: ReadCacheConfig): string {
    return config.namespace ?? `read-through:${config.endpoint}`;
  }

  private static cacheNamespace(config: ReadCacheConfig): string {
    return config.namespace ?? config.endpoint;
  }

  private static isNearCacheEnabled(config: ReadCacheConfig): boolean {
    return config.nearCache?.enabled === true;
  }

  private static getNearCache(config: ReadCacheConfig): ProcessLocalNearCache<unknown> | null {
    if (!this.isNearCacheEnabled(config) || !config.nearCache) {
      return null;
    }

    const namespace = this.cacheNamespace(config);
    const existing = this.nearCaches.get(namespace);
    if (existing) {
      return existing;
    }

    const created = new ProcessLocalNearCache<unknown>(config.nearCache.maxEntries);
    this.nearCaches.set(namespace, created);
    return created;
  }

  private static recordNamespaceRequest(
    config: ReadCacheConfig,
    layer: "near" | "redis",
    outcome: "hit" | "miss" | "coalesced"
  ): void {
    cacheNamespaceRequestsTotal.inc({
      cache_name: this.cacheMetricName(config),
      cache_namespace: this.cacheNamespace(config),
      layer,
      outcome,
    });
  }

  static async getOrLoad<T>(
    config: ReadCacheConfig,
    loader: () => Promise<T>
  ): Promise<T> {
    const redis = (await getRedisClient()) as RedisWithScanAndMulti;
    const key = this.createKey(config);
    const cacheName = this.cacheMetricName(config);
    const nearCache = this.getNearCache(config);

    if (nearCache && config.nearCache) {
      const localHit = nearCache.get(key) as T | null;
      if (localHit !== null) {
        this.recordNamespaceRequest(config, "near", "hit");
        readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
        cacheRequestsTotal.inc({ cache_name: cacheName, outcome: "hit" });
        return localHit;
      }

      this.recordNamespaceRequest(config, "near", "miss");
    }

    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached) as T;
      if (nearCache && config.nearCache) {
        nearCache.set(key, parsed, config.nearCache.ttlMs);
      }

      readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "hit" });
      cacheRequestsTotal.inc({ cache_name: cacheName, outcome: "hit" });
      this.recordNamespaceRequest(config, "redis", "hit");
      return parsed;
    }

    this.recordNamespaceRequest(config, "redis", "miss");

    const inFlightLoad = this.inFlightLoads.get(key) as Promise<T> | undefined;
    if (inFlightLoad) {
      cacheCoalescedWaitersTotal.inc({ cache_name: cacheName });
      cacheRequestsTotal.inc({ cache_name: cacheName, outcome: "coalesced" });
      this.recordNamespaceRequest(config, "redis", "coalesced");
      return inFlightLoad;
    }

    readCacheEventsTotal.inc({ endpoint: config.endpoint, event: "miss" });
    cacheRequestsTotal.inc({ cache_name: cacheName, outcome: "miss" });

    const loadPromise = (async () => {
      const startedAt = Date.now();
      try {
        const loaded = await loader();

        if (loaded !== undefined) {
          const ttl = CACHE_TTL_TIERS_SECONDS[config.tier];
          await redis.set(key, JSON.stringify(loaded), { EX: ttl });
          if (nearCache && config.nearCache) {
            nearCache.set(key, loaded, config.nearCache.ttlMs);
          }
        }

        return loaded;
      } finally {
        cacheLoaderDurationMs.observe(
          { cache_name: cacheName },
          Date.now() - startedAt
        );
        this.inFlightLoads.delete(key);
      }
    })();

    this.inFlightLoads.set(key, loadPromise);
    return loadPromise;
  }

  static async invalidateEndpoint(
    tenantId: string,
    endpoint: string,
    options?: { namespace?: string; scope?: string }
  ): Promise<number> {
    const redis = (await getRedisClient()) as RedisWithScanAndMulti;
    const pattern = options?.scope
      ? `${tenantReadCacheKey({
          tenantId,
          endpoint,
          scope: options.scope,
        })}*`
      : tenantReadCachePattern({ tenantId, endpoint });
    let cursor = "0";
    let deleted = 0;

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

    const namespace = options?.namespace ?? endpoint;
    const nearCache = this.nearCaches.get(namespace);
    const localDeleted = nearCache
      ? nearCache.deleteMatching((key) => key.startsWith(pattern.replace(/\*$/, "")))
      : 0;
    const totalDeleted = deleted + localDeleted;

    if (!totalDeleted) {
      return 0;
    }

    readCacheEventsTotal.inc({ endpoint, event: "eviction" }, totalDeleted);
    cacheInvalidationsTotal.inc(
      {
        cache_name: namespace,
        cache_namespace: namespace,
        scope: options?.scope ?? "endpoint",
      },
      totalDeleted
    );
    return totalDeleted;
  }

  static getNearCacheDiagnostics(): NearCacheDiagnostics[] {
    return Array.from(this.nearCaches.entries()).map(([namespace, cache]) => ({
      namespace,
      size: cache.size(),
    }));
  }

  static seedNearCacheForTesting<T>(config: ReadCacheConfig, value: T): void {
    const nearCache = this.getNearCache(config);
    if (!nearCache || !config.nearCache) {
      return;
    }

    nearCache.set(this.createKey(config), value, config.nearCache.ttlMs);
  }

  static clearNearCachesForTesting(): void {
    for (const cache of this.nearCaches.values()) {
      cache.clear();
    }
    this.nearCaches.clear();
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
