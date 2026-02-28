 
 
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ensure environment variables required by module initialization are present
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'testkey';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'supapass';

// Mock supabase client creation to capture calls
vi.mock('@supabase/supabase-js', () => {
  // Create one shared mock client instance used across imports
  const state: unknown = {
    lastUpdatePayload: null,
    lastUpsertPayload: null,
    lastInsertPayload: null,
    insertPayloads: [] as any[],
    insertedIdempotencyKeys: new Set<string>(),
    selectResponses: {} as Record<string, any[] | null>,
    processedEventIds: [] as any[],
    insertedWebhookEventIds: new Set<string>(),
    customerStatusTransitions: 0,
  };

  const createBuilder = (table: string) => {
    return {
      select: (..._args: unknown[]) => createBuilder(table),
      eq: (_k: string, _v: unknown) => createBuilder(table),
      in: (_k: string, _v: unknown) => createBuilder(table),
      limit: (_n?: number) => createBuilder(table),
      order: (_col?: string, _opts?: unknown) => createBuilder(table),
      gte: (_k: string, _v: unknown) => createBuilder(table),
      lte: (_k: string, _v: unknown) => createBuilder(table),
      single: async () => {
        if (table === 'webhook_events') return { data: { retry_count: 2 }, error: null };
        if (table === 'billing_customers') return { data: { tenant_id: 'tenant-1' }, error: null };
        return { data: null, error: null };
      },
      update: async (payload: unknown) => {
        if (table === 'usage_events') {
          state.processedEventIds.push(payload);
        }
        if (table === 'billing_customers' && payload?.status === 'active') {
          state.customerStatusTransitions += 1;
        }
        state.lastUpdatePayload = payload;
        return { error: null };
      },
      insert: async (payload: unknown, options?: unknown) => {
        const payloads = Array.isArray(payload) ? payload : [payload];
        if (table === 'webhook_events') {
          for (const entry of payloads) {
            const eventId = entry?.stripe_event_id as string | undefined;
            if (eventId && state.insertedWebhookEventIds.has(eventId)) {
              if (options?.ignoreDuplicates) {
                return { error: null, count: 0 };
              }
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint',
                },
              };
            }
            if (eventId) {
              state.insertedWebhookEventIds.add(eventId);
            }
          }
        }
        if (table === 'usage_aggregates') {
          for (const entry of payloads) {
            const key = entry?.idempotency_key as string | undefined;
            if (key && state.insertedIdempotencyKeys.has(key)) {
              return {
                error: {
                  code: '23505',
                  message: 'duplicate key value violates unique constraint',
                },
              };
            }
            if (key) {
              state.insertedIdempotencyKeys.add(key);
            }
          }
        }
        state.lastInsertPayload = payload;
        state.insertPayloads.push(...payloads);
        if (table === 'webhook_events') {
          return { error: null, count: 1 };
        }
        return { error: null };
      },
      upsert: async (payload: unknown) => {
        state.lastUpsertPayload = payload;
        return { error: null };
      },
      then: async () => ({ data: state.selectResponses[table] ?? null, error: null }),
    } as any;
  };

  const client = {
    state,
    from: (table: string) => createBuilder(table),
  };

  return { createClient: () => client };
});

// Mock billing config to ensure STRIPE_CONFIG is present (vitest import.meta.env empty)
vi.mock('../../config/billing', () => ({
  STRIPE_CONFIG: {
    secretKey: 'testkey',
    webhookSecret: 'whsec_test',
    apiVersion: '2023-10-16',
  },
}));

// Mock TenantProvisioning to avoid loading heavy/possibly invalid modules during unit tests
vi.mock('../TenantProvisioning', () => ({
  isWithinLimits: (_usage: unknown, _limits: unknown) => ({ exceeded: [] }),
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({ features: { usageTracking: true } }),
  isProduction: () => false,
  isTest: () => true,
  isDevelopment: () => true,
}));


vi.mock('../billing/InvoiceService', () => ({
  default: {
    storeInvoice: vi.fn(async () => undefined),
    updateInvoice: vi.fn(async () => undefined),
  },
}));

import webhookService from '../billing/WebhookService';
import aggregator from '../metering/UsageAggregator';
import { trackUsage } from '../UsageTrackingService';

describe('Billing patches', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const client = (await import('@supabase/supabase-js')).createClient();
    client.state.lastUpdatePayload = null;
    client.state.lastUpsertPayload = null;
    client.state.lastInsertPayload = null;
    client.state.insertPayloads = [];
    client.state.insertedIdempotencyKeys.clear();
    client.state.selectResponses = {};
    client.state.processedEventIds = [];
    client.state.insertedWebhookEventIds.clear();
    client.state.customerStatusTransitions = 0;
  });

  it('increments retry_count when marking webhook failed', async () => {
    // call private method via bracket access
    await (webhookService as any).markEventFailed('evt_test_1', 'boom');

    // The mocked supabase stores lastUpdatePayload
    const client = (await import('@supabase/supabase-js')).createClient();
    expect(client.state.lastUpdatePayload).toBeTruthy();
    expect(client.state.lastUpdatePayload.retry_count).toBe(3); // 2 -> 3
    expect(client.state.lastUpdatePayload.error_message).toBe('boom');
  });

  it('marks events processed when no active subscriptions in aggregator', async () => {
    const events = [
      { id: 'e1', tenant_id: 't1', metric: 'api_calls', amount: '1', timestamp: '2025-01-01T00:00:00Z' },
    ];

    await (aggregator as any).createAggregate(events);

    const client = (await import('@supabase/supabase-js')).createClient();
    // markEventsProcessed calls update on usage_events; lastUpdatePayload should include processed:true
    expect(client.state.lastUpdatePayload).toBeTruthy();
    expect(client.state.lastUpdatePayload.processed).toBe(true);
  });

  it('persists usage via upsert when tracking usage', async () => {
    const event = {
      organizationId: 'org-1',
      type: 'api_call',
      amount: 1,
      timestamp: new Date(),
    } as any;

    await trackUsage({
      organizationId: event.organizationId,
      type: event.type,
      amount: event.amount,
      timestamp: new Date(),
    });

    const client = (await import('@supabase/supabase-js')).createClient();
    expect(client.state.lastUpsertPayload).toBeTruthy();
    expect(client.state.lastUpsertPayload.organization_id).toBe('org-1');
  });


  it('processes duplicate webhook replays atomically under concurrency', async () => {
    const event = {
      id: 'evt_parallel_1',
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_1',
          customer: 'cus_1',
        },
      },
    };

    await Promise.all([
      webhookService.processEvent(event),
      webhookService.processEvent(event),
    ]);

    const client = (await import('@supabase/supabase-js')).createClient();
    expect(client.state.customerStatusTransitions).toBe(1);
    expect(client.state.insertedWebhookEventIds.size).toBe(1);
  });

  it('does not create duplicate aggregates when reprocessing the same group', async () => {
    const events = [
      { id: 'e1', tenant_id: 't1', metric: 'api_calls', amount: '1', timestamp: '2025-01-01T00:00:00Z' },
      { id: 'e2', tenant_id: 't1', metric: 'api_calls', amount: '2', timestamp: '2025-01-01T00:05:00Z' },
    ];

    const client = (await import('@supabase/supabase-js')).createClient();
    client.state.selectResponses.subscriptions = [{ id: 'sub-1' }];
    client.state.selectResponses.subscription_items = [{ id: 'item-1' }];

    await (aggregator as any).createAggregate(events);
    await (aggregator as any).createAggregate(events);

    expect(client.state.insertPayloads).toHaveLength(1);
    expect(client.state.insertPayloads[0].idempotency_key).toContain('aggregate_t1_api_calls');
  });
});
