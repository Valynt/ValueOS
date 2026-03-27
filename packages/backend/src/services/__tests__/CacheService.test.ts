/**
 * CacheService — tenant isolation and Redis versioned-namespace tests.
 *
 * Redis interactions are mocked so these run without a live Redis instance.
 * The mock simulates the Lua script behaviour (LUA_GET, LUA_SET, LUA_DEL)
 * via a simple in-process store + version counter.
 */

import { AsyncLocalStorage } from "async_hooks";

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock tenantContextStorage (hoisted) ───────────────────────────────────────

const mockStorage = new AsyncLocalStorage<{ tid: string }>();

vi.mock("../../middleware/tenantContext.js", () => ({
  tenantContextStorage: mockStorage,
}));

// ── Mock redis (hoisted) ──────────────────────────────────────────────────────
// Simulates the Lua scripts used by get(), set(), delete(), and the INCR used
// by clear(). The eval mock interprets the script by inspecting KEYS/ARGV.

const redisStore = new Map<string, string>();
const redisCounters = new Map<string, number>();

function getVersion(versionKey: string): number {
  const v = redisStore.get(versionKey);
  return v !== null && v !== undefined ? parseInt(v, 10) : 0;
}

const mockRedisClient = {
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined),

  eval: vi.fn(async (script: string, opts: { keys: string[]; arguments: string[] }) => {
    const [versionKey, basePrefix] = opts.keys;
    const args = opts.arguments;
    const v = getVersion(versionKey);
    const fullKey = `${basePrefix}:v${v}:${args[0]}`;

    // Distinguish scripts by content rather than argument count:
    // LUA_GET and LUA_DEL both have 1 argument; LUA_SET has 3.
    if (args.length === 3) {
      // LUA_SET: args = [key, value, ttl]
      redisStore.set(fullKey, args[1]);
      return "OK";
    } else if (script.includes("redis.call('DEL'")) {
      // LUA_DEL
      const existed = redisStore.delete(fullKey);
      return existed ? 1 : 0;
    } else {
      // LUA_GET
      return redisStore.get(fullKey) ?? null;
    }
  }),

  incr: vi.fn(async (key: string) => {
    const current = redisCounters.get(key) ?? 0;
    const next = current + 1;
    redisCounters.set(key, next);
    redisStore.set(key, String(next));
    return next;
  }),

  del: vi.fn(async (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    let count = 0;
    for (const k of ks) {
      if (redisStore.delete(k)) count++;
    }
    return count;
  }),

  scan: vi.fn(async (_cursor: number, opts: { MATCH: string; COUNT?: number }) => {
    const pattern = opts.MATCH.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*").replace(/\*/g, ".*");
    const regex = new RegExp(`^${pattern}$`);
    const keys = Array.from(redisStore.keys()).filter((k) => regex.test(k));
    return { cursor: 0, keys };
  }),

  unlink: vi.fn(async (keys: string[]) => {
    for (const k of keys) redisStore.delete(k);
    return keys.length;
  }),
};

vi.mock("redis", () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function runAsTenant<T>(tid: string, fn: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    mockStorage.run({ tid } as never, () => {
      fn().then(resolve).catch(reject);
    });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CacheService", () => {
  // Import once at the top — mocks are hoisted so this is safe
  let CacheService: typeof import("../CacheService.js").CacheService;

  beforeAll(async () => {
    ({ CacheService } = await import("../CacheService.js"));
  });

  beforeEach(() => {
    redisStore.clear();
    redisCounters.clear();
    vi.clearAllMocks();
  });

  // ── In-memory isolation (no Redis) ────────────────────────────────────────

  describe("in-memory tenant isolation", () => {
    let cache: InstanceType<typeof CacheService>;

    beforeEach(() => {
      // Construct without REDIS_URL so no Redis client is created
      delete process.env.REDIS_URL;
      cache = new CacheService("ns");
    });

    afterEach(() => {
      delete process.env.REDIS_URL;
    });

    it("clear() removes only the current tenant's keys", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("k1", "v1");
        await cache.set("k2", "v2");
      });
      await runAsTenant("tenant-B", async () => {
        await cache.set("k3", "v3");
      });

      await runAsTenant("tenant-A", async () => {
        await cache.clear();
        expect(await cache.get("k1")).toBeNull();
        expect(await cache.get("k2")).toBeNull();
      });

      await runAsTenant("tenant-B", async () => {
        expect(await cache.get("k3")).toBe("v3");
      });
    });

    it("get() returns null for a different tenant's key", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("shared-key", "tenant-A-value");
      });

      await runAsTenant("tenant-B", async () => {
        expect(await cache.get("shared-key")).toBeNull();
      });
    });

    it("set() with explicit namespace validates ownership but stores under basePrefix", async () => {
      await runAsTenant("tenant-A", async () => {
        // Valid namespace for tenant-A — should not throw
        await cache.set("k", "v", { namespace: "tenant:tenant-A:ns" });
        // get() must find the value (stored under basePrefix, not the raw ns)
        expect(await cache.get<string>("k")).toBe("v");
      });
    });

    it("set() throws on namespace prefix mismatch", async () => {
      await runAsTenant("tenant-A", async () => {
        await expect(
          cache.set("k", "v", { namespace: "tenant:tenant-B:ns" })
        ).rejects.toThrow("Tenant cache namespace mismatch");
      });
    });

    it("deleteMany() removes only the specified keys", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("a", 1);
        await cache.set("b", 2);
        await cache.set("c", 3);
        await cache.deleteMany(["a", "b"]);
        expect(await cache.get("a")).toBeNull();
        expect(await cache.get("b")).toBeNull();
        expect(await cache.get("c")).toBe(3);
      });
    });
  });

  // ── Redis versioned namespace ─────────────────────────────────────────────

  describe("Redis versioned namespace", () => {
    let cache: InstanceType<typeof CacheService>;

    beforeEach(() => {
      process.env.REDIS_URL = "redis://localhost:6379";
      cache = new CacheService("ns");
    });

    afterEach(() => {
      delete process.env.REDIS_URL;
    });

    it("clear() increments the version counter via INCR", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.clear();
      });

      expect(mockRedisClient.incr).toHaveBeenCalledWith("tenant:tenant-A:ns:_v");
    });

    it("clear() also flushes the in-memory store for the same prefix", async () => {
      // Simulate a value written to in-memory (Redis error fallthrough scenario)
      // by directly accessing the private store via the cache instance
      await runAsTenant("tenant-A", async () => {
        // Force an in-memory write by temporarily disabling Redis eval
        mockRedisClient.eval.mockRejectedValueOnce(new Error("Redis down"));
        await cache.set("stale-key", "stale-value");

        // Confirm it was written to in-memory
        mockRedisClient.eval.mockRejectedValueOnce(new Error("Redis down"));
        expect(await cache.get<string>("stale-key")).toBe("stale-value");

        // clear() should flush in-memory even when Redis incr succeeds
        await cache.clear();

        // In-memory entry must be gone
        mockRedisClient.eval.mockRejectedValueOnce(new Error("Redis down"));
        expect(await cache.get<string>("stale-key")).toBeNull();
      });
    });

    it("get() uses eval (single round-trip) not separate GET calls", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.get("somekey");
      });

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: ["tenant:tenant-A:ns:_v", "tenant:tenant-A:ns"],
          arguments: ["somekey"],
        })
      );
      // The old redisClient.get should never be called directly
      expect(mockRedisClient).not.toHaveProperty("get");
    });

    it("set() uses eval (single round-trip) with TTL argument", async () => {
      const cache7200 = new CacheService("ns", 7200);

      await runAsTenant("tenant-A", async () => {
        await cache7200.set("k", { data: 42 });
      });

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          keys: ["tenant:tenant-A:ns:_v", "tenant:tenant-A:ns"],
          arguments: ["k", JSON.stringify({ data: 42 }), "7200"],
        })
      );
    });

    it("set() uses per-call TTL override", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("k", "v", { ttl: 60 });
      });

      expect(mockRedisClient.eval).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ arguments: ["k", '"v"', "60"] })
      );
    });

    it("concurrent clear() calls each increment the counter", async () => {
      await runAsTenant("tenant-A", async () => {
        await Promise.all([cache.clear(), cache.clear(), cache.clear()]);
      });

      expect(mockRedisClient.incr).toHaveBeenCalledTimes(3);
    });

    it("clear() for tenant-A does not touch tenant-B's version key", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.clear();
      });

      expect(mockRedisClient.incr).not.toHaveBeenCalledWith("tenant:tenant-B:ns:_v");
    });

    it("set() with mismatched namespace throws even with Redis active", async () => {
      await runAsTenant("tenant-A", async () => {
        await expect(
          cache.set("k", "v", { namespace: "tenant:tenant-B:ns" })
        ).rejects.toThrow("Tenant cache namespace mismatch");
      });
    });

    it("delete() removes the versioned key from Redis", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("del-key", "del-value");
        // Confirm it is present
        expect(await cache.get<string>("del-key")).toBe("del-value");

        await cache.delete("del-key");

        // Must be gone after delete
        expect(await cache.get<string>("del-key")).toBeNull();
      });
    });

    it("deleteMany() with storage:redis removes versioned keys", async () => {
      await runAsTenant("tenant-A", async () => {
        await cache.set("dm-a", "va");
        await cache.set("dm-b", "vb");
        await cache.set("dm-c", "vc");

        await cache.deleteMany(["dm-a", "dm-b"], { storage: "redis" });

        expect(await cache.get<string>("dm-a")).toBeNull();
        expect(await cache.get<string>("dm-b")).toBeNull();
        expect(await cache.get<string>("dm-c")).toBe("vc");
      });
    });
  });

  // ── purge() ───────────────────────────────────────────────────────────────

  describe("purge()", () => {
    let cache: InstanceType<typeof CacheService>;

    beforeEach(() => {
      process.env.REDIS_URL = "redis://localhost:6379";
      cache = new CacheService("ns");
    });

    afterEach(() => {
      delete process.env.REDIS_URL;
    });

    it("calls SCAN with the versioned data key pattern (excludes _v counter)", async () => {
      redisStore.set("tenant:tenant-A:ns:v0:k1", '"v1"');
      redisStore.set("tenant:tenant-A:ns:v0:k2", '"v2"');
      redisStore.set("tenant:tenant-A:ns:_v", "0");
      redisStore.set("tenant:tenant-B:ns:v0:k3", '"v3"');

      await runAsTenant("tenant-A", async () => {
        await cache.purge();
      });

      expect(mockRedisClient.scan).toHaveBeenCalledWith(
        0,
        expect.objectContaining({ MATCH: "tenant:tenant-A:ns:v*:*" })
      );
    });

    it("does not delete the version counter key during purge", async () => {
      redisStore.set("tenant:tenant-A:ns:v0:k1", '"v1"');
      redisStore.set("tenant:tenant-A:ns:_v", "3");

      await runAsTenant("tenant-A", async () => {
        await cache.purge();
      });

      // Version counter must survive purge
      expect(redisStore.has("tenant:tenant-A:ns:_v")).toBe(true);
      expect(redisStore.get("tenant:tenant-A:ns:_v")).toBe("3");
    });

    it("does not remove keys belonging to other tenants", async () => {
      redisStore.set("tenant:tenant-A:ns:v0:k1", '"v1"');
      redisStore.set("tenant:tenant-B:ns:v0:k3", '"v3"');

      await runAsTenant("tenant-A", async () => {
        await cache.purge();
      });

      expect(redisStore.has("tenant:tenant-B:ns:v0:k3")).toBe(true);
    });
  });

  // ── Production Redis enforcement (spec 3.1) ───────────────────────────────

  describe("production Redis enforcement", () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      delete process.env.REDIS_URL;
    });

    it("throws on construction when NODE_ENV=production and REDIS_URL is absent", () => {
      process.env.NODE_ENV = "production";
      delete process.env.REDIS_URL;

      expect(() => new CacheService("prod-ns")).toThrow(
        /REDIS_URL must be set in production/
      );
    });

    it("does not throw in development when REDIS_URL is absent", () => {
      process.env.NODE_ENV = "development";
      delete process.env.REDIS_URL;

      expect(() => new CacheService("dev-ns")).not.toThrow();
    });

    it("does not throw in test when REDIS_URL is absent", () => {
      process.env.NODE_ENV = "test";
      delete process.env.REDIS_URL;

      expect(() => new CacheService("test-ns")).not.toThrow();
    });

    it("does not throw in production when REDIS_URL is set", () => {
      process.env.NODE_ENV = "production";
      process.env.REDIS_URL = "redis://localhost:6379";

      // Redis client creation is mocked — no actual connection attempted
      expect(() => new CacheService("prod-redis-ns")).not.toThrow();
    });
  });
});
