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
import { CommunicatorAgent } from "../lib/agent-fabric/agents/CommunicatorAgent";
import { BaseAgent } from "../lib/agent-fabric/agents/BaseAgent";
import { CircuitBreaker } from "../lib/resilience/CircuitBreaker";
import { logger } from "../lib/logger";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem";
import { AuditLogger } from "../lib/agent-fabric/AuditLogger";
import { AgentConfig } from "../types/agent";
import { workflowExecutionStore, WorkflowStatus } from "./WorkflowExecutionStore";
import { TargetAgentInputSchema } from "../validators/agentInputs";
import { z } from "zod";
import { agentTelemetryService } from "../agents/telemetry/AgentTelemetryService";

export type LifecycleStage =
  | "opportunity"
  | "target"
  | "expansion"
  | "communicator"
  | "integrity"
  | "realization";

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

export class LifecycleError extends Error {
  constructor(
    public stage: LifecycleStage,
    message: string,
    public originalError?: Error
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

const REPLAYABLE_STAGES = new Set<LifecycleStage>([
  "opportunity",
  "target",
  "expansion",
  "communicator",
]);
const DESTRUCTIVE_STAGES = new Set<LifecycleStage>(["integrity", "realization"]);

export class ValueLifecycleOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private compensations: Map<string, (() => Promise<void>)[]> = new Map();
  private supabase: ReturnType<typeof createClient>;
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private auditLogger: AuditLogger;

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
  }

  async executeLifecycleStage(
    stage: LifecycleStage,
    input: StageInput,
    context: LifecycleContext
  ): Promise<StageResult> {
    const traceId = agentTelemetryService.startExecutionTrace({
      sessionId: context.sessionId || uuidv4(),
      agentType: stage as any,
      userId: context.userId,
      organizationId: context.organizationId,
      query: `Execute ${stage} stage with input: ${JSON.stringify(input).substring(0, 100)}...`,
      parameters: { stage, input, context },
    });

    await this.ensureWorkflowActive(context);
    // ... (logic before agent creation remains the same) ...

    const startTime = Date.now();

    try {
      // Execute stage-specific agent
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

      await this.persistStageResults(stage, enrichedResult, context);

      // Add execution step and complete trace with success
      agentTelemetryService.addExecutionStep(traceId, {
        name: `${stage}_execution`,
        type: "agent_execution",
        description: `Execute ${stage} agent with input validation`,
      });

      agentTelemetryService.completeExecutionStep(traceId, `${stage}_execution`, result);

      const executionTime = Date.now() - startTime;
      agentTelemetryService.completeExecutionTrace(traceId, {
        success: result.success,
        data: result.data,
        confidence: result.confidence,
        assumptions: result.assumptions,
        error: result.error,
        metadata: {
          executionTime: executionTime,
          stageExecutionId: stageExecutionId,
          tokenUsage: { input: 0, output: 0, total: 0, cost: 0 }, // Would be populated by actual LLM calls
          retryCount: 0,
        },
      });

      return enrichedResult;
    } catch (error) {
      // Record telemetry error
      const executionTime = Date.now() - startTime;
      agentTelemetryService.recordExecutionError(
        traceId,
        error instanceof Error ? error : new Error(String(error)),
        {
          memoryUsage: process.memoryUsage().heapUsed,
          cpuUsage: 0, // Would need OS metrics
          networkIO: { bytesIn: 0, bytesOut: 0 },
          diskIO: { bytesRead: 0, bytesWritten: 0 },
        }
      );

      // Log and rethrow
      logger.error("Lifecycle stage execution failed", { stage, error, traceId });
      throw error;
    }

    // ... (rest of the logic remains the same) ...
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
      communicator: CommunicatorAgent,
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
      communicator: ["expansion_opportunity_id"],
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

  private async ensureWorkflowActive(context: LifecycleContext): Promise<void> {
    const workflowId = context.sessionId || context.organizationId || context.userId;
    if (!workflowId) {
      return;
    }

    const status: WorkflowStatus = await workflowExecutionStore.getStatus(workflowId);
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

  /**
   * Execute MARL handoff between agents for collaborative reasoning
   */
  async executeMARLHandoff(
    fromStage: LifecycleStage,
    toStage: LifecycleStage,
    sharedContext: Record<string, any>,
    lifecycleContext: LifecycleContext
  ): Promise<StageResult> {
    const traceId = agentTelemetryService.startExecutionTrace({
      sessionId: lifecycleContext.sessionId || uuidv4(),
      agentType: `${fromStage}_to_${toStage}_marl_handoff` as any,
      userId: lifecycleContext.userId,
      organizationId: lifecycleContext.organizationId,
      query: `MARL handoff from ${fromStage} to ${toStage}`,
      parameters: { fromStage, toStage, sharedContext },
    });

    try {
      // Get both agents
      const fromAgent = this.getAgentForStage(fromStage, lifecycleContext);
      const toAgent = this.getAgentForStage(toStage, lifecycleContext);

      // Create MARL state for handoff
      const marlState = {
        sessionId: lifecycleContext.sessionId || uuidv4(),
        agentStates: {
          [fromAgent.getAgentId()]: {
            stage: fromStage,
            lastOutput: sharedContext.lastOutput,
          },
          [toAgent.getAgentId()]: {
            stage: toStage,
            expectedInput: sharedContext.expectedInput,
          },
        },
        sharedContext: {
          handoffReason: sharedContext.handoffReason || "collaborative_reasoning",
          sharedMemory: sharedContext.sharedMemory || {},
          marlContext: sharedContext.marlContext || {},
        },
        interactionHistory: [],
        timestamp: Date.now(),
      };

      // Execute MARL-enhanced handoff
      const handoffResult = await this.performMARLHandoff(
        fromAgent,
        toAgent,
        marlState,
        sharedContext
      );

      agentTelemetryService.completeExecutionTrace(traceId, {
        success: handoffResult.success,
        data: handoffResult.data,
        confidence: handoffResult.confidence,
        assumptions: handoffResult.assumptions,
        error: handoffResult.error,
        metadata: {
          executionTime: Date.now() - Date.now(), // Would track actual time
          handoffType: "marl_collaborative",
        },
      });

      return handoffResult;
    } catch (error) {
      agentTelemetryService.recordExecutionError(
        traceId,
        error instanceof Error ? error : new Error(String(error)),
        { handoffFailed: true }
      );
      throw error;
    }
  }

  private async performMARLHandoff(
    fromAgent: BaseAgent,
    toAgent: BaseAgent,
    marlState: any,
    sharedContext: Record<string, any>
  ): Promise<StageResult> {
    // Share episodic memory between agents
    await fromAgent.shareEpisodicMemory(toAgent);
    await toAgent.shareEpisodicMemory(fromAgent);

    // Allow agents to select MARL actions
    const fromAction = await fromAgent.selectMARLAction(marlState);
    const toAction = await toAgent.selectMARLAction(marlState);

    // Execute the handoff with MARL-enhanced context
    const enhancedContext = {
      ...sharedContext,
      marlActions: {
        fromAgent: fromAction,
        toAgent: toAction,
      },
      collaborativeMemory: this.mergeAgentMemories(fromAgent, toAgent),
    };

    // Execute the target agent with enhanced context
    const result = await this.circuitBreaker.execute(async () => {
      if (!marlState.sessionId) {
        throw new Error("Session ID is required for MARL handoff.");
      }
      return await toAgent.execute(marlState.sessionId, enhancedContext);
    });

    // Create MARL interaction record
    const interaction = {
      interactionId: `handoff-${fromAgent.getAgentId()}-${toAgent.getAgentId()}-${Date.now()}`,
      state: marlState,
      actions: [fromAction, toAction].filter((action) => action !== null),
      rewards: {
        [fromAgent.getAgentId()]: fromAgent.calculateMARLReward(
          marlState,
          fromAction || ({} as any),
          {
            ...marlState,
            sharedContext: { ...marlState.sharedContext, result },
          }
        ),
        [toAgent.getAgentId()]: toAgent.calculateMARLReward(marlState, toAction || ({} as any), {
          ...marlState,
          sharedContext: { ...marlState.sharedContext, result },
        }),
      },
      nextState: {
        ...marlState,
        sharedContext: { ...marlState.sharedContext, result },
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };

    // Update MARL policies
    await fromAgent.updateMARLPolicy(interaction);
    await toAgent.updateMARLPolicy(interaction);

    return {
      success: result.success,
      data: result.data,
      confidence: result.confidence,
      assumptions: result.assumptions,
      error: result.error,
      stageExecutionId: uuidv4(),
      lineage: {
        stage: "communicator" as LifecycleStage, // Handoff creates a new lineage
        parentExecutionId: sharedContext.parentExecutionId,
      },
    };
  }

  private mergeAgentMemories(fromAgent: BaseAgent, toAgent: BaseAgent): any {
    // Merge episodic memories for collaborative reasoning
    const fromMemory = fromAgent.getMARLHistory();
    const toMemory = toAgent.getMARLHistory();

    // Simple merge - in practice, this would be more sophisticated
    return {
      fromAgent: fromMemory.slice(-5), // Last 5 interactions
      toAgent: toMemory.slice(-5),
      mergedInsights: this.extractCollaborativeInsights(fromMemory, toMemory),
    };
  }

  private extractCollaborativeInsights(fromMemory: any[], toMemory: any[]): any {
    // Extract patterns and insights from combined agent memories
    // This is a simplified implementation
    const insights = {
      successfulPatterns: [],
      failurePatterns: [],
      collaborationOpportunities: [],
    };

    // Analyze interaction patterns
    const allInteractions = [...fromMemory, ...toMemory];
    const successfulInteractions = allInteractions.filter((i) =>
      Object.values(i.rewards).every((r: any) => r > 0)
    );

    insights.successfulPatterns = successfulInteractions.map((i) => ({
      actions: i.actions.map((a: any) => a.actionType),
      avgReward:
        Object.values(i.rewards).reduce((sum: number, r: any) => sum + r, 0) /
        Object.keys(i.rewards).length,
    }));

    return insights;
  }
}
