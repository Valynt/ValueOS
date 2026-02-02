import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveRollout, RolloutManager } from '../progressiveRollout.js'

// Mock dependencies
const { mockSupabase } = vi.hoisted(() => {
  return {
    mockSupabase: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
    }
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase,
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProgressiveRollout Performance & Caching', () => {
  let manager: RolloutManager;
  let rollout: ProgressiveRollout;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new RolloutManager();
    // We access the rollout directly for testing
    rollout = manager.getRollout('test-feature');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Optimization: Prevents excessive reads on error (throttling)', async () => {
    // Mock Supabase to return error/no data
    mockSupabase.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

    // 1. First call loads the config (DB access)
    await rollout.isEnabledForUser('user1');

    // 2. Immediate subsequent calls should hit cache (throttled)
    await rollout.isEnabledForUser('user2');
    await rollout.isEnabledForUser('user3');

    // EXPECTATION: loadConfig calls DB only once due to ERROR_TTL (10s)
    let configLoadCalls = mockSupabase.from.mock.calls.filter(args => args[0] === 'feature_rollouts');
    expect(configLoadCalls.length).toBe(1);

    // 3. Advance time past ERROR_TTL
    vi.advanceTimersByTime(11 * 1000); // 11 seconds

    // 4. Call again - should retry loading
    await rollout.isEnabledForUser('user4');

    configLoadCalls = mockSupabase.from.mock.calls.filter(args => args[0] === 'feature_rollouts');
    expect(configLoadCalls.length).toBe(2);
  });

  it('Optimization: Reloads config after TTL to prevent stale data', async () => {
    // Mock Supabase to return valid data
    mockSupabase.single.mockResolvedValue({
      data: {
        feature_name: 'test-feature',
        percentage: 50,
        active: true,
      },
      error: null,
    });

    // 1. First call loads the config
    await rollout.isEnabledForUser('user1');

    let configLoadCalls = mockSupabase.from.mock.calls.filter(args => args[0] === 'feature_rollouts');
    expect(configLoadCalls.length).toBe(1);

    // 2. Immediate calls use cache
    await rollout.isEnabledForUser('user2');
    configLoadCalls = mockSupabase.from.mock.calls.filter(args => args[0] === 'feature_rollouts');
    expect(configLoadCalls.length).toBe(1);

    // 3. Advance time past CONFIG_TTL (60s)
    vi.advanceTimersByTime(61 * 1000); // 61 seconds

    // 4. Call again - should reload
    await rollout.isEnabledForUser('user3');

    // EXPECTATION: loadConfig is called again
    configLoadCalls = mockSupabase.from.mock.calls.filter(args => args[0] === 'feature_rollouts');
    expect(configLoadCalls.length).toBe(2);
  });
});
