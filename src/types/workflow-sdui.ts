/**
 * Workflow SDUI Integration Types
 */

import { LifecycleStage, WorkflowStatus, StageStatus } from './workflow';
import { AtomicUIAction } from '../sdui/AtomicUIActions';
import { SDUIPageDefinition } from '../sdui/schema';

/**
 * Workflow progress information
 */
export interface WorkflowProgress {
  workflowId: string;
  currentStage: string;
  currentStageIndex: number;
  totalStages: number;
  completedStages: string[];
  status: WorkflowStatus;
  percentComplete: number;
  estimatedTimeRemaining?: number;
}

/**
 * Stage transition event
 */
export interface StageTransitionEvent {
  workflowId: string;
  executionId: string;
  fromStage: string | null;
  toStage: string;
  fromLifecycleStage?: LifecycleStage;
  toLifecycleStage: LifecycleStage;
  timestamp: number;
  context: Record<string, any>;
}

/**
 * Stage completion event
 */
export interface StageCompletionEvent {
  workflowId: string;
  executionId: string;
  stageId: string;
  lifecycleStage: LifecycleStage;
  status: StageStatus;
  duration: number;
  output?: any;
  timestamp: number;
}

/**
 * Workflow SDUI update
 */
export interface WorkflowSDUIUpdate {
  workflowId: string;
  executionId: string;
  updateType: 'progress' | 'stage_transition' | 'stage_completion' | 'workflow_complete';
  atomicActions: AtomicUIAction[];
  schema?: SDUIPageDefinition;
  timestamp: number;
}

/**
 * Progress component configuration
 */
export interface ProgressComponentConfig {
  componentId: string;
  componentType: 'WorkflowProgress' | 'StageIndicator' | 'ProgressBar';
  position: 'header' | 'sidebar' | 'footer' | 'inline';
  showEstimatedTime: boolean;
  showStageNames: boolean;
  interactive: boolean;
}
