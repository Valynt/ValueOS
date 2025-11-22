/**
 * Circuit Breaker Tests
 * 
 * SAF-401: Verify agent safety controls work correctly
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AgentCircuitBreaker,
  SafetyError,
  withCircuitBreaker,
  trackLLMCall,
  trackRecursion,
  DEFAULT_SAFETY_LIMITS,
} from '../CircuitBreaker';

describe('AgentCircuitBreaker', () => {
  describe('Execution Time Limit', () => {
    it('should abort execution after maxExecutionTime', async () => {
      const breaker = new AgentCircuitBreaker({
        maxExecutionTime: 100, // 100ms
      });

      breaker.start();

      // Wait longer than the limit
      await expect(
        new Promise((resolve) => setTimeout(resolve, 200))
      ).rejects.toThrow();
    });

    it('should complete successfully within time limit', async () => {
      const breaker = new AgentCircuitBreaker({
        maxExecutionTime: 1000, // 1 second
      });

      breaker.start();
      
      // Quick operation
      await new Promise((resolve) => setTimeout(resolve, 50));
      
      const metrics = breaker.complete();
      expect(metrics.completed).toBe(true);
      expect(metrics.duration).toBeLessThan(1000);
    });
  });

  describe('LLM Call Limit', () => {
    it('should abort after maxLLMCalls', () => {
      const breaker = new AgentCircuitBreaker({
        maxLLMCalls: 3,
      });

      breaker.start();

      // Should succeed for first 3 calls
      expect(() => breaker.recordLLMCall()).not.toThrow();
      expect(() => breaker.recordLLMCall()).not.toThrow();
      expect(() => breaker.recordLLMCall()).not.toThrow();

      // Should fail on 4th call
      expect(() => breaker.recordLLMCall()).toThrow(SafetyError);
    });

    it('should track LLM call count correctly', () => {
      const breaker = new AgentCircuitBreaker();
      breaker.start();

      breaker.recordLLMCall();
      breaker.recordLLMCall();

      const metrics = breaker.getMetrics();
      expect(metrics.llmCallCount).toBe(2);
    });
  });

  describe('Recursion Depth Limit', () => {
    it('should abort after maxRecursionDepth', () => {
      const breaker = new AgentCircuitBreaker({
        maxRecursionDepth: 3,
      });

      breaker.start();

      // Should succeed for first 3 levels
      expect(() => breaker.enterRecursion()).not.toThrow();
      expect(() => breaker.enterRecursion()).not.toThrow();
      expect(() => breaker.enterRecursion()).not.toThrow();

      // Should fail on 4th level
      expect(() => breaker.enterRecursion()).toThrow(SafetyError);
    });

    it('should track recursion depth correctly', () => {
      const breaker = new AgentCircuitBreaker();
      breaker.start();

      breaker.enterRecursion();
      breaker.enterRecursion();
      expect(breaker.getMetrics().recursionDepth).toBe(2);

      breaker.exitRecursion();
      expect(breaker.getMetrics().recursionDepth).toBe(1);

      breaker.exitRecursion();
      expect(breaker.getMetrics().recursionDepth).toBe(0);
    });
  });

  describe('withCircuitBreaker', () => {
    it('should execute function successfully', async () => {
      const result = await withCircuitBreaker(async (breaker) => {
        breaker.recordLLMCall();
        return 'success';
      });

      expect(result.result).toBe('success');
      expect(result.metrics.completed).toBe(true);
      expect(result.metrics.llmCallCount).toBe(1);
    });

    it('should catch SafetyError', async () => {
      await expect(
        withCircuitBreaker(async (breaker) => {
          // Exceed LLM call limit
          for (let i = 0; i < 25; i++) {
            breaker.recordLLMCall();
          }
          return 'should not reach here';
        }, { maxLLMCalls: 20 })
      ).rejects.toThrow(SafetyError);
    });
  });

  describe('trackLLMCall', () => {
    it('should track LLM call and execute function', async () => {
      const breaker = new AgentCircuitBreaker();
      breaker.start();

      const result = await trackLLMCall(breaker, async () => {
        return 'llm response';
      });

      expect(result).toBe('llm response');
      expect(breaker.getMetrics().llmCallCount).toBe(1);
    });

    it('should abort if circuit breaker is triggered', async () => {
      const breaker = new AgentCircuitBreaker({ maxLLMCalls: 1 });
      breaker.start();

      // First call succeeds
      await trackLLMCall(breaker, async () => 'first');

      // Second call should fail
      await expect(
        trackLLMCall(breaker, async () => 'second')
      ).rejects.toThrow();
    });
  });

  describe('trackRecursion', () => {
    it('should track recursion depth', async () => {
      const breaker = new AgentCircuitBreaker();
      breaker.start();

      await trackRecursion(breaker, async () => {
        expect(breaker.getMetrics().recursionDepth).toBe(1);
        
        await trackRecursion(breaker, async () => {
          expect(breaker.getMetrics().recursionDepth).toBe(2);
        });
        
        expect(breaker.getMetrics().recursionDepth).toBe(1);
      });

      expect(breaker.getMetrics().recursionDepth).toBe(0);
    });

    it('should abort on excessive recursion', async () => {
      const breaker = new AgentCircuitBreaker({ maxRecursionDepth: 2 });
      breaker.start();

      await expect(
        trackRecursion(breaker, async () => {
          await trackRecursion(breaker, async () => {
            await trackRecursion(breaker, async () => {
              // Should not reach here
            });
          });
        })
      ).rejects.toThrow(SafetyError);
    });
  });

  describe('Default Limits', () => {
    it('should use production-safe defaults', () => {
      expect(DEFAULT_SAFETY_LIMITS.maxExecutionTime).toBe(30000); // 30s
      expect(DEFAULT_SAFETY_LIMITS.maxLLMCalls).toBe(20);
      expect(DEFAULT_SAFETY_LIMITS.maxRecursionDepth).toBe(5);
      expect(DEFAULT_SAFETY_LIMITS.maxMemoryBytes).toBe(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Metrics', () => {
    it('should track execution metrics', async () => {
      const result = await withCircuitBreaker(async (breaker) => {
        breaker.recordLLMCall();
        breaker.recordLLMCall();
        breaker.enterRecursion();
        breaker.exitRecursion();
        
        await new Promise((resolve) => setTimeout(resolve, 50));
        
        return 'done';
      });

      expect(result.metrics.llmCallCount).toBe(2);
      expect(result.metrics.recursionDepth).toBe(0);
      expect(result.metrics.duration).toBeGreaterThan(50);
      expect(result.metrics.completed).toBe(true);
      expect(result.metrics.limitViolations).toHaveLength(0);
    });
  });
});
