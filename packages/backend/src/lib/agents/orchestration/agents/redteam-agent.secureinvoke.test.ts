/**
 * RedTeamAgent — secureInvoke compliance tests
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseAgent } from '../../../agent-fabric/agents/BaseAgent.js';
import { MemorySystem } from '../../../agent-fabric/MemorySystem.js';
import {
  RedTeamAgent,
  RedTeamOutputSchema,
  type RedTeamInput,
  type RedTeamLLMGateway,
} from './RedTeamAgent.js';

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

const SCHEMA_INVALID_LLM_RESPONSE = JSON.stringify({
  unexpected_field: 'this is not the right shape',
});

const HALLUCINATION_RESPONSE = JSON.stringify({
  objections: [
    {
      id: 'obj-hallucinated',
      targetComponent: 'Revenue increase',
      severity: 'critical',
      category: 'math_error',
      description: 'I am an AI and cannot verify these numbers',
    },
  ],
  summary: 'As an AI language model, I cannot confirm these projections.',
  hasCritical: true,
  timestamp: new Date().toISOString(),
});

describe('RedTeamAgent — secureInvoke compliance', () => {
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

  it('calls BaseAgent.secureInvoke and preserves tenant metadata on gateway call', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });
    const secureInvokeSpy = vi.spyOn(BaseAgent.prototype as any, 'secureInvoke');

    await agent.analyze(VALID_INPUT);

    expect(secureInvokeSpy).toHaveBeenCalledOnce();
    expect(mockComplete).toHaveBeenCalledOnce();

    const callArgs = mockComplete.mock.calls[0][0] as {
      metadata: Record<string, unknown>;
      messages: Array<{ role: string; content: string }>;
    };

    expect(callArgs.metadata.tenantId).toBe(VALID_INPUT.tenantId);
    expect(callArgs.metadata.tenant_id).toBe(VALID_INPUT.tenantId);
    expect(callArgs.metadata.idempotencyKey).toBe(VALID_INPUT.idempotencyKey);
    expect(callArgs.metadata.valueCaseId).toBe(VALID_INPUT.valueCaseId);
    expect(callArgs.messages[0]!.content).toContain('You are a Red Team analyst');
  });

  it('returns hallucination fields from secureInvoke output', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    const result = await agent.analyze(VALID_INPUT);

    expect(result.hallucination_check).toBeTypeOf('boolean');
    expect(result.hallucination_details).toBeDefined();
    expect(result.confidence).toBe('medium');
  });

  it('stores memory scoped to tenant organization_id', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    const memories = await memorySystem.retrieve({
      agent_id: 'RedTeamAgent',
      memory_type: 'episodic',
      organization_id: VALID_INPUT.tenantId,
      limit: 5,
    });

    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]?.organization_id).toBe(VALID_INPUT.tenantId);
  });

  it('rejects schema-invalid output via secureInvoke zod validation', async () => {
    mockComplete.mockResolvedValue({ content: SCHEMA_INVALID_LLM_RESPONSE });

    await expect(agent.analyze(VALID_INPUT)).rejects.toThrow();
  });

  it('surfaces secureInvoke failure handling when llm call fails', async () => {
    mockComplete.mockRejectedValue(new Error('provider timeout'));

    await expect(agent.analyze(VALID_INPUT)).rejects.toThrow('provider timeout');
  });

  it('attaches hallucination_check boolean to output', async () => {
    mockComplete.mockResolvedValue({ content: HALLUCINATION_RESPONSE });

    const result = await agent.analyze(VALID_INPUT);

    expect(typeof result.hallucination_check).toBe('boolean');
    expect(result.hallucination_check).toBe(true);
  });

  it('attaches hallucination_details with grounding score to output', async () => {
    mockComplete.mockResolvedValue({ content: HALLUCINATION_RESPONSE });

    const result = await agent.analyze(VALID_INPUT);

    expect(result.hallucination_details).toBeDefined();
    expect(result.hallucination_details?.grounding_score).toBeLessThan(1);
    expect(result.hallucination_details?.matched_signals.length).toBeGreaterThan(0);
  });

  it('propagates tenantId in gateway metadata (tenant isolation)', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    const metadata = (mockComplete.mock.calls[0][0] as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.tenantId).toBe('tenant-0001');
  });

  it('propagates idempotencyKey in gateway metadata', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    const metadata = (mockComplete.mock.calls[0][0] as { metadata: Record<string, unknown> }).metadata;
    expect(metadata.idempotencyKey).toBe(VALID_INPUT.idempotencyKey);
  });
});

describe('RedTeamOutputSchema — Zod validation', () => {
  it('accepts a fully valid output', () => {
    const parsed = RedTeamOutputSchema.safeParse({
      ...JSON.parse(VALID_LLM_RESPONSE),
      hallucination_check: true,
      timestamp: new Date().toISOString(),
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects output missing required fields', () => {
    const parsed = RedTeamOutputSchema.safeParse({ unexpected_field: true });
    expect(parsed.success).toBe(false);
  });

  it('rejects objections with unknown severity values', () => {
    const bad = {
      objections: [
        {
          id: 'o1',
          targetComponent: 'x',
          severity: 'catastrophic',
          category: 'assumption',
          description: 'test',
        },
      ],
      summary: 'test',
      hasCritical: false,
      confidence: 'medium',
      timestamp: new Date().toISOString(),
    };
    const parsed = RedTeamOutputSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it('rejects invalid confidence values', () => {
    const bad = {
      objections: [],
      summary: 'test',
      hasCritical: false,
      confidence: 'very_high',
      timestamp: new Date().toISOString(),
    };

    const parsed = RedTeamOutputSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});
