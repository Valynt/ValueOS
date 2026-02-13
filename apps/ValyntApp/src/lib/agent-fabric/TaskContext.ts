export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface TaskError {
  code: string;
  message: string;
  stack?: string;
}

export interface TaskMetadata {
  createdAt: string;
  updatedAt: string;
  duration?: number;
  retryCount?: number;
  [key: string]: unknown;
}

export interface TaskState {
  status: TaskStatus;
  progress?: number;
  error?: TaskError;
  result?: unknown;
}

export interface TaskContext {
  taskId: string;
  agentId: string;
  tenantId: string;
  state: TaskState;
  metadata: TaskMetadata;
}

export function createTaskContext(params: Partial<TaskContext> & { taskId: string; agentId: string; tenantId: string }): TaskContext {
  return {
    ...params,
    state: params.state ?? { status: "pending" },
    metadata: params.metadata ?? { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

export default TaskContext;
