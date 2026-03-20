// @vitest-environment node
/**
 * LLMCache — unit tests
 *
 * Verifies cache hit/miss behaviour and that the hit path does not perform a
 * racy read-modify-write on the entry's hitCount field.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Redis mock
// ---------------------------------------------------------------------------

const { mockGet, mockSet, mockHIncrBy, mockHIncrByFloat, mockExec, mockMulti } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockHIncrBy = vi.fn();
  const mockHIncrByFloat = vi.fn();
  const mockExec = vi.fn().mockResolvedValue([]);
  const mockMulti = vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    hincrby: mockHIncrBy,
    hIncrByFloat: mockHIncrByFloat,
    exec: mockExec,
  }));
  return { mockGet, mockSet, mockHIncrBy, mockHIncrByFloat, mockExec, mockMulti };
});

vi.mock('ioredis', () => {
  return {
    default: class RedisMock {
      on = vi.fn();
      connect = vi.fn();
      disconnect = vi.fn();
      quit = vi.fn();
      get = mockGet;
      set = mockSet;
      del = vi.fn();
      scan = vi.fn().mockResolvedValue({ cursor: 0, keys: [] });
      hgetall = vi.fn().mockResolvedValue({});
      hincrby = mockHIncrBy;
      hIncrByFloat = mockHIncrByFloat;
      info = vi.fn().mockResolvedValue('used_memory:1024');
      multi = mockMulti;
    }
  };
});

vi.mock('../utils/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), cache: vi.fn() },
}));

import { LLMCache } from '../LLMCache.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<{ hitCount: number; cost: number }> = {}) {
  return JSON.stringify({
    response: 'cached response',
    model: 'gpt-4',
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

describe('LLMCache', () => {
  let cache: LLMCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new LLMCache({ enabled: true, keyPrefix: 'llm:cache:', ttl: 3600 });
    // Simulate connected state by setting the private field via cast
    (cache as unknown as { connected: boolean }).connected = true;
  });

  describe('get — cache miss', () => {
    it('returns null when key is not in Redis', async () => {
      mockGet.mockResolvedValue(null);
      const result = await cache.get('prompt', 'gpt-4');
      expect(result).toBeNull();
    });
  });

  describe('get — cache hit', () => {
    it('returns the parsed entry', async () => {
      mockGet.mockResolvedValue(makeEntry({ cost: 0.005 }));
      const result = await cache.get('prompt', 'gpt-4');
      expect(result).not.toBeNull();
      expect(result?.response).toBe('cached response');
    });

    it('does NOT write the entry back to Redis on hit (no racy SET)', async () => {
      mockGet.mockResolvedValue(makeEntry());
      const txMock = { set: vi.fn().mockReturnThis(), hIncrBy: vi.fn().mockReturnThis(), hIncrByFloat: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) };
      mockMulti.mockReturnValue(txMock);

      await cache.get('prompt', 'gpt-4');

      // The transaction must NOT include a SET call — that was the racy path
      expect(txMock.set).not.toHaveBeenCalled();
    });

    it('increments totalHits and totalCostSaved in the stats hash atomically', async () => {
      mockGet.mockResolvedValue(makeEntry({ cost: 0.003 }));
      const txMock = { set: vi.fn().mockReturnThis(), hincrby: vi.fn().mockReturnThis(), hIncrByFloat: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) };
      mockMulti.mockReturnValue(txMock);

      await cache.get('prompt', 'gpt-4');

      expect(txMock.hincrby).toHaveBeenCalledWith(expect.stringContaining('stats'), 'totalHits', 1);
      expect(txMock.hIncrByFloat).toHaveBeenCalledWith(expect.stringContaining('stats'), 'totalCostSaved', 0.003);
      expect(txMock.exec).toHaveBeenCalled();
    });

    it('does not mutate hitCount on the returned entry', async () => {
      mockGet.mockResolvedValue(makeEntry({ hitCount: 5 }));
      mockMulti.mockReturnValue({ set: vi.fn().mockReturnThis(), hincrby: vi.fn().mockReturnThis(), hIncrByFloat: vi.fn().mockReturnThis(), exec: vi.fn().mockResolvedValue([]) });

      const result = await cache.get('prompt', 'gpt-4');
      // hitCount on the returned object should be the stored value, not incremented
      expect(result?.hitCount).toBe(5);
    });
  });
});
