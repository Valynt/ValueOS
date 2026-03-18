/**
 * Workflow-SDUI Bridge Types
 * 
 * Types for bridging workflow execution with SDUI updates
 */

export interface WorkflowSDUIEvent {
  workflow_id: string;
  execution_id: string;
  workspace_id: string;
  event_type: WorkflowSDUIEventType;
  stage_id?: string;
  sdui_updates: SDUIUpdate[];
  timestamp: string;
}

export type WorkflowSDUIEventType =
  | 'stage_started'
  | 'stage_completed'
  | 'stage_failed'
  | 'workflow_completed'
  | 'workflow_failed';

export interface SDUIUpdate {
  target: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
}

export interface StageCompletionEvent {
  workspace_id: string;
  stage_id: string;
  lifecycle_stage: string;
  status: 'completed' | 'failed' | 'skipped';
  output_data: Record<string, any>;
  timestamp: string;
}

export interface WorkflowProgress {
  workspace_id: string;
  workflow_id: string;
  current_stage: string;
  completed_stages: string[];
  total_stages: number;
  progress_percentage: number;
  estimated_completion?: string;
  // camelCase aliases
  currentStage?: string;
  currentStageIndex?: number;
  completedStages?: string[];
  totalStages?: number;
  percentComplete?: number;
  status?: string;
}
