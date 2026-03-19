import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getCacheMock,
  setCacheMock,
  deleteCacheMock,
  deleteCachePatternMock,
  isRedisConnectedMock,
  cacheNamespaceRequestsTotalInc,
  cacheInvalidationsTotalInc,
} = vi.hoisted(() => ({
  getCacheMock: vi.fn(),
  setCacheMock: vi.fn(),
  deleteCacheMock: vi.fn(),
  deleteCachePatternMock: vi.fn(),
  isRedisConnectedMock: vi.fn(),
  cacheNamespaceRequestsTotalInc: vi.fn(),
  cacheInvalidationsTotalInc: vi.fn(),
}));

vi.mock("../../../lib/redis.js", () => ({
  getCache: getCacheMock,
  setCache: setCacheMock,
  deleteCache: deleteCacheMock,
  deleteCachePattern: deleteCachePatternMock,
  isRedisConnected: isRedisConnectedMock,
  getRedisKey: (tenantId: string | undefined, key: string) => `${tenantId || "public"}:${key}`,
}));

vi.mock("../../../lib/metrics/cacheMetrics.js", () => ({
  cacheNamespaceRequestsTotal: { inc: cacheNamespaceRequestsTotalInc },
  cacheInvalidationsTotal: { inc: cacheInvalidationsTotalInc },
}));

import { AgentCache } from "../AgentCache.js";

describe("AgentCache", () => {
  beforeEach(() => {
    getCacheMock.mockReset();
    setCacheMock.mockReset();
    deleteCacheMock.mockReset();
    deleteCachePatternMock.mockReset();
    isRedisConnectedMock.mockReset();
    cacheNamespaceRequestsTotalInc.mockReset();
    cacheInvalidationsTotalInc.mockReset();
    isRedisConnectedMock.mockReturnValue(true);
  });

  it("uses redis as the primary shared cache and only promotes hits into the near-cache", async () => {
    const cache = new AgentCache({
      l1Enabled: true,
      l1DefaultTtl: 5,
      l2Enabled: true,
      l2DefaultTtl: 60,
      statsReportingInterval: 9999,
      cleanupInterval: 9999,
    });

    getCacheMock.mockResolvedValueOnce({
      key: "tenant-a:unified-agent-cache:unified-agent.idempotency:key-1",
      value: { success: true },
      timestamp: Date.now(),
      ttl: 60_000,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: 128,
    });

    const first = await cache.get("key-1", {
      tenantId: "tenant-a",
      namespace: "unified-agent.idempotency",
    });
    const second = await cache.get("key-1", {
      tenantId: "tenant-a",
      namespace: "unified-agent.idempotency",
    });

    expect(first).toEqual({ success: true });
    expect(second).toEqual({ success: true });
    expect(getCacheMock).toHaveBeenCalledTimes(1);
    expect(cacheNamespaceRequestsTotalInc).toHaveBeenCalledWith({
      cache_name: "agent-cache",
      cache_namespace: "unified-agent.idempotency",
      layer: "near",
      outcome: "hit",
    });

    cache.shutdown();
  });

  it("invalidates a tenant namespace across near-cache and redis", async () => {
    const cache = new AgentCache({
      l1Enabled: true,
      l2Enabled: true,
      statsReportingInterval: 9999,
      cleanupInterval: 9999,
    });

    deleteCachePatternMock.mockResolvedValueOnce(2);
    await cache.set("key-1", { ok: true }, {
      tenantId: "tenant-a",
      namespace: "unified-agent.idempotency",
      ttl: 60,
    });

    const deleted = await cache.invalidateNamespace(
      "tenant-a",
      "unified-agent.idempotency"
    );

    expect(deleted).toBe(3);
    expect(deleteCachePatternMock).toHaveBeenCalledWith(
      "tenant-a:agent-cache:unified-agent.idempotency:*"
    );
    expect(cacheInvalidationsTotalInc).toHaveBeenCalledWith(
      {
        cache_name: "agent-cache",
        cache_namespace: "unified-agent.idempotency",
        scope: "pattern",
      },
      3
    );

    cache.shutdown();
  });
});
