/**
 * Tests for requireMFA in middleware/auth.ts.
 *
 * Regression coverage for the bug where amr was read from req.session (an
 * AuthSession object with no amr field) instead of from the decoded JWT
 * payload, causing mfaVerified to always be false.
 */
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── shared mocks ────────────────────────────────────────────────────────────

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@shared/lib/supabase', () => ({
  createRequestSupabaseClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  getRequestSupabaseClient: vi.fn(),
  getSupabaseClient: vi.fn(),
  supabase: null,
}));

vi.mock('../../services/auth/AuthService.js', () => ({
  authService: { getSession: vi.fn() },
}));

vi.mock('@shared/lib/redisClient', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/security/AuditLogService.js', () => ({
  auditLogService: { logAudit: vi.fn().mockResolvedValue({ id: 'audit-id' }) },
}));

const mfaServiceMock = { isMFAEnabled: vi.fn() };
vi.mock('../../services/auth/MFAService.js', () => ({
  mfaService: mfaServiceMock,
}));

// ── helpers ─────────────────────────────────────────────────────────────────

/** Build a JWT with the given amr claim (unsigned — jwt.decode doesn't verify). */
function buildToken(amr?: Array<{ method: string; timestamp: number }>) {
  const payload: Record<string, unknown> = { sub: 'user-1', exp: 9999999999 };
  if (amr !== undefined) payload.amr = amr;
  // Sign with a dummy secret; requireMFA only calls jwt.decode (no verification).
  return jwt.sign(payload, 'test-secret');
}

function mockReq(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1' },
    session: undefined as unknown,
    ...overrides,
  };
}

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

// ── import after mocks ───────────────────────────────────────────────────────

const { requireMFA } = await import('../auth.js');

// ── tests ────────────────────────────────────────────────────────────────────

describe('requireMFA (auth.ts)', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no authenticated user', async () => {
    const req = mockReq({ user: undefined });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when MFA is not enrolled', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(false);
    const req = mockReq();
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when MFA enrolled but session has no access_token', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(true);
    const req = mockReq({ session: undefined });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when MFA enrolled but JWT has no amr claim', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(true);
    const req = mockReq({ session: { access_token: buildToken(/* no amr */) } });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when amr contains only password method', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(true);
    const token = buildToken([{ method: 'password', timestamp: 1 }]);
    const req = mockReq({ session: { access_token: token } });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when amr contains totp', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(true);
    const token = buildToken([
      { method: 'password', timestamp: 1 },
      { method: 'totp', timestamp: 2 },
    ]);
    const req = mockReq({ session: { access_token: token } });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when amr contains webauthn', async () => {
    mfaServiceMock.isMFAEnabled.mockResolvedValue(true);
    const token = buildToken([{ method: 'webauthn', timestamp: 1 }]);
    const req = mockReq({ session: { access_token: token } });
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when MFAService throws', async () => {
    mfaServiceMock.isMFAEnabled.mockRejectedValue(new Error('db error'));
    const req = mockReq();
    const res = mockRes();
    await requireMFA(req as never, res as never, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
