import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentTenantContext, tenantContextMiddleware } from '../tenantContext.js'
import { getUserTenantId, verifyTenantExists, verifyTenantMembership } from '@shared/lib/tenantVerification';

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

function buildReq(overrides: Record<string, unknown>) {
  return {
    headers: {},
    header: vi.fn(() => undefined),
    params: {},
    ...overrides,
  } as any;
}

describe('tenantContextMiddleware', () => {
  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('allows requests with no user and no tenant candidate', async () => {
    const req = buildReq({});
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware(false)(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
    expect(getUserTenantId).not.toHaveBeenCalled();
    expect(verifyTenantMembership).not.toHaveBeenCalled();
  });

  it('accepts service header when identity verified and membership valid', async () => {
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);
    (verifyTenantMembership as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);

    const req = buildReq({
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-123' : undefined)),
      serviceIdentityVerified: true,
      user: { id: 'user-123' },
    });
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantMembership).toHaveBeenCalledWith('user-123', 'tenant-123');
    expect(req.tenantId).toBe('tenant-123');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks tenant header when service identity is not verified', async () => {
    const req = buildReq({
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-spoof' : undefined)),
      user: { id: 'user-999' },
    });
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Tenant header is restricted to internal service requests.',
    });
    expect(next).not.toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
    expect(verifyTenantMembership).not.toHaveBeenCalled();
  });

  it('requires tenant membership verification for user tenants', async () => {
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);
    (verifyTenantMembership as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(false);

    const req = buildReq({
      user: { id: 'user-222', tenant_id: 'tenant-222' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantMembership).toHaveBeenCalledWith('user-222', 'tenant-222');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Resource not found.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to user tenant lookup when no candidate provided', async () => {
    (getUserTenantId as unknown as { mockResolvedValue: (value: string) => void }).mockResolvedValue('tenant-lookup');
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);
    (verifyTenantMembership as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);

    const req = buildReq({
      user: { id: 'user-789' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(getUserTenantId).toHaveBeenCalledWith('user-789');
    expect(req.tenantId).toBe('tenant-lookup');
    expect(req.tenantSource).toBe('user-lookup');
    expect(next).toHaveBeenCalled();
  });

  it('rejects requests for unknown tenants', async () => {
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(false);

    const req = buildReq({
      user: { id: 'user-222', tenant_id: 'tenant-unknown' },
    });
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantExists).toHaveBeenCalledWith('tenant-unknown');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Tenant not found or inactive.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when user metadata claims another tenant', async () => {
    process.env.NODE_ENV = 'test';
    process.env.TCT_SECRET = 'test-secret';

    const { tenantContextMiddleware } = await import('../tenantContext');

    const req = buildReq({
      user: {
        id: 'user-123',
        tenant_id: 'tenant-999',
        user_metadata: { tenant_id: 'tenant-999' },
      },
    });
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(false);

    await tenantContextMiddleware()(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Not Found',
      message: 'Resource not found.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('binds tenant context from user claims', async () => {
    const req = buildReq({
      user: { id: 'user-555', tenant_id: 'tenant-555', role: 'admin' },
      session: { expires_at: 1712345678 },
    });
    const res = mockRes();
    const next = vi.fn(() => {
      const context = getCurrentTenantContext();
      expect(context?.tid).toBe('tenant-555');
      expect(context?.sub).toBe('user-555');
      expect(context?.roles).toEqual(['admin']);
    });

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
