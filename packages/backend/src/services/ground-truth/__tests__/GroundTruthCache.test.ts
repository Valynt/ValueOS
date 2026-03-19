import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRedis, mockMetrics } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn(),
    ttl: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
    multi: vi.fn(),
    keys: vi.fn(),
  },
  mockMetrics: {
    groundTruthCacheInvalidationBatchesTotal: { inc: vi.fn() },
    groundTruthCacheInvalidationKeysTotal: { inc: vi.fn() },
    groundTruthCacheInvalidationDurationMs: { observe: vi.fn() },
  },
}));

vi.mock("../../../lib/redisClient.js", () => ({
  getRedisClient: vi.fn(async () => mockRedis),
}));

vi.mock("../../../lib/metrics/cacheMetrics.js", () => mockMetrics);

import { groundTruthCache } from "../GroundTruthCache.js";

describe("GroundTruthCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached data with metadata on a cache hit", async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({
        data: { revenue: 383_285_000_000 },
        retrievedAt: "2026-03-18T00:00:00.000Z",
        ttl: 86_400,
      })
    );
    mockRedis.ttl.mockResolvedValue(42);

    const result = await groundTruthCache.get<{ revenue: number }>(
      "sec:0000320193:10-K"
    );

    expect(result).toEqual({
      data: { revenue: 383_285_000_000 },
      metadata: {
        hit: true,
        retrievedAt: "2026-03-18T00:00:00.000Z",
        remainingTtl: 42,
      },
    });
  });

  it("stores cache entries using the configured TTL", async () => {
    await groundTruthCache.set(
      "benchmark:SaaS:ARR",
      { median: 5_000_000 },
      "benchmark"
    );

    expect(mockRedis.set).toHaveBeenCalledWith(
      "benchmark:SaaS:ARR",
      expect.any(String),
      { EX: 3600 }
    );
  });

  it("computes and caches data on a miss", async () => {
    const compute = vi.fn().mockResolvedValue({ value: 100 });
    mockRedis.get.mockResolvedValue(null);

    const result = await groundTruthCache.getOrCompute(
      "compute:miss",
      compute,
      "general"
    );

    expect(result.data).toEqual({ value: 100 });
    expect(result.metadata.hit).toBe(false);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(mockRedis.set).toHaveBeenCalledTimes(1);
  });

  it("invalidates a single key with DEL", async () => {
    mockRedis.del.mockResolvedValue(1);

    const invalidated = await groundTruthCache.invalidate("invalidate:test");

    expect(invalidated).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith("invalidate:test");
  });

  it("invalidates large patterns with SCAN and bounded UNLINK batches", async () => {
    const firstScanKeys = Array.from(
      { length: 100 },
      (_, index) => `sec:key:${index}`
    );
    const secondScanKeys = Array.from(
      { length: 55 },
      (_, index) => `sec:key:${index + 100}`
    );
    const pipelines: Array<{
      unlink: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
      exec: ReturnType<typeof vi.fn>;
    }> = [];

    mockRedis.scan
      .mockResolvedValueOnce(["1", firstScanKeys])
      .mockResolvedValueOnce(["0", secondScanKeys]);

    mockRedis.multi.mockImplementation(() => {
      const pipeline = {
        unlink: vi.fn().mockReturnThis(),
        del: vi.fn().mockReturnThis(),
        exec: vi
          .fn()
          .mockImplementation(function (this: { unlink: ReturnType<typeof vi.fn> }) {
            return Promise.resolve(this.unlink.mock.calls.map(() => 1));
          }),
      };
      pipelines.push(pipeline);
      return pipeline;
    });

    const deleted = await groundTruthCache.invalidatePattern("sec:*");

    expect(deleted).toBe(155);
    expect(mockRedis.keys).not.toHaveBeenCalled();
    expect(mockRedis.scan).toHaveBeenNthCalledWith(1, "0", {
      MATCH: "sec:*",
      COUNT: 100,
    });
    expect(mockRedis.scan).toHaveBeenNthCalledWith(2, "1", {
      MATCH: "sec:*",
      COUNT: 100,
    });
    expect(mockRedis.multi).toHaveBeenCalledTimes(2);
    expect(pipelines[0].unlink).toHaveBeenCalledTimes(100);
    expect(pipelines[0].del).not.toHaveBeenCalled();
    expect(pipelines[1].unlink).toHaveBeenCalledTimes(55);
    expect(
      mockMetrics.groundTruthCacheInvalidationBatchesTotal.inc
    ).toHaveBeenCalledWith({ mode: "pattern" }, 2);
    expect(
      mockMetrics.groundTruthCacheInvalidationKeysTotal.inc
    ).toHaveBeenCalledWith({ mode: "pattern" }, 155);
    expect(
      mockMetrics.groundTruthCacheInvalidationDurationMs.observe
    ).toHaveBeenCalledWith({ mode: "pattern" }, expect.any(Number));
  });

  it("falls back to DEL when UNLINK is unavailable", async () => {
    mockRedis.scan.mockResolvedValueOnce([
      "0",
      ["benchmark:key:1", "benchmark:key:2"],
    ]);

    const unlinkPipeline = {
      unlink: vi.fn().mockImplementation(() => {
        throw new Error("ERR unknown command 'UNLINK'");
      }),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    };
    const delPipeline = {
      unlink: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([1, 1]),
    };

    mockRedis.multi
      .mockReturnValueOnce(unlinkPipeline)
      .mockReturnValueOnce(delPipeline);

    const deleted = await groundTruthCache.invalidatePattern("benchmark:*");

    expect(deleted).toBe(2);
    expect(unlinkPipeline.unlink).toHaveBeenCalledTimes(1);
    expect(delPipeline.del).toHaveBeenCalledTimes(2);
  });
});
