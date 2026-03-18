/**
 * Workflow Event Listener
 *
 * Listens to workflow events and triggers SDUI updates.
 * Integrates Workflow Orchestrator with SDUI system.
 * SECURITY: Now uses SecureMessageBus for all event communication
 */

import { ServiceMessageBusAdapter } from "../../lib/agent-fabric/ServiceMessageBusAdapter";
import { logger } from "../../lib/logger.js"
import { StageStatus } from "../../types/workflow";
import { StageCompletionEvent, WorkflowProgress } from "../../types/workflow-sdui";
import { getStageById } from "../workflows/WorkflowDAGDefinitions.js"

import { canvasSchemaService } from "./CanvasSchemaService.js"
import { workflowSDUIAdapter } from "./WorkflowSDUIAdapter.js"

/**
 * Workflow event types
 */
export type WorkflowEventType =
  | "workflow:started"
  | "workflow:stage_transition"
  | "workflow:stage_completed"
  | "workflow:progress_update"
  | "workflow:completed"
  | "workflow:failed"
  | "workflow:error";

/**
 * Workflow event callback
 */
export type WorkflowEventCallback = (event: unknown) => void | Promise<void>;

/**
 * Workflow Event Listener Service
 */
export class WorkflowEventListener extends ServiceMessageBusAdapter {
  private _eventCallbacks: Map<WorkflowEventType, WorkflowEventCallback[]>;
  private enabled: boolean;
  private workflowProgress: Map<string, WorkflowProgress>;

  constructor() {
    super();
    this._eventCallbacks = new Map();
    this.enabled = true;
    this.workflowProgress = new Map();
  }

  /**
   * Enable listener
   */
  enable(): void {
    this.enabled = true;
    logger.info("Workflow event listener enabled");
  }

  /**
   * Disable listener
   */
  disable(): void {
    this.enabled = false;
    logger.info("Workflow event listener disabled");
  }

  /**
   * Register callback for workflow event
   */
  override on(eventType: WorkflowEventType, callback: WorkflowEventCallback): this {
    if (!this._eventCallbacks.has(eventType)) {
      this._eventCallbacks.set(eventType, []);
    }
    this._eventCallbacks.get(eventType)!.push(callback);
    logger.debug("Registered workflow event callback", { eventType });
    return super.on(eventType, callback);
  }

  /**
   * Handle workflow started event
   */
  async handleWorkflowStarted(
    workflowId: string,
    executionId: string,
    context: unknown
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info("Handling workflow started", { workflowId, executionId });

    try {
      // Initialize progress tracking
      const ctx = context as Record<string, unknown>;
      this.workflowProgress.set(workflowId, {
        workflow_id: workflowId,
        currentStage: (ctx["initialStage"] as string) || "initial",
        currentStageIndex: 0,
        totalStages: (ctx["totalStages"] as number) || 0,
        completedStages: [],
        status: "in_progress",
        percentComplete: 0,
      });

      await this.emitSecure("workflow:started", { workflowId, executionId, context });
      await this.triggerSDUIUpdate(workflowId, context);

      logger.info("Workflow started event handled", { workflowId });
    } catch (error) {
      logger.error("Failed to handle workflow started", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emitSecure("workflow:error", { workflowId, error });
    }
  }

  /**
   * Handle stage transition event
   */
  async handleStageTransition(
    workflowId: string,
    fromStage: string | null,
    toStage: string,
    context: unknown
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info("Handling stage transition", {
      workflowId,
      fromStage,
      toStage,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.currentStage = toStage;
        const idx = (progress.currentStageIndex ?? 0) + 1;
        progress.currentStageIndex = idx;
        progress.percentComplete = progress.totalStages
          ? Math.round((idx / progress.totalStages) * 100)
          : progress.percentComplete;
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event via SecureMessageBus
      await this.emitSecure("workflow:stage_transition", {
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

      if (sduiUpdate.type === "full_schema") {
        const ctx2 = context as Record<string, unknown>;
        const workspaceId = (ctx2["workspaceId"] ?? ctx2["workspace_id"]) as string | undefined;
        if (workspaceId) {
          canvasSchemaService.invalidateCache(workspaceId);
        }
      }

      logger.info("Stage transition handled", { workflowId, toStage });
    } catch (error) {
      logger.error("Failed to handle stage transition", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emitSecure("workflow:error", { workflowId, error });
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
    output?: unknown
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info("Handling stage completion", {
      workflowId,
      stageId,
      status,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress && status === "completed") {
        progress.completedStages.push(stageId);
        this.workflowProgress.set(workflowId, progress);
      }

      // Get stage definition to determine lifecycle stage
      const stageDef = getStageById(workflowId, stageId);
      const lifecycleStage = stageDef?.agent_type || "opportunity";

      if (!stageDef) {
        logger.warn("Stage definition not found for completion event", {
          workflowId,
          stageId,
        });
      }

      const event: StageCompletionEvent = {
        workflowId,
        executionId: workflowId,
        stageId,
        lifecycleStage,
        status,
        duration,
        output,
        timestamp: Date.now(),
      };

      // Emit event
      await this.emitSecure("workflow:stage_completed", event);

      // Generate SDUI update
      const actions = await workflowSDUIAdapter.onStageCompletion(event);

      logger.info("Stage completion handled", {
        workflowId,
        stageId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error("Failed to handle stage completion", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emitSecure("workflow:error", { workflowId, error });
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

    logger.info("Handling progress update", { workflowId });

    try {
      // Update progress
      const currentProgress = this.workflowProgress.get(workflowId);
      if (currentProgress) {
        const updatedProgress = { ...currentProgress, ...progress };
        this.workflowProgress.set(workflowId, updatedProgress);

        // Emit event
        await this.emitSecure("workflow:progress_update", updatedProgress);

        // Generate SDUI update
        const actions = await workflowSDUIAdapter.updateProgress(workflowId, updatedProgress);

        logger.info("Progress update handled", {
          workflowId,
          actionCount: actions.length,
        });
      }
    } catch (error) {
      logger.error("Failed to handle progress update", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emitSecure("workflow:error", { workflowId, error });
    }
  }

  /**
   * Handle workflow completion event
   */
  async handleWorkflowCompleted(
    workflowId: string,
    executionId: string,
    context: unknown
  ): Promise<void> {
    if (!this.enabled) return;

    logger.info("Handling workflow completion", { workflowId, executionId });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.status = "completed";
        progress.percentComplete = 100;
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event
      await this.emitSecure("workflow:completed", { workflowId, executionId, context });

      // Generate SDUI update
      const actions = await workflowSDUIAdapter.onWorkflowComplete(
        workflowId,
        executionId,
        context
      );

      // Clean up progress tracking
      this.workflowProgress.delete(workflowId);

      logger.info("Workflow completion handled", {
        workflowId,
        actionCount: actions.length,
      });
    } catch (error) {
      logger.error("Failed to handle workflow completion", {
        workflowId,
        error: error instanceof Error ? error.message : String(error),
      });
      await this.emitSecure("workflow:error", { workflowId, error });
    }
  }

  /**
   * Handle workflow failure event
   */
  async handleWorkflowFailed(
    workflowId: string,
    executionId: string,
    error: Error,
    context: unknown
  ): Promise<void> {
    if (!this.enabled) return;

    logger.error("Handling workflow failure", {
      workflowId,
      executionId,
      error: error.message,
    });

    try {
      // Update progress
      const progress = this.workflowProgress.get(workflowId);
      if (progress) {
        progress.status = "failed";
        this.workflowProgress.set(workflowId, progress);
      }

      // Emit event
      await this.emitSecure("workflow:failed", { workflowId, executionId, error, context });

      // Clean up progress tracking
      this.workflowProgress.delete(workflowId);

      logger.info("Workflow failure handled", { workflowId });
    } catch (err) {
      logger.error("Failed to handle workflow failure", {
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
  private async triggerSDUIUpdate(_workflowId: string, context: unknown): Promise<void> {
    const ctx = context as Record<string, unknown>;
    const workspaceId = (ctx["workspaceId"] ?? ctx["workspace_id"]) as string | undefined;
    if (workspaceId) {
      canvasSchemaService.invalidateCache(workspaceId);
    }
  }

  /**
   * Clear all progress tracking
   */
  clearProgress(): void {
    this.workflowProgress.clear();
    logger.info("Cleared all workflow progress tracking");
  }
}

// Singleton instance
export const workflowEventListener = new WorkflowEventListener();
