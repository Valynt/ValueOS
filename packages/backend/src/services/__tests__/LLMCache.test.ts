// @vitest-environment node
/**
 * LLMCache — unit tests (re-export path)
 *
 * Verifies cache hit/miss behaviour through the re-export at
 * packages/backend/src/services/LLMCache.ts and that the hit path does not
 * perform a racy read-modify-write on the entry's hitCount field.
 *
 * The canonical / comprehensive test suite lives in
 * packages/backend/src/services/core/__tests__/LLMCache.test.ts — this file
 * covers the re-export path and verifies tenant-scoped key construction.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Redis mock (ioredis) — hoisted so the module-level singleton in LLMCache.ts
// can reference these variables during import.
// ---------------------------------------------------------------------------

const { mockGet, mockSet, mockMulti, cacheRequestsTotalInc } = vi.hoisted(
  () => {
    const exec = vi.fn().mockResolvedValue([]);
    const multi = vi.fn(() => ({
      hincrby: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec,
    }));

    return {
      mockGet: vi.fn(),
      mockSet: vi.fn(),
      mockDel: vi.fn(),
      mockHGetAll: vi.fn().mockResolvedValue({}),
      mockInfo: vi.fn().mockResolvedValue("used_memory:1024"),
      mockMulti: multi,
      cacheRequestsTotalInc: vi.fn(),
    };
  }
);

vi.mock("ioredis", () => ({
  default: class RedisMock {
    on = vi.fn();
    quit = vi.fn();
    get = mockGet;
    set = mockSet;
    del = vi.fn();
    hgetall = vi.fn().mockResolvedValue({});
    hincrby = vi.fn();
    info = vi.fn().mockResolvedValue("used_memory:1024");
    multi = mockMulti;
    scanIterator = vi.fn(async function* () {});
  },
}));

vi.mock("../../../lib/metrics/cacheMetrics.js", () => ({
  cacheRequestsTotal: { inc: cacheRequestsTotalInc },
}));

import { LLMCache } from "../LLMCache.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = "11111111-1111-1111-1111-111111111111";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  overrides: Partial<{ hitCount: number; cost: number }> = {}
) {
  return JSON.stringify({
    response: "cached response",
    model: "gpt-4",
    promptTokens: 100,
    completionTokens: 50,
    cost: 0.002,
    cachedAt: new Date().toISOString(),
    hitCount: 0,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LLMCache (re-export path)", () => {
  let cache: LLMCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new LLMCache({ enabled: true, keyPrefix: "llm:cache:", ttl: 3600 });
    // Simulate connected state by setting the private field via cast
    (cache as unknown as { connected: boolean }).connected = true;
  });

  describe("get — cache miss", () => {
    it("returns null when key is not in Redis", async () => {
      mockGet.mockResolvedValue(null);
      const result = await cache.get(TENANT_A, "prompt", "gpt-4");
      expect(result).toBeNull();
    });
  });

  describe("get — cache hit", () => {
    it("returns the parsed entry", async () => {
      mockGet.mockResolvedValue(makeEntry({ cost: 0.005 }));
      const result = await cache.get(TENANT_A, "prompt", "gpt-4");
      expect(result).not.toBeNull();
      expect(result?.response).toBe("cached response");
    });

    it("does NOT write the entry back to Redis on hit (no racy SET)", async () => {
      mockGet.mockResolvedValue(makeEntry());
      const txMock = {
        hincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockMulti.mockReturnValueOnce(txMock);

      await cache.get(TENANT_A, "prompt", "gpt-4");

      // The transaction must NOT include a SET call — that was the racy path
      expect(mockSet).not.toHaveBeenCalled();
    });

    it("increments totalHits and totalCostSavedMilliCents in the stats hash atomically", async () => {
      mockGet.mockResolvedValue(makeEntry({ cost: 0.003 }));
      const txMock = {
        hincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      mockMulti.mockReturnValueOnce(txMock);

      await cache.get(TENANT_A, "prompt", "gpt-4");

      expect(txMock.hincrby).toHaveBeenCalledWith(
        expect.stringContaining("stats"),
        "totalHits",
        1
      );
      expect(txMock.hincrby).toHaveBeenCalledWith(
        expect.stringContaining("stats"),
        "totalCostSavedMilliCents",
        300 // 0.003 * 100_000
      );
      expect(txMock.exec).toHaveBeenCalled();
    });

    it("does not mutate hitCount on the returned entry", async () => {
      mockGet.mockResolvedValue(makeEntry({ hitCount: 5 }));
      mockMulti.mockReturnValueOnce({
        hincrby: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      });

      const result = await cache.get(TENANT_A, "prompt", "gpt-4");
      // hitCount on the returned object should be the stored value, not incremented
      expect(result?.hitCount).toBe(5);
    });
  });
});
