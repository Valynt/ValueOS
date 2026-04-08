/**
 * GET /api/v1/cases/:caseId/integrity
 *
 * Tests: happy path, empty state, missing tenant, cross-tenant isolation.
 */

import express, { Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetForCase = vi.fn().mockResolvedValue(null);

// Stub heavy infrastructure that the router's import chain pulls in
vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn() },
}));

vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn((x: string) => x) },
}));

vi.mock('../../../repositories/IntegrityOutputRepository.js', () => {
  // Mock both the class (for any `new` calls) and the singleton used by the route
  class MockIntegrityOutputRepository {
    getForCase = mockGetForCase;
  }
  return {
    IntegrityOutputRepository: MockIntegrityOutputRepository,
    integrityOutputRepository: { getForCase: mockGetForCase },
  };
});

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user?: unknown; tenantId?: string }).user = {
      id: 'user-1',
      roles: ['admin', 'member', 'viewer'],
    };
    (req as express.Request & { tenantId?: string }).tenantId = 'org-1';
    next();
  }),
  requireRole: vi.fn(
    (_roles: string[]) =>
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const roles = (req as express.Request & { user?: { roles?: string[] } }).user?.roles ?? [];
        const allowed = _roles.some((r) => roles.includes(r));
        if (!allowed) {
          res.status(403).json({ error: 'FORBIDDEN' });
          return;
        }
        next();
      },
  ),
}));

vi.mock('../../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

vi.mock('../../../middleware/tenantDbContext.js', () => ({
  tenantDbContextMiddleware: () => (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    next();
  },
}));

vi.mock('../../../middleware/rateLimiter.js', () => ({
  createRateLimiter: vi.fn(() => (_r: unknown, _s: unknown, n: () => void) => n()),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock('../../../services/HypothesisOutputService.js', () => ({
  hypothesisOutputService: { getLatestForCase: vi.fn() },
}));

vi.mock('../../../services/CaseValueTreeService.js', () => ({
  caseValueTreeService: { getValueTree: vi.fn(), upsertNode: vi.fn() },
  ValueTreeNodeInputSchema: { parse: vi.fn((x: unknown) => x) },
}));

vi.mock('../../../repositories/ValueTreeRepository.js', () => ({
  ValueTreeRepository: vi.fn().mockImplementation(() => ({
    getNodesForCase: vi.fn().mockResolvedValue([]),
    replaceNodesForCase: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../../repositories/FinancialModelSnapshotRepository.js', () => ({
  FinancialModelSnapshotRepository: vi.fn().mockImplementation(() => ({
    getLatestSnapshotForCase: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock('../repository.js', () => ({
  getValueCasesRepository: vi.fn(() => ({
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  })),
  NotFoundError: class NotFoundError extends Error {},
  DatabaseError: class DatabaseError extends Error {},
  ConflictError: class ConflictError extends Error {},
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CASE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const STORED_OUTPUT = {
  id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
  case_id: CASE_ID,
  organization_id: 'org-1',
  agent_run_id: null,
  claims: [
    {
      claim_id: 'claim-1',
      text: 'Reduces costs by 20%',
      confidence_score: 0.85,
      evidence_tier: 2,
      flagged: false,
    },
  ],
  overall_confidence: 0.85,
  veto_triggered: false,
  veto_reason: null,
  source_agent: 'IntegrityAgent',
  created_at: '2026-03-25T00:00:00Z',
  updated_at: '2026-03-25T00:00:00Z',
};

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

async function buildApp(): Promise<Express> {
  const { valueCasesRouter } = await import('../index.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cases', valueCasesRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/v1/cases/:caseId/integrity', () => {
  let app: Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(async () => {
    vi.clearAllMocks();

    // Restore default mock implementations after clearAllMocks
    mockGetForCase.mockResolvedValue(null);

    const { requireAuth } = await import('../../../middleware/auth.js');
    vi.mocked(requireAuth).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as express.Request & { user?: unknown; tenantId?: string }).user = {
          id: 'user-1',
          roles: ['admin', 'member', 'viewer'],
        };
        (req as express.Request & { tenantId?: string }).tenantId = 'org-1';
        next();
      },
    );
  });

  it('returns { data: output } when integrity output exists', async () => {
    mockGetForCase.mockResolvedValue(STORED_OUTPUT);

    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(200);

    expect(res.body.data).toMatchObject({
      case_id: CASE_ID,
      veto_triggered: false,
      claims: expect.arrayContaining([
        expect.objectContaining({ claim_id: 'claim-1' }),
      ]),
    });
  });

  it('returns { data: null } when no output exists (empty state, not 404)', async () => {
    mockGetForCase.mockResolvedValue(null);

    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(200);

    expect(res.body).toEqual({ data: null });
  });

  it('returns 400 for non-UUID caseId', async () => {
    await request(app)
      .get('/api/v1/cases/not-a-uuid/integrity')
      .expect(400);
  });

  it('returns 401 when tenant context is missing', async () => {
    const { requireAuth } = await import('../../../middleware/auth.js');
    // Override for this test only: set user but omit tenantId
    vi.mocked(requireAuth).mockImplementationOnce(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        (req as express.Request & { user?: unknown; tenantId?: string }).user = {
          id: 'user-1',
          roles: ['admin', 'member', 'viewer'],
        };
        // tenantId intentionally absent
        next();
      },
    );

    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(401);

    expect(res.body.error).toBe('Missing tenant context');
  });

  it('passes caseId and organizationId to repository', async () => {
    mockGetForCase.mockResolvedValue(null);

    await request(app).get(`/api/v1/cases/${CASE_ID}/integrity`);

    expect(mockGetForCase).toHaveBeenCalledWith(CASE_ID, 'org-1');
  });

  it('returns 500 when repository throws', async () => {
    mockGetForCase.mockRejectedValue(new Error('db connection failed'));

    await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(500);
  });
});
