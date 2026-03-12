import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Redis-backed cache so tests are hermetic and fast.
vi.mock('../../services/ReadThroughCacheService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/ReadThroughCacheService.js')>();
  return {
    ...actual,
    ReadThroughCacheService: {
      getOrLoad: vi.fn((_config: unknown, loader: () => Promise<unknown>) => loader()),
      invalidateEndpoint: vi.fn().mockResolvedValue(0),
    },
  };
});

import { projectsRouter } from '../projects.js';

function buildApp(tenantId: string, userId = 'user-1', role = 'admin') {
  const app = express();
  app.use(express.json());
  // Simulate what requireAuth + tenantContextMiddleware populate on req.
  app.use((req: any, _res, next) => {
    req.user = { id: userId, role };
    req.tenantId = tenantId;
    next();
  });
  app.use('/api/projects', projectsRouter);
  return app;
}

const authHeader = { Authorization: 'Bearer test-token' };

describe('Projects API — tenant isolation', () => {
  let appA: express.Express;
  let appB: express.Express;

  beforeEach(() => {
    appA = buildApp('tenant-a', 'user-a');
    appB = buildApp('tenant-b', 'user-b');
  });

  it('tenant A cannot list projects created by tenant B', async () => {
    // Tenant B creates a project.
    await request(appB)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'Tenant B Project' })
      .expect(201);

    // Tenant A's list must be empty.
    const res = await request(appA)
      .get('/api/projects')
      .set(authHeader)
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('tenant A cannot fetch a project ID owned by tenant B', async () => {
    const createRes = await request(appB)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'Tenant B Secret' })
      .expect(201);

    const projectId: string = createRes.body.data.id;

    // Tenant A requesting tenant B's project ID must get 404, not the record.
    await request(appA)
      .get(`/api/projects/${projectId}`)
      .set(authHeader)
      .expect(404);
  });

  it('tenant A cannot update a project owned by tenant B', async () => {
    const createRes = await request(appB)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'Tenant B Update Target' })
      .expect(201);

    const projectId: string = createRes.body.data.id;

    await request(appA)
      .patch(`/api/projects/${projectId}`)
      .set(authHeader)
      .send({ name: 'Hijacked' })
      .expect(404);
  });

  it('tenant A cannot delete a project owned by tenant B', async () => {
    const createRes = await request(appB)
      .post('/api/projects')
      .set(authHeader)
      .send({ name: 'Tenant B Delete Target' })
      .expect(201);

    const projectId: string = createRes.body.data.id;

    await request(appA)
      .delete(`/api/projects/${projectId}`)
      .set(authHeader)
      .expect(404);

    // Project still exists for tenant B.
    await request(appB)
      .get(`/api/projects/${projectId}`)
      .set(authHeader)
      .expect(200);
  });

  it('returns 401 when no tenant context is present', async () => {
    const appNoTenant = express();
    appNoTenant.use(express.json());
    appNoTenant.use((req: any, _res, next) => {
      req.user = { id: 'user-x', role: 'admin' };
      // tenantId intentionally omitted
      next();
    });
    appNoTenant.use('/api/projects', projectsRouter);

    await request(appNoTenant)
      .get('/api/projects')
      .set(authHeader)
      .expect(401);
  });
});
