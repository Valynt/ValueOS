import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  type ProvenanceRecord,
  type ProvenanceStore,
  ProvenanceTracker,
} from '../provenance/index.js';

// ---------------------------------------------------------------------------
// In-memory store for testing
// ---------------------------------------------------------------------------

class InMemoryProvenanceStore implements ProvenanceStore {
  private records: Map<string, ProvenanceRecord> = new Map();

  async insert(record: ProvenanceRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]> {
    return [...this.records.values()].filter(
      (r) => r.valueCaseId === valueCaseId && r.claimId === claimId,
    );
  }

  async findById(id: string): Promise<ProvenanceRecord | null> {
    return this.records.get(id) ?? null;
  }

  async findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]> {
    return [...this.records.values()].filter((r) => r.valueCaseId === valueCaseId);
  }

  all(): ProvenanceRecord[] {
    return [...this.records.values()];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(overrides: Partial<Omit<ProvenanceRecord, 'id' | 'createdAt'>> = {}) {
  return {
    valueCaseId: 'case-1',
    claimId: 'claim-1',
    dataSource: 'ACME 10-K',
    evidenceTier: 1 as const,
    agentId: 'TargetAgent',
    agentVersion: '1.0.0',
    confidenceScore: 0.85,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProvenanceTracker', () => {
  let store: InMemoryProvenanceStore;
  let tracker: ProvenanceTracker;

  beforeEach(() => {
    store = new InMemoryProvenanceStore();
    tracker = new ProvenanceTracker(store);
  });

  describe('record()', () => {
    it('inserts a record with generated id and createdAt', async () => {
      const rec = await tracker.record(baseInput());

      expect(rec.id).toBeTruthy();
      expect(rec.createdAt).toBeTruthy();
      expect(new Date(rec.createdAt).getTime()).not.toBeNaN();
    });

    it('persists to the store', async () => {
      await tracker.record(baseInput());
      expect(store.all()).toHaveLength(1);
    });

    it('stores optional formula field', async () => {
      const rec = await tracker.record(baseInput({ formula: 'revenue * margin' }));
      expect(rec.formula).toBe('revenue * margin');
    });

    it('stores optional parentRecordId', async () => {
      const parent = await tracker.record(baseInput({ claimId: 'claim-parent' }));
      const child = await tracker.record(baseInput({ parentRecordId: parent.id }));
      expect(child.parentRecordId).toBe(parent.id);
    });

    it('rejects invalid confidenceScore via Zod', async () => {
      await expect(
        tracker.record(baseInput({ confidenceScore: 1.5 })),
      ).rejects.toThrow();
    });

    it('rejects invalid evidenceTier via Zod', async () => {
      await expect(
        // @ts-expect-error intentional bad value
        tracker.record(baseInput({ evidenceTier: 4 })),
      ).rejects.toThrow();
    });
  });

  describe('getLineage()', () => {
    it('returns empty array when no records exist', async () => {
      const chains = await tracker.getLineage('case-1', 'claim-missing');
      expect(chains).toHaveLength(0);
    });

    it('returns a chain for a single record', async () => {
      await tracker.record(baseInput());
      const chains = await tracker.getLineage('case-1', 'claim-1');

      expect(chains).toHaveLength(1);
      expect(chains[0]!.record.claimId).toBe('claim-1');
      expect(chains[0]!.parents).toHaveLength(0);
    });

    it('builds parent chain for linked records', async () => {
      const parent = await tracker.record(baseInput({ claimId: 'claim-1' }));
      await tracker.record(baseInput({ claimId: 'claim-1', parentRecordId: parent.id }));

      const chains = await tracker.getLineage('case-1', 'claim-1');
      // Two root records for claim-1; the second has a parent
      const withParent = chains.find((c) => c.parents.length > 0);
      expect(withParent).toBeDefined();
      expect(withParent!.parents[0]!.record.id).toBe(parent.id);
    });

    it('scopes results to valueCaseId', async () => {
      await tracker.record(baseInput({ valueCaseId: 'case-A', claimId: 'claim-1' }));
      await tracker.record(baseInput({ valueCaseId: 'case-B', claimId: 'claim-1' }));

      const chains = await tracker.getLineage('case-A', 'claim-1');
      expect(chains).toHaveLength(1);
      expect(chains[0]!.record.valueCaseId).toBe('case-A');
    });
  });

  describe('getAllForCase()', () => {
    it('returns all records for a case', async () => {
      await tracker.record(baseInput({ claimId: 'claim-1' }));
      await tracker.record(baseInput({ claimId: 'claim-2' }));
      await tracker.record(baseInput({ valueCaseId: 'case-other', claimId: 'claim-1' }));

      const records = await tracker.getAllForCase('case-1');
      expect(records).toHaveLength(2);
      expect(records.every((r) => r.valueCaseId === 'case-1')).toBe(true);
    });
  });

  describe('getById()', () => {
    it('returns the record by id', async () => {
      const rec = await tracker.record(baseInput());
      const found = await tracker.getById(rec.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(rec.id);
    });

    it('returns null for unknown id', async () => {
      const found = await tracker.getById('nonexistent');
      expect(found).toBeNull();
    });
  });
});
