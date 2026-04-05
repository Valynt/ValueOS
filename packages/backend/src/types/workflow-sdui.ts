import type { JsonObject } from "./json";

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
  payload: JsonObject;
}

export interface StageCompletionEvent {
  workspace_id: string;
  stage_id: string;
  lifecycle_stage: string;
  status: 'completed' | 'failed' | 'skipped';
  output_data: JsonObject;
  timestamp: string;
}

// typed-debt-boundary-migration: workflow-sdui.ts migrated event payload/output contracts to JsonObject; owner=@workflow-runtime, remaining debt=codify event-type-specific payload schemas.

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
