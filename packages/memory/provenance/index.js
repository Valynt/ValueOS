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
// ProvenanceTracker
// ============================================================================
export class ProvenanceTracker {
    store;
    constructor(store) {
        this.store = store;
    }
    /**
     * Record a new provenance entry (append-only)
     */
    async record(input) {
        const record = {
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
    async getLineage(valueCaseId, claimId) {
        const records = await this.store.findByClaimId(valueCaseId, claimId);
        const chains = [];
        for (const record of records) {
            const chain = await this.buildChain(record);
            chains.push(chain);
        }
        return chains;
    }
    /**
     * Get all provenance records for a value case
     */
    async getAllForCase(valueCaseId) {
        return this.store.findByValueCaseId(valueCaseId);
    }
    /**
     * Get a single provenance record by ID
     */
    async getById(id) {
        return this.store.findById(id);
    }
    // ---- Private helpers ----
    async buildChain(record) {
        const parents = [];
        if (record.parentRecordId) {
            const parent = await this.store.findById(record.parentRecordId);
            if (parent) {
                parents.push(await this.buildChain(parent));
            }
        }
        return { record, parents };
    }
}
//# sourceMappingURL=index.js.map