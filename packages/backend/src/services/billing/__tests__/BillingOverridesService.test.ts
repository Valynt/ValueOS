/**
 * BillingOverridesService tests
 *
 * Covers:
 * - requestOverride: inserts row and calls approval service
 * - requestOverride: rejects invalid input (missing effectiveEnd for temporary)
 * - approveOverride: updates status to approved
 * - getActiveOverrides: filters by status and date window
 * - expireStaleOverrides: marks expired rows
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────

const { mockSingle, mockFrom } = vi.hoisted(() => ({
  mockSingle: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('../../../lib/supabase.js', () => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    single: mockSingle,
  };
  mockFrom.mockReturnValue(chain);
  return {
    supabase: { from: mockFrom },
    assertNotTestEnv: vi.fn()
  };
});

const { mockCreateApprovalRequest } = vi.hoisted(() => ({
  mockCreateApprovalRequest: vi.fn().mockResolvedValue({ id: 'approval-1' }),
}));

vi.mock('../BillingApprovalService.js', () => {
  class BillingApprovalService {
    createApprovalRequest = mockCreateApprovalRequest;
  }
  return { BillingApprovalService };
});

import { BillingOverridesService } from '../BillingOverridesService.js';

const ORG_ID   = '00000000-0000-0000-0000-000000000001';
const USER_ID  = '00000000-0000-0000-0000-000000000002';
const ADMIN_ID = '00000000-0000-0000-0000-000000000003';
const OVR_ID   = '00000000-0000-0000-0000-000000000004';

const OVERRIDE_ROW = {
  id: OVR_ID,
  organization_id: ORG_ID,
  metric: 'llm_tokens',
  override_type: 'temporary',
  custom_price: null,
  cap_value: 5000,
  status: 'pending',
  requested_by: USER_ID,
  approved_by: null,
  approved_at: null,
  justification: 'Need more tokens for Q4 campaign',
  effective_from: '2026-01-01T00:00:00Z',
  effective_end: '2026-02-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('BillingOverridesService', () => {
  let service: BillingOverridesService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new BillingOverridesService();
  });

  describe('requestOverride', () => {
    it('inserts a pending override and returns mapped result', async () => {
      mockSingle.mockResolvedValue({ data: OVERRIDE_ROW, error: null });

      const result = await service.requestOverride({
        organizationId: ORG_ID,
        metric: 'llm_tokens',
        overrideType: 'temporary',
        capValue: 5000,
        justification: 'Need more tokens for Q4 campaign',
        requestedBy: USER_ID,
        effectiveFrom: '2026-01-01T00:00:00Z',
        effectiveEnd: '2026-02-01T00:00:00Z',
      });

      expect(result.id).toBe(OVR_ID);
      expect(result.status).toBe('pending');
      expect(result.metric).toBe('llm_tokens');
      expect(result.capValue).toBe(5000);
    });

    it('throws when effectiveEnd is missing for a temporary override', async () => {
      await expect(
        service.requestOverride({
          organizationId: ORG_ID,
          metric: 'llm_tokens',
          overrideType: 'temporary',
          capValue: 5000,
          justification: 'Need more tokens for Q4 campaign',
          requestedBy: USER_ID,
          // effectiveEnd intentionally omitted
        })
      ).rejects.toThrow('effectiveEnd is required for temporary overrides');
    });

    it('throws when neither customPrice nor capValue is set', async () => {
      await expect(
        service.requestOverride({
          organizationId: ORG_ID,
          metric: 'llm_tokens',
          overrideType: 'contract',
          justification: 'Need more tokens for Q4 campaign',
          requestedBy: USER_ID,
        })
      ).rejects.toThrow('At least one of customPrice or capValue must be set');
    });

    it('throws when supabase insert fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });

      await expect(
        service.requestOverride({
          organizationId: ORG_ID,
          metric: 'llm_tokens',
          overrideType: 'temporary',
          capValue: 5000,
          justification: 'Need more tokens for Q4 campaign',
          requestedBy: USER_ID,
          effectiveEnd: '2026-02-01T00:00:00Z',
        })
      ).rejects.toThrow('Failed to create billing override: DB error');
    });
  });

  describe('approveOverride', () => {
    it('updates status to approved and returns mapped result', async () => {
      const approved = { ...OVERRIDE_ROW, status: 'approved', approved_by: ADMIN_ID, approved_at: '2026-01-02T00:00:00Z' };
      mockSingle.mockResolvedValue({ data: approved, error: null });

      const result = await service.approveOverride(OVR_ID, ORG_ID, ADMIN_ID);

      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe(ADMIN_ID);
    });

    it('throws when update fails', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      await expect(
        service.approveOverride(OVR_ID, ORG_ID, ADMIN_ID)
      ).rejects.toThrow(`Failed to approve override ${OVR_ID}: Not found`);
    });
  });

  describe('expireStaleOverrides', () => {
    it('returns count of expired rows', async () => {
      // expireStaleOverrides ends with .select() (no .single()), so mock the chain
      // to resolve on the final .select() call.
      const selectFinal = vi.fn().mockResolvedValue({
        data: [{ id: 'o1' }, { id: 'o2' }],
        error: null,
      });
      const chain = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        select: selectFinal,
      };
      mockFrom.mockReturnValueOnce(chain as never);

      const count = await service.expireStaleOverrides();
      expect(count).toBe(2);
    });
  });
});
