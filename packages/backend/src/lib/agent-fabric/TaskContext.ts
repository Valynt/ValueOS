/**
 * Task Context
 * 
 * Context object passed through agent task execution pipeline
 */

export interface TaskContext {
  task_id: string;
  workspace_id: string;
  organization_id: string;
  user_id: string;
  lifecycle_stage?: string;
  parent_task_id?: string;
  correlation_id: string;
  input: Record<string, any>;
  state: TaskState;
  metadata: TaskMetadata;
}

export interface TaskState {
  status: TaskStatus;
  progress: number;
  current_step?: string;
  completed_steps: string[];
  errors: TaskError[];
}

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskError {
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

export interface TaskMetadata {
  started_at: string;
  updated_at: string;
  completed_at?: string;
  retry_count: number;
  timeout_seconds: number;
  priority: 'low' | 'normal' | 'high';
}

export function createTaskContext(params: {
  task_id: string;
  workspace_id: string;
  organization_id: string;
  user_id: string;
  input: Record<string, any>;
  lifecycle_stage?: string;
  correlation_id?: string;
}): TaskContext {
  return {
    ...params,
    correlation_id: params.correlation_id || `corr_${Date.now()}`,
    state: {
      status: 'pending',
      progress: 0,
      completed_steps: [],
      errors: [],
    },
    metadata: {
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      retry_count: 0,
      timeout_seconds: 300,
      priority: 'normal',
    },
  };
}
