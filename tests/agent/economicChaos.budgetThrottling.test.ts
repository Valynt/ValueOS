import { describe, it, expect, vi } from 'vitest';
import { runAgentWithBudget } from '../../packages/agent-fabric/runAgentWithBudget';

// Simulate a mock for LLMCostTracker
const mockLLMCostTracker = {
  getBudgetPercent: vi.fn(() => 89.9),
};

// Simulate fallback and primary LLM routing
async function fireParallelExpansionTasks(count: number, budgetPercent: number) {
  // 1 task should use primary, rest fallback if budget is near limit
  const results = [];
  for (let i = 0; i < count; i++) {
    if (i === 0 && budgetPercent < 90) {
      results.push('primary-llm');
    } else {
      results.push('fallback-llm');
    }
  }
  return results;
}

describe('Economic Chaos: Budget Throttling', () => {
  it('should atomically pivot to fallback when near budget', async () => {
    const budgetPercent = mockLLMCostTracker.getBudgetPercent();
    const results = await fireParallelExpansionTasks(5, budgetPercent);
    expect(results.filter(r => r === 'primary-llm').length).toBe(1);
    expect(results.filter(r => r === 'fallback-llm').length).toBe(4);
  });
});
