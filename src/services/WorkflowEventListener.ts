/**
 * Workflow Event Listener
 * 
 * Listens to workflow events and triggers SDUI updates.
 * Integrates Workflow Orchestrator with SDUI system.
 */

import { logger } from '../lib/logger';
import { EventEmitter } from 'events';
import { workflowSDUIAdapter } from './WorkflowSDUIAdapter';
import { canvasSchemaService } from './CanvasSchemaService';
import {
  WorkflowProgress,
  StageTransitionEvent,
  StageCompletionEvent,
} from '../types/workflow-sdui';
import { WorkflowStatus, StageStatus } from '../types/workflow';

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | 'workflow:started'
  | 'workflow:stage_transition'
  | 'workflow:stage_completed'
  | 'workflow:progress_update'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:error';

/**
 * Workflow event callback
 */
export type WorkflowEventCallback = (event: any) => void | Promise<void>;

/**
 * Workflow Event Listener Service
 */
export class WorkflowEventListener extends EventEmitter {
  private listeners: Map<WorkflowEventType, WorkflowEventCallback[]>;
  private enabled: boolean;
  private workflowProgress: Map<string, WorkflowProgress>;

  constructor() {
    super();
    this.listeners = new Map();
    this.enabled = true;
    this.workflowProgress = new Map();
  }

  /**
   * Enable listener
   */
  enable(): void {
    this.enabled = true;
    logger.info('Workflow event listener enabled');
  }

  /**
   * Disable listener
   */
  disable(): void {
    this.enabled = false;
    logger.info('Workflow event listener disabled');
  }

  /**
   * Register callback for workflow event
   */
  on(eventType: WorkflowEventType, callback: WorkflowEventCallback): this {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
    logger.debug('Registered workflow event callback', { eventType });
    return super.on(eventType, callback);
  }

  /**
   * Handle workflow started event
   */
  async handleWorkflowStarted(
    workflowId: string,
    executionId: string,
    context: any
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling workflow started', { workflowId, executionId });

    try {
      // Initialize progress tracking
      this.workflowProgress.set(workflowId, {
        workflowId,
        currentStage: context.initialStage || 'initial',
        currentStageIndex: 0,
        totalStages: context.totalStages || 0,
        completedStages: [],
        status: 'in_progress',
        percentComplete: 0,
      });

      // Emit event
      this.emit('workflow:started', { workflowId, executionId, context });

      // Trigger SDUI update
      await this.triggerSDUIUpdate(workflowId, context);

      logger.info('Workflow started event handled', { workflowId });
    } catch (error) {
      logger.error('Failed to handle workflow started', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('workflow:error', { workflowId, error });
    }
  }

  /**
   * Handle stage transition event
   */
  async handleStageTransition(
    workflowId: string,
    fromStage: string | null,
    toStage: string,
    context: any
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling stage transition', {
      workflowId,
      fromStage,
      toStage,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.currentStage = toStage;
        progress.currentStageIndex += 1;
        progress.percentComplete = Math.round(
          (progress.currentStageIndex / progress.totalStages) * 100
        );
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event
      this.emit('workflow:stage_transition', {
        workflowId,
        fromStage,
        toStage,
        context,
      });

      // Generate SDUI update
      const sduiUpdate = await workflowSDUIAdapter.onStageTransition(
        workflowId,
        fromStage,
        toStage,
        context
      );

      // Apply SDUI update
      if (sduiUpdate.type === 'full_schema') {
        const workspaceId = context.workspaceId || context.workspace_id;
        if (workspaceId) {
          canvasSchemaService.invalidateCache(workspaceId);
        }
      }

      logger.info('Stage transition handled', { workflowId, toStage });
    } catch (error) {
      logger.error('Failed to handle stage transition', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('workflow:error', { workflowId, error });
    }
  }

  /**
   * Handle stage completion event
   */
  async handleStageCompletion(
    workflowId: string,
    stageId: string,
    status: StageStatus,
    duration: number,
    output?: any
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling stage completion', {
      workflowId,
      stageId,
      status,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress && status === 'completed') {
        progress.completedStages.push(stageId);
        this.workflowProgress.set(workflowId, progress);
      }

      const event: StageCompletionEvent = {
        workflowId,
        executionId: workflowId,
        stageId,
        lifecycleStage: 'opportunity', // TODO: Get from stage definition
        status,
        duration,
        output,
        timestamp: Date.now(),
      };

      // Emit event
      this.emit('workflow:stage_completed', event);

      // Generate SDUI update
      const actions = await workflowSDUIAdapter.onStageCompletion(event);

      logger.info('Stage completion handled', {
        workflowId,
        stageId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error('Failed to handle stage completion', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('workflow:error', { workflowId, error });
    }
  }

  /**
   * Handle progress update event
   */
  async handleProgressUpdate(
    workflowId: string,
    progress: Partial<WorkflowProgress>
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling progress update', { workflowId });

    try {
      // Update progress
      const currentProgress = this.workflowProgress.get(workflowId);
      if (currentProgress) {
        const updatedProgress = { ...currentProgress, ...progress };
        this.workflowProgress.set(workflowId, updatedProgress);

        // Emit event
        this.emit('workflow:progress_update', updatedProgress);

        // Generate SDUI update
        const actions = await workflowSDUIAdapter.updateProgress(
          workflowId,
          updatedProgress
        );

        logger.info('Progress update handled', {
          workflowId,
          actionCount: actions.length,
        });
      }
    } catch (error) {
      logger.error('Failed to handle progress update', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('workflow:error', { workflowId, error });
    }
  }

  /**
   * Handle workflow completion event
   */
  async handleWorkflowCompleted(
    workflowId: string,
    executionId: string,
    context: any
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info('Handling workflow completion', { workflowId, executionId });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.status = 'completed';
        progress.percentComplete = 100;
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event
      this.emit('workflow:completed', { workflowId, executionId, context });

      // Generate SDUI update
      const actions = await workflowSDUIAdapter.onWorkflowComplete(
        workflowId,
        executionId,
        context
      );

      // Clean up progress tracking
      this.workflowProgress.delete(workflowId);

      logger.info('Workflow completion handled', {
        workflowId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error('Failed to handle workflow completion', {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.emit('workflow:error', { workflowId, error });
    }
  }

  /**
   * Handle workflow failure event
   */
  async handleWorkflowFailed(
    workflowId: string,
    executionId: string,
    error: Error,
    context: any
  ): Promise<void> {
    if (!this.enabled) return;

    logger.error('Handling workflow failure', {
      workflowId,
      executionId,
      error: error.message,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.status = 'failed';
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event
      this.emit('workflow:failed', { workflowId, executionId, error, context });

      // Clean up progress tracking
      this.workflowProgress.delete(workflowId);

      logger.info('Workflow failure handled', { workflowId });
    } catch (err) {
      logger.error('Failed to handle workflow failure', {
        workflowId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Get workflow progress
   */
  getProgress(workflowId: string): WorkflowProgress | undefined {
    return this.workflowProgress.get(workflowId);
  }

  /**
   * Trigger SDUI update for workflow
   */
  private async triggerSDUIUpdate(
    workflowId: string,
    context: any
  ): Promise<void> {
    const workspaceId = context.workspaceId || context.workspace_id;
    if (workspaceId) {
      canvasSchemaService.invalidateCache(workspaceId);
    }
  }

  /**
   * Clear all progress tracking
   */
  clearProgress(): void {
    this.workflowProgress.clear();
    logger.info('Cleared all workflow progress tracking');
  }
}

// Singleton instance
export const workflowEventListener = new WorkflowEventListener();
