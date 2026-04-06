/**
 * Backend test setup
 *
 * Sets fallback env vars so modules that eagerly validate config
 * (e.g. supabase.ts, env.ts) don't throw at import time.
 * Individual tests should still mock these modules for isolation.
 */

import { afterEach, beforeEach, expect, vi } from "vitest";

import { assertRealNetworkAllowed, isRealNetworkAllowed } from "./runtimeGuards";

// ---------------------------------------------------------------------------
// Global prom-client mock — prevents "metric already registered" errors
// when tests import modules that register metrics at the module level.
// ---------------------------------------------------------------------------
const mockRegistry = {
  metrics: vi.fn().mockResolvedValue(""),
  registerMetric: vi.fn(),
  clear: vi.fn(),
  getSingleMetric: vi.fn(),
};

vi.mock("prom-client", () => ({
  Registry: vi.fn(() => mockRegistry),
  Counter: vi.fn(() => ({ inc: vi.fn(), labels: vi.fn(() => ({ inc: vi.fn() })) })),
  Histogram: vi.fn(() => ({ observe: vi.fn(), labels: vi.fn(() => ({ observe: vi.fn() })) })),
  Gauge: vi.fn(() => ({ set: vi.fn(), labels: vi.fn(() => ({ set: vi.fn() })) })),
  Summary: vi.fn(() => ({ observe: vi.fn(), labels: vi.fn(() => ({ observe: vi.fn() })) })),
  collectDefaultMetrics: vi.fn(),
}));

vi.mock("ioredis", () => {
  const createChain = (redis: MockRedis) => {
    const operations: Array<() => Promise<unknown> | unknown> = [];
    const chain = {
      setex: vi.fn((...args: Parameters<MockRedis["setex"]>) => {
        operations.push(() => redis.setex(...args));
        return chain;
      }),
      set: vi.fn((...args: Parameters<MockRedis["set"]>) => {
        operations.push(() => redis.set(...args));
        return chain;
      }),
      del: vi.fn((...args: Parameters<MockRedis["del"]>) => {
        operations.push(() => redis.del(...args));
        return chain;
      }),
      expire: vi.fn((...args: Parameters<MockRedis["expire"]>) => {
        operations.push(() => redis.expire(...args));
        return chain;
      }),
      sadd: vi.fn((...args: Parameters<MockRedis["sadd"]>) => {
        operations.push(() => redis.sadd(...args));
        return chain;
      }),
      srem: vi.fn((...args: Parameters<MockRedis["srem"]>) => {
        operations.push(() => redis.srem(...args));
        return chain;
      }),
      hset: vi.fn((...args: Parameters<MockRedis["hset"]>) => {
        operations.push(() => redis.hset(...args));
        return chain;
      }),
      publish: vi.fn((...args: Parameters<MockRedis["publish"]>) => {
        operations.push(() => redis.publish(...args));
        return chain;
      }),
      exec: vi.fn(async () => Promise.all(operations.map((operation) => operation()))),
    };
    return chain;
  };

  class MockRedis {
    private readonly kv = new Map<string, string>();
    private readonly sets = new Map<string, Set<string>>();
    private readonly hashes = new Map<string, Map<string, string>>();
    private readonly listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    constructor(_url?: string, _options?: Record<string, unknown>) {}

    on(event: string, callback: (...args: unknown[]) => void) {
      const handlers = this.listeners.get(event) ?? [];
      handlers.push(callback);
      this.listeners.set(event, handlers);
      return this;
    }

    async connect() {
      return "OK";
    }

    async quit() {
      return "OK";
    }

    async disconnect() {
      return "OK";
    }

    duplicate() {
      return new MockRedis();
    }

    multi() {
      return createChain(this);
    }

    pipeline() {
      return createChain(this);
    }

    async get(key: string) {
      return this.kv.get(key) ?? null;
    }

    async set(key: string, value: string) {
      this.kv.set(key, value);
      return "OK";
    }

    async setex(key: string, _ttl: number, value: string) {
      this.kv.set(key, value);
      return "OK";
    }

    async del(key: string) {
      const deleted = this.kv.delete(key);
      this.sets.delete(key);
      this.hashes.delete(key);
      return deleted ? 1 : 0;
    }

    async expire(_key: string, _ttl: number) {
      return 1;
    }

    async sadd(key: string, ...values: string[]) {
      const set = this.sets.get(key) ?? new Set<string>();
      values.forEach((value) => set.add(value));
      this.sets.set(key, set);
      return set.size;
    }

    async srem(key: string, ...values: string[]) {
      const set = this.sets.get(key);
      if (!set) return 0;
      let removed = 0;
      values.forEach((value) => {
        if (set.delete(value)) removed += 1;
      });
      return removed;
    }

    async smembers(key: string) {
      return Array.from(this.sets.get(key) ?? []);
    }

    async hset(key: string, field: string, value: string) {
      const hash = this.hashes.get(key) ?? new Map<string, string>();
      hash.set(field, value);
      this.hashes.set(key, hash);
      return 1;
    }

    async hget(key: string, field: string) {
      return this.hashes.get(key)?.get(field) ?? null;
    }

    async hgetall(key: string) {
      return Object.fromEntries(this.hashes.get(key)?.entries() ?? []);
    }

    async publish(_channel: string, _message: string) {
      return 1;
    }

    async subscribe(..._channels: string[]) {
      return 1;
    }

    async flushall() {
      this.kv.clear();
      this.sets.clear();
      this.hashes.clear();
      return "OK";
    }
  }

  return {
    default: MockRedis,
    Redis: MockRedis,
  };
});

// ---------------------------------------------------------------------------
// Global agent-fabric mocks — provides LLMGateway and MemorySystem.
// ---------------------------------------------------------------------------

vi.mock("../lib/agent-fabric/LLMGateway.js", () => ({
  LLMGateway: class {
    constructor(_provider?: string) {}
    complete = vi.fn().mockImplementation(async (requestBody: any) => {
      const metadata = requestBody.metadata || {};
      const tenantId =
        metadata.tenant_id ||
        metadata.tenantId ||
        metadata.organization_id ||
        metadata.organizationId;

      if (!tenantId) {
        throw new Error("LLMGateway: Missing tenant/organization ID in metadata");
      }
      return { content: "{}" };
    });
  },
}));

vi.mock("../lib/agent-fabric/MemorySystem.js", () => ({
  MemorySystem: class {
    constructor(_config?: unknown) {}
    store = vi.fn().mockImplementation(async (memory: any) => {
      if (!memory.organization_id) {
        throw new Error("MemorySystem: Missing organization_id in store()");
      }
      return "mem_1";
    });
    retrieve = vi.fn().mockImplementation(async (query: any) => {
      if (!query.organization_id) {
        throw new Error("MemorySystem: Missing organization_id in retrieve()");
      }
      return [];
    });
    storeSemanticMemory = vi.fn().mockImplementation(async (...args: any[]) => {
      const organizationId = args[5]; // 6th parameter
      if (!organizationId) {
        throw new Error("MemorySystem: Missing organizationId in storeSemanticMemory()");
      }
      return "mem_1";
    });
    clear = vi.fn().mockResolvedValue(0);
  },
}));

// ---------------------------------------------------------------------------
// Global logger mock — provides createLogger as a fallback for all tests.
//
// Tests that need granular spy assertions (e.g. GuestAccessService.test.ts)
// override this with their own vi.mock call, which takes precedence per
// Vitest's module-mock resolution order.
//
// Both logger paths are mocked because backend source files import from
// either "../../lib/logger" (backend structured logger) or
// "@shared/lib/logger" (shared package logger).
//
// The factory is inlined in each vi.mock call because vi.mock is hoisted
// before variable declarations — external references are not available.
// ---------------------------------------------------------------------------

vi.mock("../lib/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cache: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cache: vi.fn(),
  },
}));

vi.mock("@shared/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cache: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    cache: vi.fn(),
  },
}));

// Supabase config — only set if not already present
process.env.SUPABASE_URL ??= "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
process.env.SUPABASE_ANON_KEY ??= "test-anon-key";
process.env.VALUEOS_TEST_ALLOW_SUPABASE = "true";
process.env.VALUEOS_TEST_ALLOW_SUPABASE = "true";



// LLM config
process.env.LLM_PROVIDER ??= "together";
process.env.TOGETHER_API_KEY ??= "test-together-key";

// Redis
process.env.REDIS_URL ??= "redis://localhost:6379";

const originalFetch = globalThis.fetch?.bind(globalThis);

if (originalFetch && !isRealNetworkAllowed()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const target = typeof input === "string" || input instanceof URL ? String(input) : input.url;
      assertRealNetworkAllowed(target);
      return originalFetch(input);
    }),
  );
}

beforeEach(async () => {
  const testPath = expect.getState().testPath ?? "";
  if (
    testPath.endsWith("EntitlementsService.static.test.ts") ||
    testPath.endsWith("secretsManager.test.ts")
  ) {
    return;
  }

  const [{ supabase }, entitlementsModule] = await Promise.all([
    import("../lib/supabase.js"),
    import("../services/billing/EntitlementsService.js"),
  ]);

  const EntitlementsService = entitlementsModule.EntitlementsService;
  if (typeof EntitlementsService?.setInstance === "function") {
    EntitlementsService.setInstance(new EntitlementsService(supabase));
  }

  // Flush Redis mock between tests
  const redisModule = await import("ioredis");
  const redis = new (redisModule as any).default();
  if (typeof redis.flushall === "function") {
    await redis.flushall();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});
