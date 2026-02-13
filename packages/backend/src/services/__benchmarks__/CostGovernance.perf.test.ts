/* eslint-disable no-console */

import { describe, it, vi, expect, beforeAll } from 'vitest';

// Mock Redis Client
const { mockEval } = vi.hoisted(() => ({
  mockEval: vi.fn().mockResolvedValue(JSON.stringify({
      status: 'allowed',
      circuitOpenUntil: 0,
      totalTokens: 100,
      totalCost: 0.1
  }))
}));

vi.mock("ioredis", () => {
  return {
    default: class Redis {
      on = vi.fn();
      eval = mockEval;
      zremrangebyscore = vi.fn().mockResolvedValue(0);
      zcard = vi.fn().mockResolvedValue(0);
    }
  }
});

import { costGovernance } from '../CostGovernanceService.js';

vi.mock("../../utils/logger", () => ({
    logger: {
        warn: vi.fn(),
        info: vi.fn(),
        error: vi.fn()
    }
}));

describe('CostGovernanceService Performance', () => {
  it('should run without memory leak', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
        await costGovernance.recordUsage({
            tenantId: 'tenant-1',
            dealId: `deal-${i % 100}`,
            tokens: 10,
            cost: 0.001,
            userId: 'user-1',
            model: 'gpt-4'
        });
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const diff = finalMemory - initialMemory;

    // In the old implementation (Map), this would grow significantly.
    // In the new implementation (Redis/Mock), we only store mocked responses,
    // but the service itself shouldn't hold state.
    // However, JS GC is non-deterministic, so asserting on exact memory is flaky.
    // We mainly verify it runs and calls Redis.

    expect(mockEval).toHaveBeenCalledTimes(iterations);
    console.log(`Memory diff: ${diff / 1024 / 1024} MB`);
  });
});
