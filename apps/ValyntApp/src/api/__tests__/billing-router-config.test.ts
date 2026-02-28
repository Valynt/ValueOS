import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('Billing router configuration', () => {
  const billingRouterSource = readFileSync(
    join(process.cwd(), 'src/api/billing/index.ts'),
    'utf-8'
  );

  it('does not apply service identity globally to webhook routes', () => {
    expect(billingRouterSource).not.toContain('router.use(serviceIdentityMiddleware);');
    expect(billingRouterSource).toContain('router.use("/webhooks", webhooksRouter);');
  });

  it('applies service identity + auth + RBAC to internal billing subroutes', () => {
    for (const routePath of ['/subscription', '/usage', '/invoices', '/checkout']) {
      expect(billingRouterSource).toContain(`"${routePath}",`);
      expect(billingRouterSource).toContain('serviceIdentityMiddleware,');
      expect(billingRouterSource).toContain('requireAuth,');
      expect(billingRouterSource).toContain('requirePermission(');
    }
  });
});
