import { describe, expect, it } from 'vitest';
import { RiskClassifier } from '../RiskClassifier.js';
import type { AgentMiddlewareContext } from '../../UnifiedAgentOrchestrator.js';

function makeContext(overrides: Partial<AgentMiddlewareContext> = {}): AgentMiddlewareContext {
  return {
    envelope: {
      intent: 'general_query',
      actor: { id: 'user-1' },
      organizationId: 'org-1',
      entryPoint: 'processQuery',
      reason: 'test',
      timestamps: { requestedAt: new Date().toISOString() },
    },
    query: 'Hello',
    currentState: {
      currentStage: 'opportunity',
      status: 'in_progress',
      completedStages: [],
      context: {},
    } as any,
    userId: 'user-1',
    sessionId: 'sess-1',
    traceId: 'trace-1',
    agentType: 'opportunity',
    ...overrides,
  };
}

describe('RiskClassifier', () => {
  it('classifies a normal query as low risk', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(makeContext());

    expect(result.isHighRisk).toBe(false);
    expect(result.riskLevel).toBe('low');
    expect(result.requiresApproval).toBe(false);
  });

  it('classifies a high-risk agent type', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeContext({ agentType: 'financial-modeling' }),
    );

    expect(result.isHighRisk).toBe(true);
    expect(result.riskLevel).toBe('high');
    expect(result.requiresApproval).toBe(true);
    expect(result.reason).toContain('financial-modeling');
  });

  it('classifies a high-risk intent', () => {
    const classifier = new RiskClassifier();
    const ctx = makeContext();
    ctx.envelope.intent = 'crm_write';
    const result = classifier.classify(ctx);

    expect(result.isHighRisk).toBe(true);
    expect(result.riskLevel).toBe('high');
    expect(result.reason).toContain('crm_write');
  });

  it('classifies destructive payload as critical', () => {
    const classifier = new RiskClassifier();
    const result = classifier.classify(
      makeContext({ payload: 'please delete all records' }),
    );

    expect(result.isHighRisk).toBe(true);
    expect(result.riskLevel).toBe('critical');
    expect(result.reason).toContain('destructive');
  });

  it('elevates to the highest risk level when multiple signals match', () => {
    const classifier = new RiskClassifier();
    const ctx = makeContext({
      agentType: 'financial-modeling',
      payload: 'drop table users',
    });
    ctx.envelope.intent = 'data_export';
    const result = classifier.classify(ctx);

    expect(result.riskLevel).toBe('critical');
    expect(result.requiresApproval).toBe(true);
  });

  it('respects custom config for high-risk intents', () => {
    const classifier = new RiskClassifier({
      highRiskIntents: ['custom_action'],
      highRiskAgentTypes: [],
    });
    const ctx = makeContext();
    ctx.envelope.intent = 'custom_action';
    const result = classifier.classify(ctx);

    expect(result.isHighRisk).toBe(true);
  });

  describe('canBypass', () => {
    it('returns true when actor has a bypass role', () => {
      const classifier = new RiskClassifier({ bypassRoles: ['admin'] });
      expect(classifier.canBypass(['admin'])).toBe(true);
    });

    it('returns false when actor has no bypass role', () => {
      const classifier = new RiskClassifier({ bypassRoles: ['admin'] });
      expect(classifier.canBypass(['viewer'])).toBe(false);
    });

    it('returns false when roles are undefined', () => {
      const classifier = new RiskClassifier({ bypassRoles: ['admin'] });
      expect(classifier.canBypass(undefined)).toBe(false);
    });

    it('returns false when bypassRoles is empty', () => {
      const classifier = new RiskClassifier({ bypassRoles: [] });
      expect(classifier.canBypass(['admin'])).toBe(false);
    });
  });
});
