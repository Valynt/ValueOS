import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveRollout, RolloutManager, RolloutMetrics } from '../progressiveRollout.js';

// Mock dependencies
const { mockInsert } = vi.hoisted(() => {
  return { mockInsert: vi.fn().mockReturnThis() };
});

vi.mock('../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      insert: mockInsert,
      update: vi.fn().mockReturnThis(),
    }),
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

describe('Rollout Performance', () => {
  let manager: RolloutManager;

  beforeEach(() => {
    manager = new RolloutManager();
    mockInsert.mockClear();

    // Reset static state
    const RolloutClass = ProgressiveRollout as any;
    if (RolloutClass.flushInterval) {
      clearInterval(RolloutClass.flushInterval);
      RolloutClass.flushInterval = null;
    }
    RolloutClass.usageBuffer = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('trackUsage should handle high volume gracefully', async () => {
    const featureName = 'perf-test-feature';
    const rollout = manager.getRollout(featureName);

    // Mock config loading so isEnabledForUser doesn't fail or wait
    // We need to set the config property because loadConfig implementation is replaced
    const config = {
      featureName,
      percentage: 50,
      autoRollback: false
    };

    // @ts-ignore - Accessing private property
    rollout.config = config;

    vi.spyOn(rollout, 'loadConfig').mockResolvedValue(config as any);

    const iterations = 100;

    // Simulate high traffic
    for (let i = 0; i < iterations; i++) {
      await rollout.isEnabledForUser(`user-${i}`);
    }

    // Allow pending promises to settle
    await new Promise(resolve => setTimeout(resolve, 100));

    // In the unoptimized version, this should be equal to iterations
    // In the optimized version, this should be much lower (due to buffering)
    console.log(`Supabase inserts called: ${mockInsert.mock.calls.length} times for ${iterations} checks`);

    // We expect significantly fewer inserts (ideally 1 batch if buffer size is 100)
    // The buffer limit is 100, so it should flush once at the 100th item
    expect(mockInsert).toHaveBeenCalledTimes(1);

    // Verify it was a batch insert
    const insertArg = mockInsert.mock.calls[0][0];
    expect(Array.isArray(insertArg)).toBe(true);
    expect(insertArg.length).toBe(iterations);
  });

  it('should flush buffer via interval', async () => {
    vi.useFakeTimers();
    const featureName = 'interval-test-feature';
    const rollout = manager.getRollout(featureName);

    // Mock config
    const config = {
      featureName,
      percentage: 50,
      autoRollback: false
    };
    // @ts-ignore
    rollout.config = config;
    vi.spyOn(rollout, 'loadConfig').mockResolvedValue(config as any);

    // Make 5 calls (less than buffer limit 100)
    for (let i = 0; i < 5; i++) {
      await rollout.isEnabledForUser(`user-${i}`);
    }

    // Should not have flushed yet
    expect(mockInsert).not.toHaveBeenCalled();

    // Advance time by 5 seconds
    await vi.advanceTimersByTimeAsync(5100);

    // Should have flushed now
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0]).toHaveLength(5);
  });
});
