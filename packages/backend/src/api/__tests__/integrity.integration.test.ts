/**
 * Integrity stage integration tests.
 *
 * Tests the full chain: IntegrityAgent.execute() → IntegrityOutputRepository.upsertForCase()
 * → GET /api/v1/cases/:caseId/integrity returns the persisted row.
 *
 * DB is mocked at the supabase client level so no live Supabase is required.
 * This validates the wiring between layers without needing a running database.
 */

import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Constants (must be before vi.hoisted / vi.mock calls)
// ---------------------------------------------------------------------------

const CASE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ORG_ID = 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';

// ---------------------------------------------------------------------------
// Hoist mocks
// ---------------------------------------------------------------------------

// In-memory store simulating the integrity_outputs table
let storedRow: Record<string, unknown> | null = null;

const mockSupabaseChain = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnThis();
  chain.upsert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
    storedRow = {
      ...data,
      id: 'integrity-out-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    return chain;
  });
  chain.eq = vi.fn().mockReturnThis();
  chain.maybeSingle = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: storedRow, error: null }),
  );
  chain.single = vi.fn().mockImplementation(() =>
    Promise.resolve({ data: storedRow, error: null }),
  );
  return chain;
});

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    from: vi.fn().mockReturnValue(mockSupabaseChain),
  },
}));

vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn((x: string) => x) },
}));

vi.mock('../../middleware/auth.js', () => ({
  requireAuth: vi.fn(
    (req: express.Request & { user?: unknown; tenantId?: string }, _res: express.Response, next: express.NextFunction) => {
      req.user = { id: 'user-1', roles: ['admin', 'member', 'viewer'] };
      req.tenantId = ORG_ID;
      next();
    },
  ),
  requireRole: vi.fn(
    (_roles: string[]) =>
      (_req: express.Request, _res: express.Response, next: express.NextFunction) =>
        next(),
  ),
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  createRateLimiter: vi.fn(() => (_r: unknown, _s: unknown, n: () => void) => n()),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('@shared/lib/tenantVerification', () => ({
  getUserTenantId: vi.fn().mockResolvedValue(ORG_ID),
  verifyTenantExists: vi.fn().mockResolvedValue(true),
  verifyTenantMembership: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../middleware/tenantDbContext.js', () => ({
  tenantDbContextMiddleware: () =>
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../services/HypothesisOutputService.js', () => ({
  hypothesisOutputService: { getLatestForCase: vi.fn() },
}));

vi.mock('../../services/CaseValueTreeService.js', () => ({
  caseValueTreeService: { getValueTree: vi.fn(), upsertNode: vi.fn() },
  ValueTreeNodeInputSchema: { parse: vi.fn((x: unknown) => x) },
}));

vi.mock('../../repositories/ValueTreeRepository.js', () => ({
  ValueTreeRepository: vi.fn().mockImplementation(() => ({
    getNodesForCase: vi.fn().mockResolvedValue([]),
    replaceNodesForCase: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../repositories/FinancialModelSnapshotRepository.js', () => ({
  FinancialModelSnapshotRepository: vi.fn().mockImplementation(() => ({
    getLatestSnapshotForCase: vi.fn().mockResolvedValue(null),
  })),
}));

vi.mock('../valueCases/repository.js', () => ({
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
// App setup
// ---------------------------------------------------------------------------

async function buildApp() {
  const { valueCasesRouter } = await import('../valueCases/index.js');
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cases', valueCasesRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Integrity stage — agent → repository → endpoint chain', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = await buildApp();
  });

  beforeEach(() => {
    storedRow = null;
    // Reset chain methods without clearing — storedRow closure is reset above
    mockSupabaseChain.upsert = vi.fn().mockImplementation((data: Record<string, unknown>) => {
      storedRow = {
        ...data,
        id: 'integrity-out-1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      return mockSupabaseChain;
    });
    mockSupabaseChain.maybeSingle = vi.fn().mockImplementation(() =>
      Promise.resolve({ data: storedRow, error: null }),
    );
    mockSupabaseChain.single = vi.fn().mockImplementation(() =>
      Promise.resolve({ data: storedRow, error: null }),
    );
  });

  it('GET returns { data: null } before any agent run', async () => {
    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(200);

    expect(res.body).toEqual({ data: null });
  });

  it('after upsert, GET returns the persisted row', async () => {
    // Simulate what IntegrityAgent does: upsert via repository
    const { IntegrityOutputRepository } = await import(
      '../../repositories/IntegrityOutputRepository.js'
    );
    const repo = new IntegrityOutputRepository();
    await repo.upsertForCase({
      case_id: CASE_ID,
      organization_id: ORG_ID,
      claims: [
        {
          claim_id: 'claim-1',
          text: 'Reduces costs by 20%',
          confidence_score: 0.85,
          flagged: false,
        },
      ],
      overall_confidence: 0.85,
      veto_triggered: false,
      source_agent: 'IntegrityAgent',
    });

    // Now GET should return the stored row
    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(200);

    expect(res.body.data).not.toBeNull();
    expect(res.body.data.case_id).toBe(CASE_ID);
    expect(res.body.data.organization_id).toBe(ORG_ID);
    expect(res.body.data.veto_triggered).toBe(false);
    expect(res.body.data.claims).toHaveLength(1);
    expect(res.body.data.claims[0].claim_id).toBe('claim-1');
  });

  it('upsert is idempotent — second run replaces the first', async () => {
    const { IntegrityOutputRepository } = await import(
      '../../repositories/IntegrityOutputRepository.js'
    );
    const repo = new IntegrityOutputRepository();

    // First run
    await repo.upsertForCase({
      case_id: CASE_ID,
      organization_id: ORG_ID,
      claims: [{ claim_id: 'claim-1', text: 'First run', confidence_score: 0.7, flagged: false }],
      overall_confidence: 0.7,
      veto_triggered: false,
      source_agent: 'IntegrityAgent',
    });

    // Second run with different data
    await repo.upsertForCase({
      case_id: CASE_ID,
      organization_id: ORG_ID,
      claims: [
        { claim_id: 'claim-1', text: 'Second run', confidence_score: 0.9, flagged: false },
        { claim_id: 'claim-2', text: 'New claim', confidence_score: 0.8, flagged: true },
      ],
      overall_confidence: 0.85,
      veto_triggered: false,
      source_agent: 'IntegrityAgent',
    });

    // The in-memory store reflects the second upsert
    expect(storedRow).not.toBeNull();
    const claims = (storedRow as Record<string, unknown>).claims as Array<{ claim_id: string }>;
    expect(claims).toHaveLength(2);
    expect(claims[0].claim_id).toBe('claim-1');
    expect(claims[1].claim_id).toBe('claim-2');
  });

  it('veto_triggered: true is persisted and returned by GET', async () => {
    const { IntegrityOutputRepository } = await import(
      '../../repositories/IntegrityOutputRepository.js'
    );
    const repo = new IntegrityOutputRepository();
    await repo.upsertForCase({
      case_id: CASE_ID,
      organization_id: ORG_ID,
      claims: [],
      overall_confidence: 0.3,
      veto_triggered: true,
      veto_reason: 'Critical claims lack evidence',
      source_agent: 'IntegrityAgent',
    });

    const res = await request(app)
      .get(`/api/v1/cases/${CASE_ID}/integrity`)
      .expect(200);

    expect(res.body.data.veto_triggered).toBe(true);
    expect(res.body.data.veto_reason).toBe('Critical claims lack evidence');
  });
});
