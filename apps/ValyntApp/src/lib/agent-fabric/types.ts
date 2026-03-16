/**
 * Agent Fabric types - stub declaration.
 * TODO: Replace with full implementation.
 */
export interface AgentConfig {
  name: string;
  version: string;
  lifecycleStage: string;
}

export interface AgentOutput {
  result: unknown;
  confidence: number;
  reasoning: string;
}

export interface SafetyLimits {
  maxExecutionTimeMs: number;
  maxRecursionDepth: number;
  maxCostPerSession: number;
}
