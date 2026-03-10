import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { supabase } from '../lib/supabase.js';
import { IntegrityOutputRepository } from './IntegrityOutputRepository.js';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function makeChain(terminal: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(terminal),
    single: vi.fn().mockResolvedValue(terminal),
  };
  return chain;
}

const CASE_ID = '00000000-0000-0000-0000-000000000001';
const ORG_ID = '00000000-0000-0000-0000-000000000002';
const OTHER_ORG_ID = '00000000-0000-0000-0000-000000000099';

const SAMPLE_CLAIMS = [
  {
    claim_id: 'claim-1',
    text: 'Reduces operational costs by 20%',
    confidence_score: 0.85,
    evidence_tier: 2,
    flagged: false,
  },
  {
    claim_id: 'claim-2',
    text: 'Increases revenue by 15%',
    confidence_score: 0.6,
    evidence_tier: 3,
    flagged: true,
    flag_reason: 'Insufficient evidence',
  },
];

const BASE_INPUT = {
  case_id: CASE_ID,
  organization_id: ORG_ID,
  agent_run_id: '00000000-0000-0000-0000-000000000010',
  claims: SAMPLE_CLAIMS,
  overall_confidence: 0.75,
  veto_triggered: false,
  source_agent: 'IntegrityAgent',
};

const STORED_ROW = {
  ...BASE_INPUT,
  id: 'integrity-out-1',
  veto_reason: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('IntegrityOutputRepository', () => {
  let repo: IntegrityOutputRepository;

  beforeEach(() => {
    repo = new IntegrityOutputRepository();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // upsertForCase
  // -------------------------------------------------------------------------

  describe('upsertForCase', () => {
    it('upserts and returns the stored row', async () => {
      const chain = makeChain({ data: STORED_ROW, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.upsertForCase(BASE_INPUT);

      expect(result.id).toBe('integrity-out-1');
      expect(result.case_id).toBe(CASE_ID);
      expect(result.organization_id).toBe(ORG_ID);
      expect(result.claims).toHaveLength(2);
      expect(result.overall_confidence).toBe(0.75);
      expect(result.veto_triggered).toBe(false);
    });

    it('passes onConflict: case_id,organization_id to supabase upsert', async () => {
      const chain = makeChain({ data: STORED_ROW, error: null });
      mockFrom.mockReturnValue(chain);

      await repo.upsertForCase(BASE_INPUT);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ case_id: CASE_ID, organization_id: ORG_ID }),
        { onConflict: 'case_id,organization_id' },
      );
    });

    it('throws when supabase returns an error', async () => {
      const chain = makeChain({ data: null, error: { message: 'upsert failed' } });
      mockFrom.mockReturnValue(chain);

      await expect(repo.upsertForCase(BASE_INPUT)).rejects.toThrow(
        'Failed to upsert integrity output',
      );
    });

    it('throws when supabase returns no data', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      await expect(repo.upsertForCase(BASE_INPUT)).rejects.toThrow(
        'Failed to upsert integrity output',
      );
    });

    it('rejects invalid case_id (not a UUID)', async () => {
      await expect(
        repo.upsertForCase({ ...BASE_INPUT, case_id: 'not-a-uuid' }),
      ).rejects.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // getForCase
  // -------------------------------------------------------------------------

  describe('getForCase', () => {
    it('returns the stored row when it exists', async () => {
      const chain = makeChain({ data: STORED_ROW, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getForCase(CASE_ID, ORG_ID);

      expect(result).not.toBeNull();
      expect(result?.case_id).toBe(CASE_ID);
      expect(result?.organization_id).toBe(ORG_ID);
    });

    it('returns null when no output exists', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getForCase(CASE_ID, ORG_ID);
      expect(result).toBeNull();
    });

    it('scopes query to both case_id and organization_id', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      await repo.getForCase(CASE_ID, ORG_ID);

      // eq must be called with organization_id to enforce tenant isolation
      const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
      const orgIdCall = eqCalls.find(
        ([col]: [string]) => col === 'organization_id',
      );
      expect(orgIdCall).toBeDefined();
      expect(orgIdCall?.[1]).toBe(ORG_ID);
    });

    it('cross-tenant read returns null (different org gets no data)', async () => {
      // Supabase RLS enforces this at DB level; the repository must pass the
      // correct organization_id so RLS can filter. Simulate RLS returning null.
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getForCase(CASE_ID, OTHER_ORG_ID);
      expect(result).toBeNull();

      // Verify the query was scoped to the requesting org, not the owning org
      const eqCalls = (chain.eq as ReturnType<typeof vi.fn>).mock.calls;
      const orgIdCall = eqCalls.find(([col]: [string]) => col === 'organization_id');
      expect(orgIdCall?.[1]).toBe(OTHER_ORG_ID);
    });

    it('throws when supabase returns an error', async () => {
      const chain = makeChain({ data: null, error: { message: 'db error' } });
      mockFrom.mockReturnValue(chain);

      await expect(repo.getForCase(CASE_ID, ORG_ID)).rejects.toThrow(
        'Failed to fetch integrity output',
      );
    });
  });
});
