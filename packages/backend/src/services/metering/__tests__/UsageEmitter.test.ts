/**
 * Usage Emitter Tests
 */

import { describe, expect, it, vi } from 'vitest';

import UsageEmitter from '../UsageEmitter';

describe('UsageEmitter', () => {
  it('should emit usage event with required evidence fields', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
    } as any;

    const emitter = new UsageEmitter(supabase);

    await emitter.emitUsage({
      tenantId: '123e4567-e89b-12d3-a456-426614174000',
      metric: 'llm_tokens',
      amount: 1000,
      requestId: 'req-123',
      agentUuid: 'opportunity-agent',
      workloadIdentity: 'spiffe://valueos/ns/valynt/sa/opportunity-agent',
      idempotencyKey: UsageEmitter.deriveDeterministicIdempotencyKey(
        '123e4567-e89b-12d3-a456-426614174000',
        'req-123',
        'opportunity-agent',
        'llm_tokens'
      ),
      metadata: { model: 'gpt-4' },
    });

    expect(supabase.from).toHaveBeenCalledWith('usage_events');
    expect(insert).toHaveBeenCalledOnce();
  });

  it('should reject usage event when evidence fields are missing', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({ insert }),
    } as any;

    const emitter = new UsageEmitter(supabase);

    await expect(
      emitter.emitUsage({
        tenantId: '123e4567-e89b-12d3-a456-426614174000',
        metric: 'agent_executions',
        amount: 1,
        requestId: 'req-124',
        agentUuid: '',
        workloadIdentity: 'spiffe://valueos/ns/valynt/sa/integrity-agent',
        idempotencyKey: 'abc',
      })
    ).rejects.toThrow();
  });

  it('should derive deterministic idempotency key', () => {
    const key1 = UsageEmitter.deriveDeterministicIdempotencyKey(
      '123e4567-e89b-12d3-a456-426614174000',
      'req-1',
      'target-agent',
      'api_calls'
    );
    const key2 = UsageEmitter.deriveDeterministicIdempotencyKey(
      '123e4567-e89b-12d3-a456-426614174000',
      'req-1',
      'target-agent',
      'api_calls'
    );

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/);
  });
});
