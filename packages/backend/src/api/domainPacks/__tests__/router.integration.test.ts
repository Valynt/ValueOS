import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CreateDomainPackRequest,
  DomainPack,
  ListDomainPacksQuery,
  PaginatedResponse,
  UpdateDomainPackRequest,
} from '../types.js';

const calls = vi.hoisted(() => ({
  getRepositoryForSupabase: vi.fn(),
}));


vi.mock('../../../utils/security.js', () => ({
  sanitizeUserInput: (value: string) => value,
}));
vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('../../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../middleware/tenantDbContext.js', () => ({
  tenantDbContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as Request & { user?: { id: string; roles: string[] }; tenantId?: string; supabase?: unknown };
    authReq.user = { id: 'user-1', roles: [String(req.headers['x-role'] || 'viewer')] };
    authReq.tenantId = String(req.headers['x-tenant-id'] || 'tenant-a');
    authReq.supabase = { requestScoped: true, tenantId: authReq.tenantId };
    next();
  },
  requireRole:
    (roles: string[]) =>
    (req: Request, res: Response, next: NextFunction) => {
      const userRole = (req as Request & { user?: { roles?: string[] } }).user?.roles?.[0] || 'viewer';
      if (!roles.includes(userRole)) {
        res.status(403).json({ error: 'FORBIDDEN' });
        return;
      }
      next();
    },
  AuthenticatedRequest: {},
}));

vi.mock('../repository.js', async () => {
  class RepositoryError extends Error {
    constructor(
      message: string,
      public readonly code: string,
    ) {
      super(message);
    }
  }
  class NotFoundError extends RepositoryError {
    constructor(resource: string, id: string) {
      super(`${resource} not found: ${id}`, 'NOT_FOUND');
    }
  }
  class ConflictError extends RepositoryError {
    constructor(message: string) {
      super(message, 'CONFLICT');
    }
  }
  class DatabaseError extends RepositoryError {
    constructor(message: string) {
      super(message, 'DATABASE_ERROR');
    }
  }

  type StorePack = DomainPack;
  const packs = new Map<string, StorePack>();

  const baseGlobalPack: StorePack = {
    id: '00000000-0000-4000-8000-000000000001',
    tenantId: null,
    name: 'Global Baseline',
    industry: 'Technology',
    version: '1.0.0',
    status: 'active',
    parentPackId: null,
    kpis: [
      {
        kpiKey: 'global_kpi',
        defaultName: 'Global KPI',
        defaultConfidence: 0.8,
        sortOrder: 0,
      },
    ],
    assumptions: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const createRepository = () => ({
    async create(tenantId: string, input: CreateDomainPackRequest): Promise<DomainPack> {
      const id = crypto.randomUUID();
      const now = new Date();
      const pack: DomainPack = {
        id,
        tenantId,
        name: input.name,
        industry: input.industry,
        version: input.version || '1.0.0',
        status: 'draft',
        parentPackId: input.parentPackId ?? null,
        kpis: input.kpis || [],
        assumptions: input.assumptions || [],
        createdAt: now,
        updatedAt: now,
      };
      packs.set(id, pack);
      return pack;
    },
    async list(tenantId: string, query: ListDomainPacksQuery): Promise<PaginatedResponse<DomainPack>> {
      const all = [baseGlobalPack, ...Array.from(packs.values())].filter(
        (pack) => pack.tenantId === null || pack.tenantId === tenantId,
      );
      const data = query.status ? all.filter((pack) => pack.status === query.status) : all;
      return {
        data,
        pagination: { page: query.page, limit: query.limit, total: data.length, totalPages: 1, hasMore: false },
      };
    },
    async getById(tenantId: string, id: string): Promise<DomainPack> {
      const pack = id === baseGlobalPack.id ? baseGlobalPack : packs.get(id);
      if (!pack || (pack.tenantId !== null && pack.tenantId !== tenantId)) {
        throw new NotFoundError('DomainPack', id);
      }
      return pack;
    },
    async update(tenantId: string, id: string, patch: UpdateDomainPackRequest): Promise<DomainPack> {
      const existing = packs.get(id);
      if (!existing || existing.tenantId !== tenantId) {
        throw new NotFoundError('DomainPack', id);
      }
      if (existing.status !== 'draft') {
        throw new ConflictError('Only draft packs are editable.');
      }
      const next = { ...existing, ...patch, updatedAt: new Date() };
      packs.set(id, next);
      return next;
    },
    async publish(tenantId: string, id: string): Promise<DomainPack> {
      const existing = packs.get(id);
      if (!existing || existing.tenantId !== tenantId) {
        throw new NotFoundError('DomainPack', id);
      }
      if (existing.kpis.length === 0) {
        throw new ConflictError('Cannot publish a pack with no KPIs');
      }
      const next = { ...existing, status: 'active' as const, updatedAt: new Date() };
      packs.set(id, next);
      return next;
    },
    async deprecate(tenantId: string, id: string): Promise<DomainPack> {
      const existing = packs.get(id);
      if (!existing || existing.tenantId !== tenantId) {
        throw new NotFoundError('DomainPack', id);
      }
      const next = { ...existing, status: 'deprecated' as const, updatedAt: new Date() };
      packs.set(id, next);
      return next;
    },
  });

  const repository = createRepository();

  return {
    ConflictError,
    NotFoundError,
    DatabaseError,
    getDomainPacksRepository: (supabase: unknown) => {
      calls.getRepositoryForSupabase(supabase);
      return repository;
    },
  };
});

const { domainPacksRouter } = await import('../index.js');

const app = express();
app.use(express.json());
app.use('/api/v1/domain-packs', domainPacksRouter);

describe('Domain packs router integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates, lists, gets, updates and publishes tenant-owned packs', async () => {
    const createResponse = await request(app)
      .post('/api/v1/domain-packs')
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'member')
      .send({
        name: 'Retail Growth Pack',
        industry: 'Retail',
        kpis: [{ kpiKey: 'revenue_growth', defaultName: 'Revenue Growth', defaultConfidence: 0.85, sortOrder: 0 }],
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.tenantId).toBe('tenant-a');

    const packId = createResponse.body.data.id;

    const listResponse = await request(app)
      .get('/api/v1/domain-packs')
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'viewer');

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.some((pack: DomainPack) => pack.id === packId)).toBe(true);
    expect(listResponse.body.data.some((pack: DomainPack) => pack.tenantId === null)).toBe(true);

    const getResponse = await request(app)
      .get(`/api/v1/domain-packs/${packId}`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'viewer');

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.data.id).toBe(packId);

    const updateResponse = await request(app)
      .patch(`/api/v1/domain-packs/${packId}`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'member')
      .send({ name: 'Retail Growth Pack v2' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.name).toBe('Retail Growth Pack v2');

    const publishResponse = await request(app)
      .post(`/api/v1/domain-packs/${packId}/publish`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'admin');

    expect(publishResponse.status).toBe(200);
    expect(publishResponse.body.data.status).toBe('active');
    expect(calls.getRepositoryForSupabase).toHaveBeenCalled();
  });

  it('enforces tenant isolation for get/update/publish operations', async () => {
    const createResponse = await request(app)
      .post('/api/v1/domain-packs')
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'member')
      .send({
        name: 'Healthcare Pack',
        industry: 'Healthcare',
        kpis: [{ kpiKey: 'outcome_score', defaultName: 'Outcome Score', defaultConfidence: 0.8, sortOrder: 0 }],
      });

    const packId = createResponse.body.data.id;

    const getResponse = await request(app)
      .get(`/api/v1/domain-packs/${packId}`)
      .set('x-tenant-id', 'tenant-b')
      .set('x-role', 'viewer');
    expect(getResponse.status).toBe(404);

    const updateResponse = await request(app)
      .patch(`/api/v1/domain-packs/${packId}`)
      .set('x-tenant-id', 'tenant-b')
      .set('x-role', 'member')
      .send({ name: 'Cross Tenant Update' });
    expect(updateResponse.status).toBe(404);

    const publishResponse = await request(app)
      .post(`/api/v1/domain-packs/${packId}/publish`)
      .set('x-tenant-id', 'tenant-b')
      .set('x-role', 'admin');
    expect(publishResponse.status).toBe(404);
  });

  it('enforces role authorization on publish', async () => {
    const createResponse = await request(app)
      .post('/api/v1/domain-packs')
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'member')
      .send({
        name: 'Manufacturing Pack',
        industry: 'Manufacturing',
        kpis: [{ kpiKey: 'defect_rate', defaultName: 'Defect Rate', defaultConfidence: 0.8, sortOrder: 0 }],
      });

    const packId = createResponse.body.data.id;

    const publishResponse = await request(app)
      .post(`/api/v1/domain-packs/${packId}/publish`)
      .set('x-tenant-id', 'tenant-a')
      .set('x-role', 'member');

    expect(publishResponse.status).toBe(403);
  });
});
