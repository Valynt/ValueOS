import { __setEnvSourceForTests } from '@shared/lib/env';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisExists = vi.fn();
const getRedisClientMock = vi.fn();
const auditLog = vi.fn().mockResolvedValue({ id: 'audit-id' });

vi.mock('../../lib/supabase.js', () => ({
  createServiceRoleSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockRejectedValue(new Error('supabase unavailable')),
    },
  })),
  createRequestRlsSupabaseClient: vi.fn(),
  createRequestSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(() => ({
    rpc: vi.fn().mockResolvedValue({ error: null }),
    from: vi.fn(),
  })),
  getSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockRejectedValue(new Error('supabase unavailable')),
    },
  })),
  supabase: null,
}));

vi.mock('../../services/auth/AuthService.js', () => ({
  authService: {
    getSession: vi.fn(),
  },
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: getRedisClientMock,
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
    getRedisClientMock.mockResolvedValue({
      exists: redisExists,
    });
    const now = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    __setEnvSourceForTests({
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_JWT_ISSUER: 'https://issuer.test',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      AUTH_FALLBACK_EMERGENCY_MODE: 'false',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: now,
      AUTH_FALLBACK_INCIDENT_ID: 'INC-1234',
      AUTH_FALLBACK_INCIDENT_SEVERITY: 'critical',
      AUTH_FALLBACK_INCIDENT_STARTED_AT: new Date(Date.now() - 60 * 1000).toISOString(),
      AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS: '14400',
      AUTH_FALLBACK_ALLOWED_ROUTES: '/api/test',
      AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS: '300',
      NODE_ENV: 'production',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const key of [
      'SUPABASE_JWT_SECRET',
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWT_AUDIENCE',
      'AUTH_FALLBACK_EMERGENCY_MODE',
      'AUTH_FALLBACK_EMERGENCY_TTL_UNTIL',
      'AUTH_FALLBACK_INCIDENT_ID',
      'AUTH_FALLBACK_INCIDENT_SEVERITY',
      'AUTH_FALLBACK_INCIDENT_STARTED_AT',
      'AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS',
      'AUTH_FALLBACK_ALLOWED_ROUTES',
      'AUTH_FALLBACK_ALLOWED_ROLES',
      'AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS',
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


  it('denies fallback when emergency TTL is missing', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: '',
    });

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

  it('denies fallback when emergency TTL is expired', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: new Date(Date.now() - 60_000).toISOString(),
    });

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

  it('denies fallback when incident metadata is missing', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_INCIDENT_ID: '',
    });

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

  it('denies fallback when emergency route or role allowlist is missing', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_ALLOWED_ROUTES: '',
      AUTH_FALLBACK_ALLOWED_ROLES: '',
    });

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

  it('denies fallback when emergency TTL exceeds max allowed duration', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
      AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS: '3600',
    });

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
    expect(auditLog).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'auth.jwt_fallback_activated',
      details: expect.objectContaining({
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
      }),
    }));
    expect(auditLog).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: 'auth.jwt_fallback_high_severity_alert',
      details: expect.objectContaining({
        severity: 'high',
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
      }),
    }));
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

  it('fails closed when Supabase and Redis are both unavailable during emergency fallback', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'true' });
    getRedisClientMock.mockResolvedValue(null);

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
      { expiresIn: '5m' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });

    expect(verified).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('expires emergency fallback access after the incident TTL passes', async () => {
    vi.useFakeTimers();
    const baseTime = new Date('2026-03-21T10:00:00.000Z');
    vi.setSystemTime(baseTime);

    __setEnvSourceForTests({
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_JWT_ISSUER: 'https://issuer.test',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: new Date(baseTime.getTime() + 2 * 60 * 1000).toISOString(),
      AUTH_FALLBACK_INCIDENT_ID: 'INC-1234',
      AUTH_FALLBACK_INCIDENT_SEVERITY: 'critical',
      AUTH_FALLBACK_INCIDENT_STARTED_AT: new Date(baseTime.getTime() - 60 * 1000).toISOString(),
      AUTH_FALLBACK_ALLOWED_ROUTES: '/api/test',
      AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS: '300',
      NODE_ENV: 'production',
    });

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
      { expiresIn: '5m' },
    );

    const beforeExpiry = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });
    expect(beforeExpiry?.user.id).toBe('user-123');

    auditLog.mockClear();
    vi.setSystemTime(new Date(baseTime.getTime() + 3 * 60 * 1000));

    const afterExpiry = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });
    expect(afterExpiry).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
