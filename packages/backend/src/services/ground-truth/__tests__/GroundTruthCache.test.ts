import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGet,
  mockSet,
  mockTtl,
  mockScan,
  mockMulti,
  mockKeys,
  cacheInvalidationBatchesTotalInc,
  cacheInvalidationKeysDeletedTotalInc,
  cacheInvalidationDurationObserve,
  unlinkExecResults,
  delExecResults,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockTtl: vi.fn(),
  mockScan: vi.fn(),
  mockMulti: vi.fn(),
  mockKeys: vi.fn(),
  cacheInvalidationBatchesTotalInc: vi.fn(),
  cacheInvalidationKeysDeletedTotalInc: vi.fn(),
  cacheInvalidationDurationObserve: vi.fn(),
  unlinkExecResults: [] as Array<Array<number | null> | Error>,
  delExecResults: [] as Array<Array<number | null> | Error>,
}));

vi.mock("../../../lib/redisClient.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    get: mockGet,
    set: mockSet,
    ttl: mockTtl,
    scan: mockScan,
    multi: mockMulti,
    keys: mockKeys,
  }),
}));

vi.mock("../../../lib/metrics/cacheMetrics.js", () => ({
  cacheInvalidationBatchesTotal: { inc: cacheInvalidationBatchesTotalInc },
  cacheInvalidationKeysDeletedTotal: { inc: cacheInvalidationKeysDeletedTotalInc },
  cacheInvalidationDurationMs: { observe: cacheInvalidationDurationObserve },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { groundTruthCache } from "../GroundTruthCache.js";

function createPipeline() {
  const unlink = vi.fn();
  const del = vi.fn();

  const pipeline = {
    unlink: (key: string) => {
      unlink(key);
      return pipeline;
    },
    del: (key: string) => {
      del(key);
      return pipeline;
    },
    exec: vi.fn(async () => {
      const usesUnlink = unlink.mock.calls.length > 0;
      const queue = usesUnlink ? unlinkExecResults : delExecResults;
      const next = queue.shift();

      if (!next) {
        throw new Error("No mock exec result provided");
      }

      if (next instanceof Error) {
        throw next;
      }

      return next;
    }),
    unlinkSpy: unlink,
    delSpy: del,
  };

  return pipeline;
}

describe("GroundTruthCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-19T12:00:00.000Z"));
    unlinkExecResults.length = 0;
    delExecResults.length = 0;
    mockMulti.mockImplementation(() => createPipeline());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached data with retrieval metadata and remaining TTL", async () => {
    mockGet.mockResolvedValueOnce(
      JSON.stringify({
        data: { revenue: 383285000000 },
        retrievedAt: "2026-03-18T11:30:00.000Z",
        ttl: 86400,
      })
    );
    mockTtl.mockResolvedValueOnce(120);

    const result = await groundTruthCache.get<{ revenue: number }>("sec:0000320193:10-K");

    expect(result).toEqual({
      data: { revenue: 383285000000 },
      metadata: {
        hit: true,
        retrievedAt: "2026-03-18T11:30:00.000Z",
        remainingTtl: 120,
      },
    });
  });

  it("stores cache entries using the configured TTL", async () => {
    const ok = await groundTruthCache.set(
      "benchmark:saas:arr",
      { p50: 5000000 },
      "benchmark"
    );

    expect(ok).toBe(true);
    expect(mockSet).toHaveBeenCalledWith(
      "benchmark:saas:arr",
      JSON.stringify({
        data: { p50: 5000000 },
        retrievedAt: "2026-03-19T12:00:00.000Z",
        ttl: 3600,
      }),
      { EX: 3600 }
    );
  });

  it("falls back to DEL when UNLINK is unavailable during single-key invalidation", async () => {
    unlinkExecResults.push(new Error("ERR unknown command 'UNLINK'"));
    delExecResults.push([1]);

    const invalidated = await groundTruthCache.invalidate("sec:0000320193:10-K");

    expect(invalidated).toBe(true);
    expect(mockMulti).toHaveBeenCalledTimes(2);
    const firstPipeline = mockMulti.mock.results[0]?.value as ReturnType<typeof createPipeline>;
    const secondPipeline = mockMulti.mock.results[1]?.value as ReturnType<typeof createPipeline>;
    expect(firstPipeline.unlinkSpy).toHaveBeenCalledWith("sec:0000320193:10-K");
    expect(secondPipeline.delSpy).toHaveBeenCalledWith("sec:0000320193:10-K");
  });

  it("invalidates large patterns via SCAN batches without using KEYS", async () => {
    const batchOne = Array.from({ length: 100 }, (_, index) => `sec:tenant:key:${index}`);
    const batchTwo = Array.from({ length: 100 }, (_, index) => `sec:tenant:key:${index + 100}`);
    const batchThree = Array.from({ length: 50 }, (_, index) => `sec:tenant:key:${index + 200}`);

    mockKeys.mockImplementation(() => {
      throw new Error("KEYS should not be called");
    });
    mockScan
      .mockResolvedValueOnce(["17", batchOne])
      .mockResolvedValueOnce(["42", batchTwo])
      .mockResolvedValueOnce(["0", batchThree]);

    unlinkExecResults.push(
      Array.from({ length: 100 }, () => 1),
      Array.from({ length: 100 }, () => 1),
      Array.from({ length: 50 }, () => 1)
    );

    const deleted = await groundTruthCache.invalidatePattern("sec:tenant:key:*");

    expect(deleted).toBe(250);
    expect(mockKeys).not.toHaveBeenCalled();
    expect(mockScan).toHaveBeenCalledTimes(3);
    expect(mockScan).toHaveBeenNthCalledWith(1, "0", {
      MATCH: "sec:tenant:key:*",
      COUNT: 100,
    });
    expect(mockScan).toHaveBeenNthCalledWith(2, "17", {
      MATCH: "sec:tenant:key:*",
      COUNT: 100,
    });
    expect(mockScan).toHaveBeenNthCalledWith(3, "42", {
      MATCH: "sec:tenant:key:*",
      COUNT: 100,
    });
    expect(mockMulti).toHaveBeenCalledTimes(3);
    expect(cacheInvalidationBatchesTotalInc).toHaveBeenCalledWith(
      { cache_name: "ground-truth" },
      3
    );
    expect(cacheInvalidationKeysDeletedTotalInc).toHaveBeenCalledWith(
      { cache_name: "ground-truth" },
      250
    );
    expect(cacheInvalidationDurationObserve).toHaveBeenCalledWith(
      { cache_name: "ground-truth" },
      expect.any(Number)
    );
  });
});
