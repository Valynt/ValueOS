/**
 * Workflow Type Definitions
 *
 * Centralized type definitions for workflow orchestration, lifecycle stages,
 * DAG execution, compensation, and retry logic.
 */

// ============================================================================
// Lifecycle Stages
// ============================================================================

// Canonical LifecycleStage is defined in packages/shared/src/domain/Opportunity.ts.
// Re-exported here for backward compatibility. ADR-0010.
export type { LifecycleStage } from '@valueos/shared';

export type WorkflowStageType = "opportunity" | "target" | "realization" | "expansion" | "integrity";

export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "paused" | "error" | "in_progress" | "initiated" | "rolled_back" | "waiting_approval";

// ============================================================================
// Retry Configuration
// ============================================================================

export interface RetryConfig {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  multiplier: number;
  jitter: boolean;
}

// ============================================================================
// Workflow DAG Structure
// ============================================================================

export interface WorkflowStage {
  id: string;
  name: string;
  description?: string;
  agent_type: WorkflowStageType;
  timeout_seconds: number;
  retry_config?: RetryConfig;
  compensation_handler?: string;
  required_capabilities?: string[];
  dependencies?: string[];
  parallel?: boolean;
  transitions?: WorkflowTransition[];
}

export interface WorkflowTransition {
  from?: string;
  to?: string;
  from_stage?: string;
  to_stage?: string;
  condition?: string;
  priority?: number;
}

export interface WorkflowDAG {
  id: string;
  name: string;
  description: string;
  version?: string | number;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  entry_stage?: string;
  // Aliases for backward compatibility
  initial_stage?: string;
  final_stages?: string[];
  exit_stages?: string[];
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Workflow Execution
// ============================================================================

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

export type WorkflowExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled_back"
  | "compensating";

export interface ExecutedStep {
  stage_id: string;
  stage_type: WorkflowStageType;
  compensator?: string;
  status: "completed" | "failed";
  started_at: string;
  completed_at?: string;
}

// ============================================================================
// Compensation & Rollback
// ============================================================================

export interface CompensationContext {
  execution_id: string;
  stage_id: string;
  artifacts_created: string[];
  state_changes: Record<string, unknown>;
}

export type CompensationPolicy = "halt_on_error" | "continue_on_error" | "skip_compensation";

export interface RollbackState {
  status: "idle" | "in_progress" | "completed" | "failed";
  completed_steps: string[];
  failed_stage?: string;
}

// ============================================================================
// Workflow Validation
// ============================================================================

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// Workflow Events
// ============================================================================

export interface WorkflowEvent {
  id: string;
  execution_id: string;
  event_type: WorkflowEventType;
  stage_id?: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type WorkflowEventType =
  | "execution_started"
  | "stage_started"
  | "stage_completed"
  | "stage_failed"
  | "execution_completed"
  | "execution_failed"
  | "compensation_started"
  | "compensation_completed"
  | "compensation_failed";

// ============================================================================
// Workflow Progress
// ============================================================================

export interface WorkflowProgress {
  execution_id: string;
  workflow_id: string;
  current_stage: string;
  completed_stages: string[];
  total_stages: number;
  progress_percentage: number;
  percentComplete?: number;
  status?: string;
  estimated_completion?: string;
}
