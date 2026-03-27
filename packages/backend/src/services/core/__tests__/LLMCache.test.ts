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

// ── Cross-tenant runtime isolation ────────────────────────────────────────────
// Verifies that a cache entry written for tenant A is never returned when
// queried with tenant B's context. This is the runtime proof required by
// docs/security-compliance/secret-scan-evidence.md (R5d).
describe('LLMCache — cross-tenant runtime isolation', () => {
  let cache: LLMCache;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new LLMCache({ enabled: true, keyPrefix: 'llm:cache:', ttl: 3600 });
    (cache as unknown as { connected: boolean }).connected = true;
  });

  it('returns null for tenant B when only tenant A has a cached entry', async () => {
    const PROMPT = 'What is the revenue forecast?';
    const MODEL = 'gpt-4';

    const keyA = buildLLMCacheKey({ tenantId: TENANT_A, model: MODEL, prompt: PROMPT });
    const keyB = buildLLMCacheKey({ tenantId: TENANT_B, model: MODEL, prompt: PROMPT });

    // Sanity: keys must differ
    expect(keyA).not.toBe(keyB);

    // Redis returns a hit only for tenant A's key
    mockGet.mockImplementation(async (key: string) => {
      if (key === keyA) return makeEntry();
      return null; // tenant B's key is not in cache
    });

    const hitA = await cache.get(TENANT_A, PROMPT, MODEL);
    const hitB = await cache.get(TENANT_B, PROMPT, MODEL);

    expect(hitA).not.toBeNull();  // tenant A gets a hit
    expect(hitB).toBeNull();      // tenant B gets a miss — no cross-tenant bleed
  });

  it('does not allow tenant B to read tenant A cache entry by guessing the key', async () => {
    // Tenant B cannot construct tenant A's cache key without knowing tenant A's ID.
    // This test verifies the key format embeds tenantId such that guessing is infeasible.
    const keyA = buildLLMCacheKey({ tenantId: TENANT_A, model: 'gpt-4', prompt: 'secret prompt' });

    // Tenant B attempts to read using their own ID — must produce a different key
    const keyB = buildLLMCacheKey({ tenantId: TENANT_B, model: 'gpt-4', prompt: 'secret prompt' });

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain(TENANT_A);
    expect(keyB).toContain(TENANT_B);
    // Tenant B's key must not contain tenant A's ID anywhere
    expect(keyB).not.toContain(TENANT_A);
  });

  it('set() for tenant A does not populate tenant B cache slot', async () => {
    const PROMPT = 'shared prompt text';
    const MODEL = 'gpt-4';

    mockSet.mockResolvedValue('OK');
    mockGet.mockResolvedValue(null); // both slots start empty

    await cache.set(TENANT_A, PROMPT, MODEL, 'tenant A response', {
      promptTokens: 10,
      completionTokens: 5,
      cost: 0.001,
    });

    // The set call must have used tenant A's key, not tenant B's.
    // ioredis set() is called as set(key, value, ...) — key is first arg.
    // Find the call that wrote a cache entry (value is a JSON string).
    const writeCalls = mockSet.mock.calls.filter(
      (args) => typeof args[0] === 'string' && (args[0] as string).startsWith('llm:cache:'),
    );
    expect(writeCalls.length).toBeGreaterThan(0);
    const writtenKey = writeCalls[0]![0] as string;
    expect(writtenKey).toContain(TENANT_A);
    expect(writtenKey).not.toContain(TENANT_B);

    // Querying with tenant B still returns null (Redis mock returns null for all gets)
    const hitB = await cache.get(TENANT_B, PROMPT, MODEL);
    expect(hitB).toBeNull();
  });
});
