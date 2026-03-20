import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../agent-fabric/MemorySystem.js', () => ({
  MemorySystem: class MockMemorySystem {
    constructor(_config?: any) {}
    store = vi.fn().mockResolvedValue('mem_1');
    retrieve = vi.fn().mockResolvedValue([]);
    storeSemanticMemory = vi.fn().mockResolvedValue('mem_1');
    storeEpisodicMemory = vi.fn().mockResolvedValue('mem_1');
    clear = vi.fn().mockResolvedValue(0);
  },
}));

vi.mock('../../../../../services/agents/AgentKillSwitchService.js', () => ({
  agentKillSwitchService: {
    isKilled: vi.fn().mockResolvedValue(false),
  },
}));

vi.mock('../../../../../repositories/AgentExecutionLineageRepository.js', () => ({
  agentExecutionLineageRepository: {
    appendLineage: vi.fn().mockResolvedValue(undefined),
  },
}));

import { BaseAgent } from '../../../../agent-fabric/agents/BaseAgent.js';
import { MemorySystem } from '../../../../agent-fabric/MemorySystem.js';
import {

vi.mock("../../../../supabase.js");
  RedTeamAgent,
  type RedTeamInput,
  type RedTeamLLMGateway,
  RedTeamOutputSchema,
} from '../RedTeamAgent.js';

const VALID_INPUT: RedTeamInput = {
  valueCaseId: 'case-0001',
  tenantId: 'tenant-0001',
  valueTree: { node: 'Revenue increase', value: 500_000 },
  narrativeBlock: { summary: 'We will grow revenue by 15%' },
  evidenceBundle: { sources: ['Q3 report'] },
  idempotencyKey: 'idem-key-001',
};

const VALID_LLM_RESPONSE = JSON.stringify({
  objections: [
    {
      id: 'obj-1',
      targetComponent: 'Revenue increase',
      severity: 'medium',
      category: 'assumption',
      description: '15% growth assumes market conditions unchanged',
      suggestedRevision: 'Provide sensitivity analysis',
    },
  ],
  summary: 'One medium-severity assumption risk identified.',
  hasCritical: false,
  confidence: 'medium',
});

describe('RedTeamAgent', () => {
  let mockComplete: ReturnType<typeof vi.fn>;
  let gateway: RedTeamLLMGateway;
  let memorySystem: MemorySystem;
  let agent: RedTeamAgent;

  beforeEach(() => {
    mockComplete = vi.fn();
    gateway = { complete: mockComplete };
    memorySystem = new MemorySystem({ max_memories: 100, enable_persistence: false });
    agent = new RedTeamAgent(gateway, memorySystem);
  });

  it('uses BaseAgent.secureInvoke and preserves tenant metadata', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });
    const secureInvokeSpy = vi.spyOn(BaseAgent.prototype as never, 'secureInvoke');

    await agent.analyze(VALID_INPUT);

    expect(secureInvokeSpy).toHaveBeenCalledOnce();
    expect(mockComplete).toHaveBeenCalledOnce();

    const request = mockComplete.mock.calls[0]?.[0] as {
      metadata: Record<string, unknown>;
    };

    expect(request.metadata.tenantId).toBe(VALID_INPUT.tenantId);
    expect(request.metadata.tenant_id).toBe(VALID_INPUT.tenantId);
    expect(request.metadata.idempotencyKey).toBe(VALID_INPUT.idempotencyKey);
  });

  it('rejects invalid schema response via secureInvoke validation', async () => {
    mockComplete.mockResolvedValue({
      content: JSON.stringify({
        summary: 'missing required fields',
      }),
    });

    await expect(agent.analyze(VALID_INPUT)).rejects.toThrow();
  });

  it('stores red-team memory with tenant_id and organization_id metadata', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    expect((memorySystem as any).storeSemanticMemory).toHaveBeenCalled();
    expect((memorySystem as any).storeEpisodicMemory).toHaveBeenCalled();
  });
});

describe('RedTeamOutputSchema', () => {
  it('accepts output with hallucination metadata', () => {
    const parsed = RedTeamOutputSchema.safeParse({
      ...JSON.parse(VALID_LLM_RESPONSE),
      hallucination_check: true,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects malformed hallucination metadata shape', () => {
    const parsed = RedTeamOutputSchema.safeParse({
      ...JSON.parse(VALID_LLM_RESPONSE),
      hallucination_details: {
        passed: true,
        signals: [
          {
            type: 'unsupported_signal_type',
            description: 'bad type',
            severity: 'medium',
          },
        ],
        groundingScore: 0.5,
        requiresEscalation: false,
      },
    });

    expect(parsed.success).toBe(false);
  });
});
