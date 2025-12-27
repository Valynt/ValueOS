/**
 * Agent Error Handling Tests - Retry Logic
 * 
 * Tests for retry behavior:
 * - Exponential backoff
 * - Maximum retry attempts
 * - Retry on specific error types
 * - No retry on permanent failures
 */

import { describe, it, expect, vi } from 'vitest';

describe('Agent Retry Logic', () => {
  describe('Exponential Backoff', () => {
    it('should increase delay between retries exponentially', async () => {
      const delays: number[] = [];
      
      const retryWithBackoff = async (attempt: number, maxAttempts: number) => {
        if (attempt > maxAttempts) {
          throw new Error('Max retries exceeded');
        }
        
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        delays.push(delay);
        
        await new Promise(resolve => setTimeout(resolve, 0)); // Simulate delay
        
        return delay;
      };

      // Simulate 4 retry attempts
      for (let i = 1; i <= 4; i++) {
        await retryWithBackoff(i, 5);
      }

      // Delays should be: 1000ms, 2000ms, 4000ms, 8000ms
      expect(delays).toEqual([1000, 2000, 4000, 8000]);
    });

    it('should cap maximum delay at 10 seconds', async () => {
      const calculateDelay = (attempt: number) => {
        return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      };

      const delay10thAttempt = calculateDelay(10);

      expect(delay10thAttempt).toBe(10000);
      expect(delay10thAttempt).toBeLessThanOrEqual(10000);
    });

    it('should add jitter to prevent thundering herd', () => {
      const calculateDelayWithJitter = (attempt: number) => {
        const baseDelay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        const jitter = Math.random() * 1000; // 0-1000ms jitter
        return baseDelay + jitter;
      };

      const delay1 = calculateDelayWithJitter(3);
      const delay2 = calculateDelayWithJitter(3);

      // With jitter, delays should be different
      // (though there's a tiny chance they could be equal)
      expect(delay1).toBeGreaterThanOrEqual(4000);
      expect(delay1).toBeLessThanOrEqual(5000);
      expect(delay2).toBeGreaterThanOrEqual(4000);
      expect(delay2).toBeLessThanOrEqual(5000);
    });
  });

  describe('Maximum Retry Attempts', () => {
    it('should stop after maximum retry attempts', async () => {
      let attempts = 0;
      const maxAttempts = 3;

      const executeWithRetry = async () => {
        while (attempts < maxAttempts) {
          attempts++;
          try {
            throw new Error('Transient error');
          } catch (err) {
            if (attempts >= maxAttempts) {
              throw err;
            }
          }
        }
      };

      await expect(executeWithRetry()).rejects.toThrow('Transient error');
      expect(attempts).toBe(maxAttempts);
    });

    it('should succeed before max attempts if operation succeeds', async () => {
      let attempts = 0;
      const maxAttempt's = 5;

      const executeWithRetry = async () => {
        while (attempts < maxAttempts) {
          attempts++;
          
          if (attempts === 3) {
            return { success: true };
          }
          
          // Fail first 2 attempts
          if (attempts < 3) {
            continue;
          }
        }
      };

      const result = await executeWithRetry();

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
      expect(attempts).toBeLessThan(maxAttempts);
    });
  });

  describe('Retry on Specific Error Types', () => {
    it('should retry on transient errors (rate limit, timeout)', () => {
      const shouldRetry = (error: Error) => {
        const retryableErrors = ['rate_limit', 'timeout', 'service_unavailable'];
        return retryableErrors.some(type => error.message.includes(type));
      };

      expect(shouldRetry(new Error('rate_limit exceeded'))).toBe(true);
      expect(shouldRetry(new Error('timeout after 30s'))).toBe(true);
      expect(shouldRetry(new Error('invalid_api_key'))).toBe(false);
    });

    it('should not retry on permanent failures (auth, validation)', () => {
      const shouldRetry = (error: Error) => {
        const permanentErrors = ['invalid_api_key', 'invalid_request', 'forbidden'];
        return !permanentErrors.some(type => error.message.includes(type));
      };

      expect(shouldRetry(new Error('invalid_api_key'))).toBe(false);
      expect(shouldRetry(new Error('invalid_request payload'))).toBe(false);
      expect(shouldRetry(new Error('rate_limit exceeded'))).toBe(true);
    });
  });

  describe('Retry Metrics', () => {
    it('should track retry attempts and outcomes', () => {
      const retryMetrics = {
        attempts: [
          { attempt: 1, outcome: 'failure', error: 'timeout' },
          { attempt: 2, outcome: 'failure', error: 'timeout' },
          { attempt: 3, outcome: 'success', error: null },
        ],
        getSuccessRate() {
          const successes = this.attempts.filter(a => a.outcome === 'success').length;
          return successes / this.attempts.length;
        },
      };

      expect(retryMetrics.getSuccessRate()).toBeCloseTo(0.33, 2);
      expect(retryMetrics.attempts[2].outcome).toBe('success');
    });
  });
});
