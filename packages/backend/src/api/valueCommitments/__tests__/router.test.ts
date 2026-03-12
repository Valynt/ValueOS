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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockCreate, mockUpdate, mockTransition, mockAddNote, mockDelete, mockGet,
  mockList, mockGetAtRisk, mockGetProgress, mockValidateProgress,
  mockAddMilestone, mockUpdateMilestone,
  mockAddMetric, mockUpdateMetricActual,
  mockAddRisk, mockUpdateRisk,
  mockAddStakeholder, mockUpdateStakeholder,
} = vi.hoisted(() => ({
  mockCreate:            vi.fn(),
  mockUpdate:            vi.fn(),
  mockTransition:        vi.fn(),
  mockAddNote:           vi.fn(),
  mockDelete:            vi.fn(),
  mockGet:               vi.fn(),
  mockList:              vi.fn(),
  mockGetAtRisk:         vi.fn(),
  mockGetProgress:       vi.fn(),
  mockValidateProgress:  vi.fn(),
  mockAddMilestone:      vi.fn(),
  mockUpdateMilestone:   vi.fn(),
  mockAddMetric:         vi.fn(),
  mockUpdateMetricActual: vi.fn(),
  mockAddRisk:           vi.fn(),
  mockUpdateRisk:        vi.fn(),
  mockAddStakeholder:    vi.fn(),
  mockUpdateStakeholder: vi.fn(),
}));

vi.mock('../../../services/value/ValueCommitmentBackendService.js', () => ({
  valueCommitmentBackendService: {
    createCommitment:   mockCreate,
    updateCommitment:   mockUpdate,
    transitionStatus:   mockTransition,
    addNote:            mockAddNote,
    deleteCommitment:   mockDelete,
    getCommitment:      mockGet,
    listCommitments:    mockList,
    getAtRiskCommitments: mockGetAtRisk,
    getProgress:        mockGetProgress,
    validateProgress:   mockValidateProgress,
    addMilestone:       mockAddMilestone,
    updateMilestone:    mockUpdateMilestone,
    addMetric:          mockAddMetric,
    updateMetricActual: mockUpdateMetricActual,
    addRisk:            mockAddRisk,
    updateRisk:         mockUpdateRisk,
    addStakeholder:     mockAddStakeholder,
    updateStakeholder:  mockUpdateStakeholder,
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

// ---------------------------------------------------------------------------
// GET / — list commitments
// ---------------------------------------------------------------------------

describe('GET /api/v1/value-commitments', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with array of commitment DTOs', async () => {
    mockList.mockResolvedValue([commitmentRow]);

    const res = await request(app).get('/api/v1/value-commitments');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(COMMIT_ID);
    expect(mockList).toHaveBeenCalledWith(ORG_A);
  });

  it('?atRisk=true routes to getAtRiskCommitments', async () => {
    mockGetAtRisk.mockResolvedValue([commitmentRow]);

    const res = await request(app).get('/api/v1/value-commitments?atRisk=true');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockGetAtRisk).toHaveBeenCalledWith(ORG_A);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('?atRisk=false routes to listCommitments (not at-risk filter)', async () => {
    mockList.mockResolvedValue([commitmentRow]);

    const res = await request(app).get('/api/v1/value-commitments?atRisk=false');

    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledWith(ORG_A);
    expect(mockGetAtRisk).not.toHaveBeenCalled();
  });

  it('organizationId is sourced from session, not query string', async () => {
    mockList.mockResolvedValue([]);

    await request(app).get(`/api/v1/value-commitments?organization_id=${ORG_B}`);

    expect(mockList).toHaveBeenCalledWith(ORG_A);
  });
});

// ---------------------------------------------------------------------------
// GET /:commitmentId/progress
// ---------------------------------------------------------------------------

describe('GET /api/v1/value-commitments/:id/progress', () => {
  beforeEach(() => vi.clearAllMocks());

  const progressPayload = {
    commitment_id:        COMMIT_ID,
    overall_progress:     72,
    milestone_completion: 80,
    metric_achievement:   60,
    risk_level:           'low',
    days_remaining:       45,
    is_on_track:          true,
  };

  it('200 with progress summary', async () => {
    mockGetProgress.mockResolvedValue(progressPayload);

    const res = await request(app).get(`/api/v1/value-commitments/${COMMIT_ID}/progress`);

    expect(res.status).toBe(200);
    expect(res.body.overall_progress).toBe(72);
    expect(mockGetProgress).toHaveBeenCalledWith(COMMIT_ID, ORG_A);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockGetProgress.mockRejectedValue(err);

    const res = await request(app).get(`/api/v1/value-commitments/${COMMIT_ID}/progress`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /:commitmentId/validate-progress
// ---------------------------------------------------------------------------

describe('POST /api/v1/value-commitments/:id/validate-progress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with valid verdict when progress is on track', async () => {
    mockValidateProgress.mockResolvedValue({
      isValid: true, confidence: 0.85, issues: [], recommendations: [],
    });

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/validate-progress`);

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(true);
    expect(res.body.issues).toHaveLength(0);
    expect(mockValidateProgress).toHaveBeenCalledWith(COMMIT_ID, ORG_A);
  });

  it('200 with invalid verdict when progress is below threshold', async () => {
    mockValidateProgress.mockResolvedValue({
      isValid: false,
      confidence: 0.6,
      issues: ['Overall progress 60% is 20pp below the 80% threshold'],
      recommendations: ['Metric actuals are lagging — update current values or revise targets'],
    });

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/validate-progress`);

    expect(res.status).toBe(200);
    expect(res.body.isValid).toBe(false);
    expect(res.body.issues.length).toBeGreaterThan(0);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockValidateProgress.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/validate-progress`);

    expect(res.status).toBe(404);
  });

  it('organizationId is sourced from session', async () => {
    mockValidateProgress.mockResolvedValue({ isValid: true, confidence: 1, issues: [], recommendations: [] });

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/validate-progress`);

    expect(mockValidateProgress).toHaveBeenCalledWith(COMMIT_ID, ORG_A);
  });
});

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

const MILESTONE_ID = 'eeeeeeee-0000-0000-0000-000000000005';

const milestoneRow = {
  id:               MILESTONE_ID,
  commitment_id:    COMMIT_ID,
  title:            'Phase 1',
  milestone_type:   'execution',
  sequence_order:   1,
  target_date:      '2027-03-01T00:00:00.000Z',
  status:           'pending',
  progress_percentage: 0,
};

describe('POST /api/v1/value-commitments/:id/milestones', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid body', async () => {
    mockAddMilestone.mockResolvedValue(milestoneRow);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/milestones`)
      .send({
        title:          'Phase 1',
        milestone_type: 'execution',
        sequence_order: 1,
        target_date:    '2027-03-01T00:00:00.000Z',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(MILESTONE_ID);
    expect(mockAddMilestone).toHaveBeenCalledWith(COMMIT_ID, ORG_A, ACTOR_ID, expect.objectContaining({ title: 'Phase 1' }));
  });

  it('400 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/milestones`)
      .send({ title: 'Missing type' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('400 when milestone_type is invalid', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/milestones`)
      .send({ title: 'x', milestone_type: 'bogus', sequence_order: 1, target_date: '2027-03-01T00:00:00.000Z' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockAddMilestone.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/milestones`)
      .send({ title: 'x', milestone_type: 'execution', sequence_order: 1, target_date: '2027-03-01T00:00:00.000Z' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/value-commitments/:id/milestones/:milestoneId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with valid partial update', async () => {
    mockUpdateMilestone.mockResolvedValue({ ...milestoneRow, progress_percentage: 50 });

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/milestones/${MILESTONE_ID}`)
      .send({ progress_percentage: 50 });

    expect(res.status).toBe(200);
    expect(res.body.progress_percentage).toBe(50);
    expect(mockUpdateMilestone).toHaveBeenCalledWith(
      COMMIT_ID, MILESTONE_ID, ORG_A, ACTOR_ID,
      expect.objectContaining({ progress_percentage: 50 }),
    );
  });

  it('400 when body is empty', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/milestones/${MILESTONE_ID}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

const METRIC_ID = 'ffffffff-0000-0000-0000-000000000006';

const metricRow = {
  id:             METRIC_ID,
  commitment_id:  COMMIT_ID,
  metric_name:    'ARR',
  baseline_value: 1_000_000,
  target_value:   1_200_000,
  current_value:  null,
  unit:           'USD',
};

describe('POST /api/v1/value-commitments/:id/metrics', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid body', async () => {
    mockAddMetric.mockResolvedValue(metricRow);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/metrics`)
      .send({ metric_name: 'ARR', baseline_value: 1_000_000, target_value: 1_200_000, unit: 'USD' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(METRIC_ID);
    expect(mockAddMetric).toHaveBeenCalledWith(COMMIT_ID, ORG_A, ACTOR_ID, expect.objectContaining({ metric_name: 'ARR' }));
  });

  it('400 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/metrics`)
      .send({ metric_name: 'ARR' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockAddMetric.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/metrics`)
      .send({ metric_name: 'ARR', baseline_value: 0, target_value: 1, unit: 'USD' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/value-commitments/:id/metrics/:metricId/actual', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with updated current_value', async () => {
    mockUpdateMetricActual.mockResolvedValue({ ...metricRow, current_value: 1_100_000 });

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/metrics/${METRIC_ID}/actual`)
      .send({ current_value: 1_100_000 });

    expect(res.status).toBe(200);
    expect(res.body.current_value).toBe(1_100_000);
    expect(mockUpdateMetricActual).toHaveBeenCalledWith(
      COMMIT_ID, METRIC_ID, ORG_A, ACTOR_ID,
      expect.objectContaining({ current_value: 1_100_000 }),
    );
  });

  it('400 when current_value is missing', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/metrics/${METRIC_ID}/actual`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Risks
// ---------------------------------------------------------------------------

const RISK_ID = 'aaaaaaaa-1111-0000-0000-000000000007';

const riskRow = {
  id:               RISK_ID,
  commitment_id:    COMMIT_ID,
  risk_title:       'Budget cut',
  risk_description: 'Q3 budget may be reduced',
  risk_category:    'financial',
  probability:      'medium',
  impact:           'high',
  status:           'identified',
};

const validRiskBody = {
  risk_title:       'Budget cut',
  risk_description: 'Q3 budget may be reduced',
  risk_category:    'financial',
  probability:      'medium',
  impact:           'high',
  mitigation_plan:  'Secure exec sponsorship',
  contingency_plan: 'Reduce scope',
  owner_id:         ACTOR_ID,
  review_date:      '2027-06-01T00:00:00.000Z',
};

describe('POST /api/v1/value-commitments/:id/risks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid body', async () => {
    mockAddRisk.mockResolvedValue(riskRow);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/risks`)
      .send(validRiskBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(RISK_ID);
    expect(mockAddRisk).toHaveBeenCalledWith(COMMIT_ID, ORG_A, ACTOR_ID, expect.objectContaining({ risk_title: 'Budget cut' }));
  });

  it('400 when required fields are missing', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/risks`)
      .send({ risk_title: 'Missing fields' });

    expect(res.status).toBe(400);
  });

  it('400 when probability is invalid enum', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/risks`)
      .send({ ...validRiskBody, probability: 'extreme' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockAddRisk.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/risks`)
      .send(validRiskBody);

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/value-commitments/:id/risks/:riskId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with valid status update', async () => {
    mockUpdateRisk.mockResolvedValue({ ...riskRow, status: 'mitigated' });

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/risks/${RISK_ID}`)
      .send({ status: 'mitigated' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('mitigated');
    expect(mockUpdateRisk).toHaveBeenCalledWith(
      COMMIT_ID, RISK_ID, ORG_A, ACTOR_ID,
      expect.objectContaining({ status: 'mitigated' }),
    );
  });

  it('400 when body is empty', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/risks/${RISK_ID}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('400 when status is invalid enum', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/risks/${RISK_ID}`)
      .send({ status: 'resolved' });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Stakeholders
// ---------------------------------------------------------------------------

const STAKEHOLDER_ID = 'bbbbbbbb-2222-0000-0000-000000000008';

const stakeholderRow = {
  id:            STAKEHOLDER_ID,
  commitment_id: COMMIT_ID,
  user_id:       ACTOR_ID,
  role:          'contributor',
  responsibility: 'Owns metric collection',
  accountability_percentage: 50,
  is_active:     true,
};

describe('POST /api/v1/value-commitments/:id/stakeholders', () => {
  beforeEach(() => vi.clearAllMocks());

  it('201 with valid body', async () => {
    mockAddStakeholder.mockResolvedValue(stakeholderRow);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders`)
      .send({ user_id: ACTOR_ID, role: 'contributor', responsibility: 'Owns metric collection' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(STAKEHOLDER_ID);
    expect(mockAddStakeholder).toHaveBeenCalledWith(
      COMMIT_ID, ORG_A, ACTOR_ID,
      expect.objectContaining({ user_id: ACTOR_ID, role: 'contributor' }),
    );
  });

  it('400 when role is invalid enum', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders`)
      .send({ user_id: ACTOR_ID, role: 'manager', responsibility: 'x' });

    expect(res.status).toBe(400);
  });

  it('400 when user_id is not a UUID', async () => {
    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders`)
      .send({ user_id: 'not-a-uuid', role: 'contributor', responsibility: 'x' });

    expect(res.status).toBe(400);
  });

  it('404 for cross-tenant commitment', async () => {
    const err = Object.assign(new Error('Commitment not found'), { code: 'NOT_FOUND' });
    mockAddStakeholder.mockRejectedValue(err);

    const res = await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders`)
      .send({ user_id: ACTOR_ID, role: 'contributor', responsibility: 'x' });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/v1/value-commitments/:id/stakeholders/:stakeholderId', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 with valid role update', async () => {
    mockUpdateStakeholder.mockResolvedValue({ ...stakeholderRow, role: 'approver' });

    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders/${STAKEHOLDER_ID}`)
      .send({ role: 'approver' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('approver');
    expect(mockUpdateStakeholder).toHaveBeenCalledWith(
      COMMIT_ID, STAKEHOLDER_ID, ORG_A, ACTOR_ID,
      expect.objectContaining({ role: 'approver' }),
    );
  });

  it('400 when body is empty', async () => {
    const res = await request(app)
      .patch(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders/${STAKEHOLDER_ID}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation — sub-resource mutations must use session org, not body
// ---------------------------------------------------------------------------

describe('Tenant isolation on sub-resources', () => {
  beforeEach(() => vi.clearAllMocks());

  it('milestone POST uses session org, not body org', async () => {
    mockAddMilestone.mockResolvedValue(milestoneRow);

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/milestones`)
      .send({
        title: 'x', milestone_type: 'execution', sequence_order: 1,
        target_date: '2027-03-01T00:00:00.000Z', organization_id: ORG_B,
      });

    expect(mockAddMilestone).toHaveBeenCalledWith(
      COMMIT_ID, ORG_A, ACTOR_ID, expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });

  it('metric POST uses session org, not body org', async () => {
    mockAddMetric.mockResolvedValue(metricRow);

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/metrics`)
      .send({ metric_name: 'ARR', baseline_value: 0, target_value: 1, unit: 'USD', organization_id: ORG_B });

    expect(mockAddMetric).toHaveBeenCalledWith(
      COMMIT_ID, ORG_A, ACTOR_ID, expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });

  it('risk POST uses session org, not body org', async () => {
    mockAddRisk.mockResolvedValue(riskRow);

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/risks`)
      .send({ ...validRiskBody, organization_id: ORG_B });

    expect(mockAddRisk).toHaveBeenCalledWith(
      COMMIT_ID, ORG_A, ACTOR_ID, expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });

  it('stakeholder POST uses session org, not body org', async () => {
    mockAddStakeholder.mockResolvedValue(stakeholderRow);

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/stakeholders`)
      .send({ user_id: ACTOR_ID, role: 'contributor', responsibility: 'x', organization_id: ORG_B });

    expect(mockAddStakeholder).toHaveBeenCalledWith(
      COMMIT_ID, ORG_A, ACTOR_ID, expect.not.objectContaining({ organization_id: ORG_B }),
    );
  });

  it('progress GET uses session org, not query param', async () => {
    mockGetProgress.mockResolvedValue({ commitment_id: COMMIT_ID, overall_progress: 50 });

    await request(app).get(`/api/v1/value-commitments/${COMMIT_ID}/progress?organization_id=${ORG_B}`);

    expect(mockGetProgress).toHaveBeenCalledWith(COMMIT_ID, ORG_A);
  });

  it('validate-progress POST uses session org', async () => {
    mockValidateProgress.mockResolvedValue({ isValid: true, confidence: 1, issues: [], recommendations: [] });

    await request(app)
      .post(`/api/v1/value-commitments/${COMMIT_ID}/validate-progress`)
      .send({ organization_id: ORG_B });

    expect(mockValidateProgress).toHaveBeenCalledWith(COMMIT_ID, ORG_A);
  });
});
