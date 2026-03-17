/**
 * Orchestration types - stub declaration.
 * TODO: Replace with full implementation.
 */
export interface DAGNode {
  id: string;
  type: string;
  dependencies: string[];
  metadata?: Record<string, unknown>;
}

export interface WorkflowDAG {
  id: string;
  name: string;
  nodes: DAGNode[];
  edges: Array<{ from: string; to: string }>;
}

export interface OrchestrationConfig {
  maxRetries: number;
  timeoutMs: number;
  concurrency: number;
}
