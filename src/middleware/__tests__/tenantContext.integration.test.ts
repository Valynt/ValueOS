
import { describe, expect, it, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { tenantContextMiddleware } from '../tenantContext';
import { serviceIdentityMiddleware } from '../serviceIdentityMiddleware';

// Mock dependencies
vi.mock('../lib/tenantVerification', () => ({
  getUserTenantId: vi.fn(),
  verifyTenantMembership: vi.fn(),
}));

vi.mock('../config/autonomy', () => ({
  getAutonomyConfig: vi.fn().mockReturnValue({ serviceIdentityToken: 'test-secret' }),
}));

vi.mock('../middleware/nonceStore', () => ({
  nonceStore: {
    consumeOnce: vi.fn().mockResolvedValue(true),
  },
}));

import { getUserTenantId, verifyTenantMembership } from '../../lib/tenantVerification';

describe('tenantContextMiddleware Integration', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
  });

  it('resolves tenant from user lookup when valid user is present', async () => {
    (getUserTenantId as any).mockResolvedValue('tenant-123');
    (verifyTenantMembership as any).mockResolvedValue(true);

    app.use((req, res, next) => {
      (req as any).user = { id: 'user-1' };
      next();
    });
    app.use(tenantContextMiddleware());
    app.get('/test', (req, res) => {
      res.json({ tenantId: (req as any).tenantId });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('tenant-123');
    expect(getUserTenantId).toHaveBeenCalledWith('user-1');
  });

  it('blocks forged x-tenant-id header when service identity is not verified', async () => {
    app.use(serviceIdentityMiddleware); // Should fail verification without headers
    app.use(tenantContextMiddleware());
    app.get('/test', (req, res) => {
      res.json({ tenantId: (req as any).tenantId });
    });

    const res = await request(app)
      .get('/test')
      .set('x-tenant-id', 'forged-tenant');

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Tenant header is restricted');
  });

  it('accepts x-tenant-id header when service identity is verified', async () => {
    // Setup service identity middleware to pass
    app.use((req, res, next) => {
      (req as any).serviceIdentityVerified = true;
      next();
    });
    app.use(tenantContextMiddleware());
    app.get('/test', (req, res) => {
      res.json({ tenantId: (req as any).tenantId });
    });

    const res = await request(app)
      .get('/test')
      .set('x-tenant-id', 'service-tenant');

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('service-tenant');
  });

  it('rejects access if user is not member of the resolved tenant', async () => {
    (getUserTenantId as any).mockResolvedValue('tenant-123');
    (verifyTenantMembership as any).mockResolvedValue(false);

    app.use((req, res, next) => {
      (req as any).user = { id: 'user-1' };
      next();
    });
    app.use(tenantContextMiddleware());
    app.get('/test', (req, res) => {
      res.json({ tenantId: (req as any).tenantId });
    });

    const res = await request(app).get('/test');
    expect(res.status).toBe(403);
    expect(res.body.message).toContain('User does not belong to tenant');
  });
});
