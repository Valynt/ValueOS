import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __setEnvSourceForTests } from '../../lib/env';
import { LLMCostTracker } from '../LLMCostTracker';

vi.mock('@supabase/supabase-js', () => {
  // Create one shared mock client instance used across imports
  const state: any = {
    lastInsertPayload: null,
    lastUpdatePayload: null,
  };

  const createBuilder = (table: string) => {
    return {
      select: (..._args: any[]) => createBuilder(table),
      eq: (_k: string, _v: any) => createBuilder(table),
      gte: (_k: string, _v: any) => createBuilder(table),
      lte: (_k: string, _v: any) => createBuilder(table),
      insert: async (payload: any) => {
        state.lastInsertPayload = payload;
        return { error: null };
      },
      update: async (payload: any) => {
        state.lastUpdatePayload = payload;
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

vi.mock('../../lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}));

describe('LLMCostTracker', () => {
  beforeEach(() => {
    __setEnvSourceForTests({
      VITE_SUPABASE_URL: 'http://test',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    });
    vi.clearAllMocks();
  });

  it('calculates cost per pricing table and default', () => {
    const tracker = new LLMCostTracker();
    expect(tracker.calculateCost('meta-llama/Llama-3-70b-chat-hf', 1_000, 500))
      .toBeCloseTo((0.001 + 0.00045), 6);
    expect(tracker.calculateCost('unknown-model', 1_000, 1_000))
      .toBeCloseTo(0.002, 6);
  });

  it('logs but does not throw when usage insert fails', async () => {
    const tracker = new LLMCostTracker();
    const supabase = (await import('@supabase/supabase-js')).createClient();
    // Mock the insert to fail
    const originalFrom = supabase.from;
    supabase.from = vi.fn((table: string) => ({
      ...originalFrom(table),
      insert: vi.fn().mockResolvedValueOnce({ error: new Error('fail') }),
    }));
    await expect(tracker.trackUsage({
      userId: 'u1',
      provider: 'together_ai',
      model: 'meta-llama/Llama-3-70b-chat-hf',
      promptTokens: 1000,
      completionTokens: 500,
      endpoint: 'llm-gateway',
      success: true,
      latencyMs: 42,
    })).resolves.not.toThrow();
  });

  it('dedupes alerts within hour and still persists', async () => {
    const tracker = new LLMCostTracker();
    const supabase = (await import('@supabase/supabase-js')).createClient();
    vi.spyOn(tracker, 'getHourlyCost').mockResolvedValueOnce(60);
    vi.spyOn(tracker, 'getDailyCost').mockResolvedValueOnce(0);
    vi.spyOn(tracker, 'getMonthlyCost').mockResolvedValueOnce(0);
    await tracker.checkCostThresholds();
    await tracker.checkCostThresholds();
    // Should have called insert once for the cost_alerts table
    expect(supabase.state.lastInsertPayload).toBeTruthy();
    expect(supabase.state.lastInsertPayload.level).toBe('warning');
  });
});
