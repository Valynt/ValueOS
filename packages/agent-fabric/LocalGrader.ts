// LocalGrader mock for deterministic semantic evaluation
export class LocalGrader {
  async evaluate(output: any, expectedGoal: any): Promise<number> {
    // Simulate semantic grading (0-1)
    if (output && output.goalAchieved) return 0.92;
    return 0.5;
  }
}
