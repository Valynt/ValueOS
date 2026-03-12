/**
 * ValueCommitmentTrackingService tests
 *
 * Verifies:
 *  - All write methods call the correct backend endpoint
 *  - tenant_id / organization_id are never forwarded in the request body
 *  - CommitmentApiError is thrown with the right status on failure
 *  - Feature flag "false" returns stub data without calling apiClient
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that reference them
// ---------------------------------------------------------------------------

const { mockPost, mockPatch, mockDelete, mockGet } = vi.hoisted(() => ({
  mockPost:   vi.fn(),
  mockPatch:  vi.fn(),
  mockDelete: vi.fn(),
  mockGet:    vi.fn(),
}));

vi.mock('../../api/client/unified-api-client', () => ({
  apiClient: {
    post:   mockPost,
    patch:  mockPatch,
    delete: mockDelete,
    get:    mockGet,
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import {
  ValueCommitmentTrackingService,
  CommitmentApiError,
} from '../ValueCommitmentTrackingService';
import type { CommitmentDto } from '../../types/value-commitment-tracking';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_ID  = 'aaaa-0000';
const USER_ID    = 'bbbb-0001';
const SESSION_ID = 'cccc-0002';
const COMMIT_ID  = 'dddd-0003';

const commitmentDto: CommitmentDto = {
  id:                     COMMIT_ID,
  organization_id:        'org-1',
  title:                  'Reduce churn',
  description:            null,
  commitment_type:        'strategic',
  priority:               'high',
  owner_user_id:          USER_ID,
  status:                 'draft',
  progress_percentage:    0,
  target_completion_date: '2027-01-01T00:00:00.000Z',
  timeframe_months:       12,
  financial_impact:       null,
  currency:               'USD',
  tags:                   [],
  created_by:             USER_ID,
  created_at:             '2026-01-01T00:00:00.000Z',
  updated_at:             '2026-01-01T00:00:00.000Z',
};

const ok = <T>(data: T) => ({ success: true, data });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeService(flagValue = 'true') {
  vi.stubEnv('VITE_USE_BACKEND_COMMITMENT_API', flagValue);
  return new ValueCommitmentTrackingService();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValueCommitmentTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // -------------------------------------------------------------------------
  // createCommitment
  // -------------------------------------------------------------------------

  describe('createCommitment', () => {
    it('POSTs to /api/v1/value-commitments and returns CommitmentDto', async () => {
      mockPost.mockResolvedValue(ok(commitmentDto));
      const svc = makeService();

      const result = await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
        title:                  'Reduce churn',
        commitment_type:        'strategic',
        priority:               'high',
        owner_user_id:          USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z',
        timeframe_months:       12,
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/value-commitments',
        expect.objectContaining({ title: 'Reduce churn' }),
      );
      expect(result.id).toBe(COMMIT_ID);
    });

    it('strips tenant_id and organization_id from the request body', async () => {
      mockPost.mockResolvedValue(ok(commitmentDto));
      const svc = makeService();

      const input = {
        title:                  'Test',
        commitment_type:        'financial' as const,
        owner_user_id:          USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z',
        timeframe_months:       6,
        tenant_id:              'attacker-org',
        organization_id:        'attacker-org',
      };

      await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, input as Parameters<typeof svc.createCommitment>[3]);

      const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['tenant_id']).toBeUndefined();
      expect(body['organization_id']).toBeUndefined();
    });

    it('throws CommitmentApiError on backend failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bad input' } });
      const svc = makeService();

      await expect(
        svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
          title: 'x', commitment_type: 'strategic', owner_user_id: USER_ID,
          target_completion_date: '2027-01-01T00:00:00.000Z', timeframe_months: 1,
        }),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');

      const result = await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
        title: 'Stub test', commitment_type: 'strategic', owner_user_id: USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z', timeframe_months: 1,
      });

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.id).toMatch(/^stub-/);
    });
  });

  // -------------------------------------------------------------------------
  // updateCommitment
  // -------------------------------------------------------------------------

  describe('updateCommitment', () => {
    it('PATCHes to /api/v1/value-commitments/:id', async () => {
      mockPatch.mockResolvedValue(ok({ ...commitmentDto, title: 'Updated' }));
      const svc = makeService();

      const result = await svc.updateCommitment(COMMIT_ID, TENANT_ID, USER_ID, { title: 'Updated' });

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}`,
        expect.objectContaining({ title: 'Updated' }),
      );
      expect(result.title).toBe('Updated');
    });

    it('strips organization_id from update body', async () => {
      mockPatch.mockResolvedValue(ok(commitmentDto));
      const svc = makeService();

      const updates = { title: 'x', organization_id: 'attacker' };
      await svc.updateCommitment(COMMIT_ID, TENANT_ID, USER_ID, updates as Parameters<typeof svc.updateCommitment>[3]);

      const body = mockPatch.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['organization_id']).toBeUndefined();
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.updateCommitment(COMMIT_ID, TENANT_ID, USER_ID, { title: 'x' });
      expect(mockPatch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateCommitmentStatus (status transition)
  // -------------------------------------------------------------------------

  describe('updateCommitmentStatus', () => {
    it('POSTs to /api/v1/value-commitments/:id/status-transitions', async () => {
      mockPost.mockResolvedValue(ok({ ...commitmentDto, status: 'active' }));
      const svc = makeService();

      const result = await svc.updateCommitmentStatus(COMMIT_ID, TENANT_ID, USER_ID, 'active', 10, 'Kicked off');

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/status-transitions`,
        { status: 'active', progress_percentage: 10, reason: 'Kicked off' },
      );
      expect(result.status).toBe('active');
    });

    it('omits optional fields when not provided', async () => {
      mockPost.mockResolvedValue(ok({ ...commitmentDto, status: 'cancelled' }));
      const svc = makeService();

      await svc.updateCommitmentStatus(COMMIT_ID, TENANT_ID, USER_ID, 'cancelled');

      const body = mockPost.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['progress_percentage']).toBeUndefined();
      expect(body['reason']).toBeUndefined();
    });

    it('throws CommitmentApiError on backend failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'CONFLICT', message: 'invalid transition' } });
      const svc = makeService();

      await expect(
        svc.updateCommitmentStatus(COMMIT_ID, TENANT_ID, USER_ID, 'fulfilled'),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      const result = await svc.updateCommitmentStatus(COMMIT_ID, TENANT_ID, USER_ID, 'active');
      expect(mockPost).not.toHaveBeenCalled();
      expect(result.status).toBe('active');
    });
  });

  // -------------------------------------------------------------------------
  // addNote
  // -------------------------------------------------------------------------

  describe('addNote', () => {
    it('POSTs to /api/v1/value-commitments/:id/notes', async () => {
      const note = {
        id: 'n1', commitment_id: COMMIT_ID, body: 'On track',
        visibility: 'internal' as const, created_by: USER_ID, created_at: '2026-01-01T00:00:00.000Z',
      };
      mockPost.mockResolvedValue(ok(note));
      const svc = makeService();

      const result = await svc.addNote(COMMIT_ID, TENANT_ID, USER_ID, { body: 'On track', visibility: 'internal' });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/notes`,
        { body: 'On track', visibility: 'internal' },
      );
      expect(result.body).toBe('On track');
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      const result = await svc.addNote(COMMIT_ID, TENANT_ID, USER_ID, { body: 'x' });
      expect(mockPost).not.toHaveBeenCalled();
      expect(result.id).toBe('stub');
    });
  });

  // -------------------------------------------------------------------------
  // deleteCommitment
  // -------------------------------------------------------------------------

  describe('deleteCommitment', () => {
    it('DELETEs /api/v1/value-commitments/:id', async () => {
      mockDelete.mockResolvedValue({ success: true });
      const svc = makeService();

      await svc.deleteCommitment(COMMIT_ID, TENANT_ID, USER_ID);

      expect(mockDelete).toHaveBeenCalledWith(`/api/v1/value-commitments/${COMMIT_ID}`);
    });

    it('throws CommitmentApiError on failure', async () => {
      mockDelete.mockResolvedValue({ success: false, error: { code: 'CONFLICT', message: 'not draft' } });
      const svc = makeService();

      await expect(svc.deleteCommitment(COMMIT_ID, TENANT_ID, USER_ID)).rejects.toBeInstanceOf(CommitmentApiError);
    });

    it('no-ops without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.deleteCommitment(COMMIT_ID, TENANT_ID, USER_ID);
      expect(mockDelete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getCommitment — proxies to backend GET
  // -------------------------------------------------------------------------

  describe('getCommitment', () => {
    it('GETs /api/v1/value-commitments/:id and maps to CommitmentDashboard', async () => {
      mockGet.mockResolvedValue(ok(commitmentDto));
      const svc = makeService();

      const result = await svc.getCommitment(COMMIT_ID, TENANT_ID);

      expect(mockGet).toHaveBeenCalledWith(`/api/v1/value-commitments/${COMMIT_ID}`);
      expect(result?.commitment.id).toBe(COMMIT_ID);
    });

    it('returns null on error without throwing', async () => {
      mockGet.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      const result = await svc.getCommitment(COMMIT_ID, TENANT_ID);

      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // createMilestone
  // -------------------------------------------------------------------------

  describe('createMilestone', () => {
    it('POSTs to /api/v1/value-commitments/:id/milestones', async () => {
      const milestone = { id: 'm1', commitment_id: COMMIT_ID, title: 'Phase 1', status: 'pending' };
      mockPost.mockResolvedValue(ok(milestone));
      const svc = makeService();

      const result = await svc.createMilestone(COMMIT_ID, TENANT_ID, USER_ID, {
        title: 'Phase 1',
        due_date: '2027-06-01T00:00:00.000Z',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/milestones`,
        expect.objectContaining({ title: 'Phase 1' }),
      );
      expect(result).toEqual(milestone);
    });

    it('throws CommitmentApiError on backend failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bad input' } });
      const svc = makeService();

      await expect(
        svc.createMilestone(COMMIT_ID, TENANT_ID, USER_ID, { title: 'x', due_date: '2027-01-01T00:00:00.000Z' }),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });
  });

  // -------------------------------------------------------------------------
  // updateMilestoneProgressForCommitment
  // -------------------------------------------------------------------------

  describe('updateMilestoneProgressForCommitment', () => {
    it('PATCHes to /api/v1/value-commitments/:id/milestones/:milestoneId', async () => {
      const milestone = { id: 'ms1', progress_percentage: 50, status: 'in_progress' };
      mockPatch.mockResolvedValue(ok(milestone));
      const svc = makeService();

      const result = await svc.updateMilestoneProgressForCommitment(COMMIT_ID, 'ms1', 50, 'in_progress');

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/milestones/ms1`,
        { progress_percentage: 50, status: 'in_progress' },
      );
      expect(result).toEqual(milestone);
    });

    it('omits optional fields when not provided', async () => {
      mockPatch.mockResolvedValue(ok({ id: 'ms1', progress_percentage: 100 }));
      const svc = makeService();

      await svc.updateMilestoneProgressForCommitment(COMMIT_ID, 'ms1', 100);

      const body = mockPatch.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['status']).toBeUndefined();
      expect(body['actual_date']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // updateMetricValueForCommitment
  // -------------------------------------------------------------------------

  describe('updateMetricValueForCommitment', () => {
    it('PATCHes to /api/v1/value-commitments/:id/metrics/:metricId', async () => {
      const metric = { id: 'met1', current_value: 42 };
      mockPatch.mockResolvedValue(ok(metric));
      const svc = makeService();

      const result = await svc.updateMetricValueForCommitment(COMMIT_ID, 'met1', 42);

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/metrics/met1`,
        { current_value: 42 },
      );
      expect(result).toEqual(metric);
    });

    it('includes last_measured_at when provided', async () => {
      mockPatch.mockResolvedValue(ok({ id: 'met1', current_value: 10 }));
      const svc = makeService();

      await svc.updateMetricValueForCommitment(COMMIT_ID, 'met1', 10, '2027-01-01T00:00:00.000Z');

      const body = mockPatch.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['last_measured_at']).toBe('2027-01-01T00:00:00.000Z');
    });
  });

  // -------------------------------------------------------------------------
  // createRisk
  // -------------------------------------------------------------------------

  describe('createRisk', () => {
    it('POSTs to /api/v1/value-commitments/:id/risks', async () => {
      const risk = { id: 'r1', commitment_id: COMMIT_ID, risk_title: 'Budget overrun' };
      mockPost.mockResolvedValue(ok(risk));
      const svc = makeService();

      const result = await svc.createRisk(COMMIT_ID, TENANT_ID, USER_ID, {
        risk_title: 'Budget overrun',
        risk_probability: 'high',
        risk_impact: 'high',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/risks`,
        expect.objectContaining({ risk_title: 'Budget overrun' }),
      );
      expect(result).toEqual(risk);
    });

    it('throws CommitmentApiError on backend failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bad' } });
      const svc = makeService();

      await expect(
        svc.createRisk(COMMIT_ID, TENANT_ID, USER_ID, { risk_title: 'x' }),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });
  });

  // -------------------------------------------------------------------------
  // updateRiskStatusForCommitment
  // -------------------------------------------------------------------------

  describe('updateRiskStatusForCommitment', () => {
    it('PATCHes to /api/v1/value-commitments/:id/risks/:riskId/status', async () => {
      const risk = { id: 'r1', status: 'mitigated' };
      mockPatch.mockResolvedValue(ok(risk));
      const svc = makeService();

      const result = await svc.updateRiskStatusForCommitment(
        COMMIT_ID, 'r1', 'mitigated', '2027-01-01T00:00:00.000Z',
      );

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/risks/r1/status`,
        { status: 'mitigated', mitigated_at: '2027-01-01T00:00:00.000Z' },
      );
      expect(result).toEqual(risk);
    });

    it('omits mitigated_at when not provided', async () => {
      mockPatch.mockResolvedValue(ok({ id: 'r1', status: 'accepted' }));
      const svc = makeService();

      await svc.updateRiskStatusForCommitment(COMMIT_ID, 'r1', 'accepted');

      const body = mockPatch.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(body['mitigated_at']).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // addStakeholder
  // -------------------------------------------------------------------------

  describe('addStakeholder', () => {
    it('POSTs to /api/v1/value-commitments/:id/stakeholders', async () => {
      const stakeholder = { id: 's1', commitment_id: COMMIT_ID, user_id: USER_ID, role: 'sponsor' };
      mockPost.mockResolvedValue(ok(stakeholder));
      const svc = makeService();

      const result = await svc.addStakeholder(COMMIT_ID, TENANT_ID, USER_ID, {
        user_id: USER_ID,
        role: 'sponsor',
        responsibility: 'Executive sign-off',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/stakeholders`,
        expect.objectContaining({ user_id: USER_ID, role: 'sponsor' }),
      );
      expect(result).toEqual(stakeholder);
    });

    it('throws CommitmentApiError on backend failure', async () => {
      mockPost.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND', message: 'commitment not found' } });
      const svc = makeService();

      await expect(
        svc.addStakeholder(COMMIT_ID, TENANT_ID, USER_ID, { user_id: USER_ID, role: 'owner', responsibility: 'x' }),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });
  });

  // -------------------------------------------------------------------------
  // calculateProgress
  // -------------------------------------------------------------------------

  describe('calculateProgress', () => {
    it('GETs /api/v1/value-commitments/:id/progress and returns CommitmentProgress', async () => {
      const progress = {
        commitment_id: COMMIT_ID, overall_progress: 60,
        milestone_completion: 75, metric_achievement: 40,
        risk_level: 'low', days_remaining: 90, is_on_track: true,
      };
      mockGet.mockResolvedValue(ok(progress));
      const svc = makeService();

      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);

      expect(mockGet).toHaveBeenCalledWith(`/api/v1/value-commitments/${COMMIT_ID}/progress`);
      expect(result.overall_progress).toBe(60);
      expect(result.is_on_track).toBe(true);
    });

    it('returns empty progress on error without throwing', async () => {
      mockGet.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);

      expect(result.commitment_id).toBe(COMMIT_ID);
      expect(result.overall_progress).toBe(0);
    });

    it('returns empty progress when backend returns no data', async () => {
      mockGet.mockResolvedValue({ success: false, data: undefined });
      const svc = makeService();

      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);

      expect(result.overall_progress).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getAtRiskCommitments
  // -------------------------------------------------------------------------

  describe('getAtRiskCommitments', () => {
    it('GETs /api/v1/value-commitments/at-risk and maps to ValueCommitment[]', async () => {
      mockGet.mockResolvedValue(ok([commitmentDto]));
      const svc = makeService();

      const result = await svc.getAtRiskCommitments(TENANT_ID);

      expect(mockGet).toHaveBeenCalledWith('/api/v1/value-commitments/at-risk');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(COMMIT_ID);
    });

    it('returns empty array on error without throwing', async () => {
      mockGet.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      const result = await svc.getAtRiskCommitments(TENANT_ID);

      expect(result).toEqual([]);
    });

    it('returns empty array when backend returns no data', async () => {
      mockGet.mockResolvedValue({ success: false, data: undefined });
      const svc = makeService();

      const result = await svc.getAtRiskCommitments(TENANT_ID);

      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // CommitmentApiError shape
  // -------------------------------------------------------------------------

  describe('CommitmentApiError', () => {
    it('carries status and code', () => {
      const err = new CommitmentApiError(409, 'CONFLICT', 'invalid transition');
      expect(err.status).toBe(409);
      expect(err.code).toBe('CONFLICT');
      expect(err.name).toBe('CommitmentApiError');
      expect(err).toBeInstanceOf(Error);
    });
  });

  // -------------------------------------------------------------------------
  // HTTP status extraction from apiClient error messages
  // -------------------------------------------------------------------------

  describe('HTTP status propagation', () => {
    it('sets status 409 when apiClient embeds HTTP 409 in error message', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: { code: 'REQUEST_ERROR', message: 'HTTP 409: Conflict' },
      });
      const svc = makeService();

      const err = await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
        title: 'x', commitment_type: 'strategic', owner_user_id: USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z', timeframe_months: 1,
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(CommitmentApiError);
      expect((err as CommitmentApiError).status).toBe(409);
    });

    it('sets status 403 when apiClient embeds HTTP 403 in error message', async () => {
      mockPatch.mockResolvedValue({
        success: false,
        error: { code: 'REQUEST_ERROR', message: 'HTTP 403: Forbidden' },
      });
      const svc = makeService();

      const err = await svc.updateCommitment(COMMIT_ID, TENANT_ID, USER_ID, { title: 'x' })
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(CommitmentApiError);
      expect((err as CommitmentApiError).status).toBe(403);
    });

    it('sets status 400 when apiClient embeds HTTP 400 in error message', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: { code: 'REQUEST_ERROR', message: 'HTTP 400: Bad Request' },
      });
      const svc = makeService();

      const err = await svc.updateCommitmentStatus(COMMIT_ID, TENANT_ID, USER_ID, 'active')
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(CommitmentApiError);
      expect((err as CommitmentApiError).status).toBe(400);
    });

    it('defaults to status 500 when error message has no HTTP status', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: { code: 'UNKNOWN_ERROR', message: 'network failure' },
      });
      const svc = makeService();

      const err = await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
        title: 'x', commitment_type: 'strategic', owner_user_id: USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z', timeframe_months: 1,
      }).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(CommitmentApiError);
      expect((err as CommitmentApiError).status).toBe(500);
    });
  });
});
