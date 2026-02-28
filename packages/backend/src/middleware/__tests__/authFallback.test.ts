import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { __setEnvSourceForTests } from '@shared/lib/env';

const redisExists = vi.fn();
const auditLog = vi.fn().mockResolvedValue({ id: 'audit-id' });

vi.mock('@shared/lib/supabase', () => ({
  getSupabaseClient: vi.fn(() => {
    throw new Error('supabase unavailable');
  }),
  createRequestSupabaseClient: vi.fn(),
  getRequestSupabaseClient: vi.fn(),
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn(async () => ({
    exists: redisExists,
  })),
}));

vi.mock('../../services/AuditLogService.js', () => ({
  auditLogService: {
    logAudit: auditLog,
  },
}));

const { verifyAccessToken } = await import('../auth');

describe('verifyAccessToken local fallback policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisExists.mockResolvedValue(0);
    const now = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    __setEnvSourceForTests({
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_JWT_ISSUER: 'https://issuer.test',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      AUTH_FALLBACK_EMERGENCY_MODE: 'false',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: now,
      NODE_ENV: 'production',
    });
  });

  afterEach(() => {
    for (const key of [
      'SUPABASE_JWT_SECRET',
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWT_AUDIENCE',
      'AUTH_FALLBACK_EMERGENCY_MODE',
      'AUTH_FALLBACK_EMERGENCY_TTL_UNTIL',
      'ALLOW_LOCAL_JWT_FALLBACK',
      'NODE_ENV',
    ]) {
      delete process.env[key];
    }
  });

  it('does not use local JWT verification unless emergency mode is enabled in non-dev', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        iss: 'https://issuer.test',
        aud: 'authenticated',
        tenant_id: 'tenant-123',
      },
      'test-secret',
      { expiresIn: '1h' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });

    expect(verified).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('allows local JWT verification only in explicit emergency mode with strict checks', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'true' });

    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        iss: 'https://issuer.test',
        aud: 'authenticated',
        tenant_id: 'tenant-123',
        jti: 'jti-123',
      },
      'test-secret',
      { expiresIn: '1h' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });

    expect(verified?.user.id).toBe('user-123');
    expect(verified?.session.access_token).toBe(token);
    expect(redisExists).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalled();
  });

  it('rejects fallback tokens with missing tenant claim', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'true' });

    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        iss: 'https://issuer.test',
        aud: 'authenticated',
      },
      'test-secret',
      { expiresIn: '1h' },
    );

    const verified = await verifyAccessToken(token);

    expect(verified).toBeNull();
  });

  it('rejects revoked tokens when denylist has matching identifier', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'true' });
    redisExists.mockResolvedValue(1);

    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        iss: 'https://issuer.test',
        aud: 'authenticated',
        tenant_id: 'tenant-123',
        jti: 'revoked-jti',
      },
      'test-secret',
      { expiresIn: '1h' },
    );

    const verified = await verifyAccessToken(token);

    expect(verified).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });
});
