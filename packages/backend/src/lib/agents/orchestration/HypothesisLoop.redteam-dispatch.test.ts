import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HypothesisLoop, type FinancialModelingAgentInterface, type GroundTruthAgentInterface, type NarrativeAgentInterface, type OpportunityAgentInterface } from './HypothesisLoop.js';
import type { DLQEntry } from '../core/DeadLetterQueue.js';
import { SagaState, SagaTrigger, type SagaSnapshot, type SagaTriggerType } from '../core/ValueCaseSaga.js';
import type { RedTeamAnalyzer, RedTeamOutput } from './agents/RedTeamAgent.js';

class InMemorySaga {
  private state = SagaState.INITIATED;

  async transition(_valueCaseId: string, trigger: SagaTriggerType, _correlationId: string): Promise<SagaSnapshot> {
    if (trigger === SagaTrigger.OPPORTUNITY_INGESTED) this.state = SagaState.DRAFTING;
    if (trigger === SagaTrigger.HYPOTHESIS_CONFIRMED) this.state = SagaState.VALIDATING;
    if (trigger === SagaTrigger.INTEGRITY_PASSED) this.state = SagaState.COMPOSING;
    if (trigger === SagaTrigger.REDTEAM_OBJECTION) this.state = SagaState.DRAFTING;
    if (trigger === SagaTrigger.FEEDBACK_RECEIVED) this.state = SagaState.REFINING;
    if (trigger === SagaTrigger.VE_APPROVED) this.state = SagaState.FINALIZED;

    return {
      valueCaseId: 'case-1',
      tenantId: 'tenant-1',
      state: this.state,
      data: {},
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getState(_valueCaseId: string): Promise<SagaSnapshot> {
    return {
      valueCaseId: 'case-1',
      tenantId: 'tenant-1',
      state: this.state,
      data: {},
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async compensate(): Promise<void> {
    return;
  }
}

describe('HypothesisLoop red-team orchestration dispatch', () => {
  let opportunityAgent: OpportunityAgentInterface;
  let financialModelingAgent: FinancialModelingAgentInterface;
  let groundTruthAgent: GroundTruthAgentInterface;
  let narrativeAgent: NarrativeAgentInterface;
  let enqueue: (entry: DLQEntry) => Promise<void>;

  beforeEach(() => {
    vi.restoreAllMocks();

    opportunityAgent = {
      analyzeOpportunities: vi.fn().mockResolvedValue({
        opportunities: [{ title: 'Opp 1', description: 'Opp 1 desc', confidence: 0.8, category: 'Efficiency', estimatedValue: 1000 }],
        analysis: 'ok',
      }),
    };

    financialModelingAgent = {
      analyzeFinancialModels: vi.fn().mockResolvedValue({
        financial_models: [{ title: 'Node 1', description: 'formula', confidence: 0.8, category: 'General', model_type: 'DCF Model', priority: 'High', value: 1000 }],
        analysis: 'ok',
      }),
    };

    groundTruthAgent = {
      analyzeGroundtruth: vi.fn().mockResolvedValue({
        groundtruths: [{ title: 'Evidence 1', description: 'verified', confidence: 0.7, category: 'Verification', verification_type: 'Fact Checking', priority: 'High' }],
        analysis: 'ok',
      }),
    };

    narrativeAgent = {
      analyzeNarrative: vi.fn().mockResolvedValue({
        narratives: [{ title: 'Narrative 1', description: 'story', confidence: 0.8, category: 'Storytelling', narrative_type: 'Argument Framework', priority: 'High' }],
        analysis: 'ok',
      }),
    };

    enqueue = vi.fn().mockResolvedValue(undefined);
  });

  it('uses analyze() contract and never dispatches to execute() in production mode', async () => {
    const execute = vi.fn(async () => {
      throw new Error('not implemented placeholder execute() should never be called');
    });
    const analyze = vi.fn<RedTeamAnalyzer['analyze']>().mockResolvedValue({
      objections: [],
      summary: 'No critical issues',
      hasCritical: false,
      confidence: 'high',
      timestamp: new Date().toISOString(),
    });

    const redTeamAgent = { analyze, execute } as unknown as RedTeamAnalyzer & { execute: typeof execute };

    const loop = new HypothesisLoop({
      saga: new InMemorySaga() as never,
      idempotencyGuard: { execute: async (_k, fn) => ({ cached: false, result: await fn() }) } as never,
      dlq: { enqueue } as never,
      opportunityAgent,
      financialModelingAgent,
      groundTruthAgent,
      narrativeAgent,
      redTeamAgent,
    });

    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const result = await loop.run('case-1', 'tenant-1', crypto.randomUUID());

    process.env.NODE_ENV = prev;

    expect(result.success).toBe(true);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('remains analyze-only across revision cycles', async () => {
    const execute = vi.fn(async () => {
      throw new Error('not implemented placeholder execute() should never be called');
    });
    const analyze = vi
      .fn<RedTeamAnalyzer['analyze']>()
      .mockResolvedValueOnce({
        objections: [{ id: 'o1', targetComponent: 'node', severity: 'critical', category: 'assumption', description: 'too optimistic' }],
        summary: 'critical found',
        hasCritical: true,
        confidence: 'medium',
        timestamp: new Date().toISOString(),
      } satisfies RedTeamOutput)
      .mockResolvedValueOnce({
        objections: [],
        summary: 'resolved',
        hasCritical: false,
        confidence: 'high',
        timestamp: new Date().toISOString(),
      } satisfies RedTeamOutput);

    const redTeamAgent = { analyze, execute } as unknown as RedTeamAnalyzer & { execute: typeof execute };

    const loop = new HypothesisLoop({
      saga: new InMemorySaga() as never,
      idempotencyGuard: { execute: async (_k, fn) => ({ cached: false, result: await fn() }) } as never,
      dlq: { enqueue } as never,
      opportunityAgent,
      financialModelingAgent,
      groundTruthAgent,
      narrativeAgent,
      redTeamAgent,
      config: { maxRevisionCycles: 1 },
    });

    const result = await loop.run('case-1', 'tenant-1', crypto.randomUUID());

    expect(result.success).toBe(true);
    expect(result.revisionCount).toBe(1);
    expect(analyze).toHaveBeenCalledTimes(2);
    expect(execute).not.toHaveBeenCalled();
  });
});
