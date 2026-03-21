import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.hoisted ensures these are available inside vi.mock() factory closures
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('../../lib/supabase.js', () => ({ supabase: { from: mockFrom } }));
vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ValueCommitmentTrackingService } from '../ValueCommitmentTrackingService.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const TENANT_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
const USER_ID = 'cccccccc-0000-0000-0000-000000000001';
const COMMITMENT_ID = 'dddddddd-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// Chain builder
// Produces a fluent Supabase-like mock. Every method returns the same chain;
// .single() and the chain itself (via .then) resolve to the given value.
// ---------------------------------------------------------------------------

function makeChain(resolved: { data: unknown; error: unknown }) {
  const terminal = vi.fn().mockResolvedValue(resolved);
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'order', 'insert', 'update']) {
    chain[m] = vi.fn().mockReturnValue(chain);
  }
  chain['single'] = terminal;
  // Make the chain thenable so Promise.all can await it directly
  chain['then'] = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
    terminal().then(res, rej);
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ValueCommitmentTrackingService', () => {
  let service: ValueCommitmentTrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ValueCommitmentTrackingService();
  });

  describe('createCommitment', () => {
    it('inserts a row and returns the created commitment', async () => {
      const created = { id: COMMITMENT_ID, organization_id: ORG_ID, status: 'draft' };
      mockFrom.mockReturnValue(makeChain({ data: created, error: null }));

      const result = await service.createCommitment({
        tenant_id: TENANT_ID,
        organization_id: ORG_ID,
        user_id: USER_ID,
        session_id: 'sess-1',
        title: 'Reduce COGS by 15%',
        description: 'Operational efficiency initiative',
        commitment_type: 'financial',
        timeframe_months: 12,
        target_completion_date: '2027-01-01T00:00:00Z',
      });

      expect(result).toEqual(created);
      expect(mockFrom).toHaveBeenCalledWith('value_commitments');
    });

    it('throws when Supabase returns an error', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'insert failed' } }));

      await expect(
        service.createCommitment({
          tenant_id: TENANT_ID,
          organization_id: ORG_ID,
          user_id: USER_ID,
          session_id: 'sess-1',
          title: 'Test',
          description: 'Test',
          commitment_type: 'financial',
          timeframe_months: 6,
          target_completion_date: '2027-01-01T00:00:00Z',
        }),
      ).rejects.toThrow('createCommitment: insert failed');
    });
  });

  describe('getCommitment — tenant isolation', () => {
    it('fetches by id AND organization_id', async () => {
      const row = { id: COMMITMENT_ID, organization_id: ORG_ID };
      mockFrom.mockReturnValue(makeChain({ data: row, error: null }));

      const result = await service.getCommitment(COMMITMENT_ID, ORG_ID);
      expect(result).toEqual(row);
      expect(mockFrom).toHaveBeenCalledWith('value_commitments');
    });

    it('throws when commitment belongs to a different org', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'row not found' } }));

      await expect(service.getCommitment(COMMITMENT_ID, 'other-org')).rejects.toThrow(
        'getCommitment: row not found',
      );
    });
  });

  describe('updateCommitmentStatus', () => {
    it('returns updated commitment', async () => {
      const updated = { id: COMMITMENT_ID, status: 'completed' };
      mockFrom.mockReturnValue(makeChain({ data: updated, error: null }));

      const result = await service.updateCommitmentStatus({
        commitment_id: COMMITMENT_ID,
        organization_id: ORG_ID,
        status: 'completed',
      });

      expect(result.status).toBe('completed');
    });

    it('throws on DB error', async () => {
      mockFrom.mockReturnValue(makeChain({ data: null, error: { message: 'update failed' } }));

      await expect(
        service.updateCommitmentStatus({
          commitment_id: COMMITMENT_ID,
          organization_id: ORG_ID,
          status: 'at_risk',
        }),
      ).rejects.toThrow('updateCommitmentStatus: update failed');
    });
  });

  describe('addMilestone', () => {
    it('inserts milestone and returns it', async () => {
      const milestone = { id: 'ms-1', commitment_id: COMMITMENT_ID, status: 'pending' };
      mockFrom.mockReturnValue(makeChain({ data: milestone, error: null }));

      const result = await service.addMilestone({
        commitment_id: COMMITMENT_ID,
        tenant_id: TENANT_ID,
        organization_id: ORG_ID,
        title: 'Phase 1',
        description: 'Initial planning',
        milestone_type: 'planning',
        sequence_order: 1,
        target_date: '2026-06-01T00:00:00Z',
      });

      expect(result).toEqual(milestone);
      expect(mockFrom).toHaveBeenCalledWith('commitment_milestones');
    });
  });

  describe('updateMilestoneProgress', () => {
    it('updates progress and triggers commitment recompute', async () => {
      const updated = { id: 'ms-1', progress_percentage: 75 };
      mockFrom
        .mockReturnValueOnce(makeChain({ data: updated, error: null }))           // update milestone
        .mockReturnValueOnce(makeChain({ data: [{ progress_percentage: 75 }], error: null })) // select milestones
        .mockReturnValueOnce(makeChain({ data: null, error: null }));             // update commitment

      const result = await service.updateMilestoneProgress({
        milestone_id: 'ms-1',
        commitment_id: COMMITMENT_ID,
        organization_id: ORG_ID,
        progress_percentage: 75,
      });

      expect(result.progress_percentage).toBe(75);
    });
  });

  describe('recordMetricActual', () => {
    it('updates current_value', async () => {
      const metric = { id: 'met-1', current_value: 42 };
      mockFrom.mockReturnValue(makeChain({ data: metric, error: null }));

      const result = await service.recordMetricActual({
        metric_id: 'met-1',
        commitment_id: COMMITMENT_ID,
        organization_id: ORG_ID,
        current_value: 42,
      });

      expect(result.current_value).toBe(42);
      expect(mockFrom).toHaveBeenCalledWith('commitment_metrics');
    });
  });

  describe('addRisk', () => {
    it('inserts risk with status=identified', async () => {
      const risk = { id: 'risk-1', status: 'identified' };
      mockFrom.mockReturnValue(makeChain({ data: risk, error: null }));

      const result = await service.addRisk({
        commitment_id: COMMITMENT_ID,
        tenant_id: TENANT_ID,
        organization_id: ORG_ID,
        risk_title: 'Budget overrun',
        risk_description: 'Costs may exceed forecast',
        risk_category: 'financial',
        probability: 'medium',
        impact: 'high',
        mitigation_plan: 'Monthly budget reviews',
        contingency_plan: 'Reduce scope',
        owner_id: USER_ID,
        review_date: '2026-09-01T00:00:00Z',
      });

      expect(result.status).toBe('identified');
      expect(mockFrom).toHaveBeenCalledWith('commitment_risks');
    });
  });

  describe('addStakeholder', () => {
    it('inserts stakeholder with is_active=true', async () => {
      const stakeholder = { id: 'sh-1', is_active: true };
      mockFrom.mockReturnValue(makeChain({ data: stakeholder, error: null }));

      const result = await service.addStakeholder({
        commitment_id: COMMITMENT_ID,
        tenant_id: TENANT_ID,
        organization_id: ORG_ID,
        user_id: USER_ID,
        role: 'owner',
        responsibility: 'Drive delivery',
      });

      expect(result.is_active).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('commitment_stakeholders');
    });
  });

  describe('generateProgressReport', () => {
    it('computes milestone_completion and risk_level correctly', async () => {
      const commitment = {
        id: COMMITMENT_ID,
        organization_id: ORG_ID,
        target_completion_date: '2027-01-01T00:00:00Z',
      };
      const milestones = [
        { id: 'ms-1', status: 'completed', progress_percentage: 100 },
        { id: 'ms-2', status: 'pending', progress_percentage: 0 },
      ];
      const metrics = [{ id: 'met-1', target_value: 100, current_value: 60, is_active: true }];
      const risks: unknown[] = [];

      mockFrom
        .mockReturnValueOnce(makeChain({ data: commitment, error: null }))
        .mockReturnValueOnce(makeChain({ data: milestones, error: null }))
        .mockReturnValueOnce(makeChain({ data: metrics, error: null }))
        .mockReturnValueOnce(makeChain({ data: risks, error: null }));

      const report = await service.generateProgressReport(COMMITMENT_ID, ORG_ID);

      expect(report.summary.milestone_completion).toBe(50);
      expect(report.summary.risk_level).toBe('low');
      expect(report.milestones).toHaveLength(2);
    });

    it('flags risk_level as critical when there are 3+ high-probability risks', async () => {
      const commitment = { id: COMMITMENT_ID, organization_id: ORG_ID, target_completion_date: null };
      const risks = [
        { id: 'r1', probability: 'high' },
        { id: 'r2', probability: 'critical' },
        { id: 'r3', probability: 'high' },
      ];

      mockFrom
        .mockReturnValueOnce(makeChain({ data: commitment, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: risks, error: null }));

      const report = await service.generateProgressReport(COMMITMENT_ID, ORG_ID);

      expect(report.summary.risk_level).toBe('critical');
      expect(report.summary.is_on_track).toBe(false);
    });

    it('is_on_track requires >= 80% overall progress (not 50%)', async () => {
      // 2/2 milestones complete = 100% milestone, 0 metrics = 0% metric
      // overallProgress = 100*0.6 + 0*0.4 = 60 — below 80 threshold
      const commitment = { id: COMMITMENT_ID, organization_id: ORG_ID, target_completion_date: null };
      const milestones = [
        { id: 'ms-1', status: 'completed', progress_percentage: 100 },
        { id: 'ms-2', status: 'completed', progress_percentage: 100 },
      ];

      mockFrom
        .mockReturnValueOnce(makeChain({ data: commitment, error: null }))
        .mockReturnValueOnce(makeChain({ data: milestones, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }));

      const report = await service.generateProgressReport(COMMITMENT_ID, ORG_ID);

      // overallProgress = 60, which is >= 50 (old threshold) but < 80 (new threshold)
      expect(report.summary.overall_progress).toBe(60);
      expect(report.summary.is_on_track).toBe(false);
    });

    it('is_on_track is true when overall progress >= 80% and no critical risks', async () => {
      const commitment = { id: COMMITMENT_ID, organization_id: ORG_ID, target_completion_date: null };
      // 100% milestones + 100% metrics → overallProgress = 100
      const milestones = [{ id: 'ms-1', status: 'completed', progress_percentage: 100 }];
      const metrics = [{ id: 'met-1', target_value: 100, current_value: 100, is_active: true }];

      mockFrom
        .mockReturnValueOnce(makeChain({ data: commitment, error: null }))
        .mockReturnValueOnce(makeChain({ data: milestones, error: null }))
        .mockReturnValueOnce(makeChain({ data: metrics, error: null }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }));

      const report = await service.generateProgressReport(COMMITMENT_ID, ORG_ID);

      expect(report.summary.overall_progress).toBe(100);
      expect(report.summary.is_on_track).toBe(true);
    });

    it('sub-queries include organization_id filter', async () => {
      const commitment = { id: COMMITMENT_ID, organization_id: ORG_ID, target_completion_date: null };
      const eqCalls: [string, string][] = [];

      // Capture all .eq() calls across all chains
      mockFrom.mockImplementation(() => {
        const chain: Record<string, unknown> = {};
        chain['select'] = vi.fn().mockReturnValue(chain);
        chain['eq'] = vi.fn().mockImplementation((col: string, val: string) => {
          eqCalls.push([col, val]);
          return chain;
        });
        chain['neq'] = vi.fn().mockReturnValue(chain);
        chain['order'] = vi.fn().mockReturnValue(chain);
        chain['single'] = vi.fn().mockResolvedValue({ data: commitment, error: null });
        chain['then'] = (res: (v: unknown) => void, rej: (e: unknown) => void) =>
          Promise.resolve({ data: [], error: null }).then(res, rej);
        return chain;
      });

      await service.generateProgressReport(COMMITMENT_ID, ORG_ID).catch(() => {
        // may throw due to simplified mock — we only care about eq calls
      });

      const orgFilters = eqCalls.filter(([col, val]) => col === 'organization_id' && val === ORG_ID);
      // Expect at least 3 org filters: milestones, metrics, risks
      expect(orgFilters.length).toBeGreaterThanOrEqual(3);
    });
  });
});
