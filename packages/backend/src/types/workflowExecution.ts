/**
 * Workflow Execution Types
 */

export interface WorkflowExecutionRecord {
  id: string;
  workflow_id: string;
  workflowDefinitionId?: string;
  workflowVersion?: number;
  workspace_id: string;
  organization_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  | 'pending_approval';
  started_at: string;
  completed_at?: string;
  context: Record<string, unknown>;
  result?: Record<string, unknown>;
  io?: Record<string, unknown>;
  outputs?: Record<string, unknown> | unknown[];
  lifecycle?: Record<string, unknown> | unknown[];
  persona?: string;
  industry?: string;
  fiscalQuarter?: string;
  economicDeltas?: Record<string, unknown> | unknown[];
  intent?: Record<string, unknown>;
  entryPoint?: Record<string, unknown>;
  auditEnvelope?: Record<string, unknown>;
}
