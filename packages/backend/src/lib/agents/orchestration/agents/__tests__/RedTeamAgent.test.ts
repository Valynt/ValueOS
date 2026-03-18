import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseAgent } from '../../../../agent-fabric/agents/BaseAgent.js';
import { MemorySystem } from '../../../../agent-fabric/MemorySystem.js';
import {
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

    const memories = await memorySystem.retrieve({
      agent_id: 'RedTeamAgent',
      memory_type: 'episodic',
      organization_id: VALID_INPUT.tenantId,
      limit: 20,
    });

    const redTeamMemory = memories.find((memory) =>
      String(memory.content).includes('Red team summary:')
    );

    expect(redTeamMemory).toBeDefined();
    expect(redTeamMemory?.metadata?.tenant_id).toBe(VALID_INPUT.tenantId);
    expect(redTeamMemory?.metadata?.organization_id).toBe(VALID_INPUT.tenantId);
  });
});

describe('RedTeamOutputSchema', () => {
  it('accepts output with hallucination metadata', () => {
    const parsed = RedTeamOutputSchema.safeParse({
      ...JSON.parse(VALID_LLM_RESPONSE),
      hallucination_check: true,
      hallucination_details: {
        passed: true,
        signals: [],
        groundingScore: 0.92,
        requiresEscalation: false,
        knowledgeFabric: {
          passed: true,
          confidence: 0.9,
          contradictions: [],
          benchmarkMisalignments: [],
          method: 'knowledge_fabric',
        },
      },
      timestamp: new Date().toISOString(),
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
      timestamp: new Date().toISOString(),
    });

    expect(parsed.success).toBe(false);
  });
});
