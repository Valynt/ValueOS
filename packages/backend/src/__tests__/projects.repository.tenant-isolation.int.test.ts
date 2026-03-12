/**
 * Projects API — tenant isolation integration tests
 *
 * Verifies that every CRUD operation is scoped to the requesting tenant and
 * that one tenant cannot read, modify, or delete another tenant's projects.
 *
 * The projects router uses an in-process Map partitioned by tenantId derived
 * from req.tenantId (set by verified middleware). These tests exercise the
 * full HTTP layer via supertest.
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../services/ReadThroughCacheService.js', () => ({
  ReadThroughCacheService: {
    getOrLoad: vi.fn().mockImplementation(
      (_config: unknown, loader: () => Promise<unknown>) => loader(),
    ),
    invalidateEndpoint: vi.fn().mockResolvedValue(0),
  },
  getTenantIdFromRequest: vi.fn().mockImplementation(
    (req: { tenantId?: string }) => req.tenantId ?? undefined,
  ),
}));

vi.mock('../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('../middleware/globalErrorHandler.js', () => ({
  asyncHandler:
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next),
}));

vi.mock('../lib/errors', () => {
  class AppError extends Error {
    constructor(
      public statusCode: number,
      message: string,
    ) {
      super(message);
    }
  }
  class UnauthorizedError extends AppError {
    constructor(msg = 'Unauthorized') { super(401, msg); }
  }
  class ForbiddenError extends AppError {
    constructor(msg = 'Forbidden') { super(403, msg); }
  }
  class NotFoundError extends AppError {
    constructor(resource: string, id: string) { super(404, `${resource} ${id} not found`); }
  }
  class ConflictError extends AppError {
    constructor(msg = 'Conflict') { super(409, msg); }
  }
  return { AppError, UnauthorizedError, ForbiddenError, NotFoundError, ConflictError };
});

// ─── App factory ──────────────────────────────────────────────────────────────

import { projectsRouter } from '../api/projects.js';

function makeApp(tenantId: string, role = 'admin') {
  const app = express();
  app.use(express.json());

  // Inject tenant + user context the same way real middleware would
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).tenantId = tenantId;
    (req as any).user = { id: `user-${tenantId}`, role };
    // Provide a Bearer token so requireBearerToken passes
    req.headers.authorization = 'Bearer test-token';
    next();
  });

  app.use('/projects', projectsRouter);

  // Generic error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });

  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

const TENANT_A = 'tenant-aaaa';
const TENANT_B = 'tenant-bbbb';

describe('Projects API — tenant isolation', () => {
  // The in-process projectsByTenant Map persists for the entire test run.
  // Isolation is achieved by using a unique tenant ID suffix per describe block
  // so no two groups share a key namespace. Do not reuse tenant ID suffixes.

  describe('POST / — create requires tenant context', () => {
    it('returns 401 when no tenant context is present', async () => {
      const app = express();
      app.use(express.json());
      // No tenantId injected, no auth header
      app.use('/projects', projectsRouter);
      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        res.status(err.statusCode ?? 500).json({ error: err.message });
      });

      const res = await request(app)
        .post('/projects')
        .send({ name: 'Ghost Project' });

      expect(res.status).toBe(401);
    });

    it('creates a project scoped to the requesting tenant', async () => {
      const app = makeApp(TENANT_A);
      const res = await request(app)
        .post('/projects')
        .send({ name: 'Alpha Project' });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('Alpha Project');
      expect(res.body.data.id).toMatch(/^proj_/);
    });
  });

  describe('GET / — list is tenant-scoped', () => {
    it('tenant B cannot see projects created by tenant A', async () => {
      const appA = makeApp(`${TENANT_A}-list`);
      const appB = makeApp(`${TENANT_B}-list`);

      // Tenant A creates a project
      await request(appA).post('/projects').send({ name: 'A-Only Project' });

      // Tenant B lists — should see an empty list
      const res = await request(appB).get('/projects');

      expect(res.status).toBe(200);
      const items: unknown[] = res.body.data?.items ?? [];
      const names = items.map((p: any) => p.name);
      expect(names).not.toContain('A-Only Project');
    });

    it('tenant A only sees its own projects', async () => {
      const suffix = '-list-own';
      const appA = makeApp(`${TENANT_A}${suffix}`);
      const appB = makeApp(`${TENANT_B}${suffix}`);

      await request(appA).post('/projects').send({ name: 'Project-A1' });
      await request(appB).post('/projects').send({ name: 'Project-B1' });

      const res = await request(appA).get('/projects');
      const names = (res.body.data?.items ?? []).map((p: any) => p.name);

      expect(names).toContain('Project-A1');
      expect(names).not.toContain('Project-B1');
    });
  });

  describe('GET /:projectId — detail is tenant-scoped', () => {
    it('returns 404 when tenant B requests a project owned by tenant A', async () => {
      const suffix = '-detail';
      const appA = makeApp(`${TENANT_A}${suffix}`);
      const appB = makeApp(`${TENANT_B}${suffix}`);

      const createRes = await request(appA)
        .post('/projects')
        .send({ name: 'Secret Project' });
      const projectId: string = createRes.body.data.id;

      const res = await request(appB).get(`/projects/${projectId}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /:projectId — update is tenant-scoped', () => {
    it('returns 404 when tenant B tries to update a project owned by tenant A', async () => {
      const suffix = '-patch';
      const appA = makeApp(`${TENANT_A}${suffix}`);
      const appB = makeApp(`${TENANT_B}${suffix}`);

      const createRes = await request(appA)
        .post('/projects')
        .send({ name: 'Owned by A' });
      const projectId: string = createRes.body.data.id;

      const res = await request(appB)
        .patch(`/projects/${projectId}`)
        .send({ name: 'Hijacked' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /:projectId — delete is tenant-scoped', () => {
    it('returns 404 when tenant B tries to delete a project owned by tenant A', async () => {
      const suffix = '-delete';
      const appA = makeApp(`${TENANT_A}${suffix}`);
      const appB = makeApp(`${TENANT_B}${suffix}`);

      const createRes = await request(appA)
        .post('/projects')
        .send({ name: 'Do Not Delete' });
      const projectId: string = createRes.body.data.id;

      const res = await request(appB).delete(`/projects/${projectId}`);
      expect(res.status).toBe(404);

      // Confirm the project still exists for tenant A
      const checkRes = await request(appA).get(`/projects/${projectId}`);
      expect(checkRes.status).toBe(200);
    });
  });
});
