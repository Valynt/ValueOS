/**
 * ProvenanceTracker unit tests
 *
 * Uses an in-memory store. Validates: record() validates schema, getLineage()
 * builds chain, append-only (no delete/update).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ProvenanceTracker,
  type ProvenanceRecord,
  type ProvenanceStore,
} from '../provenance/index.js';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

function makeStore(): ProvenanceStore & { _records: ProvenanceRecord[] } {
  const _records: ProvenanceRecord[] = [];

  return {
    _records,
    insert: vi.fn(async (record: ProvenanceRecord) => {
      _records.push(record);
    }),
    findByClaimId: vi.fn(async (valueCaseId: string, claimId: string) =>
      _records.filter((r) => r.valueCaseId === valueCaseId && r.claimId === claimId)
    ),
    findById: vi.fn(async (id: string) => _records.find((r) => r.id === id) ?? null),
    findByValueCaseId: vi.fn(async (valueCaseId: string) =>
      _records.filter((r) => r.valueCaseId === valueCaseId)
    ),
  };
}

function makeInput(overrides: Partial<Omit<ProvenanceRecord, 'id' | 'createdAt'>> = {}) {
  return {
    valueCaseId: 'case-1',
    claimId: 'claim-1',
    dataSource: 'TargetAgent',
    evidenceTier: 2 as const,
    agentId: 'TargetAgent',
    agentVersion: '1.0.0',
    confidenceScore: 0.75,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProvenanceTracker', () => {
  let store: ReturnType<typeof makeStore>;
  let tracker: ProvenanceTracker;

  beforeEach(() => {
    store = makeStore();
    tracker = new ProvenanceTracker(store);
  });

  describe('record()', () => {
    it('assigns id and createdAt, stores the record', async () => {
      const record = await tracker.record(makeInput());

      expect(record.id).toBeTruthy();
      expect(record.createdAt).toBeTruthy();
      expect(store._records).toHaveLength(1);
      expect(store._records[0]?.claimId).toBe('claim-1');
    });

    it('validates schema — rejects invalid evidenceTier', async () => {
      await expect(
        tracker.record(makeInput({ evidenceTier: 99 as never }))
      ).rejects.toThrow();
    });

    it('validates schema — rejects confidenceScore > 1', async () => {
      await expect(
        tracker.record(makeInput({ confidenceScore: 1.5 }))
      ).rejects.toThrow();
    });

    it('validates schema — rejects confidenceScore < 0', async () => {
      await expect(
        tracker.record(makeInput({ confidenceScore: -0.1 }))
      ).rejects.toThrow();
    });

    it('is append-only — calling record() twice creates two entries', async () => {
      await tracker.record(makeInput());
      await tracker.record(makeInput({ claimId: 'claim-2' }));
      expect(store._records).toHaveLength(2);
    });
  });

  describe('getLineage()', () => {
    it('returns empty array when no records exist', async () => {
      const chains = await tracker.getLineage('case-1', 'nonexistent-claim');
      expect(chains).toEqual([]);
    });

    it('returns chain for a single record', async () => {
      await tracker.record(makeInput());
      const chains = await tracker.getLineage('case-1', 'claim-1');

      expect(chains).toHaveLength(1);
      expect(chains[0]?.record.claimId).toBe('claim-1');
      expect(chains[0]?.parents).toEqual([]);
    });

    it('builds parent chain when parentRecordId is set', async () => {
      const parent = await tracker.record(makeInput({ claimId: 'parent-claim' }));
      await tracker.record(makeInput({ claimId: 'child-claim', parentRecordId: parent.id }));

      const chains = await tracker.getLineage('case-1', 'child-claim');
      expect(chains).toHaveLength(1);
      expect(chains[0]?.parents).toHaveLength(1);
      expect(chains[0]?.parents[0]?.record.claimId).toBe('parent-claim');
    });
  });

  describe('getAllForCase()', () => {
    it('returns all records for a case', async () => {
      await tracker.record(makeInput({ claimId: 'claim-a' }));
      await tracker.record(makeInput({ claimId: 'claim-b' }));
      await tracker.record(makeInput({ valueCaseId: 'case-2', claimId: 'claim-c' }));

      const records = await tracker.getAllForCase('case-1');
      expect(records).toHaveLength(2);
    });
  });
});
