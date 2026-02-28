import { describe, expect, it } from 'vitest';

import { LocalGrader } from '../../packages/agent-fabric/LocalGrader';
import { runAgentWithBudget } from '../../packages/agent-fabric/runAgentWithBudget';

// Simulated golden path trace
const goldenTrace = {
  input: 'User wants to optimize workflow',
  expectedGoal: { goal: 'Optimize workflow' },
  output: { result: 'Workflow optimized', goalAchieved: true },
  metadata: { costInMicros: 800000, latencyMs: 1100, correctness: 0.95, budgetPercent: '80%' },
};

describe('Golden Path Replay', () => {
  it('should match golden path output and efficiency', async () => {
    // In real use, sanitize and load trace from prod logs
    const { output, metadata } = await runAgentWithBudget('80%');
    // Output match
    expect(output.goalAchieved).toBe(goldenTrace.output.goalAchieved);
    // Semantic grade
    const grader = new LocalGrader();
    const score = await grader.evaluate(output, goldenTrace.expectedGoal);
    expect(score).toBeGreaterThan(0.9);
    // Cost check
    expect(metadata.costInMicros).toBeLessThanOrEqual(goldenTrace.metadata.costInMicros * 1.1); // Allow 10% drift
  });
});
