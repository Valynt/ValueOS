"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProvenanceTracker = exports.ProvenanceRecordSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// Zod Schemas
// ============================================================================
exports.ProvenanceRecordSchema = zod_1.z.object({
    id: zod_1.z.string(),
    valueCaseId: zod_1.z.string(),
    claimId: zod_1.z.string(),
    dataSource: zod_1.z.string(),
    evidenceTier: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal(2), zod_1.z.literal(3)]),
    formula: zod_1.z.string().optional(),
    agentId: zod_1.z.string(),
    agentVersion: zod_1.z.string(),
    confidenceScore: zod_1.z.number().min(0).max(1),
    createdAt: zod_1.z.string(),
    parentRecordId: zod_1.z.string().optional(),
});
// ============================================================================
// ProvenanceTracker
// ============================================================================
class ProvenanceTracker {
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
        exports.ProvenanceRecordSchema.parse(record);
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
exports.ProvenanceTracker = ProvenanceTracker;
//# sourceMappingURL=index.js.map