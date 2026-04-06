import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProgressiveRollout, RolloutManager, RolloutMetrics } from '../progressiveRollout.js'

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  assertNotTestEnv: vi.fn(),
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
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

describe('RolloutManager', () => {
  let manager: RolloutManager;

  beforeEach(() => {
    manager = new RolloutManager();
    vi.restoreAllMocks();
  });

  it('getAllMetrics fetches metrics concurrently', async () => {
    const featureCount = 5;
    const delayMs = 20;

    // Populate rollouts
    for (let i = 0; i < featureCount; i++) {
      manager.getRollout(`feature-${i}`);
    }

    // Mock getMetrics with delay
    vi.spyOn(ProgressiveRollout.prototype, 'getMetrics').mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return {
        totalUsers: 100,
        enabledUsers: 50,
        errors: 1,
        errorRate: 2,
        lastUpdated: new Date(),
      } as RolloutMetrics;
    });

    const start = performance.now();
    const metrics = await manager.getAllMetrics();
    const end = performance.now();
    const duration = end - start;

    expect(metrics.size).toBe(featureCount);
    // If serial, it would be featureCount * delayMs = 100ms
    // If concurrent, it should be close to delayMs = 20ms
    // We allow some overhead, but it should be definitely less than serial (e.g., < 80% of serial time)
    expect(duration).toBeLessThan(delayMs * featureCount * 0.8);
  });
});
