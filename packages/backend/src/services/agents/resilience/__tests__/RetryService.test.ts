import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RetryService } from '../RetryService.js';

// Mock dependencies
vi.mock('../../../lib/telemetry/SDUITelemetry', () => ({
  sduiTelemetry: {
    recordEvent: vi.fn(),
  },
  TelemetryEventType: {
    RETRY_SUCCESS: 'RETRY_SUCCESS',
    RETRY_FAILED: 'RETRY_FAILED',
    CIRCUIT_BREAKER_TRIPPED: 'CIRCUIT_BREAKER_TRIPPED',
  },
}));

vi.mock('../../lib/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RetryService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    RetryService.resetAllCircuitBreakers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('executeWithRetry', () => {
    it('should succeed on first attempt without retries', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const promise = RetryService.executeWithRetry(fn, { context: { operation: 'test' } });
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(result.totalDelay).toBe(0);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error and eventually succeed', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success');

      const promise = RetryService.executeWithRetry(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        jitter: false,
      });

      // Advance timers for the two delays
      await vi.advanceTimersByTimeAsync(100); // Attempt 1 fails -> delay 100
      await vi.advanceTimersByTimeAsync(200); // Attempt 2 fails -> delay 200

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBe(300); // 100 + 200
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry on permanent error and fail immediately', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Invalid Input'));

      const result = await RetryService.executeWithRetry(fn, {
        maxAttempts: 3,
      });

      expect(result.success).toBe(false);
      expect(result.error).toEqual(new Error('Invalid Input'));
      expect(result.attempts).toBe(1); // Failed immediately
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after exhausting max attempts with transient errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      const promise = RetryService.executeWithRetry(fn, {
        maxAttempts: 3,
        baseDelay: 100,
        jitter: false,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.totalDelay).toBe(300);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should trip circuit breaker after threshold failures and prevent subsequent executions', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      // We see in the codebase `updateCircuitBreaker` uses a default threshold of 5,
      // it doesn't read `circuitBreakerThreshold` from the options object dynamically when updating,
      // but rather it relies on the second parameter `threshold` which isn't passed in RetryService.ts line 135.
      // Wait, let's look at line 135: `this.updateCircuitBreaker(circuitBreaker);`
      // It uses the default threshold of 5. So we must fail 5 times.

      const options = {
        maxAttempts: 1, // Fail fast
        circuitBreakerTimeout: 60000,
        context: { operation: 'cb-test' },
        retryCondition: () => true // Allow failure to register in circuit breaker since maxAttempts is 1 it will exit with failure
      };

      // Ensure circuit breakers are clean
      RetryService.resetAllCircuitBreakers();

      // Trip the default threshold of 5
      for(let i=0; i<5; i++) {
         await RetryService.executeWithRetry(fn, options);
      }

      // Verify circuit breaker tripped status
      const status = RetryService.getCircuitBreakerStatus();
      expect(status['cb-test'].isTripped).toBe(true);

      // Blocked attempt
      const fnBlocked = vi.fn().mockResolvedValue('success');
      const result = await RetryService.executeWithRetry(fnBlocked, options);

      expect(result.success).toBe(false);
      expect(result.circuitBreakerTripped).toBe(true);
      expect(result.attempts).toBe(0); // Didn't even try
      expect(fnBlocked).not.toHaveBeenCalled();

      // Advance timer past timeout
      await vi.advanceTimersByTimeAsync(60001);

      // Execution after timeout
      const resultAfterTimeout = await RetryService.executeWithRetry(fnBlocked, options);
      expect(resultAfterTimeout.success).toBe(true);
      expect(fnBlocked).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeParallelWithRetry', () => {
    it('should execute multiple operations in parallel and handle mixed results', async () => {
      const op1Fn = vi.fn().mockResolvedValue('success1');
      const op2Fn = vi.fn().mockRejectedValue(new Error('permanent failure'));

      const operations = [
        { fn: op1Fn },
        { fn: op2Fn, options: { maxAttempts: 1 } }
      ];

      const results = await RetryService.executeParallelWithRetry(operations);

      expect(results).toHaveLength(2);

      // op1 result
      expect(results[0].success).toBe(true);
      expect((results[0] as any).result).toBe('success1');

      // op2 result
      expect(results[1].success).toBe(false);
      expect((results[1] as any).error).toEqual(new Error('permanent failure'));
    });
  });

  describe('createRetryableFunction', () => {
    it('should wrap a function and retry appropriately', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('wrapped success');

      const wrappedFn = RetryService.createRetryableFunction(mockFn, {
        maxAttempts: 3,
        baseDelay: 100,
        jitter: false
      });

      const promise = wrappedFn('arg1', 'arg2');

      await vi.advanceTimersByTimeAsync(100);

      const result = await promise;

      expect(result).toBe('wrapped success');
      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should throw error if retries are exhausted', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('permanent failure'));

      const wrappedFn = RetryService.createRetryableFunction(mockFn, { maxAttempts: 1 });

      await expect(wrappedFn()).rejects.toThrow('permanent failure');
    });
  });

  describe('circuit breaker status management', () => {
    it('should return correct status', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));

      // Create failure to populate breaker
      await RetryService.executeWithRetry(fn, {
        maxAttempts: 1,
        retryCondition: () => false,
        context: { operation: 'status-test' }
      });

      const status = RetryService.getCircuitBreakerStatus();
      expect(Object.keys(status).length).toBe(1);

      const breakerKey = Object.keys(status)[0];
      expect(breakerKey).toBe('status-test');
      expect(status[breakerKey].failures).toBe(1);
      expect(status[breakerKey].isTripped).toBe(false);
    });

    it('should reset all breakers', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('timeout'));
      await RetryService.executeWithRetry(fn, {
        maxAttempts: 1,
        retryCondition: () => false,
        context: { operation: 'test1' }
      });

      expect(Object.keys(RetryService.getCircuitBreakerStatus()).length).toBe(1);

      RetryService.resetAllCircuitBreakers();

      expect(Object.keys(RetryService.getCircuitBreakerStatus()).length).toBe(0);
    });
  });
});
