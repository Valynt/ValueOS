import { describe, expect, it, vi } from 'vitest';

import { UsageQueueConsumerWorker } from '../UsageQueueConsumerWorker.js';

interface SupabaseInsert {
  upsert: ReturnType<typeof vi.fn>;
}

interface SupabaseLike {
  from: (table: string) => SupabaseInsert;
}

describe('UsageQueueConsumerWorker', () => {
  it('writes events with tenant-scoped idempotent upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase: SupabaseLike = {
      from: vi.fn().mockReturnValue({ upsert }),
    };

    const worker = new UsageQueueConsumerWorker(
      supabase as unknown as ConstructorParameters<typeof UsageQueueConsumerWorker>[0],
      {
        subscribe: vi.fn(),
        close: vi.fn(),
        getQueueLag: vi.fn().mockResolvedValue(0),
      } as unknown as ConstructorParameters<typeof UsageQueueConsumerWorker>[1]
    );

    await (worker as unknown as { persistEvent: (event: Record<string, unknown>) => Promise<void> }).persistEvent({
      tenant_id: 'tenant-1',
      metric: 'api_calls',
      amount: 1,
      request_id: 'request-1',
      idempotency_key: 'request-1',
      metadata: {},
      timestamp: new Date().toISOString(),
      event_id: 'event-1',
    });

    expect(supabase.from).toHaveBeenCalledWith('usage_events');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-1',
        idempotency_key: 'request-1',
      }),
      expect.objectContaining({
        onConflict: 'tenant_id,idempotency_key',
        ignoreDuplicates: true,
      })
    );
  });
});
