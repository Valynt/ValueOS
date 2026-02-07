/**
 * Value Lifecycle Orchestrator with Saga Pattern
 *
 * Coordinates multi-agent workflows across the value lifecycle stages
 * with compensation patterns for failure recovery.
 */

import { OpportunityAgent } from "../lib/agent-fabric/agents/OpportunityAgent";
import { TargetAgent } from "../lib/agent-fabric/agents/TargetAgent";
import { ExpansionAgent } from "../lib/agent-fabric/agents/ExpansionAgent";
import { IntegrityAgent } from "../lib/agent-fabric/agents/IntegrityAgent";
import { RealizationAgent } from "../lib/agent-fabric/agents/RealizationAgent";
import { BaseAgent } from "../lib/agent-fabric/agents/BaseAgent";
import { CircuitBreaker } from "../lib/resilience/CircuitBreaker";
import { logger } from "../lib/logger.js"
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

import { TargetAgentInputSchema } from "../validators/agentInputs.js";
import { z } from "zod";
import { ValidationError } from "../lib/errors.js";

export type LifecycleStage = "opportunity" | "target" | "expansion" | "integrity" | "realization";

export interface LifecycleContext {
  userId: string;
  tenantId?: string;
  organizationId?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface StageInput {
  [key: string]: any;
}

export interface StageResult {
  success: boolean;
  data: any;
  confidence?: string;
  assumptions?: any[];
  error?: string;
  stageExecutionId?: string;
  lineage?: StageLineage;
  delta?: StageDelta;
  compensation?: CompensationOutcome[];
}

export interface StageLineage {
  stage: LifecycleStage;
  parentExecutionId?: string;
  replayed?: boolean;
}

export interface StageDelta {
  before: any;
  after: any;
}

export interface CompensationOutcome {
  name: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface CompensationHandler {
  name: string;
  handler: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

export class LifecycleError extends Error {
  constructor(
    public stage: LifecycleStage,
    message: string,
    public originalError?: Error,
    public compensation?: CompensationOutcome[],
    public stageResult?: StageResult
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem";
import { AuditLogger } from "../lib/agent-fabric/AuditLogger";
import { AgentConfig } from "../types/agent";
import { workflowExecutionStore, WorkflowStatus } from "./WorkflowExecutionStore.js"
import { AuditTrailService, getAuditTrailService } from "./security/AuditTrailService.js";

// ... (other imports remain the same) ...

const REPLAYABLE_STAGES = new Set<LifecycleStage>(["opportunity", "target", "expansion"]);
const DESTRUCTIVE_STAGES = new Set<LifecycleStage>(["integrity", "realization"]);

export class ValueLifecycleOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private compensations: Map<string, CompensationHandler[]> = new Map();
  private supabase: ReturnType<typeof createClient>;
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private auditLogger: AuditLogger;
  private auditTrailService: AuditTrailService;

  constructor(
    supabaseClient: ReturnType<typeof createClient>,
    llmGateway: LLMGateway,
    memorySystem: MemorySystem,
    auditLogger: AuditLogger
  ) {
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.supabase = supabaseClient;
    this.llmGateway = llmGateway;
    this.memorySystem = memorySystem;
    this.auditLogger = auditLogger;
    this.auditTrailService = getAuditTrailService();
  }

  async executeLifecycleStage(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<StageResult> {
    const compensationKey = this.getCompensationKey(context);
    try {
      this.ensureWorkflowActive(context);
      // ... (logic before agent creation remains the same) ...

      // Step 2: Execute stage-specific agent
      const agent = this.getAgentForStage(stage, context);
      const result = await this.circuitBreaker.execute(async () => {
        if (!context.sessionId) {
          throw new Error("Session ID is required to execute an agent.");
        }
        return await agent.execute(context.sessionId, input);
      });

      const previousResult = (context.metadata as any)?.previousResult as StageResult | undefined;
      const stageExecutionId = uuidv4();
      const enrichedResult: StageResult = {
        ...result,
        stageExecutionId,
        lineage: {
          stage,
          parentExecutionId: previousResult?.stageExecutionId,
          replayed: this.isReplayableStage(stage) && !!previousResult,
        },
        delta: this.captureDelta(previousResult?.data, result.data),
      };

      const persistedResult = await this.persistStageResults(stage, enrichedResult, context);
      this.registerStageCompensations(stage, persistedResult, enrichedResult, input, context);

      return enrichedResult;
    } catch (error) {
      const compensationResults = await this.executeCompensations(
        compensationKey,
        error,
        context
      );
      const failureResult: StageResult = {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        compensation: compensationResults,
      };
      throw new LifecycleError(
        stage,
        `Lifecycle stage ${stage} failed`,
        error instanceof Error ? error : new Error(String(error)),
        compensationResults,
        failureResult
      );
    }

    // ... (rest of the logic remains the same) ...
  }

  private getCompensationKey(context: LifecycleContext): string {
    return context.sessionId || context.organizationId || context.userId || "global";
  }

  private registerCompensation(
    context: LifecycleContext,
    handler: CompensationHandler
  ): void {
    const key = this.getCompensationKey(context);
    const handlers = this.compensations.get(key) ?? [];
    handlers.push(handler);
    this.compensations.set(key, handlers);
  }

  private registerStageCompensations(
    stage: LifecycleStage,
    persistedResult: any,
    enrichedResult: StageResult,
    input: StageInput,
    context: LifecycleContext
  ): void {
    const persistedId = persistedResult?.id ?? enrichedResult.stageExecutionId;
    if (persistedId) {
      this.registerCompensation(context, {
        name: `${stage}_delete_results`,
        handler: async () => {
          await this.deleteStageResults(String(persistedId));
        },
        metadata: {
          stage,
          persistedId,
          stageExecutionId: enrichedResult.stageExecutionId,
        },
      });
    }

    const valueTreeId =
      persistedResult?.value_tree_id ??
      enrichedResult.data?.value_tree_id ??
      input.value_tree_id;
    if (valueTreeId) {
      this.registerCompensation(context, {
        name: `${stage}_revert_value_tree`,
        handler: async () => {
          await this.revertValueTree(String(valueTreeId));
        },
        metadata: {
          stage,
          valueTreeId,
          stageExecutionId: enrichedResult.stageExecutionId,
        },
      });
    }
  }

  private async executeCompensations(
    compensationKey: string,
    failureReason: unknown,
    context: LifecycleContext
  ): Promise<CompensationOutcome[]> {
    const handlers = this.compensations.get(compensationKey) ?? [];
    const reversed = [...handlers].reverse();
    this.compensations.delete(compensationKey);

    const failureMessage =
      failureReason instanceof Error ? failureReason.message : String(failureReason);
    const results: CompensationOutcome[] = [];

    for (const handler of reversed) {
      try {
        await handler.handler();
        const outcome: CompensationOutcome = {
          name: handler.name,
          success: true,
          metadata: handler.metadata,
        };
        results.push(outcome);
        await this.logCompensationDecision(handler, "success", failureMessage, context);
      } catch (error) {
        const outcome: CompensationOutcome = {
          name: handler.name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metadata: handler.metadata,
        };
        results.push(outcome);
        await this.logCompensationDecision(handler, "error", failureMessage, context, error);
      }
    }

    return results;
  }

  private async logCompensationDecision(
    handler: CompensationHandler,
    outcome: "success" | "error",
    failureReason: string,
    context: LifecycleContext,
    error?: unknown
  ): Promise<void> {
    const correlationId = context.sessionId || uuidv4();
    await this.auditTrailService.logImmediate({
      eventType: "saga_compensation",
      actorId: context.userId || "system",
      actorType: "service",
      resourceId: handler.metadata?.stageExecutionId
        ? String(handler.metadata.stageExecutionId)
        : correlationId,
      resourceType: "system",
      action: "saga_compensation",
      outcome,
      details: {
        compensationName: handler.name,
        failureReason,
        handlerMetadata: handler.metadata,
        error: error instanceof Error ? error.message : error,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
        sessionId: context.sessionId,
      },
      ipAddress: "system",
      userAgent: "system",
      timestamp: Date.now(),
      sessionId: context.sessionId || correlationId,
      correlationId,
      riskScore: 0,
      complianceFlags: [],
      tenantId: context.tenantId,
    });
  }

  async runLifecycle(
    input: StageInput,
    context: LifecycleContext
  ): Promise<{ opportunity: StageResult; target: StageResult }> {
    const opportunityResult = await this.executeLifecycleStage(
      "opportunity",
      input,
      context
    );

    this.registerCompensation(context, {
      name: "opportunity_restore_snapshot",
      handler: async () => {
        await this.restoreOpportunityState(opportunityResult, context);
      },
      metadata: {
        stage: "opportunity",
        stageExecutionId: opportunityResult.stageExecutionId,
        delta: opportunityResult.delta,
      },
    });

    try {
      const targetResult = await this.executeLifecycleStage("target", input, {
        ...context,
        metadata: {
          ...context.metadata,
          previousResult: opportunityResult,
        },
      });

      return { opportunity: opportunityResult, target: targetResult };
    } catch (error) {
      await this.logOpportunityTargetCompensation(
        error,
        opportunityResult,
        context
      );
      throw error;
    }
  }

  private async logOpportunityTargetCompensation(
    error: unknown,
    opportunityResult: StageResult,
    context: LifecycleContext
  ): Promise<void> {
    const lifecycleError =
      error instanceof LifecycleError
        ? error
        : new LifecycleError(
            "target",
            "Lifecycle stage target failed",
            error instanceof Error ? error : new Error(String(error))
          );
    const compensationOutcomes = lifecycleError.compensation ?? [];
    const failureReason =
      lifecycleError.originalError?.message ?? lifecycleError.message;
    const correlationId = context.sessionId || uuidv4();

    await this.auditTrailService.logImmediate({
      eventType: "saga_opportunity_target_compensation",
      actorId: context.userId || "system",
      actorType: "service",
      resourceId: opportunityResult.stageExecutionId
        ? String(opportunityResult.stageExecutionId)
        : correlationId,
      resourceType: "system",
      action: "saga_opportunity_target_compensation",
      outcome: compensationOutcomes.some((result) => !result.success)
        ? "error"
        : "success",
      details: {
        failureReason,
        opportunityStageExecutionId: opportunityResult.stageExecutionId,
        targetStage: "target",
        compensationOutcomes,
        opportunityDelta: opportunityResult.delta,
        tenantId: context.tenantId,
        organizationId: context.organizationId,
        sessionId: context.sessionId,
      },
      ipAddress: "system",
      userAgent: "system",
      timestamp: Date.now(),
      sessionId: context.sessionId || correlationId,
      correlationId,
      riskScore: 0,
      complianceFlags: [],
      tenantId: context.tenantId,
    });
  }

  private getAgentForStage(stage: LifecycleStage, context: LifecycleContext): BaseAgent {
    const agentConfig: AgentConfig = {
      id: `${stage}-agent`, // Or a more sophisticated ID
      organizationId: context.organizationId,
      userId: context.userId,
      sessionId: context.sessionId,
      supabase: this.supabase,
      llmGateway: this.llmGateway,
      memorySystem: this.memorySystem,
      auditLogger: this.auditLogger,
    };

    const agents: Record<LifecycleStage, new (config: AgentConfig) => BaseAgent> = {
      opportunity: OpportunityAgent,
      target: TargetAgent,
      expansion: ExpansionAgent,
      integrity: IntegrityAgent,
      realization: RealizationAgent,
    };

    const AgentClass = agents[stage];
    return new AgentClass(agentConfig);
  }

  private async validatePrerequisites(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<void> {
    if (stage === "target") {
      try {
        TargetAgentInputSchema.parse(input);
      } catch (error) {
        if (error instanceof z.ZodError) {
          throw new ValidationError(
            `Invalid input for target stage: ${error.errors.map((e) => e.message).join(", ")}`
          );
        }
        throw error;
      }
      return;
    }

    // Fallback to old logic for other stages
    const prerequisites: Record<LifecycleStage, string[]> = {
      opportunity: [],
      target: [], // Handled by Zod now
      expansion: ["value_tree_id"],
      integrity: ["roi_model_id"],
      realization: ["value_commit_id"],
    };

    const required = prerequisites[stage];
    if (required) {
      const missing = required.filter((field) => !input[field]);
      if (missing.length > 0) {
        throw new ValidationError(`Missing prerequisites for ${stage}: ${missing.join(", ")}`);
      }
    }
  }

  private async persistStageResults(
    stage: LifecycleStage,
    result: any,
    context: LifecycleContext
  ): Promise<any> {
    const tableName = `${stage}_results`;

    const { data, error } = await this.supabase
      .from(tableName)
      .insert({
        ...result,
        user_id: context.userId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to persist ${stage} results: ${error.message}`);
    }

    return data;
  }

  private async deleteStageResults(resultId: string): Promise<void> {
    logger.info("Compensating: deleting stage results", { resultId });
    // Implementation would delete the persisted results
  }

  private ensureWorkflowActive(context: LifecycleContext): void {
    const workflowId = context.sessionId || context.organizationId || context.userId;
    if (!workflowId) {
      return;
    }

    const status: WorkflowStatus = workflowExecutionStore.getStatus(workflowId);
    if (status === "PAUSED") {
      throw new Error(`Workflow ${workflowId} is paused`);
    }
    if (status === "HALTED") {
      throw new Error(`Workflow ${workflowId} is halted`);
    }
  }

  private isReplayableStage(stage: LifecycleStage): boolean {
    return REPLAYABLE_STAGES.has(stage);
  }

  private isDestructiveStage(stage: LifecycleStage): boolean {
    return DESTRUCTIVE_STAGES.has(stage);
  }

  private captureDelta(before: any, after: any): StageDelta {
    return { before: before ?? null, after };
  }

  private async updateValueTree(persistedData: any, context: LifecycleContext): Promise<void> {
    logger.info("Updating value tree", { persistedData, context });
    // Implementation would update the value tree
  }

  private async revertValueTree(valueTreeId: string): Promise<void> {
    logger.info("Compensating: reverting value tree", { valueTreeId });
    // Implementation would revert value tree changes
  }

  private async restoreOpportunityState(
    opportunityResult: StageResult,
    context: LifecycleContext
  ): Promise<void> {
    const snapshot =
      opportunityResult.delta?.before ??
      opportunityResult.data?.snapshot ??
      opportunityResult.data?.previous ??
      null;
    if (snapshot) {
      await this.updateValueTree(snapshot, context);
      return;
    }
    logger.info("No opportunity snapshot available for compensation", {
      stageExecutionId: opportunityResult.stageExecutionId,
    });
  }

  private hasNextStage(stage: LifecycleStage): boolean {
    const stageOrder: LifecycleStage[] = [
      "opportunity",
      "target",
      "expansion",
      "integrity",
      "realization",
    ];

    const currentIndex = stageOrder.indexOf(stage);
    return currentIndex < stageOrder.length - 1;
  }

  private async scheduleNextStage(
    currentStage: LifecycleStage,
    persistedData: any,
    context: LifecycleContext
  ): Promise<void> {
    logger.info("Scheduling next stage", { currentStage, persistedData });
    // Implementation would schedule the next stage
  }
}
