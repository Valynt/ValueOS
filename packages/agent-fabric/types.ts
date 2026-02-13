export interface AgentMetadata {
  costInMicros: number;
  latencyMs: number;
  correctness: number; // 0-1
  budgetPercent: string;
}

export interface AgentOutput {
  result: string;
  goalAchieved: boolean;
}
