import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExpansionOpportunityRepository } from '../ExpansionOpportunityRepository.js';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: mockInsert,
      select: mockSelect,
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORG_ID = 'org-uuid-4';
const CASE_ID = 'case-uuid-4';
const RUN_ID = 'run-uuid-1';

const baseInput = {
  organization_id: ORG_ID,
  value_case_id: CASE_ID,
  title: 'APAC Expansion',
  description: 'Expand into APAC markets using existing platform',
  type: 'geographic_expansion' as const,
  estimated_value_low: 1_000_000,
  estimated_value_high: 2_500_000,
  estimated_value_unit: '$',
  confidence: 0.72,
  evidence: ['Customer demand signals from APAC region'],
  prerequisites: ['APAC data residency compliance'],
  stakeholders: ['VP Strategy', 'CTO'],
  agent_run_id: RUN_ID,
};

const dbRow = {
  id: 'opp-uuid-1',
  organization_id: ORG_ID,
  value_case_id: CASE_ID,
  session_id: null,
  agent_run_id: RUN_ID,
  title: 'APAC Expansion',
  description: 'Expand into APAC markets using existing platform',
  type: 'geographic_expansion',
  source_kpi_id: null,
  estimated_value_low: 1_000_000,
  estimated_value_high: 2_500_000,
  estimated_value_unit: '$',
  estimated_value_timeframe_months: null,
  confidence: 0.72,
  evidence: ['Customer demand signals from APAC region'],
  prerequisites: ['APAC data residency compliance'],
  stakeholders: ['VP Strategy', 'CTO'],
  portfolio_summary: null,
  total_expansion_value_low: null,
  total_expansion_value_high: null,
  total_expansion_currency: null,
  gap_analysis: [],
  new_cycle_recommendations: [],
  recommended_next_steps: [],
  hallucination_check: null,
  source_agent: 'ExpansionAgent',
  created_at: '2026-03-22T00:00:00Z',
  updated_at: '2026-03-22T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpansionOpportunityRepository', () => {
  let repo: ExpansionOpportunityRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ExpansionOpportunityRepository();
  });

  describe('createOpportunity', () => {
    it('inserts a row and returns the created record', async () => {
      mockInsert.mockReturnValue({
        select: () => ({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({ data: dbRow, error: null });

      const result = await repo.createOpportunity(baseInput);

      expect(mockInsert).toHaveBeenCalledOnce();
      expect(result.title).toBe('APAC Expansion');
      expect(result.organization_id).toBe(ORG_ID);
      expect(result.type).toBe('geographic_expansion');
    });

    it('throws when Supabase returns an error', async () => {
      mockInsert.mockReturnValue({
        select: () => ({ single: mockSingle }),
      });
      mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

      await expect(repo.createOpportunity(baseInput)).rejects.toThrow('insert failed');
    });
  });

  describe('getForCase', () => {
    it('returns all opportunities for a case', async () => {
      mockSelect.mockReturnValue({
        eq: () => ({
          eq: () => ({
            order: mockOrder,
          }),
        }),
      });
      mockOrder.mockResolvedValue({ data: [dbRow], error: null });

      const results = await repo.getForCase(CASE_ID, ORG_ID);

      expect(results).toHaveLength(1);
      expect(results[0]!.value_case_id).toBe(CASE_ID);
    });

    it('returns empty array when no opportunities exist', async () => {
      mockSelect.mockReturnValue({
        eq: () => ({
          eq: () => ({
            order: mockOrder,
          }),
        }),
      });
      mockOrder.mockResolvedValue({ data: [], error: null });

      const results = await repo.getForCase(CASE_ID, ORG_ID);
      expect(results).toHaveLength(0);
    });

    it('throws when Supabase returns an error', async () => {
      mockSelect.mockReturnValue({
        eq: () => ({
          eq: () => ({
            order: mockOrder,
          }),
        }),
      });
      mockOrder.mockResolvedValue({ data: null, error: { message: 'select failed' } });

      await expect(repo.getForCase(CASE_ID, ORG_ID)).rejects.toThrow('select failed');
    });
  });

  describe('getLatestRunForCase', () => {
    it('returns opportunities from the latest run', async () => {
      // First call: get latest agent_run_id
      const latestRow = { agent_run_id: RUN_ID, created_at: '2026-03-22T00:00:00Z' };
      mockSelect
        .mockReturnValueOnce({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: mockMaybeSingle,
                }),
              }),
            }),
          }),
        })
        // Second call: get all rows for that run
        .mockReturnValueOnce({
          eq: () => ({
            eq: () => ({
              order: () => ({
                eq: mockEq,
              }),
            }),
          }),
        });

      mockMaybeSingle.mockResolvedValue({ data: latestRow, error: null });
      mockEq.mockResolvedValue({ data: [dbRow], error: null });

      const results = await repo.getLatestRunForCase(CASE_ID, ORG_ID);

      expect(results).toHaveLength(1);
      expect(results[0]!.agent_run_id).toBe(RUN_ID);
    });

    it('returns empty array when no opportunities exist', async () => {
      mockSelect.mockReturnValue({
        eq: () => ({
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        }),
      });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });

      const results = await repo.getLatestRunForCase(CASE_ID, ORG_ID);
      expect(results).toHaveLength(0);
    });
  });
});
