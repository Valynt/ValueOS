import { readFileSync } from 'node:fs';

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

describe('Worker classification guardrails', () => {
  const workerFiles = [
    {
      path: '../AlertingRulesWorker.ts',
      expectedClassifications: ['explicit-cross-tenant-safe'],
    },
    {
      path: '../crmWorker.ts',
      expectedClassifications: [
        'tenant-context-restored',
        'tenant-context-restored',
        'tenant-context-restored',
      ],
    },
    {
      path: '../mcpIntegrationWorker.ts',
      expectedClassifications: ['tenant-context-restored', 'tenant-context-restored'],
    },
  ] as const;

  it('requires every new Worker(...) to declare a classification status marker', () => {
    for (const workerFile of workerFiles) {
      const source = readFileSync(new URL(workerFile.path, import.meta.url), 'utf8');
      const constructorCount = (source.match(/new\s+Worker\s*\(/g) ?? []).length;
      const statusMarkers = [
        ...source.matchAll(
          /WORKER_CLASSIFICATION:\s*(tenant-context-restored|explicit-cross-tenant-safe)/g,
        ),
      ].map((match) => match[1]);

      expect(constructorCount).toBe(workerFile.expectedClassifications.length);
      expect(statusMarkers).toEqual(workerFile.expectedClassifications);
    }
  });

  it('enforces tenant-context-restored workers to bootstrap ALS context', () => {
    for (const workerFile of workerFiles) {
      const source = readFileSync(new URL(workerFile.path, import.meta.url), 'utf8');
      const includesTenantContextRestored = workerFile.expectedClassifications.includes('tenant-context-restored');

      if (!includesTenantContextRestored) {
        continue;
      }

      expect(source).toMatch(/tenantContextStorage\.run\(|runJobWithTenantContext\(/);
    }
  });
});
