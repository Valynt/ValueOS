/**
 * CacheService
 *
 * Tenant-scoped cache with optional Redis backend.
 *
 * Key format (in-memory):  tenant:{tid}:{namespace}:{key}
 * Key format (Redis):      tenant:{tid}:{namespace}:v{n}:{key}
 *
 * Redis clear() uses versioned namespace invalidation: incrementing the version
 * counter makes all existing keys unreachable in O(1) without a SCAN. Old keys
 * expire naturally via TTL. This is cluster-safe and race-condition-free.
 *
 * Round-trip efficiency: get() and set() use a Lua script to fetch the current
 * version and perform the data operation atomically in a single round-trip.
 *
 * For maintenance/admin use, purge() performs a SCAN+UNLINK sweep. Note: on a
 * Redis Cluster, SCAN only covers the local node — a full cluster purge requires
 * iterating all nodes externally.
 */

import { createClient } from "redis";

import { createLogger } from "../lib/logger.js";
import { MissingTenantContextError } from "../lib/errors.js";
import { tenantContextStorage } from "../middleware/tenantContext.js";

const logger = createLogger({ component: "CacheService" });

export interface SetOptions {
  namespace?: string;
  ttl?: number; // seconds; defaults to CacheService constructor defaultTtl
}

interface DeleteManyOptions {
  storage?: "memory" | "redis";
  namespace?: string;
}

const DEFAULT_TTL_SECONDS = 3600;

/**
 * Lua: atomically fetch the current version then GET the versioned key.
 * KEYS[1] = version key, KEYS[2] = base prefix (without version segment)
 * ARGV[1] = the cache key suffix
 * Returns the stored value string or nil.
 */
const LUA_GET = `
local v = redis.call('GET', KEYS[1])
v = v and tonumber(v) or 0
local full_key = KEYS[2] .. ':v' .. v .. ':' .. ARGV[1]
return redis.call('GET', full_key)
`;

/**
 * Lua: atomically fetch the current version then SET the versioned key with TTL.
 * KEYS[1] = version key, KEYS[2] = base prefix (without version segment)
 * ARGV[1] = cache key suffix, ARGV[2] = serialized value, ARGV[3] = TTL seconds
 */
const LUA_SET = `
local v = redis.call('GET', KEYS[1])
v = v and tonumber(v) or 0
local full_key = KEYS[2] .. ':v' .. v .. ':' .. ARGV[1]
return redis.call('SET', full_key, ARGV[2], 'EX', ARGV[3])
`;

/**
 * Lua: atomically fetch the current version then DEL the versioned key.
 * KEYS[1] = version key, KEYS[2] = base prefix (without version segment)
 * ARGV[1] = cache key suffix
 */
const LUA_DEL = `
local v = redis.call('GET', KEYS[1])
v = v and tonumber(v) or 0
local full_key = KEYS[2] .. ':v' .. v .. ':' .. ARGV[1]
return redis.call('DEL', full_key)
`;

export class CacheService {
  private namespace: string;
  private defaultTtl: number;
  private store: Map<string, unknown> = new Map();
  private redisClient: ReturnType<typeof createClient> | null = null;

  constructor(namespace = "default", defaultTtl = DEFAULT_TTL_SECONDS) {
    this.namespace = namespace;
    this.defaultTtl = defaultTtl;
    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on("error", (err: Error) => {
        logger.warn("redis-client-error", { error: err.message, namespace });
      });
      this.redisClient.on("ready", () => {
        logger.info("redis-client-ready", { namespace });
      });
      void this.redisClient.connect().catch((err: Error) => {
        logger.warn("redis-connect-failed", { error: err.message, namespace });
      });
    } else if (process.env.NODE_ENV === "production") {
      // In production, Redis is a required dependency. Falling back to an
      // in-memory Map is unsafe for multi-pod deployments — cache state would
      // be pod-local and inconsistent. Fail fast so the issue is caught at
      // startup rather than silently serving stale or incorrect data.
      throw new Error(
        "CacheService: REDIS_URL must be set in production. " +
          "In-memory fallback is not safe for multi-pod deployments."
      );
    } else {
      logger.warn("cache-service-fallback-mode", {
        message:
          "REDIS_URL is not set. CacheService is running in in-memory fallback mode. " +
          "This is acceptable for local development but not for production.",
        namespace,
      });
    }
  }

  // ── Key helpers ────────────────────────────────────────────────────────────

  /**
   * Returns the current tenant ID from async context storage.
   *
   * SECURITY: Throws MissingTenantContextError if no tenant context is present.
   * Falling back to a global namespace would allow cross-tenant cache poisoning —
   * data written by one tenant could be read by another. Fail loudly instead.
   *
   * Callers that legitimately need a non-tenant-scoped cache (e.g., system-level
   * caches) should use a dedicated service that does not extend CacheService.
   */
  private currentTid(): string {
    const tid = tenantContextStorage.getStore()?.tid;
    if (!tid) {
      throw new MissingTenantContextError(
        'CacheService requires tenant context. ' +
        'Ensure tenantContextMiddleware() runs before any CacheService operation. ' +
        'Falling back to a global namespace is not permitted — it would allow ' +
        'cross-tenant cache poisoning.'
      );
    }
    return tid;
  }

  /** Base prefix without version: tenant:{tid}:{namespace} */
  private basePrefix(tid?: string): string {
    return `tenant:${tid ?? this.currentTid()}:${this.namespace}`;
  }

  /** Redis key for the namespace version counter. */
  private versionKey(tid?: string): string {
    return `${this.basePrefix(tid)}:_v`;
  }

  /** In-memory full key. Always uses basePrefix() — never the raw ns option. */
  private memKey(key: string): string {
    return `${this.basePrefix()}:${key}`;
  }

  // ── Namespace validation ───────────────────────────────────────────────────

  private assertNamespaceOwnership(ns: string): void {
    const tid = this.currentTid();
    if (!ns.startsWith(`tenant:${tid}:`)) {
      throw new Error(
        `Tenant cache namespace mismatch: expected prefix tenant:${tid}: but got ${ns}`
      );
    }
  }

  // ── In-memory prefix clear helper ─────────────────────────────────────────

  private clearMemPrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    if (this.redisClient) {
      try {
        const raw = (await this.redisClient.eval(LUA_GET, {
          keys: [this.versionKey(), this.basePrefix()],
          arguments: [key],
        })) as string | null;
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch {
        /* fall through to in-memory on Redis error */
      }
    }
    const val = this.store.get(this.memKey(key));
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    const ns = options?.namespace;
    if (ns) {
      // Validate ownership only — ns is not used as the storage key
      this.assertNamespaceOwnership(ns);
    }
    const ttl = options?.ttl ?? this.defaultTtl;

    if (this.redisClient) {
      try {
        await this.redisClient.eval(LUA_SET, {
          keys: [this.versionKey(), this.basePrefix()],
          arguments: [key, JSON.stringify(value), String(ttl)],
        });
        return;
      } catch {
        /* fall through to in-memory on Redis error */
      }
    }

    // Always use basePrefix()-derived key, never the raw ns option
    this.store.set(this.memKey(key), value);
  }

  async delete(key: string): Promise<void> {
    if (this.redisClient) {
      try {
        await this.redisClient.eval(LUA_DEL, {
          keys: [this.versionKey(), this.basePrefix()],
          arguments: [key],
        });
      } catch {
        /* ignore redis delete failures */
      }
    }
    this.store.delete(this.memKey(key));
  }

  /**
   * Invalidate all keys for the current tenant+namespace.
   *
   * Redis path: atomically increments the namespace version counter. All
   * existing keys become unreachable immediately; they expire via TTL.
   * This is O(1) and cluster-safe. Also clears the in-memory store for the
   * same prefix so that Redis-error fallthrough does not serve stale data.
   *
   * In-memory path: iterates the Map and removes matching prefix keys.
   */
  async clear(): Promise<void> {
    const prefix = this.basePrefix();
    if (this.redisClient) {
      try {
        await this.redisClient.incr(this.versionKey());
      } catch {
        /* ignore incr failure — fall through to in-memory clear */
      }
    }
    // Always clear in-memory entries for this prefix. When Redis is active this
    // ensures that any Redis-error fallthrough reads do not serve stale data.
    this.clearMemPrefix(prefix);
  }

  /**
   * Physically remove all Redis keys matching the current tenant+namespace
   * prefix using SCAN+UNLINK. For maintenance/admin use only — not the hot path.
   *
   * The pattern `v*:*` targets only versioned data keys, deliberately excluding
   * the version counter key (`_v`) so that the invalidation mechanism remains
   * intact after a purge.
   *
   * WARNING: Redis Cluster limitation: SCAN only covers the local node. A full
   * cluster purge requires iterating all nodes externally.
   */
  async purge(): Promise<void> {
    if (this.redisClient) {
      try {
        // Match versioned data keys only: tenant:{tid}:{namespace}:v*:*
        // The _v version counter key does NOT match this pattern.
        const pattern = `${this.basePrefix()}:v*:*`;
        let cursor = 0;
        do {
          const result = await this.redisClient.scan(cursor, {
            MATCH: pattern,
            COUNT: 100,
          });
          cursor = result.cursor;
          if (result.keys.length > 0) {
            await this.redisClient.unlink(result.keys);
          }
        } while (cursor !== 0);
      } catch {
        /* ignore purge failures */
      }
    }
    this.clearMemPrefix(this.basePrefix());
  }

  async deleteMany(keys: string[], options?: DeleteManyOptions): Promise<void> {
    if (options?.storage === "redis" && this.redisClient) {
      // Use the versioned delete path so keys are resolved against the current
      // namespace version, consistent with get() and set().
      await Promise.all(keys.map(k => this.delete(k)));
    } else {
      // In-memory path: keys are stored under basePrefix(), not a raw ns option.
      for (const k of keys) {
        this.store.delete(this.memKey(k));
      }
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const prefix = this.basePrefix();
    const regex = new RegExp(
      `^${prefix}:${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
    );
    for (const k of this.store.keys()) {
      if (regex.test(k)) {
        this.store.delete(k);
      }
    }
  }

  /**
   * Closes the Redis connection. Call during application shutdown to avoid
   * leaking the underlying TCP connection.
   */
  async disconnect(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = null;
    }
  }
}
