import { __setEnvSourceForTests } from '@shared/lib/env';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

const redisExists = vi.fn();
const redisSet = vi.fn();
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

function signIncidentContext(env: {
  incidentId: string;
  incidentSeverity: string;
  incidentStartedAt: string;
  incidentCorrelationId: string;
  ttlUntil: string;
  allowedRoutes: string;
  allowedMethods: string;
  signingSecret: string;
}): string {
  return createHmac('sha256', env.signingSecret)
    .update(
      [
        env.incidentId,
        env.incidentSeverity,
        env.incidentStartedAt,
        env.incidentCorrelationId,
        env.ttlUntil,
        env.allowedRoutes,
        env.allowedMethods,
      ].join('|')
    )
    .digest('hex');
}

function signApprovalArtifactToken(params: {
  incidentId: string;
  incidentCorrelationId: string;
  approvedAt: string;
  expiresAt: string;
  signingSecret: string;
  ticketId?: string;
  approvedByPrimary?: string;
  approvedBySecondary?: string;
  approvalJustification?: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      incidentId: params.incidentId,
      incidentCorrelationId: params.incidentCorrelationId,
      approvedAt: params.approvedAt,
      expiresAt: params.expiresAt,
      scope: 'auth-fallback',
      ticketId: params.ticketId ?? params.incidentId,
      approvedByPrimary: params.approvedByPrimary ?? 'security.lead',
      approvedBySecondary: params.approvedBySecondary ?? 'platform.director',
      approvalJustification: params.approvalJustification ?? 'IdP outage mitigation with read-only scope.',
    })
  ).toString('base64url');
  const signature = createHmac('sha256', params.signingSecret).update(payload).digest('hex');
  return `v1.${payload}.${signature}`;
}

describe('verifyAccessToken local fallback policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisExists.mockResolvedValue(0);
    redisSet.mockResolvedValue('OK');
    getRedisClientMock.mockResolvedValue({
      exists: redisExists,
      set: redisSet,
    });
    const now = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    const incidentStartedAt = new Date(Date.now() - 60 * 1000).toISOString();
    const maintenanceWindowStart = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const maintenanceWindowEnd = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    __setEnvSourceForTests({
      ALLOW_LOCAL_JWT_FALLBACK: 'false',
      SUPABASE_JWT_SECRET: 'test-secret',
      SUPABASE_JWT_ISSUER: 'https://issuer.test',
      SUPABASE_JWT_AUDIENCE: 'authenticated',
      AUTH_FALLBACK_EMERGENCY_MODE: 'false',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: now,
      AUTH_FALLBACK_INCIDENT_ID: 'INC-1234',
      AUTH_FALLBACK_INCIDENT_SEVERITY: 'critical',
      AUTH_FALLBACK_INCIDENT_STARTED_AT: incidentStartedAt,
      AUTH_FALLBACK_INCIDENT_CORRELATION_ID: 'CORR-1234',
      AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS: '14400',
      AUTH_FALLBACK_ALLOWED_ROUTES: '/api/test',
      AUTH_FALLBACK_ALLOWED_METHODS: 'GET,HEAD,OPTIONS',
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: signIncidentContext({
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
        incidentStartedAt,
        incidentCorrelationId: 'CORR-1234',
        ttlUntil: now,
        allowedRoutes: '/api/test',
        allowedMethods: 'GET,HEAD,OPTIONS',
        signingSecret: 'incident-signing-secret',
      }),
      AUTH_FALLBACK_INCIDENT_SIGNING_SECRET: 'incident-signing-secret',
      AUTH_FALLBACK_APPROVAL_SIGNING_SECRET: 'approval-signing-secret',
      AUTH_FALLBACK_APPROVAL_TOKEN: signApprovalArtifactToken({
        incidentId: 'INC-1234',
        incidentCorrelationId: 'CORR-1234',
        approvedAt: new Date(Date.now() - 60 * 1000).toISOString(),
        expiresAt: now,
        signingSecret: 'approval-signing-secret',
      }),
      AUTH_FALLBACK_MAINTENANCE_WINDOW_START: maintenanceWindowStart,
      AUTH_FALLBACK_MAINTENANCE_WINDOW_END: maintenanceWindowEnd,
      AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS: '300',
      NODE_ENV: 'production',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const key of [
      'SUPABASE_JWT_SECRET',
      'ALLOW_LOCAL_JWT_FALLBACK',
      'SUPABASE_JWT_ISSUER',
      'SUPABASE_JWT_AUDIENCE',
      'AUTH_FALLBACK_EMERGENCY_MODE',
      'AUTH_FALLBACK_EMERGENCY_TTL_UNTIL',
      'AUTH_FALLBACK_INCIDENT_ID',
      'AUTH_FALLBACK_INCIDENT_SEVERITY',
      'AUTH_FALLBACK_INCIDENT_STARTED_AT',
      'AUTH_FALLBACK_INCIDENT_CORRELATION_ID',
      'AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS',
      'AUTH_FALLBACK_ALLOWED_ROUTES',
      'AUTH_FALLBACK_ALLOWED_METHODS',
      'AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE',
      'AUTH_FALLBACK_INCIDENT_SIGNING_SECRET',
      'AUTH_FALLBACK_APPROVAL_TOKEN',
      'AUTH_FALLBACK_APPROVAL_SIGNING_SECRET',
      'AUTH_FALLBACK_MAINTENANCE_WINDOW_START',
      'AUTH_FALLBACK_MAINTENANCE_WINDOW_END',
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

  it('denies fallback when signed incident context is missing', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: '',
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

  it('denies fallback when emergency route allowlist is missing', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_ALLOWED_ROUTES: '',
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

  it('denies fallback when incident signature does not match context', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: 'invalid-signature',
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

  it('denies emergency fallback when TTL exceeds hard 30-minute safety cap', async () => {
    const ttlUntil = new Date(Date.now() + 31 * 60 * 1000).toISOString();
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_EMERGENCY_TTL_UNTIL: ttlUntil,
      AUTH_FALLBACK_MAX_EMERGENCY_DURATION_SECONDS: '3600',
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: signIncidentContext({
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
        incidentStartedAt: process.env.AUTH_FALLBACK_INCIDENT_STARTED_AT ?? '',
        incidentCorrelationId: 'CORR-1234',
        ttlUntil,
        allowedRoutes: '/api/test',
        allowedMethods: 'GET,HEAD,OPTIONS',
        signingSecret: 'incident-signing-secret',
      }),
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

  it('refuses legacy fallback flag in production unconditionally', async () => {
    __setEnvSourceForTests({
      ALLOW_LOCAL_JWT_FALLBACK: 'true',
      AUTH_FALLBACK_EMERGENCY_MODE: 'false',
      NODE_ENV: 'production',
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
    const ttlUntil = process.env.AUTH_FALLBACK_EMERGENCY_TTL_UNTIL ?? '';
    const incidentStartedAt = process.env.AUTH_FALLBACK_INCIDENT_STARTED_AT ?? '';
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: signIncidentContext({
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
        incidentStartedAt,
        incidentCorrelationId: 'CORR-1234',
        ttlUntil,
        allowedRoutes: '/api/test',
        allowedMethods: 'GET,HEAD,OPTIONS',
        signingSecret: 'incident-signing-secret',
      }),
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
      { expiresIn: '1h' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });

    expect(verified?.user.id).toBe('user-123');
    expect(verified?.session.access_token).toBe(token);
    expect(redisExists).toHaveBeenCalled();
    expect(redisSet).toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledTimes(1);
    expect(auditLog).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'auth.jwt_fallback_request_authenticated_immutable',
      details: expect.objectContaining({
        immutable: true,
        severity: 'critical',
        actorId: 'user-123',
        incidentCorrelationId: 'CORR-1234',
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
      }),
    }));
  });

  it('hard-stops fallback after single-use maintenance window has been consumed', async () => {
    __setEnvSourceForTests({ AUTH_FALLBACK_EMERGENCY_MODE: 'true' });
    redisSet.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

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

    const first = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });
    expect(first?.user.id).toBe('user-123');

    auditLog.mockClear();
    const second = await verifyAccessToken(token, { route: '/api/test', method: 'GET' });
    expect(second).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
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

  it('denies fallback revocation non-authoritative when Redis is unavailable', async () => {
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

  it('denies fallback route when method is non-read-only even for allowlisted route', async () => {
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
      { expiresIn: '5m' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/test', method: 'POST' });

    expect(verified).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('denies fallback when request route is not allowlisted', async () => {
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
      { expiresIn: '5m' },
    );

    const verified = await verifyAccessToken(token, { route: '/api/not-allowlisted', method: 'GET' });

    expect(verified).toBeNull();
    expect(auditLog).not.toHaveBeenCalled();
  });

  it('denies fallback when approval token metadata is malformed', async () => {
    const malformedPayload = Buffer.from(
      JSON.stringify({
        incidentId: 'INC-1234',
        incidentCorrelationId: 'CORR-1234',
        approvedAt: new Date(Date.now() - 60 * 1000).toISOString(),
        expiresAt: process.env.AUTH_FALLBACK_EMERGENCY_TTL_UNTIL,
        scope: 'auth-fallback',
        ticketId: 'INC-9999',
        approvedByPrimary: 'security.lead',
        approvedBySecondary: 'security.lead',
      })
    ).toString('base64url');
    const malformedSig = createHmac('sha256', 'approval-signing-secret').update(malformedPayload).digest('hex');
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_APPROVAL_TOKEN: `v1.${malformedPayload}.${malformedSig}`,
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

  it('denies fallback when approval token signature is malformed', async () => {
    __setEnvSourceForTests({
      AUTH_FALLBACK_EMERGENCY_MODE: 'true',
      AUTH_FALLBACK_APPROVAL_TOKEN: 'v1.badpayload.deadbeef',
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
      AUTH_FALLBACK_INCIDENT_CORRELATION_ID: 'CORR-1234',
      AUTH_FALLBACK_ALLOWED_ROUTES: '/api/test',
      AUTH_FALLBACK_ALLOWED_METHODS: 'GET,HEAD,OPTIONS',
      AUTH_FALLBACK_INCIDENT_SIGNING_SECRET: 'incident-signing-secret',
      AUTH_FALLBACK_APPROVAL_SIGNING_SECRET: 'approval-signing-secret',
      AUTH_FALLBACK_APPROVAL_TOKEN: signApprovalArtifactToken({
        incidentId: 'INC-1234',
        incidentCorrelationId: 'CORR-1234',
        approvedAt: new Date(baseTime.getTime() - 60 * 1000).toISOString(),
        expiresAt: new Date(baseTime.getTime() + 2 * 60 * 1000).toISOString(),
        signingSecret: 'approval-signing-secret',
      }),
      AUTH_FALLBACK_MAINTENANCE_WINDOW_START: new Date(baseTime.getTime() - 60 * 1000).toISOString(),
      AUTH_FALLBACK_MAINTENANCE_WINDOW_END: new Date(baseTime.getTime() + 10 * 60 * 1000).toISOString(),
      AUTH_FALLBACK_MAX_TOKEN_AGE_SECONDS: '300',
      NODE_ENV: 'production',
    });
    __setEnvSourceForTests({
      AUTH_FALLBACK_INCIDENT_CONTEXT_SIGNATURE: signIncidentContext({
        incidentId: 'INC-1234',
        incidentSeverity: 'critical',
        incidentStartedAt: new Date(baseTime.getTime() - 60 * 1000).toISOString(),
        incidentCorrelationId: 'CORR-1234',
        ttlUntil: new Date(baseTime.getTime() + 2 * 60 * 1000).toISOString(),
        allowedRoutes: '/api/test',
        allowedMethods: 'GET,HEAD,OPTIONS',
        signingSecret: 'incident-signing-secret',
      }),
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
