import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGet,
  mockSet,
  mockDel,
  mockHGetAll,
  mockInfo,
  mockMulti,
  cacheRequestsTotalInc,
} = vi.hoisted(() => {
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
    mockInfo: vi.fn().mockResolvedValue('used_memory:1024'),
    mockMulti: multi,
    cacheRequestsTotalInc: vi.fn(),
  };
});

vi.mock('ioredis', () => ({
  default: class RedisMock {
    on = vi.fn();
    quit = vi.fn();
    get = mockGet;
    set = mockSet;
    del = mockDel;
    hgetall = mockHGetAll;
    hincrby = vi.fn();
    info = mockInfo;
    multi = mockMulti;
    scanIterator = vi.fn(async function* () {});
  },
}));

vi.mock('../../../lib/metrics/cacheMetrics.js', () => ({
  cacheRequestsTotal: { inc: cacheRequestsTotalInc },
}));

import { buildLLMCacheKey, LLMCache } from '../LLMCache.js';

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

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

describe('core/LLMCache', () => {
  let cache: LLMCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new LLMCache({ enabled: true, keyPrefix: 'llm:cache:', ttl: 3600 });
    (cache as unknown as { connected: boolean }).connected = true;
  });

  it('returns null on cache miss', async () => {
    mockGet.mockResolvedValueOnce(null);

    await expect(cache.get(TENANT_A, 'prompt', 'gpt-4')).resolves.toBeNull();
    expect(cacheRequestsTotalInc).toHaveBeenCalledWith({
      cache_name: 'llm',
      cache_namespace: 'llm',
      cache_layer: 'redis',
      outcome: 'miss',
    });
  });

  it('does not rewrite the full payload on a cache hit by default', async () => {
    mockGet.mockResolvedValueOnce(makeEntry({ hitCount: 5 }));
    const tx = {
      hincrby: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    mockMulti.mockReturnValueOnce(tx);

    const result = await cache.get(TENANT_A, 'prompt', 'gpt-4');

    expect(result?.hitCount).toBe(5);
    expect(mockSet).not.toHaveBeenCalled();
    expect(tx.expire).not.toHaveBeenCalled();
    expect(tx.hincrby).toHaveBeenNthCalledWith(1, 'llm:cache:stats', 'totalHits', 1);
    expect(tx.hincrby).toHaveBeenNthCalledWith(
      2,
      'llm:cache:stats',
      'totalCostSavedMilliCents',
      200
    );
  });

  it('refreshes TTL only when policy requires it', async () => {
    mockGet.mockResolvedValueOnce(makeEntry());
    const tx = {
      hincrby: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    };
    mockMulti.mockReturnValueOnce(tx);

    await cache.get(TENANT_A, 'prompt', 'gpt-4', undefined, { refreshTtlOnHit: true, ttlSeconds: 90 });

    expect(tx.expire).toHaveBeenCalledWith(
      expect.stringContaining(`llm:cache:${TENANT_A}:gpt-4:`),
      90
    );
  });

  it('reads aggregate stats from Redis without scanning entries', async () => {
    mockHGetAll.mockResolvedValueOnce({
      totalEntries: '3',
      totalHits: '7',
      totalCostSavedMilliCents: '900',
    });

    await expect(cache.getStats()).resolves.toEqual({
      totalEntries: 3,
      totalHits: 7,
      totalCostSaved: 0.009,
      cacheSize: 1024,
    });
  });
});

describe('buildLLMCacheKey — tenant isolation', () => {
  it('produces different keys for different tenants with identical prompts', () => {
    const keyA = buildLLMCacheKey({ tenantId: TENANT_A, model: 'gpt-4', prompt: 'hello' });
    const keyB = buildLLMCacheKey({ tenantId: TENANT_B, model: 'gpt-4', prompt: 'hello' });
    expect(keyA).not.toBe(keyB);
    expect(keyA).toMatch(new RegExp(`^llm:cache:${TENANT_A}:gpt-4:`));
    expect(keyB).toMatch(new RegExp(`^llm:cache:${TENANT_B}:gpt-4:`));
  });

  it('produces the same key for the same tenant, model, and prompt', () => {
    const key1 = buildLLMCacheKey({ tenantId: TENANT_A, model: 'gpt-4', prompt: 'hello' });
    const key2 = buildLLMCacheKey({ tenantId: TENANT_A, model: 'gpt-4', prompt: 'hello' });
    expect(key1).toBe(key2);
  });

  it('throws when tenantId is missing', () => {
    expect(() =>
      buildLLMCacheKey({ tenantId: '', model: 'gpt-4', prompt: 'hello' })
    ).toThrow('tenantId is required for LLM cache key construction');
  });

  it('includes tenantId as the first path segment after the prefix', () => {
    const key = buildLLMCacheKey({ tenantId: TENANT_A, model: 'gpt-4', prompt: 'test' });
    const parts = key.split(':');
    // format: llm:cache:{tenantId}:{model}:{hash}
    expect(parts[2]).toBe(TENANT_A);
    expect(parts[3]).toBe('gpt-4');
  });
});
