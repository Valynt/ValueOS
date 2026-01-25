import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn(),
}));

import { NonceStore } from '../nonceStore';

type RedisSetResult = 'OK' | null;

class InMemoryRedisMock {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  async set(
    key: string,
    value: string,
    options: { NX?: boolean; EX?: number } = {}
  ): Promise<RedisSetResult> {
    this.evictExpired(key);
    const existing = this.store.get(key);
    if (options.NX && existing) {
      return null;
    }

    const ttlMs = options.EX ? options.EX * 1000 : null;
    const expiresAt = ttlMs ? Date.now() + ttlMs : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  private evictExpired(key: string): void {
    const entry = this.store.get(key);
    if (!entry) {
      return;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
    }
  }
}

describe('NonceStore (Redis-backed replay protection)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('expires nonces after TTL', async () => {
    const redis = new InMemoryRedisMock();
    const store = new NonceStore({ ttlMs: 1000, redisClient: redis });

    await expect(store.consumeOnce('issuer', 'nonce')).resolves.toBe(true);

    vi.advanceTimersByTime(1001);

    await expect(store.consumeOnce('issuer', 'nonce')).resolves.toBe(true);
  });

  it('enforces NX semantics to detect replays', async () => {
    const redis = new InMemoryRedisMock();
    const store = new NonceStore({ ttlMs: 60000, redisClient: redis });

    await expect(store.consumeOnce('issuer', 'nonce')).resolves.toBe(true);
    await expect(store.consumeOnce('issuer', 'nonce')).resolves.toBe(false);
  });

  it('rejects replays across instances sharing Redis', async () => {
    const redis = new InMemoryRedisMock();
    const storeA = new NonceStore({ ttlMs: 60000, redisClient: redis });
    const storeB = new NonceStore({ ttlMs: 60000, redisClient: redis });

    await expect(storeA.consumeOnce('issuer', 'nonce')).resolves.toBe(true);
    await expect(storeB.consumeOnce('issuer', 'nonce')).resolves.toBe(false);
  });
});
