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

import { NarrativeDraftRepository } from '../NarrativeDraftRepository.js';

const CASE_ID = 'case-uuid-2';
const ORG_ID = 'org-uuid-2';

const PAYLOAD = {
  content: 'This business case demonstrates a 20% revenue uplift...',
  format: 'executive_summary' as const,
  defense_readiness_score: 0.82,
  hallucination_check: true,
};

describe('NarrativeDraftRepository', () => {
  let repo: NarrativeDraftRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new NarrativeDraftRepository();
  });

  describe('createDraft', () => {
    it('inserts a row and returns the created record', async () => {
      const expected = { id: 'draft-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildInsertChain({ data: expected, error: null });

      const result = await repo.createDraft(CASE_ID, ORG_ID, PAYLOAD);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: ORG_ID,
          value_case_id: CASE_ID,
          content: PAYLOAD.content,
          format: 'executive_summary',
        }),
      );
      expect(result).toEqual(expected);
    });

    it('defaults format to executive_summary when not provided', async () => {
      const payloadNoFormat = { content: 'Draft content', hallucination_check: true };
      buildInsertChain({ data: { id: 'draft-2', format: 'executive_summary', ...payloadNoFormat }, error: null });

      await repo.createDraft(CASE_ID, ORG_ID, payloadNoFormat);

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ format: 'executive_summary' }),
      );
    });

    it('throws when Supabase returns an error', async () => {
      buildInsertChain({ data: null, error: { message: 'insert failed' } });

      await expect(repo.createDraft(CASE_ID, ORG_ID, PAYLOAD)).rejects.toThrow('insert failed');
    });
  });

  describe('getLatestForCase', () => {
    it('returns the latest draft for a case', async () => {
      const expected = { id: 'draft-1', organization_id: ORG_ID, value_case_id: CASE_ID, ...PAYLOAD, created_at: '2026-03-21T00:00:00Z', updated_at: '2026-03-21T00:00:00Z' };
      buildSelectChain({ data: expected, error: null });

      const result = await repo.getLatestForCase(CASE_ID, ORG_ID);

      expect(result).toEqual(expected);
    });

    it('returns null when no draft exists', async () => {
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
