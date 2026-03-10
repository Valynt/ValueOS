import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const insertMock = vi.fn();
const selectMock = vi.fn();
const eqMock = vi.fn();
const orderMock = vi.fn();
const limitMock = vi.fn();
const maybeSingleMock = vi.fn();
const singleMock = vi.fn();

vi.mock('../../lib/supabase.js', () => ({
  createServerSupabaseClient: () => ({
    from: () => ({
      insert: insertMock,
      select: selectMock,
    }),
  }),
}));

// Chain builder helpers
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { IntegrityResultRepository } from '../IntegrityResultRepository.js';

const CASE_ID = 'case-uuid-1';
const ORG_ID = 'org-uuid-1';

const PAYLOAD = {
  claims: [
    {
      claim_id: 'c1',
      claim_text: 'Revenue will increase by 20%',
      verdict: 'supported' as const,
      confidence: 0.85,
      evidence_assessment: 'Strong evidence from Q3 data',
      issues: [],
    },
  ],
  veto_decision: 'pass' as const,
  overall_score: 0.87,
  data_quality_score: 0.9,
  logic_score: 0.85,
  evidence_score: 0.88,
  hallucination_check: true,
};

describe('IntegrityResultRepository', () => {
  let repo: IntegrityResultRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new IntegrityResultRepository();
  });

  describe('createResult', () => {
    it('inserts a row and returns the created record', async () => {
      const expected = { id: 'result-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildInsertChain({ data: expected, error: null });

      const result = await repo.createResult(CASE_ID, ORG_ID, PAYLOAD);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: ORG_ID,
          value_case_id: CASE_ID,
          veto_decision: 'pass',
          overall_score: 0.87,
        }),
      );
      expect(result).toEqual(expected);
    });

    it('throws when Supabase returns an error', async () => {
      buildInsertChain({ data: null, error: { message: 'insert failed' } });

      await expect(repo.createResult(CASE_ID, ORG_ID, PAYLOAD)).rejects.toThrow('insert failed');
    });
  });

  describe('getLatestForCase', () => {
    it('returns the latest result for a case', async () => {
      const expected = { id: 'result-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildSelectChain({ data: expected, error: null });

      const result = await repo.getLatestForCase(CASE_ID, ORG_ID);

      expect(result).toEqual(expected);
    });

    it('returns null when no result exists', async () => {
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
