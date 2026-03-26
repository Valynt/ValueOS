import { __setEnvSourceForTests } from '@shared/lib/env';
import { createHmac, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const redisExists = vi.fn();
const getRedisClientMock = vi.fn();

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
    logAudit: vi.fn().mockResolvedValue({ id: 'audit-id' }),
  },
}));

const { verifyAccessToken } = await import('../auth');

function createApprovalToken(incidentId: string, signingKey: string, approvedUntil: Date): string {
  const payload = {
    incidentId,
    approvedUntil: approvedUntil.toISOString(),
    issuedAt: new Date(Date.now() - 30_000).toISOString(),
    nonce: randomUUID(),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', signingKey).update(encodedPayload).digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function issueToken(): string {
  return jwt.sign(
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
}

describe('auth fallback integration scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisExists.mockResolvedValue(0);
    getRedisClientMock.mockResolvedValue({ exists: redisExists });

    const signingKey = 'approval-signing-key';
    __setEnvSourceForTests({
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_JWT_ISSUER: 'https://issuer.test',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      AUTH_FALLBACK_INCIDENT_ID: 'INC-1234',
      AUTH_FALLBACK_INCIDENT_SEVERITY: 'critical',
      AUTH_FALLBACK_INCIDENT_STARTED_AT: new Date(Date.now() - 60 * 1000).toISOString(),
      AUTH_FALLBACK_ALLOWED_ROUTES: '/api/health',
      AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS: '300',
      AUTH_FALLBACK_APPROVAL_SIGNING_KEY: signingKey,
      AUTH_FALLBACK_APPROVAL_TOKEN: createApprovalToken('INC-1234', signingKey, new Date(Date.now() + 5 * 60 * 1000)),
      AUTH_FALLBACK_MAINTENANCE_WINDOW_START: new Date(Date.now() - 60 * 1000).toISOString(),
      AUTH_FALLBACK_MAINTENANCE_WINDOW_END: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      NODE_ENV: 'production',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fallback disabled', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'false' });

    const verified = await verifyAccessToken(issueToken(), { route: '/api/health', method: 'GET' });
    expect(verified).toBeNull();
  });

  it('fallback expired', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: new Date(Date.now() - 1_000).toISOString(),
    });

    const verified = await verifyAccessToken(issueToken(), { route: '/api/health', method: 'GET' });
    expect(verified).toBeNull();
  });

  it('fallback route denied', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_ALLOWED_ROUTES: '/api/admin/users' });

    const verified = await verifyAccessToken(issueToken(), { route: '/api/admin/users', method: 'GET' });
    expect(verified).toBeNull();
  });

  it('fallback revocation non-authoritative', async () => {
    getRedisClientMock.mockResolvedValue({
      exists: vi.fn().mockRejectedValue(new Error('redis down')),
    });

    const verified = await verifyAccessToken(issueToken(), { route: '/api/health', method: 'GET' });
    expect(verified).toBeNull();
  });
});
