/**
 * CacheService
 *
 * Tenant-scoped in-memory cache with optional Redis backend.
 * Keys are namespaced as `tenant:<tenantId>:<namespace>:<key>` to enforce isolation.
 */

import { createClient } from "redis";

import { tenantContextStorage } from "../middleware/tenantContext.js";

interface SetOptions {
  namespace?: string;
  ttl?: number;
}

interface DeleteManyOptions {
  storage?: "memory" | "redis";
  namespace?: string;
}

export class CacheService {
  private namespace: string;
  private store: Map<string, unknown> = new Map();
  private redisClient: ReturnType<typeof createClient> | null = null;

  constructor(namespace = "default") {
    this.namespace = namespace;
    if (process.env.REDIS_URL) {
      this.redisClient = createClient({ url: process.env.REDIS_URL });
      this.redisClient.on("error", () => {
        /* swallow redis errors in tests */
      });
      void this.redisClient.connect().catch(() => {
        /* ignore connection errors */
      });
    }
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
    const val = this.store.get(fk);
    return val !== undefined ? (val as T) : null;
  }

  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    const ns = options?.namespace;
    if (ns) {
      const expected = this.tenantPrefix();
      if (!ns.startsWith(`tenant:`) || !ns.includes(`:${this.namespace}`)) {
        // allow matching prefix
      }
      // Validate namespace belongs to current tenant
      const ctx = tenantContextStorage.getStore();
      const tid = ctx?.tid ?? "global";
      if (!ns.startsWith(`tenant:${tid}:`)) {
        throw new Error(`Tenant cache namespace mismatch: expected prefix tenant:${tid}: but got ${ns}`);
      }
    }
    const fk = this.fullKey(key, ns);
    this.store.set(fk, value);
  }

  async clear(): Promise<void> {
    const prefix = this.tenantPrefix();
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) {
        this.store.delete(k);
      }
    }
  }

  async deleteMany(keys: string[], options?: DeleteManyOptions): Promise<void> {
    const ns = options?.namespace ?? this.tenantPrefix();
    const fullKeys = keys.map((k) => `${ns}:${k}`);

    if (options?.storage === "redis" && this.redisClient) {
      await this.redisClient.del(fullKeys);
    } else {
      for (const fk of fullKeys) {
        this.store.delete(fk);
      }
    }
  }

  async invalidatePattern(pattern: string): Promise<void> {
    const prefix = this.tenantPrefix();
    const regex = new RegExp(
      `^${prefix}:${pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`
    );
    for (const k of this.store.keys()) {
      if (regex.test(k)) {
        this.store.delete(k);
      }
    }
  }
}
