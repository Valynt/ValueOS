import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { Express } from 'express';
import { tenantContextMiddleware } from '../tenantContext';
import { TenantAwareService } from '../../services/TenantAwareService';
import { getUserTenantId, verifyTenantMembership } from '../../lib/tenantVerification';

vi.mock('../../lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../../lib/tenantVerification', () => ({
  verifyTenantMembership: vi.fn(),
  getUserTenantId: vi.fn(),
}));

describe('tenantContext middleware integration', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      (req as any).user = { id: 'user-123' };
      next();
    });

    app.use(tenantContextMiddleware());

    app.get('/secure', (req, res) => {
      res.json({ tenantId: req.tenantId || null });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects forged tenant header without service identity', async () => {
    const response = await request(app)
      .get('/secure')
      .set('x-tenant-id', 'tenant-b');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
  });

  it('rejects forged tenant header when membership validation fails', async () => {
    vi.spyOn(TenantAwareService.prototype as any, 'getUserTenants').mockResolvedValue(['tenant-a']);
    (verifyTenantMembership as any).mockResolvedValue(false);
    (getUserTenantId as any).mockResolvedValue(null);

    const appWithIdentity = express();
    appWithIdentity.use(express.json());
    appWithIdentity.use((req, _res, next) => {
      (req as any).user = { id: 'user-123' };
      (req as any).serviceIdentityVerified = true;
      next();
    });
    appWithIdentity.use(tenantContextMiddleware());
    appWithIdentity.get('/secure', (req, res) => {
      res.json({ tenantId: req.tenantId || null });
    });

    const response = await request(appWithIdentity)
      .get('/secure')
      .set('x-tenant-id', 'tenant-b');

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Forbidden');
    expect(verifyTenantMembership).toHaveBeenCalledWith('user-123', 'tenant-b');
  });
});
