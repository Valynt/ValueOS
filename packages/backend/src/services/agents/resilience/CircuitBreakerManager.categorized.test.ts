import { describe, expect, it, beforeEach } from 'vitest';
import {
  CategorizedCircuitBreakerManager,
  getCategorizedCircuitBreakerManager,
  resetCategorizedCircuitBreakerManager,
  CIRCUIT_BREAKER_CATEGORIES,
} from './CircuitBreakerManager.categorized.js';
import { CircuitBreaker } from '../../../lib/resilience/CircuitBreaker.js';

describe('CategorizedCircuitBreakerManager', () => {
  beforeEach(() => {
    resetCategorizedCircuitBreakerManager();
  });

  describe('Singleton Accessors', () => {
    it('getCategorizedCircuitBreakerManager returns the same instance', () => {
      const instance1 = getCategorizedCircuitBreakerManager();
      const instance2 = getCategorizedCircuitBreakerManager();

      expect(instance1).toBeInstanceOf(CategorizedCircuitBreakerManager);
      expect(instance1).toBe(instance2);
    });

    it('resetCategorizedCircuitBreakerManager clears the instance', () => {
      const instance1 = getCategorizedCircuitBreakerManager();
      resetCategorizedCircuitBreakerManager();
      const instance2 = getCategorizedCircuitBreakerManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('CategorizedCircuitBreakerManager instance methods', () => {
    let manager: CategorizedCircuitBreakerManager;

    beforeEach(() => {
      manager = new CategorizedCircuitBreakerManager();
    });

    it('getBreaker creates and returns a new CircuitBreaker', () => {
      const breaker = manager.getBreaker('test-breaker', CIRCUIT_BREAKER_CATEGORIES.DATABASE);
      expect(breaker).toBeInstanceOf(CircuitBreaker);

      const breakerAgain = manager.getBreaker('test-breaker', CIRCUIT_BREAKER_CATEGORIES.DATABASE);
      expect(breaker).toBe(breakerAgain); // Should return same instance
    });

    it('execute runs a function successfully', async () => {
      const result = await manager.execute('test-exec', async () => 'success');
      expect(result).toBe('success');
    });

    it('execute throws on failure and updates breaker state', async () => {
      await expect(
        manager.execute('test-exec-fail', async () => { throw new Error('fail'); }, CIRCUIT_BREAKER_CATEGORIES.LLM)
      ).rejects.toThrow('fail');

      const breaker = manager.getBreaker('test-exec-fail');
      expect(breaker.getFailureCount()).toBe(1);
    });

    it('executeWithCategory acts same as execute', async () => {
       const result = await manager.executeWithCategory('test-cat', async () => 'success', CIRCUIT_BREAKER_CATEGORIES.CACHE);
       expect(result).toBe('success');
    });

    it('getAllCategoryStats groups breakers by prefix', async () => {
       manager.getBreaker('database:read', CIRCUIT_BREAKER_CATEGORIES.DATABASE);
       manager.getBreaker('database:write', CIRCUIT_BREAKER_CATEGORIES.DATABASE);
       manager.getBreaker('llm:generate', CIRCUIT_BREAKER_CATEGORIES.LLM);
       manager.getBreaker('other', undefined); // No colon

       // Force open on one
       const dbRead = manager.getBreaker('database:read');
       for(let i=0; i<5; i++) {
         try { await dbRead.execute(async () => { throw new Error('fail')}); } catch {}
       }
       expect(dbRead.getState()).toBe('open');

       const stats = manager.getAllCategoryStats();

       expect(stats).toEqual({
         'database': { total: 2, open: 1, closed: 1 },
         'llm': { total: 1, open: 0, closed: 1 },
         'other': { total: 1, open: 0, closed: 1 },
       });
    });

    it('reset and resetAll clears breaker states', async () => {
       const breaker = manager.getBreaker('test-reset', CIRCUIT_BREAKER_CATEGORIES.DATABASE);
       for(let i=0; i<5; i++) {
         try { await breaker.execute(async () => { throw new Error('fail')}); } catch {}
       }
       expect(breaker.getState()).toBe('open');

       manager.reset();
       expect(breaker.getState()).toBe('closed');

       // test resetAll
       for(let i=0; i<5; i++) {
         try { await breaker.execute(async () => { throw new Error('fail')}); } catch {}
       }
       expect(breaker.getState()).toBe('open');

       manager.resetAll();
       expect(breaker.getState()).toBe('closed');
    });
  });
});
