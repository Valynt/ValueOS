/**
 * CacheService — distributed (multi-instance) correctness tests.
 *
 * Verifies that two CacheService instances sharing the same Redis client
 * see each other's writes, simulating two pods in a multi-instance deployment.
 *
 * Redis operations are mocked at the `redis` module boundary so these tests
 * run without a live Redis server while still exercising the Redis code path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TCTPayload, tenantContextStorage } from '../../middleware/tenantContext.js';
import { CacheService } from '../CacheService.js';

// Shared in-memory store simulating a single Redis instance seen by both pods.
const sharedRedisStore = new Map<string, string>();

const makeRedisClient = () => ({
  on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
    if (event === 'ready') cb();
  }),
  connect: vi.fn().mockResolvedValue(undefined),
  get: vi.fn(async (key: string) => sharedRedisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, _opts?: unknown) => {
    sharedRedisStore.set(key, value);
    return 'OK';
  }),
  del: vi.fn(async (keys: string | string[]) => {
    const ks = Array.isArray(keys) ? keys : [keys];
    let count = 0;
    for (const k of ks) {
      if (sharedRedisStore.delete(k)) count++;
    }
    return count;
  }),
  scan: vi.fn(async (_cursor: number, opts: { MATCH: string }) => {
    // Escape regex special chars first, then expand the glob wildcard.
    // Order matters: expanding * before escaping turns .* into \\.* (broken).
    const pattern = opts.MATCH
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    const keys = [...sharedRedisStore.keys()].filter((k) => regex.test(k));
    return { cursor: 0, keys };
  }),
  quit: vi.fn().mockResolvedValue(undefined),
});

vi.mock('redis', () => ({
  createClient: vi.fn(() => makeRedisClient()),
}));

const tenant: TCTPayload = {
  iss: 'jwt',
  sub: 'user-1',
  tid: 'tenant-distributed',
  roles: [],
  tier: 'basic',
  exp: 9999999999,
};

describe('CacheService distributed correctness', () => {
  beforeEach(() => {
    sharedRedisStore.clear();
    vi.clearAllMocks();
  });

  it('write in instance A is visible to instance B', async () => {
    const instanceA = new CacheService('shared-ns');
    const instanceB = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instanceA.set('greeting', { hello: 'world' });
      const result = await instanceB.get<{ hello: string }>('greeting');
      expect(result).toEqual({ hello: 'world' });
    });
  });

  it('delete in instance A removes key for instance B', async () => {
    const instanceA = new CacheService('shared-ns');
    const instanceB = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instanceA.set('to-delete', 'value');
      await instanceA.delete('to-delete');
      const result = await instanceB.get<string>('to-delete');
      expect(result).toBeNull();
    });
  });

  it('clear() in instance A removes all tenant keys for instance B', async () => {
    const instanceA = new CacheService('shared-ns');
    const instanceB = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instanceA.set('key1', 'v1');
      await instanceA.set('key2', 'v2');
      await instanceA.clear();

      expect(await instanceB.get('key1')).toBeNull();
      expect(await instanceB.get('key2')).toBeNull();
    });
  });

  it('tenant isolation: instance A write is not visible under a different tenant', async () => {
    const tenantB: TCTPayload = { ...tenant, tid: 'tenant-other' };
    const instance = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instance.set('secret', 'tenant-a-data');
    });

    await tenantContextStorage.run(tenantB, async () => {
      const result = await instance.get<string>('secret');
      expect(result).toBeNull();
    });
  });

  it('invalidatePattern removes matching keys from shared store', async () => {
    const instanceA = new CacheService('shared-ns');
    const instanceB = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instanceA.set('user:1:profile', { name: 'Alice' });
      await instanceA.set('user:2:profile', { name: 'Bob' });
      await instanceA.set('config:global', { flag: true });

      await instanceA.invalidatePattern('user:*');

      expect(await instanceB.get('user:1:profile')).toBeNull();
      expect(await instanceB.get('user:2:profile')).toBeNull();
      // Non-matching key survives
      expect(await instanceB.get<{ flag: boolean }>('config:global')).toEqual({ flag: true });
    });
  });

  it('deleteMany removes specified keys from shared store', async () => {
    const instanceA = new CacheService('shared-ns');
    const instanceB = new CacheService('shared-ns');

    await tenantContextStorage.run(tenant, async () => {
      await instanceA.set('a', 1);
      await instanceA.set('b', 2);
      await instanceA.set('c', 3);

      await instanceA.deleteMany(['a', 'b']);

      expect(await instanceB.get('a')).toBeNull();
      expect(await instanceB.get('b')).toBeNull();
      expect(await instanceB.get<number>('c')).toBe(3);
    });
  });
});
