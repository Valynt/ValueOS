/**
 * UnifiedAgentOrchestrator
 *
 * @deprecated Sprint 4: This class is now a pure facade over the five runtime
 * services in `packages/backend/src/runtime/`. All substantive logic has been
 * extracted. This file will be deleted in Sprint 5 once all consumers have
 * been migrated to import directly from the runtime services.
 *
 * Migration guide:
 *  - processQuery / processQueryAsync / getAsyncQueryResult → ExecutionRuntime
 *  - executeWorkflow / executeDAGAsync / executeStage* → ExecutionRuntime
 *  - evaluateIntegrityVeto / assertTenantExecutionAllowed → PolicyEngine
 *  - getExecutionStatus / getExecutionLogs → ContextStore
 *  - generateSDUIPage / generateAndRenderPage / planTask → ArtifactComposer
 *  - collectScheduledComplianceEvidence → PolicyEngine
 */

import { SDUIPageDefinition } from "@sdui/schema";
import { v4 as uuidv4 } from "uuid";
import * as z from "zod";

import { AgentType } from "./agent-types.js";
import { AgentContext } from "./AgentAPI.js";
import { AgentResponsePayload, WorkflowContextDTO } from "../types/workflow/orchestration.js";
import { WorkflowExecutionLogDTO, WorkflowExecutionStatusDTO } from "../types/execution/workflowExecutionDtos.js";
import { StageExecutionResultDTO, StageRouteDTO, WorkflowStageContextDTO } from "../types/workflow/runner.js";
import { WorkflowState } from "../repositories/WorkflowStateRepository.js";
import { WorkflowStatus } from "../types/index.js";
import { WorkflowDAG, WorkflowStage } from "../types/workflow.js";
import { WorkflowExecutionRecord } from "../types/workflowExecution.js";

import { PolicyEngine, type ServiceReadiness } from "../runtime/policy-engine/index.js";
import { ContextStore } from "../runtime/context-store/index.js";
import { ExecutionRuntime } from "../runtime/execution-runtime/index.js";
import { ArtifactComposer } from "../runtime/artifact-composer/index.js";
import { DecisionRouter } from "../runtime/decision-router/index.js";
import { supabase } from "../lib/supabase.js";
import { AgentRegistry } from "./AgentRegistry.js";

// ============================================================================
// Re-exported types (preserved for consumer compatibility)
// ============================================================================

export interface AgentMiddlewareContext {
  envelope: ExecutionEnvelope;
  query: string;
  currentState: WorkflowState;
  userId: string;
  sessionId: string;
  traceId: string;
  agentType: AgentType;
  payload?: unknown;
}

export interface AgentMiddleware {
  name: string;
  execute(context: AgentMiddlewareContext, next: () => Promise<AgentResponse>): Promise<AgentResponse>;
}

export class IntegrityVetoMiddleware implements AgentMiddleware {
  public readonly name = "integrity_veto";
  constructor(private orchestrator: UnifiedAgentOrchestrator) {}
  async execute(context: AgentMiddlewareContext, next: () => Promise<AgentResponse>): Promise<AgentResponse> {
    const response = await next();
    if (response.payload) {
      const vetoResult = await this.orchestrator.evaluateIntegrityVeto(response.payload, {
        traceId: context.traceId, agentType: context.agentType, query: context.query,
        context: { userId: context.userId, sessionId: context.sessionId, organizationId: context.envelope.organizationId },
      });
      if (vetoResult.vetoed) {
        return { type: "message", payload: { message: "Output failed integrity validation against ground truth benchmarks.", error: true }, metadata: vetoResult.metadata };
      }
    }
    return response;
  }
}

import { AgentRoutingLayer, StageRoute } from "./AgentRoutingLayer.js";
import { DecisionRouter } from "../runtime/decision-router/index.js";
import { DecisionContext } from "@shared/domain/DecisionContext.js";
import { OpportunityLifecycleStageSchema } from "@shared/domain/Opportunity.js";
import {
  AgentCapability,
  AgentConfiguration,
  AgentMetadata,
  AgentPerformanceMetrics,
  AgentRequest,
  IAgent,
  AgentHealthStatus as RetryAgentHealthStatus,
  AgentResponse as RetryAgentResponse,
  ValidationResult,
} from "./agents/core/IAgent.js";
import { AgentRetryManager, RetryOptions } from "./agents/resilience/AgentRetryManager.js";
import { getEnhancedParallelExecutor, RunnableTask } from "./EnhancedParallelExecutor.js";
import { WorkflowExecutionStore as WorkflowExecutionStoreService } from "./workflows/WorkflowExecutionStore";
import { DelegatingWorkflowRunner } from "./workflows/WorkflowRunner";
import { DefaultIntegrityVetoService } from "./workflows/IntegrityVetoService";
import { DefaultWorkflowSimulationService } from "./workflows/WorkflowSimulationService";
import { DefaultWorkflowRenderService } from "./workflows/WorkflowRenderService";

// ============================================================================
// Types
// ============================================================================

export type RenderPageOptions = Record<string, unknown>;

export interface AgentResponse {
  type: "component" | "message" | "suggestion" | "sdui-page";
  payload: AgentResponsePayload;
  streaming?: boolean;
  sduiPage?: SDUIPageDefinition;
  metadata?: IntegrityVetoMetadata;
}

export interface IntegrityVetoMetadata {
  integrityVeto: true;
  deviationPercent: number;
  benchmark: number;
  metricId: string;
  claimedValue: number;
  warning?: string;
}

export interface StreamingUpdate {
  stage: "thinking" | "executing" | "completed" | "analyzing" | "processing" | "complete";
  message: string;
  progress?: number;
}

export interface ProcessQueryResult {
  response: AgentResponse | null;
  nextState: WorkflowState;
  traceId: string;
}

export interface WorkflowExecutionResult {
  executionId: string;
  status: WorkflowStatus;
  currentStage: string | null;
  completedStages: string[];
  error?: string;
}

export interface TaskPlanResult {
  taskId: string;
  subgoals: SubgoalDefinition[];
  executionOrder: string[];
  complexityScore: number;
  requiresSimulation: boolean;
}

export interface SubgoalDefinition {
  id: string;
  type: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  priority: number;
  estimatedComplexity: number;
}

export interface SimulationResult {
  simulation_id: string;
  workflow_definition_id: string;
  predicted_outcome: Record<string, unknown>;
  confidence_score: number;
  risk_assessment: Record<string, unknown>;
  steps_simulated: Record<string, unknown>[];
  duration_estimate_seconds: number;
  success_probability: number;
}

export interface ExecutionIntentActor { id: string; type?: string; roles?: string[]; }
export interface ExecutionIntentTimestamps { requestedAt: string; approvedAt?: string; expiresAt?: string; }
export interface ExecutionIntent { intent: string; actor: ExecutionIntentActor; organizationId: string; entryPoint: string; reason: string; timestamps: ExecutionIntentTimestamps; }
export interface ExecutionEnvelope extends ExecutionIntent {}

export interface OrchestratorConfig {
  enableWorkflows: boolean;
  enableTaskPlanning: boolean;
  enableSDUI: boolean;
  enableSimulation: boolean;
  defaultTimeoutMs: number;
  maxRetryAttempts: number;
  maxConcurrent?: number;
  timeout?: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableWorkflows: true, enableTaskPlanning: true, enableSDUI: true,
  enableSimulation: true, defaultTimeoutMs: 30000, maxRetryAttempts: 3,
};

// Zod schemas retained for consumers that import them directly.
export const executionIntentSchema = z.object({
  intent: z.string().min(1),
  actor: z.object({ id: z.string().min(1), type: z.string().optional(), roles: z.array(z.string()).optional() }),
  organizationId: z.string().min(1),
  entryPoint: z.string().min(1),
  reason: z.string().min(1),
  timestamps: z.object({ requestedAt: z.string(), approvedAt: z.string().optional(), expiresAt: z.string().optional() }),
});

// ============================================================================
// Facade
// ============================================================================

/**
 * @deprecated Use the runtime services directly. See file-level JSDoc.
 */
export class UnifiedAgentOrchestrator {
  private agentAPI = getAgentAPI();
  private registry: AgentRegistry;
  private routingLayer: AgentRoutingLayer;
  /** Facade: all routing decisions delegate here. Replaces direct routingLayer + selectAgent calls. */
  private decisionRouter: DecisionRouter;
  private circuitBreakers: CircuitBreakerManager;
  private config: OrchestratorConfig;
  private memorySystem: MemorySystem;
  private llmGateway: LLMGateway;
  private messageBroker: AgentMessageBroker;
  private agentMessageQueue: AgentMessageQueue;
  private retryManager = AgentRetryManager.getInstance();
  private agentInvocationTimes: Map<string, number[]> = new Map();
  private maxAgentInvocationsPerMinute = 20; // Conservative limit per agent type
  private groundTruthService = GroundTruthIntegrationService.getInstance();
  // Stored Promise so concurrent callers await the same initialization rather
  // than racing past the boolean check and calling initialize() multiple times.
  private groundTruthInitPromise: Promise<void> | null = null;
  private confidenceMonitor: ConfidenceMonitor;
  private maxReRefineAttempts = 2; // Default number of refine attempts
  private middleware: AgentMiddleware[] = [];
  private executionStateService = new TenantExecutionStateService(supabase);
  private executionStore: WorkflowExecutionStoreService;
  private workflowRunner: DelegatingWorkflowRunner;
  private integrityVetoService: DefaultIntegrityVetoService;
  private workflowSimulationService: DefaultWorkflowSimulationService;
  private workflowRenderService: DefaultWorkflowRenderService;

  constructor(configOrRegistry?: Partial<OrchestratorConfig> | AgentRegistry, ...rest: unknown[]) {
    // Support both factory-style (single config) and full-param construction
    if (configOrRegistry instanceof AgentRegistry) {
      this.registry = configOrRegistry;
      this.routingLayer = rest[0] as AgentRoutingLayer;
      this.circuitBreakers = rest[1] as CircuitBreakerManager;
      this.config = rest[2] as OrchestratorConfig;
      this.memorySystem = rest[3] as MemorySystem;
      this.llmGateway = rest[4] as LLMGateway;
      this.messageBroker = rest[5] as AgentMessageBroker;
      this.agentMessageQueue = rest[6] as AgentMessageQueue;
      this.decisionRouter = new DecisionRouter(this.routingLayer);
    } else {
      const cfg = (configOrRegistry ?? {}) as Partial<OrchestratorConfig>;
      this.config = {
        maxConcurrent: cfg.maxConcurrent ?? 5,
        timeout: cfg.timeout ?? 30_000,
        ...cfg,
      } as OrchestratorConfig;
      this.registry = new AgentRegistry();
      this.routingLayer = new AgentRoutingLayer();
      this.decisionRouter = new DecisionRouter(this.routingLayer);
      this.circuitBreakers = new CircuitBreakerManager();
      this.memorySystem = new MemorySystem(
        { max_memories: 1000, enable_persistence: true },
        new SupabaseMemoryBackend(semanticMemory),
      );
      this.llmGateway = new LLMGateway({ provider: "openai", model: "gpt-4o-mini" });
      this.messageBroker = new AgentMessageBroker();
      this.agentMessageQueue = new AgentMessageQueue();
    }

    // Initialize services
    this.confidenceMonitor = new ConfidenceMonitor(supabase);
    this.executionStore = new WorkflowExecutionStoreService(supabase as never);
    this.workflowRunner = new DelegatingWorkflowRunner({
      executeDAGAsync: this.executeDAGAsync.bind(this),
      executeStageWithRetry: this.executeStageWithRetry.bind(this),
      executeStage: this.executeStage.bind(this),
    });
    this.integrityVetoService = new DefaultIntegrityVetoService({
      agentAPI: this.agentAPI,
      evaluateClaim: async (metricId, claimedValue, options) => {
        const validation = await this.executeGroundTruthToolCall<{ warning?: string; benchmark?: { p50?: number } }>(
          {
            toolName: "eso_validate_claim",
            payload: { metricId, claimedValue },
            traceId: options.traceId,
            context: options.context,
          },
        );
        const metricValue = await this.executeGroundTruthToolCall<{ value?: number }>(
          {
            toolName: "eso_get_metric_value",
            payload: { metricId, percentile: "p50" },
            traceId: options.traceId,
            context: options.context,
          },
        );
        return { benchmarkValue: metricValue.value ?? validation.benchmark?.p50, warning: validation.warning };
      },
      getAverageConfidence: async (agentType) => (await this.confidenceMonitor.getMetrics(agentType, "hour")).avgConfidenceScore,
      logVeto: async (agentType, query, payload, options, metadata) => {
        await logAgentResponse(agentType, query, false, payload, { traceId: options.traceId, stageId: options.stageId, integrityVeto: metadata }, "integrity_veto", options.context);
      },
      invokeRefinement: async (agentType, prompt, context, attempt) => {
        const circuitBreakerKey = `query-${agentType}-refine-${attempt}`;
        const result = await this.circuitBreakers.execute(circuitBreakerKey, () => this.agentAPI.invokeAgent({ agent: agentType, query: prompt, context }), { timeoutMs: this.config.defaultTimeoutMs });
        return { success: Boolean(result?.success), data: result?.data };
      },
      maxReRefineAttempts: this.maxReRefineAttempts,
    });
    this.workflowSimulationService = new DefaultWorkflowSimulationService(
      this.llmGateway,
      this.memorySystem,
      async (workflowDefinitionId) => {
        const { data: definition, error } = await supabase.from("workflow_definitions").select("*").eq("id", workflowDefinitionId).eq("is_active", true).maybeSingle();
        if (error || !definition) throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
        return definition as { dag_schema: WorkflowDAG };
      },
      () => this.config.enableSimulation,
    );
    this.workflowRenderService = new DefaultWorkflowRenderService(this.agentAPI, (envelope) => this.validateExecutionIntent(envelope), () => this.config.enableSDUI);

    // Initialize middleware
    this.initializeMiddleware();
  }

  /**
   * Returns checkpoint middleware for HITL (Human-in-the-Loop) endpoints.
   * Returns null when no checkpoint system is configured.
   */
  getCheckpointMiddleware(): null {
    return null;
  }

  private initializeMiddleware(): void {
    this.middleware.push(new IntegrityVetoMiddleware(this));
  }


  private async assertTenantExecutionAllowed(organizationId: string): Promise<void> {
    const state = await this.executionStateService.getActiveState(organizationId);
    if (!state?.is_paused) {
      return;
    }

    const pausedAt = state.paused_at ?? 'unknown';
    const reason = state.reason ?? 'No reason provided';
    throw new Error(
      `Tenant execution is paused for organization ${organizationId}. reason=${reason}; paused_at=${pausedAt}`,
    );
  }

  private ensureGroundTruthInitialized(): Promise<void> {
    this.groundTruthInitPromise ??= this.groundTruthService.initialize().catch((err) => {
      // Clear the cached promise so the next caller retries rather than
      // re-throwing the same rejection indefinitely.
      this.groundTruthInitPromise = null;
      throw err;
    });
    return this.groundTruthInitPromise;
  }

  private async executeGroundTruthToolCall<T>(params: {
    toolName: string;
    payload: Record<string, unknown>;
    traceId: string;
    context?: Record<string, unknown> | AgentContext;
  }): Promise<T> {
    await this.ensureGroundTruthInitialized();
    if (params.toolName === "eso_get_metric_value") {
      const result = await this.groundTruthService.getBenchmark(
        params.payload.metricId as string,
        params.payload.percentile as "p25" | "p50" | "p75" | undefined,
      );
      return result as T;
    }
    if (params.toolName === "eso_validate_claim") {
      const result = await this.groundTruthService.validateClaim(
        params.payload.metricId as string,
        params.payload.claimedValue as number,
      );
      return result as T;
    }
    throw new Error(`Unknown ground truth tool: ${params.toolName}`);
  }


  public async evaluateIntegrityVeto(
    payload: unknown,
    options: {
      traceId: string;
      agentType: AgentType;
      query?: string;
      stageId?: string;
      context?: AgentContext;
    }
  ): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata; reRefine?: boolean }> {
    return this.integrityVetoService.evaluateIntegrityVeto(payload, options);
  }

  private async evaluateStructuralTruthVeto(
    payload: unknown,
    options: {
      traceId: string;
      agentType: AgentType;
      query?: string;
      stageId?: string;
      context?: AgentContext;
    }
  ): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata }> {
    return this.integrityVetoService.evaluateStructuralTruthVeto(payload, options);
  }

  private async performReRefine(
    agentType: AgentType,
    originalQuery: string,
    agentContext: AgentContext,
    traceId: string,
    maxAttempts: number = this.maxReRefineAttempts
  ): Promise<{ success: boolean; response?: unknown; attempts: number }> {
    return this.integrityVetoService.performReRefine(agentType, originalQuery, agentContext, traceId, maxAttempts);
  }

  private normalizeExecutionRequest(intent: string, execution: Partial<ExecutionRequest> & Record<string, unknown>): Partial<ExecutionRequest> & { intent: string } {
    return { ...execution, intent };
  }


  /**
   * Check if agent invocation rate limit is exceeded
   */
  private checkAgentRateLimit(agentType: AgentType): boolean {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const times = this.agentInvocationTimes.get(agentType) || [];

    // Remove invocations outside the window
    const validTimes = times.filter((time) => now - time < windowMs);

    // Check if we're within limits
    if (validTimes.length >= this.maxAgentInvocationsPerMinute) {
      logger.warn("Agent rate limit exceeded", {
        agentType,
        invocationCount: validTimes.length,
        limit: this.maxAgentInvocationsPerMinute,
      });
      return false;
    }

    // Add current invocation
    validTimes.push(now);
    this.agentInvocationTimes.set(agentType, validTimes);

    return true;
  }

  /**
   * Process a user query with given workflow state
   *
   * @param query User query
   * @param currentState Current workflow state
   * @param userId User identifier
   * @param sessionId Session identifier
   * @param traceId Trace ID for logging
   * @returns Job ID for tracking async execution
   */
  async processQueryAsync(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4()
  ): Promise<{ jobId: string; traceId: string }> {
    this.validateExecutionIntent(envelope);

    if (
      currentState.context?.organizationId &&
      currentState.context?.organizationId !== envelope.organizationId
    ) {
      throw new Error("Execution envelope organization does not match workflow state");
    }

    await this.assertTenantExecutionAllowed(envelope.organizationId);

    logger.info("Processing query asynchronously", {
      traceId,
      sessionId,
      userId,
      currentStage: currentState.currentStage,
      queryLength: query.length,
    });

    // Determine which agent to use based on domain state
    const agentType = this.decisionRouter.selectAgent(
      this.buildDecisionContext(currentState, envelope.organizationId)
    );

    // Check inter-agent rate limit
    if (!this.checkAgentRateLimit(agentType)) {
      throw new Error(`Agent ${agentType} rate limit exceeded`);
    }

    logger.debug("Agent selected for async execution", {
      traceId,
      agentType,
      currentStage: currentState.currentStage,
    });

    // Build agent context
    const agentContext: AgentContext = {
      userId: envelope.actor.id || userId,
      sessionId,
      organizationId: envelope.organizationId,
      metadata: {
        companyProfile: currentState.context?.companyProfile,
        currentStage: currentState.currentStage,
      },
    };

    // Queue agent invocation for async processing
    const jobId = await this.agentMessageQueue.queueAgentInvocation({
      agent: agentType,
      query,
      context: agentContext,
      sessionId,
      organizationId: envelope.organizationId,
      userId,
      traceId,
      correlationId: traceId,
    });

    logger.info("Agent invocation queued asynchronously", {
      jobId,
      traceId,
      agentType,
      sessionId,
    });

    return { jobId, traceId };
  }

  /**
   * Get the result of an asynchronous query
   *
   * @param jobId The job ID returned from processQueryAsync
   * @param currentState Current workflow state to update if result is ready
   * @returns Result with response and next state, or null if still processing
   */
  async getAsyncQueryResult(
    jobId: string,
    currentState: WorkflowState
  ): Promise<ProcessQueryResult | null> {
    const result = await this.agentMessageQueue.getJobResult(jobId);

    if (!result) {
      // Job is still processing
      return null;
    }

    if (!result.success) {
      logger.error("Async agent invocation failed", {
        jobId,
        error: result.error,
        traceId: result.traceId,
      });

      // Return error state
      const errorState: WorkflowState = {
        ...currentState,
        status: "error",
        context: {
          ...currentState.context,
          lastError: result.error || "Agent invocation failed",
          errorTimestamp: new Date().toISOString(),
        },
      };

      return {
        response: {
          type: "message",
          payload: {
            message: result.error || "Agent request failed",
            error: true,
          },
        },
        nextState: errorState,
        traceId: result.traceId,
      };
    }

    // Job completed successfully
    logger.info("Async agent invocation completed", {
      jobId,
      traceId: result.traceId,
      executionTime: result.executionTime,
    });

    const structuralCheck = await this.evaluateStructuralTruthVeto(result.data, {
      traceId: result.traceId,
      agentType: "coordinator",
      query: "async-query-result",
    });
    if (structuralCheck.vetoed) {
      const response: AgentResponse = {
        type: "message",
        payload: {
          message: "Output failed structural truth validation against expected schema.",
          error: true,
        },
        metadata: structuralCheck.metadata,
      };

      return {
        response,
        nextState: currentState,
        traceId: result.traceId,
      };
    }

    let integrityCheck = await this.evaluateIntegrityVeto(result.data, {
      traceId: result.traceId,
      agentType: "coordinator",
      query: "async-query-result",
    });

    if (integrityCheck.reRefine) {
      logger.info("Triggering async RE-REFINE loop due to low confidence", {
        traceId: result.traceId,
        agentType: "coordinator",
      });

      const agentContext: AgentContext = {
        userId: String(currentState.context?.requestedBy || currentState.context?.requester || "system"),
        sessionId: String(currentState.context?.sessionId || ""),
        organizationId: String(currentState.context?.organizationId || ""),
        metadata: { currentStage: currentState.currentStage },
      };

      const re = await this.performReRefine(
        "coordinator",
        `Refine based on prior async output: ${JSON.stringify(result.data).slice(0, 1000)}`,
        agentContext,
        result.traceId
      );

      if (re.success && re.response) {
        // Replace result.data with refined response
        result.data = re.response.data;
        integrityCheck = await this.evaluateIntegrityVeto(result.data, {
          traceId: result.traceId,
          agentType: "coordinator",
          query: "async-query-result",
        });
      } else {
        const response: AgentResponse = {
          type: "message",
          payload: {
            message:
              "Unable to auto-refine response. Please try again or request manual review.",
            error: true,
          },
        };

        return {
          response,
          nextState: currentState,
          traceId: result.traceId,
        };
      }
    }

    if (integrityCheck.vetoed) {
      const response: AgentResponse = {
        type: "message",
        payload: {
          message: "Output failed integrity validation against ground truth benchmarks.",
          error: true,
        },
        metadata: integrityCheck.metadata,
      };

      return {
        response,
        nextState: currentState,
        traceId: result.traceId,
      };
    }

    // Create immutable copy of state
    const nextState: WorkflowState = {
      ...currentState,
      context: { ...(currentState.context ?? {}) },
      completed_steps: [...currentState.completed_steps],
    };

    // Update state based on response
    if (result.data) {
      nextState.context!.conversationHistory = [
        ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
        {
          role: "user",
          content: "Async query", // We don't have the original query here
          timestamp: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: typeof result.data === "string" ? result.data : JSON.stringify(result.data),
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // Update status
    nextState.status = "in_progress";

    // Build response
    const response: AgentResponse = {
      type: "message",
      payload: {
        message: typeof result.data === "string" ? result.data : JSON.stringify(result.data),
      },
    };

    logger.info("Async query result processed", {
      jobId,
      traceId: result.traceId,
      responseType: response.type,
    });

    return {
      response,
      nextState,
      traceId: result.traceId,
    };
  }

  /**
   * Process a user query with given workflow state
   */
  async processQuery(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4()
  ): Promise<ProcessQueryResult> {
    await this.assertTenantExecutionAllowed(envelope.organizationId);

    // Check if async execution is enabled
    const { featureFlags } = await import("../config/featureFlags.js");
    if (featureFlags.ENABLE_ASYNC_AGENT_EXECUTION) {
      logger.info("Using async agent execution", { traceId, sessionId });

      // Queue async execution
      const { jobId } = await this.processQueryAsync(
        envelope,
        query,
        currentState,
        userId,
        sessionId,
        traceId
      );

      // Wait for completion (with reasonable timeout)
      const result = await this.agentMessageQueue.waitForJobCompletion(
        jobId,
        60000
      ); // 60s timeout

      if (!result.success) {
        throw new Error(result.error || "Async agent execution failed");
      }

      const asyncAgentType = this.decisionRouter.selectAgent(
        this.buildDecisionContext(currentState, envelope.organizationId)
      );
      const structuralCheck = await this.evaluateStructuralTruthVeto(
        result.data,
        {
          traceId,
          agentType: asyncAgentType,
          query,
          context: {
            userId: envelope.actor.id || userId,
            sessionId,
            organizationId: envelope.organizationId,
          },
        }
      );
      if (structuralCheck.vetoed) {
        const response: AgentResponse = {
          type: "message",
          payload: {
            message:
              "Output failed structural truth validation against expected schema.",
            error: true,
          },
          metadata: structuralCheck.metadata,
        };

        return {
          response,
          nextState: currentState,
          traceId,
        };
      }

      const integrityCheck = await this.evaluateIntegrityVeto(result.data, {
        traceId,
        agentType: asyncAgentType,
        query,
        context: {
          userId: envelope.actor.id || userId,
          sessionId,
          organizationId: envelope.organizationId,
        },
      });
      if (integrityCheck.vetoed) {
        const response: AgentResponse = {
          type: "message",
          payload: {
            message:
              "Output failed integrity validation against ground truth benchmarks.",
            error: true,
          },
          metadata: integrityCheck.metadata,
        };

        return {
          response,
          nextState: currentState,
          traceId,
        };
      }

      // Convert async result to sync result format
      const nextState: WorkflowState = {
        ...currentState,
        context: { ...(currentState.context ?? {}) },
        completed_steps: [...currentState.completed_steps],
      };

      // Update state based on async result
      if (result.data) {
        nextState.context!.conversationHistory = [
          ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
          {
            role: "user",
            content: query,
            timestamp: new Date().toISOString(),
          },
          {
            role: "assistant",
            content:
              typeof result.data === "string"
                ? result.data
                : JSON.stringify(result.data),
            timestamp: new Date().toISOString(),
          },
        ];
      }

      nextState.status = "in_progress";

      const response: AgentResponse = {
        type: "message",
        payload: {
          message:
            typeof result.data === "string"
              ? result.data
              : JSON.stringify(result.data),
        },
      };

      return {
        response,
        nextState,
        traceId: result.traceId,
      };
    }

    // Original synchronous execution path
    const tracer = getTracer();

    return tracer.startActiveSpan(
      'agent.processQuery',
      {
        attributes: {
          'agent.query': query,
          'agent.user_id': userId,
          'agent.session_id': sessionId,
          'agent.trace_id': traceId,
          'agent.organization_id': envelope.organizationId,
        },
      },
      async (rootSpan: Span) => {
    const processQueryStart = Date.now();

    try {
      // Create immutable copy of state
      const nextState: WorkflowState = {
        ...currentState,
        context: { ...(currentState.context ?? {}) },
        completed_steps: [...currentState.completed_steps],
      };

      // Determine which agent to use based on query and current stage.
      // startActiveSpan executes the callback synchronously, so agentType
      // is assigned before the code below runs.
      let agentType: AgentType;
      tracer.startActiveSpan('agent.selectAgent', (selectSpan: Span) => {
        agentType = this.decisionRouter.selectAgent(
          this.buildDecisionContext(currentState, envelope.organizationId)
        );
        selectSpan.setAttributes({
          'agent.selected_type': agentType,
          'agent.routing_strategy': currentState.currentStage ? 'stage-based' : 'intent-based',
        });
        selectSpan.setStatus({ code: SpanStatusCode.OK });
        selectSpan.end();
      });
      agentType ??= "discovery" as AgentType;

      // Check inter-agent rate limit
      if (!this.checkAgentRateLimit(agentType)) {
        throw new Error(`Agent ${agentType} rate limit exceeded`);
      }

      logger.debug("Agent selected", {
        traceId,
        agentType,
        currentStage: currentState.currentStage,
      });

      // Build agent context
      const agentContext: AgentContext = {
        userId: envelope.actor.id || userId,
        sessionId,
        organizationId: envelope.organizationId,
        metadata: {
          companyProfile: currentState.context?.companyProfile,
          currentStage: currentState.currentStage,
        },
      };

      // Call agent with circuit breaker protection
      const circuitBreakerKey = `query-${agentType}`;
      let agentResponse = await this.circuitBreakers.execute(
        circuitBreakerKey,
        () =>
          this.agentAPI.invokeAgent({
            agent: agentType,
            query,
            context: agentContext,
          }),
        { timeoutMs: this.config.defaultTimeoutMs }
      );

      if (agentResponse.success) {
        const structuralCheck = await this.evaluateStructuralTruthVeto(
          agentResponse.data,
          {
            traceId,
            agentType,
            query,
            context: agentContext,
          }
        );
        if (structuralCheck.vetoed) {
          const response: AgentResponse = {
            type: "message",
            payload: {
              message:
                "Output failed structural truth validation against expected schema.",
              error: true,
            },
            metadata: structuralCheck.metadata,
          };

          return {
            response,
            nextState: currentState,
            traceId,
          };
        }

        const integrityCheck = await this.evaluateIntegrityVeto(
          agentResponse.data,
          {
            traceId,
            agentType,
            query,
            context: agentContext,
          }
        );

        if (integrityCheck.reRefine) {
          logger.info("Triggering RE-REFINE loop due to low confidence", {
            traceId,
            agentType,
            sessionId,
          });

          const re = await this.performReRefine(agentType, query, agentContext, traceId);
          if (re.success && re.response) {
            // Replace agentResponse with refined result
            agentResponse = re.response;
          } else {
            const response: AgentResponse = {
              type: "message",
              payload: {
                message:
                  "Unable to auto-refine response. Please try again or request manual review.",
                error: true,
              },
            };

            return {
              response,
              nextState: currentState,
              traceId,
            };
          }
        }

        if (integrityCheck.vetoed) {
          const response: AgentResponse = {
            type: "message",
            payload: {
              message:
                "Output failed integrity validation against ground truth benchmarks.",
              error: true,
            },
            metadata: integrityCheck.metadata,
          };

          return {
            response,
            nextState: currentState,
            traceId,
          };
        }
      }

      // Update state based on response
      if (agentResponse.success && agentResponse.data) {
        nextState.context!.conversationHistory = [
          ...(Array.isArray(nextState.context!.conversationHistory) ? nextState.context!.conversationHistory : []),
          {
            role: "user",
            content: query,
            timestamp: new Date().toISOString(),
          },
          {
            role: "assistant",
            content:
              typeof agentResponse.data === "string"
                ? agentResponse.data
                : JSON.stringify(agentResponse.data),
            timestamp: new Date().toISOString(),
          },
        ];
      }

      // Update status based on response
      nextState.status = agentResponse.success ? "in_progress" : "completed";

      // Build response
      const response: AgentResponse = {
        type: "message",
        payload: agentResponse.success
          ? {
              message:
                typeof agentResponse.data === "string"
                  ? agentResponse.data
                  : JSON.stringify(agentResponse.data),
            }
          : {
              message: agentResponse.error || "Agent request failed",
              error: true,
            },
      };

      logger.info("Query processed successfully", {
        traceId,
        sessionId,
        nextStage: nextState.currentStage,
        responseType: response.type,
      });

      rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - processQueryStart });
      rootSpan.setStatus({ code: SpanStatusCode.OK });
      rootSpan.end();

      return {
        response,
        nextState,
        traceId,
      };
    } catch (error) {
      logger.error(
        "Error processing query",
        error instanceof Error ? error : undefined,
        {
          traceId,
          sessionId,
          userId,
        }
      );

      rootSpan.setAttributes({ 'agent.latency_ms': Date.now() - processQueryStart });
      rootSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      if (error instanceof Error) rootSpan.recordException(error);
      rootSpan.end();

      // Return error state
      const errorState: WorkflowState = {
        ...currentState,
        status: "error",
        context: {
          ...currentState.context,
          lastError: error instanceof Error ? error.message : "Unknown error",
          errorTimestamp: new Date().toISOString(),
        },
      };

      return {
        response: {
          type: "message",
          payload: {
            message:
              "I encountered an error processing your request. Please try again.",
            error: true,
          },
        },
        nextState: errorState,
        traceId,
      };
    }

    }); // end startActiveSpan
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Initialize a new workflow state
   */
  createInitialState(
    initialStage: string,
    execution: Partial<ExecutionRequest> & Record<string, unknown> = {
      intent: "FullValueAnalysis",
      environment: "production",
    }
  ): WorkflowState {
    const normalizedExecution = this.normalizeExecutionRequest("agent-query", execution);
    const now = new Date().toISOString();

    return {
      id: uuidv4(),
      workflow_id: "",
      execution_id: uuidv4(),
      workspace_id: "",
      organization_id: "",
      lifecycle_stage: initialStage,
      current_step: initialStage,
      currentStage: initialStage,
      status: "initiated",
      completed_steps: [],
      state_data: {},
      context: {
        ...(normalizedExecution as Record<string, unknown>),
        conversationHistory: [],
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Update workflow stage (pure function)
   */
  updateStage(currentState: WorkflowState, stage: string, status: WorkflowStatus): WorkflowState {
    const nextState: WorkflowState = {
      ...currentState,
      currentStage: stage,
      status,
      completed_steps: [...currentState.completed_steps],
    };

    if (status === "completed" && currentState.currentStage && !nextState.completed_steps.includes(currentState.currentStage)) {
      nextState.completed_steps.push(currentState.currentStage);
    }

    return nextState;
  }

  // ==========================================================================
  // Workflow DAG Execution (from WorkflowOrchestrator)
  // ==========================================================================

  /**
   * Execute a workflow DAG
   */
  async executeWorkflow(
    envelope: ExecutionEnvelope,
    workflowDefinitionId: string,
    context: WorkflowContextDTO = {},
    userId?: string
  ): Promise<WorkflowExecutionResult> {
    this.validateExecutionIntent(envelope);
    if (!this.config.enableWorkflows) {
      throw new Error("Workflow execution is disabled");
    }

    await this.assertTenantExecutionAllowed(envelope.organizationId);

    const traceId = uuidv4();
    logger.info("Starting workflow execution", {
      traceId,
      workflowDefinitionId,
      userId,
    });

    try {
      // Fetch workflow definition
      const { data: definition, error: defError } = await supabase
        .from("workflow_definitions")
        .select("*")
        .eq("id", workflowDefinitionId)
        .eq("is_active", true)
        .maybeSingle();

      if (defError || !definition) {
        throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
      }

      if (definition.organization_id && definition.organization_id !== envelope.organizationId) {
        throw new Error("Workflow not authorized for this organization");
      }

      const dag = this.validateWorkflowDAG(definition.dag_schema);

      const executionId = uuidv4();
      const initialStageExecutionId = uuidv4();

      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from("workflow_executions")
        .insert({
          id: executionId,
          organization_id: envelope.organizationId,
          workflow_definition_id: workflowDefinitionId,
          workflow_version: definition.version,
          status: "initiated",
          current_stage: dag.initial_stage,
          context: {
            ...context,
            executionIntent: envelope,
            currentStageExecutionId: initialStageExecutionId,
          },
          audit_context: {
            workflow: definition.name,
            version: definition.version,
            traceId,
            envelope,
          },
          circuit_breaker_state: {},
        })
        .select()
        .single();

      if (execError || !execution) {
        throw new Error("Failed to create workflow execution");
      }

      await this.recordWorkflowEvent(
        executionId,
        envelope.organizationId,
        "workflow_initiated",
        dag.initial_stage ?? "",
        {
          envelope,
          stageExecutionId: initialStageExecutionId,
        }
      );

      // Execute DAG asynchronously
      this.workflowRunner.executeDAGAsync(
        execution.id,
        envelope.organizationId,
        dag,
        { ...context, executionIntent: envelope },
        traceId
      ).catch(async (error) => {
        await this.handleWorkflowFailure(execution.id, envelope.organizationId, error.message);
      });

      return {
        executionId: execution.id,
        status: "initiated",
        currentStage: dag.initial_stage ?? null,
        completedStages: [],
      };
    } catch (error) {
      logger.error("Workflow execution failed", error instanceof Error ? error : undefined, {
        traceId,
        workflowDefinitionId,
      });
      throw error;
    }
  }

  /**
   * Execute DAG stages asynchronously
   */

  /**
   * Simulate workflow execution without actually running it
   * Uses LLM to predict outcomes based on similar past episodes
   */
  async simulateWorkflow(
    workflowDefinitionId: string,
    context: WorkflowContextDTO = {},
    options?: {
      maxSteps?: number;
      stopOnFailure?: boolean;
    }
  ): Promise<SimulationResult> {
    return this.workflowSimulationService.simulateWorkflow(workflowDefinitionId, context, options);
  }

  /**
   * Predict outcome of a single workflow stage
   */
  private async predictStageOutcome(
    stage: WorkflowStage,
    context: WorkflowContextDTO,
    similarEpisodes: unknown[]
  ): Promise<StagePredictionDTO> {
    return this.workflowSimulationService.predictStageOutcome(stage, context, similarEpisodes);
  }

  private async executeDAGAsync(
    executionId: string,
    organizationId: string,
    dag: WorkflowDAG,
    initialContext: WorkflowStageContextDTO,
    traceId: string,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void> {
    let executionContext = { ...initialContext, organizationId };
    const defaultRecord: WorkflowExecutionRecord = executionRecord ?? {
      id: executionId,
      workflow_id: dag.id ?? "",
      workspace_id: "",
      organization_id: organizationId,
      status: "running",
      started_at: new Date().toISOString(),
      context: initialContext,
      lifecycle: [],
      outputs: [],
    };
    let recordSnapshot: WorkflowExecutionRecord = {
      ...defaultRecord,
      lifecycle: Array.isArray(defaultRecord.lifecycle) ? [...defaultRecord.lifecycle] : [],
      outputs: Array.isArray(defaultRecord.outputs) ? [...defaultRecord.outputs] : [],
    };
    const dependencies = new Map<string, Set<string>>();
    const inProgressStages = new Set<string>();
    const completedStages = new Set<string>();
    const failedStages = new Map<string, string>();
    const stageStartTimes = new Map<string, Date>();
    const executor = getEnhancedParallelExecutor();
    let integrityVetoed = false;

    for (const stage of dag.stages) {
      dependencies.set(stage.id, new Set());
    }

    for (const transition of dag.transitions) {
      const toStage = transition.to_stage ?? transition.to ?? "";
      const fromStage = transition.from_stage ?? transition.from ?? "";
      const deps = dependencies.get(toStage);
      if (deps) {
        deps.add(fromStage);
      } else {
        dependencies.set(toStage, new Set([fromStage]));
      }
    }

    const dependenciesMet = (stageId: string) => {
      const deps = dependencies.get(stageId);
      if (!deps || deps.size === 0) {
        return true;
      }
      return [...deps].every((dep) => completedStages.has(dep));
    };

    const totalStages = dag.stages.length;

    while (completedStages.size + failedStages.size < totalStages) {
      const organizationId = String(executionContext.organizationId ?? executionContext.tenantId ?? '');
      if (organizationId) {
        await this.assertTenantExecutionAllowed(organizationId);
      }
      const readyStages = dag.stages.filter((stage) => {
        return (
          !completedStages.has(stage.id) &&
          !failedStages.has(stage.id) &&
          !inProgressStages.has(stage.id) &&
          dependenciesMet(stage.id)
        );
      });

      if (readyStages.length === 0) {
        break;
      }

      const stageTasks: RunnableTask<{
        stage: WorkflowStage;
        route: StageRoute;
        context: WorkflowContextDTO;
        startedAt: Date;
      }>[] = readyStages.map((stage) => {
        const route = this.decisionRouter.routeStage(dag, stage.id, executionContext);
        const startedAt = new Date();
        stageStartTimes.set(stage.id, startedAt);
        inProgressStages.add(stage.id);

        return {
          id: stage.id,
          priority: "high",
          payload: {
            stage,
            route,
            context: { ...executionContext },
            startedAt,
          },
        };
      });

      const taskLookup = new Map(stageTasks.map((task) => [task.id, task]));
      const concurrencyCap = Math.max(
        1,
        Math.min(this.maxAgentInvocationsPerMinute, stageTasks.length)
      );

      const results = await executor.executeRunnableTasks(
        stageTasks,
        async (task) => {
          const { stage, route, context } = task.payload;
          const stageResult = await this.workflowRunner.executeStageWithRetry(
            executionId,
            stage,
            context,
            route as StageRouteDTO,
            traceId
          );

          return { stage, stageResult };
        },
        concurrencyCap
      );

      for (const result of results) {
        const task = taskLookup.get(result.taskId);
        if (!task) {
          continue;
        }
        const { stage, startedAt } = task.payload;
        const stageStart = startedAt ?? stageStartTimes.get(stage.id) ?? new Date();
        const stageCompleted = new Date();
        inProgressStages.delete(stage.id);

        if (result.success && result.result?.stageResult.status === "completed") {
          const stageOutput = result.result.stageResult.output || {};
          const structuralCheck = await this.evaluateStructuralTruthVeto(stageOutput, {
            traceId,
            agentType: stage.agent_type as AgentType,
            query: stage.description ?? stage.id,
            stageId: stage.id,
          });
          if (structuralCheck.vetoed) {
            const vetoMessage =
              "Output failed structural truth validation against expected schema.";
            failedStages.set(stage.id, vetoMessage);
            integrityVetoed = true;

            const lifecycleRecord: StageLifecycleRecord = {
              stageId: stage.id,
              lifecycleStage: stage.agent_type,
              status: "failed",
              startedAt: stageStart.toISOString(),
              completedAt: stageCompleted.toISOString(),
              summary: stage.description,
            };

            recordSnapshot = {
              ...recordSnapshot,
              lifecycle: [...(Array.isArray(recordSnapshot.lifecycle) ? recordSnapshot.lifecycle : []), lifecycleRecord],
              outputs: [
                ...(Array.isArray(recordSnapshot.outputs) ? recordSnapshot.outputs : []),
                {
                  stageId: stage.id,
                  payload: {
                    error: vetoMessage,
                    metadata: structuralCheck.metadata,
                  },
                  completedAt: stageCompleted.toISOString(),
                },
              ],
              io: {
                ...(recordSnapshot.io && typeof recordSnapshot.io === "object" ? recordSnapshot.io as Record<string, unknown> : {}),
                outputs: {
                  ...(recordSnapshot.io && typeof recordSnapshot.io === "object" && "outputs" in recordSnapshot.io ? (recordSnapshot.io as Record<string, unknown>).outputs as Record<string, unknown> : {}),
                  [stage.id]: {
                    error: vetoMessage,
                    metadata: structuralCheck.metadata,
                  },
                },
              },
            };

            await this.recordWorkflowEvent(executionId, organizationId, "stage_failed", stage.id, {
              reason: "integrity_veto",
              metadata: structuralCheck.metadata,
            });

            await this.persistExecutionRecord(executionId, organizationId, recordSnapshot);
            await this.updateExecutionStatus(executionId, organizationId, "failed", stage.id, recordSnapshot);
            continue;
          }

          const integrityCheck = await this.evaluateIntegrityVeto(stageOutput, {
            traceId,
            agentType: stage.agent_type as AgentType,
            query: stage.description ?? stage.id,
            stageId: stage.id,
          });

          if (integrityCheck.vetoed) {
            const vetoMessage =
              "Output failed integrity validation against ground truth benchmarks.";
            failedStages.set(stage.id, vetoMessage);
            integrityVetoed = true;

            const lifecycleRecord: StageLifecycleRecord = {
              stageId: stage.id,
              lifecycleStage: stage.agent_type,
              status: "failed",
              startedAt: stageStart.toISOString(),
              completedAt: stageCompleted.toISOString(),
              summary: stage.description,
            };

            recordSnapshot = {
              ...recordSnapshot,
              lifecycle: [...(Array.isArray(recordSnapshot.lifecycle) ? recordSnapshot.lifecycle : []), lifecycleRecord],
              outputs: [
                ...(Array.isArray(recordSnapshot.outputs) ? recordSnapshot.outputs : []),
                {
                  stageId: stage.id,
                  payload: {
                    error: vetoMessage,
                    metadata: integrityCheck.metadata,
                  },
                  completedAt: stageCompleted.toISOString(),
                },
              ],
              io: {
                ...(recordSnapshot.io && typeof recordSnapshot.io === "object" ? recordSnapshot.io as Record<string, unknown> : {}),
                outputs: {
                  ...(recordSnapshot.io && typeof recordSnapshot.io === "object" && "outputs" in recordSnapshot.io ? (recordSnapshot.io as Record<string, unknown>).outputs as Record<string, unknown> : {}),
                  [stage.id]: {
                    error: vetoMessage,
                    metadata: integrityCheck.metadata,
                  },
                },
              },
            };

            await this.recordWorkflowEvent(executionId, organizationId, "stage_failed", stage.id, {
              reason: "integrity_veto",
              metadata: integrityCheck.metadata,
            });

            await this.persistExecutionRecord(executionId, organizationId, recordSnapshot);
            await this.updateExecutionStatus(executionId, organizationId, "failed", stage.id, recordSnapshot);
            continue;
          }

          executionContext = {
            ...executionContext,
            ...stageOutput,
          };

          const lifecycleRecord: StageLifecycleRecord = {
            stageId: stage.id,
            lifecycleStage: stage.agent_type,
            status: "completed",
            startedAt: stageStart.toISOString(),
            completedAt: stageCompleted.toISOString(),
            summary: stage.description,
          };

          recordSnapshot = {
            ...recordSnapshot,
            lifecycle: [...(Array.isArray(recordSnapshot.lifecycle) ? recordSnapshot.lifecycle : []), lifecycleRecord],
            outputs: [
              ...(Array.isArray(recordSnapshot.outputs) ? recordSnapshot.outputs : []),
              {
                stageId: stage.id,
                payload: stageOutput,
                completedAt: stageCompleted.toISOString(),
              },
            ],
            io: {
              ...(recordSnapshot.io && typeof recordSnapshot.io === "object" ? recordSnapshot.io as Record<string, unknown> : {}),
              outputs: {
                ...(recordSnapshot.io && typeof recordSnapshot.io === "object" && "outputs" in recordSnapshot.io ? (recordSnapshot.io as Record<string, unknown>).outputs as Record<string, unknown> : {}),
                [stage.id]: stageOutput,
              },
            },
            economicDeltas: stageOutput?.economic_deltas || recordSnapshot.economicDeltas,
          };

          await this.recordStageRun(
            executionId,
            organizationId,
            stage,
            recordSnapshot,
            stageStart,
            stageCompleted,
            stageOutput
          );

          completedStages.add(stage.id);
        } else {
          const errorMessage =
            result.result?.stageResult.error || result.error || "Unknown stage error";
          failedStages.set(stage.id, errorMessage);

          const lifecycleRecord: StageLifecycleRecord = {
            stageId: stage.id,
            lifecycleStage: stage.agent_type,
            status: "failed",
            startedAt: stageStart.toISOString(),
            completedAt: stageCompleted.toISOString(),
            summary: stage.description,
          };

          recordSnapshot = {
            ...recordSnapshot,
            lifecycle: [...(Array.isArray(recordSnapshot.lifecycle) ? recordSnapshot.lifecycle : []), lifecycleRecord],
            outputs: [
              ...(Array.isArray(recordSnapshot.outputs) ? recordSnapshot.outputs : []),
              {
                stageId: stage.id,
                payload: { error: errorMessage },
                completedAt: stageCompleted.toISOString(),
              },
            ],
            io: {
              ...(recordSnapshot.io && typeof recordSnapshot.io === "object" ? recordSnapshot.io as Record<string, unknown> : {}),
              outputs: {
                ...(recordSnapshot.io && typeof recordSnapshot.io === "object" && "outputs" in recordSnapshot.io ? (recordSnapshot.io as Record<string, unknown>).outputs as Record<string, unknown> : {}),
                [stage.id]: { error: errorMessage },
              },
            },
          };
        }

        await this.persistExecutionRecord(executionId, organizationId, recordSnapshot);
        await this.updateExecutionStatus(executionId, organizationId, "in_progress", stage.id, recordSnapshot);
      }

      if (integrityVetoed) {
        break;
      }
    }

    if (completedStages.size + failedStages.size < totalStages) {
      const blockedStages = dag.stages
        .filter((stage) => !completedStages.has(stage.id) && !failedStages.has(stage.id))
        .map((stage) => stage.id);

      for (const stageId of blockedStages) {
        failedStages.set(stageId, "Blocked by unmet dependencies");
      }
    }

    if (failedStages.size > 0) {
      const errorSummary = [...failedStages.entries()]
        .map(([stageId, error]) => `${stageId}: ${error}`)
        .join("; ");
      logger.error("DAG execution failed", {
        executionId,
        traceId,
        errorSummary,
      });

      await this.updateExecutionStatus(executionId, organizationId, "failed", null, recordSnapshot);
      return;
    }

    await this.updateExecutionStatus(executionId, organizationId, "completed", null, recordSnapshot);
  }

  /**
   * Execute a single stage with retry logic
   */
  private async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: WorkflowStageContextDTO,
    route: StageRouteDTO,
    traceId: string
  ): Promise<StageExecutionResultDTO> {
    const stageTracer = getTracer();
    return stageTracer.startActiveSpan(
      'agent.executeStageWithRetry',
      {
        attributes: {
          'agent.stage_id': stage.id,
          'agent.stage_name': stage.name || stage.id,
          'agent.agent_type': stage.agent_type,
        },
      },
      async (stageSpan: Span) => {
    const stageStart = Date.now();

    const circuitBreakerKey = `${executionId}-${stage.id}`;
    const retryConfig = {
      max_attempts: stage.retry_config?.max_attempts ?? this.config.maxRetryAttempts,
      initial_delay_ms: stage.retry_config?.initial_delay_ms ?? 1000,
      max_delay_ms: stage.retry_config?.max_delay_ms ?? 10000,
      multiplier: stage.retry_config?.multiplier ?? 2,
      jitter: stage.retry_config?.jitter ?? true,
    };

    const retryOptions: Partial<RetryOptions> = {
      maxRetries: Math.max(retryConfig.max_attempts - 1, 0),
      strategy: "exponential_backoff",
      baseDelay: retryConfig.initial_delay_ms,
      maxDelay: retryConfig.max_delay_ms,
      backoffMultiplier: retryConfig.multiplier,
      jitterFactor: retryConfig.jitter ? 0.1 : 0,
      fallbackAgents: [],
      fallbackStrategy: "none",
      attemptTimeout: stage.timeout_seconds * 1000,
      overallTimeout: stage.timeout_seconds * 1000 * retryConfig.max_attempts,
      context: {
        requestId: traceId,
        sessionId: context.sessionId,
        userId: context.userId,
        organizationId: context.organizationId,
        priority: "medium",
        source: "unified-agent-orchestrator",
        metadata: {
          executionId,
          stageId: stage.id,
        },
      },
    };

    const stageExecutionAgent: {
      execute: (request?: unknown) => Promise<RetryAgentResponse<Record<string, unknown>>>;
    } = {
      execute: async (_request?: unknown): Promise<RetryAgentResponse<Record<string, unknown>>> => {
        const agentType = stage.agent_type as AgentType;
        if (!this.checkAgentRateLimit(agentType)) {
          throw new Error(`Agent ${agentType} rate limit exceeded`);
        }

        const result = await this.circuitBreakers.execute(
          circuitBreakerKey,
          () => this.workflowRunner.executeStage(stage, context, route as StageRouteDTO),
          {
            timeoutMs: (stage.timeout_seconds ?? 30) * 1000,
          }
        );

        return {
          success: true,
          data: result,
          confidence: "high",
          metadata: {
            executionId,
            agentType,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            tokenUsage: { input: 0, output: 0, total: 0, cost: 0 },
            cacheHit: false,
            retryCount: 0,
            circuitBreakerTripped: false,
          },
        };
      },
      getCapabilities: (): AgentCapability[] => [],
      validateInput: (): ValidationResult => ({ valid: true, errors: [], warnings: [] }),
      getMetadata: (): AgentMetadata => ({}) as AgentMetadata,
      healthCheck: async (): Promise<RetryAgentHealthStatus> => ({
        status: "healthy",
        lastCheck: new Date(),
        responseTime: 0,
        errorRate: 0,
        uptime: 100,
        activeConnections: 0,
      }),
    });
    this.contextStore = new ContextStore();
    this.router = new DecisionRouter();
    this.executionRuntime = new ExecutionRuntime(this.policy, this.router, cfg);
    this.artifactComposer = new ArtifactComposer(
      { enableSDUI: cfg.enableSDUI, enableTaskPlanning: cfg.enableTaskPlanning, enableSimulation: cfg.enableSimulation },
      (envelope) => this.validateExecutionIntent(envelope),
    );
  }

  // --------------------------------------------------------------------------
  // Execution intent validation (kept here — used by ArtifactComposer callback)
  // --------------------------------------------------------------------------

  validateExecutionIntent(envelope: ExecutionEnvelope): void {
    const result = executionIntentSchema.safeParse(envelope);
    if (!result.success) throw new Error(`Invalid execution intent: ${result.error.message}`);
  }

    // --------------------------------------------------------------------------
  // Query path — delegates to ExecutionRuntime
  // --------------------------------------------------------------------------

  async processQuery(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4(),
  ): Promise<ProcessQueryResult> {
    return this.executionRuntime.processQuery(
      envelope,
      query,
      currentState,
      userId,
      sessionId,
      traceId,
    );
  }

  async processQueryAsync(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4(),
  ): Promise<{ jobId: string; traceId: string }> {
    return this.executionRuntime.processQueryAsync(
      envelope,
      query,
      currentState,
      userId,
      sessionId,
      traceId,
    );
  }

  async getAsyncQueryResult(
    jobId: string,
    currentState: WorkflowState,
  ): Promise<ProcessQueryResult | null> {
    return this.executionRuntime.getAsyncQueryResult(jobId, currentState);
  }

  /**
   * Determine execution order based on dependencies
   */
  private determineExecutionOrder(subgoals: SubgoalDefinition[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];

    while (remaining.length > 0) {
      const ready = remaining.filter((sg) =>
        sg.dependencies.every((dep) => completed.has(dep)),
      );

      if (ready.length === 0 && remaining.length > 0) {
        throw new Error("Circular dependency detected in subgoals");
      }

      for (const subgoal of ready) {
        order.push(subgoal.id);
        completed.add(subgoal.id);
        const index = remaining.indexOf(subgoal);
        remaining.splice(index, 1);
      }
    }

    return order;
  }

  /**
   * Calculate task complexity
   */
  private calculateComplexity(subgoals: SubgoalDefinition[]): number {
    if (subgoals.length === 0) return 0;

    const avgComplexity =
      subgoals.reduce((sum, sg) => sum + sg.estimatedComplexity, 0) /
      subgoals.length;
    const countFactor = Math.min(subgoals.length / 10, 1);
    const totalDeps = subgoals.reduce(
      (sum, sg) => sum + sg.dependencies.length,
      0,
    );
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);

    return Math.min((avgComplexity + countFactor + depFactor) / 3, 1);
  }

  // ==========================================================================
  // Agent Selection & Routing
  // ==========================================================================

  /**
   * Build a DecisionContext from WorkflowState for use by DecisionRouter.
   *
   * Sprint 5: Assembles the minimal context available from WorkflowState.
   * When ContextStore is implemented (Sprint 6 target), this method will be
   * replaced by a ContextStore.assemble() call that hydrates all domain
   * objects from Supabase.
   */
  private buildDecisionContext(
    state: WorkflowState,
    organizationId: string,
  ): DecisionContext {
    const stageParseResult = OpportunityLifecycleStageSchema.safeParse(
      state.lifecycle_stage ?? state.currentStage,
    );
    const lifecycleStage = stageParseResult.success
      ? stageParseResult.data
      : undefined;

    const rawConfidence = state.state_data?.confidence_score;
    const confidenceScore =
      typeof rawConfidence === "number" ? rawConfidence : undefined;

    const rawMaturity = state.state_data?.value_maturity;
    const valueMaturity =
      rawMaturity === "low" ||
      rawMaturity === "medium" ||
      rawMaturity === "high"
        ? rawMaturity
        : undefined;

    const opportunityId = state.state_data?.opportunity_id as
      | string
      | undefined;

    return {
      organization_id: organizationId,
      opportunity:
        lifecycleStage && valueMaturity && opportunityId
          ? {
              id: opportunityId,
              lifecycle_stage: lifecycleStage,
              confidence_score: confidenceScore ?? 0,
              value_maturity: valueMaturity,
            }
          : undefined,
      is_external_artifact_action: false,
    };
  }

  // --------------------------------------------------------------------------
  // Workflow path — delegates to ExecutionRuntime
  // --------------------------------------------------------------------------

  async executeWorkflow(envelope: ExecutionEnvelope, workflowDefinitionId: string, context: WorkflowContextDTO = {}, userId?: string): Promise<WorkflowExecutionResult> {
    return this.executionRuntime.executeWorkflow(envelope, workflowDefinitionId, context, userId);
  }

  async executeDAGAsync(executionId: string, organizationId: string, dag: WorkflowDAG, initialContext: WorkflowStageContextDTO, traceId: string, executionRecord?: WorkflowExecutionRecord): Promise<void> {
    return this.executionRuntime.executeDAGAsync(executionId, organizationId, dag, initialContext, traceId, executionRecord);
  }

  async executeStageWithRetry(executionId: string, stage: WorkflowStage, context: WorkflowStageContextDTO, route: StageRouteDTO, traceId: string): Promise<StageExecutionResultDTO> {
    return this.executionRuntime.executeStageWithRetry(executionId, stage, context, route, traceId);
  }

  async executeStage(stage: WorkflowStage, context: WorkflowStageContextDTO, route: StageRouteDTO): Promise<Record<string, unknown>> {
    return this.executionRuntime.executeStage(stage, context, route);
  }

  // --------------------------------------------------------------------------
  // Policy — delegates to PolicyEngine
  // --------------------------------------------------------------------------

  async evaluateIntegrityVeto(payload: unknown, options: Parameters<PolicyEngine['evaluateIntegrityVeto']>[1]): ReturnType<PolicyEngine['evaluateIntegrityVeto']> {
    return this.policy.evaluateIntegrityVeto(payload, options);
  }

  async assertTenantExecutionAllowed(organizationId: string): Promise<void> {
    return this.policy.assertTenantExecutionAllowed(organizationId);
  }

  async collectScheduledComplianceEvidence(tenantId: string): Promise<void> {
    return this.policy.collectComplianceEvidence(tenantId, 'scheduled', 'compliance_scheduler');
  }

  async collectEventDrivenComplianceEvidence(tenantId: string, eventSource: string): Promise<void> {
    return this.policy.collectComplianceEvidence(tenantId, 'event', eventSource);
  }

  // --------------------------------------------------------------------------
  // Context — delegates to ContextStore
  // --------------------------------------------------------------------------

  async getExecutionStatus(executionId: string, organizationId: string): Promise<WorkflowExecutionStatusDTO | null> {
    return this.contextStore.getExecutionStatus(executionId, organizationId);
  }

  async getExecutionLogs(executionId: string, organizationId: string): Promise<WorkflowExecutionLogDTO[]> {
    return this.contextStore.getExecutionLogs(executionId, organizationId);
  }

  createInitialState(initialStage: string, execution?: Record<string, unknown>): WorkflowState {
    return this.contextStore.createInitialState(initialStage, execution);
  }

  updateStage(currentState: WorkflowState, stage: string, status: WorkflowStatus): WorkflowState {
    return this.contextStore.updateStage(currentState, stage, status);
  }

  isWorkflowComplete(state: WorkflowState): boolean {
    return this.contextStore.isWorkflowComplete(state);
  }

  getProgress(state: WorkflowState, totalStages?: number): number {
    return this.contextStore.getProgress(state, totalStages);
  }

  // --------------------------------------------------------------------------
  // Artifacts — delegates to ArtifactComposer
  // --------------------------------------------------------------------------

  async generateSDUIPage(envelope: ExecutionEnvelope, agent: AgentType, query: string, context?: AgentContext, streamingCallback?: (update: StreamingUpdate) => void): Promise<AgentResponse> {
    return this.artifactComposer.generateSDUIPage(envelope, agent, query, context, streamingCallback);
  }

  async generateAndRenderPage(envelope: ExecutionEnvelope, agent: AgentType, query: string, context?: AgentContext, renderOptions?: RenderPageOptions): Promise<{ response: AgentResponse; rendered: unknown }> {
    return this.artifactComposer.generateAndRenderPage(envelope, agent, query, context, renderOptions);
  }

  async planTask(intentType: string, description: string, context: WorkflowContextDTO = {}): Promise<TaskPlanResult> {
    return this.artifactComposer.planTask(intentType, description, context);
  }
}

// ============================================================================
// Singleton
// ============================================================================

let instance: UnifiedAgentOrchestrator | null = null;

/** @deprecated Use runtime services directly. */
export function getUnifiedOrchestrator(config?: Partial<OrchestratorConfig>): UnifiedAgentOrchestrator {
  if (!instance) instance = new UnifiedAgentOrchestrator(config);
  return instance;
}

/** Reset singleton (for testing). */
export function resetUnifiedOrchestrator(): void { instance = null; }

/** @deprecated Use runtime services directly. */
export const unifiedOrchestrator = getUnifiedOrchestrator();
