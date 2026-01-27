/**
 * Execution Type Definitions
 * 
 * Types for workflow execution requests, task execution,
 * and execution orchestration.
 */

// ============================================================================
// Execution Request
// ============================================================================

export interface ExecutionRequest {
  id?: string;
  type: ExecutionType;
  workflow_id?: string;
  agent_id?: string;
  context: ExecutionContext;
  input: Record<string, any>;
  options?: ExecutionOptions;
  metadata?: Record<string, any>;
}

export type ExecutionType =
  | 'workflow'
  | 'agent'
  | 'task'
  | 'pipeline'
  | 'batch';

export interface ExecutionContext {
  workspace_id: string;
  organization_id: string;
  user_id: string;
  lifecycle_stage?: string;
  parent_execution_id?: string;
  correlation_id?: string;
}

export interface ExecutionOptions {
  timeout_seconds?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  enable_streaming?: boolean;
  callback_url?: string;
  idempotency_key?: string;
  priority?: ExecutionPriority;
  async_mode?: boolean;
}

export type ExecutionPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Execution Response
// ============================================================================

export interface ExecutionResponse {
  execution_id: string;
  status: ExecutionStatus;
  result?: Record<string, any>;
  error?: ExecutionError;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface ExecutionError {
  code: string;
  message: string;
  details?: Record<string, any>;
  recoverable: boolean;
}

export interface ExecutionMetadata {
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  retry_count?: number;
  resource_usage?: ResourceUsage;
}

export interface ResourceUsage {
  cpu_ms?: number;
  memory_mb?: number;
  network_kb?: number;
  tokens_used?: number;
  cost_usd?: number;
}

// ============================================================================
// Task Execution
// ============================================================================

export interface TaskExecution {
  task_id: string;
  execution_id: string;
  workflow_id?: string;
  status: ExecutionStatus;
  input: Record<string, any>;
  output?: Record<string, any>;
  error?: ExecutionError;
  started_at: string;
  completed_at?: string;
}

// ============================================================================
// Execution Normalization
// ============================================================================

/**
 * Normalize execution request to ensure all required fields are present
 */
export function normalizeExecutionRequest(
  request: Partial<ExecutionRequest>
): ExecutionRequest {
  return {
    id: request.id || generateExecutionId(),
    type: request.type || 'workflow',
    workflow_id: request.workflow_id,
    agent_id: request.agent_id,
    context: {
      workspace_id: request.context?.workspace_id || '',
      organization_id: request.context?.organization_id || '',
      user_id: request.context?.user_id || '',
      lifecycle_stage: request.context?.lifecycle_stage,
      parent_execution_id: request.context?.parent_execution_id,
      correlation_id: request.context?.correlation_id || generateCorrelationId(),
    },
    input: request.input || {},
    options: {
      timeout_seconds: request.options?.timeout_seconds || 300,
      max_retries: request.options?.max_retries || 3,
      retry_delay_ms: request.options?.retry_delay_ms || 1000,
      enable_streaming: request.options?.enable_streaming || false,
      priority: request.options?.priority || 'normal',
      async_mode: request.options?.async_mode || false,
      ...request.options,
    },
    metadata: request.metadata || {},
  };
}

function generateExecutionId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Batch Execution
// ============================================================================

export interface BatchExecutionRequest {
  batch_id?: string;
  requests: ExecutionRequest[];
  options?: BatchExecutionOptions;
}

export interface BatchExecutionOptions {
  parallel?: boolean;
  max_concurrency?: number;
  fail_fast?: boolean;
  callback_url?: string;
}

export interface BatchExecutionResponse {
  batch_id: string;
  total_requests: number;
  completed: number;
  failed: number;
  pending: number;
  results: ExecutionResponse[];
}

// ============================================================================
// Pipeline Execution
// ============================================================================

export interface PipelineExecution {
  pipeline_id: string;
  stages: PipelineStage[];
  status: ExecutionStatus;
  current_stage_index: number;
  started_at: string;
  completed_at?: string;
}

export interface PipelineStage {
  stage_id: string;
  name: string;
  execution_request: ExecutionRequest;
  depends_on?: string[];
  status: ExecutionStatus;
  result?: Record<string, any>;
}
