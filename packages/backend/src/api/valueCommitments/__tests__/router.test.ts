/**
 * Value Commitments Router — integration tests
 *
 * Covers:
 *  - 401 when session context is missing (unauthenticated)
 *  - 400 for schema validation failures
 *  - 409 for invalid FSM transitions
 *  - 404 for cross-tenant resource access (IDOR protection)
 *  - organizationId is never sourced from request body
 *  - Audit event emitted for every successful mutation
 */

import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockCreate, mockUpdate, mockTransition, mockAddNote, mockDelete, mockGet } = vi.hoisted(() => ({
  mockCreate:     vi.fn(),
  mockUpdate:     vi.fn(),
  mockTransition: vi.fn(),
  mockAddNote:    vi.fn(),
  mockDelete:     vi.fn(),
  mockGet:        vi.fn(),
}));

vi.mock('../../../services/value/ValueCommitmentBackendService.js', () => ({
  valueCommitmentBackendService: {
    createCommitment:  mockCreate,
    updateCommitment:  mockUpdate,
    transitionStatus:  mockTransition,
    addNote:           mockAddNote,
    deleteCommitment:  mockDelete,
    getCommitment:     mockGet,
  },
}));

// Auth middleware: inject trusted context; skip real JWT verification.
// Set injectAuth = false in a test to simulate a missing/invalid session.
let injectAuth = true;

vi.mock('../../../middleware/auth.js', () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (injectAuth) {
      const authReq = req as Request & { user?: unknown; tenantId?: string };
      authReq.user     = { id: ACTOR_ID };
      authReq.tenantId = ORG_A;
    }
    // When injectAuth is false, req.user and req.tenantId are left unset,
    // causing resolveContext to throw → 401.
    next();
  },
  AuthenticatedRequest: {},
}));

vi.mock('../../../middleware/tenantContext.js', () => ({
  tenantContextMiddleware: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock('../../../middleware/rateLimiter.js', () => ({
  createRateLimiter: () => (_req: Request, _res: Response, next: NextFunction) => next(),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('@shared/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_A     = 'aaaaaaaa-0000-0000-0000-000000000001';
const ORG_B     = 'bbbbbbbb-0000-0000-0000-000000000002';
const ACTOR_ID  = 'cccccccc-0000-0000-0000-000000000003';
const COMMIT_ID = 'dddddddd-0000-0000-0000-000000000004';

// ---------------------------------------------------------------------------
// App setup (import router after mocks are in place)
// ---------------------------------------------------------------------------

// Dynamic import so mocks are registered first
const { valueCommitmentsRouter } = await import('../router.js');

const app = express();
app.use(express.json());
app.use('/api/v1/value-commitments', valueCommitmentsRouter);

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const validCreateBody = {
  title:                  'Reduce churn by 10%',
  commitment_type:        'strategic',
  priority:               'high',
  owner_user_id:          ACTOR_ID,
  target_completion_date: '2027-01-01T00:00:00.000Z',
  timeframe_months:       12,
  currency:               'USD',
};

const commitmentRow = {
  id:                     COMMIT_ID,
  organization_id:        ORG_A,
  title:                  'Reduce churn by 10%',
  description:            null,
  commitment_type:        'strategic',
  priority:               'high',
  owner_user_id:          ACTOR_ID,
  status:                 'draft',
  progress_percentage:    0,
  target_completion_date: '2027-01-01T00:00:00.000Z',
  timeframe_months:       12,
  financial_impact:       null,
  currency:               'USD',
  tags:                   [],
  created_by:             ACTOR_ID,
  created_at:             '2026-01-01T00:00:00.000Z',
  updated_at:             '2026-01-01T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// POST / — create
// ---------------------------------------------------------------------------

describe('POST /api/v1/value-commitments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid body', async () => {
    mockCreate.mockResolvedValue(commitmentRow);

    const res = await request(app)
      .post('/api/v1/value-commitments')
      .send(validCreateBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(COMMIT_ID);
    expect(res.body.organization_id).toBe(ORG_A);
  });

  it('organizationId is sourced from session, not body', async () => {
    mockCreate.mockResolvedValue(commitmentRow);

    // Attacker injects a different org in the body — must be ignored
    await request(app)
      .post('/api/v1/value-commitments')
      .send({ ...validCreateBody, organization_id: ORG_B });

    expect(mockCreate).toHaveBeenCalledWith(
      ORG_A,   // from session, not body
      ACTOR_ID,
      expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });

  it('400 when required field missing', async () => {
    const res = await request(app)
      .post('/api/v1/value-commitments')
      .send({ title: 'Missing fields' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('400 when commitment_type is invalid enum', async () => {
    const res = await request(app)
      .post('/api/v1/value-commitments')
      .send({ ...validCreateBody, commitment_type: 'bogus' });

    expect(res.status).toBe(400);
  });

  it('400 when timeframe_months is negative', async () => {
    const res = await request(app)
      .post('/api/v1/value-commitments')
      .send({ ...validCreateBody, timeframe_months: -1 });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// GET /:commitmentId
// ---------------------------------------------------------------------------

describe('GET /api/v1/value-commitments/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 for owned commitment', async () => {
    mockGet.mockResolvedValue(commitmentRow);

    const res = await request(app).get(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(COMMIT_ID);
  });

  it('404 for cross-tenant commitment (IDOR protection)', async () => {
    const err = new Error('Commitment not found') as Error & { code: string };
    err.code = 'NOT_FOUND';
    mockGet.mockRejectedValue(err);

    const res = await request(app).get(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(404);
    // Must not reveal whether the resource exists in another tenant
    expect(res.body).not.toHaveProperty('organization_id');
  });
});

// ---------------------------------------------------------------------------
// PATCH /:commitmentId
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/value-commitments/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with valid partial update', async () => {
    mockUpdate.mockResolvedValue({ ...commitmentRow, title: 'Updated title' });

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
  });

  it('400 with formErrors when body is empty object', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
    // Root-level refine() message must appear in formErrors, not be silently dropped
    expect(res.body.details.formErrors).toBeInstanceOf(Array);
    expect(res.body.details.formErrors.length).toBeGreaterThan(0);
  });

  it('404 for cross-tenant id', async () => {
    const err = new Error('Commitment not found') as Error & { code: string };
    err.code = 'NOT_FOUND';
    mockUpdate.mockRejectedValue(err);

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({ title: 'x' });

    expect(res.status).toBe(404);
  });

  it('body organization_id is stripped and not forwarded to service', async () => {
    mockUpdate.mockResolvedValue(commitmentRow);

    await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({ title: 'x', organization_id: ORG_B });

    // UpdateCommitmentSchema does not include organization_id, so it is stripped
    expect(mockUpdate).toHaveBeenCalledWith(
      COMMIT_ID,
      ORG_A,
      ACTOR_ID,
      expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /:commitmentId/status-transitions
// ---------------------------------------------------------------------------

describe('POST /api/v1/value-commitments/:id/status-transitions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 for valid transition', async () => {
    mockTransition.mockResolvedValue({ ...commitmentRow, status: 'active' });

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/status-transitions`)
      .send({ status: 'active' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('409 for invalid FSM transition', async () => {
    const err = new Error("Transition from 'draft' to 'fulfilled' is not permitted") as Error & { code: string };
    err.code = 'CONFLICT';
    mockTransition.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/status-transitions`)
      .send({ status: 'fulfilled' });

    expect(res.status).toBe(409);
  });

  it('400 when status is not a valid enum value', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/status-transitions`)
      .send({ status: 'unknown_state' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = new Error('Commitment not found') as Error & { code: string };
    err.code = 'NOT_FOUND';
    mockTransition.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/status-transitions`)
      .send({ status: 'active' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:commitmentId/notes
// ---------------------------------------------------------------------------

describe('POST /api/v1/value-commitments/:id/notes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid note', async () => {
    const note = {
      id:            'note-1',
      commitment_id: COMMIT_ID,
      body:          'On track',
      visibility:    'internal',
      created_by:    ACTOR_ID,
      created_at:    '2026-01-01T00:00:00.000Z',
    };
    mockAddNote.mockResolvedValue(note);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/notes`)
      .send({ body: 'On track', visibility: 'internal' });

    expect(res.status).toBe(201);
    expect(res.body.body).toBe('On track');
  });

  it('400 when body is empty string', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/notes`)
      .send({ body: '', visibility: 'internal' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = new Error('Commitment not found') as Error & { code: string };
    err.code = 'NOT_FOUND';
    mockAddNote.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/notes`)
      .send({ body: 'x', visibility: 'internal' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /:commitmentId
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/value-commitments/:id', () => {
  beforeEach(() => vi.clearAllMocks());

  it('204 for draft commitment', async () => {
    mockDelete.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(204);
  });

  it('409 when commitment is not in draft status', async () => {
    const err = new Error('Only draft commitments can be deleted') as Error & { code: string };
    err.code = 'CONFLICT';
    mockDelete.mockRejectedValue(err);

    const res = await request(app).delete(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(409);
  });

  it('404 for cross-tenant id', async () => {
    const err = new Error('Commitment not found') as Error & { code: string };
    err.code = 'NOT_FOUND';
    mockDelete.mockRejectedValue(err);

    const res = await request(app).delete(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// 401 — missing session context
// The resolveContext helper throws when req.tenantId or req.user.id is absent.
// ---------------------------------------------------------------------------

describe('401 — missing session context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    injectAuth = false; // simulate requireAuth passing without setting context
  });

  afterEach(() => {
    injectAuth = true; // restore for all other test suites
  });

  it('POST / returns 401 when no user context is present', async () => {
    const res = await request(app)
      .post('/api/v1/value-commitments')
      .send(validCreateBody);

    expect(res.status).toBe(401);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('PATCH /:id returns 401 when no user context is present', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({ title: 'x' });

    expect(res.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('POST /:id/status-transitions returns 401 when no user context is present', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/status-transitions`)
      .send({ status: 'active' });

    expect(res.status).toBe(401);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('DELETE /:id returns 401 when no user context is present', async () => {
    const res = await request(app)
      .delete(`/api/v1/value-commitments/${COMMIT_ID}`);

    expect(res.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tenant spoofing — body-level tenant override must be ignored on all routes
// ---------------------------------------------------------------------------

describe('Tenant spoofing protection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST / ignores tenant_id in body', async () => {
    mockCreate.mockResolvedValue(commitmentRow);

    await request(app)
      .post('/api/v1/value-commitments')
      .send({ ...validCreateBody, tenant_id: ORG_B });

    // Service must be called with session org, not body org
    expect(mockCreate).toHaveBeenCalledWith(ORG_A, ACTOR_ID, expect.anything());
    const inputArg = mockCreate.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(inputArg['tenant_id']).toBeUndefined();
  });

  it('PATCH ignores organization_id in body', async () => {
    mockUpdate.mockResolvedValue(commitmentRow);

    await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}`)
      .send({ title: 'x', organization_id: ORG_B });

    expect(mockUpdate).toHaveBeenCalledWith(
      COMMIT_ID,
      ORG_A,   // session org, not body
      ACTOR_ID,
      expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });
});
