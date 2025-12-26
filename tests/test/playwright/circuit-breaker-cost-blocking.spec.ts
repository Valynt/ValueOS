/**
 * Critical Fix Validation: Cost Blocking Circuit Breaker
 * Tests that LLM calls are blocked when cost thresholds are exceeded
 */

import { expect, test } from '@playwright/test';
import { AgentCircuitBreaker, SafetyLimits } from '../../lib/agent-fabric/CircuitBreaker';
import { llmCostTracker } from '../../services/LLMCostTracker';

test.describe('Cost Blocking Circuit Breaker', () => {
  test('should abort execution when execution cost limit exceeded', async () => {
    // Arrange: Create circuit breaker with low cost limit
    const lowCostLimit: Partial<SafetyLimits> = {
      maxExecutionCost: 1.00, // $1.00 limit
      costCheckIntervalMs: 100, // Check frequently for test
    };

    const breaker = new AgentCircuitBreaker(lowCostLimit);
    breaker.start();

    // Act: Record costs that exceed the limit
    breaker.recordCost(0.60); // $0.60
    breaker.recordCost(0.50); // $1.10 total - exceeds $1.00 limit

    // Assert: Execution should be aborted
    expect(breaker.shouldAbort()).toBe(true);
  });

  test('should abort execution when hourly cost limit exceeded', async () => {
    // Arrange: Mock high hourly cost in cost tracker
    const originalGetHourlyCost = llmCostTracker.getHourlyCost;
    llmCostTracker.getHourlyCost = async () => 15.00; // Mock $15/hour (over $10 limit)

    const breaker = new AgentCircuitBreaker({
      maxHourlyCost: 10.00, // $10/hour limit
      costCheckIntervalMs: 100,
    });
    breaker.start();

    // Act: Wait for cost check interval
    await new Promise(resolve => setTimeout(resolve, 150));

    // Assert: Execution should be aborted due to hourly cost
    expect(breaker.shouldAbort()).toBe(true);

    // Cleanup
    llmCostTracker.getHourlyCost = originalGetHourlyCost;
  });

  test('should not abort execution when costs are within limits', async () => {
    // Arrange: Create circuit breaker with reasonable cost limits
    const breaker = new AgentCircuitBreaker({
      maxExecutionCost: 10.00, // $10.00 limit
      maxHourlyCost: 50.00, // $50/hour limit
    });
    breaker.start();

    // Act: Record costs within limits
    breaker.recordCost(2.50);
    breaker.recordCost(3.75);
    breaker.recordCost(1.25); // Total: $7.50

    // Assert: Execution should not be aborted
    expect(breaker.shouldAbort()).toBe(false);

    // Complete execution
    const metrics = breaker.complete();
    expect(metrics.executionCost).toBe(7.50);
    expect(metrics.completed).toBe(true);
  });

  test('should handle cost check failures gracefully', async () => {
    // Arrange: Mock cost tracker to throw error
    const originalGetHourlyCost = llmCostTracker.getHourlyCost;
    llmCostTracker.getHourlyCost = async () => {
      throw new Error('Database connection failed');
    };

    const breaker = new AgentCircuitBreaker({
      maxHourlyCost: 10.00,
      costCheckIntervalMs: 100,
    });
    breaker.start();

    // Act: Wait for cost check interval
    await new Promise(resolve => setTimeout(resolve, 150));

    // Assert: Execution should not abort due to cost check failure (graceful degradation)
    expect(breaker.shouldAbort()).toBe(false);

    // Cleanup
    llmCostTracker.getHourlyCost = originalGetHourlyCost;
  });

  test('should integrate with LLM Gateway cost recording', async () => {
    // This test would require mocking the LLM Gateway
    // In a real scenario, this would test end-to-end cost blocking during agent execution

    test.skip('Integration test with LLM Gateway - requires mocking infrastructure');

    // Arrange: Set up agent with low cost limits
    // Act: Execute agent that makes LLM calls
    // Assert: Agent execution is aborted when cost limits exceeded
  });

  test('should record cost violations in metrics', async () => {
    // Arrange
    const breaker = new AgentCircuitBreaker({
      maxExecutionCost: 2.00,
      enableDetailedTracking: true,
    });
    breaker.start();

    // Act: Exceed cost limit
    breaker.recordCost(1.50);
    breaker.recordCost(1.00); // Total: $2.50 > $2.00 limit

    // Assert: Cost limit violation recorded
    const metrics = breaker.getMetrics();
    expect(metrics.limitViolations).toContain('maxExecutionCost');
    expect(metrics.executionCost).toBe(2.50);
  });
});
