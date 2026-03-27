import { describe, expect, it } from 'vitest';

import { TenantCache } from '../TenantCache.js';

describe('TenantCache key enforcement', () => {
  const cache = new TenantCache(30);

  it('builds distinct user profile keys per tenant', () => {
    const keyA = cache.buildUserProfileKey('tenant-a', 'user-1');
    const keyB = cache.buildUserProfileKey('tenant-b', 'user-1');

    expect(keyA).not.toBe(keyB);
    expect(keyA).toContain('tenant:tenant-a');
    expect(keyB).toContain('tenant:tenant-b');
  });

  it('fails closed when a cache key omits tenant prefix', async () => {
    await expect(cache.get('profile:user-1')).rejects.toThrow('TenantCache key must include tenant scope prefix');
  });
});
