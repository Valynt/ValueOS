import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

import { supabase } from './supabase.js';
import { assertTenantMembership, TenantSecurityError } from './tenantVerification.js';

describe('assertTenantMembership', () => {
  const mockFrom = supabase.from as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve if user belongs to tenant', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { tenant_id: 'tenant-1', status: 'active' },
        error: null
      })
    });

    await expect(assertTenantMembership('user-1', 'tenant-1')).resolves.toBeUndefined();
  });

  it('should throw TenantSecurityError if user does not belong to tenant (no fallback)', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null
      }),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null
      })
    });

    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toThrow(TenantSecurityError);
    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toMatchObject({
      userId: 'user-1',
      requestedTenantId: 'tenant-1',
      userTenantId: undefined
    });
  });

  it('should throw TenantSecurityError containing userTenantId if user belongs to another tenant', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        };
      }
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { organization_id: 'tenant-2' },
            error: null
          })
        };
      }
    });

    // In this scenario, the user doesn't belong to 'tenant-1' because 'user_tenants' is empty,
    // and the fallback 'users' table says they belong to 'tenant-2'.
    // `verifyTenantMembership` returns false.
    // `getUserTenantId` fetches their organization_id from 'users' and returns 'tenant-2'.

    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toThrow(TenantSecurityError);
    await expect(assertTenantMembership('user-1', 'tenant-1')).rejects.toMatchObject({
      userId: 'user-1',
      requestedTenantId: 'tenant-1',
      userTenantId: 'tenant-2'
    });
  });
});
