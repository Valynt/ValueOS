import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryCache, getCache, setCache } from "../Cache";
import { CachePolicy } from "../../types";
import { logger } from "../../../lib/logger";

vi.mock("../../../lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("MemoryCache", () => {
  let cache: MemoryCache;
  let customPolicy: CachePolicy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    customPolicy = {
      tier1_ttl: 100,
      tier2_ttl: 50,
      tier3_ttl: 10,
      max_size_mb: 1, // 1 MB
    };
    cache = new MemoryCache(customPolicy);
  });

  afterEach(() => {
    cache.stopCleanup();
    vi.useRealTimers();
  });

  describe("Initialization", () => {
    it("should initialize with default policy if none provided", () => {
      const defaultCache = new MemoryCache();
      const stats = defaultCache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.sizeMB).toBe(0);
      defaultCache.stopCleanup();
    });

    it("should initialize with custom policy", () => {
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.sizeMB).toBe(0);
    });
  });

  describe("set and get", () => {
    it("should set and get a value", async () => {
      await cache.set("test-key", { data: "test-value" }, "tier1");
      const result = await cache.get("test-key");
      expect(result).toEqual({ data: "test-value" });
    });

    it("should return null for non-existent key", async () => {
      const result = await cache.get("non-existent-key");
      expect(result).toBeNull();
    });

    it("should track access count and time", async () => {
      await cache.set("test-key", "value", "tier1");

      const beforeAccess = Date.now();
      vi.advanceTimersByTime(1000);

      const result = await cache.get("test-key");
      expect(result).toBe("value");

      // Verify stats implicitly or through next get if we had access to raw entries
      // Since we don't expose raw entries, we just ensure it doesn't crash
      // But we can verify it was updated if we could inspect it.
      // We can also see debug log was called
      expect(logger.debug).toHaveBeenCalledWith("Cache hit", expect.objectContaining({
        key: "test-key",
        accessCount: 1,
      }));
    });
  });

  describe("Expiration (TTL)", () => {
    it("should expire tier1 entries according to policy", async () => {
      await cache.set("t1", "value1", "tier1");

      // Advance by 99s, still valid
      vi.advanceTimersByTime(99 * 1000);
      expect(await cache.get("t1")).toBe("value1");

      // Advance past 100s
      vi.advanceTimersByTime(2 * 1000);
      expect(await cache.get("t1")).toBeNull();
    });

    it("should expire tier2 entries according to policy", async () => {
      await cache.set("t2", "value2", "tier2");

      // Advance by 49s, still valid
      vi.advanceTimersByTime(49 * 1000);
      expect(await cache.get("t2")).toBe("value2");

      // Advance past 50s
      vi.advanceTimersByTime(2 * 1000);
      expect(await cache.get("t2")).toBeNull();
    });

    it("should expire tier3 entries according to policy", async () => {
      await cache.set("t3", "value3", "tier3");

      // Advance by 9s, still valid
      vi.advanceTimersByTime(9 * 1000);
      expect(await cache.get("t3")).toBe("value3");

      // Advance past 10s
      vi.advanceTimersByTime(2 * 1000);
      expect(await cache.get("t3")).toBeNull();
    });
  });

  describe("Deletion and Clear", () => {
    it("should delete specific key", async () => {
      await cache.set("key1", "val1", "tier1");
      await cache.set("key2", "val2", "tier1");

      const deleted = await cache.delete("key1");
      expect(deleted).toBe(true);

      expect(await cache.get("key1")).toBeNull();
      expect(await cache.get("key2")).toBe("val2");

      const deletedAgain = await cache.delete("key1");
      expect(deletedAgain).toBe(false);
    });

    it("should clear all keys", async () => {
      await cache.set("key1", "val1", "tier1");
      await cache.set("key2", "val2", "tier2");

      await cache.clear();

      expect(await cache.get("key1")).toBeNull();
      expect(await cache.get("key2")).toBeNull();
      expect(cache.getStats().totalEntries).toBe(0);
    });
  });

  describe("Stats", () => {
    it("should return correct stats", async () => {
      await cache.set("k1", "v1", "tier1");
      await cache.set("k2", "v2", "tier2");
      await cache.set("k3", "v3", "tier2");

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(3);
      expect(stats.tierBreakdown).toEqual({
        tier1: 1,
        tier2: 2,
        tier3: 0,
      });
      expect(stats.sizeMB).toBeGreaterThan(0);
    });
  });

  describe("Eviction", () => {
    it("should evict oldest entry when max size is reached", async () => {
      // Mock getCacheSizeMB by temporarily replacing it
      // Since it's private, we'll use a very small max_size_mb and large payload

      const smallCache = new MemoryCache({
        tier1_ttl: 100,
        tier2_ttl: 100,
        tier3_ttl: 100,
        max_size_mb: 0.0001, // ~100 bytes
      });

      const largeString = "a".repeat(200);

      await smallCache.set("key1", largeString, "tier1");

      // Advance time so key1 is "older" in terms of accessed_at
      vi.advanceTimersByTime(1000);

      await smallCache.set("key2", largeString, "tier1");

      // key1 should be evicted because cache size > 0.0001 MB
      expect(await smallCache.get("key1")).toBeNull();
      expect(await smallCache.get("key2")).toBe(largeString);

      smallCache.stopCleanup();
    });
  });

  describe("Cleanup Interval", () => {
    it("should clean up expired entries periodically", async () => {
      await cache.set("t3", "value", "tier3"); // 10s TTL

      // Advance time past TTL
      vi.advanceTimersByTime(11 * 1000);

      // Advance time to trigger interval (5 mins = 300000 ms)
      vi.advanceTimersByTime(300 * 1000);

      // Verify through stats that it was removed, without calling get()
      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe("Singleton", () => {
    it("should return the same instance", () => {
      const instance1 = getCache();
      const instance2 = getCache();
      expect(instance1).toBe(instance2);
    });

    it("should allow setting a custom instance", () => {
      const customInstance = new MemoryCache(customPolicy);
      setCache(customInstance);
      const instance = getCache();
      expect(instance).toBe(customInstance);
      expect(instance.getStats().totalEntries).toBe(0);

      // Clean up
      customInstance.stopCleanup();
    });
  });
});
