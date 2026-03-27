/**
 * CacheService
 *
 * Tenant-scoped cache with Redis backend.
 * Keys are namespaced as `tenant:<tenantId>:<namespace>:<key>` to enforce isolation.
 *
 * When REDIS_URL is set, all reads and writes go through Redis. The in-memory
 * Map is retained as an explicit dev-only fallback when Redis is absent, and a
 * warning is logged at construction time so the degraded mode is never silent.
 *
 * In a multi-pod deployment, only the Redis-backed path provides shared state.
 * The in-memory fallback is intentionally not suitable for production.
 */

import { createClient } from "redis";

import { createLogger } from "../lib/logger.js";
import { tenantContextStorage } from "../middleware/tenantContext.js";

const logger = createLogger({ component: "CacheService" });

interface SetOptions {
  namespace?: string;
  /** TTL in seconds. Only enforced when Redis is available. */
  ttl?: number;
}

interface DeleteManyOptions {
  storage?: "memory" | "redis";
  namespace?: string;
}

export class CacheService {
  private namespace: string;
  /** Fallback store used only when Redis is unavailable (dev/test). */
  private store: Map<string, unknown> = new Map();
  private redisClient: ReturnType<typeof createClient> | null = null;
  private redisReady = false;

  constructor(namespace = "default") {
    this.namespace = namespace;

    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on("error", (err: Error) => {
        logger.warn("redis-client-error", { error: err.message });
        this.redisReady = false;
      });
      this.redisClient.on("ready", () => {
        this.redisReady = true;
        logger.info("redis-client-ready", { namespace });
      });
      void this.redisClient.connect().then(() => {
        this.redisReady = true;
      }).catch((err: Error) => {
        logger.warn("redis-connect-failed", { error: err.message });
      });
    } else {
      logger.warn("cache-service-fallback-mode", {
        message:
          "REDIS_URL is not set. CacheService is running in in-memory fallback mode. " +
          "This is not suitable for multi-pod production deployments.",
        namespace,
      });
    }
  }

  private get useRedis(): boolean {
    return this.redisClient !== null && this.redisReady;
  }

  private tenantPrefix(): string {
    const ctx = tenantContextStorage.getStore();
    const tid = ctx?.tid ?? "global";
    return `tenant:${tid}:${this.namespace}`;
  }

  private fullKey(key: string, ns?: string): string {
    const prefix = ns ?? this.tenantPrefix();
    return `${prefix}:${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const fk = this.fullKey(key);

    if (this.useRedis) {
      try {
        const raw = await this.redisClient!.get(fk);
        if (raw === null) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        logger.warn("cache-get-redis-error", {
          key: fk,
          error: (err as Error).message,
        });
        // Fall through to in-memory on transient Redis error
      }
    }

    const val = this.store.get(fk);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    const ns = options?.namespace;

    if (ns) {
      const ctx = tenantContextStorage.getStore();
      const tid = ctx?.tid ?? "global";
      if (!ns.startsWith(`tenant:${tid}:`)) {
        throw new Error(
          `Tenant cache namespace mismatch: expected prefix tenant:${tid}: but got ${ns}`
        );
      }
    }

    const fk = this.fullKey(key, ns);

    if (this.useRedis) {
      try {
        const serialized = JSON.stringify(value);
        if (options?.ttl) {
          await this.redisClient!.set(fk, serialized, { EX: options.ttl });
        } else {
          await this.redisClient!.set(fk, serialized);
        }
        return;
      } catch (err) {
        logger.warn("cache-set-redis-error", {
          key: fk,
          error: (err as Error).message,
        });
        // Fall through to in-memory on transient Redis error
      }
    }

    this.store.set(fk, value);
  }

  async delete(key: string): Promise<void> {
    const fk = this.fullKey(key);

    if (this.useRedis) {
      try {
        await this.redisClient!.del(fk);
        return;
      } catch (err) {
        logger.warn("cache-delete-redis-error", {
          key: fk,
          error: (err as Error).message,
        });
      }
    }

    this.store.delete(fk);
  }

  async clear(): Promise<void> {
    const prefix = this.tenantPrefix();

    if (this.useRedis) {
      try {
        await this._scanAndDelete(`${prefix}:*`);
        return;
      } catch (err) {
        logger.warn("cache-clear-redis-error", {
          prefix,
          error: (err as Error).message,
        });
      }
    }

    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  async deleteMany(keys: string[], options?: DeleteManyOptions): Promise<void> {
    const ns = options?.namespace ?? this.tenantPrefix();
    const fullKeys = keys.map((k) => `${ns}:${k}`);

    if (this.useRedis) {
      try {
        if (fullKeys.length > 0) {
          await this.redisClient!.del(fullKeys);
        }
        return;
      } catch (err) {
        logger.warn("cache-delete-many-redis-error", {
          error: (err as Error).message,
        });
      }
    }

    for (const fk of fullKeys) {
      this.store.delete(fk);
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const prefix = this.tenantPrefix();
    const redisPattern = `${prefix}:${pattern}`;

    if (this.useRedis) {
      try {
        await this._scanAndDelete(redisPattern);
        return;
      } catch (err) {
        logger.warn("cache-invalidate-pattern-redis-error", {
          pattern: redisPattern,
          error: (err as Error).message,
        });
      }
    }

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
      this.redisReady = false;
    }
  }

  /**
   * Iterates Redis keys matching a glob pattern using SCAN and deletes them.
   * Uses cursor-based iteration to avoid blocking the Redis server on large keyspaces.
   */
  private async _scanAndDelete(pattern: string): Promise<void> {
    let cursor = 0;
    do {
      const result = await this.redisClient!.scan(cursor, {
        MATCH: pattern,
        COUNT: 100,
      });
      cursor = result.cursor;
      if (result.keys.length > 0) {
        await this.redisClient!.del(result.keys);
      }
    } while (cursor !== 0);
  }
}
