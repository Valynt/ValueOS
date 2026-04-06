import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryService } from '../RetryService';

// Mock dependencies
vi.mock('../../../lib/telemetry/SDUITelemetry', () => ({
  sduiTelemetry: {
    recordEvent: vi.fn(),
  },
  TelemetryEventType: {
    CIRCUIT_BREAKER_TRIPPED: 'CIRCUIT_BREAKER_TRIPPED',
    RETRY_SUCCESS: 'RETRY_SUCCESS',
    RETRY_FAILED: 'RETRY_FAILED',
  },
}));

vi.mock('../../../lib/logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RetryService', () => {
  beforeEach(() => {
    // Reset all circuit breakers before each test
    RetryService.resetAllCircuitBreakers();

    // Mock sleep to resolve immediately to avoid slow tests
    // Using any to access private method
    vi.spyOn(RetryService as any, 'sleep').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('executeWithRetry', () => {
    it('should return result and not retry on successful execution', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const result = await RetryService.executeWithRetry(fn, { maxAttempts: 3 });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toEqual({
        success: true,
        result: 'success',
        attempts: 1,
        totalDelay: 0,
      });
    });

    it('should retry up to maxAttempts on failure and return error', async () => {
      const error = new Error('NetworkError'); // A transient error according to defaults
      const fn = vi.fn().mockRejectedValue(error);

      const result = await RetryService.executeWithRetry(fn, {
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 100,
        jitter: false,
      });

      expect(fn).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBeGreaterThan(0);
    });

    it('should return result on successful execution after some retries', async () => {
      const error = new Error('Some error');
      error.name = 'FetchError'; // Make it retryable
      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await RetryService.executeWithRetry(fn, {
        maxAttempts: 5,
        baseDelay: 10,
        jitter: false,
      });

      expect(fn).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        success: true,
        result: 'success',
        attempts: 3,
        totalDelay: 30, // 10 + 20
      });
    });

    it('should not retry if the error is non-retryable and immediately return error', async () => {
      const error = new Error('PermanentError');
      const fn = vi.fn().mockRejectedValue(error);

      const retryCondition = (err: unknown) => false; // Never retry

      const result = await RetryService.executeWithRetry(fn, {
        maxAttempts: 3,
        retryCondition,
      });

      expect(fn).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
    });

    it('should trip circuit breaker if failure threshold is reached', async () => {
      const error = new Error('PermanentError');
      const fn = vi.fn().mockRejectedValue(error);
      const retryCondition = () => false; // Fail fast

      const context = { serviceId: 'test-service' };

      // Trip the circuit breaker
      for (let i = 0; i < 5; i++) {
        await RetryService.executeWithRetry(fn, {
          maxAttempts: 1,
          retryCondition,
          circuitBreakerThreshold: 5,
          context,
        });
      }

      // 6th call should hit the tripped circuit breaker
      const newFn = vi.fn().mockResolvedValue('success');
      const result = await RetryService.executeWithRetry(newFn, {
        context,
        circuitBreakerTimeout: 60000,
      });

      expect(newFn).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.circuitBreakerTripped).toBe(true);
      expect((result.error as Error).message).toBe('Circuit breaker is tripped');
    });

    it('should verify backoff behavior', async () => {
      const error = new Error('NetworkError');
      const fn = vi.fn().mockRejectedValue(error);

      const onRetry = vi.fn();

      // Disable jitter for deterministic tests
      await RetryService.executeWithRetry(fn, {
        maxAttempts: 4,
        baseDelay: 10,
        backoffMultiplier: 2,
        maxDelay: 50,
        jitter: false,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(3);

      // Delay calculations:
      // Attempt 1 fails -> delay = baseDelay * (multiplier ^ (1 - 1)) = 10 * 1 = 10
      // Attempt 2 fails -> delay = baseDelay * (multiplier ^ (2 - 1)) = 10 * 2 = 20
      // Attempt 3 fails -> delay = baseDelay * (multiplier ^ (3 - 1)) = 10 * 4 = 40

      expect(onRetry).toHaveBeenNthCalledWith(1, 1, error, 10);
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, error, 20);
      expect(onRetry).toHaveBeenNthCalledWith(3, 3, error, 40);
    });
  });

  describe('executeParallelWithRetry', () => {
    it('should return results of multiple successful operations', async () => {
      const op1 = { fn: vi.fn().mockResolvedValue(1) };
      const op2 = { fn: vi.fn().mockResolvedValue(2) };

      const results = await RetryService.executeParallelWithRetry([op1, op2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ success: true, result: 1, attempts: 1, totalDelay: 0 });
      expect(results[1]).toEqual({ success: true, result: 2, attempts: 1, totalDelay: 0 });
    });

    it('should return mixed results for successful and failed operations', async () => {
      const op1 = { fn: vi.fn().mockResolvedValue('success') };
      const error = new Error('Fail');
      // Using a custom retry condition that never retries so it fails fast
      const op2 = {
        fn: vi.fn().mockRejectedValue(error),
        options: { maxAttempts: 1, retryCondition: () => false }
      };

      const results = await RetryService.executeParallelWithRetry([op1, op2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ success: true, result: 'success', attempts: 1, totalDelay: 0 });
      expect(results[1]).toMatchObject({ success: false, error, attempts: 1, totalDelay: 0 });
    });
  });

  describe('createRetryableFunction', () => {
    it('should wrap a function correctly and succeed', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const retryableFn = RetryService.createRetryableFunction(fn);

      const result = await retryableFn('arg1', 'arg2');

      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(result).toBe('success');
    });

    it('should wrap a function correctly and throw after retries', async () => {
      const error = new Error('NetworkError');
      const fn = vi.fn().mockRejectedValue(error);
      const retryableFn = RetryService.createRetryableFunction(fn, { maxAttempts: 2, jitter: false, baseDelay: 1 });

      await expect(retryableFn()).rejects.toThrow(error);
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});
