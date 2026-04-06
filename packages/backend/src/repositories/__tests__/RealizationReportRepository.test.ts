import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const maybeSingleMock = vi.fn();
const singleMock = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: insertMock,
      select: selectMock,
    }),
  }),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

function buildSelectChain(result: unknown) {
  maybeSingleMock.mockResolvedValue(result);
  limitMock.mockReturnValue({ maybeSingle: maybeSingleMock });
  orderMock.mockReturnValue({ limit: limitMock });
  eqMock
    .mockReturnValueOnce({ eq: eqMock })
    .mockReturnValueOnce({ order: orderMock });
  selectMock.mockReturnValue({ eq: eqMock });
}

function buildInsertChain(result: unknown) {
  singleMock.mockResolvedValue(result);
  selectMock.mockReturnValue({ single: singleMock });
  insertMock.mockReturnValue({ select: selectMock });
}

import { RealizationReportRepository } from '../RealizationReportRepository.js';

const CASE_ID = 'case-uuid-3';
const ORG_ID = 'org-uuid-3';

const PAYLOAD = {
  kpis: [
    {
      kpi_id: 'kpi-1',
      kpi_name: 'Revenue Growth',
      committed_value: 20,
      realized_value: 18,
      unit: '%',
      variance_percentage: -10,
      direction: 'under' as const,
      confidence: 0.8,
    },
  ],
  milestones: [
    { id: 'm1', title: 'Phase 1 complete', due_date: '2026-06-01', status: 'completed' as const },
  ],
  risks: [
    { id: 'r1', description: 'Market slowdown', severity: 'medium' as const },
  ],
  variance_analysis: { summary: 'Slightly below target', root_cause: 'Market conditions' },
  hallucination_check: true,
};

describe('RealizationReportRepository', () => {
  let repo: RealizationReportRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new RealizationReportRepository();
  });

  describe('createReport', () => {
    it('inserts a row and returns the created record', async () => {
      const expected = { id: 'report-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildInsertChain({ data: expected, error: null });

      const result = await repo.createReport(CASE_ID, ORG_ID, PAYLOAD);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: ORG_ID,
          value_case_id: CASE_ID,
          kpis: PAYLOAD.kpis,
          milestones: PAYLOAD.milestones,
          risks: PAYLOAD.risks,
        }),
      );
      expect(result).toEqual(expected);
    });

    it('throws when Supabase returns an error', async () => {
      buildInsertChain({ data: null, error: { message: 'insert failed' } });

      await expect(repo.createReport(CASE_ID, ORG_ID, PAYLOAD)).rejects.toThrow('insert failed');
    });
  });

  describe('getLatestForCase', () => {
    it('returns the latest report for a case', async () => {
      const expected = { id: 'report-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildSelectChain({ data: expected, error: null });

      const result = await repo.getLatestForCase(CASE_ID, ORG_ID);

      expect(result).toEqual(expected);
    });

    it('returns null when no report exists', async () => {
      buildSelectChain({ data: null, error: null });

      const result = await repo.getLatestForCase(CASE_ID, ORG_ID);

      expect(result).toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      buildSelectChain({ data: null, error: { message: 'select failed' } });

      await expect(repo.getLatestForCase(CASE_ID, ORG_ID)).rejects.toThrow('select failed');
    });
  });
});
