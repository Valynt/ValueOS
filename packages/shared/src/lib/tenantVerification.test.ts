import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assertTenantMembership, TenantSecurityError } from './tenantVerification';

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
    mockMaybeSingle.mockResolvedValueOnce({
      data: { tenant_id: 'tenant-1', status: 'active' },
      error: null,
    });

    await expect(assertTenantMembership('user-1', 'tenant-1')).resolves.toBeUndefined();
  });

  it('throws TenantSecurityError when user does not belong to the tenant', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });
    mockSingle.mockResolvedValueOnce({ data: { organization_id: 'tenant-2' }, error: null });
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'not_found' } });

    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toBeInstanceOf(TenantSecurityError);
  });

  it('throws TenantSecurityError when membership lookup errors out', async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error('db exploded'));

    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toBeInstanceOf(TenantSecurityError);
  });
});
