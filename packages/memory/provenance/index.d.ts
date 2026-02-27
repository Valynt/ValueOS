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
export declare const ProvenanceRecordSchema: z.ZodObject<{
    id: z.ZodString;
    valueCaseId: z.ZodString;
    claimId: z.ZodString;
    dataSource: z.ZodString;
    evidenceTier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    formula: z.ZodOptional<z.ZodString>;
    agentId: z.ZodString;
    agentVersion: z.ZodString;
    confidenceScore: z.ZodNumber;
    createdAt: z.ZodString;
    parentRecordId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    agentId: string;
    createdAt: string;
    valueCaseId: string;
    confidenceScore: number;
    claimId: string;
    dataSource: string;
    evidenceTier: 1 | 3 | 2;
    agentVersion: string;
    formula?: string | undefined;
    parentRecordId?: string | undefined;
}, {
    id: string;
    agentId: string;
    createdAt: string;
    valueCaseId: string;
    confidenceScore: number;
    claimId: string;
    dataSource: string;
    evidenceTier: 1 | 3 | 2;
    agentVersion: string;
    formula?: string | undefined;
    parentRecordId?: string | undefined;
}>;
export interface ProvenanceStore {
    insert(record: ProvenanceRecord): Promise<void>;
    findByClaimId(valueCaseId: string, claimId: string): Promise<ProvenanceRecord[]>;
    findById(id: string): Promise<ProvenanceRecord | null>;
    findByValueCaseId(valueCaseId: string): Promise<ProvenanceRecord[]>;
}
export declare class ProvenanceTracker {
    private store;
    constructor(store: ProvenanceStore);
    /**
     * Record a new provenance entry (append-only)
     */
    record(input: Omit<ProvenanceRecord, 'id' | 'createdAt'>): Promise<ProvenanceRecord>;
    /**
     * Get the full lineage chain for a claim.
     * Walks up the parentRecordId chain to build the derivation tree.
     */
    getLineage(valueCaseId: string, claimId: string): Promise<ProvenanceChain[]>;
    /**
     * Get all provenance records for a value case
     */
    getAllForCase(valueCaseId: string): Promise<ProvenanceRecord[]>;
    /**
     * Get a single provenance record by ID
     */
    getById(id: string): Promise<ProvenanceRecord | null>;
    private buildChain;
}
//# sourceMappingURL=index.d.ts.map