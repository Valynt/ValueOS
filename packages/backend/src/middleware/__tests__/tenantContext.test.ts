import { afterEach, describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const tenantVerificationMocks = vi.hoisted(() => ({
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock('@shared/lib/tenantVerification', () => tenantVerificationMocks);

const ORIGINAL_ENV = { ...process.env };

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('tenantContextMiddleware', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('passes when token context matches request context', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-secret';

    const { tenantContextMiddleware } = await import('../tenantContext');
    const token = jwt.sign(
      {
        iss: 'issuer',
        sub: 'user-123',
        tid: 'tenant-123',
        roles: [],
        tier: 'pro',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      process.env.TCT_SECRET
    );

    const req = {
      headers: {
        'x-tenant-context': token,
      },
      tenantId: 'tenant-123',
      user: { id: 'user-123' },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects when token tenant does not match request tenant', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-secret';

    const { tenantContextMiddleware } = await import('../tenantContext');
    const token = jwt.sign(
      {
        iss: 'issuer',
        sub: 'user-123',
        tid: 'tenant-999',
        roles: [],
        tier: 'pro',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      process.env.TCT_SECRET
    );

    const req = {
      headers: {
        'x-tenant-context': token,
      },
      tenantId: 'tenant-123',
      user: { id: 'user-123' },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant context mismatch' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when token user does not match request user', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-secret';

    const { tenantContextMiddleware } = await import('../tenantContext');
    const token = jwt.sign(
      {
        iss: 'issuer',
        sub: 'user-999',
        tid: 'tenant-123',
        roles: [],
        tier: 'pro',
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      process.env.TCT_SECRET
    );

    const req = {
      headers: {
        'x-tenant-context': token,
      },
      tenantId: 'tenant-123',
      user: { id: 'user-123' },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Tenant context mismatch' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects startup in production when TCT_SECRET is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TCT_SECRET;

    const { tenantContextMiddleware } = await import('../tenantContext');

    expect(() => tenantContextMiddleware()).toThrow(
      'TCT_SECRET must be configured and cannot use the default placeholder in production'
    );
  });

  it('rejects when user metadata claims another tenant', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-secret';

    const { tenantContextMiddleware } = await import('../tenantContext');

    const req = {
      headers: {},
      user: {
        id: 'user-123',
        tenant_id: 'tenant-999',
        user_metadata: { tenant_id: 'tenant-999' },
      },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(false);

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'User does not belong to tenant.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
