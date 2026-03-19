import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JwtPayload } from 'jsonwebtoken';

const mockSessionStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  updateActivity: vi.fn(),
  invalidateSession: vi.fn(),
  isSessionRevoked: vi.fn(),
};

const mockVerifyAccessToken = vi.fn();

vi.mock('../auth.js', () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

vi.mock('../../security/RedisSessionStore.js', () => ({
  getSessionStore: () => mockSessionStore,
}));

describe('sessionTimeoutMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStore.get.mockResolvedValue(undefined);
    mockSessionStore.set.mockResolvedValue(undefined);
    mockSessionStore.delete.mockResolvedValue(undefined);
    mockSessionStore.updateActivity.mockResolvedValue(undefined);
    mockSessionStore.invalidateSession.mockResolvedValue(undefined);
    mockSessionStore.isSessionRevoked.mockResolvedValue(false);
  });

  function buildClaims(overrides: Partial<JwtPayload> = {}): JwtPayload {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return {
      sub: 'user-123',
      iat: nowSeconds - 30,
      exp: nowSeconds + 1800,
      session_id: 'session-123',
      tenant_id: 'tenant-123',
      ...overrides,
    };
  }

  async function buildApp() {
    const { sessionTimeoutMiddleware } = await import('../sessionTimeoutMiddleware.js');
    const app = express();
    app.get('/protected', sessionTimeoutMiddleware, (req, res) => {
      res.json({
        ok: true,
        sessionId: req.sessionId,
        tenantId: req.tenantId,
      });
    });
    return app;
  }

  it('creates shared-store session state from verified claims and updates activity', async () => {
    const claims = buildClaims();
    mockVerifyAccessToken.mockResolvedValue({
      claims,
      user: { id: 'user-123', tenant_id: 'tenant-123' },
      session: {},
    });

    const app = await buildApp();
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token-value');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      sessionId: 'session-123',
      tenantId: 'tenant-123',
    });
    expect(mockSessionStore.get).toHaveBeenCalledWith('session-123', 'tenant-123');
    expect(mockSessionStore.set).toHaveBeenCalledWith(
      'session-123',
      expect.objectContaining({
        sessionId: 'session-123',
        userId: 'user-123',
        tenantId: 'tenant-123',
      })
    );
    expect(mockSessionStore.updateActivity).toHaveBeenCalledWith('session-123', 'tenant-123');
    expect(response.headers['x-session-expires-in']).toBeDefined();
    expect(response.headers['x-session-idle-timeout']).toBe('1800');
  });

  it('rejects sessions that were invalidated in the shared store', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      claims: buildClaims(),
      user: { id: 'user-123', tenant_id: 'tenant-123' },
      session: {},
    });
    mockSessionStore.isSessionRevoked.mockResolvedValue(true);

    const app = await buildApp();
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token-value');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SESSION_REVOKED');
    expect(mockSessionStore.set).not.toHaveBeenCalled();
    expect(mockSessionStore.updateActivity).not.toHaveBeenCalled();
  });

  it('rejects sessions flagged for forced re-authentication', async () => {
    mockVerifyAccessToken.mockResolvedValue({
      claims: buildClaims(),
      user: { id: 'user-123', tenant_id: 'tenant-123' },
      session: {},
    });
    mockSessionStore.get.mockResolvedValue({
      sessionId: 'session-123',
      userId: 'user-123',
      tenantId: 'tenant-123',
      createdAt: Date.now() - 30_000,
      lastActivityAt: Date.now() - 5_000,
      absoluteExpiresAt: Date.now() + 1_800_000,
      idleExpiresAt: Date.now() + 1_800_000,
      securityFlags: {
        forceReauth: true,
      },
    });

    const app = await buildApp();
    const response = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer token-value');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SESSION_REAUTH_REQUIRED');
    expect(mockSessionStore.updateActivity).not.toHaveBeenCalled();
  });
});
