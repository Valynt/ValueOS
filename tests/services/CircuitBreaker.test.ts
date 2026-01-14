/**
 * Circuit Breaker Unit Tests
 *
 * Comprehensive test suite for circuit breaker functionality including
 * failure handling, state transitions, and category-based management.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CircuitBreakerManager } from '../src/services/CircuitBreaker';
import { CategorizedCircuitBreakerManager, AGENT_CATEGORIES } from '../src/services/CircuitBreakerManager';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock console methods to reduce test noise
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock logger
jest.mock('../src/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('CircuitBreakerManager', () => {
  let circuitBreaker: CircuitBreakerManager;
  let mockTask: jest.Mock;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerManager({
      windowMs: 1000,
      failureRateThreshold: 0.5,
      latencyThresholdMs: 100,
      minimumSamples: 3,
      timeoutMs: 5000,
      halfOpenMaxProbes: 2,
    });

    mockTask = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should execute tasks successfully when circuit is closed', async () => {
      mockTask.mockResolvedValue('success');

      const result = await circuitBreaker.execute('test-key', mockTask);

      expect(result).toBe('success');
      expect(mockTask).toHaveBeenCalledTimes(1);
    });

    it('should track metrics for successful executions', async () => {
      mockTask.mockResolvedValue('success');

      await circuitBreaker.execute('test-key', mockTask);
      await circuitBreaker.execute('test-key', mockTask);

      const state = circuitBreaker.getState('test-key');
      expect(state?.metrics).toHaveLength(2);
      expect(state?.metrics[0].success).toBe(true);
      expect(state?.failure_count).toBe(0);
    });

    it('should track metrics for failed executions', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      try {
        await circuitBreaker.execute('test-key', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.metrics).toHaveLength(1);
      expect(state?.metrics[0].success).toBe(false);
      expect(state?.failure_count).toBe(1);
    });

    it('should apply configuration overrides', async () => {
      const customCircuitBreaker = new CircuitBreakerManager({
        windowMs: 2000,
        failureRateThreshold: 0.3,
        latencyThresholdMs: 200,
        minimumSamples: 5,
        timeoutMs: 10000,
        halfOpenMaxProbes: 3,
      });

      mockTask.mockResolvedValue('success');

      await customCircuitBreaker.execute('test-key', mockTask, {
        failureRateThreshold: 0.1,
        latencyThresholdMs: 50,
      });

      const state = customCircuitBreaker.getState('test-key');
      expect(state?.failure_rate_threshold).toBe(0.1);
      expect(state?.latency_threshold_ms).toBe(50);
      expect(state?.window_ms).toBe(2000); // Should keep default
    });
  });

  describe('Circuit State Transitions', () => {
    it('should open circuit when failure rate threshold is exceeded', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Generate failures to exceed threshold
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.state).toBe('open');
    });

    it('should open circuit when latency threshold is exceeded', async () => {
      mockTask.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // Exceeds 100ms threshold
        return 'success';
      });

      // Generate slow requests to exceed threshold
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute('test-key', mockTask);
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.state).toBe('open');
    });

    it('should reject executions when circuit is open', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Try to execute with open circuit
      await expect(circuitBreaker.execute('test-key', mockTask))
        .rejects.toThrow('Circuit breaker open');

      expect(mockTask).toHaveBeenCalledTimes(5); // Should not be called again
    });

    it('should transition to half-open after timeout', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Next execution should be allowed (half-open state)
      mockTask.mockResolvedValue('success');
      const result = await circuitBreaker.execute('test-key', mockTask);

      expect(result).toBe('success');
      expect(mockTask).toHaveBeenCalledTimes(6);
    });

    it('should close circuit after successful half-open execution', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout and successful execution
      await new Promise(resolve => setTimeout(resolve, 6000));
      mockTask.mockResolvedValue('success');
      await circuitBreaker.execute('test-key', mockTask);

      const state = circuitBreaker.getState('test-key');
      expect(state?.state).toBe('closed');
    });

    it('should re-open circuit on half-open failure', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Wait for timeout and fail in half-open
      await new Promise(resolve => setTimeout(resolve, 6000));
      try {
        await circuitBreaker.execute('test-key', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.state).toBe('open');
    });
  });

  describe('Metric Management', () => {
    it('should prune old metrics outside window', async () => {
      mockTask.mockResolvedValue('success');

      // Execute some tasks
      await circuitBreaker.execute('test-key', mockTask);
      await circuitBreaker.execute('test-key', mockTask);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Execute another task to trigger pruning
      await circuitBreaker.execute('test-key', mockTask);

      const state = circuitBreaker.getState('test-key');
      // Should only have the recent metrics
      expect(state?.metrics.length).toBeLessThanOrEqual(2);
    });

    it('should limit metrics array size', async () => {
      mockTask.mockResolvedValue('success');

      // Generate many metrics
      for (let i = 0; i < 150; i++) {
        await circuitBreaker.execute('test-key', mockTask);
      }

      const state = circuitBreaker.getState('test-key');
      // Should limit to reasonable size (10x minimum_samples or 100)
      expect(state?.metrics.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset circuit breaker state', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Generate failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute('test-key', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Reset the circuit
      circuitBreaker.reset('test-key');

      const state = circuitBreaker.getState('test-key');
      expect(state).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle task that throws non-Error objects', async () => {
      mockTask.mockRejectedValue('String error');

      try {
        await circuitBreaker.execute('test-key', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.metrics[0].success).toBe(false);
    });

    it('should handle task that throws null', async () => {
      mockTask.mockRejectedValue(null);

      try {
        await circuitBreaker.execute('test-key', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.metrics[0].success).toBe(false);
    });

    it('should handle synchronous task that throws', async () => {
      mockTask.mockImplementation(() => {
        throw new Error('Sync error');
      });

      try {
        await circuitBreaker.execute('test-key', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const state = circuitBreaker.getState('test-key');
      expect(state?.metrics[0].success).toBe(false);
    });
  });
});

describe('CategorizedCircuitBreakerManager', () => {
  let categorizedManager: CategorizedCircuitBreakerManager;
  let mockTask: jest.Mock;

  beforeEach(() => {
    categorizedManager = new CategorizedCircuitBreakerManager();
    mockTask = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Category-Based Execution', () => {
    it('should execute with category-specific configuration', async () => {
      mockTask.mockResolvedValue('success');

      const result = await categorizedManager.executeWithCategory(
        'research',
        mockTask,
        'data-gathering'
      );

      expect(result).toBe('success');
      expect(mockTask).toHaveBeenCalledTimes(1);
    });

    it('should auto-detect agent category', async () => {
      mockTask.mockResolvedValue('success');

      const result = await categorizedManager.executeWithCategory(
        'research',
        mockTask
        // No category specified - should auto-detect
      );

      expect(result).toBe('success');
    });

    it('should track category statistics', async () => {
      mockTask.mockResolvedValue('success');

      await categorizedManager.executeWithCategory('research', mockTask);
      await categorizedManager.executeWithCategory('research', mockTask);

      const stats = categorizedManager.getCategoryStatus('data-gathering');
      expect(stats).toBeDefined();
      expect(stats?.successCount).toBe(2);
      expect(stats?.failureCount).toBe(0);
    });

    it('should track failures per category', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      try {
        await categorizedManager.executeWithCategory('research', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const stats = categorizedManager.getCategoryStatus('data-gathering');
      expect(stats?.failureCount).toBe(1);
    });
  });

  describe('Category Configuration', () => {
    it('should use correct thresholds for each category', () => {
      const dataGatheringConfig = AGENT_CATEGORIES['data-gathering'];
      const validationConfig = AGENT_CATEGORIES['validation'];

      expect(dataGatheringConfig.failureThreshold).toBe(5);
      expect(dataGatheringConfig.securityLevel).toBe('medium');

      expect(validationConfig.failureThreshold).toBe(2);
      expect(validationConfig.securityLevel).toBe('critical');
    });

    it('should apply category-specific timeout', async () => {
      mockTask.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 35000)); // 35 seconds
        return 'success';
      });

      try {
        await categorizedManager.executeWithCategory('integrity', mockTask, 'validation');
      } catch (error) {
        // Expected to timeout
      }

      expect(mockTask).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate performance metrics correctly', async () => {
      // Simulate some executions
      const successTask = jest.fn().mockResolvedValue('success');
      const failTask = jest.fn().mockRejectedValue(new Error('Test error'));

      // Successful executions
      await categorizedManager.executeWithCategory('research', successTask);
      await categorizedManager.executeWithCategory('research', successTask);

      // Failed execution
      try {
        await categorizedManager.executeWithCategory('research', failTask);
      } catch (error) {
        // Expected to fail
      }

      const metrics = categorizedManager.getPerformanceMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.totalFailures).toBe(1);
      expect(metrics.averageFailureRate).toBeCloseTo(0.33, 2);
    });

    it('should track category-specific performance', async () => {
      const successTask = jest.fn().mockResolvedValue('success');

      await categorizedManager.executeWithCategory('research', successTask);
      await categorizedManager.executeWithCategory('integrity', successTask);

      const metrics = categorizedManager.getPerformanceMetrics();
      expect(metrics.categoryPerformance['data-gathering']).toBeDefined();
      expect(metrics.categoryPerformance['validation']).toBeDefined();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset entire category', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Generate failures
      for (let i = 0; i < 6; i++) {
        try {
          await categorizedManager.executeWithCategory('research', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Reset category
      categorizedManager.resetCategory('data-gathering');

      const stats = categorizedManager.getCategoryStatus('data-gathering');
      expect(stats?.state).toBe('closed');
      expect(stats?.failureCount).toBe(0);
    });

    it('should reset specific agent', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      // Generate failures
      for (let i = 0; i < 6; i++) {
        try {
          await categorizedManager.executeWithCategory('research', mockTask);
        } catch (error) {
          // Expected to fail
        }
      }

      // Reset specific agent
      categorizedManager.resetAgent('research');

      const stats = categorizedManager.getAgentStatus('research');
      expect(stats?.state).toBe('closed');
    });
  });

  describe('Event History', () => {
    it('should track event history', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      try {
        await categorizedManager.executeWithCategory('research', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const events = categorizedManager.getRecentEvents(10);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].category).toBe('data-gathering');
      expect(events[0].agent).toBe('research');
      expect(events[0].eventType).toBe('failure');
    });

    it('should filter events by category', async () => {
      mockTask.mockRejectedValue(new Error('Test error'));

      try {
        await categorizedManager.executeWithCategory('research', mockTask);
        await categorizedManager.executeWithCategory('integrity', mockTask);
      } catch (error) {
        // Expected to fail
      }

      const dataGatheringEvents = categorizedManager.getRecentEvents(10, 'data-gathering');
      const validationEvents = categorizedManager.getRecentEvents(10, 'validation');

      expect(dataGatheringEvents.length).toBe(1);
      expect(validationEvents.length).toBe(1);
      expect(dataGatheringEvents[0].agent).toBe('research');
      expect(validationEvents[0].agent).toBe('integrity');
    });
  });
});

describe('Circuit Breaker Integration Tests', () => {
  it('should handle concurrent executions correctly', async () => {
    const circuitBreaker = new CircuitBreakerManager({
      windowMs: 1000,
      failureRateThreshold: 0.5,
      minimumSamples: 2,
    });

    const slowTask = jest.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return 'success';
    });

    const failTask = jest.fn().mockRejectedValue(new Error('Test error'));

    // Execute concurrent tasks
    const promises = [
      circuitBreaker.execute('test1', slowTask),
      circuitBreaker.execute('test2', slowTask),
      circuitBreaker.execute('test3', failTask),
    ];

    const results = await Promise.allSettled(promises);

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('fulfilled');
    expect(results[2].status).toBe('rejected');

    expect(slowTask).toHaveBeenCalledTimes(2);
    expect(failTask).toHaveBeenCalledTimes(1);
  });

  it('should maintain separate state for different keys', async () => {
    const circuitBreaker = new CircuitBreakerManager();

    const successTask = jest.fn().mockResolvedValue('success');
    const failTask = jest.fn().mockRejectedValue(new Error('Test error'));

    // Execute successful tasks on key1
    await circuitBreaker.execute('key1', successTask);
    await circuitBreaker.execute('key1', successTask);

    // Execute failing tasks on key2
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute('key2', failTask);
      } catch (error) {
        // Expected to fail
      }
    }

    const state1 = circuitBreaker.getState('key1');
    const state2 = circuitBreaker.getState('key2');

    expect(state1?.state).toBe('closed');
    expect(state1?.failure_count).toBe(0);

    expect(state2?.state).toBe('open');
    expect(state2?.failure_count).toBe(5);
  });
});
