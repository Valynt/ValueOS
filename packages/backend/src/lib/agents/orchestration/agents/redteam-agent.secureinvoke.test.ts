/**
 * RedTeamAgent — secureInvoke compliance tests
 *
 * AGENTS.md rule 2: all production agent LLM calls must go through
 * BaseAgent.secureInvoke(), which wraps calls with circuit breaker,
 * hallucination detection, and Zod validation.
 *
 * RedTeamAgent currently calls this.llmGateway.complete() directly (known
 * debt, see TODO in RedTeamAgent.ts). These tests:
 *   1. Pin the current behaviour so regressions are visible.
 *   2. Assert that schema-invalid LLM output is rejected.
 *   3. Assert that hallucination metadata is recorded when secureInvoke is used.
 *   4. Document the migration path with `.skip`-marked tests that must pass
 *      once the agent extends BaseAgent.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RedTeamAgent,
  RedTeamOutputSchema,
  type RedTeamInput,
  type RedTeamLLMGateway,
} from './RedTeamAgent.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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
  timestamp: new Date().toISOString(),
});

const SCHEMA_INVALID_LLM_RESPONSE = JSON.stringify({
  // Missing required fields: objections, summary, hasCritical
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RedTeamAgent — current behaviour (direct llmGateway.complete)', () => {
  let mockComplete: ReturnType<typeof vi.fn>;
  let agent: RedTeamAgent;

  beforeEach(() => {
    mockComplete = vi.fn();
    const gateway: RedTeamLLMGateway = { complete: mockComplete };
    agent = new RedTeamAgent(gateway);
  });

  it('calls llmGateway.complete() directly (documents rule-2 violation)', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    // Current behaviour: direct gateway call, no secureInvoke wrapper
    expect(mockComplete).toHaveBeenCalledOnce();
    const callArgs = mockComplete.mock.calls[0][0] as {
      messages: Array<{ role: string; content: string }>;
      metadata: Record<string, unknown>;
    };
    expect(callArgs.metadata.tenantId).toBe(VALID_INPUT.tenantId);
    expect(callArgs.metadata.valueCaseId).toBe(VALID_INPUT.valueCaseId);
  });

  it('rejects schema-invalid LLM output via Zod parse', async () => {
    mockComplete.mockResolvedValue({ content: SCHEMA_INVALID_LLM_RESPONSE });

    await expect(agent.analyze(VALID_INPUT)).rejects.toThrow();
  });

  it('parses valid output into typed RedTeamOutput', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    const result = await agent.analyze(VALID_INPUT);

    expect(result.objections).toHaveLength(1);
    expect(result.objections[0]!.severity).toBe('medium');
    expect(result.hasCritical).toBe(false);
    expect(result.summary).toBeTruthy();
    expect(result.timestamp).toBeTruthy();
  });

  it('does NOT record hallucination metadata (no secureInvoke — known gap)', async () => {
    mockComplete.mockResolvedValue({ content: HALLUCINATION_RESPONSE });

    const result = await agent.analyze(VALID_INPUT);

    // secureInvoke would attach hallucination_check and hallucination_details.
    // Direct complete() call returns neither — document the gap.
    expect((result as any).hallucination_check).toBeUndefined();
    expect((result as any).hallucination_details).toBeUndefined();
  });

  it('propagates tenantId in gateway metadata (tenant isolation)', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    const metadata = (mockComplete.mock.calls[0][0] as any).metadata as Record<string, unknown>;
    expect(metadata.tenantId).toBe('tenant-0001');
  });

  it('propagates idempotencyKey in gateway metadata', async () => {
    mockComplete.mockResolvedValue({ content: VALID_LLM_RESPONSE });

    await agent.analyze(VALID_INPUT);

    const metadata = (mockComplete.mock.calls[0][0] as any).metadata as Record<string, unknown>;
    expect(metadata.idempotencyKey).toBe(VALID_INPUT.idempotencyKey);
  });
});

describe('RedTeamOutputSchema — Zod validation', () => {
  it('accepts a fully valid output', () => {
    const parsed = RedTeamOutputSchema.safeParse(JSON.parse(VALID_LLM_RESPONSE));
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
          severity: 'catastrophic', // not in enum
          category: 'assumption',
          description: 'test',
        },
      ],
      summary: 'test',
      hasCritical: false,
      timestamp: new Date().toISOString(),
    };
    const parsed = RedTeamOutputSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it('rejects objections with unknown category values', () => {
    const bad = {
      objections: [
        {
          id: 'o1',
          targetComponent: 'x',
          severity: 'low',
          category: 'vibes', // not in enum
          description: 'test',
        },
      ],
      summary: 'test',
      hasCritical: false,
      timestamp: new Date().toISOString(),
    };
    const parsed = RedTeamOutputSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });
});

// ─── Migration target: secureInvoke compliance ────────────────────────────────
// Remove `.skip` once RedTeamAgent extends BaseAgent and uses secureInvoke().

describe.skip('RedTeamAgent — after BaseAgent migration (secureInvoke)', () => {
  it('calls secureInvoke instead of llmGateway.complete directly', async () => {
    // After migration: agent.secureInvoke should be called, not gateway.complete
    // Verify via spy on BaseAgent.prototype.secureInvoke
    throw new Error('Not yet implemented — remove skip when migration is complete');
  });

  it('attaches hallucination_check boolean to output', async () => {
    throw new Error('Not yet implemented — remove skip when migration is complete');
  });

  it('attaches hallucination_details with grounding score to output', async () => {
    throw new Error('Not yet implemented — remove skip when migration is complete');
  });

  it('triggers escalation logging when hallucination signals fire', async () => {
    throw new Error('Not yet implemented — remove skip when migration is complete');
  });
});
