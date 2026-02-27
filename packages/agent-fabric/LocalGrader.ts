import { AgentOutput } from './types';

// LocalGrader mock for deterministic semantic evaluation
export class LocalGrader {
  async evaluate(output: Partial<AgentOutput> | null, expectedGoal: string): Promise<number> {
    // Simulate semantic grading (0-1)
    if (output && output.goalAchieved) return 0.92;
    return 0.5;
  }
}
