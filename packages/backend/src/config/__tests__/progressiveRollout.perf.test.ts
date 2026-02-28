import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveRollout, RolloutManager } from '../progressiveRollout.js';

// Mock dependencies
const { mockInsert, mockSelect, mockEq, mockGte, mockSingle } = vi.hoisted(() => {
  return {
    mockInsert: vi.fn().mockResolvedValue({ data: null, error: null }),
    mockSelect: vi.fn().mockReturnThis(),
    mockEq: vi.fn().mockReturnThis(),
    mockGte: vi.fn().mockReturnThis(),
    mockSingle: vi.fn().mockResolvedValue({
      data: {
        feature_name: 'test-feature',
        percentage: 50,
        active: true
      },
      error: null
    }),
  };
});

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      gte: mockGte,
      single: mockSingle,
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
}));

describe('Rollout Performance Benchmark', () => {
  let manager: RolloutManager;

  beforeEach(() => {
    manager = new RolloutManager();
    vi.clearAllMocks();
    // Clear static buffer
    (ProgressiveRollout as any).usageBuffer = [];
    if ((ProgressiveRollout as any).flushInterval) {
        clearInterval((ProgressiveRollout as any).flushInterval);
        (ProgressiveRollout as any).flushInterval = null;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up interval
    if ((ProgressiveRollout as any).flushInterval) {
        clearInterval((ProgressiveRollout as any).flushInterval);
        (ProgressiveRollout as any).flushInterval = null;
    }
  });

  it('buffers usage tracking', async () => {
    const featureName = 'perf-test-feature';
    // Run 50 iterations (half of buffer limit 100)
    const iterations = 50;
    const rollout = manager.getRollout(featureName);

    // Ensure config is loaded
    await rollout.loadConfig();

    for (let i = 0; i < iterations; i++) {
      await rollout.isEnabledForUser(`user-${i}`);
    }

    // Expect 0 inserts because buffer limit is 100
    expect(mockInsert).toHaveBeenCalledTimes(0);

    // Now trigger enough to flush (reach 100)
    for (let i = 0; i < 50; i++) {
        await rollout.isEnabledForUser(`user-more-${i}`);
    }

    // Expect 1 insert (the flush)
    // Note: flushBuffer is async but called without await in trackUsage.
    // We wait a bit for promise to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockInsert).toHaveBeenCalledTimes(1);

    // Verify batch size
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).toHaveLength(100);

    console.log(`Optimized: ${mockInsert.mock.calls.length} DB writes for ${iterations * 2} checks`);
  });

  it('flushes on interval', async () => {
    vi.useFakeTimers();
    const featureName = 'interval-test-feature';
    const rollout = manager.getRollout(featureName);
    await rollout.loadConfig();

    await rollout.isEnabledForUser('user-interval');

    // Should be buffered
    expect(mockInsert).not.toHaveBeenCalled();

    // Advance time by 5000ms + margin
    vi.advanceTimersByTime(6000);

    // Should have flushed
    // Note: setInterval callback logic runs. We need to allow it to execute.
    // advanceTimersByTime triggers the callback, but the callback is async (calls flushBuffer).
    // We might need to wait for real microtasks or use runAllTicks.

    // However, flushBuffer calls mockInsert synchronously (it's mocked).
    // But it's awaited inside async function.

    // Let's rely on standard vitest timer handling.

    // Wait for promise resolution
    await vi.waitFor(() => {
        expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    vi.useRealTimers();
  });
});
