/**
 * Workflow DAG Integration with AgentOrchestrator
 *
 * Integrates canonical workflow DAGs with the AgentOrchestrator service,
 * providing:
 * - Compensation logic for incomplete stages
 * - Idempotent retry mechanisms
 * - Circuit breaker integration
 * - Stage execution tracking
 * - Error recovery strategies
 */

import { logger } from "../../lib/logger.js";
import { supabase } from "../../lib/supabase.js";
import {
  ExecutedStep,
  RetryConfig,
  WorkflowDAG,
  WorkflowExecution,
  WorkflowStage,
  WorkflowStatus,
} from "../../types/workflow";
import { AgentType, getAgentAPI } from "../AgentAPI.js";
import { CircuitBreakerManager } from "../CircuitBreaker.js";
import { workflowCompensation } from "../workflow/WorkflowCompensation.js";
import { workflowStateMachine } from "../workflow/WorkflowStateMachine.js";

import {
  ALL_WORKFLOW_DEFINITIONS,
  getWorkflowById,
  validateWorkflowDAG,
} from "./WorkflowDAGDefinitions";

// ============================================================================
// Types
// ============================================================================

export interface StageExecutionContext {
  executionId: string;
  workflowId: string;
  stageId: string;
  stage: WorkflowStage;
  context: Record<string, unknown>;
  attempt: number;
}

export interface StageExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
  duration: number;
  retryable: boolean;
}

export interface CompensationContext {
  executionId: string;
  stageId: string;
  artifactsCreated: string[];
  stateChanges: Record<string, unknown>;
}

// ============================================================================
// Workflow DAG Executor
// ============================================================================

export class WorkflowDAGExecutor {
  private circuitBreakers = new CircuitBreakerManager();
  private agentAPI = getAgentAPI();

  /**
   * Register all workflow definitions in the database.
   * NOTE: Intentionally unscoped — workflow definitions are system-level templates
   * shared across tenants. This is a startup/provisioning operation (service_role allowed).
   */
  async registerAllWorkflows(): Promise<void> {
    for (const workflow of ALL_WORKFLOW_DEFINITIONS) {
      // Validate workflow before registration
      const validation = validateWorkflowDAG(workflow);
      if (!validation.valid) {
        logger.error(`Workflow ${workflow.id} validation failed`, undefined, {
          errors: validation.errors,
        });
        continue;
      }

      if (validation.warnings.length > 0) {
        logger.warn(`Workflow ${workflow.id} warnings`, {
          warnings: validation.warnings,
        });
      }

      await supabase.from("workflow_definitions").upsert(
        {
          name: workflow.name,
          description: workflow.description,
          version: workflow.version,
          dag_schema: workflow,
          is_active: true,
        },
        {
          onConflict: "name,version",
        }
      );
    }
  }

  /**
   * Execute a workflow by ID
   */
  async executeWorkflow(
    workflowId: string,
    context: Record<string, unknown> = {},
    userId: string
  ): Promise<string> {
    const workflow = getWorkflowById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    if (
      !("organizationId" in context) ||
      typeof context.organizationId !== "string"
    ) {
      throw new Error(
        "context.organizationId is required for tenant-scoped workflow execution"
      );
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from("workflow_executions")
      .insert({
        workflow_definition_id: workflowId,
        workflow_version: workflow.version,
        organization_id: context.organizationId,
        status: "initiated",
        current_stage: workflow.initial_stage,
        context: {
          ...context,
          executed_steps: [],
          compensation_policy:
            (context.compensation_policy as string) || "continue_on_error",
        },
        audit_context: {
          workflow_name: workflow.name,
          workflow_version: workflow.version,
        },
        circuit_breaker_state: {},
        created_by: userId,
      })
      .select()
      .single();

    if (execError || !execution) {
      throw new Error("Failed to create workflow execution");
    }

    // Log workflow initiation
    await this.logEvent(execution.id, "workflow_initiated", null, {
      workflow_name: workflow.name,
      workflow_id: workflowId,
    });

    // Execute DAG asynchronously
    this.executeDAG(execution.id, workflow, context.organizationId).catch(
      async (error: unknown) => {
        if (error instanceof Error) {
          await this.handleWorkflowFailure(
            execution.id,
            context.organizationId,
            error.message
          );
        } else {
          await this.handleWorkflowFailure(
            execution.id,
            context.organizationId,
            "Unknown error"
          );
        }
      }
    );

    return execution.id;
  }

  /**
   * Execute the workflow DAG
   */
  private async executeDAG(
    executionId: string,
    workflow: WorkflowDAG,
    organizationId: string
  ): Promise<void> {
    let currentStageId = workflow.initial_stage;
    const executedSteps: ExecutedStep[] = [];

    while (currentStageId) {
      const stage = workflow.stages.find(s => s.id === currentStageId);
      if (!stage) {
        throw new Error(`Stage not found: ${currentStageId}`);
      }

      // Update execution status
      await this.updateExecutionStage(executionId, currentStageId, "running");

      // Execute stage with retry logic
      const result = await this.executeStageWithRetry(
        executionId,
        workflow.id,
        stage
      );

      if (result.success) {
        // Record successful execution
        executedSteps.push({
          stage_id: stage.id,
          stage_type: stage.agent_type,
          compensator: stage.compensation_handler,
          status: "completed",
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

        // Update execution context with output and executed steps
        const contextUpdate: Record<string, unknown> = {
          executed_steps: executedSteps,
        };

        if (result.output && typeof result.output === "object") {
          Object.assign(contextUpdate, result.output);
        }

        await this.updateExecutionContext(executionId, contextUpdate);

        await this.logEvent(executionId, "stage_completed", stage.id, {
          duration: result.duration,
          output: result.output,
        });

        // Get latest context for condition evaluation
        const { data: latestExecution } = await supabase
          .from("workflow_executions")
          .select("context, status")
          .eq("id", executionId)
          .single();

        const context = (latestExecution?.context ?? {}) as Record<
          string,
          unknown
        >;
        const currentWorkflowStatus =
          (latestExecution?.status as WorkflowStatus) || "initiated";

        // Find next stage
        const nextStageId = this.getNextStage(
          workflow,
          currentStageId,
          context
        );

        if (nextStageId) {
          // Validate state transition using state machine
          const nextWorkflowStatus = this.determineWorkflowStatusFromStage(
            workflow,
            nextStageId
          );

          try {
            workflowStateMachine.transitionWorkflow(
              currentWorkflowStatus,
              nextWorkflowStatus,
              {
                executionId,
                workflowId: workflow.id,
                currentStageId,
                nextStageId,
              }
            );

            currentStageId = nextStageId;
          } catch (error: unknown) {
            if (error instanceof Error) {
              await this.handleWorkflowFailure(
                executionId,
                organizationId,
                error.message
              );
            } else {
              await this.handleWorkflowFailure(
                executionId,
                organizationId,
                "Invalid workflow state transition"
              );
            }
            return;
          }
        } else {
          // No next stage found (or conditions not met)
          // Whether it's a final stage or not, if we can't transition, we complete the workflow
          await this.completeWorkflow(executionId);
          return;
        }
      } else {
        // Stage execution failed
        await this.logEvent(executionId, "stage_failed", stage.id, {
          error: result.error,
          duration: result.duration,
        });

        // Trigger compensation if configured
        if (stage.compensation_handler) {
          await this.triggerCompensation(executionId, executedSteps);
        }

        await this.handleWorkflowFailure(
          executionId,
          organizationId,
          result.error || "Stage execution failed"
        );
        return;
      }
    }
  }

  /**
   * Execute a stage with retry logic
   */
  private async executeStageWithRetry(
    executionId: string,
    workflowId: string,
    stage: WorkflowStage
  ): Promise<StageExecutionResult> {
    const retryConfig: RetryConfig = stage.retry_config ?? {
      max_attempts: 1,
      initial_delay_ms: 1000,
      max_delay_ms: 30000,
      multiplier: 2,
      jitter: true,
    };
    let attempt = 0;
    let lastError: string | undefined;

    while (attempt < retryConfig.max_attempts) {
      attempt++;

      // Log attempt
      await this.logEvent(executionId, "stage_attempt", stage.id, {
        attempt,
        max_attempts: retryConfig.max_attempts,
      });

      // Execute stage with circuit breaker
      const circuitBreakerKey = `${workflowId}:${stage.id}`;
      const startTime = Date.now();
      try {
        const result = await this.circuitBreakers
          .getBreaker(circuitBreakerKey)
          .execute(() => this.executeStage(executionId, workflowId, stage));
        const duration = Date.now() - startTime;

        return {
          success: true,
          output: result,
          duration,
          retryable: false,
        };
      } catch (error: unknown) {
        const duration = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        lastError = errorMessage;

        // Check if circuit breaker is open
        if (errorMessage === "Circuit breaker open") {
          return {
            success: false,
            error: "Circuit breaker is open",
            duration: 0,
            retryable: false,
          };
        }

        // Check if retryable
        const isRetryable =
          error instanceof Error ? this.isRetryableError(error) : false;
        if (!isRetryable || attempt >= retryConfig.max_attempts) {
          return {
            success: false,
            error: lastError,
            duration,
            retryable: isRetryable,
          };
        }

        // Calculate retry delay with exponential backoff
        const delay = this.calculateRetryDelay(attempt, retryConfig);
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError || "Max retry attempts exceeded",
      duration: 0,
      retryable: false,
    };
  }

  /**
   * Execute a single stage (idempotent)
   */
  private async executeStage(
    executionId: string,
    workflowId: string,
    stage: WorkflowStage
  ): Promise<unknown> {
    // Get execution context
    const { data: execution } = await supabase
      .from("workflow_executions")
      .select("context")
      .eq("id", executionId)
      .single();

    if (!execution) {
      throw new Error("Execution not found");
    }

    const context =
      (execution.context as Record<string, unknown> | undefined) ?? {};

    // Check if stage already completed (idempotency)
    const executedSteps: ExecutedStep[] =
      (context.executed_steps as ExecutedStep[]) || [];
    const alreadyExecuted = executedSteps.find(
      step => step.stage_id === stage.id
    );
    if (alreadyExecuted) {
      logger.debug(`Stage ${stage.id} already executed, skipping (idempotent)`);
      return { idempotent: true, previous_execution: alreadyExecuted };
    }

    // Map lifecycle stage to agent type
    const agentType = this.mapStageToAgentType(stage.agent_type);

    // Invoke agent via AgentAPI
    const agentResponse = await this.agentAPI.invokeAgent({
      agent: agentType,
      query: `Execute ${stage.name}`,
      context: {
        userId: context.userId,
        organizationId: context.organizationId,
        sessionId: executionId,
        workflowId,
        stageId: stage.id,
        ...context,
      },
    });

    if (!agentResponse.success) {
      throw new Error(agentResponse.error || "Agent invocation failed");
    }

    return agentResponse.data;
  }

  /**
   * Map lifecycle stage to agent type
   */
  private mapStageToAgentType(lifecycleStage: string): AgentType {
    const mapping: Record<string, AgentType> = {
      opportunity: "opportunity",
      target: "target",
      realization: "realization",
      expansion: "expansion",
      integrity: "integrity",
    };

    return mapping[lifecycleStage] || "opportunity";
  }

  /**
   * Get next stage based on transitions
   */
  private getNextStage(
    workflow: WorkflowDAG,
    currentStageId: string,
    context: Record<string, unknown>
  ): string | null {
    const transitions = workflow.transitions.filter(
      t => t.from_stage === currentStageId
    );

    if (transitions.length === 0) {
      return null;
    }

    // 1. Check for conditional matches first
    const conditionalMatch = transitions.find(
      t => t.condition && this.evaluateCondition(t.condition, context)
    );
    if (conditionalMatch) {
      return conditionalMatch.to_stage ?? null;
    }

    // 2. Fallback to unconditional transitions
    const defaultMatch = transitions.find(t => !t.condition);
    if (defaultMatch) {
      return defaultMatch.to_stage ?? null;
    }

    return null;
  }

  /**
   * Evaluate a condition against the execution context
   */
  private evaluateCondition(
    condition: string,
    context: Record<string, unknown>
  ): boolean {
    // Support negation
    if (condition.startsWith("!")) {
      const key = condition.substring(1);
      return !context[key];
    }

    return Boolean(context[condition]);
  }

  /**
   * Trigger compensation for executed steps
   */
  private async triggerCompensation(
    executionId: string,
    _executedSteps: ExecutedStep[]
  ): Promise<void> {
    try {
      await workflowCompensation.rollbackExecution(executionId);
    } catch (error: unknown) {
      logger.error(
        "Compensation failed",
        error instanceof Error ? error : undefined
      );
      await this.logEvent(executionId, "compensation_failed", null, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryablePatterns = [
      /timeout/i,
      /network/i,
      /connection/i,
      /temporary/i,
      /rate limit/i,
      /503/,
      /502/,
      /504/,
    ];

    return retryablePatterns.some(pattern => pattern.test(error.message));
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    let delay =
      config.initial_delay_ms * Math.pow(config.multiplier, attempt - 1);
    delay = Math.min(delay, config.max_delay_ms);

    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterAmount = delay * 0.25;
      delay += Math.random() * jitterAmount * 2 - jitterAmount;
    }

    return Math.floor(delay);
  }

  /**
   * Determine workflow status from stage
   */
  private determineWorkflowStatusFromStage(
    workflow: WorkflowDAG,
    stageId: string
  ): WorkflowStatus {
    // Check if this is the final stage
    const stage = workflow.stages.find(s => s.id === stageId);
    if (!stage) {
      return "running";
    }

    // If no transitions from this stage, it's likely a final stage
    const transitionsFromStage = workflow.transitions.filter(
      t => t.from_stage === stageId
    );
    if (transitionsFromStage.length === 0) {
      return "completed";
    }

    // Otherwise, it's in progress
    return "running";
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update execution stage
   */
  private async updateExecutionStage(
    executionId: string,
    stageId: string,
    status: WorkflowStatus
  ): Promise<void> {
    await supabase
      .from("workflow_executions")
      .update({
        current_stage: stageId,
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", executionId);
  }

  /**
   * Update execution context
   */
  private async updateExecutionContext(
    executionId: string,
    contextUpdate: Record<string, unknown>
  ): Promise<void> {
    const { data: execution } = await supabase
      .from("workflow_executions")
      .select("context")
      .eq("id", executionId)
      .single();

    if (!execution) return;

    await supabase
      .from("workflow_executions")
      .update({
        context: {
          ...execution.context,
          ...contextUpdate,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", executionId);
  }

  /**
   * Complete workflow
   */
  private async completeWorkflow(executionId: string): Promise<void> {
    await supabase
      .from("workflow_executions")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    await this.logEvent(executionId, "workflow_completed", null, {});
  }

  /**
   * Handle workflow failure
   */
  private async handleWorkflowFailure(
    executionId: string,
    organizationId: string,
    error: string
  ): Promise<void> {
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: error,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId)
      .eq("organization_id", organizationId);

    await this.logEvent(executionId, "workflow_failed", null, { error });
  }

  /**
   * Log workflow event
   */
  private async logEvent(
    executionId: string,
    eventType: string,
    stageId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    await supabase.from("workflow_events").insert({
      execution_id: executionId,
      event_type: eventType,
      stage_id: stageId,
      metadata,
    });
  }

  /**
   * Get circuit breaker status for a stage
   */
  getCircuitBreakerStatus(workflowId: string, stageId: string): unknown {
    const key = `${workflowId}:${stageId}`;
    return this.circuitBreakers.getBreaker(key).getState();
  }

  /**
   * Reset circuit breaker for a stage
   */
  resetCircuitBreaker(workflowId: string, stageId: string): void {
    const key = `${workflowId}:${stageId}`;
    this.circuitBreakers.getBreaker(key).reset();
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const workflowDAGExecutor = new WorkflowDAGExecutor();

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get workflow execution status
 */
export async function getWorkflowExecutionStatus(
  executionId: string,
  organizationId: string
): Promise<WorkflowExecution | null> {
  if (!organizationId) {
    throw new Error(
      "organizationId is required for tenant-scoped workflow status lookup"
    );
  }

  const { data, error } = await supabase
    .from("workflow_executions")
    .select("*")
    .eq("id", executionId)
    .eq("organization_id", organizationId)
    .single();

  if (error) {
    logger.error(
      "Failed to get workflow execution",
      error instanceof Error ? error : undefined
    );
    return null;
  }

  return data;
}

/**
 * Get workflow execution logs
 */
export async function getWorkflowExecutionLogs(
  executionId: string,
  organizationId: string
): Promise<unknown[]> {
  if (!organizationId) {
    throw new Error(
      "organizationId is required for tenant-scoped workflow log lookup"
    );
  }

  const { data, error } = await supabase
    .from("workflow_events")
    .select("*, workflow_executions!inner(organization_id)")
    .eq("execution_id", executionId)
    .eq("workflow_executions.organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error(
      "Failed to get workflow logs",
      error instanceof Error ? error : undefined
    );
    return [];
  }

  return data || [];
}

/**
 * Retry failed workflow from last successful stage
 */
export async function retryWorkflowFromLastStage(
  executionId: string,
  organizationId: string,
  userId: string
): Promise<string> {
  if (!organizationId) {
    throw new Error(
      "organizationId is required for tenant-scoped workflow retry"
    );
  }

  const execution = await getWorkflowExecutionStatus(
    executionId,
    organizationId
  );
  if (!execution) {
    throw new Error("Execution not found");
  }

  if (execution.status !== "failed") {
    throw new Error("Can only retry failed workflows");
  }

  // Create new execution with same context
  const workflowDefId = execution.workflow_definition_id;
  if (!workflowDefId) {
    throw new Error("Execution missing workflow_definition_id");
  }
  const workflow = getWorkflowById(workflowDefId);
  if (!workflow) {
    throw new Error("Workflow definition not found");
  }

  // Start from last successful stage or initial stage
  const executedStepsFromContext: ExecutedStep[] =
    execution.context?.executed_steps ?? [];
  const entryStage = workflow.initial_stage ?? workflow.entry_stage ?? "";
  const lastSuccessfulStage =
    executedStepsFromContext.length > 0
      ? (executedStepsFromContext[executedStepsFromContext.length - 1]
          ?.stage_id ?? entryStage)
      : entryStage;

  return workflowDAGExecutor.executeWorkflow(
    workflowDefId,
    {
      ...execution.context,
      retry_from_stage: lastSuccessfulStage,
      original_execution_id: executionId,
    } as Record<string, unknown>,
    userId
  );
}
