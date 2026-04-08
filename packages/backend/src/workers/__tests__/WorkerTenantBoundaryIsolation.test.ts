import { describe, expect, it } from 'vitest';

import { tenantContextStorage } from '../../middleware/tenantContext.js';
import { resolveTenantContextId, runJobWithTenantContext } from '../tenantContextBootstrap.js';

describe('Worker tenant boundary isolation', () => {
  it('rejects jobs when tenantId and organizationId disagree', () => {
    expect(() =>
      resolveTenantContextId({
        workerName: 'tenant-boundary-worker',
        tenantId: 'tenant-A',
        organizationId: 'tenant-B',
      }),
    ).toThrow('tenant context mismatch');
  });

  it('uses matching tenant identity when both values are present', () => {
    expect(
      resolveTenantContextId({
        workerName: 'tenant-boundary-worker',
        tenantId: 'tenant-shared',
        organizationId: 'tenant-shared',
      }),
    ).toBe('tenant-shared');
  });

  it('does not allow ambient tenant context to override job payload tenant', async () => {
    const observedTenant = await tenantContextStorage.run(
      {
        iss: 'worker',
        sub: 'worker',
        tid: 'ambient-tenant',
        roles: [],
        tier: 'worker',
        exp: 0,
      },
      async () =>
        runJobWithTenantContext(
          {
            workerName: 'tenant-boundary-worker',
            tenantId: 'payload-tenant',
            organizationId: 'payload-tenant',
          },
          async () => tenantContextStorage.getStore()?.tid,
        ),
    );

    expect(observedTenant).toBe('payload-tenant');
    expect(observedTenant).not.toBe('ambient-tenant');
  });
});
