import { tenantContextStorage, type TCTPayload } from '../middleware/tenantContext.js';

interface TenantBootstrapOptions {
  tenantId?: string | null;
  organizationId?: string | null;
  workerName: string;
}

export function resolveTenantContextId(options: TenantBootstrapOptions): string {
  if (options.tenantId && options.organizationId && options.tenantId !== options.organizationId) {
    throw new Error(
      `${options.workerName}: tenant context mismatch (tenantId=${options.tenantId}, organizationId=${options.organizationId})`,
    );
  }

  const candidate = options.tenantId ?? options.organizationId;
  if (!candidate || typeof candidate !== 'string' || candidate.trim().length === 0) {
    throw new Error(`${options.workerName}: job payload missing tenant context (tenantId/organizationId)`);
  }
  return candidate;
}

export async function runJobWithTenantContext<T>(
  options: TenantBootstrapOptions,
  handler: () => Promise<T>,
): Promise<T> {
  const tid = resolveTenantContextId(options);
  const payload: TCTPayload = {
    iss: 'worker',
    sub: 'worker',
    tid,
    roles: [],
    tier: 'worker',
    exp: 0,
  };
  return tenantContextStorage.run(payload, handler);
}
