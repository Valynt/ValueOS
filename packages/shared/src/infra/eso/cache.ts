import crypto from "node:crypto";

import type { Redis } from "ioredis";

import { getEnvironment, isDevelopment, isTest } from "../../config/environment.js";
import { createLogger } from "../../lib/logger.js";
import { getRedisClient } from "../../lib/redisClient.js";
import {
  CACHE_TTL_TIERS_SECONDS,
  type CacheTtlTier,
  tenantReadCacheKey,
} from "../../lib/redisKeys.js";

import {
  esoCacheHitRateCounter,
  esoCacheMissLatencyHistogram,
  esoCacheStaleRefreshCounter,
  esoCacheStampedeCounter,
} from "./cacheMetrics.js";

const logger = createLogger({ component: "eso-cache" });

const DEFAULT_CACHE_TTL_MS = CACHE_TTL_TIERS_SECONDS.warm * 1000;
const DEFAULT_STALE_TTL_MS = CACHE_TTL_TIERS_SECONDS.cold * 1000;
const DEFAULT_LOCK_TTL_MS = 15000;
const DEFAULT_WAIT_TIMEOUT_MS = 16000;
const DEFAULT_WAIT_INTERVAL_MS = 50;
const LOCK_KEY_PREFIX = "eso-lock";

export interface ESOCacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
  staleUntil: number;
}

export interface ESOCacheKeyDescriptor {
  adapter: string;
  key: string;
  tenantId?: string | null;
  scope?: string;
}

export interface ESOCacheReadOptions extends ESOCacheKeyDescriptor {
  ttlMs?: number;
  staleTtlMs?: number;
}

export interface ESOCacheLoadOptions extends ESOCacheReadOptions {
  cacheTier?: CacheTtlTier;
  refreshStaleInBackground?: boolean;
  singleFlightLockTtlMs?: number;
  waitForSingleFlightMs?: number;
}

interface CacheBackend {
  readonly kind: "memory" | "redis";
  get<T>(key: string): Promise<ESOCacheEntry<T> | null>;
  set<T>(key: string, entry: ESOCacheEntry<T>, ttlMs: number): Promise<void>;
  clear(): Promise<void>;
  size(): Promise<number>;
  acquireLock?(key: string, ttlMs: number): Promise<string | null>;
  releaseLock?(key: string, token: string): Promise<void>;
}

class MemoryCacheBackend implements CacheBackend {
  readonly kind = "memory" as const;
  private readonly entries = new Map<string, ESOCacheEntry<unknown>>();

  async get<T>(key: string): Promise<ESOCacheEntry<T> | null> {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.staleUntil <= Date.now()) {
      this.entries.delete(key);
      return null;
    }

    return entry as ESOCacheEntry<T>;
  }

  async set<T>(key: string, entry: ESOCacheEntry<T>): Promise<void> {
    this.entries.set(key, entry);
  }

  async clear(): Promise<void> {
    this.entries.clear();
  }

  async size(): Promise<number> {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.staleUntil <= now) {
        this.entries.delete(key);
      }
    }

    return this.entries.size;
  }
}

interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    mode: "PX",
    durationMs: number,
    condition?: "NX"
  ): Promise<string | null>;
  del(key: string): Promise<number>;
  dbsize(): Promise<number>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<number>;
}

class RedisCacheBackend implements CacheBackend {
  readonly kind = "redis" as const;

  constructor(private readonly client: RedisCacheClient) {}

  async get<T>(key: string): Promise<ESOCacheEntry<T> | null> {
    const raw = await this.client.get(key);
    if (!raw) {
      return null;
    }

    const parsed = safeJsonParse<ESOCacheEntry<T>>(raw);
    if (!parsed) {
      await this.client.del(key);
      return null;
    }

    if (parsed.staleUntil <= Date.now()) {
      await this.client.del(key);
      return null;
    }

    return parsed;
  }

  async set<T>(key: string, entry: ESOCacheEntry<T>, ttlMs: number): Promise<void> {
    await this.client.set(key, JSON.stringify(entry), "PX", ttlMs);
  }

  async clear(): Promise<void> {
    logger.warn("Redis-backed ESO cache clear() is unsupported in production-safe mode.");
  }

  async size(): Promise<number> {
    return this.client.dbsize();
  }

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await this.client.set(key, token, "PX", ttlMs, "NX");
    return result === "OK" ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    await this.client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      1,
      key,
      token,
    );
  }
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn("Failed to parse ESO cache entry JSON", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function resolveTtlMs(ttlMs: number | undefined, cacheTier: CacheTtlTier | undefined): number {
  if (typeof ttlMs === "number") {
    return ttlMs;
  }

  if (cacheTier) {
    return CACHE_TTL_TIERS_SECONDS[cacheTier] * 1000;
  }

  return DEFAULT_CACHE_TTL_MS;
}

function hashKey(key: string): string {
  return crypto.createHash("sha1").update(key).digest("hex");
}

function buildCacheKey(descriptor: ESOCacheKeyDescriptor): string {
  return tenantReadCacheKey({
    tenantId: descriptor.tenantId,
    endpoint: `eso:${descriptor.adapter.toLowerCase()}`,
    scope: descriptor.scope,
    queryHash: hashKey(descriptor.key),
  });
}

function buildLockKey(cacheKey: string): string {
  return `${LOCK_KEY_PREFIX}:${cacheKey}`;
}

function isFresh(entry: ESOCacheEntry<unknown>): boolean {
  return entry.expiresAt > Date.now();
}

function isStale(entry: ESOCacheEntry<unknown>): boolean {
  const now = Date.now();
  return entry.expiresAt <= now && entry.staleUntil > now;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export class ESOCache {
  private static readonly inFlightLoads = new Map<string, Promise<unknown>>();
  private readonly backend: CacheBackend;
  private readonly defaultTtlMs: number;
  private readonly defaultStaleTtlMs: number;

  constructor(defaultTTL: number = DEFAULT_CACHE_TTL_MS) {
    this.defaultTtlMs = defaultTTL;
    this.defaultStaleTtlMs = Math.max(defaultTTL, DEFAULT_STALE_TTL_MS);
    this.backend = createCacheBackend();
  }

  async get<T>(key: string, options: Omit<ESOCacheReadOptions, "key">): Promise<T | null> {
    const cacheKey = buildCacheKey({ ...options, key });
    const entry = await this.backend.get<T>(cacheKey);
    if (!entry) {
      return null;
    }

    return isFresh(entry) ? entry.value : null;
  }

  async set<T>(key: string, data: T, options: Omit<ESOCacheLoadOptions, "key">): Promise<void> {
    const ttlMs = resolveTtlMs(options.ttlMs ?? this.defaultTtlMs, options.cacheTier);
    const staleTtlMs = Math.max(options.staleTtlMs ?? this.defaultStaleTtlMs, ttlMs);
    const cacheKey = buildCacheKey({ ...options, key });
    const now = Date.now();
    const entry: ESOCacheEntry<T> = {
      value: data,
      cachedAt: now,
      expiresAt: now + ttlMs,
      staleUntil: now + staleTtlMs,
    };

    await this.backend.set(cacheKey, entry, staleTtlMs);
  }

  async getOrLoad<T>(options: ESOCacheLoadOptions, loader: () => Promise<T>): Promise<T> {
    const ttlMs = resolveTtlMs(options.ttlMs ?? this.defaultTtlMs, options.cacheTier);
    const staleTtlMs = Math.max(options.staleTtlMs ?? this.defaultStaleTtlMs, ttlMs);
    const cacheKey = buildCacheKey(options);
    const metricAttributes = {
      adapter: options.adapter.toLowerCase(),
      backend: this.backend.kind,
      environment: getEnvironment(),
    };

    const cached = await this.backend.get<T>(cacheKey);
    if (cached && isFresh(cached)) {
      esoCacheHitRateCounter.add(1, { ...metricAttributes, outcome: "hit" });
      return cached.value;
    }

    if (cached && isStale(cached)) {
      esoCacheHitRateCounter.add(1, { ...metricAttributes, outcome: "stale_hit" });
      if (options.refreshStaleInBackground !== false) {
        this.scheduleStaleRefresh(cacheKey, options, ttlMs, staleTtlMs, loader);
      }
      return cached.value;
    }

    esoCacheHitRateCounter.add(1, { ...metricAttributes, outcome: "miss" });
    return this.loadWithSingleFlight(cacheKey, options, ttlMs, staleTtlMs, loader);
  }

  async clear(): Promise<void> {
    await this.backend.clear();
  }

  async size(): Promise<number> {
    return this.backend.size();
  }

  private scheduleStaleRefresh<T>(
    cacheKey: string,
    options: ESOCacheLoadOptions,
    ttlMs: number,
    staleTtlMs: number,
    loader: () => Promise<T>,
  ): void {
    if (ESOCache.inFlightLoads.has(cacheKey)) {
      esoCacheStampedeCounter.add(1, {
        adapter: options.adapter.toLowerCase(),
        backend: this.backend.kind,
        event: "stale_refresh_joined",
        environment: getEnvironment(),
      });
      return;
    }

    esoCacheStaleRefreshCounter.add(1, {
      adapter: options.adapter.toLowerCase(),
      backend: this.backend.kind,
      status: "scheduled",
      environment: getEnvironment(),
    });

    void this.loadWithSingleFlight(cacheKey, options, ttlMs, staleTtlMs, loader, true).catch((error) => {
      logger.warn("ESO stale refresh failed", {
        adapter: options.adapter,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  private async loadWithSingleFlight<T>(
    cacheKey: string,
    options: ESOCacheLoadOptions,
    ttlMs: number,
    staleTtlMs: number,
    loader: () => Promise<T>,
    isStaleRefresh = false,
  ): Promise<T> {
    const existing = ESOCache.inFlightLoads.get(cacheKey) as Promise<T> | undefined;
    if (existing) {
      esoCacheStampedeCounter.add(1, {
        adapter: options.adapter.toLowerCase(),
        backend: this.backend.kind,
        event: "coalesced_waiter",
        environment: getEnvironment(),
      });
      return existing;
    }

    const promise = this.executeLoad(cacheKey, options, ttlMs, staleTtlMs, loader, isStaleRefresh);
    ESOCache.inFlightLoads.set(cacheKey, promise);

    try {
      return await promise;
    } finally {
      ESOCache.inFlightLoads.delete(cacheKey);
    }
  }

  private async executeLoad<T>(
    cacheKey: string,
    options: ESOCacheLoadOptions,
    ttlMs: number,
    staleTtlMs: number,
    loader: () => Promise<T>,
    isStaleRefresh: boolean,
  ): Promise<T> {
    const distributedLockTtlMs = options.singleFlightLockTtlMs ?? DEFAULT_LOCK_TTL_MS;
    const waitTimeoutMs = options.waitForSingleFlightMs ?? DEFAULT_WAIT_TIMEOUT_MS;
    const lockKey = buildLockKey(cacheKey);
    let lockToken: string | null = null;

    if (this.backend.acquireLock) {
      lockToken = await this.backend.acquireLock(lockKey, distributedLockTtlMs);

      if (!lockToken) {
        esoCacheStampedeCounter.add(1, {
          adapter: options.adapter.toLowerCase(),
          backend: this.backend.kind,
          event: "distributed_waiter",
          environment: getEnvironment(),
        });

        const awaited = await this.waitForCacheFill<T>(cacheKey, waitTimeoutMs);
        if (awaited) {
          return awaited;
        }
      }
    }

    const startedAt = Date.now();

    if (isStaleRefresh) {
      esoCacheStaleRefreshCounter.add(1, {
        adapter: options.adapter.toLowerCase(),
        backend: this.backend.kind,
        status: "started",
        environment: getEnvironment(),
      });
    }

    try {
      const loaded = await loader();
      const now = Date.now();
      const entry: ESOCacheEntry<T> = {
        value: loaded,
        cachedAt: now,
        expiresAt: now + ttlMs,
        staleUntil: now + staleTtlMs,
      };
      await this.backend.set(cacheKey, entry, staleTtlMs);
      esoCacheMissLatencyHistogram.record(Date.now() - startedAt, {
        adapter: options.adapter.toLowerCase(),
        backend: this.backend.kind,
        refresh: isStaleRefresh ? "stale" : "miss",
        environment: getEnvironment(),
      });

      if (isStaleRefresh) {
        esoCacheStaleRefreshCounter.add(1, {
          adapter: options.adapter.toLowerCase(),
          backend: this.backend.kind,
          status: "completed",
          environment: getEnvironment(),
        });
      }

      return loaded;
    } catch (error) {
      if (isStaleRefresh) {
        esoCacheStaleRefreshCounter.add(1, {
          adapter: options.adapter.toLowerCase(),
          backend: this.backend.kind,
          status: "failed",
          environment: getEnvironment(),
        });
      }
      throw error;
    } finally {
      if (lockToken && this.backend.releaseLock) {
        await this.backend.releaseLock(lockKey, lockToken);
      }
    }
  }

  private async waitForCacheFill<T>(cacheKey: string, timeoutMs: number): Promise<T | null> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const entry = await this.backend.get<T>(cacheKey);
      if (entry) {
        return entry.value;
      }

      await wait(DEFAULT_WAIT_INTERVAL_MS);
    }

    return null;
  }
}

function createCacheBackend(): CacheBackend {
  if (isDevelopment() || isTest()) {
    return new MemoryCacheBackend();
  }

  return new RedisCacheBackend(getRedisClient() as Redis as RedisCacheClient);
}

export class Cache extends ESOCache {
  constructor(defaultTTL: number = DEFAULT_CACHE_TTL_MS) {
    super(defaultTTL);
  }
}
