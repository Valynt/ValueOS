/**
 * Mock Agent Factory
 *
 * Creates deterministic mock agents for integration testing.
 * Each mock returns data from the evaluation datasets, allowing
 * the HypothesisLoop to be tested end-to-end without LLM calls.
 */

import type {
  FinancialModelingAgentInterface,
  GroundTruthAgentInterface,
  NarrativeAgentInterface,
  OpportunityAgentInterface,
} from '../orchestration/HypothesisLoop.js';
import type { RedTeamAgent, RedTeamInput, RedTeamOutput } from '../orchestration/agents/RedTeamAgent.js';
import type { IdempotencyStore } from '../core/IdempotencyGuard.js';
import type { DLQEventEmitter, DLQStore } from '../core/DeadLetterQueue.js';
import type { SagaAuditLogger, SagaEventEmitter, SagaPersistence, SagaSnapshot, SagaTransitionRecord } from '../core/ValueCaseSaga.js';
import type { ProvenanceRecord, ProvenanceStore } from '../../memory/provenance/index.js';

// ============================================================================
// Mock Opportunity Agent
// ============================================================================

export function createMockOpportunityAgent(
  responses: Map<string, Awaited<ReturnType<OpportunityAgentInterface['analyzeOpportunities']>>>
): OpportunityAgentInterface {
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

export function createMockFinancialModelingAgent(
  responses: Map<string, Awaited<ReturnType<FinancialModelingAgentInterface['analyzeFinancialModels']>>>
): FinancialModelingAgentInterface {
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

export function createMockGroundTruthAgent(
  responses: Map<string, Awaited<ReturnType<GroundTruthAgentInterface['analyzeGroundtruth']>>>
): GroundTruthAgentInterface {
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

export function createMockNarrativeAgent(
  responses: Map<string, Awaited<ReturnType<NarrativeAgentInterface['analyzeNarrative']>>>
): NarrativeAgentInterface {
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

export function createMockRedTeamAgent(
  responses: Map<string, RedTeamOutput>
): RedTeamAgent {
  return {
    analyze: async (input: RedTeamInput): Promise<RedTeamOutput> => {
      const key = input.tenantId;
      const response = responses.get(key) ?? responses.values().next().value;
      if (!response) {
        throw new Error(`No mock response configured for tenant ${key}`);
      }
      return response;
    },
  } as RedTeamAgent;
}

// ============================================================================
// Mock Infrastructure
// ============================================================================

/** In-memory idempotency store */
export function createMockIdempotencyStore(): IdempotencyStore & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, _ttlSeconds: number) {
      store.set(key, value);
    },
  };
}

/** In-memory DLQ store */
export function createMockDLQStore(): DLQStore & { entries: string[] } {
  const entries: string[] = [];
  return {
    entries,
    async lpush(_key: string, value: string) {
      entries.unshift(value);
    },
    async lrange(_key: string, start: number, stop: number) {
      return entries.slice(start, stop + 1);
    },
    async llen(_key: string) {
      return entries.length;
    },
    async lrem(_key: string, _count: number, value: string) {
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
export function createMockEventEmitter(): SagaEventEmitter & DLQEventEmitter & { events: Array<{ type: string; payload: Record<string, unknown> }> } {
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
  return {
    events,
    emit(event) {
      events.push({ type: event.type, payload: event.payload });
    },
  };
}

/** In-memory audit logger */
export function createMockAuditLogger(): SagaAuditLogger & { entries: Array<Record<string, unknown>> } {
  const entries: Array<Record<string, unknown>> = [];
  return {
    entries,
    async log(entry) {
      entries.push(entry);
    },
  };
}

/** In-memory saga persistence */
export function createMockSagaPersistence(): SagaPersistence & {
  snapshots: Map<string, SagaSnapshot>;
  transitions: SagaTransitionRecord[];
} {
  const snapshots = new Map<string, SagaSnapshot>();
  const transitions: SagaTransitionRecord[] = [];
  return {
    snapshots,
    transitions,
    async saveState(snapshot: SagaSnapshot) {
      snapshots.set(snapshot.valueCaseId, snapshot);
    },
    async loadState(valueCaseId: string) {
      return snapshots.get(valueCaseId) ?? null;
    },
    async recordTransition(record: SagaTransitionRecord) {
      transitions.push(record);
    },
  };
}

/** In-memory provenance store */
export function createMockProvenanceStore(): ProvenanceStore & {
  records: ProvenanceRecord[];
} {
  const records: ProvenanceRecord[] = [];
  return {
    records,
    async insert(record: ProvenanceRecord) {
      records.push(record);
    },
    async findByClaimId(valueCaseId: string, claimId: string) {
      return records.filter((r) => r.valueCaseId === valueCaseId && r.claimId === claimId);
    },
    async findById(id: string) {
      return records.find((r) => r.id === id) ?? null;
    },
    async findByValueCaseId(valueCaseId: string) {
      return records.filter((r) => r.valueCaseId === valueCaseId);
    },
  };
}
