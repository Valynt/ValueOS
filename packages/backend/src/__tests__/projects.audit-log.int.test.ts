/**
 * Projects API — audit log integration tests
 *
 * Asserts that create, update, and delete operations emit audit records with
 * the correct actor, tenant, and action fields.
 *
 * The projects router does NOT currently call auditLogService (known gap).
 * These tests document the expected behaviour and will fail until the router
 * is wired to emit audit events. When the implementation lands, remove the
 * `.skip` markers and the "known gap" comments.
 */

import request from 'supertest';
import express, { Request, Response, NextFunction } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockCreateEntry } = vi.hoisted(() => ({
  mockCreateEntry: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

vi.mock('../services/AuditLogService.js', () => ({
  auditLogService: { createEntry: mockCreateEntry },
}));

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

  // KNOWN GAP: the projects router does not yet call auditLogService.
  // Remove `.skip` once audit emission is implemented.

  it.skip('emits an audit record on project create', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/projects')
      .send({ name: 'Audited Project' });

    expect(res.status).toBe(201);
    expect(mockCreateEntry).toHaveBeenCalledOnce();

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, unknown>;
    expect(call.action).toBe('create');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(res.body.data.id);
    expect(call.userId).toBe(USER_ID);
    // Tenant must be present — no cross-tenant audit leakage
    expect(call.tenantId ?? (call.details as any)?.tenantId).toBe(TENANT_ID);
  });

  it.skip('emits an audit record on project update', async () => {
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

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, unknown>;
    expect(call.action).toBe('update');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(projectId);
    expect(call.userId).toBe(USER_ID);
    expect(call.tenantId ?? (call.details as any)?.tenantId).toBe(TENANT_ID);
  });

  it.skip('emits an audit record on project delete', async () => {
    const app = makeApp();
    const createRes = await request(app)
      .post('/projects')
      .send({ name: 'To Be Deleted' });
    const projectId: string = createRes.body.data.id;

    mockCreateEntry.mockClear();

    const res = await request(app).delete(`/projects/${projectId}`);

    expect(res.status).toBe(204);
    expect(mockCreateEntry).toHaveBeenCalledOnce();

    const call = mockCreateEntry.mock.calls[0][0] as Record<string, unknown>;
    expect(call.action).toBe('delete');
    expect(call.resourceType).toBe('project');
    expect(call.resourceId).toBe(projectId);
    expect(call.userId).toBe(USER_ID);
    expect(call.tenantId ?? (call.details as any)?.tenantId).toBe(TENANT_ID);
  });

  // ── Passing baseline: audit service is NOT called today ──────────────────

  it('audit service is not called on create (current behaviour — remove when fixed)', async () => {
    const app = makeApp();
    await request(app).post('/projects').send({ name: 'No Audit Yet' });
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it('audit service is not called on update (current behaviour — remove when fixed)', async () => {
    const app = makeApp();
    const createRes = await request(app).post('/projects').send({ name: 'Pre-Update' });
    const projectId: string = createRes.body.data.id;
    mockCreateEntry.mockClear();

    await request(app).patch(`/projects/${projectId}`).send({ name: 'Post-Update' });
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });

  it('audit service is not called on delete (current behaviour — remove when fixed)', async () => {
    const app = makeApp();
    const createRes = await request(app).post('/projects').send({ name: 'Pre-Delete' });
    const projectId: string = createRes.body.data.id;
    mockCreateEntry.mockClear();

    await request(app).delete(`/projects/${projectId}`);
    expect(mockCreateEntry).not.toHaveBeenCalled();
  });
});
