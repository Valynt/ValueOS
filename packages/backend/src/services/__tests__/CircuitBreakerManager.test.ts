import { describe, expect, it } from 'vitest';

import { CircuitBreakerManager } from '../../services/CircuitBreaker.js';

// CircuitBreakerConfig uses failureThreshold (count) and resetTimeout (ms).
// Tests use a low failureThreshold so the breaker opens after a single failure.
const FAST_OPEN_CONFIG = {
  failureThreshold: 1,
  resetTimeout: 1_000,
  halfOpenRequests: 1,
};

describe('CircuitBreakerManager', () => {
  it('opens after reaching the failure threshold', async () => {
    const manager = new CircuitBreakerManager(FAST_OPEN_CONFIG);

    await expect(
      manager.execute('failure-breach', async () => { throw new Error('boom'); })
    ).rejects.toThrow('boom');

    expect(manager.getState('failure-breach')).toBe('open');
  });

  it('allows a half-open probe after resetTimeout and closes on success', async () => {
    const manager = new CircuitBreakerManager(FAST_OPEN_CONFIG);

    await expect(
      manager.execute('half-open', async () => { throw new Error('initial failure'); })
    ).rejects.toThrow('initial failure');

    expect(manager.getState('half-open')).toBe('open');

    // Wait for resetTimeout to elapse so the breaker transitions to half-open
    await new Promise(resolve => setTimeout(resolve, 1_100));

    await expect(
      manager.execute('half-open', async () => ({ ok: true }))
    ).resolves.toEqual({ ok: true });

    expect(manager.getState('half-open')).toBe('closed');
  });

  it('rejects executions while the breaker is open', async () => {
    const manager = new CircuitBreakerManager(FAST_OPEN_CONFIG);

    await expect(
      manager.execute('block-open', async () => { throw new Error('stop'); })
    ).rejects.toThrow('stop');

    // Breaker is now open — next call should be rejected immediately
    await expect(
      manager.execute('block-open', async () => ({ ok: true }))
    ).rejects.toThrow();
  });
});
