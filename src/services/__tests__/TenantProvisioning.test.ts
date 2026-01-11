import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure the variable is available in the mock factory
const { mockConfig } = vi.hoisted(() => {
  return {
    mockConfig: {
      features: {
        billing: true,
        usageTracking: true,
        email: { enabled: false }
      }
    }
  };
});

// Mock config
vi.mock('../../config/environment', () => ({
  getConfig: vi.fn(() => mockConfig),
}));

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock SubscriptionService - define mock logic inside factory
// We return a new mock function here, which we can reference later via import
vi.mock('../billing/SubscriptionService', () => {
  return {
    default: {
      cancelSubscription: vi.fn(),
    },
  };
});

import { deprovisionTenant } from '../TenantProvisioning';
import subscriptionService from '../billing/SubscriptionService';

describe('TenantProvisioning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.features.billing = true; // Reset to default
  });

  describe('deprovisionTenant', () => {
    it('should cancel billing when billing feature is enabled', async () => {
      const organizationId = 'org-123';
      const mockSubscription = { id: 'sub-123' };

      // Setup mock success
      vi.mocked(subscriptionService.cancelSubscription).mockResolvedValue(mockSubscription as any);

      const result = await deprovisionTenant(organizationId);

      expect(result.success).toBe(true);
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(organizationId, true);
    });

    it('should handle "No active subscription" as success/noop', async () => {
      const organizationId = 'org-nosub';
      const error = new Error('No active subscription found');

      // Setup mock failure that should be ignored
      vi.mocked(subscriptionService.cancelSubscription).mockRejectedValue(error);

      const result = await deprovisionTenant(organizationId);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(subscriptionService.cancelSubscription).toHaveBeenCalledWith(organizationId, true);
    });

    it('should report failure for other billing errors but continue deprovisioning', async () => {
        const organizationId = 'org-error';
        const error = new Error('Stripe connection error');

        // Setup mock failure that should be reported
        vi.mocked(subscriptionService.cancelSubscription).mockRejectedValue(error);

        const result = await deprovisionTenant(organizationId);

        // It should capture the error
        expect(result.success).toBe(false);
        expect(result.errors).toContain(`Failed to cancel billing: ${error.message}`);
        // Ensure other steps would continue (though mocked out here, the fact we got a result means it didn't crash)
    });

    it('should skip billing cancellation when feature is disabled', async () => {
        const organizationId = 'org-disabled';
        mockConfig.features.billing = false;

        const result = await deprovisionTenant(organizationId);

        expect(result.success).toBe(true);
        expect(subscriptionService.cancelSubscription).not.toHaveBeenCalled();
    });
  });
});
