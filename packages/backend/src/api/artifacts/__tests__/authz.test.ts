import express, { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { artifactsRouter } from '../index.js';

const authState = {
  isAuthenticated: true,
  hasRequiredRole: true,
};

const middlewareOrder: string[] = [];

vi.mock('../../../middleware/auth', () => ({
  requireAuth: vi.fn((req: any, res: any, next: any) => {
    middlewareOrder.push('requireAuth');
    if (!authState.isAuthenticated) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    req.user = { id: 'user-123', tenant_id: 'tenant-123' };
    req.tenantId = 'tenant-123';
    next();
  }),
}));

vi.mock('../../../middleware/rbac', () => ({
  requireRole: vi.fn(() => (req: any, res: any, next: any) => {
    middlewareOrder.push('requireRole');
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }

    if (!authState.hasRequiredRole) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }

    next();
  }),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: any, _res: any, next: any) => {
    middlewareOrder.push('tenantContext');
    req.tenantId = req.tenantId || 'tenant-123';
    next();
  },
}));

vi.mock('../../../middleware/tenantDbContext', () => ({
  tenantDbContextMiddleware: () => (_req: any, _res: any, next: any) => {
    middlewareOrder.push('tenantDbContext');
    next();
  },
}));

describe('Artifacts router auth guards', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/artifacts', artifactsRouter);
    authState.isAuthenticated = true;
    authState.hasRequiredRole = true;
    middlewareOrder.length = 0;
  });

  it('returns 401 for unauthenticated requests', async () => {
    authState.isAuthenticated = false;

    await request(app)
      .post('/api/v1/artifacts')
      .send({
        type: 'narrative',
        title: 'Test artifact',
        status: 'proposed',
        content: { kind: 'markdown', markdown: 'hello' },
      })
      .expect(401);
  });


  it('runs tenant context middleware after auth middleware', async () => {
    await request(app)
      .post('/api/v1/artifacts')
      .send({ type: 'narrative' })
      .expect(400);

    expect(middlewareOrder.indexOf('requireAuth')).toBeGreaterThanOrEqual(0);
    expect(middlewareOrder.indexOf('tenantContext')).toBeGreaterThan(middlewareOrder.indexOf('requireAuth'));
    expect(middlewareOrder.indexOf('tenantDbContext')).toBeGreaterThan(middlewareOrder.indexOf('requireAuth'));
  });

  it('returns 403 for authenticated users without a required role', async () => {
    authState.hasRequiredRole = false;

    await request(app)
      .post('/api/v1/artifacts')
      .send({
        type: 'narrative',
        title: 'Test artifact',
        status: 'proposed',
        content: { kind: 'markdown', markdown: 'hello' },
      })
      .expect(403);
  });
});
