
import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest';

// Mock logger
vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock env
vi.mock('@shared/lib/env', () => ({
  getEnvVar: vi.fn().mockReturnValue('10'), // For thresholds
  getLLMCostTrackerConfig: vi.fn().mockReturnValue({
    supabaseUrl: 'https://mock.supabase.co',
    supabaseServiceRoleKey: 'mock-key',
    slackWebhookUrl: 'https://hooks.slack.com/services/mock',
    alertEmail: 'mock@example.com',
  }),
  getSupabaseConfig: vi.fn().mockReturnValue({
    url: 'https://mock.supabase.co',
    anonKey: 'mock-anon-key',
    serviceRoleKey: 'mock-service-role-key',
  }),
}));

vi.mock('@supabase/supabase-js', () => {
  const SIMULATED_DELAY = 50; // 50ms database latency

  const createMockSupabase = () => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const chain = () => {
      const methods = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(async () => {
          await delay(SIMULATED_DELAY);
          return { data: { id: 'mock-id' }, error: null };
        }),
        insert: vi.fn().mockImplementation(async () => {
          await delay(SIMULATED_DELAY);
          return { error: null };
        }),
        // Handle "await query"
        then: (resolve: any) => {
          return delay(SIMULATED_DELAY).then(() => resolve({ data: [], error: null }));
        }
      };
      return methods;
    };

    return {
      from: vi.fn().mockImplementation(() => chain()),
    };
  };

  return {
    createClient: vi.fn().mockImplementation(() => createMockSupabase()),
    SupabaseClient: class {},
  };
});

import { llmCostTracker } from '../LLMCostTracker';

describe('LLMCostTracker Benchmark', () => {
  it('measures trackUsage execution time', async () => {
    const iterations = 10;
    const start = Date.now();

    for (let i = 0; i < iterations; i++) {
      await llmCostTracker.trackUsage({
        tenantId: 'tenant-123',
        userId: 'user-123',
        sessionId: 'session-123',
        provider: 'together_ai',
        model: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo',
        promptTokens: 100,
        completionTokens: 50,
        caller: 'LLMCostTracker.bench',
        endpoint: '/api/chat',
        success: true,
        latencyMs: 500,
      });
    }

    const duration = Date.now() - start;
    const avgTime = duration / iterations;
    console.log(`\n\nBENCHMARK_RESULT: trackUsage took ${duration}ms total for ${iterations} calls (Avg: ${avgTime}ms/call)\n\n`);

    expect(duration).toBeGreaterThan(0);
  });
});
