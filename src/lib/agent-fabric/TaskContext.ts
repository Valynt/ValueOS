export interface TaskContext {
  sessionId?: string;
  organizationId?: string;
  userId?: string;
  agentId?: string;
  estimatedPromptTokens?: number;
  estimatedCompletionTokens?: number;
  task_type?: string;
}

export default TaskContext;
