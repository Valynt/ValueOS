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

it('retries durable dead-letter events after process restart without duplicate ledger writes', async () => {
  type DeadLetterRow = {
    id: string;
    event_type: string;
    tenant_id: string;
    payload: Record<string, unknown>;
    error_message: string;
    retry_count: number;
    created_at: string;
  };

  const state = {
    deadLetterEvents: [] as DeadLetterRow[],
    usageEvents: [] as Record<string, unknown>[],
    usageLedger: [] as Array<{ id: string; tenant_id: string; request_id: string }>,
  };

  let idCounter = 0;
  const nextId = (): string => {
    idCounter += 1;
    return `dlq-${idCounter}`;
  };

  class QueryBuilder {
    private filters: Array<(row: DeadLetterRow) => boolean> = [];
    constructor(private readonly table: string) {}

    insert(payload: Record<string, unknown>, options?: { ignoreDuplicates?: boolean }): unknown {
      if (this.table === 'dead_letter_events') {
        state.deadLetterEvents.push({
          id: nextId(),
          event_type: String(payload.event_type),
          tenant_id: String(payload.tenant_id),
          payload: (payload.payload ?? {}) as Record<string, unknown>,
          error_message: String(payload.error_message ?? ''),
          retry_count: Number(payload.retry_count ?? 0),
          created_at: String(payload.created_at ?? new Date().toISOString()),
        });
        return Promise.resolve({ error: null });
      }

      if (this.table === 'usage_events') {
        state.usageEvents.push(payload);
        return Promise.resolve({ error: null });
      }

      if (this.table === 'usage_ledger') {
        const ledgerPayload = payload as { tenant_id: string; request_id: string };
        const exists = state.usageLedger.some(
          (row) => row.tenant_id === ledgerPayload.tenant_id && row.request_id === ledgerPayload.request_id
        );

        if (!exists) {
          state.usageLedger.push({
            id: `ledger-${state.usageLedger.length + 1}`,
            tenant_id: ledgerPayload.tenant_id,
            request_id: ledgerPayload.request_id,
          });
        }

        const selected = exists || options?.ignoreDuplicates ? null : state.usageLedger[state.usageLedger.length - 1];

        return {
          select: () => ({
            maybeSingle: async () => ({ data: selected, error: null }),
          }),
        };
      }

      return Promise.resolve({ error: null });
    }

    select(): this {
      return this;
    }

    eq(column: string, value: string): this {
      this.filters.push((row) => String((row as Record<string, unknown>)[column]) === value);
      return this;
    }

    lt(column: string, value: number): this {
      this.filters.push((row) => Number((row as Record<string, unknown>)[column]) < value);
      return this;
    }

    neq(column: string, value: string): this {
      this.filters.push((row) => String((row as Record<string, unknown>)[column]) !== value);
      return this;
    }

    contains(column: string, value: Record<string, unknown>): this {
      this.filters.push((row) => {
        const target = (row as unknown as Record<string, Record<string, unknown>>)[column] ?? {};
        return Object.entries(value).every(([key, expected]) => target[key] === expected);
      });
      return this;
    }

    order(): this {
      return this;
    }

    limit(count: number): Promise<{ data: DeadLetterRow[]; error: null }> | this {
      const rows = state.deadLetterEvents.filter((row) => this.filters.every((filterFn) => filterFn(row)));
      const limited = rows.slice(0, count);

      if (this.filters.some(() => true)) {
        return Promise.resolve({ data: limited, error: null });
      }

      return this;
    }

    update(payload: Record<string, unknown>): { eq: (column: string, value: string) => Promise<{ error: null }> } {
      return {
        eq: async (column: string, value: string) => {
          const row = state.deadLetterEvents.find(
            (candidate) => String((candidate as Record<string, unknown>)[column]) === value
          );

          if (row) {
            if (payload.retry_count !== undefined) {
              row.retry_count = Number(payload.retry_count);
            }
            if (payload.error_message !== undefined) {
              row.error_message = String(payload.error_message);
            }
            if (payload.payload !== undefined) {
              row.payload = payload.payload as Record<string, unknown>;
            }
          }

          return { error: null };
        },
      };
    }

    then<TResult1 = { data: DeadLetterRow[]; error: null }>(
      onfulfilled?: ((value: { data: DeadLetterRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null
    ): Promise<TResult1> {
      const rows = state.deadLetterEvents.filter((row) => this.filters.every((filterFn) => filterFn(row)));
      return Promise.resolve({ data: rows, error: null }).then(onfulfilled ?? undefined);
    }
  }

  const supabase = {
    from: (table: string) => new QueryBuilder(table),
  };

  const queueProducerFailure = {
    publishUsageEvent: vi.fn().mockRejectedValue(new Error('queue unavailable')),
  };

  const tenantId = '123e4567-e89b-12d3-a456-426614174000';
  const requestId = 'req-restart-1';
  const agentUuid = 'agent-restart';
  const workloadIdentity = 'spiffe://valueos/ns/valynt/sa/restart-agent';
  const idempotencyKey = UsageEmitter.deriveDeterministicIdempotencyKey(
    tenantId,
    requestId,
    agentUuid,
    'llm_tokens'
  );

  const emitterBeforeRestart = new UsageEmitter(
    supabase as never,
    queueProducerFailure as never
  );

  await emitterBeforeRestart.emitUsage({
    tenantId,
    metric: 'llm_tokens',
    amount: 25,
    requestId,
    agentUuid,
    workloadIdentity,
    idempotencyKey,
    metadata: { model: 'gpt-4.1' },
  });

  expect(state.deadLetterEvents.filter((row) => row.event_type === 'usage_event')).toHaveLength(1);

  const queueProducerSuccess = {
    publishUsageEvent: vi.fn().mockResolvedValue(undefined),
  };

  const emitterAfterRestart = new UsageEmitter(
    supabase as never,
    queueProducerSuccess as never
  );

  const firstRetry = await emitterAfterRestart.retryFailedEvents();
  const secondRetry = await emitterAfterRestart.retryFailedEvents();

  expect(firstRetry.retried).toBe(1);
  expect(firstRetry.failed).toBe(0);
  expect(secondRetry.retried).toBe(0);
  expect(state.usageLedger).toHaveLength(1);
  expect(queueProducerSuccess.publishUsageEvent).toHaveBeenCalledOnce();
});

});
