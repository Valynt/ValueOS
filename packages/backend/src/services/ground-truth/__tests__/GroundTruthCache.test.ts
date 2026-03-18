/**
 * GroundTruthCache Tests (Task 11.8)
 *
 * Unit tests for cache hit/miss behavior and TTL.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { groundTruthCache, type CacheEntry, type CacheResult } from "../GroundTruthCache.js";

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
};

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
}));

describe("GroundTruthCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("cache hit behavior", () => {
    it("should return cache hit with data", async () => {
      const cacheKey = "sec:0000320193:10-K";
      const cachedData: CacheEntry = {
        data: { revenue: 383285000000 },
        cachedAt: Date.now(),
        ttl: 86400,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result: CacheResult | null = await groundTruthCache.get(cacheKey);

      expect(result).not.toBeNull();
      expect(result?.hit).toBe(true);
      expect(result?.data).toEqual({ revenue: 383285000000 });
    });

    it("should return null on cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await groundTruthCache.get("nonexistent:key");

      expect(result).toBeNull();
    });

    it("should return cache age in response", async () => {
      const cacheKey = "benchmark:ARR:SaaS";
      const cachedAt = Date.now() - 3600000; // 1 hour ago
      const cachedData: CacheEntry = {
        data: { p50: 5000000 },
        cachedAt,
        ttl: 3600,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await groundTruthCache.get(cacheKey);

      expect(result?.age).toBeGreaterThan(0);
      expect(result?.age).toBeLessThanOrEqual(3600000);
    });
  });

  describe("cache miss behavior", () => {
    it("should store data with TTL on set", async () => {
      const cacheKey = "sec:0000320193:10-K";
      const data = { revenue: 383285000000 };
      const ttl = 86400; // 24 hours for SEC data

      await groundTruthCache.set(cacheKey, { data, cachedAt: Date.now(), ttl }, ttl);

      expect(mockRedis.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(String),
        "EX",
        ttl
      );
    });

    it("should use tier-based TTL defaults", async () => {
      const secKey = "sec:0000320193:10-K";
      const benchmarkKey = "benchmark:ARR:SaaS";

      await groundTruthCache.set(
        secKey,
        { data: {}, cachedAt: Date.now(), ttl: 86400 },
        86400
      );

      await groundTruthCache.set(
        benchmarkKey,
        { data: {}, cachedAt: Date.now(), ttl: 3600 },
        3600
      );

      // SEC data should have longer TTL
      const secCall = mockRedis.set.mock.calls.find(c => c[0] === secKey);
      const benchmarkCall = mockRedis.set.mock.calls.find(c => c[0] === benchmarkKey);

      expect(secCall).toBeDefined();
      expect(benchmarkCall).toBeDefined();
    });
  });

  describe("getOrCompute", () => {
    it("should return cached data without calling compute function on hit", async () => {
      const cacheKey = "compute:test";
      const cachedData = { value: 42 };
      const computeFn = vi.fn().mockResolvedValue({ value: 100 });

      mockRedis.get.mockResolvedValue(
        JSON.stringify({
          data: cachedData,
          cachedAt: Date.now(),
          ttl: 3600,
        })
      );

      const result = await groundTruthCache.getOrCompute(cacheKey, computeFn, 3600);

      expect(result).toEqual(cachedData);
      expect(computeFn).not.toHaveBeenCalled();
    });

    it("should call compute function and cache result on miss", async () => {
      const cacheKey = "compute:miss";
      const computedData = { value: 100 };
      const computeFn = vi.fn().mockResolvedValue(computedData);

      mockRedis.get.mockResolvedValue(null);

      const result = await groundTruthCache.getOrCompute(cacheKey, computeFn, 3600);

      expect(result).toEqual(computedData);
      expect(computeFn).toHaveBeenCalled();
      expect(mockRedis.set).toHaveBeenCalled();
    });
  });

  describe("invalidate", () => {
    it("should delete key from cache", async () => {
      const cacheKey = "invalidate:test";

      await groundTruthCache.invalidate(cacheKey);

      expect(mockRedis.del).toHaveBeenCalledWith(cacheKey);
    });
  });

  describe("cache metadata", () => {
    it("should include original retrieval timestamp", async () => {
      const retrievedAt = "2024-01-15T10:00:00Z";
      const cachedData: CacheEntry = {
        data: { revenue: 1000000 },
        cachedAt: Date.now(),
        ttl: 86400,
        retrievedAt,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const result = await groundTruthCache.get("test:key");

      expect(result?.retrievedAt).toBe(retrievedAt);
    });
  });

  describe("cache connection", () => {
    it("should handle Redis connection errors gracefully", async () => {
      mockRedis.get.mockRejectedValue(new Error("Connection refused"));

      // Should return null on error, not throw
      const result = await groundTruthCache.get("test:key");
      expect(result).toBeNull();
    });
  });
});
