import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RedisSessionStore, SessionMetadata } from '../RedisSessionStore';
import { getRedisClient } from '@shared/lib/redisClient';

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.hoisted(() => {
  // Hoisted mock state
});

const storeMap = new Map<string, string>();
const setsMap = new Map<string, Set<string>>();

const mockDelay = () => new Promise(resolve => setTimeout(resolve, 1));

vi.mock('@shared/lib/redisClient', () => {
  return {
    getRedisClient: vi.fn().mockResolvedValue({
      setex: vi.fn(async (key, ttl, val) => {
        await mockDelay();
        storeMap.set(key, val);
      }),
      get: vi.fn(async (key) => {
        await mockDelay();
        return storeMap.get(key) || null;
      }),
      del: vi.fn(async (key) => {
        await mockDelay();
        storeMap.delete(key);
      }),
      exists: vi.fn(async (key) => {
        await mockDelay();
        return storeMap.has(key) ? 1 : 0;
      }),
      sadd: vi.fn(async (key, val) => {
        await mockDelay();
        if (!setsMap.has(key)) setsMap.set(key, new Set());
        setsMap.get(key)!.add(val);
      }),
      smembers: vi.fn(async (key) => {
        await mockDelay();
        return Array.from(setsMap.get(key) || []);
      }),
      srem: vi.fn(async (key, val) => {
        await mockDelay();
        if (setsMap.has(key)) setsMap.get(key)!.delete(val);
      }),
      expire: vi.fn(async () => { await mockDelay(); }),
      ping: vi.fn(async () => { await mockDelay(); }),
      flushall: vi.fn(async () => {
        storeMap.clear();
        setsMap.clear();
      })
    }),
  };
});

describe('RedisSessionStore Performance', () => {
  let store: RedisSessionStore;

  beforeEach(async () => {
    store = new RedisSessionStore({ enableFallback: true });
    storeMap.clear();
    setsMap.clear();
  });

  it('measures invalidateUserSessions with 50 sessions (with network delay)', async () => {
    const userId = 'bench-user-1';
    // Use fewer sessions so benchmark doesn't time out, but network delay makes N+1 obvious
    for (let i = 0; i < 50; i++) {
      await store.set(`sess-${userId}-${i}`, {
        sessionId: `sess-${userId}-${i}`,
        userId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        absoluteExpiresAt: Date.now() + 3600000,
        idleExpiresAt: Date.now() + 1800000,
      } as SessionMetadata);
    }

    const start = performance.now();
    await store.invalidateUserSessions(userId);
    const end = performance.now();

    console.log(`[Metric] invalidateUserSessions took: ${(end - start).toFixed(2)} ms`);
  });

  it('measures invalidateDeviceSessions with 50 sessions (with network delay)', async () => {
    const deviceId = 'bench-device-1';
    for (let i = 0; i < 50; i++) {
      await store.set(`sess-dev-${i}`, {
        sessionId: `sess-dev-${i}`,
        userId: `user-${i}`,
        deviceId,
        createdAt: Date.now(),
        lastActivityAt: Date.now(),
        absoluteExpiresAt: Date.now() + 3600000,
        idleExpiresAt: Date.now() + 1800000,
      } as SessionMetadata);
    }

    const start = performance.now();
    await store.invalidateDeviceSessions(deviceId);
    const end = performance.now();

    console.log(`[Metric] invalidateDeviceSessions took: ${(end - start).toFixed(2)} ms`);
  });
});
