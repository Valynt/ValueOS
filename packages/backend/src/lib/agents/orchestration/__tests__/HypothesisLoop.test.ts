import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DLQEntry } from '../../core/DeadLetterQueue.js';
import {
  type FinancialModelingAgentInterface,
  type GroundTruthAgentInterface,
  HypothesisLoop,
  type NarrativeAgentInterface,
  type OpportunityAgentInterface,
} from '../HypothesisLoop.js';
import {
  type SagaSnapshot,
  SagaState,
  SagaTrigger,
  type SagaTriggerType,
} from '../../core/ValueCaseSaga.js';
import type { RedTeamAnalyzer, RedTeamOutput } from '../agents/RedTeamAgent.js';

vi.mock("../../../supabase.js");

// ---------------------------------------------------------------------------
// In-memory saga stub (mirrors the one in the redteam-dispatch test)
// ---------------------------------------------------------------------------

class InMemorySaga {
  private state = SagaState.INITIATED;
  private version = 1;

  async initialize(valueCaseId: string, tenantId: string): Promise<SagaSnapshot> {
    return this.makeSnapshot(valueCaseId, tenantId);
  }

  async transition(
    valueCaseId: string,
    trigger: SagaTriggerType,
    _correlationId: string,
  ): Promise<SagaSnapshot> {
    if (trigger === SagaTrigger.OPPORTUNITY_INGESTED) this.state = SagaState.DRAFTING;
    else if (trigger === SagaTrigger.HYPOTHESIS_CONFIRMED) this.state = SagaState.VALIDATING;
    else if (trigger === SagaTrigger.INTEGRITY_PASSED) this.state = SagaState.COMPOSING;
    else if (trigger === SagaTrigger.REDTEAM_OBJECTION) this.state = SagaState.DRAFTING;
    else if (trigger === SagaTrigger.FEEDBACK_RECEIVED) this.state = SagaState.REFINING;
    else if (trigger === SagaTrigger.VE_APPROVED) this.state = SagaState.FINALIZED;
    this.version++;
    return this.makeSnapshot(valueCaseId, 'tenant-1');
  }

  async getState(valueCaseId: string): Promise<SagaSnapshot> {
    return this.makeSnapshot(valueCaseId, 'tenant-1');
  }

  async compensate(_valueCaseId: string, _correlationId: string) {
    return [];
  }

  private makeSnapshot(valueCaseId: string, tenantId: string): SagaSnapshot {
    return {
      valueCaseId,
      tenantId,
      state: this.state,
      data: {},
      version: this.version,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

// ---------------------------------------------------------------------------
// Minimal agent mocks
// ---------------------------------------------------------------------------

function makeOpportunityAgent(): OpportunityAgentInterface {
  return {
    analyzeOpportunities: vi.fn().mockResolvedValue({
      opportunities: [
        { title: 'Reduce churn', description: 'Reduce churn by 10%', confidence: 0.8, category: 'retention', estimatedValue: 100000 },
      ],
      analysis: 'Strong retention opportunity',
    }),
  };
}

function makeFinancialAgent(): FinancialModelingAgentInterface {
  return {
    analyzeFinancialModels: vi.fn().mockResolvedValue({
      financial_models: [
        { title: 'Churn reduction model', description: 'ARR impact', confidence: 0.75, category: 'retention', model_type: 'linear', priority: 'high', value: 100000, currency: 'USD' },
      ],
      analysis: 'Model complete',
    }),
  };
}

function makeGroundTruthAgent(): GroundTruthAgentInterface {
  return {
    analyzeGroundtruth: vi.fn().mockResolvedValue({
      groundtruths: [
        { title: 'Industry benchmark', description: 'Churn benchmark 5%', confidence: 0.9, category: 'benchmark', verification_type: 'external', priority: 'high' },
      ],
      analysis: 'Evidence gathered',
    }),
  };
}

function makeNarrativeAgent(): NarrativeAgentInterface {
  return {
    analyzeNarrative: vi.fn().mockResolvedValue({
      narratives: [
        { title: 'Executive summary', description: 'Compelling story', confidence: 0.85, category: 'executive', narrative_type: 'summary', priority: 'high' },
      ],
      analysis: 'Narrative complete',
    }),
  };
}

function makeRedTeamAgent(objections: RedTeamOutput['objections'] = []): RedTeamAnalyzer {
  return {
    analyze: vi.fn().mockResolvedValue({
      objections,
      overallRisk: 'low',
      recommendation: 'proceed',
      confidence: 0.9,
    } satisfies RedTeamOutput),
  };
}

// ---------------------------------------------------------------------------
// Idempotency guard stub — always executes the function
// ---------------------------------------------------------------------------

const idempotencyGuard = {
  execute: vi.fn().mockImplementation(async (_key: string, fn: () => Promise<unknown>) => {
    const result = await fn();
    return { result, cached: false };
  }),
};

// ---------------------------------------------------------------------------
// DLQ stub
// ---------------------------------------------------------------------------

class InMemoryDLQ {
  entries: DLQEntry[] = [];
  async enqueue(entry: DLQEntry) { this.entries.push(entry); }
  async list() { return this.entries; }
  async count() { return this.entries.length; }
  async remove(entry: DLQEntry) {
    const idx = this.entries.indexOf(entry);
    if (idx >= 0) { this.entries.splice(idx, 1); return true; }
    return false;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

function makeLoop(overrides: {
  redTeamAgent?: RedTeamAnalyzer;
  opportunityAgent?: OpportunityAgentInterface;
  dlq?: InMemoryDLQ;
  maxRevisionCycles?: number;
} = {}) {
  const saga = new InMemorySaga() as unknown as InstanceType<typeof import('../../core/ValueCaseSaga.js').ValueCaseSaga>;
  const dlq = overrides.dlq ?? new InMemoryDLQ();
  const loop = new HypothesisLoop({
    saga,
    idempotencyGuard: idempotencyGuard as unknown as InstanceType<typeof import('../../core/IdempotencyGuard.js').IdempotencyGuard>,
    dlq: dlq as unknown as InstanceType<typeof import('../../core/DeadLetterQueue.js').DeadLetterQueue>,
    opportunityAgent: overrides.opportunityAgent ?? makeOpportunityAgent(),
    financialModelingAgent: makeFinancialAgent(),
    groundTruthAgent: makeGroundTruthAgent(),
    narrativeAgent: makeNarrativeAgent(),
    redTeamAgent: overrides.redTeamAgent ?? makeRedTeamAgent(),
    config: { maxRevisionCycles: overrides.maxRevisionCycles ?? 3 },
  });
  return { loop, saga, dlq };
}

const CASE_ID = '00000000-0000-0000-0000-000000000010';
const TENANT_ID = 'tenant-test';
const CORRELATION_ID = '00000000-0000-0000-0000-000000000011';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HypothesisLoop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idempotencyGuard.execute.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => {
      const result = await fn();
      return { result, cached: false };
    });
  });

  describe('run() — happy path', () => {
    it('transitions to INTEGRITY_VETOED and loops back to DRAFTING if integrity check produces a veto', async () => {
      const groundTruthAgent = makeGroundTruthAgent();
      // Mock the ground truth / integrity agent to return a veto decision
      groundTruthAgent.analyzeGroundtruth = vi.fn().mockResolvedValue({
        groundtruths: [],
        analysis: 'Critical data integrity issues found',
        vetoDecision: { veto: true, reason: 'Hallucinated metrics' }
      });

      const { loop, saga } = makeLoop({ groundTruthAgent } as any);
      const sse = { send: vi.fn() };

      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID, sse);

      // The loop should handle the veto, transition backwards, and either retry or exit
      // Currently, the code blindly transitions to INTEGRITY_PASSED, so this test will fail
      const state = await saga.getState(CASE_ID);
      
      // If it vetoes, it should transition to INTEGRITY_VETOED which goes to DRAFTING
      // and then it might retry. But it definitely shouldn't reach FINALIZED with a veto.
      expect(result.success).toBe(false);
      expect(result.error).toContain('veto');
    });

    it('returns success:true with finalState FINALIZED', async () => {
      const { loop } = makeLoop();
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.success).toBe(true);
      expect(result.finalState).toBe('FINALIZED');
      expect(result.valueCaseId).toBe(CASE_ID);
    });

    it('produces at least one hypothesis', async () => {
      const { loop } = makeLoop();
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.hypotheses.length).toBeGreaterThan(0);
    });

    it('produces a value tree', async () => {
      const { loop } = makeLoop();
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.valueTree).not.toBeNull();
      expect(result.valueTree?.nodes.length).toBeGreaterThan(0);
    });

    it('revisionCount is 0 when no critical objections', async () => {
      const { loop } = makeLoop({ redTeamAgent: makeRedTeamAgent([]) });
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.revisionCount).toBe(0);
    });
  });

  describe('run() — revision cycle', () => {
    it('increments revisionCount on critical objection', async () => {
      const criticalRedTeam = makeRedTeamAgent([
        { id: 'obj-1', description: 'Unsubstantiated claim', severity: 'critical', category: 'evidence', recommendation: 'Add data' },
      ]);
      // After first critical objection, return no objections so loop terminates
      let callCount = 0;
      (criticalRedTeam.analyze as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        callCount++;
        return {
          objections: callCount === 1
            ? [{ id: 'obj-1', description: 'Unsubstantiated claim', severity: 'critical', category: 'evidence', recommendation: 'Add data' }]
            : [],
          overallRisk: callCount === 1 ? 'high' : 'low',
          recommendation: 'proceed',
          confidence: 0.8,
        };
      });

      const { loop } = makeLoop({ redTeamAgent: criticalRedTeam, maxRevisionCycles: 3 });
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.revisionCount).toBe(1);
      expect(result.success).toBe(true);
    });

    it('stops revising after maxRevisionCycles', async () => {
      const alwaysCritical = makeRedTeamAgent([
        { id: 'obj-1', description: 'Always critical', severity: 'critical', category: 'evidence', recommendation: 'Fix it' },
      ]);
      (alwaysCritical.analyze as ReturnType<typeof vi.fn>).mockResolvedValue({
        objections: [{ id: 'obj-1', description: 'Always critical', severity: 'critical', category: 'evidence', recommendation: 'Fix it' }],
        overallRisk: 'high',
        recommendation: 'revise',
        confidence: 0.5,
      });

      const { loop } = makeLoop({ redTeamAgent: alwaysCritical, maxRevisionCycles: 2 });
      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      // Loop exits after maxRevisionCycles even with persistent critical objections
      expect(result.revisionCount).toBeLessThanOrEqual(2);
      expect(result.success).toBe(true);
    });
  });

  describe('run() — failure path', () => {
    it('returns success:false and finalState FAILED when opportunity agent throws', async () => {
      const failingAgent: OpportunityAgentInterface = {
        analyzeOpportunities: vi.fn().mockRejectedValue(new Error('LLM timeout')),
      };
      const dlq = new InMemoryDLQ();
      const { loop } = makeLoop({ opportunityAgent: failingAgent, dlq });

      const result = await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(result.success).toBe(false);
      expect(result.finalState).toBe('FAILED');
      expect(result.error).toMatch(/LLM timeout/);
    });

    it('routes failed step to DLQ', async () => {
      const failingAgent: OpportunityAgentInterface = {
        analyzeOpportunities: vi.fn().mockRejectedValue(new Error('LLM timeout')),
      };
      const dlq = new InMemoryDLQ();
      const { loop } = makeLoop({ opportunityAgent: failingAgent, dlq });

      await loop.run(CASE_ID, TENANT_ID, CORRELATION_ID);

      expect(dlq.entries.length).toBeGreaterThan(0);
      expect(dlq.entries[0]?.agentType).toBe('opportunity');
    });
  });
});
