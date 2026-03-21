import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisSessionStore, SessionMetadata } from '../RedisSessionStore';
import { performance } from 'perf_hooks';

// We mock the modules using Vitest
vi.mock('@shared/lib/redisClient', () => {
  const mockRedis = {
    smembers: vi.fn(),
    get: vi.fn(),
    mget: vi.fn(),
    set: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    sadd: vi.fn(),
    expire: vi.fn(),
    srem: vi.fn(),
    exists: vi.fn(),
    ping: vi.fn(),
  };
  return {
    getRedisClient: () => Promise.resolve(mockRedis),
  };
});

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('RedisSessionStore N+1 Benchmark', () => {
  let store: RedisSessionStore;

  beforeEach(() => {
    store = new RedisSessionStore({ enableFallback: false });
  });

  it('measures the performance of getUserSessions', async () => {
    const { getRedisClient } = await import('@shared/lib/redisClient');
    const redis = await getRedisClient();

    const numSessions = 100;
    const userId = 'user_123';
    const tenantId = 'tenant_1';

    const sessionIds = Array.from({ length: numSessions }, (_, i) => `session_${i}`);

    (redis.smembers as any).mockResolvedValue(sessionIds);

    // Simulate 2ms network latency for each redis get
    (redis.get as any).mockImplementation(async (key: string) => {
      await new Promise(resolve => setTimeout(resolve, 2));
      const sessionId = key.split(':').pop();
      const metadata: SessionMetadata = {
        sessionId: sessionId!,
        userId,
        tenantId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        absoluteExpiresAt: Date.now() + 3600000,
        idleExpiresAt: Date.now() + 1800000,
      };
      return JSON.stringify(metadata);
    });

    // Add mock for mget for when we optimize
    (redis.mget as any).mockImplementation(async (...keys: string[]) => {
      // Flattens array if it's passed as an array
      const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
      // Single network roundtrip of 2ms + some small processing overhead
      await new Promise(resolve => setTimeout(resolve, 2 + (flatKeys.length * 0.1)));
      return flatKeys.map((key: string) => {
        const sessionId = key.split(':').pop();
        const metadata: SessionMetadata = {
          sessionId: sessionId!,
          userId,
          tenantId,
          createdAt: Date.now(),
          lastActivityAt: Date.now(),
          absoluteExpiresAt: Date.now() + 3600000,
          idleExpiresAt: Date.now() + 1800000,
        };
        return JSON.stringify(metadata);
      });
    });

    const iterations = 5;
    let totalTime = 0;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await store.getUserSessions(userId, tenantId);
      const end = performance.now();
      const duration = end - start;
      console.log(`Iteration ${i + 1}: ${duration.toFixed(2)}ms`);
      totalTime += duration;
    }

    const avgTime = totalTime / iterations;
    console.log(`Average time for ${numSessions} sessions: ${avgTime.toFixed(2)}ms`);

    store.destroy();

    // This is just a benchmark so we always pass
    expect(true).toBe(true);
  });
});
