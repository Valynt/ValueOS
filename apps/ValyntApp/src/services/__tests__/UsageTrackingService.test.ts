import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as UsageTrackingService from '../UsageTrackingService';

// Mocks
vi.mock('../../lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../../config/environment', () => ({
  getConfig: () => ({
    features: { usageTracking: true },
  }),
}));

const mockSelect = vi.fn();
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

// Mock @supabase/supabase-js for createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock ../../lib/supabase for publicSupabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('UsageTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    UsageTrackingService.clearUsageCache();
  });

  it('getUsage fetches from database when cache misses', async () => {
    // Mock DB response
    const mockData = {
      organization_id: 'org-123',
      period: '2023-10',
      users: 5,
      teams: 2,
      projects: 10,
      storage: 1000,
      api_calls: 50,
      agent_calls: 5,
      last_updated: new Date().toISOString(),
    };

    mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockData, error: null })
            })
        })
    });

    // We need to re-import or use the module since we are testing side-effects of initialization
    // But since `getUsage` imports are top-level, we rely on the mocks being set up before.

    const usage = await UsageTrackingService.getUsage('org-123', '2023-10');

    expect(usage.organizationId).toBe('org-123');
    expect(usage.users).toBe(5);
    expect(usage.apiCalls).toBe(50);

    // Check if DB was called
    expect(mockFrom).toHaveBeenCalledWith('tenant_usage');
  });

  it('getUsage returns default usage when DB returns nothing', async () => {
    mockSelect.mockReturnValue({
        eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
        })
    });

    const usage = await UsageTrackingService.getUsage('org-456');

    expect(usage.organizationId).toBe('org-456');
    expect(usage.users).toBe(0);
  });
});
