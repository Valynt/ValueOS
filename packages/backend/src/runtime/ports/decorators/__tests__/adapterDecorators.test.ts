import { describe, expect, it } from 'vitest';

import type { AdapterExecutionContext, InfraAdapter, TypedFailure } from '../../Contract.js';
import { withRetry, withTenantScopeGuard } from '../adapterDecorators.js';

interface TestRequest {
  organizationId: string;
}

interface TestResponse {
  ok: true;
}

interface TestFailure extends TypedFailure {
  code: 'RETRYABLE' | 'NON_RETRYABLE';
}

const baseContext: AdapterExecutionContext = {
  tenantId: 'tenant-1',
  authMode: 'user-scoped-rls',
  retryPolicy: {
    strategy: 'none',
    maxAttempts: 3,
    initialDelayMs: 0,
    maxDelayMs: 0,
  },
  logSchema: {
    schema: 'valueos.adapter.log.v1',
    operation: 'test-op',
    component: 'test-component',
  },
};

describe('adapterDecorators', () => {
  it('blocks tenant mismatches before invoking adapter', async () => {
    let called = 0;
    const adapter: InfraAdapter<TestRequest, TestResponse, TestFailure> = {
      adapterName: 'tenant-test',
      async execute() {
        called += 1;
        return { ok: true, data: { ok: true } };
      },
    };

    const guarded = withTenantScopeGuard(adapter);
    const result = await guarded.execute({ organizationId: 'other-tenant' }, baseContext);

    expect(result.ok).toBe(false);
    expect(called).toBe(0);
  });

  it('retries retryable failures until success', async () => {
    let attempts = 0;
    const adapter: InfraAdapter<TestRequest, TestResponse, TestFailure> = {
      adapterName: 'retry-test',
      async execute() {
        attempts += 1;
        if (attempts < 3) {
          return {
            ok: false,
            failure: {
              code: 'RETRYABLE',
              message: 'transient',
              retryable: true,
            },
          };
        }

        return { ok: true, data: { ok: true } };
      },
    };

    const retrying = withRetry(adapter);
    const result = await retrying.execute(
      { organizationId: 'tenant-1' },
      {
        ...baseContext,
        retryPolicy: {
          strategy: 'fixed',
          maxAttempts: 3,
          initialDelayMs: 0,
          maxDelayMs: 0,
        },
      },
    );

    expect(result.ok).toBe(true);
    expect(attempts).toBe(3);
  });
});
