import type { AgentMetadata, AgentOutput } from './types';

/**
 * Simulates running an agent with a given budget percentage.
 * Returns output and metadata including cost, latency, and correctness.
 * In real tests, this would invoke the actual agent logic with mocks.
 */
export async function runAgentWithBudget(budgetPercent: string): Promise<{ output: AgentOutput; metadata: AgentMetadata }> {
  // Simulate output and metadata for demonstration
  return {
    output: { result: 'Simulated agent output', goalAchieved: true },
    metadata: {
      costInMicros: 850000, // Simulate cost
      latencyMs: 1200,      // Simulate latency
      correctness: 0.92,    // Simulate correctness
      budgetPercent,
    },
  };
}
