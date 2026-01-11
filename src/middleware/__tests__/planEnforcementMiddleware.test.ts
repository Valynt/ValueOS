import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlanEnforcement } from '../planEnforcementMiddleware';
import UsageCache from '../../services/metering/UsageCache';
import GracePeriodService from '../../services/metering/GracePeriodService';
import SubscriptionService from '../../services/billing/SubscriptionService';

vi.mock('../../services/metering/UsageCache', () => ({
  default: {
    getCurrentUsage: vi.fn(),
    getQuota: vi.fn(),
    isOverQuota: vi.fn(),
  },
}));

vi.mock('../../services/metering/GracePeriodService', () => ({
  default: {
    isInGracePeriod: vi.fn(),
    startGracePeriod: vi.fn(),
    getGracePeriodExpiration: vi.fn(),
  },
}));

vi.mock('../../services/billing/SubscriptionService', () => ({
  default: {
    getActiveSubscription: vi.fn(),
  },
}));

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn((key: string, value: string) => {
      headers[key] = value;
    }),
    headers,
  };
}

describe('planEnforcementMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks hard capped metrics for free plan tenants', async () => {
    const tenantId = 'tenant-free';

    vi.mocked(UsageCache.getCurrentUsage).mockResolvedValue(5);
    vi.mocked(UsageCache.getQuota).mockResolvedValue(5);
    vi.mocked(UsageCache.isOverQuota).mockResolvedValue(true);
    vi.mocked(SubscriptionService.getActiveSubscription).mockResolvedValue({
      plan_tier: 'free',
    } as any);

    const req = {
      tenantId,
    } as any;
    const res = mockRes();
    const next = vi.fn();

    const middleware = createPlanEnforcement({ metric: 'storage_gb' });
    await middleware(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'QUOTA_EXCEEDED',
        metric: 'storage_gb',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('allows grace period for standard plan quota overages', async () => {
    const tenantId = 'tenant-standard';
    const graceExpiry = new Date(Date.now() + 60_000);

    vi.mocked(UsageCache.getCurrentUsage).mockResolvedValue(11_000);
    vi.mocked(UsageCache.getQuota).mockResolvedValue(10_000);
    vi.mocked(UsageCache.isOverQuota).mockResolvedValue(true);
    vi.mocked(SubscriptionService.getActiveSubscription).mockResolvedValue({
      plan_tier: 'standard',
    } as any);
    vi.mocked(GracePeriodService.isInGracePeriod).mockResolvedValue(false);
    vi.mocked(GracePeriodService.startGracePeriod).mockResolvedValue({} as any);
    vi.mocked(GracePeriodService.getGracePeriodExpiration).mockResolvedValue(graceExpiry);

    const req = {
      tenantId,
    } as any;
    const res = mockRes();
    const next = vi.fn();

    const middleware = createPlanEnforcement({ metric: 'llm_tokens' });
    await middleware(req, res as any, next);

    expect(GracePeriodService.startGracePeriod).toHaveBeenCalledWith(
      tenantId,
      'llm_tokens',
      11_000,
      10_000
    );
    expect(res.headers['X-Quota-Warning']).toBe('true');
    expect(res.headers['X-Grace-Period-Expires']).toBe(graceExpiry.toISOString());
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
