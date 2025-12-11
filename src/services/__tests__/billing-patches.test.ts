import { vi, describe, it, expect, beforeEach } from 'vitest';

// Ensure environment variables required by module initialization are present
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'testkey';
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test';
process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'supapass';

// Mock supabase client creation to capture calls
vi.mock('@supabase/supabase-js', () => {
  // Create one shared mock client instance used across imports
  const state: any = {
    lastUpdatePayload: null,
    lastUpsertPayload: null,
    lastInsertPayload: null,
    processedEventIds: [] as any[],
  };

  const createBuilder = (table: string) => {
    return {
      select: (..._args: any[]) => createBuilder(table),
      eq: (_k: string, _v: any) => createBuilder(table),
      in: (_k: string, _v: any) => createBuilder(table),
      limit: (_n?: number) => createBuilder(table),
      order: (_col?: string, _opts?: any) => createBuilder(table),
      gte: (_k: string, _v: any) => createBuilder(table),
      lte: (_k: string, _v: any) => createBuilder(table),
      single: async () => {
        if (table === 'webhook_events') return { data: { retry_count: 2 }, error: null };
        return { data: null, error: null };
      },
      update: async (payload: any) => {
        if (table === 'usage_events') {
          state.processedEventIds.push(payload);
        }
        state.lastUpdatePayload = payload;
        return { error: null };
      },
      insert: async (payload: any) => {
        state.lastInsertPayload = payload;
        return { error: null };
      },
      upsert: async (payload: any) => {
        state.lastUpsertPayload = payload;
        return { error: null };
      },
      then: async () => ({ data: null, error: null }),
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
  isWithinLimits: (_usage: any, _limits: any) => ({ exceeded: [] }),
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({ features: { usageTracking: true } }),
  isProduction: () => false,
  isTest: () => true,
  isDevelopment: () => true,
}));

import webhookService from '../billing/WebhookService';
import aggregator from '../metering/UsageAggregator';
import { trackUsage } from '../UsageTrackingService';

describe('Billing patches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
