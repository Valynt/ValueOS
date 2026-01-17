import { describe, expect, it } from 'vitest';
import { CircuitBreakerManager } from '../../services/CircuitBreaker';

describe('CircuitBreakerManager', () => {
  it('opens when failure rate or latency breach occurs', async () => {
    const manager = new CircuitBreakerManager({
      windowMs: 5_000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 20,
      minimumSamples: 2,
      timeoutMs: 200,
      halfOpenMaxProbes: 1
    });

    await manager.execute('failure-breach', async () => ({}));
    await expect(manager.execute('failure-breach', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    expect(manager.getState('failure-breach')?.state).toBe('open');

    await expect(manager.execute('latency-breach', async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
      return {};
    })).resolves.toEqual({});

    await expect(manager.execute('latency-breach', async () => {
      await new Promise(resolve => setTimeout(resolve, 35));
      return {};
    })).resolves.toEqual({});

    expect(manager.getState('latency-breach')?.state).toBe('open');
  });

  it('allows half-open probe and closes on success', async () => {
    const manager = new CircuitBreakerManager({
      windowMs: 1_000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 100,
      minimumSamples: 1,
      timeoutMs: 1_000,
      halfOpenMaxProbes: 1
    });

    await expect(manager.execute('half-open', async () => {
      throw new Error('initial failure');
    })).rejects.toThrow('initial failure');

    expect(manager.getState('half-open')?.state).toBe('open');

    await new Promise(resolve => setTimeout(resolve, 1_100));

    await expect(manager.execute('half-open', async () => ({ ok: true }))).resolves.toEqual({ ok: true });
    expect(manager.getState('half-open')?.state).toBe('closed');
  });

  it('blocks executions while open', async () => {
    const manager = new CircuitBreakerManager({
      windowMs: 1_000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 100,
      minimumSamples: 1,
      timeoutMs: 500,
      halfOpenMaxProbes: 1
    });

    await expect(manager.execute('block-open', async () => {
      throw new Error('stop');
    })).rejects.toThrow('stop');

    const attempt = manager.execute('block-open', async () => ({ ok: true }));
    await expect(attempt).rejects.toThrow('Circuit breaker open');
  });
});
