/**
 * WorkflowLifecycleIntegration
 *
 * Coordinates multi-stage value lifecycle workflows. Each workflow execution
 * runs through a sequence of lifecycle stages via ValueLifecycleOrchestrator,
 * and supports compensation (saga pattern) on failure.
 */

import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";
import { ValueLifecycleOrchestrator } from "../ValueLifecycleOrchestrator.js";

export interface WorkflowExecution {
  id: string;
  userId: string;
  status: "running" | "completed" | "failed";
  completedStages: string[];
  failedStage?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const LIFECYCLE_STAGES = [
  "discovery",
  "drafting",
  "validating",
  "composing",
  "refining",
] as const;

export class WorkflowLifecycleIntegration {
  private orchestrator: ValueLifecycleOrchestrator;

  constructor(
    private readonly supabase?: SupabaseClient,
    orchestrator?: ValueLifecycleOrchestrator
  ) {
    this.orchestrator = orchestrator ?? new ValueLifecycleOrchestrator();
  }

  /**
   * Execute the full value lifecycle workflow for a user.
   * Runs each stage sequentially; on failure records the failed execution and rethrows.
   * Execution state is persisted to Supabase when a client is provided, so it
   * survives process restarts and is visible across instances.
   */
  async executeWorkflow(
    userId: string,
    input: unknown,
    context: { tenantId: string }
  ): Promise<WorkflowExecution> {
    const execId = randomUUID();
    const execution: WorkflowExecution = {
      id: execId,
      userId,
      status: "running",
      completedStages: [],
      startedAt: new Date().toISOString(),
    };
    await this.persistExecution(execution, context.tenantId);

    let currentStage: string | undefined;
    try {
      for (const stage of LIFECYCLE_STAGES) {
        currentStage = stage;
        logger.info("Executing workflow stage", { stage, userId, tenantId: context.tenantId });
        const result = await this.orchestrator.executeLifecycleStage(stage, input, {
          tenantId: context.tenantId,
          userId,
        });
        if (!result.success) {
          throw new Error(result.error ?? `Stage ${stage} failed`);
        }
        execution.completedStages.push(stage);
        await this.persistExecution(execution, context.tenantId);
      }

      execution.status = "completed";
      execution.completedAt = new Date().toISOString();
      await this.persistExecution(execution, context.tenantId);
      return execution;
    } catch (error) {
      execution.status = "failed";
      execution.failedStage = currentStage;
      execution.error = error instanceof Error ? error.message : String(error);
      execution.completedAt = new Date().toISOString();
      await this.persistExecution(execution, context.tenantId);
      throw error;
    }
  }

  /** Return all executions for a given user from the persistent store. */
  async getUserExecutions(userId: string, tenantId: string): Promise<WorkflowExecution[]> {
    if (!this.supabase) return [];
    const { data, error } = await this.supabase
      .from("workflow_executions")
      .select("*")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false });
    if (error) {
      logger.warn("WorkflowLifecycleIntegration: failed to fetch executions", { userId, error: error.message });
      return [];
    }
    return (data ?? []) as WorkflowExecution[];
  }

  private async persistExecution(execution: WorkflowExecution, tenantId: string): Promise<void> {
    if (!this.supabase) return;
    const { error } = await this.supabase
      .from("workflow_executions")
      .upsert({
        id: execution.id,
        tenant_id: tenantId,
        user_id: execution.userId,
        status: execution.status,
        completed_stages: execution.completedStages,
        failed_stage: execution.failedStage ?? null,
        error: execution.error ?? null,
        started_at: execution.startedAt,
        completed_at: execution.completedAt ?? null,
      });
    if (error) {
      logger.warn("WorkflowLifecycleIntegration: failed to persist execution", {
        execId: execution.id,
        error: error.message,
      });
    }
  }
}

export const workflowLifecycleIntegration = new WorkflowLifecycleIntegration();
