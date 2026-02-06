import { describe, expect, it, vi } from 'vitest';
import { CircuitBreakerManager } from '../CircuitBreaker';
import { ExternalCircuitBreaker } from '../ExternalCircuitBreaker';
import { logger } from '../../lib/logger';

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ExternalCircuitBreaker', () => {
  it('transitions open -> half_open -> closed and exposes metrics', async () => {
    const manager = new CircuitBreakerManager({
      windowMs: 1000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 100,
      minimumSamples: 1,
      timeoutMs: 20,
      halfOpenMaxProbes: 1,
    });

    const breaker = new ExternalCircuitBreaker('together_ai', manager);
    const key = 'external:together_ai:chat';

    await expect(
      breaker.execute(
        key,
        async () => {
          throw new Error('boom');
        },
        { fallback: () => 'fallback-value' }
      )
    ).resolves.toBe('fallback-value');

    expect(breaker.getState(key)).toBe('open');

    await new Promise(resolve => setTimeout(resolve, 25));

    await expect(breaker.execute(key, async () => 'ok')).resolves.toBe('ok');
    expect(breaker.getState(key)).toBe('closed');

    const metrics = breaker.getMetrics(key);
    expect(metrics.integration).toBe('together_ai');
    expect(metrics.totalRequests).toBe(2);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.successfulRequests).toBe(1);

    expect(logger.warn).toHaveBeenCalledWith(
      'Circuit breaker transitioned to OPEN',
      expect.objectContaining({ integration: 'together_ai', breakerKey: key })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Circuit breaker transitioned to HALF_OPEN',
      expect.objectContaining({ integration: 'together_ai', breakerKey: key })
    );
    expect(logger.info).toHaveBeenCalledWith(
      'Circuit breaker transitioned to CLOSED',
      expect.objectContaining({ integration: 'together_ai', breakerKey: key })
    );
  });
});
