/**
 * Provenance Tracking
 *
 * Tracks data lineage for every calculated figure in the Value Tree.
 * Supports the "CFO Defence" requirement — every number must trace
 * back to its source data, formula, and producing agent.
 *
 * Records are immutable (append-only) and stored in the `agent_memory`
 * table with `memory_type: 'provenance'`.
 */

import { z } from 'zod';

// ============================================================================
// Types
// ============================================================================

export interface ProvenanceRecord {
  id: string;
  valueCaseId: string;
  claimId: string;
  dataSource: string;
  evidenceTier: 1 | 2 | 3;
  formula?: string;
  agentId: string;
  agentVersion: string;
  confidenceScore: number;
  createdAt: string;
  parentRecordId?: string;
}

export interface ProvenanceChain {
  record: ProvenanceRecord;
  parents: ProvenanceChain[];
}

// ============================================================================
// Zod Schemas
// ============================================================================

export const ProvenanceRecordSchema = z.object({
  id: z.string(),
  valueCaseId: z.string(),
  claimId: z.string(),
  dataSource: z.string(),
  evidenceTier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  formula: z.string().optional(),
  agentId: z.string(),
  agentVersion: z.string(),
  confidenceScore: z.number().min(0).max(1),
  createdAt: z.string(),
  parentRecordId: z.string().optional(),
});

// ============================================================================
// Persistence Interface (dependency injection)
// ============================================================================

export interface ProvenanceStore {
  insert(record: ProvenanceRecord): Promise<void>;
  findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]>;
  findById(id: string): Promise<ProvenanceRecord | null>;
  findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]>;
}

// ============================================================================
// ProvenanceTracker
// ============================================================================

export class ProvenanceTracker {
  private store: ProvenanceStore;

  constructor(store: ProvenanceStore) {
    this.store = store;
  }

  /**
   * Record a new provenance entry (append-only)
   */
  async record(input: Omit<ProvenanceRecord, 'id' | 'createdAt'>): Promise<ProvenanceRecord> {
    const record: ProvenanceRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    ProvenanceRecordSchema.parse(record);
    await this.store.insert(record);

    return record;
  }

  /**
   * Get the full lineage chain for a claim.
   * Walks up the parentRecordId chain to build the derivation tree.
   */
  async getLineage(valueCaseId: string, claimId: string): Promise<ProvenanceChain[]> {
    const records = await this.store.findByClaimId(valueCaseId, claimId);
    const chains: ProvenanceChain[] = [];

    for (const record of records) {
      const chain = await this.buildChain(record);
      chains.push(chain);
    }

    return chains;
  }

  /**
   * Get all provenance records for a value case
   */
  async getAllForCase(valueCaseId: string): Promise<ProvenanceRecord[]> {
    return this.store.findByValueCaseId(valueCaseId);
  }

  /**
   * Get a single provenance record by ID
   */
  async getById(id: string): Promise<ProvenanceRecord | null> {
    return this.store.findById(id);
  }

  // ---- Private helpers ----

  private async buildChain(record: ProvenanceRecord): Promise<ProvenanceChain> {
    const parents: ProvenanceChain[] = [];

    if (record.parentRecordId) {
      const parent = await this.store.findById(record.parentRecordId);
      if (parent) {
        parents.push(await this.buildChain(parent));
      }
    }

    return { record, parents };
  }
}
