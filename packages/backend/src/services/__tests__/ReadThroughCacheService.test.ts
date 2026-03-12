import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockScan,
  mockMulti,
  readCacheEventsTotalInc,
  unlinkExecResults,
  delExecResults,
} = vi.hoisted(() => ({
  mockScan: vi.fn(),
  mockMulti: vi.fn(),
  readCacheEventsTotalInc: vi.fn(),
  unlinkExecResults: [] as Array<Array<number | null>>,
  delExecResults: [] as Array<Array<number | null>>,
}));

vi.mock("@shared/lib/redisClient", () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    scan: mockScan,
    multi: mockMulti,
  }),
}));

vi.mock("../../lib/metrics/httpMetrics.js", () => ({
  readCacheEventsTotal: { inc: readCacheEventsTotalInc },
}));

import { ReadThroughCacheService } from "../ReadThroughCacheService.js";

const TENANT_ID = "tenant-aaaa-0000-0000-000000000001";
const ENDPOINT = "api-analytics-summary";

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

describe("ReadThroughCacheService.invalidateEndpoint", () => {
  beforeEach(() => {
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
