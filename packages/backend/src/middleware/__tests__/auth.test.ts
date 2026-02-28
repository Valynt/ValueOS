import { __setEnvSourceForTests } from '@shared/lib/env';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/AuthService', () => ({
  authService: {
    getSession: vi.fn(),
  },
}));

vi.mock('../../lib/supabase', () => ({
  createRequestSupabaseClient: vi.fn(),
  getRequestSupabaseClient: vi.fn(),
  getSupabaseClient: vi.fn(),
}));

const logAudit = vi.fn().mockResolvedValue({ id: 'audit-id' });

vi.mock('../../services/AuditLogService.js', () => ({
  auditLogService: {
    logAudit,
  },
}));

const { requireAuth, requireTenantRequestAlignment } = await import('../auth');
const { requirePermission } = await import('../rbac');
const { authService } = await import('../../services/AuthService');
const { createRequestSupabaseClient, getRequestSupabaseClient, getSupabaseClient } =
  await import('../../lib/supabase');

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('auth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setEnvSourceForTests({ SUPABASE_JWT_SECRET: 'test-secret' });
    (getSupabaseClient as unknown as { mockImplementation: (_fn: () => never) => void }).mockImplementation(() => {
      throw new Error('supabase unavailable');
    });
    (createRequestSupabaseClient as unknown as { mockImplementation: (_fn: () => {}) => void }).mockImplementation(
      (req: any) => {
        req.supabase = {};
        return req.supabase;
      }
    );
  });

  afterEach(() => {
    __setEnvSourceForTests({});
  });

  it('accepts a valid bearer token and populates req.user', async () => {
    const token = jwt.sign(
      {
        sub: 'user-123',
        email: 'user@example.com',
        role: 'member',
        organization_id: 'tenant-abc',
      },
      'test-secret',
      { expiresIn: '1h' }
    );

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('user-123');
    expect(req.user.tenant_id).toBe('tenant-abc');
    expect(req.session.access_token).toBe(token);
  });

  it('rejects an invalid bearer token with 401', async () => {
    const token = jwt.sign({ sub: 'user-123' }, 'wrong-secret', { expiresIn: '1h' });

    const req = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects missing tokens with 401', async () => {
    (authService.getSession as unknown as { mockResolvedValue: (_value: null) => void }).mockResolvedValue(null);

    const req = {
      headers: {},
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await requireAuth(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('permission middleware', () => {
  it('returns 403 when permission checks fail', async () => {
    const supabase = {
      from: vi.fn((table: string) => {
        const result = { data: [], error: null };
        const eqTotal = table === 'user_roles' ? 2 : 3;
        let eqCount = 0;
        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn(() => {
            eqCount += 1;
            if (eqCount >= eqTotal) {
              return Promise.resolve(result);
            }
            return chain;
          }),
        };
        return chain;
      }),
    };

    (getRequestSupabaseClient as unknown as { mockReturnValue: (_value: typeof supabase) => void }).mockReturnValue(
      supabase
    );

    const req = {
      user: { id: 'user-123', tenant_id: 'tenant-abc' },
      headers: {},
      path: '/api/agents',
      method: 'GET',
    } as any;
    const res = mockRes();
    const next = vi.fn();

    const middleware = requirePermission('agents.execute');
    await middleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireTenantRequestAlignment middleware', () => {
  it('allows request when token tenant and requested tenant match', async () => {
    const middleware = requireTenantRequestAlignment();
    const req = {
      user: { id: 'user-123', tenant_id: 'tenant-123' },
      headers: { 'x-tenant-id': 'tenant-123' },
      params: {},
      query: {},
      body: {},
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-123' : undefined)),
      method: 'POST',
      path: '/api/agents/execute',
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(logAudit).not.toHaveBeenCalled();
  });

  it('rejects request when tenant context is missing from request', async () => {
    const middleware = requireTenantRequestAlignment();
    const req = {
      user: { id: 'user-123', tenant_id: 'tenant-123', email: 'user@example.com' },
      headers: {},
      params: {},
      query: {},
      body: {},
      header: vi.fn(() => undefined),
      method: 'POST',
      path: '/api/agents/execute',
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tenant_required',
      message: 'Requested tenant context is required.',
    });
    expect(next).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.tenant_guard_rejected',
        status: 'failed',
        details: expect.objectContaining({ reason: 'requested_tenant_missing' }),
      })
    );
  });

  it('rejects request when token tenant and requested tenant mismatch', async () => {
    const middleware = requireTenantRequestAlignment();
    const req = {
      user: { id: 'user-123', tenant_id: 'tenant-a', email: 'user@example.com' },
      headers: {},
      params: { tenantId: 'tenant-b' },
      query: {},
      body: {},
      header: vi.fn(() => undefined),
      method: 'POST',
      path: '/api/agents/execute',
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tenant_mismatch',
      message: 'Requested tenant does not match authenticated tenant.',
    });
    expect(next).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          reason: 'tenant_mismatch',
          tokenTenantId: 'tenant-a',
          requestedTenantId: 'tenant-b',
        }),
      })
    );
  });

  it('rejects request when authenticated token has no tenant', async () => {
    const middleware = requireTenantRequestAlignment();
    const req = {
      user: { id: 'user-123', email: 'user@example.com' },
      headers: { 'x-tenant-id': 'tenant-a' },
      params: {},
      query: {},
      body: {},
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-a' : undefined)),
      method: 'POST',
      path: '/api/agents/execute',
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'tenant_forbidden',
      message: 'Authenticated token must include tenant context.',
    });
    expect(next).not.toHaveBeenCalled();
    expect(logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ reason: 'token_tenant_missing' }),
      })
    );
  });
});
