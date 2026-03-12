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

    it('resolves without error when server returns 204 (no data field)', async () => {
      // HTTP 204 responses have no body — apiClient returns { success: true }
      // with no `data` property. The old unwrap() would throw because data===undefined.
      mockDelete.mockResolvedValue({ success: true });
      const svc = makeService();

      await expect(svc.deleteCommitment(COMMIT_ID, TENANT_ID, USER_ID)).resolves.toBeUndefined();
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

    it('does not throw when success=true and data is null (Fix 5: null vs undefined guard)', async () => {
      // Some endpoints may return { success: true, data: null }. The old guard
      // `data !== undefined` would treat null as a failure and throw a 500 error.
      mockPost.mockResolvedValue({ success: true, data: null });
      const svc = makeService();

      // createCommitment returns CommitmentDto; null is not a valid CommitmentDto,
      // but the point is that unwrap must not throw — it should return null.
      const result = await svc.createCommitment(TENANT_ID, USER_ID, SESSION_ID, {
        title: 'x', commitment_type: 'strategic', owner_user_id: USER_ID,
        target_completion_date: '2027-01-01T00:00:00.000Z', timeframe_months: 1,
      }).catch((e: unknown) => e);

      // Should not be a CommitmentApiError
      expect(result).not.toBeInstanceOf(CommitmentApiError);
    });
  });

  // -------------------------------------------------------------------------
  // Milestones
  // -------------------------------------------------------------------------

  describe('createMilestone', () => {
    it('POSTs to /api/v1/value-commitments/:id/milestones', async () => {
      const milestone = { id: 'ms-1', commitment_id: COMMIT_ID, title: 'Phase 1' };
      mockPost.mockResolvedValue(ok(milestone));
      const svc = makeService();

      const result = await svc.createMilestone(COMMIT_ID, TENANT_ID, USER_ID, {
        title: 'Phase 1',
        milestone_type: 'execution',
        sequence_order: 1,
        target_date: '2027-03-01T00:00:00.000Z',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/milestones`,
        expect.objectContaining({ title: 'Phase 1' }),
      );
      expect(result).toEqual(milestone);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.createMilestone(COMMIT_ID, TENANT_ID, USER_ID, {
        title: 'x', milestone_type: 'execution', sequence_order: 1,
        target_date: '2027-03-01T00:00:00.000Z',
      });
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('updateMilestone', () => {
    it('PATCHes to /api/v1/value-commitments/:id/milestones/:milestoneId', async () => {
      const updated = { id: 'ms-1', commitment_id: COMMIT_ID, progress_percentage: 50 };
      mockPatch.mockResolvedValue(ok(updated));
      const svc = makeService();

      const result = await svc.updateMilestone(COMMIT_ID, 'ms-1', { progress_percentage: 50 });

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/milestones/ms-1`,
        expect.objectContaining({ progress_percentage: 50 }),
      );
      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // Metrics
  // -------------------------------------------------------------------------

  describe('createMetric', () => {
    it('POSTs to /api/v1/value-commitments/:id/metrics', async () => {
      const metric = { id: 'met-1', commitment_id: COMMIT_ID, metric_name: 'ARR' };
      mockPost.mockResolvedValue(ok(metric));
      const svc = makeService();

      const result = await svc.createMetric(COMMIT_ID, TENANT_ID, USER_ID, {
        metric_name: 'ARR', baseline_value: 1_000_000, target_value: 1_200_000, unit: 'USD',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/metrics`,
        expect.objectContaining({ metric_name: 'ARR' }),
      );
      expect(result).toEqual(metric);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.createMetric(COMMIT_ID, TENANT_ID, USER_ID, {
        metric_name: 'ARR', baseline_value: 0, target_value: 1, unit: 'USD',
      });
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('updateMetricActual', () => {
    it('PATCHes to /api/v1/value-commitments/:id/metrics/:metricId/actual', async () => {
      const updated = { id: 'met-1', current_value: 1_100_000 };
      mockPatch.mockResolvedValue(ok(updated));
      const svc = makeService();

      const result = await svc.updateMetricActual(COMMIT_ID, 'met-1', 1_100_000);

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/metrics/met-1/actual`,
        { current_value: 1_100_000 },
      );
      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // Risks
  // -------------------------------------------------------------------------

  describe('createRisk', () => {
    it('POSTs to /api/v1/value-commitments/:id/risks', async () => {
      const risk = { id: 'risk-1', commitment_id: COMMIT_ID, risk_title: 'Budget cut' };
      mockPost.mockResolvedValue(ok(risk));
      const svc = makeService();

      const result = await svc.createRisk(COMMIT_ID, TENANT_ID, USER_ID, {
        risk_title: 'Budget cut',
        risk_description: 'Q3 budget may be reduced',
        risk_category: 'financial',
        probability: 'medium',
        impact: 'high',
        mitigation_plan: 'Secure exec sponsorship',
        contingency_plan: 'Reduce scope',
        owner_id: USER_ID,
        review_date: '2027-06-01T00:00:00.000Z',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/risks`,
        expect.objectContaining({ risk_title: 'Budget cut' }),
      );
      expect(result).toEqual(risk);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.createRisk(COMMIT_ID, TENANT_ID, USER_ID, {
        risk_title: 'x', risk_description: 'x', risk_category: 'financial',
        probability: 'low', impact: 'low', mitigation_plan: 'x',
        contingency_plan: 'x', owner_id: USER_ID, review_date: '2027-01-01T00:00:00.000Z',
      });
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('updateRisk', () => {
    it('PATCHes to /api/v1/value-commitments/:id/risks/:riskId', async () => {
      const updated = { id: 'risk-1', status: 'mitigated' };
      mockPatch.mockResolvedValue(ok(updated));
      const svc = makeService();

      const result = await svc.updateRisk(COMMIT_ID, 'risk-1', { status: 'mitigated' });

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/risks/risk-1`,
        expect.objectContaining({ status: 'mitigated' }),
      );
      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // Stakeholders
  // -------------------------------------------------------------------------

  describe('addStakeholder', () => {
    it('POSTs to /api/v1/value-commitments/:id/stakeholders', async () => {
      const stakeholder = { id: 'sh-1', commitment_id: COMMIT_ID, user_id: USER_ID };
      mockPost.mockResolvedValue(ok(stakeholder));
      const svc = makeService();

      const result = await svc.addStakeholder(COMMIT_ID, TENANT_ID, USER_ID, {
        user_id: USER_ID,
        role: 'contributor',
        responsibility: 'Owns metric collection',
      });

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/stakeholders`,
        expect.objectContaining({ user_id: USER_ID, role: 'contributor' }),
      );
      expect(result).toEqual(stakeholder);
    });

    it('returns stub without calling apiClient when flag is false', async () => {
      const svc = makeService('false');
      await svc.addStakeholder(COMMIT_ID, TENANT_ID, USER_ID, {
        user_id: USER_ID, role: 'observer', responsibility: 'x',
      });
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  describe('updateStakeholderForCommitment', () => {
    it('PATCHes to /api/v1/value-commitments/:id/stakeholders/:stakeholderId', async () => {
      const updated = { id: 'sh-1', role: 'approver' };
      mockPatch.mockResolvedValue(ok(updated));
      const svc = makeService();

      const result = await svc.updateStakeholderForCommitment(COMMIT_ID, 'sh-1', { role: 'approver' });

      expect(mockPatch).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/stakeholders/sh-1`,
        expect.objectContaining({ role: 'approver' }),
      );
      expect(result).toEqual(updated);
    });
  });

  // -------------------------------------------------------------------------
  // calculateProgress
  // -------------------------------------------------------------------------

  describe('calculateProgress', () => {
    it('GETs /api/v1/value-commitments/:id/progress and returns real data', async () => {
      const progress = {
        commitment_id: COMMIT_ID, overall_progress: 65,
        milestone_completion: 70, metric_achievement: 58,
        risk_level: 'low', days_remaining: 90, is_on_track: true,
      };
      mockGet.mockResolvedValue(ok(progress));
      const svc = makeService();

      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);

      expect(mockGet).toHaveBeenCalledWith(`/api/v1/value-commitments/${COMMIT_ID}/progress`);
      expect(result.overall_progress).toBe(65);
      expect(result.is_on_track).toBe(true);
    });

    it('returns zero-progress fallback when API call fails', async () => {
      mockGet.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);

      expect(result.overall_progress).toBe(0);
      expect(result.is_on_track).toBe(false);
    });

    it('returns zero-progress fallback when flag is false', async () => {
      const svc = makeService('false');
      const result = await svc.calculateProgress(COMMIT_ID, TENANT_ID);
      expect(mockGet).not.toHaveBeenCalled();
      expect(result.overall_progress).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // getAtRiskCommitments
  // -------------------------------------------------------------------------

  describe('getAtRiskCommitments', () => {
    it('GETs /api/v1/value-commitments?atRisk=true and maps to ValueCommitment[]', async () => {
      mockGet.mockResolvedValue(ok([commitmentDto]));
      const svc = makeService();

      const result = await svc.getAtRiskCommitments(TENANT_ID);

      expect(mockGet).toHaveBeenCalledWith('/api/v1/value-commitments?atRisk=true');
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(COMMIT_ID);
    });

    it('returns empty array when API call fails', async () => {
      mockGet.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      const result = await svc.getAtRiskCommitments(TENANT_ID);
      expect(result).toEqual([]);
    });

    it('returns empty array when flag is false', async () => {
      const svc = makeService('false');
      const result = await svc.getAtRiskCommitments(TENANT_ID);
      expect(mockGet).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // validateAgainstGroundTruth
  // -------------------------------------------------------------------------

  describe('validateAgainstGroundTruth', () => {
    it('POSTs to /:id/validate-progress and returns backend verdict', async () => {
      const verdict = {
        isValid: true, confidence: 0.85, issues: [], recommendations: [],
      };
      mockPost.mockResolvedValue(ok(verdict));
      const svc = makeService();

      const result = await svc.validateAgainstGroundTruth(COMMIT_ID, TENANT_ID);

      expect(mockPost).toHaveBeenCalledWith(
        `/api/v1/value-commitments/${COMMIT_ID}/validate-progress`,
        {},
      );
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('returns isValid false when backend reports issues', async () => {
      const verdict = {
        isValid: false,
        confidence: 0.6,
        issues: ['Overall progress 60% is 20pp below the 80% threshold'],
        recommendations: ['Metric actuals are lagging — update current values or revise targets'],
      };
      mockPost.mockResolvedValue(ok(verdict));
      const svc = makeService();

      const result = await svc.validateAgainstGroundTruth(COMMIT_ID, TENANT_ID);

      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('throws CommitmentApiError when backend returns failure', async () => {
      mockPost.mockResolvedValue({
        success: false,
        error: { code: 'NOT_FOUND', message: 'HTTP 404: Not Found' },
      });
      const svc = makeService();

      await expect(
        svc.validateAgainstGroundTruth(COMMIT_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });

    it('throws CommitmentApiError when network call fails', async () => {
      mockPost.mockRejectedValue(new Error('network error'));
      const svc = makeService();

      await expect(
        svc.validateAgainstGroundTruth(COMMIT_ID, TENANT_ID),
      ).rejects.toBeInstanceOf(CommitmentApiError);
    });

    it('returns isValid false without calling apiClient when flag is false', async () => {
      const svc = makeService('false');

      const result = await svc.validateAgainstGroundTruth(COMMIT_ID, TENANT_ID);

      expect(mockPost).not.toHaveBeenCalled();
      expect(result.isValid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });
  });
});
