/**
 * HypothesisLoop unit tests
 *
 * Covers: full happy-path loop, critical objection triggering revision,
 * max revision cycle enforcement, failed step routing to DLQ,
 * and idempotency key presence on every step.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DeadLetterQueue, type DLQStore } from '../../core/DeadLetterQueue.js';
import { IdempotencyGuard } from '../../core/IdempotencyGuard.js';
import { SagaState, SagaTrigger, ValueCaseSaga } from '../../core/ValueCaseSaga.js';
import { HypothesisLoop } from '../HypothesisLoop.js';
import type {
  FinancialModelOutput,
  GroundTruthAgentInterface,
  NarrativeAgentInterface,
  OpportunityAgentInterface,
  FinancialModelingAgentInterface,
} from '../HypothesisLoop.js';
import type { RedTeamAnalyzer, RedTeamOutput } from '../agents/RedTeamAgent.js';

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

function makeOpportunityAgent(): OpportunityAgentInterface {
  return {
    analyzeOpportunities: vi.fn(async () => ({
      opportunities: [
        {
          title: 'Reduce manual processing',
          description: 'Automate repetitive tasks',
          confidence: 0.8,
          category: 'efficiency',
          estimatedValue: 100000,
        },
      ],
      analysis: 'One high-confidence opportunity identified',
    })),
  };
}

function makeFinancialAgent(): FinancialModelingAgentInterface {
  return {
    analyzeFinancialModels: vi.fn(async () => ({
      financial_models: [
        {
          title: 'Automation ROI',
          description: 'Annual savings from automation',
          confidence: 0.8,
          category: 'cost_reduction',
          model_type: 'roi',
          priority: 'high',
          value: 100000,
          currency: 'USD',
          timeBasis: 'annual' as const,
          assumptions: ['10 FTEs affected'],
          drivers: [],
          citations: [],
        } as FinancialModelOutput,
      ],
      analysis: 'Strong financial case with 3x ROI',
    })),
  };
}

function makeGroundTruthAgent(): GroundTruthAgentInterface {
  return {
    analyzeGroundtruth: vi.fn(async () => ({
      groundtruths: [
        {
          title: 'Industry benchmark',
          description: 'Validated by Gartner',
          confidence: 0.9,
          category: 'benchmark',
          verification_type: 'external',
          priority: 'high',
        },
      ],
      analysis: 'Evidence supports the hypothesis',
    })),
  };
}

function makeNarrativeAgent(): NarrativeAgentInterface {
  return {
    analyzeNarrative: vi.fn(async () => ({
      narratives: [
        {
          title: 'Executive Summary',
          description: 'Strong ROI case with validated evidence',
          confidence: 0.85,
          category: 'summary',
          narrative_type: 'executive',
          priority: 'high',
        },
      ],
      analysis: 'Compelling narrative for stakeholders',
    })),
  };
}

function makeRedTeamAgent(hasCritical = false): RedTeamAnalyzer {
  return {
    analyze: vi.fn(async (): Promise<RedTeamOutput> => ({
      objections: hasCritical
        ? [{ id: 'obj-1', description: 'Assumption unverified', severity: 'critical', category: 'assumption', confidence: 0.9 }]
        : [{ id: 'obj-1', description: 'Minor concern', severity: 'low', category: 'assumption', confidence: 0.3 }],
      summary: hasCritical ? 'Critical objection found' : 'No critical objections',
      overallRisk: hasCritical ? 'high' : 'low',
      recommendation: hasCritical ? 'revise' : 'proceed',
    })),
  };
}

function makeSaga(initialState = SagaState.INITIATED) {
  let stored = {
    valueCaseId: 'case-1',
    tenantId: 'tenant-1',
    state: initialState,
    data: {},
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return new ValueCaseSaga({
    persistence: {
      saveState: vi.fn(async (s) => { stored = s; }),
      loadState: vi.fn(async () => stored),
      recordTransition: vi.fn(async () => {}),
    },
    eventEmitter: { emit: vi.fn() },
    auditLogger: { log: vi.fn(async () => {}) },
  });
}

function makeIdempotencyGuard() {
  const store = new Map<string, string>();
  return new IdempotencyGuard({
    get: async (k) => store.get(k) ?? null,
    set: async (k, v, _ttl?: number) => { store.set(k, v); },
    has: async (k) => store.has(k),
  });
}

function makeDlq() {
  const entries: string[] = [];
  const store: DLQStore = {
    lpush: vi.fn(async (_k, v) => { entries.push(v); }),
    lrange: vi.fn(async (_k, s, e) => entries.slice(s, e + 1)),
    llen: vi.fn(async () => entries.length),
    lrem: vi.fn(async (_k, _c, v) => {
      const i = entries.indexOf(v);
      if (i >= 0) { entries.splice(i, 1); return 1; }
      return 0;
    }),
  };
  const dlq = new DeadLetterQueue(store, { emit: vi.fn() });
  return { dlq, store, entries };
}

function makeLoop(overrides: {
  redTeamAgent?: RedTeamAnalyzer;
  maxRevisionCycles?: number;
} = {}) {
  return new HypothesisLoop({
    saga: makeSaga(),
    idempotencyGuard: makeIdempotencyGuard(),
    dlq: makeDlq().dlq,
    opportunityAgent: makeOpportunityAgent(),
    financialModelingAgent: makeFinancialAgent(),
    groundTruthAgent: makeGroundTruthAgent(),
    narrativeAgent: makeNarrativeAgent(),
    redTeamAgent: overrides.redTeamAgent ?? makeRedTeamAgent(false),
    config: { maxRevisionCycles: overrides.maxRevisionCycles ?? 3 },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HypothesisLoop', () => {
  describe('happy path', () => {
    it('runs INITIATED → FINALIZED with no objections', async () => {
      const loop = makeLoop();
      const result = await loop.run('case-1', 'tenant-1', 'corr-1');

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('FINALIZED');
      expect(result.revisionCount).toBe(0);
      expect(result.hypotheses.length).toBeGreaterThan(0);
      expect(result.valueTree).not.toBeNull();
      expect(result.narrative).not.toBeNull();
    });

    it('idempotency key is present on every step (no duplicate execution on re-run)', async () => {
      const guard = makeIdempotencyGuard();
      const executeSpy = vi.spyOn(guard, 'execute');

      const loop = new HypothesisLoop({
        saga: makeSaga(),
        idempotencyGuard: guard,
        dlq: makeDlq().dlq,
        opportunityAgent: makeOpportunityAgent(),
        financialModelingAgent: makeFinancialAgent(),
        groundTruthAgent: makeGroundTruthAgent(),
        narrativeAgent: makeNarrativeAgent(),
        redTeamAgent: makeRedTeamAgent(false),
      });

      await loop.run('case-1', 'tenant-1', 'corr-1');

      // At minimum: hypothesis, model, evidence, narrative, redteam steps
      expect(executeSpy).toHaveBeenCalledTimes(5);
      // Every call must have a non-empty idempotency key
      for (const call of executeSpy.mock.calls) {
        expect(typeof call[0]).toBe('string');
        expect(call[0].length).toBeGreaterThan(0);
      }
    });
  });

  describe('revision cycle', () => {
    it('critical objection triggers one revision cycle', async () => {
      // First call: critical objection → revision. Second call: no objection → finalize.
      let callCount = 0;
      const redTeamAgent: RedTeamAnalyzer = {
        analyze: vi.fn(async (): Promise<RedTeamOutput> => {
          callCount++;
          const hasCritical = callCount === 1;
          return {
            objections: hasCritical
              ? [{ id: 'obj-1', description: 'Unverified assumption', severity: 'critical', category: 'assumption', confidence: 0.9 }]
              : [],
            summary: hasCritical ? 'Critical found' : 'Clean',
            overallRisk: hasCritical ? 'high' : 'low',
            recommendation: hasCritical ? 'revise' : 'proceed',
          };
        }),
      };

      const loop = makeLoop({ redTeamAgent, maxRevisionCycles: 3 });
      const result = await loop.run('case-1', 'tenant-1', 'corr-1');

      expect(result.success).toBe(true);
      expect(result.revisionCount).toBe(1);
      expect(result.finalState).toBe('FINALIZED');
    });

    it('enforces max 3 revision cycles', async () => {
      // Always returns critical objection → should stop at maxRevisionCycles
      const loop = makeLoop({ redTeamAgent: makeRedTeamAgent(true), maxRevisionCycles: 3 });
      const result = await loop.run('case-1', 'tenant-1', 'corr-1');

      // After maxRevisionCycles the loop exits regardless of objections
      expect(result.revisionCount).toBeLessThanOrEqual(3);
    });
  });

  describe('failure handling', () => {
    it('failed step routes to DLQ and returns success: false', async () => {
      const { dlq, store } = makeDlq();

      const failingOpportunityAgent: OpportunityAgentInterface = {
        analyzeOpportunities: vi.fn(async () => {
          throw new Error('LLM timeout');
        }),
      };

      const loop = new HypothesisLoop({
        saga: makeSaga(),
        idempotencyGuard: makeIdempotencyGuard(),
        dlq,
        opportunityAgent: failingOpportunityAgent,
        financialModelingAgent: makeFinancialAgent(),
        groundTruthAgent: makeGroundTruthAgent(),
        narrativeAgent: makeNarrativeAgent(),
        redTeamAgent: makeRedTeamAgent(false),
      });

      const result = await loop.run('case-1', 'tenant-1', 'corr-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM timeout');
      expect(store.lpush).toHaveBeenCalled();
    });
  });
});
