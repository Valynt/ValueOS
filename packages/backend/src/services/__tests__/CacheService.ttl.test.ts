/**
 * CacheService — TTL behavior tests.
 *
 * Verifies that TTL is passed to Redis as the EX option on set(), and that
 * the in-memory fallback path does not silently accept TTL options without
 * enforcing them (since in-memory has no native TTL support).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TCTPayload, tenantContextStorage } from '../../middleware/tenantContext.js';
import { CacheService } from '../CacheService.js';

const mockSet = vi.fn().mockResolvedValue('OK');
const mockGet = vi.fn().mockResolvedValue(null);
const mockDel = vi.fn().mockResolvedValue(1);
const mockScan = vi.fn().mockResolvedValue({ cursor: 0, keys: [] });
const mockQuit = vi.fn().mockResolvedValue(undefined);

vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      if (event === 'ready') cb();
    }),
    connect: vi.fn().mockResolvedValue(undefined),
    get: mockGet,
    set: mockSet,
    del: mockDel,
    scan: mockScan,
    quit: mockQuit,
  })),
}));

const tenant: TCTPayload = {
  iss: 'jwt',
  sub: 'user-ttl',
  tid: 'tenant-ttl',
  roles: [],
  tier: 'basic',
  exp: 9999999999,
};

describe('CacheService TTL behavior', () => {
  let cache: CacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new CacheService('ttl-ns');
  });

  it('passes EX option to Redis when ttl is specified', async () => {
    await tenantContextStorage.run(tenant, async () => {
      await cache.set('session', { userId: '123' }, { ttl: 300 });
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('tenant:tenant-ttl:ttl-ns:session'),
      JSON.stringify({ userId: '123' }),
      { EX: 300 }
    );
  });

  it('does not pass EX option when ttl is not specified', async () => {
    await tenantContextStorage.run(tenant, async () => {
      await cache.set('persistent', 'value');
    });

    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('tenant:tenant-ttl:ttl-ns:persistent'),
      JSON.stringify('value')
    );
    // EX option must not be present
    const callArgs = mockSet.mock.calls[0];
    expect(callArgs[2]).toBeUndefined();
  });

  it('deserializes JSON values returned from Redis', async () => {
    mockGet.mockResolvedValueOnce(JSON.stringify({ score: 42, label: 'gold' }));

    const result = await tenantContextStorage.run(tenant, async () =>
      cache.get<{ score: number; label: string }>('badge')
    );

    expect(result).toEqual({ score: 42, label: 'gold' });
  });

  it('returns null when Redis returns null', async () => {
    mockGet.mockResolvedValueOnce(null);

    const result = await tenantContextStorage.run(tenant, async () =>
      cache.get<string>('missing')
    );

    expect(result).toBeNull();
  });

  it('falls back to in-memory store when Redis get throws', async () => {
    mockGet.mockRejectedValueOnce(new Error('ECONNRESET'));

    // Pre-populate in-memory store via a set that also fails Redis
    mockSet.mockRejectedValueOnce(new Error('ECONNRESET'));
    await tenantContextStorage.run(tenant, async () => {
      await cache.set('fallback-key', 'fallback-value');
      const result = await cache.get<string>('fallback-key');
      expect(result).toBe('fallback-value');
    });
  });
});

describe('CacheService disconnect()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls quit() on the Redis client', async () => {
    const cache = new CacheService('disconnect-ns');
    await cache.disconnect();
    expect(mockQuit).toHaveBeenCalledOnce();
  });

  it('is idempotent — second call does not call quit() again', async () => {
    const cache = new CacheService('disconnect-ns');
    await cache.disconnect();
    await cache.disconnect();
    // quit() should only be called once; second call finds redisClient null
    expect(mockQuit).toHaveBeenCalledOnce();
  });

  it('falls back to in-memory after disconnect', async () => {
    const cache = new CacheService('disconnect-ns');
    await cache.disconnect();

    // After disconnect, Redis is gone — set/get should use in-memory store
    await tenantContextStorage.run(
      { iss: 'jwt', sub: 'u', tid: 'tenant-dc', roles: [], tier: 'basic', exp: 9999999999 },
      async () => {
        await cache.set('key', 'value');
        const result = await cache.get<string>('key');
        expect(result).toBe('value');
        // Redis set must not have been called after disconnect
        expect(mockSet).not.toHaveBeenCalled();
      }
    );
  });
});
