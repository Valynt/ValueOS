import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSupabase = {
  from: vi.fn(),
};

vi.mock('../../../lib/supabase.js', () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: () => mockSupabase,
  supabase: { from: vi.fn() },
}));

vi.mock('../../../lib/logger.js', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('CrmHealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emits warning/critical alerts at configured thresholds', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table !== 'crm_sync_health') {
        return {};
      }

      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  tenant_id: 'tenant-1',
                  provider: 'hubspot',
                  status: 'degraded',
                  degraded: true,
                  last_sync_at: null,
                  last_successful_sync_at: null,
                  last_successful_webhook_at: null,
                  last_successful_process_at: null,
                  sync_lag_seconds: 14_500,
                  token_health: 'expired',
                  error_rate_1h: 21,
                  webhook_throughput_1h: 52,
                  consecutive_failure_count: 6,
                  mttr_seconds: 3600,
                  mttr_sample_size: 3,
                },
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const { crmHealthService } = await import('../CrmHealthService.js');
    const health = await crmHealthService.getHealth('tenant-1', 'hubspot');

    expect(health).not.toBeNull();
    expect(health?.alerts.map((alert) => alert.code)).toEqual(
      expect.arrayContaining([
        'SYNC_LAG_CRITICAL',
        'TOKEN_EXPIRED',
        'ERROR_RATE_CRITICAL',
        'CONSECUTIVE_FAILURES_CRITICAL',
        'CONNECTION_DEGRADED',
      ]),
    );
  });

  it('returns timeline payload shape that matches schema contract', async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'crm_sync_health') {
        return {
          select: () => ({
            eq: () => Promise.resolve({
              data: [
                {
                  tenant_id: 'tenant-1',
                  provider: 'salesforce',
                  status: 'connected',
                  degraded: false,
                  last_sync_at: '2026-04-05T00:00:00.000Z',
                  last_successful_sync_at: '2026-04-05T00:00:00.000Z',
                  last_successful_webhook_at: '2026-04-05T00:10:00.000Z',
                  last_successful_process_at: '2026-04-05T00:10:10.000Z',
                  sync_lag_seconds: 120,
                  token_health: 'valid',
                  error_rate_1h: 0,
                  webhook_throughput_1h: 12,
                  consecutive_failure_count: 0,
                  mttr_seconds: 600,
                  mttr_sample_size: 2,
                },
              ],
              error: null,
            }),
          }),
        };
      }

      if (table === 'crm_health_incidents') {
        return {
          select: () => ({
            eq: () => ({
              gte: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [
                      {
                        id: 'incident-1',
                        provider: 'salesforce',
                        started_at: '2026-04-04T00:00:00.000Z',
                        resolved_at: '2026-04-04T00:20:00.000Z',
                        duration_seconds: 1200,
                        severity: 'critical',
                        reason_code: 'WEBHOOK_PROCESSING_FAILED',
                        summary: 'Webhook processing retries exhausted',
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      return {};
    });

    const {
      crmHealthService,
      TenantHealthTimelineResponseSchema,
    } = await import('../CrmHealthService.js');

    const payload = await crmHealthService.getHealthTimeline('tenant-1', 30);
    const parsed = TenantHealthTimelineResponseSchema.parse(payload);

    expect(parsed.tenantId).toBe('tenant-1');
    expect(parsed.providers).toHaveLength(2);
    expect(parsed.providers[0]?.timeline.length).toBeGreaterThanOrEqual(0);
  });
});
