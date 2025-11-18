export type WorkflowStatus =
  | 'initiated'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

export type StageStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'skipped';

export type LifecycleStage =
  | 'opportunity'
  | 'target'
  | 'realization'
  | 'expansion'
  | 'integrity';

export interface RetryConfig {
  max_attempts: number;
  initial_delay_ms: number;
  max_delay_ms: number;
  multiplier: number;
  jitter: boolean;
}

export interface WorkflowStage {
  id: string;
  name: string;
  agent_type: LifecycleStage;
  required_capabilities?: string[];
  timeout_seconds: number;
  retry_config: RetryConfig;
  compensation_handler?: string;
}

export interface WorkflowTransition {
  from_stage: string;
  to_stage: string;
  condition?: string;
}

export interface WorkflowDAG {
  id: string;
  name: string;
  description: string;
  version: number;
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
  initial_stage: string;
  final_stages: string[];
  created_at: string;
  updated_at: string;
}

export interface CircuitBreakerState {
  failure_count: number;
  last_failure_time: string | null;
  state: 'closed' | 'open' | 'half_open';
  threshold: number;
  timeout_seconds: number;
}

export interface WorkflowExecution {
  id: string;
  workflow_definition_id: string;
  workflow_version?: number;
  status: WorkflowStatus;
  current_stage: string | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  context: Record<string, any>;
  audit_context?: Record<string, any>;
  circuit_breaker_state?: Record<string, any>;
  created_by: string;
}

export interface WorkflowExecutionLog {
  id: string;
  execution_id: string;
  stage_id: string;
  status: StageStatus;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  attempt_number: number;
  error_message: string | null;
  input_data: Record<string, any>;
  output_data: Record<string, any> | null;
  retry_policy?: RetryConfig;
}

export interface WorkflowEvent {
  id: string;
  execution_id: string;
  event_type: 'stage_started' | 'stage_completed' | 'stage_failed' | 'stage_retrying' | 'workflow_completed' | 'workflow_failed' | 'workflow_rolled_back';
  stage_id: string | null;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface WorkflowAuditLog {
  id: string;
  execution_id: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface CompensationContext {
  execution_id: string;
  stage_id: string;
  artifacts_created: string[];
  state_changes: Record<string, any>;
}
