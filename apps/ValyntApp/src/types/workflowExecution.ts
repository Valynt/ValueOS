/**
 * Workflow Execution Types
 */

export interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  workflowDefinitionId?: string;
  workspace_id: string;
  organization_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  context: Record<string, unknown>;
  result?: Record<string, unknown>;
  io?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  lifecycle?: Record<string, unknown>;
  persona?: string;
  industry?: string;
  fiscalQuarter?: string;
  economicDeltas?: Record<string, unknown>;
}
