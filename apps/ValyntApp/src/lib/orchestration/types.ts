/**
 * Orchestration types — aligned with packages/backend/src/types/workflow.ts.
 *
 * Frontend-only subset for rendering workflow state and DAG visualisations.
 */

import type { LifecycleStage } from "../agent-fabric/types";

export type WorkflowStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "degraded"
  | "cancelled"
  | "paused"
  | "error"
  | "in_progress"
  | "initiated"
  | "rolled_back"
  | "waiting_approval";

export interface RetryConfig {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  multiplier: number;
  jitter: boolean;
}

export interface WorkflowTransition {
  from?: string;
  to?: string;
  from_stage?: string;
  to_stage?: string;
  condition?: string;
  priority?: number;
}

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  agent_type: LifecycleStage;
  timeout_seconds: number;
  retry_config?: RetryConfig;
  compensation_handler?: string;
  required_capabilities?: string[];
  dependencies?: string[];
  parallel?: boolean;
  transitions?: WorkflowTransition[];
}

export interface WorkflowDAG {
  id: string;
  name: string;
  description: string;
  version?: string | number;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  entry_stage?: string;
  initial_stage?: string;
  final_stages?: string[];
  exit_stages?: string[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export type WorkflowExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled_back"
  | "compensating";

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  workflow_definition_id?: string;
  status: WorkflowExecutionStatus;
  current_stage_id?: string;
  context: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
  updated_at: string;
}

/** @deprecated Use WorkflowStage instead */
export type DAGNode = WorkflowStage;

/** Alias for WorkflowDAG — use WorkflowDAG for new code. */
export type DAGDefinitionSpec = WorkflowDAG;

export interface OrchestrationConfig {
  maxConcurrency: number;
  timeoutMs: number;
  retryConfig?: RetryConfig;
}
