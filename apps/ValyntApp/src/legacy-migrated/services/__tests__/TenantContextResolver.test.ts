import { describe, expect, it, vi } from 'vitest';

import { TenantContextResolver } from '../TenantContextResolver';

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('TenantContextResolver', () => {
  describe('hasTenantAccess', () => {
    it('returns true when the tenant is in the user tenant list', async () => {
      const resolver = new TenantContextResolver();
      const getUserTenantsSpy = vi
        .spyOn(resolver as any, 'getUserTenants')
        .mockResolvedValue(['tenant-a', 'tenant-b']);

      await expect(
        resolver.hasTenantAccess('user-1', 'tenant-b')
      ).resolves.toBe(true);
      expect(getUserTenantsSpy).toHaveBeenCalledWith('user-1');
    });

    it('returns false when the tenant is not in the user tenant list', async () => {
      const resolver = new TenantContextResolver();
      vi.spyOn(resolver as any, 'getUserTenants').mockResolvedValue([
        'tenant-a',
        'tenant-c',
      ]);

      await expect(
        resolver.hasTenantAccess('user-2', 'tenant-b')
      ).resolves.toBe(false);
    });

    it('returns false when getUserTenants throws', async () => {
      const resolver = new TenantContextResolver();
      vi.spyOn(resolver as any, 'getUserTenants').mockRejectedValue(
        new Error('supabase failure')
      );

      await expect(
        resolver.hasTenantAccess('user-3', 'tenant-a')
      ).resolves.toBe(false);
    });
  });
});
