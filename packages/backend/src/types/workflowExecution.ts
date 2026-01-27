/**
 * Workflow Execution Types
 */

export interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  workspace_id: string;
  organization_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  context: Record<string, any>;
  result?: Record<string, any>;
}
