import { describe, expect, it } from 'vitest';

import { tenantContextStorage } from '../../middleware/tenantContext.js';
import { runJobWithTenantContext } from '../tenantContextBootstrap.js';

describe('runJobWithTenantContext', () => {
  it('isolates concurrent worker execution by tenant', async () => {
    const [tenantA, tenantB] = await Promise.all([
      runJobWithTenantContext({ workerName: 'test-worker', tenantId: 'tenant-A' }, async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return tenantContextStorage.getStore()?.tid;
      }),
      runJobWithTenantContext({ workerName: 'test-worker', tenantId: 'tenant-B' }, async () => {
        await new Promise((resolve) => setImmediate(resolve));
        return tenantContextStorage.getStore()?.tid;
      }),
    ]);

    expect(tenantA).toBe('tenant-A');
    expect(tenantB).toBe('tenant-B');
  });

  it('throws when tenant context is missing', async () => {
    await expect(
      runJobWithTenantContext({ workerName: 'test-worker', tenantId: '' }, async () => 'ok'),
    ).rejects.toThrow('job payload missing tenant context');
  });
});
