import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../errors';
import {
  CircuitOpenError,
  DependencyTimeoutError,
  executeWithResilience,
} from '../resilience';

describe('resilience utilities', () => {
  it('times out long-running operations', async () => {
    vi.useFakeTimers();

    const operation = () =>
      new Promise<string>((resolve) => {
        setTimeout(() => resolve('ok'), 50);
      });

    const promise = executeWithResilience(operation, {
      dependencyName: 'db',
      timeoutMs: 10,
      idempotent: true,
    });

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).rejects.toBeInstanceOf(DependencyTimeoutError);

    vi.useRealTimers();
  });

  it('retries idempotent operations with jitter', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    let attempts = 0;
    const operation = () => {
      attempts += 1;
      if (attempts < 3) {
        throw new ServiceUnavailableError('dependency');
      }
      return Promise.resolve('ok');
    };

    const promise = executeWithResilience(operation, {
      dependencyName: 'http',
      idempotent: true,
      retry: {
        attempts: 3,
        baseDelayMs: 5,
        maxDelayMs: 5,
        jitterRatio: 0,
      },
    });

    await vi.advanceTimersByTimeAsync(20);

    await expect(promise).resolves.toBe('ok');
    expect(attempts).toBe(3);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the circuit after repeated failures', async () => {
    const operation = vi.fn(async () => {
      throw new ServiceUnavailableError('dependency');
    });

    const options = {
      dependencyName: 'queue',
      idempotent: true,
      retry: {
        attempts: 1,
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitterRatio: 0,
      },
      circuitBreaker: {
        failureThreshold: 2,
        cooldownMs: 1_000,
        halfOpenSuccesses: 1,
      },
    };

    await expect(executeWithResilience(operation, options)).rejects.toBeInstanceOf(
      ServiceUnavailableError
    );
    await expect(executeWithResilience(operation, options)).rejects.toBeInstanceOf(
      ServiceUnavailableError
    );
    await expect(executeWithResilience(operation, options)).rejects.toBeInstanceOf(CircuitOpenError);

    expect(operation).toHaveBeenCalledTimes(2);
  });
});
