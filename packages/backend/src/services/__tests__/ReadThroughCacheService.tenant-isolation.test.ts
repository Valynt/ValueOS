/**
 * ReadThroughCacheService — cross-tenant cache isolation behavioral tests.
 *
 * Proves that:
 * 1. Cache keys are scoped by tenant ID (organizationId)
 * 2. Cross-tenant cache retrieval returns null (isolation holds)
 * 3. Cross-tenant cache invalidation does not affect other tenants
 * 4. Missing tenant context throws MissingTenantContextError
 * 5. Cache key construction always includes tenant prefix
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be at top level, before any imports
// ---------------------------------------------------------------------------

const {
  mockGet,
  mockSet,
  mockScan,
  mockMultiExecResults,
  redisStore,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockScan: vi.fn(),
  mockMultiExecResults: [] as Array<number>,
  redisStore: new Map<string, string>(),
}));

vi.mock("../../lib/redis.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    get: mockGet,
    set: mockSet,
    scan: mockScan,
    multi: () => {
      const keys: string[] = [];
      return {
        unlink: function (key: string) {
          keys.push(key);
          return this;
        },
        del: function (key: string) {
          keys.push(key);
          return this;
        },
        exec: async function () {
          const results: number[] = [];
          for (const key of keys) {
            const existed = redisStore.has(key);
            if (existed) redisStore.delete(key);
            results.push(existed ? 1 : 0);
          }
          mockMultiExecResults.push(...results);
          return results;
        },
      };
    },
  }),
}));

vi.mock("../../lib/metrics/cacheMetrics.js", () => ({
  cacheCoalescedWaitersTotal: { inc: vi.fn() },
  cacheEvictionsTotal: { inc: vi.fn() },
  cacheFallbackModeTotal: { inc: vi.fn() },
  cacheFillDurationMs: { observe: vi.fn() },
  cacheHitRate: { set: vi.fn() },
  cacheLoaderDurationMs: { observe: vi.fn() },
  cacheRequestsTotal: { inc: vi.fn() },
}));

vi.mock("../../lib/metrics/httpMetrics.js", () => ({
  default: {
    metrics: vi.fn().mockResolvedValue(""),
    registerMetric: vi.fn(),
    getSingleMetric: vi.fn(),
  },
  readCacheEventsTotal: { inc: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { MissingTenantContextError, tenantReadCacheKey, tenantReadCachePattern } from "@shared/lib/redisKeys";
import { ReadThroughCacheService } from "../cache/ReadThroughCacheService.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_A = "org-tenant-a";
const TENANT_B = "org-tenant-b";
const ENDPOINT = "api-workflow-status";

function makeConfig(tenantId: string, keyPayload?: unknown) {
  return {
    endpoint: ENDPOINT,
    tenantId,
    tier: "hot" as const,
    keyPayload,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReadThroughCacheService — cross-tenant cache isolation", () => {
  beforeEach(() => {
    redisStore.clear();
    vi.clearAllMocks();
    mockMultiExecResults.length = 0;
    ReadThroughCacheService.clearNearCacheForTesting();

    // Wire up mock Redis operations to the in-memory store
    mockGet.mockImplementation(async (key: string) => redisStore.get(key) ?? null);
    mockSet.mockImplementation(async (key: string, value: string) => {
      redisStore.set(key, value);
    });
    mockScan.mockImplementation(async (_cursor: string, options: { MATCH: string; COUNT: number }) => {
      const pattern = options.MATCH.replace(/\*/g, ".*");
      const regex = new RegExp(`^${pattern}$`);
      const matched = [...redisStore.keys()].filter((k) => regex.test(k));
      return ["0", matched] as [string, string[]];
    });
  });

  // ── 1. Cache keys are scoped by tenant ID ────────────────────────────────

  describe("cache key construction includes tenant prefix", () => {
    it("produces a key starting with tenant A ID", () => {
      const key = tenantReadCacheKey({ tenantId: TENANT_A, endpoint: ENDPOINT });
      expect(key.startsWith(`${TENANT_A}:`)).toBe(true);
    });

    it("produces a key starting with tenant B ID", () => {
      const key = tenantReadCacheKey({ tenantId: TENANT_B, endpoint: ENDPOINT });
      expect(key.startsWith(`${TENANT_B}:`)).toBe(true);
    });

    it("produces different keys for different tenants with same endpoint", () => {
      const keyA = tenantReadCacheKey({ tenantId: TENANT_A, endpoint: ENDPOINT });
      const keyB = tenantReadCacheKey({ tenantId: TENANT_B, endpoint: ENDPOINT });
      expect(keyA).not.toBe(keyB);
    });

    it("produces different keys for same tenant with different keyPayloads", () => {
      const key1 = tenantReadCacheKey({ tenantId: TENANT_A, endpoint: ENDPOINT, queryHash: "hash-1" });
      const key2 = tenantReadCacheKey({ tenantId: TENANT_A, endpoint: ENDPOINT, queryHash: "hash-2" });
      expect(key1).not.toBe(key2);
    });
  });

  // ── 2. Cross-tenant cache retrieval returns null ─────────────────────────

  describe("cross-tenant cache retrieval fails", () => {
    it("tenant A write is not readable by tenant B", async () => {
      const loaderA = vi.fn().mockResolvedValue({ value: "tenant-a-data" });
      const resultA = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), loaderA);
      expect(resultA).toEqual({ value: "tenant-a-data" });

      // Tenant B should NOT see tenant A's cached data
      const loaderB = vi.fn().mockResolvedValue({ value: "tenant-b-data" });
      const resultB = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B), loaderB);

      // If isolation works, tenant B's loader should be called (cache miss for B)
      expect(loaderB).toHaveBeenCalled();
      expect(resultB).toEqual({ value: "tenant-b-data" });
    });

    it("tenant B write is not readable by tenant A", async () => {
      const loaderB = vi.fn().mockResolvedValue({ value: "tenant-b-secret" });
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B), loaderB);

      // Tenant A should NOT see tenant B's cached data
      const loaderA = vi.fn().mockResolvedValue({ value: "tenant-a-data" });
      const resultA = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), loaderA);

      expect(loaderA).toHaveBeenCalled();
      expect(resultA).toEqual({ value: "tenant-a-data" });
    });

    it("identical queries from different tenants produce different cache keys", async () => {
      const sharedPayload = { query: "SELECT * FROM workflows" };

      const loaderA = vi.fn().mockResolvedValue({ rows: ["a-row"] });
      const loaderB = vi.fn().mockResolvedValue({ rows: ["b-row"] });

      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A, sharedPayload), loaderA);
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B, sharedPayload), loaderB);

      // Both loaders should have been called — no cross-tenant cache hit
      expect(loaderA).toHaveBeenCalledTimes(1);
      expect(loaderB).toHaveBeenCalledTimes(1);
    });
  });

  // ── 3. Cross-tenant cache invalidation does not affect other tenants ─────

  describe("cross-tenant cache invalidation isolation", () => {
    it("invalidating tenant A keys does not remove tenant B keys", async () => {
      // Seed both tenants
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), vi.fn().mockResolvedValue("a-value"));
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B), vi.fn().mockResolvedValue("b-value"));

      // Invalidate tenant A
      await ReadThroughCacheService.invalidateEndpoint(TENANT_A, ENDPOINT);

      // Tenant A should have a cache miss now
      const loaderAAfter = vi.fn().mockResolvedValue("a-value-refreshed");
      const resultA = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), loaderAAfter);
      expect(resultA).toBe("a-value-refreshed");

      // Tenant B should still have its cached value (no invalidation)
      const loaderBAfter = vi.fn().mockResolvedValue("b-value-refreshed");
      const resultB = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B), loaderBAfter);
      expect(resultB).toBe("b-value"); // Original cached value, not refreshed
      expect(loaderBAfter).not.toHaveBeenCalled();
    });

    it("invalidating tenant B keys does not remove tenant A keys", async () => {
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), vi.fn().mockResolvedValue("a-value"));
      await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_B), vi.fn().mockResolvedValue("b-value"));

      await ReadThroughCacheService.invalidateEndpoint(TENANT_B, ENDPOINT);

      const loaderAAfter = vi.fn().mockResolvedValue("a-value-refreshed");
      const resultA = await ReadThroughCacheService.getOrLoad(makeConfig(TENANT_A), loaderAAfter);
      expect(resultA).toBe("a-value"); // Still cached
      expect(loaderAAfter).not.toHaveBeenCalled();
    });
  });

  // ── 4. Missing tenant context throws MissingTenantContextError ───────────

  describe("missing tenant context is rejected", () => {
    it("throws MissingTenantContextError when tenantId is undefined", () => {
      expect(() =>
        tenantReadCacheKey({ tenantId: undefined, endpoint: ENDPOINT })
      ).toThrow(MissingTenantContextError);
    });

    it("throws MissingTenantContextError when tenantId is null", () => {
      expect(() =>
        tenantReadCacheKey({ tenantId: null, endpoint: ENDPOINT })
      ).toThrow(MissingTenantContextError);
    });

    it("throws MissingTenantContextError when tenantId is empty string", () => {
      expect(() =>
        tenantReadCacheKey({ tenantId: "", endpoint: ENDPOINT })
      ).toThrow(MissingTenantContextError);
    });

    it("pattern helper also rejects missing tenant context", () => {
      expect(() =>
        tenantReadCachePattern({ tenantId: undefined, endpoint: ENDPOINT })
      ).toThrow(MissingTenantContextError);
    });
  });

  // ── 5. Cache key pattern isolation ───────────────────────────────────────

  describe("cache key pattern isolation", () => {
    it("tenant A pattern does not match tenant B keys", () => {
      const patternA = tenantReadCachePattern({ tenantId: TENANT_A, endpoint: ENDPOINT });
      const keyB = tenantReadCacheKey({ tenantId: TENANT_B, endpoint: ENDPOINT });
      const regexA = new RegExp(`^${patternA.replace(/\*/g, ".*")}$`);
      expect(regexA.test(keyB)).toBe(false);
    });

    it("tenant B pattern does not match tenant A keys", () => {
      const patternB = tenantReadCachePattern({ tenantId: TENANT_B, endpoint: ENDPOINT });
      const keyA = tenantReadCacheKey({ tenantId: TENANT_A, endpoint: ENDPOINT });
      const regexB = new RegExp(`^${patternB.replace(/\*/g, ".*")}$`);
      expect(regexB.test(keyA)).toBe(false);
    });
  });
});
