import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGet,
  mockSet,
  mockScan,
  mockMulti,
  readCacheEventsTotalInc,
  cacheRequestsTotalInc,
  cacheLoaderDurationObserve,
  cacheFillDurationObserve,
  cacheCoalescedWaitersTotalInc,
  cacheFallbackModeTotalInc,
  cacheEvictionsTotalInc,
  cacheHitRateSet,
  unlinkExecResults,
  delExecResults,
  redisClientRef,
} = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockScan: vi.fn(),
  mockMulti: vi.fn(),
  readCacheEventsTotalInc: vi.fn(),
  cacheRequestsTotalInc: vi.fn(),
  cacheLoaderDurationObserve: vi.fn(),
  cacheFillDurationObserve: vi.fn(),
  cacheCoalescedWaitersTotalInc: vi.fn(),
  cacheFallbackModeTotalInc: vi.fn(),
  cacheEvictionsTotalInc: vi.fn(),
  cacheHitRateSet: vi.fn(),
  unlinkExecResults: [] as Array<Array<number | null>>,
  delExecResults: [] as Array<Array<number | null>>,
  redisClientRef: { current: null as null | Record<string, unknown> },
}));

vi.mock("../../lib/redis.js", () => ({
  getRedisClient: vi.fn().mockImplementation(async () => redisClientRef.current),
}));

vi.mock("../../lib/metrics/httpMetrics.js", () => ({
  readCacheEventsTotal: { inc: readCacheEventsTotalInc },
}));

vi.mock("../../lib/metrics/cacheMetrics.js", () => ({
  cacheRequestsTotal: { inc: cacheRequestsTotalInc },
  cacheLoaderDurationMs: { observe: cacheLoaderDurationObserve },
  cacheFillDurationMs: { observe: cacheFillDurationObserve },
  cacheCoalescedWaitersTotal: { inc: cacheCoalescedWaitersTotalInc },
  cacheFallbackModeTotal: { inc: cacheFallbackModeTotalInc },
  cacheEvictionsTotal: { inc: cacheEvictionsTotalInc },
  cacheHitRate: { set: cacheHitRateSet },
}));

import { ReadThroughCacheService } from "../cache/ReadThroughCacheService.js";

const TENANT_ID = "tenant-aaaa-0000-0000-000000000001";
const ENDPOINT = "api-analytics-summary";
const CACHE_CONFIG = {
  tenantId: TENANT_ID,
  endpoint: ENDPOINT,
  scope: "summary",
  tier: "warm" as const,
  keyPayload: { page: 1 },
};

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
      const hadUnlinkCommands = unlink.mock.calls.length > 0;
      const queue = hadUnlinkCommands ? unlinkExecResults : delExecResults;
      const next = queue.shift();

      if (!next) {
        throw new Error("No mock exec result provided");
      }

      return next;
    }),
    unlinkSpy: unlink,
    delSpy: del,
  };

  return pipeline;
}

describe("ReadThroughCacheService.getOrLoad", () => {
  beforeEach(() => {
    redisClientRef.current = {
      get: mockGet,
      set: mockSet,
      scan: mockScan,
      multi: mockMulti,
    };
    mockGet.mockReset();
    mockSet.mockReset();
    readCacheEventsTotalInc.mockReset();
    cacheRequestsTotalInc.mockReset();
    cacheLoaderDurationObserve.mockReset();
    cacheFillDurationObserve.mockReset();
    cacheCoalescedWaitersTotalInc.mockReset();
    cacheFallbackModeTotalInc.mockReset();
    cacheEvictionsTotalInc.mockReset();
    cacheHitRateSet.mockReset();
    ReadThroughCacheService.clearNearCacheForTesting();
  });

  it("returns cached payloads without invoking the loader", async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ value: 42 }));
    const loader = vi.fn().mockResolvedValue({ value: 99 });

    const result = await ReadThroughCacheService.getOrLoad(CACHE_CONFIG, loader);

    expect(result).toEqual({ value: 42 });
    expect(loader).not.toHaveBeenCalled();
    expect(cacheRequestsTotalInc).toHaveBeenCalledWith({
      cache_name: `read-through:${ENDPOINT}`,
      cache_namespace: ENDPOINT,
      cache_layer: "redis",
      outcome: "hit",
    });
  });

  it("coalesces concurrent misses onto a single loader", async () => {
    let resolveLoader: ((value: { value: number }) => void) | undefined;
    const loader = vi.fn(
      () =>
        new Promise<{ value: number }>((resolve) => {
          resolveLoader = resolve;
        })
    );

    mockGet.mockResolvedValue(null);

    const first = ReadThroughCacheService.getOrLoad(CACHE_CONFIG, loader);
    const second = ReadThroughCacheService.getOrLoad(CACHE_CONFIG, loader);
    await vi.waitFor(() => expect(loader).toHaveBeenCalledTimes(1));

    resolveLoader?.({ value: 7 });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { value: 7 },
      { value: 7 },
    ]);
    expect(cacheCoalescedWaitersTotalInc).toHaveBeenCalledWith({
      cache_name: `read-through:${ENDPOINT}`,
      cache_namespace: ENDPOINT,
    });
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(cacheLoaderDurationObserve).toHaveBeenCalledWith(
      {
        cache_name: `read-through:${ENDPOINT}`,
        cache_namespace: ENDPOINT,
      },
      expect.any(Number)
    );
    expect(cacheFillDurationObserve).toHaveBeenCalledWith(
      {
        cache_name: `read-through:${ENDPOINT}`,
        cache_namespace: ENDPOINT,
      },
      expect.any(Number)
    );
  });

  it("bypasses caching when Redis is unavailable", async () => {
    redisClientRef.current = null;
    const loader = vi.fn().mockResolvedValue({ value: 12 });

    const result = await ReadThroughCacheService.getOrLoad(CACHE_CONFIG, loader);

    expect(result).toEqual({ value: 12 });
    expect(loader).toHaveBeenCalledTimes(1);
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
    expect(cacheFallbackModeTotalInc).toHaveBeenCalledWith({
      cache_name: `read-through:${ENDPOINT}`,
      cache_namespace: ENDPOINT,
      fallback_mode: "bypass",
      reason: "redis_unavailable",
    });
  });
});

describe("ReadThroughCacheService.invalidateEndpoint", () => {
  beforeEach(() => {
    redisClientRef.current = {
      get: mockGet,
      set: mockSet,
      scan: mockScan,
      multi: mockMulti,
    };
    mockScan.mockReset();
    mockMulti.mockReset();
    readCacheEventsTotalInc.mockReset();
    unlinkExecResults.length = 0;
    delExecResults.length = 0;

    mockMulti.mockImplementation(() => createPipeline());
  });

  it("processes all cursor scan batches", async () => {
    const batchOne = [
      `${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-1`,
      `${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-2`,
    ];
    const batchTwo = [`${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-3`];

    mockScan
      .mockResolvedValueOnce(["11", batchOne])
      .mockResolvedValueOnce(["0", batchTwo]);

    unlinkExecResults.push([1, 1], [1]);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_ID, ENDPOINT);

    expect(deleted).toBe(3);
    expect(mockScan).toHaveBeenCalledTimes(2);
    expect(mockScan).toHaveBeenNthCalledWith(1, "0", {
      MATCH: `${TENANT_ID}:read-cache:${ENDPOINT}*`,
      COUNT: 100,
    });
    expect(mockScan).toHaveBeenNthCalledWith(2, "11", {
      MATCH: `${TENANT_ID}:read-cache:${ENDPOINT}*`,
      COUNT: 100,
    });
    expect(mockMulti).toHaveBeenCalledTimes(2);
  });

  it("returns 0 when scan finds no matching keys", async () => {
    mockScan.mockResolvedValueOnce(["0", []]);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_ID, ENDPOINT);

    expect(deleted).toBe(0);
    expect(mockMulti).not.toHaveBeenCalled();
    expect(readCacheEventsTotalInc).not.toHaveBeenCalled();
  });

  it("increments eviction metric with the actual deleted count", async () => {
    const batch = [
      `${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-1`,
      `${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-2`,
      `${TENANT_ID}:read-cache:${ENDPOINT}:summary:key-3`,
    ];

    mockScan.mockResolvedValueOnce(["0", batch]);
    unlinkExecResults.push([1, 1, 0]);

    const deleted = await ReadThroughCacheService.invalidateEndpoint(TENANT_ID, ENDPOINT);

    expect(deleted).toBe(2);
    expect(readCacheEventsTotalInc).toHaveBeenCalledWith(
      { endpoint: ENDPOINT, event: "eviction" },
      2
    );
  });
});
