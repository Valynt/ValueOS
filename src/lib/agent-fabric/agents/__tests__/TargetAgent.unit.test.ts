import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TargetAgent } from '../TargetAgent';

describe('TargetAgent', () => {
  const sessionId = 'session-1';
  const organizationId = 'org-target';
  let llmGatewayMock: any;
  let memorySystemMock: any;
  let auditLoggerMock: any;
  let agent: TargetAgent;

  beforeEach(() => {
    llmGatewayMock = {
      complete: vi.fn(async () => ({
        content: JSON.stringify({
          value_tree: { name: 'tree', description: 'desc', nodes: [] },
          roi_model: { name: 'roi', assumptions: [], confidence_level: 'medium' },
          value_commit: { notes: 'commit', target_date: '2025-01-01' },
          confidence_level: 'medium',
          reasoning: 'ok',
        }),
        tokens_used: 5,
        latency_ms: 10,
        model: 'gpt-test',
      })),
    };

    memorySystemMock = {
      storeSemanticMemory: vi.fn(async () => null),
    };

    auditLoggerMock = {
      logExecution: vi.fn(async () => null),
      logMetric: vi.fn(async () => null),
      logPerformanceMetric: vi.fn(async () => null),
    };

    const config = {
      id: 'target-agent-1',
      organizationId,
      sessionId,
      llmGateway: llmGatewayMock,
      memorySystem: memorySystemMock,
      auditLogger: auditLoggerMock,
      supabase: {},
    } as any;

    agent = new TargetAgent(config);
  });

  it('invokes LLM and returns result', async () => {
    const input = {
      valueCaseId: 'vc-1',
      opportunityId: 'op-1',
      capabilities: [],
      businessObjectives: [],
    } as any;

    const output = await agent.execute(sessionId, input);

    expect(llmGatewayMock.complete).toHaveBeenCalled();
    expect(output).toHaveProperty('valueTree');
    expect(output).toHaveProperty('roiModel');
  });
});
