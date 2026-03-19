/**
 * Projects API — audit log integration tests
 *
 * Asserts that create, update, and delete operations emit audit records with
 * the correct actor, tenant, and action fields.

 */

import express, { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockCreateEntry } = vi.hoisted(() => ({
  mockCreateEntry: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

vi.mock('../services/security/index.js', () => ({
  auditLogService: { createEntry: mockCreateEntry },
}));

vi.mock('../services/cache/ReadThroughCacheService.js', () => ({
  ReadThroughCacheService: {
    getOrLoad: vi.fn().mockImplementation(
      (_config: unknown, loader: () => Promise<unknown>) => loader(),
    ),
    invalidateEndpoint: vi.fn().mockResolvedValue(0),
  },
  getTenantIdFromRequest: vi.fn().mockImplementation(
    (req: { tenantId?: string; headers?: Record<string, string | string[] | undefined> }) => req.tenantId ?? undefined,
  ),
}));

vi.mock('../repositories/ProjectRepository.js', () => {
  const byTenant = new Map<string, Map<string, any>>();
  const getStore = (tenantId: string) => {
    let store = byTenant.get(tenantId);
    if (!store) {
      store = new Map();
      byTenant.set(tenantId, store);
    }
    return store;
  };

  return {
    projectRepository: {
      findByName: vi.fn(async (organizationId: string, name: string) => {
        const normalized = name.toLowerCase();
        return Array.from(getStore(organizationId).values()).find((p) => p.name.toLowerCase() === normalized) ?? null;
      }),
      create: vi.fn(async (input: any) => {
        const now = new Date().toISOString();
        const project = {
          id: input.id,
          organization_id: input.organizationId,
          name: input.name,
          description: input.description ?? null,
          status: input.status,
          tags: input.tags,
          owner_id: input.ownerId,
          created_at: now,
          updated_at: now,
        };
        getStore(input.organizationId).set(project.id, project);
        return project;
      }),
      list: vi.fn(async (organizationId: string, options: any) => {
        const items = Array.from(getStore(organizationId).values());
        const filtered = items.filter((project) => {
          if (options.status && project.status !== options.status) return false;
          if (!options.search) return true;
          const search = options.search.toLowerCase();
          return project.name.toLowerCase().includes(search) || project.description?.toLowerCase().includes(search);
        });
        const start = (options.page - 1) * options.pageSize;
        return { items: filtered.slice(start, start + options.pageSize), total: filtered.length };
      }),
      getById: vi.fn(async (organizationId: string, projectId: string) => getStore(organizationId).get(projectId) ?? null),
      update: vi.fn(async (organizationId: string, projectId: string, input: any) => {
        const store = getStore(organizationId);
        const existing = store.get(projectId);
        if (!existing) return null;
        const updated = {
          ...existing,
          ...input,
          description: input.description ?? existing.description,
          updated_at: new Date().toISOString(),
        };
        store.set(projectId, updated);
        return updated;
      }),
      delete: vi.fn(async (organizationId: string, projectId: string) => getStore(organizationId).delete(projectId)),
    },
    projectStatuses: ['planned', 'active', 'paused', 'completed'],
  };
});

vi.mock('../lib/logger.js', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), cache: vi.fn() },
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), cache: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), cache: vi.fn() },
}));

vi.mock('../middleware/globalErrorHandler.js', () => ({
  asyncHandler:
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next),
}));

vi.mock('../lib/errors', () => {
  class AppError extends Error {
    constructor(public statusCode: number, message: string) { super(message); }
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

const TENANT_ID = 'tenant-audit-0001';
const USER_ID = `user-${TENANT_ID}`;

function makeApp(role = 'admin') {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).tenantId = TENANT_ID;
    (req as any).user = { id: USER_ID, email: 'actor@example.com', role };
    req.headers.authorization = 'Bearer test-token';
    req.headers['x-correlation-id'] = 'corr-123';
    next();
  });
  app.use('/projects', projectsRouter);
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Projects API — audit logging', () => {
  beforeEach(() => {
    mockCreateEntry.mockClear();
  });

  it('emits an audit record on project create', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Audited Project' });

    expect(res.status).toBe(201);
    expect(mockCreateEntry).toHaveBeenCalledOnce();

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, any>;
    expect(call.action).toBe('create');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(res.body.data.id);
    expect(call.userId).toBe(USER_ID);
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.details.correlationId).toBe('corr-123');
  });

  it('emits an audit record on project update', async () => {
    const app = makeApp();
    const createRes = await request(app)
      .post('/projects')
      .send({ name: 'Before Update' });
    const projectId: string = createRes.body.data.id;

    mockCreateEntry.mockClear();

    const res = await request(app)
      .patch(`/projects/${projectId}`)
      .send({ name: 'After Update' });

    expect(res.status).toBe(200);
    expect(mockCreateEntry).toHaveBeenCalledOnce();

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, any>;
    expect(call.action).toBe('update');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(projectId);
    expect(call.userId).toBe(USER_ID);
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.details.correlationId).toBe('corr-123');
  });

  it('emits an audit record on project delete', async () => {
    const app = makeApp();
    const createRes = await request(app)
      .post('/projects')
      .send({ name: 'To Be Deleted' });
    const projectId: string = createRes.body.data.id;

    mockCreateEntry.mockClear();

    const res = await request(app).delete(`/projects/${projectId}`);

    expect(res.status).toBe(204);
    expect(mockCreateEntry).toHaveBeenCalledOnce();

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, any>;
    expect(call.action).toBe('delete');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(projectId);
    expect(call.userId).toBe(USER_ID);
    expect(call.tenantId).toBe(TENANT_ID);
    expect(call.details.correlationId).toBe('corr-123');
  });

});
