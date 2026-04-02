import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { valueCasesRouter } from '../index.js';

const { queryMock, auditLogSpy } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  auditLogSpy: vi.fn().mockResolvedValue({ id: 'audit-1' }),
}));

vi.mock('../../../middleware/auth', () => ({
  requireAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireRole: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../middleware/tenantContext', () => ({
  tenantContextMiddleware: () => (req: any, _res: any, next: any) => {
    req.tenantId = '550e8400-e29b-41d4-a716-446655440001';
    req.organizationId = '550e8400-e29b-41d4-a716-446655440001';
    req.user = { id: 'user-123', email: 'reviewer@test.dev' };
    next();
  },
}));

vi.mock('../../../middleware/tenantDbContext', () => ({
  tenantDbContextMiddleware: () => (req: any, _res: any, next: any) => {
    req.db = { query: queryMock, tx: queryMock };
    next();
  },
}));


vi.mock('../../../lib/agent-fabric/agents/DiscoveryAgent.js', () => ({
  getDiscoveryAgent: () => ({
    startDiscovery: vi.fn(),
    getRunState: vi.fn(),
    cancelDiscovery: vi.fn(),
  }),
}));

vi.mock('../../../middleware/rateLimiter', () => ({
  createRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  RateLimitTier: { STANDARD: 'standard', STRICT: 'strict' },
}));

vi.mock('../requireOrganizationContext', () => ({
  requireOrganizationContext: (req: any, _res: any, next: any) => {
    req.organizationId = req.organizationId ?? '550e8400-e29b-41d4-a716-446655440001';
    next();
  },
}));

vi.mock('../crud.routes', () => ({ registerCrudRoutes: vi.fn() }));
vi.mock('../economic.routes', () => ({ registerEconomicRoutes: vi.fn() }));
vi.mock('../integrity.routes', () => ({ registerIntegrityRoutes: vi.fn() }));
vi.mock('../valueTree.routes', () => ({ registerValueTreeRoutes: vi.fn() }));
vi.mock('../backHalf', () => ({ backHalfRouter: express.Router() }));
vi.mock('../baseline', () => ({ default: express.Router() }));

vi.mock('../../../services/security/AuditLogService.js', () => ({
  auditLogService: { logAudit: auditLogSpy },
}));

describe('checkpoint review endpoints', () => {
  let app: Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/v1/cases', valueCasesRouter);
  });

  it('returns pending status when checkpoint has no persisted decision', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000/checkpoints/review?runId=run-1&stageId=hypothesis')
      .expect(200);

    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.runId).toBe('run-1');
  });

  it('persists decision metadata and emits audit log entry', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [] }) // select existing
      .mockResolvedValueOnce({ rows: [{ id: 'cp-100' }] }) // insert pending
      .mockResolvedValueOnce({ rows: [] }); // update decision

    const response = await request(app)
      .post('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000/checkpoints/review')
      .send({
        runId: 'run-1',
        stageId: 'hypothesis',
        decision: 'changes_requested',
        rationale: 'Need additional evidence',
        riskLevel: 'high',
      })
      .expect(200);

    expect(response.body.data.status).toBe('changes_requested');
    expect(response.body.data.actorId).toBe('user-123');
    const updateQueryParams = queryMock.mock.calls[2]?.[1] as unknown[];
    const decisionPayload = JSON.parse(String(updateQueryParams[3]));
    const auditPayload = JSON.parse(String(updateQueryParams[4]));
    expect(decisionPayload).toEqual(expect.objectContaining({
      review_status: 'changes_requested',
      actor_id: 'user-123',
      rationale: 'Need additional evidence',
      run_id: 'run-1',
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      stage_id: 'hypothesis',
    }));
    expect(auditPayload[0]).toEqual(expect.objectContaining({
      event: 'review_decision_recorded',
      actor_id: 'user-123',
      decision: 'changes_requested',
      rationale: 'Need additional evidence',
      run_id: 'run-1',
      case_id: '550e8400-e29b-41d4-a716-446655440000',
      stage_id: 'hypothesis',
    }));
    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'checkpoint_review_changes_requested',
        resourceType: 'workflow_checkpoint',
        details: expect.objectContaining({ runId: 'run-1', caseId: '550e8400-e29b-41d4-a716-446655440000' }),
      }),
    );
  });

  it('requires rationale for approve decision in high-risk stages', async () => {
    await request(app)
      .post('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000/checkpoints/review')
      .send({
        runId: 'run-1',
        stageId: 'hypothesis',
        decision: 'approved',
        riskLevel: 'high',
      })
      .expect(400);

    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns persisted status on follow-up fetch (session resume)', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'cp-100',
        status: 'approved',
        decision: { rationale: 'Looks good', actor_id: 'user-123', decided_at: '2026-03-28T12:00:00.000Z' },
        payload: { risk_level: 'medium' },
      }],
    });

    const response = await request(app)
      .get('/api/v1/cases/550e8400-e29b-41d4-a716-446655440000/checkpoints/review?runId=run-1&stageId=hypothesis')
      .expect(200);

    expect(response.body.data.status).toBe('approved');
    expect(response.body.data.rationale).toBe('Looks good');
    expect(response.body.data.actorId).toBe('user-123');
  });
});
