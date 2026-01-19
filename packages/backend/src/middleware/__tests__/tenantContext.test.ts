import { afterEach, describe, expect, it, vi } from 'vitest';
import { tenantContextMiddleware } from '../tenantContext';
import { getUserTenantId, verifyTenantExists, verifyTenantMembership } from '@shared/lib/tenantVerification';

<<<<<<< HEAD
vi.mock('../../lib/tenantVerification', () => ({
=======
const tenantVerificationMocks = vi.hoisted(() => ({
>>>>>>> 7823d3dee5da3de0b12c5c68a37810dc04000075
  getUserTenantId: vi.fn(),
  verifyTenantExists: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));
<<<<<<< HEAD
=======

vi.mock('@shared/lib/tenantVerification', () => tenantVerificationMocks);

const ORIGINAL_ENV = { ...process.env };
>>>>>>> 7823d3dee5da3de0b12c5c68a37810dc04000075

function mockRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
}

describe('tenantContextMiddleware', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('allows requests with no user and no tenant candidate', async () => {
    const req = {
      header: vi.fn(() => undefined),
      params: {},
    } as any;
    const res = mockRes();
    const next = vi.fn();

    tenantVerificationMocks.verifyTenantExists.mockResolvedValue(true);
    tenantVerificationMocks.verifyTenantMembership.mockResolvedValue(true);

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
    expect(getUserTenantId).not.toHaveBeenCalled();
    expect(verifyTenantMembership).not.toHaveBeenCalled();
  });

  it('accepts service header when identity verified and membership valid', async () => {
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);
    (verifyTenantMembership as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);

    const req = {
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-123' : undefined)),
      params: {},
      serviceIdentityVerified: true,
      user: { id: 'user-123' },
    } as any;
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
    const req = {
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-spoof' : undefined)),
      params: {},
      user: { id: 'user-999' },
    } as any;
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

    const req = {
      header: vi.fn(() => undefined),
      params: {},
      user: { id: 'user-222', tenant_id: 'tenant-222' },
    } as any;
    const res = mockRes();
    const next = vi.fn();

    await tenantContextMiddleware()(req, res as any, next);

    expect(verifyTenantMembership).toHaveBeenCalledWith('user-222', 'tenant-222');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'User does not belong to tenant.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to user tenant lookup when no candidate provided', async () => {
    (getUserTenantId as unknown as { mockResolvedValue: (value: string) => void }).mockResolvedValue('tenant-lookup');
    (verifyTenantExists as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);

    const req = {
      header: vi.fn(() => undefined),
      params: {},
      user: { id: 'user-789' },
    } as any;
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

    const req = {
      header: vi.fn(() => undefined),
      params: {},
      user: { id: 'user-222', tenant_id: 'tenant-unknown' },
    } as any;
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
