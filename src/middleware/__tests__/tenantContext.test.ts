import { afterEach, describe, expect, it, vi } from 'vitest';
import { tenantContextMiddleware } from '../tenantContext';
import { getUserTenantId, verifyTenantMembership } from '../../lib/tenantVerification';

vi.mock('../../lib/tenantVerification', () => ({
  getUserTenantId: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

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

    await tenantContextMiddleware()(req, res as any, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.tenantId).toBeUndefined();
    expect(getUserTenantId).not.toHaveBeenCalled();
    expect(verifyTenantMembership).not.toHaveBeenCalled();
  });

  it('accepts service header when identity verified and membership valid', async () => {
    (verifyTenantMembership as unknown as { mockResolvedValue: (value: boolean) => void }).mockResolvedValue(true);

    const req = {
      header: vi.fn((name: string) => (name === 'x-tenant-id' ? 'tenant-123' : undefined)),
      params: {},
      serviceIdentityVerified: true,
      user: { id: 'user-123' },
    } as any;
    const res = mockRes();
    const next = vi.fn();

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
});
