/**
 * CRM Webhook Service Tests
 *
 * Tests idempotent webhook ingestion, duplicate detection, and event storage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase
const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../lib/supabase.js', () => ({
  createServerSupabaseClient: () => mockSupabase,
}));

// Mock logger
vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock CRM provider registry
const mockProvider = {
  provider: 'salesforce' as const,
  verifyWebhookSignature: vi.fn(),
  extractIdempotencyKey: vi.fn(),
};

vi.mock('../CrmProviderRegistry.js', () => ({
  getCrmProvider: () => mockProvider,
}));

// Mock worker queue
const mockQueue = {
  add: vi.fn().mockResolvedValue({ id: 'job-1' }),
};

vi.mock('../../../workers/crmWorker.js', () => ({
  getCrmWebhookQueue: () => mockQueue,
}));

describe('CrmWebhookService', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const mod = await import('../CrmWebhookService.js');
    service = mod.crmWebhookService;
    // Replace the supabase client
    (service as any).supabase = mockSupabase;
  });

  describe('ingestWebhook', () => {
    it('rejects events with invalid signature', async () => {
      mockProvider.verifyWebhookSignature.mockResolvedValue({ valid: false });

      const req = { body: {}, headers: {} } as any;
      const result = await service.ingestWebhook('salesforce', req);

      expect(result.accepted).toBe(false);
      expect(result.duplicate).toBe(false);
    });

    it('detects duplicate events by idempotency key', async () => {
      mockProvider.verifyWebhookSignature.mockResolvedValue({ valid: true, tenantId: 'org-1' });
      mockProvider.extractIdempotencyKey.mockReturnValue('sf:Opportunity:evt-001');

      // Mock: existing event found — chain is .from().select().eq().maybeSingle()
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_webhook_events') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: { id: 'existing-event-id' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const req = { body: { eventId: 'evt-001' }, headers: {} } as any;
      const result = await service.ingestWebhook('salesforce', req);

      expect(result.accepted).toBe(false);
      expect(result.duplicate).toBe(true);
      expect(result.eventId).toBe('existing-event-id');
    });

    it('stores new events and enqueues for processing', async () => {
      mockProvider.verifyWebhookSignature.mockResolvedValue({ valid: true, tenantId: 'org-1' });
      mockProvider.extractIdempotencyKey.mockReturnValue('sf:Opportunity:evt-002');

      let webhookCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'crm_webhook_events') {
          webhookCallCount++;
          if (webhookCallCount === 1) {
            // First call: check for duplicate — .select().eq().maybeSingle()
            return {
              select: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            };
          }
          // Second call: insert
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'new-event-id' }, error: null }),
              }),
            }),
          };
        }
        if (table === 'crm_connections') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: { tenant_id: 'tenant-1' }, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const req = { body: { eventId: 'evt-002', organizationId: 'org-1' }, headers: {} } as any;
      const result = await service.ingestWebhook('salesforce', req);

      expect(result.accepted).toBe(true);
      expect(result.duplicate).toBe(false);
      expect(result.eventId).toBe('new-event-id');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'crm:webhook:process',
        expect.objectContaining({ eventId: 'new-event-id' }),
        expect.any(Object),
      );
    });
  });
});
