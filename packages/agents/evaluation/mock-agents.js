"use strict";
/**
 * Mock Agent Factory
 *
 * Creates deterministic mock agents for integration testing.
 * Each mock returns data from the evaluation datasets, allowing
 * the HypothesisLoop to be tested end-to-end without LLM calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMockOpportunityAgent = createMockOpportunityAgent;
exports.createMockFinancialModelingAgent = createMockFinancialModelingAgent;
exports.createMockGroundTruthAgent = createMockGroundTruthAgent;
exports.createMockNarrativeAgent = createMockNarrativeAgent;
exports.createMockRedTeamAgent = createMockRedTeamAgent;
exports.createMockIdempotencyStore = createMockIdempotencyStore;
exports.createMockDLQStore = createMockDLQStore;
exports.createMockEventEmitter = createMockEventEmitter;
exports.createMockAuditLogger = createMockAuditLogger;
exports.createMockSagaPersistence = createMockSagaPersistence;
exports.createMockProvenanceStore = createMockProvenanceStore;
// ============================================================================
// Mock Opportunity Agent
// ============================================================================
function createMockOpportunityAgent(responses) {
    return {
        async analyzeOpportunities(query, context) {
            // Find matching response by tenant or return first
            const key = context?.organizationId ?? 'default';
            const response = responses.get(key) ?? responses.values().next().value;
            if (!response) {
                throw new Error(`No mock response configured for tenant ${key}`);
            }
            return response;
        },
    };
}
// ============================================================================
// Mock Financial Modeling Agent
// ============================================================================
function createMockFinancialModelingAgent(responses) {
    return {
        async analyzeFinancialModels(query, context, _idempotencyKey) {
            const key = context?.organizationId ?? 'default';
            const response = responses.get(key) ?? responses.values().next().value;
            if (!response) {
                throw new Error(`No mock response configured for tenant ${key}`);
            }
            return response;
        },
    };
}
// ============================================================================
// Mock Ground Truth Agent
// ============================================================================
function createMockGroundTruthAgent(responses) {
    return {
        async analyzeGroundtruth(query, context, _idempotencyKey) {
            const key = context?.organizationId ?? 'default';
            const response = responses.get(key) ?? responses.values().next().value;
            if (!response) {
                throw new Error(`No mock response configured for tenant ${key}`);
            }
            return response;
        },
    };
}
// ============================================================================
// Mock Narrative Agent
// ============================================================================
function createMockNarrativeAgent(responses) {
    return {
        async analyzeNarrative(query, context, _idempotencyKey) {
            const key = context?.organizationId ?? 'default';
            const response = responses.get(key) ?? responses.values().next().value;
            if (!response) {
                throw new Error(`No mock response configured for tenant ${key}`);
            }
            return response;
        },
    };
}
// ============================================================================
// Mock Red Team Agent
// ============================================================================
function createMockRedTeamAgent(responses) {
    return {
        analyze: async (input) => {
            const key = input.tenantId;
            const response = responses.get(key) ?? responses.values().next().value;
            if (!response) {
                throw new Error(`No mock response configured for tenant ${key}`);
            }
            return response;
        },
    };
}
// ============================================================================
// Mock Infrastructure
// ============================================================================
/** In-memory idempotency store */
function createMockIdempotencyStore() {
    const store = new Map();
    return {
        store,
        async get(key) {
            return store.get(key) ?? null;
        },
        async set(key, value, _ttlSeconds) {
            store.set(key, value);
        },
    };
}
/** In-memory DLQ store */
function createMockDLQStore() {
    const entries = [];
    return {
        entries,
        async lpush(_key, value) {
            entries.unshift(value);
        },
        async lrange(_key, start, stop) {
            return entries.slice(start, stop + 1);
        },
        async llen(_key) {
            return entries.length;
        },
        async lrem(_key, _count, value) {
            const idx = entries.indexOf(value);
            if (idx >= 0) {
                entries.splice(idx, 1);
                return 1;
            }
            return 0;
        },
    };
}
/** Event collector for testing */
function createMockEventEmitter() {
    const events = [];
    return {
        events,
        emit(event) {
            events.push({ type: event.type, payload: event.payload });
        },
    };
}
/** In-memory audit logger */
function createMockAuditLogger() {
    const entries = [];
    return {
        entries,
        async log(entry) {
            entries.push(entry);
        },
    };
}
/** In-memory saga persistence */
function createMockSagaPersistence() {
    const snapshots = new Map();
    const transitions = [];
    return {
        snapshots,
        transitions,
        async saveState(snapshot) {
            snapshots.set(snapshot.valueCaseId, snapshot);
        },
        async loadState(valueCaseId) {
            return snapshots.get(valueCaseId) ?? null;
        },
        async recordTransition(record) {
            transitions.push(record);
        },
    };
}
/** In-memory provenance store */
function createMockProvenanceStore() {
    const records = [];
    return {
        records,
        async insert(record) {
            records.push(record);
        },
        async findByClaimId(valueCaseId, claimId) {
            return records.filter((r) => r.valueCaseId === valueCaseId && r.claimId === claimId);
        },
        async findById(id) {
            return records.find((r) => r.id === id) ?? null;
        },
        async findByValueCaseId(valueCaseId) {
            return records.filter((r) => r.valueCaseId === valueCaseId);
        },
    };
}
//# sourceMappingURL=mock-agents.js.map