import { describe, expect, it } from 'vitest';

import { LocalGrader } from '../packages/agent-fabric/LocalGrader';
import { runAgentWithBudget } from '../packages/agent-fabric/runAgentWithBudget';

const PRESET_BUDGET_THRESHOLD = 900000; // Example threshold

describe('Cost-Aware Agent Tests', () => {
  it('should optimize cost without losing intent', async () => {
    const { output, metadata } = await runAgentWithBudget('85%');
    // 1. Structural check
    expect(output).toBeDefined();
    // 2. Semantic check (The "Grader")
    const grader = new LocalGrader();
    const score = await grader.evaluate(output, { goal: 'Simulated Goal' });
    expect(score).toBeGreaterThan(0.85);
    // 3. Cost check
    expect(metadata.costInMicros).toBeLessThan(PRESET_BUDGET_THRESHOLD);
  });
});
