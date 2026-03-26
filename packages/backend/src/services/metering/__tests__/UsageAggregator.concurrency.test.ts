import { describe, expect, it } from 'vitest';

import { UsageAggregator } from '../UsageAggregator.js';

type UsageEventRow = {
  id: string;
  tenant_id: string;
  metric: string;
  amount: number;
  timestamp: string;
  processed: boolean;
  processed_at: string | null;
  processed_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  claim_expires_at: string | null;
};

class InMemorySupabase {
  usageEvents: UsageEventRow[] = [];
  usageAggregates: Array<Record<string, unknown>> = [];

  constructor(events: UsageEventRow[]) {
    this.usageEvents = events;
  }

  async rpc(fn: string, params: { p_worker_id: string; p_batch_size: number }) {
    if (fn !== 'claim_usage_events_batch') {
      return { data: null, error: new Error(`Unsupported RPC: ${fn}`) };
    }

    const claimable = this.usageEvents
      .filter((event) => !event.processed && event.claimed_by === null)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .slice(0, params.p_batch_size);

    const nowIso = new Date().toISOString();
    claimable.forEach((event) => {
      event.claimed_by = params.p_worker_id;
      event.claimed_at = nowIso;
      event.claim_expires_at = new Date(Date.now() + 5 * 60_000).toISOString();
    });

    return { data: claimable.map((event) => ({ ...event })), error: null };
  }

  from(table: string) {
    if (table === 'subscriptions') {
      return {
        select: () => ({
          eq: () => ({
            in: async () => ({ data: [{ id: 'sub-1' }], error: null }),
          }),
        }),
      };
    }

    if (table === 'subscription_items') {
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              limit: async () => ({ data: [{ id: 'item-1' }], error: null }),
            }),
          }),
        }),
      };
    }

    if (table === 'usage_aggregates') {
      return {
        insert: async (payload: Record<string, unknown>) => {
          const existing = this.usageAggregates.find(
            (row) => row.idempotency_key === payload.idempotency_key,
          );
          if (existing) {
            return {
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint',
              },
            };
          }

          this.usageAggregates.push(payload);
          return { error: null };
        },
      };
    }

    if (table === 'usage_events') {
      const context: {
        ids: string[];
        expectedClaimedBy: string | null;
        expectProcessed: boolean | null;
      } = {
        ids: [],
        expectedClaimedBy: null,
        expectProcessed: null,
      };

      return {
        update: (payload: Partial<UsageEventRow>) => ({
          in: (column: string, ids: string[]) => {
            expect(column).toBe('id');
            context.ids = ids;
            return {
              eq: (eqColumn: string, eqValue: unknown) => {
                if (eqColumn === 'processed') {
                  context.expectProcessed = Boolean(eqValue);
                }
                if (eqColumn === 'claimed_by') {
                  context.expectedClaimedBy = String(eqValue);
                }

                return {
                  eq: (_nextColumn: string, _nextValue: unknown) => ({
                    select: async () => {
                      const updatedIds: Array<{ id: string }> = [];

                      this.usageEvents.forEach((event) => {
                        if (!context.ids.includes(event.id)) {
                          return;
                        }

                        if (
                          context.expectProcessed !== null
                          && event.processed !== context.expectProcessed
                        ) {
                          return;
                        }

                        if (
                          context.expectedClaimedBy !== null
                          && event.claimed_by !== context.expectedClaimedBy
                        ) {
                          return;
                        }

                        Object.assign(event, payload);
                        updatedIds.push({ id: event.id });
                      });

                      return { data: updatedIds, error: null };
                    },
                  }),
                };
              },
            };
          },
        }),
      };
    }

    throw new Error(`Unsupported table: ${table}`);
  }
}

function buildEvents(count: number): UsageEventRow[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `event-${idx + 1}`,
    tenant_id: 'tenant-1',
    metric: 'api_calls',
    amount: 1,
    timestamp: new Date(2026, 0, 1, 0, idx, 0).toISOString(),
    processed: false,
    processed_at: null,
    processed_by: null,
    claimed_by: null,
    claimed_at: null,
    claim_expires_at: null,
  }));
}

describe('UsageAggregator concurrency', () => {
  it('processes each usage event exactly once across two workers', async () => {
    const supabase = new InMemorySupabase(buildEvents(20));

    const workerA = new UsageAggregator(supabase as never, {
      workerId: 'worker-A',
      batchSize: 10,
    });
    const workerB = new UsageAggregator(supabase as never, {
      workerId: 'worker-B',
      batchSize: 10,
    });

    await Promise.all([workerA.aggregateEvents(), workerB.aggregateEvents()]);

    expect(supabase.usageAggregates).toHaveLength(2);

    const allAggregateEventIds = supabase.usageAggregates.flatMap((aggregate) => {
      const metadata = aggregate.metadata as { event_ids?: string[] };
      return metadata.event_ids ?? [];
    });

    expect(new Set(allAggregateEventIds).size).toBe(20);
    expect(allAggregateEventIds).toHaveLength(20);

    supabase.usageEvents.forEach((event) => {
      expect(event.processed).toBe(true);
      expect(event.processed_by === 'worker-A' || event.processed_by === 'worker-B').toBe(true);
    });
  });
});
