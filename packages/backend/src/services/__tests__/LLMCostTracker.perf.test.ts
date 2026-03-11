import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setEnvSourceForTests } from '../../lib/env';
import { LLMCostTracker } from '../LLMCostTracker.js';

// Mock Supabase with RPC support
vi.mock('@supabase/supabase-js', () => {
  const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

  const client = {
    rpc: rpcMock,
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
    })),
  };

  return { createClient: () => client };
});

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe('LLMCostTracker Performance Optimization', () => {
  beforeEach(() => {
    __setEnvSourceForTests({
      VITE_SUPABASE_URL: 'http://test',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    });
    vi.clearAllMocks();
  });

  it('getCostAnalytics should call rpc with correct arguments', async () => {
    const tracker = new LLMCostTracker();
    // Access the mocked client
    // @ts-expect-error accessing private property
    const client = tracker.supabase;

    const startDate = new Date('2024-01-01T00:00:00.000Z');
    const endDate = new Date('2024-01-31T23:59:59.999Z');

    const mockResponse = {
      totalCost: 100,
      totalTokens: 5000,
      requestCount: 10,
      costByModel: { 'gpt-4': 80, 'gpt-3.5': 20 },
      costByUser: { 'user1': 50, 'user2': 50 },
      costByEndpoint: { '/chat': 100 },
      averageCostPerRequest: 10
    };

    // Setup mock return
    // @ts-expect-error mocking private client
    client.rpc.mockResolvedValue({ data: mockResponse, error: null });

    const result = await tracker.getCostAnalytics(startDate, endDate);

    // Verify RPC was called
    // @ts-expect-error accessing private client
    expect(client.rpc).toHaveBeenCalledWith('get_llm_cost_analytics', {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    });

    // Verify result structure
    expect(result).toEqual(mockResponse);
  });

  it('getCostAnalytics should handle rpc errors', async () => {
    const tracker = new LLMCostTracker();
    // @ts-expect-error accessing private property
    const client = tracker.supabase;

    // @ts-expect-error mocking private client
    client.rpc.mockResolvedValue({ data: null, error: { message: 'RPC Error' } });

    await expect(tracker.getCostAnalytics(new Date(), new Date()))
      .rejects.toThrow('Failed to get cost analytics: RPC Error');
  });

  it('getCostAnalytics should return empty structure if data is null', async () => {
    const tracker = new LLMCostTracker();
    // @ts-expect-error accessing private property
    const client = tracker.supabase;

    // @ts-expect-error mocking private client
    client.rpc.mockResolvedValue({ data: null, error: null });

    const result = await tracker.getCostAnalytics(new Date(), new Date());

    expect(result).toEqual({
      totalCost: 0,
      costByModel: {},
      costByUser: {},
      costByEndpoint: {},
      totalTokens: 0,
      averageCostPerRequest: 0,
      requestCount: 0,
    });
  });
});
