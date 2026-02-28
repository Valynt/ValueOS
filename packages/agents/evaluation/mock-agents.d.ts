/**
 * Mock Agent Factory
 *
 * Creates deterministic mock agents for integration testing.
 * Each mock returns data from the evaluation datasets, allowing
 * the HypothesisLoop to be tested end-to-end without LLM calls.
 */
import type { ProvenanceRecord, ProvenanceStore } from '../../memory/provenance/index.js';
import type { DLQEventEmitter, DLQStore } from '../core/DeadLetterQueue.js';
import type { IdempotencyStore } from '../core/IdempotencyGuard.js';
import type { SagaAuditLogger, SagaEventEmitter, SagaPersistence, SagaSnapshot, SagaTransitionRecord } from '../core/ValueCaseSaga.js';
import type { RedTeamAgent, RedTeamOutput } from '../orchestration/agents/RedTeamAgent.js';
import type { FinancialModelingAgentInterface, GroundTruthAgentInterface, NarrativeAgentInterface, OpportunityAgentInterface } from '../orchestration/HypothesisLoop.js';
export declare function createMockOpportunityAgent(responses: Map<string, Awaited<ReturnType<OpportunityAgentInterface['analyzeOpportunities']>>>): OpportunityAgentInterface;
export declare function createMockFinancialModelingAgent(responses: Map<string, Awaited<ReturnType<FinancialModelingAgentInterface['analyzeFinancialModels']>>>): FinancialModelingAgentInterface;
export declare function createMockGroundTruthAgent(responses: Map<string, Awaited<ReturnType<GroundTruthAgentInterface['analyzeGroundtruth']>>>): GroundTruthAgentInterface;
export declare function createMockNarrativeAgent(responses: Map<string, Awaited<ReturnType<NarrativeAgentInterface['analyzeNarrative']>>>): NarrativeAgentInterface;
export declare function createMockRedTeamAgent(responses: Map<string, RedTeamOutput>): RedTeamAgent;
/** In-memory idempotency store */
export declare function createMockIdempotencyStore(): IdempotencyStore & {
    store: Map<string, string>;
};
/** In-memory DLQ store */
export declare function createMockDLQStore(): DLQStore & {
    entries: string[];
};
/** Event collector for testing */
export declare function createMockEventEmitter(): SagaEventEmitter & DLQEventEmitter & {
    events: Array<{
        type: string;
        payload: Record<string, unknown>;
    }>;
};
/** In-memory audit logger */
export declare function createMockAuditLogger(): SagaAuditLogger & {
    entries: Array<Record<string, unknown>>;
};
/** In-memory saga persistence */
export declare function createMockSagaPersistence(): SagaPersistence & {
    snapshots: Map<string, SagaSnapshot>;
    transitions: SagaTransitionRecord[];
};
/** In-memory provenance store */
export declare function createMockProvenanceStore(): ProvenanceStore & {
    records: ProvenanceRecord[];
};
//# sourceMappingURL=mock-agents.d.ts.map