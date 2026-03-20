import { describe, expect, it, vi, beforeEach } from 'vitest';
import { assertTenantMembership, TenantSecurityError } from './tenantVerification';

// Because assertTenantMembership calls verifyTenantMembership directly within the same module,
// we must mock the underlying dependencies (Supabase) to control the behavior of verifyTenantMembership.

const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn().mockReturnThis();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn().mockReturnThis();
const mockLimit = vi.fn().mockReturnThis();

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      maybeSingle: mockMaybeSingle,
      single: mockSingle,
      order: mockOrder,
      limit: mockLimit,
    })),
  },
}));

vi.mock('./logger.js', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('assertTenantMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves without throwing when the user belongs to the tenant', async () => {
    // verifyTenantMembership mock: Supabase user_tenants returns active membership
    mockMaybeSingle.mockResolvedValueOnce({
      data: { tenant_id: 'tenant-1', status: 'active' },
      error: null,
    });

    await expect(assertTenantMembership('user-1', 'tenant-1')).resolves.toBeUndefined();
  });

  it('throws TenantSecurityError when user does not belong to the tenant', async () => {
    // verifyTenantMembership mock
    // 1st call: user_tenants check -> fails (e.g. not found)
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });
    // 2nd call: fallback users table check -> fails
    mockSingle.mockResolvedValueOnce({ data: { organization_id: 'tenant-2' }, error: null });

    // getUserTenantId mock
    // 3rd call: user_tenants check -> succeeds returning 'tenant-2'
    mockMaybeSingle.mockResolvedValueOnce({ data: { tenant_id: 'tenant-2', status: 'active' }, error: null });

    const err = await assertTenantMembership('user-1', 'tenant-1').catch(e => e);

    expect(err).toBeInstanceOf(TenantSecurityError);
    expect(err.userId).toBe('user-1');
    expect(err.requestedTenantId).toBe('tenant-1');
    expect(err.userTenantId).toBe('tenant-2');
    expect(err.message).toBe('User *** does not belong to tenant tenant-1');
  });

  it('throws TenantSecurityError without userTenantId when getUserTenantId fails', async () => {
    // verifyTenantMembership mock
    // 1st call: user_tenants check -> fails
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });
    // 2nd call: fallback users table check -> fails
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });

    // getUserTenantId mock
    // 3rd call: user_tenants check -> fails
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });
    // 4th call: fallback users table check -> fails
    mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });

    const err = await assertTenantMembership('user-1', 'tenant-1').catch(e => e);

    expect(err).toBeInstanceOf(TenantSecurityError);
    expect(err.userId).toBe('user-1');
    expect(err.requestedTenantId).toBe('tenant-1');
    expect(err.userTenantId).toBeUndefined();
    expect(err.message).toBe('User *** does not belong to tenant tenant-1');
  });
});
