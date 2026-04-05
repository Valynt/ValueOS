import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RedisSessionStore, type SessionMetadata } from './RedisSessionStore';

class InMemoryRedisMock {
  private kv = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async setex(key: string, _ttlSeconds: number, value: string): Promise<void> {
    this.kv.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.kv.get(key) ?? null;
  }

  async del(key: string): Promise<void> {
    this.kv.delete(key);
  }

  async exists(key: string): Promise<number> {
    return this.kv.has(key) ? 1 : 0;
  }

  async sadd(key: string, value: string): Promise<void> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set<string>());
    }

    this.sets.get(key)?.add(value);
  }

  async srem(key: string, value: string): Promise<void> {
    this.sets.get(key)?.delete(value);
  }

  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? new Set<string>())];
  }

  async expire(_key: string, _ttlSeconds: number): Promise<void> {
    // no-op for tests
  }

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }
}

const { getRedisClientMock } = vi.hoisted(() => ({
  getRedisClientMock: vi.fn(),
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: getRedisClientMock,
}));

function buildMetadata(partial: Partial<SessionMetadata>): SessionMetadata {
  const now = Date.now();

  return {
    sessionId: partial.sessionId ?? 'session-default',
    userId: partial.userId ?? 'user-default',
    tenantId: partial.tenantId,
    deviceId: partial.deviceId,
    createdAt: partial.createdAt ?? now,
    lastActivityAt: partial.lastActivityAt ?? now,
    absoluteExpiresAt: partial.absoluteExpiresAt ?? now + 60_000,
    idleExpiresAt: partial.idleExpiresAt ?? now + 60_000,
    securityFlags: partial.securityFlags,
    userAgent: partial.userAgent,
    ipAddress: partial.ipAddress,
    deviceFingerprint: partial.deviceFingerprint,
  };
}

describe('RedisSessionStore bulk session operations', () => {
  let store: RedisSessionStore | null = null;

  beforeEach(() => {
    getRedisClientMock.mockReset();
  });

  afterEach(() => {
    store?.destroy();
    store = null;
  });

  it('invalidates all targeted user sessions', async () => {
    const redis = new InMemoryRedisMock();
    getRedisClientMock.mockResolvedValue(redis);
    store = new RedisSessionStore();
    const sessionStore = store;

    const tenantId = 'tenant-a';
    const userId = 'user-1';

    await sessionStore.set('s1', buildMetadata({ sessionId: 's1', userId, tenantId }));
    await sessionStore.set('s2', buildMetadata({ sessionId: 's2', userId, tenantId }));
    await sessionStore.set('s3', buildMetadata({ sessionId: 's3', userId: 'other-user', tenantId }));

    const count = await sessionStore.invalidateUserSessions(userId, tenantId);

    expect(count).toBe(2);
    await expect(sessionStore.get('s1', tenantId)).resolves.toBeUndefined();
    await expect(sessionStore.get('s2', tenantId)).resolves.toBeUndefined();
    await expect(sessionStore.get('s3', tenantId)).resolves.toMatchObject({ sessionId: 's3' });

    await expect(sessionStore.isSessionRevoked('s1', tenantId)).resolves.toBe(true);
    await expect(sessionStore.isSessionRevoked('s2', tenantId)).resolves.toBe(true);
    await expect(sessionStore.isSessionRevoked('s3', tenantId)).resolves.toBe(false);
  });

  it('continues batch invalidation when some sessions fail to invalidate', async () => {
    const redis = new InMemoryRedisMock();
    getRedisClientMock.mockResolvedValue(redis);
    store = new RedisSessionStore();
    const sessionStore = store;

    const tenantId = 'tenant-a';
    const deviceId = 'device-1';

    await sessionStore.set('d1', buildMetadata({ sessionId: 'd1', userId: 'u1', tenantId, deviceId }));
    await sessionStore.set('d2', buildMetadata({ sessionId: 'd2', userId: 'u2', tenantId, deviceId }));
    await sessionStore.set('d3', buildMetadata({ sessionId: 'd3', userId: 'u3', tenantId, deviceId }));

    const invalidateSpy = vi.spyOn(sessionStore, 'invalidateSession');
    invalidateSpy.mockImplementation(async (sessionId, requestedTenantId, absoluteExpiresAt) => {
      if (sessionId === 'd2') {
        throw new Error('forced invalidate failure');
      }

      await RedisSessionStore.prototype.invalidateSession.call(
        sessionStore,
        sessionId,
        requestedTenantId,
        absoluteExpiresAt
      );
    });

    const count = await sessionStore.invalidateDeviceSessions(deviceId, tenantId);

    expect(count).toBe(2);
    const revokedFlags = await Promise.all([
      sessionStore.isSessionRevoked('d1', tenantId),
      sessionStore.isSessionRevoked('d2', tenantId),
      sessionStore.isSessionRevoked('d3', tenantId),
    ]);
    expect(revokedFlags.filter(Boolean)).toHaveLength(2);
  });

  it('returns same user sessions while fetching session details in bulk', async () => {
    const redis = new InMemoryRedisMock();
    getRedisClientMock.mockResolvedValue(redis);
    store = new RedisSessionStore();
    const sessionStore = store;

    const tenantId = 'tenant-a';
    const userId = 'bulk-user';

    await sessionStore.set('g1', buildMetadata({ sessionId: 'g1', userId, tenantId }));
    await sessionStore.set('g2', buildMetadata({ sessionId: 'g2', userId, tenantId }));
    await sessionStore.set('g3', buildMetadata({ sessionId: 'g3', userId: 'other-user', tenantId }));

    await sessionStore.delete('g2', tenantId);

    const sessions = await sessionStore.getUserSessions(userId, tenantId);
    const sessionIds = sessions.map((session) => session.sessionId).sort();

    expect(sessionIds).toEqual(['g1']);
  });
});
