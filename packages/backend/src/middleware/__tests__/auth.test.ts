import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import { __setEnvSourceForTests } from '@shared/lib/env';

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

const { requireAuth } = await import('../auth');
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
