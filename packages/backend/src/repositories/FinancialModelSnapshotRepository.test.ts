import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase.js', () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from '../lib/supabase.js';

import { FinancialModelSnapshotRepository } from './FinancialModelSnapshotRepository.js';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function makeChain(terminal: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(terminal),
    single: vi.fn().mockResolvedValue(terminal),
  };
  return chain;
}

const BASE_INPUT = {
  case_id: '00000000-0000-0000-0000-000000000001',
  organization_id: '00000000-0000-0000-0000-000000000002',
  roi: 2.4,
  npv: 1_200_000,
  payback_period_months: 18,
  assumptions_json: ['10% discount rate'],
  outputs_json: { total_npv: 1_200_000 },
  source_agent: 'FinancialModelingAgent',
};

describe('FinancialModelSnapshotRepository', () => {
  let repo: FinancialModelSnapshotRepository;

  beforeEach(() => {
    repo = new FinancialModelSnapshotRepository();
    vi.clearAllMocks();
  });

  describe('createSnapshot', () => {
    it('creates a snapshot with version 1 when none exist', async () => {
      const existingChain = makeChain({ data: null, error: null });
      const insertedRow = { ...BASE_INPUT, id: 'snap-1', snapshot_version: 1, created_at: new Date().toISOString() };
      const insertChain = makeChain({ data: insertedRow, error: null });

      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        return callIndex === 1 ? existingChain : insertChain;
      });

      const result = await repo.createSnapshot(BASE_INPUT);
      expect(result.snapshot_version).toBe(1);
      expect(result.roi).toBe(2.4);
    });

    it('increments snapshot_version for subsequent runs', async () => {
      const existingChain = makeChain({ data: { snapshot_version: 3 }, error: null });
      const insertedRow = { ...BASE_INPUT, id: 'snap-4', snapshot_version: 4, created_at: new Date().toISOString() };
      const insertChain = makeChain({ data: insertedRow, error: null });

      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        return callIndex === 1 ? existingChain : insertChain;
      });

      const result = await repo.createSnapshot(BASE_INPUT);
      expect(result.snapshot_version).toBe(4);
    });

    it('throws on insert error', async () => {
      const existingChain = makeChain({ data: null, error: null });
      const insertChain = makeChain({ data: null, error: { message: 'insert failed' } });

      let callIndex = 0;
      mockFrom.mockImplementation(() => {
        callIndex++;
        return callIndex === 1 ? existingChain : insertChain;
      });

      await expect(repo.createSnapshot(BASE_INPUT)).rejects.toThrow('Failed to create financial model snapshot');
    });
  });

  describe('getLatestSnapshotForCase', () => {
    it('returns the latest snapshot', async () => {
      const row = { ...BASE_INPUT, id: 'snap-2', snapshot_version: 2, created_at: new Date().toISOString() };
      const chain = makeChain({ data: row, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getLatestSnapshotForCase(BASE_INPUT.case_id, BASE_INPUT.organization_id);
      expect(result?.snapshot_version).toBe(2);
    });

    it('returns null when no snapshot exists', async () => {
      const chain = makeChain({ data: null, error: null });
      mockFrom.mockReturnValue(chain);

      const result = await repo.getLatestSnapshotForCase(BASE_INPUT.case_id, BASE_INPUT.organization_id);
      expect(result).toBeNull();
    });
  });

  describe('listSnapshotsForCase', () => {
    it('returns all snapshots newest first', async () => {
      const rows = [
        { ...BASE_INPUT, id: 'snap-2', snapshot_version: 2 },
        { ...BASE_INPUT, id: 'snap-1', snapshot_version: 1 },
      ];
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: rows, error: null }),
      };
      mockFrom.mockReturnValue(chain);

      const result = await repo.listSnapshotsForCase(BASE_INPUT.case_id, BASE_INPUT.organization_id);
      expect(result).toHaveLength(2);
      expect(result[0].snapshot_version).toBe(2);
    });
  });
});
