import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  getUserTenantId,
  verifyTenantExists,
  verifyTenantMembership,
} from '../tenantVerification';

const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('tenantVerification', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('verifies membership from user_tenants when active', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { tenant_id: 'tenant-1', status: 'active' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    await expect(verifyTenantMembership('user-1', 'tenant-1')).resolves.toBe(true);
  });

  it('rejects membership when user_tenants is inactive', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { tenant_id: 'tenant-1', status: 'suspended' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn(),
      };
    });

    await expect(verifyTenantMembership('user-1', 'tenant-1')).resolves.toBe(false);
  });

  it('falls back to legacy organization check when user_tenants lookup fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '42P01' },
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { organization_id: 'tenant-legacy' },
          error: null,
        }),
      };
    });

    await expect(verifyTenantMembership('user-1', 'tenant-legacy')).resolves.toBe(true);
  });

  it('returns active tenant from user_tenants for getUserTenantId', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { tenant_id: 'tenant-1' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(getUserTenantId('user-1')).resolves.toBe('tenant-1');
  });

  it('verifies tenant exists via tenants table', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: { id: 'tenant-1', status: 'active' },
            error: null,
          }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    await expect(verifyTenantExists('tenant-1')).resolves.toBe(true);
  });
});
