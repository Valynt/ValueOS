/**
 * Unified Agent Orchestrator
 *
 * @frozen
 * This file is frozen as of Sprint 0 of the ValueOS architectural refactor.
 * Bug fixes only. No new product logic.
 *
 * This class will be decomposed into five focused runtime services
 * (DecisionRouter, ExecutionRuntime, PolicyEngine, ContextStore, ArtifactComposer)
 * and deleted in Sprint 4. See the ValueOS Refactor Roadmap for the migration plan.
 *
 * CONSOLIDATION: Replaces the following fragmented orchestrators:
 * - AgentOrchestrator (singleton, deprecated)
 * - StatelessAgentOrchestrator (concurrent-safe base)
 * - WorkflowOrchestrator (DAG execution)
 * - CoordinatorAgent (task planning - partially)
 *
 * Key Design Principles:
 * - Stateless: All state passed as parameters, safe for concurrent requests
 * - Unified: Single entry point for all agent orchestration
 * - Observable: Full tracing and audit logging
 * - Extensible: Plugin architecture for routing strategies
 */

import { v4 as uuidv4 } from "uuid";

import { MemorySystem } from "../lib/agent-fabric/MemorySystem";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway";
import { llmConfig } from "../config/llm";
import { z } from "zod";
import { getAutonomyConfig } from "../config/autonomy";
import { AgentRetryManager, RetryOptions } from "./agents/resilience/AgentRetryManager";

import { EnhancedParallelExecutor, getEnhancedParallelExecutor } from "./EnhancedParallelExecutor"; // NEW: Import for parallel execution
import {
  assertProvenance,
  validateGroundTruthMetadata,
} from "../lib/agent-fabric/ground-truth/GroundTruthValidator";
import { env, getEnvVar, getGroundtruthConfig } from "../lib/env";
import { logger } from "../lib/logger";
import { supabase } from "../lib/supabase";
import { ESOModule } from "../mcp-ground-truth/modules/StructuralTruthModule";
import { WorkflowState } from "../repositories/WorkflowStateRepository";
import { renderPage, RenderPageOptions } from "../sdui/renderPage";
import { SDUIPageDefinition } from "../sdui/schema";
import { WorkflowStatus } from "../types";
import { AgentHealthStatus, ConfidenceLevel } from "../types/agent";
import { ExecutionRequest } from "../types/execution";
import { WorkflowDAG, WorkflowEvent, WorkflowStage } from "../types/workflow";
import { WorkflowExecutionRecord } from "../types/workflowExecution";

import { AgentType } from "./agent-types";
import { AgentContext, AgentResponse as APIAgentResponse, getAgentAPI } from "./AgentAPI";
import { logAgentResponse } from "./AgentAuditLogger";
import { AgentMessageBroker, getAgentMessageBroker } from "./AgentMessageBroker";
import { AgentRecord, AgentRegistry } from "./AgentRegistry";
import { AgentRoutingLayer, StageRoute } from "./AgentRoutingLayer";
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
} from "./agents/core/IAgent";
import { CircuitBreakerManager } from "./CircuitBreaker";
import { ConfidenceMonitor } from "./ConfidenceMonitor";
import GroundtruthAPI, {
  GroundtruthAPIConfig,
  GroundtruthRequestOptions,
  GroundtruthRequestPayload,
} from "./GroundtruthAPI";

// ============================================================================
// Types
// ============================================================================

export interface AgentResponse {
  type: "component" | "message" | "suggestion" | "sdui-page";
  payload: unknown;
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
  stage: "thinking" | "executing" | "completed";
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

export interface ExecutionIntentActor {
  id: string;
  type?: string;
  roles?: string[];
}

export interface ExecutionIntentTimestamps {
  requestedAt: string;
  approvedAt?: string;
  expiresAt?: string;
}

export interface ExecutionIntent {
  intent: string;
  actor: ExecutionIntentActor;
  organizationId: string;
  entryPoint: string;
  reason: string;
  timestamps: ExecutionIntentTimestamps;
}

export interface ExecutionEnvelope extends ExecutionIntent {}

export interface OrchestratorConfig {
  /** Enable workflow DAG execution */
  enableWorkflows: boolean;
  /** Enable task planning */
  enableTaskPlanning: boolean;
  /** Enable SDUI generation */
  enableSDUI: boolean;
  /** Enable simulation for complex tasks */
  enableSimulation: boolean;
  /** Default timeout for agent calls (ms) */
  defaultTimeoutMs: number;
  /** Maximum retry attempts */
  maxRetryAttempts: number;
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  enableWorkflows: true,
  enableTaskPlanning: true,
  enableSDUI: true,
  enableSimulation: true,
  defaultTimeoutMs: 30000,
  maxRetryAttempts: 3,
};

const executionIntentSchema = z.object({
  intent: z.string().min(1),
  actor: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    roles: z.array(z.string()).optional(),
  }),
  organizationId: z.string().min(1),
  entryPoint: z.string().min(1),
  reason: z.string().min(1),
  timestamps: z.object({
    requestedAt: z.string().min(1),
    approvedAt: z.string().optional(),
    expiresAt: z.string().optional(),
  }),
});

const retryConfigSchema = z.object({
  max_attempts: z.number().int().positive(),
  initial_delay_ms: z.number().int().nonnegative(),
  max_delay_ms: z.number().int().nonnegative(),
  multiplier: z.number().positive(),
  jitter: z.boolean(),
});

const workflowStageSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().optional(),
    agent_type: z.string().min(1),
    required_capabilities: z.array(z.string()).optional(),
    timeout_seconds: z.number().int().nonnegative().optional(),
    retry_config: retryConfigSchema.optional(),
    compensation_handler: z.string().optional(),
    description: z.string().optional(),
  })
  .passthrough();

const workflowTransitionSchema = z
  .object({
    from_stage: z.string().min(1),
    to_stage: z.string().min(1),
    condition: z.string().optional(),
  })
  .passthrough();

const workflowDAGSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    version: z.number().optional(),
    stages: z.array(workflowStageSchema).nonempty(),
    transitions: z.array(workflowTransitionSchema),
    initial_stage: z.string().min(1),
    final_stages: z.array(z.string().min(1)).nonempty(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

// ============================================================================
// Unified Agent Orchestrator
// ============================================================================

/**
 * Unified Agent Orchestrator
 *
 * All methods are pure functions that take state as input
 * and return new state as output. No internal mutable state.
 */
export class UnifiedAgentOrchestrator {
  private agentAPI = getAgentAPI();
  private registry: AgentRegistry;
  private routingLayer: AgentRoutingLayer;
  private circuitBreakers: CircuitBreakerManager;
  private config: OrchestratorConfig;
  private memorySystem: MemorySystem;
  private llmGateway: LLMGateway;
  private messageBroker: AgentMessageBroker;
  private retryManager: AgentRetryManager;
  private executionStartTimes: Map<string, number> = new Map();
  private groundTruthModule = new ESOModule();
  private groundTruthInitialized = false;
  private parallelExecutor: EnhancedParallelExecutor = getEnhancedParallelExecutor(); // NEW: Parallel execution engine
  private confidenceMonitor: ConfidenceMonitor;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.registry = new AgentRegistry();
    this.routingLayer = new AgentRoutingLayer(this.registry);
    this.circuitBreakers = new CircuitBreakerManager();
    this.llmGateway = new LLMGateway(llmConfig.provider, llmConfig.gatingEnabled);
    this.memorySystem = new MemorySystem(supabase, this.llmGateway);
    this.messageBroker = getAgentMessageBroker();
    this.retryManager = AgentRetryManager.getInstance();
    this.confidenceMonitor = new ConfidenceMonitor(supabase);
  }

  private async ensureGroundTruthInitialized(): Promise<void> {
    if (this.groundTruthInitialized) {
      return;
    }
    await this.groundTruthModule.initialize();
    this.groundTruthInitialized = true;
  }

  private normalizeNumericValue(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const sanitized = value.replace(/[%,$]/g, "");
      const parsed = Number(sanitized);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private extractNumericClaims(payload: unknown): Array<{
    metricId: string;
    claimedValue: number;
  }> {
    const claims: Array<{ metricId: string; claimedValue: number }> = [];
    const addFromItem = (item: Record<string, unknown>) => {
      const metricId =
        (item.metricId as string) ||
        (item.metric_id as string) ||
        (item.kpi_id as string) ||
        (item.metric as string) ||
        (item.id as string);
      if (!metricId) {
        return;
      }
      const claimedValue = this.normalizeNumericValue(
        item.claimedValue ??
          item.claimed_value ??
          item.value ??
          item.amount ??
          item.delta ??
          item.metric_value
      );
      if (claimedValue === null) {
        return;
      }
      claims.push({ metricId, claimedValue });
    };
    const addFromList = (list: unknown) => {
      if (!Array.isArray(list)) {
        return;
      }
      for (const entry of list) {
        if (entry && typeof entry === "object" && !Array.isArray(entry)) {
          addFromItem(entry as Record<string, unknown>);
        }
      }
    };
    const addFromContainer = (container: unknown) => {
      if (!container || typeof container !== "object") {
        return;
      }
      const record = container as Record<string, unknown>;
      addFromList(record.economic_deltas ?? record.economicDeltas);
      addFromList(record.metrics);
      addFromList(record.claims);
    };

    if (Array.isArray(payload)) {
      addFromList(payload);
    } else {
      addFromContainer(payload);
      const payloadRecord = payload as Record<string, unknown> | null;
      if (payloadRecord?.payload) {
        addFromContainer(payloadRecord.payload);
      }
      if (payloadRecord?.data) {
        addFromContainer(payloadRecord.data);
      }
      if (payloadRecord?.output) {
        addFromContainer(payloadRecord.output);
      }
    }

    return claims;
  }

  private async evaluateIntegrityVeto(
    payload: unknown,
    options: {
      traceId: string;
      agentType: AgentType;
      query?: string;
      stageId?: string;
      context?: AgentContext;
    }
  ): Promise<{ vetoed: boolean; metadata?: IntegrityVetoMetadata; reRefine?: boolean }> {
    const claims = this.extractNumericClaims(payload);

    // Always perform ground truth validation on agent outputs
    try {
      // Use GroundTruthValidator to validate metadata schema
      if (typeof payload === "object" && payload !== null && "metadata" in payload) {
        const metadata = (payload as any).metadata;
        if (metadata) {
          validateGroundTruthMetadata(metadata);
          assertProvenance(metadata);
        }
      }
    } catch (error) {
      logger.warn("Ground truth metadata validation failed", {
        traceId: options.traceId,
        agentType: options.agentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Check ConfidenceMonitor for low confidence threshold
    let confidenceScore = 1.0;
    try {
      const metrics = await this.confidenceMonitor.getMetrics(options.agentType, "hour");
      confidenceScore = metrics.avgConfidenceScore;

      if (confidenceScore < 0.85) {
        logger.warn("Confidence score below threshold, triggering RE-REFINE", {
          traceId: options.traceId,
          agentType: options.agentType,
          confidenceScore,
          threshold: 0.85,
        });
        return { vetoed: false, reRefine: true };
      }
    } catch (error) {
      logger.warn("Failed to check confidence score", {
        traceId: options.traceId,
        agentType: options.agentType,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (claims.length === 0) {
      return { vetoed: false };
    }

    await this.ensureGroundTruthInitialized();

    let vetoMetadata: IntegrityVetoMetadata | undefined;
    for (const claim of claims) {
      try {
        const metricValue = await this.executeGroundTruthToolCall<{ value?: number }>({
          toolName: "eso_get_metric_value",
          payload: { metricId: claim.metricId, percentile: "p50" },
          traceId: options.traceId,
          context: options.context,
        });
        const validation = await this.executeGroundTruthToolCall<{
          warning?: string;
          benchmark?: { p50?: number };
        }>({
          toolName: "eso_validate_claim",
          payload: { metricId: claim.metricId, claimedValue: claim.claimedValue },
          traceId: options.traceId,
          context: options.context,
        });

        const benchmarkValue = metricValue.value ?? validation.benchmark?.p50;
        if (!benchmarkValue) {
          continue;
        }
        const deviationPercent =
          (Math.abs(claim.claimedValue - benchmarkValue) / Math.abs(benchmarkValue)) * 100;
        if (
          deviationPercent > 15 &&
          (!vetoMetadata || deviationPercent > vetoMetadata.deviationPercent)
        ) {
          vetoMetadata = {
            integrityVeto: true,
            deviationPercent,
            benchmark: benchmarkValue,
            metricId: claim.metricId,
            claimedValue: claim.claimedValue,
            warning: validation.warning,
          };
        }
      } catch (error) {
        logger.warn("Failed to validate claim against ground truth", {
          traceId: options.traceId,
          agentType: options.agentType,
          stageId: options.stageId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (vetoMetadata) {
      await logAgentResponse(
        options.agentType,
        options.query ?? "agent-output-veto",
        false,
        payload,
        {
          traceId: options.traceId,
          stageId: options.stageId,
          integrityVeto: vetoMetadata,
        },
        "integrity_veto",
        options.context
      );
      return { vetoed: true, metadata: vetoMetadata };
    }

    return { vetoed: false };
  }

  private buildRetryOptions(
    traceId: string,
    agentType: AgentType,
    timeoutMs: number,
    context?: AgentContext
  ): Partial<RetryOptions> {
    const maxAttempts = this.config.maxRetryAttempts;

    return {
      maxRetries: Math.max(maxAttempts - 1, 0),
      strategy: "exponential_backoff",
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      fallbackAgents: [],
      fallbackStrategy: "none",
      attemptTimeout: timeoutMs,
      overallTimeout: timeoutMs * maxAttempts,
      context: {
        requestId: traceId,
        sessionId: context?.sessionId,
        userId: context?.userId,
        organizationId: context?.organizationId,
        priority: "medium",
        source: "unified-agent-orchestrator",
        metadata: {
          agentType,
        },
      },
    };
  }

  private createRetryAgent<T>(
    agentType: AgentType,
    breakerKey: string,
    timeoutMs: number,
    execute: () => Promise<APIAgentResponse<T>>
  ): IAgent {
    return {
      execute: async (): Promise<RetryAgentResponse<T>> => {
        const startTime = new Date();
        const response = await this.circuitBreakers.execute(breakerKey, execute, { timeoutMs });

        if (!response.success) {
          throw new Error(response.error || "Agent request failed");
        }

        const endTime = new Date();
        return {
          success: true,
          data: response.data as T,
          confidence: "high",
          metadata: {
            executionId: breakerKey,
            agentType,
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
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
      getConfiguration: (): AgentConfiguration => ({}) as AgentConfiguration,
      updateConfiguration: async (): Promise<void> => {},
      getPerformanceMetrics: (): AgentPerformanceMetrics => ({}) as AgentPerformanceMetrics,
      reset: async (): Promise<void> => {},
      getAgentType: (): AgentType => agentType,
      supportsCapability: (): boolean => false,
      getInputSchema: (): Record<string, unknown> => ({}),
      getOutputSchema: (): Record<string, unknown> => ({}),
    };
  }

  private async executeGroundTruthToolCall<T>(params: {
    toolName: string;
    payload: Record<string, unknown>;
    traceId: string;
    context?: AgentContext;
    timeoutMs?: number;
  }): Promise<T> {
    const agentType: AgentType = "groundtruth";
    const timeoutMs = params.timeoutMs ?? this.config.defaultTimeoutMs;
    const retryAgent: IAgent = {
      execute: async (): Promise<RetryAgentResponse<T>> => {
        const startTime = new Date();
        const data = (await this.groundTruthModule.handleToolCall(
          params.toolName,
          params.payload
        )) as T;
        const endTime = new Date();

        return {
          success: true,
          data,
          confidence: "high",
          metadata: {
            executionId: `groundtruth-${params.toolName}`,
            agentType,
            startTime,
            endTime,
            duration: endTime.getTime() - startTime.getTime(),
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
      getConfiguration: (): AgentConfiguration => ({}) as AgentConfiguration,
      updateConfiguration: async (): Promise<void> => {},
      getPerformanceMetrics: (): AgentPerformanceMetrics => ({}) as AgentPerformanceMetrics,
      reset: async (): Promise<void> => {},
      getAgentType: (): AgentType => agentType,
      supportsCapability: (): boolean => false,
      getInputSchema: (): Record<string, unknown> => ({}),
      getOutputSchema: (): Record<string, unknown> => ({}),
    };

    const retryRequest: AgentRequest = {
      agentType,
      query: params.toolName,
      sessionId: params.context?.sessionId,
      userId: params.context?.userId,
      organizationId: params.context?.organizationId,
      context: params.context ? { ...params.context } : undefined,
      timeout: timeoutMs,
    };

    // Standardized retry options for exponential backoff
    const retryOptions: Partial<RetryOptions> = {
      maxRetries: 5,
      strategy: "exponential_backoff",
      baseDelay: 500,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitterFactor: 0.3,
      attemptTimeout: timeoutMs,
      overallTimeout: timeoutMs * 2,
      retryableErrors: ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND", "429", "5xx", "TimeoutError"],
      nonRetryableErrors: ["400", "401", "403", "404", "422"],
      fallbackAgents: [],
      fallbackStrategy: "none",
      context: {
        requestId: params.traceId,
        sessionId: params.context?.sessionId,
        userId: params.context?.userId,
        organizationId: params.context?.organizationId,
        priority: "medium",
        source: "UnifiedAgentOrchestrator",
      },
    };
    const retryResult = await this.retryManager.executeWithRetry(
      retryAgent,
      retryRequest,
      retryOptions
    );

    if (retryResult.success) {
      return retryResult.response?.data as T;
    }

    throw new Error(retryResult.error?.message || "Ground truth request failed");
  }

  private async executeAgentWithRetry<T>(params: {
    agentType: AgentType;
    query: string;
    context?: AgentContext;
    traceId: string;
    timeoutMs: number;
    breakerKey: string;
    execute: () => Promise<APIAgentResponse<T>>;
  }): Promise<{ success: boolean; data?: T; error?: string }> {
    const retryAgent = this.createRetryAgent<T>(
      params.agentType,
      params.breakerKey,
      params.timeoutMs,
      params.execute
    );

    const retryRequest: AgentRequest = {
      agentType: params.agentType,
      query: params.query,
      sessionId: params.context?.sessionId,
      userId: params.context?.userId,
      organizationId: params.context?.organizationId,
      context: params.context ? { ...params.context } : undefined,
      timeout: params.timeoutMs,
    };

    const retryResult = await this.retryManager.executeWithRetry(
      retryAgent,
      retryRequest,
      this.buildRetryOptions(params.traceId, params.agentType, params.timeoutMs, params.context)
    );

    if (retryResult.success && retryResult.response?.data) {
      return { success: true, data: retryResult.response.data as T };
    }

    return {
      success: false,
      error: retryResult.error?.message || "Agent request failed",
    };
  }

  private deriveFiscalQuarter(date: Date): string {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${quarter}`;
  }

  private buildExecutionRecord(
    workflowDefinitionId: string,
    workflowVersion: number,
    context: Record<string, unknown>,
    userId: string,
    traceId: string
  ): WorkflowExecutionRecord {
    const persona = context.persona || context.buyer_persona?.role || context.role;
    const industry = context.industry || context.companyProfile?.industry;
    const fiscalQuarter =
      context.fiscal_quarter || context.quarter || this.deriveFiscalQuarter(new Date());

    return {
      workflowDefinitionId,
      workflowVersion,
      persona,
      industry,
      fiscalQuarter,
      intent: {
        description: context.intent || context.goal || "Workflow execution",
        objective: context.objective,
        successCriteria: context.successCriteria,
        hypothesis: context.hypothesis,
      },
      entryPoint: {
        trigger: context.entry_point || "orchestrator",
        requestedBy: userId,
        sessionId: context.sessionId,
        channel: context.channel,
      },
      lifecycle: [],
      io: {
        inputs: context.inputs || context,
        assumptions: context.assumptions || [],
        outputs: {},
      },
      economicDeltas: context.economic_deltas || [],
      auditEnvelope: {
        traceId,
        userId,
        createdAt: new Date().toISOString(),
        approvals: context.approvals ? Object.keys(context.approvals) : [],
        complianceTags: context.compliance_tags,
        notes: context.audit_notes,
      },
      outputs: [],
    };
  }

  // ==========================================================================
  // Query Processing (from StatelessAgentOrchestrator)
  // ==========================================================================

  /**
   * Process a user query with given workflow state
   *
   * @param query User query
   * @param currentState Current workflow state
   * @param userId User identifier
   * @param sessionId Session identifier
   * @param traceId Trace ID for logging
   * @returns Result with response and next state
   */
  async processQuery(
    envelope: ExecutionEnvelope,
    query: string,
    currentState: WorkflowState,
    userId: string,
    sessionId: string,
    traceId: string = uuidv4()
  ): Promise<ProcessQueryResult> {
    this.validateExecutionIntent(envelope);

    if (
      currentState.context?.organizationId &&
      currentState.context.organizationId !== envelope.organizationId
    ) {
      throw new Error("Execution envelope organization does not match workflow state");
    }
    logger.info("Processing query", {
      traceId,
      sessionId,
      userId,
      currentStage: currentState.currentStage,
      queryLength: query.length,
    });

    try {
      // Create immutable copy of state
      const nextState: WorkflowState = {
        ...currentState,
        context: { ...currentState.context },
        completedStages: [...currentState.completedStages],
      };

      // Determine which agent to use based on query and current stage
      const agentType = this.selectAgent(query, currentState);

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
          companyProfile: currentState.context.companyProfile,
          currentStage: currentState.currentStage,
        },
      };

      // Call agent with circuit breaker protection
      const circuitBreakerKey = `query-${agentType}`;
      const agentResponse = await this.executeAgentWithRetry({
        agentType,
        query,
        context: agentContext,
        traceId,
        timeoutMs: this.config.defaultTimeoutMs,
        breakerKey: circuitBreakerKey,
        execute: () =>
          this.agentAPI.invokeAgent({
            agent: agentType,
            query,
            context: agentContext,
          }),
      });

      if (agentResponse.success) {
        const integrityCheck = await this.evaluateIntegrityVeto(agentResponse.data, {
          traceId,
          agentType,
          query,
          context: agentContext,
        });
        if (integrityCheck.reRefine) {
          // Trigger RE-REFINE loop instead of sending to UI
          logger.info("Triggering RE-REFINE loop due to low confidence", {
            traceId,
            agentType,
            sessionId,
          });

          // Reset state to allow re-processing
          const reRefineState: WorkflowState = {
            ...currentState,
            status: "in_progress",
            context: {
              ...currentState.context,
              lastError: "Low confidence detected, re-refining response",
              errorTimestamp: new Date().toISOString(),
            },
          };

          return {
            response: null, // No response to UI, trigger re-processing
            nextState: reRefineState,
            traceId,
          };
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
            traceId,
          };
        }
      }

      // Update state based on response
      if (agentResponse.success && agentResponse.data) {
        nextState.context.conversationHistory = [
          ...(nextState.context.conversationHistory || []),
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

      return {
        response,
        nextState,
        traceId,
      };
    } catch (error) {
      logger.error("Error processing query", error instanceof Error ? error : undefined, {
        traceId,
        sessionId,
        userId,
      });

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
            message: "I encountered an error processing your request. Please try again.",
            error: true,
          },
        },
        nextState: errorState,
        traceId,
      };
    }
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Initialize a new workflow state
   */
  createInitialState(
    initialStage: string,
    execution: ExecutionRequest = { intent: "FullValueAnalysis", environment: "production" }
  ): WorkflowState {
    const normalizedExecution = normalizeExecutionRequest("agent-query", execution);

    return {
      currentStage: initialStage,
      status: "initiated",
      completedStages: [],
      context: {
        ...normalizedExecution.parameters,
        intent: normalizedExecution.intent,
        environment: normalizedExecution.environment,
        metadata: normalizedExecution.metadata,
        conversationHistory: [],
      },
      metadata: {
        startedAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        errorCount: 0,
        retryCount: 0,
      },
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
      completedStages: [...currentState.completedStages],
    };

    if (status === "completed" && !nextState.completedStages.includes(currentState.currentStage)) {
      nextState.completedStages.push(currentState.currentStage);
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
    context: Record<string, unknown> = {},
    userId?: string
  ): Promise<WorkflowExecutionResult> {
    this.validateExecutionIntent(envelope);
    if (!this.config.enableWorkflows) {
      throw new Error("Workflow execution is disabled");
    }

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

      await this.recordWorkflowEvent(executionId, "workflow_initiated", dag.initial_stage, {
        envelope,
        stageExecutionId: initialStageExecutionId,
      });

      // Execute DAG asynchronously
      this.executeDAGAsync(
        execution.id,
        dag,
        { ...context, executionIntent: envelope },
        traceId
      ).catch(async (error) => {
        await this.handleWorkflowFailure(execution.id, error.message);
      });

      return {
        executionId: execution.id,
        status: "initiated",
        currentStage: dag.initial_stage,
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
    context: Record<string, unknown> = {},
    options?: {
      maxSteps?: number;
      stopOnFailure?: boolean;
    }
  ): Promise<SimulationResult> {
    if (!this.config.enableSimulation) {
      throw new Error("Simulation is disabled");
    }

    const simulationId = uuidv4();
    const startTime = Date.now();

    logger.info("Starting workflow simulation", {
      simulationId,
      workflowDefinitionId,
    });

    // Get workflow definition
    const { data: definition, error: defError } = await supabase
      .from("workflow_definitions")
      .select("*")
      .eq("id", workflowDefinitionId)
      .eq("is_active", true)
      .maybeSingle();

    if (defError || !definition) {
      throw new Error(`Workflow definition not found: ${workflowDefinitionId}`);
    }

    const dag: WorkflowDAG = definition.dag_schema as WorkflowDAG;

    // Retrieve similar past episodes for prediction
    const orgId = (context as any)?.organizationId || (context as any)?.tenantId;
    const similarEpisodes = await this.memorySystem.retrieveSimilarEpisodes(context, 5, orgId);

    // Simulate each stage
    const stepsSimulated: unknown[] = [];
    let currentStageId = dag.initial_stage;
    let simulationContext = { ...context };
    let stepNumber = 0;
    const maxSteps = options?.maxSteps || 50;
    let totalConfidence = 0;
    let successProbability = 1.0;

    while (currentStageId && stepNumber < maxSteps) {
      const stage = dag.stages.find((s) => s.id === currentStageId);
      if (!stage) break;

      stepNumber++;

      // Predict stage outcome using LLM
      const prediction = await this.predictStageOutcome(stage, simulationContext, similarEpisodes);

      stepsSimulated.push({
        stage_id: currentStageId,
        stage_name: stage.name,
        predicted_outcome: prediction.outcome,
        confidence: prediction.confidence,
        estimated_duration_seconds: prediction.estimatedDuration,
      });

      totalConfidence += prediction.confidence;
      successProbability *= prediction.confidence;

      // Update context with predicted outcome
      simulationContext = {
        ...simulationContext,
        ...prediction.outcome,
      };

      // Find next stage
      const transition = stage.transitions?.find((t) => {
        if (t.condition) {
          // Evaluate condition (simplified)
          return prediction.outcome.success !== false;
        }
        return true;
      });

      currentStageId = transition?.to_stage || null;

      if (dag.final_stages.includes(currentStageId || "")) {
        break;
      }
    }

    const duration = Date.now() - startTime;
    const avgConfidence = stepsSimulated.length > 0 ? totalConfidence / stepsSimulated.length : 0;

    // Assess risks
    const riskAssessment = {
      low_confidence_steps: stepsSimulated.filter((s) => s.confidence < 0.7).length,
      estimated_cost_usd: stepsSimulated.length * 0.01,
      requires_approval: stepsSimulated.some(
        (s) => s.stage_name.includes("delete") || s.stage_name.includes("remove")
      ),
    };

    const result: SimulationResult = {
      simulation_id: simulationId,
      workflow_definition_id: workflowDefinitionId,
      predicted_outcome: simulationContext,
      confidence_score: avgConfidence,
      risk_assessment: riskAssessment,
      steps_simulated: stepsSimulated,
      duration_estimate_seconds: stepsSimulated.reduce(
        (sum, s) => sum + s.estimated_duration_seconds,
        0
      ),
      success_probability: successProbability,
    };

    logger.info("Workflow simulation complete", {
      simulationId,
      stepsSimulated: stepsSimulated.length,
      confidence: avgConfidence,
      successProbability,
    });

    return result;
  }

  /**
   * Predict outcome of a single workflow stage
   */
  private async predictStageOutcome(
    stage: WorkflowStage,
    context: Record<string, unknown>,
    similarEpisodes: unknown[]
  ): Promise<{
    outcome: Record<string, unknown>;
    confidence: number;
    estimatedDuration: number;
  }> {
    const prompt = `Predict the outcome of workflow stage: ${stage.name}
Description: ${stage.description || "N/A"}
Context: ${JSON.stringify(context, null, 2)}
Similar past episodes: ${similarEpisodes.length}

Provide a JSON response with:
- outcome: predicted result object
- confidence: 0-1 score
- estimatedDuration: seconds`;

    try {
      const response = await this.llmGateway.chat([{ role: "user", content: prompt }], {
        maxTokens: 500,
        temperature: 0.3,
      });

      const parsed = JSON.parse(response.content);
      return {
        outcome: parsed.outcome || { success: true },
        confidence: parsed.confidence || 0.7,
        estimatedDuration: parsed.estimatedDuration || 5,
      };
    } catch (error) {
      logger.warn("Failed to predict stage outcome, using defaults", { error });
      return {
        outcome: { success: true },
        confidence: 0.5,
        estimatedDuration: 10,
      };
    }
  }

  private async executeDAGAsync(
    executionId: string,
    dag: WorkflowDAG,
    initialContext: Record<string, unknown>,
    traceId: string,
    executionRecord: WorkflowExecutionRecord
  ): Promise<void> {
    // NEW: Analyze DAG for parallel execution opportunities
    const parallelGroups = this.analyzeDAGForParallelExecution(dag);

    if (parallelGroups.length > 0 && this.canUseParallelExecution(dag)) {
      // Use parallel execution for eligible workflows
      await this.executeDAGWithParallelExecution(
        executionId,
        dag,
        initialContext,
        traceId,
        executionRecord,
        parallelGroups
      );
    } else {
      // Fallback to sequential execution
      await this.executeDAGSequentially(executionId, dag, initialContext, traceId, executionRecord);
    }
  }

  /**
   * NEW: Analyze DAG to identify parallel execution groups
   */
  private analyzeDAGForParallelExecution(dag: WorkflowDAG): Array<{
    stages: string[];
    dependencies: string[];
  }> {
    const parallelGroups: Array<{ stages: string[]; dependencies: string[] }> = [];
    const processedStages = new Set<string>();
    const stageDependencies = new Map<string, string[]>();

    // Build dependency map
    for (const transition of dag.transitions) {
      if (!stageDependencies.has(transition.to_stage)) {
        stageDependencies.set(transition.to_stage, []);
      }
      stageDependencies.get(transition.to_stage)?.push(transition.from_stage);
    }

    // Find stages that can be executed in parallel
    const queue = [dag.initial_stage];
    while (queue.length > 0) {
      const currentLevel: string[] = [];
      const nextQueue: string[] = [];

      for (const stageId of queue) {
        if (processedStages.has(stageId)) continue;
        processedStages.add(stageId);

        // Check if all dependencies are satisfied
        const deps = stageDependencies.get(stageId) || [];
        const depsSatisfied = deps.every((dep) => processedStages.has(dep));

        if (depsSatisfied) {
          currentLevel.push(stageId);

          // Find next stages
          const nextStages = dag.transitions
            .filter((t) => t.from_stage === stageId)
            .map((t) => t.to_stage);

          nextQueue.push(...nextStages);
        }
      }

      if (currentLevel.length > 1) {
        // Multiple stages can run in parallel
        parallelGroups.push({
          stages: currentLevel,
          dependencies: currentLevel
            .flatMap((stage) => stageDependencies.get(stage) || [])
            .filter((dep, index, arr) => arr.indexOf(dep) === index), // unique
        });
      }

      queue.push(...nextQueue);
    }

    return parallelGroups;
  }

  /**
   * NEW: Check if parallel execution can be used for this DAG
   */
  private canUseParallelExecution(dag: WorkflowDAG): boolean {
    // Enable parallel execution for workflows with:
    // - More than 3 stages
    // - No complex branching (single final stage)
    // - No cycles (already checked elsewhere)
    return dag.stages.length > 3 && dag.final_stages.length === 1;
  }

  /**
   * NEW: Execute DAG with parallel execution for independent stages
   */
  private async executeDAGWithParallelExecution(
    executionId: string,
    dag: WorkflowDAG,
    initialContext: Record<string, unknown>,
    traceId: string,
    executionRecord: WorkflowExecutionRecord,
    parallelGroups: Array<{ stages: string[]; dependencies: string[] }>
  ): Promise<void> {
    let executionContext = { ...initialContext };
    let recordSnapshot: WorkflowExecutionRecord = {
      ...executionRecord,
      lifecycle: [...executionRecord.lifecycle],
      outputs: [...executionRecord.outputs],
    };

    // Execute parallel groups
    for (const group of parallelGroups) {
      // Check if dependencies are met
      const depsMet = group.dependencies.every((depId) =>
        recordSnapshot.outputs.some((output) => output.stageId === depId)
      );

      if (!depsMet) {
        logger.warn("Dependencies not met for parallel group, falling back to sequential", {
          executionId,
          group: group.stages,
          dependencies: group.dependencies,
        });
        continue;
      }

      // Execute stages in parallel
      const parallelTasks = group.stages.map((stageId) => {
        const stage = dag.stages[stageId];
        const route = this.routingLayer.routeStage(dag, stageId, executionContext);

        return {
          id: `${executionId}-${stageId}`,
          agentType: stage.agent_type as AgentType,
          query: stage.description || `Execute ${stageId}`,
          context: { ...executionContext, stageId },
          priority: "high" as const,
          dependencies: [],
          estimatedDuration: stage.timeout_seconds || 30,
          timeoutMs: (stage.timeout_seconds || 30) * 1000,
          retryConfig: {
            maxAttempts: stage.retry_config?.max_attempts || 3,
            initialDelay: stage.retry_config?.initial_delay_ms || 1000,
            maxDelay: stage.retry_config?.max_delay_ms || 10000,
            multiplier: stage.retry_config?.multiplier || 2,
          },
        };
      });

      // Execute parallel group
      const groupResult = await this.parallelExecutor.executeParallelGroup({
        id: `${executionId}-group-${Date.now()}`,
        name: `Parallel execution group for ${executionId}`,
        tasks: parallelTasks,
        executionStrategy: "parallel",
        maxConcurrency: Math.min(parallelTasks.length, 5), // Limit concurrency
        estimatedDuration: Math.max(...parallelTasks.map((t) => t.estimatedDuration)),
        dependencies: group.dependencies,
      });

      if (!groupResult.success) {
        throw new Error(
          `Parallel execution failed: ${groupResult.results.map((r) => r.error).join(", ")}`
        );
      }

      // Process results and update context
      for (const taskResult of groupResult.results) {
        const stageId = taskResult.taskId.split("-").slice(-1)[0]; // Extract stage ID
        const stage = dag.stages[stageId];

        if (!taskResult.success) {
          throw new Error(`Stage ${stageId} failed: ${taskResult.error}`);
        }

        // Integrity check
        const integrityCheck = await this.evaluateIntegrityVeto(taskResult.result, {
          traceId,
          agentType: stage.agent_type as AgentType,
          query: stage.description ?? stage.id,
          stageId: stage.id,
        });

        if (integrityCheck.reRefine) {
          logger.info("RE-REFINE triggered for stage", {
            traceId,
            stageId: stage.id,
            agentType: stage.agent_type,
          });
          // For workflow stages, we might need to retry the stage
          continue; // Retry the stage
        }

        if (integrityCheck.vetoed) {
          throw new Error(`Stage ${stageId} failed integrity check`);
        }

        // Update context and records
        executionContext = { ...executionContext, ...taskResult.result };

        const stageCompleted = new Date();
        const lifecycleRecord: StageLifecycleRecord = {
          stageId: stage.id,
          lifecycleStage: stage.agent_type,
          status: "completed",
          startedAt: new Date(Date.now() - taskResult.duration).toISOString(),
          completedAt: stageCompleted.toISOString(),
          summary: stage.description,
        };

        recordSnapshot = {
          ...recordSnapshot,
          lifecycle: [...recordSnapshot.lifecycle, lifecycleRecord],
          outputs: [
            ...recordSnapshot.outputs,
            {
              stageId: stage.id,
              payload: taskResult.result || {},
              completedAt: stageCompleted.toISOString(),
            },
          ],
          io: {
            ...recordSnapshot.io,
            outputs: {
              ...recordSnapshot.io.outputs,
              [stage.id]: taskResult.result || {},
            },
          },
        };

        await this.persistExecutionRecord(executionId, recordSnapshot);
      }
    }

    await this.updateExecutionStatus(executionId, "completed", null, recordSnapshot);
  }

  /**
   * Original sequential execution (renamed)
   */
  private async executeDAGSequentially(
    executionId: string,
    dag: WorkflowDAG,
    initialContext: Record<string, unknown>,
    traceId: string,
    executionRecord: WorkflowExecutionRecord
  ): Promise<void> {
    let currentStageId = dag.initial_stage;
    let executionContext = { ...initialContext };
    let recordSnapshot: WorkflowExecutionRecord = {
      ...executionRecord,
      lifecycle: [...executionRecord.lifecycle],
      outputs: [...executionRecord.outputs],
    };
    const visitedStages = new Set<string>();

    while (currentStageId && !dag.final_stages.includes(currentStageId)) {
      if (visitedStages.has(currentStageId)) {
        throw new Error(`Circular dependency at stage: ${currentStageId}`);
      }
      visitedStages.add(currentStageId);

      // Route to appropriate agent
      const route = this.routingLayer.routeStage(dag, currentStageId, executionContext);
      const stage = route.stage;

      // Update execution status
      await this.updateExecutionStatus(executionId, "in_progress", currentStageId, recordSnapshot);

      const stageStart = new Date();

      // Execute stage with retry
      const stageResult = await this.executeStageWithRetry(
        executionId,
        stage,
        executionContext,
        route,
        traceId
      );

      if (stageResult.status === "failed") {
        throw new Error(`Stage ${currentStageId} failed: ${stageResult.error}`);
      }

      const integrityCheck = await this.evaluateIntegrityVeto(stageResult.output, {
        traceId,
        agentType: stage.agent_type as AgentType,
        query: stage.description ?? stage.id,
        stageId: stage.id,
      });

      if (integrityCheck.reRefine) {
        logger.info("RE-REFINE triggered for stage", {
          traceId,
          stageId: currentStageId,
          agentType: stage.agent_type,
        });
        // For sequential execution, we might need to retry the current stage
        continue; // Retry the stage
      }

      if (integrityCheck.vetoed) {
        const vetoMessage = "Output failed integrity validation against ground truth benchmarks.";
        const stageCompleted = new Date();

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
          lifecycle: [...recordSnapshot.lifecycle, lifecycleRecord],
          outputs: [
            ...recordSnapshot.outputs,
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
            ...recordSnapshot.io,
            outputs: {
              ...recordSnapshot.io.outputs,
              [stage.id]: {
                error: vetoMessage,
                metadata: integrityCheck.metadata,
              },
            },
          },
        };

        await this.recordWorkflowEvent(executionId, "stage_failed", stage.id, {
          reason: "integrity_veto",
          metadata: integrityCheck.metadata,
        });
        await this.persistExecutionRecord(executionId, recordSnapshot);
        await this.updateExecutionStatus(executionId, "failed", stage.id, recordSnapshot);
        return;
      }

      // Merge context
      executionContext = {
        ...executionContext,
        ...stageResult.output,
      };

      const stageCompleted = new Date();
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
        lifecycle: [...recordSnapshot.lifecycle, lifecycleRecord],
        outputs: [
          ...recordSnapshot.outputs,
          {
            stageId: stage.id,
            payload: stageResult.output || {},
            completedAt: stageCompleted.toISOString(),
          },
        ],
        io: {
          ...recordSnapshot.io,
          outputs: {
            ...recordSnapshot.io.outputs,
            [stage.id]: stageResult.output || {},
          },
        },
        economicDeltas: stageResult.output?.economic_deltas || recordSnapshot.economicDeltas,
      };

      await this.recordStageRun(
        executionId,
        stage,
        recordSnapshot,
        stageStart,
        stageCompleted,
        stageResult.output
      );

      await this.persistExecutionRecord(executionId, recordSnapshot);

      // Move to next stage
      const nextTransition = dag.transitions.find((t) => t.from_stage === currentStageId);
      if (!nextTransition) break;
      currentStageId = nextTransition.to_stage;
    }

    await this.updateExecutionStatus(executionId, "completed", null, recordSnapshot);
  }

  /**
   * Execute a single stage with retry logic
   */
  private async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: Record<string, unknown>,
    route: StageRoute,
    traceId: string
  ): Promise<{ status: "completed" | "failed"; output?: unknown; error?: string }> {
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

    const stageExecutionAgent: IAgent = {
      execute: async (): Promise<RetryAgentResponse<Record<string, unknown>>> => {
        const result = await this.circuitBreakers.execute(
          circuitBreakerKey,
          () => this.executeStage(stage, context, route),
          {
            latencyThresholdMs: Math.floor(stage.timeout_seconds * 1000 * 0.8),
            timeoutMs: stage.timeout_seconds * 1000,
          }
        );

        return {
          success: true,
          data: result,
          confidence: "high",
          metadata: {
            executionId,
            agentType: stage.agent_type as AgentType,
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
      getConfiguration: (): AgentConfiguration => ({}) as AgentConfiguration,
      updateConfiguration: async (): Promise<void> => {},
      getPerformanceMetrics: (): AgentPerformanceMetrics => ({}) as AgentPerformanceMetrics,
      reset: async (): Promise<void> => {},
      getAgentType: (): AgentType => stage.agent_type as AgentType,
      supportsCapability: (): boolean => false,
      getInputSchema: (): Record<string, unknown> => ({}),
      getOutputSchema: (): Record<string, unknown> => ({}),
    };

    const retryRequest: AgentRequest = {
      agentType: stage.agent_type as AgentType,
      query: stage.description || `Execute ${stage.id}`,
      sessionId: context.sessionId,
      userId: context.userId,
      organizationId: context.organizationId,
      context,
      timeout: stage.timeout_seconds * 1000,
    };

    const retryResult = await this.retryManager.executeWithRetry(
      stageExecutionAgent,
      retryRequest,
      retryOptions
    );

    if (retryResult.success && retryResult.response?.data) {
      if (route.selected_agent) {
        this.registry.recordRelease(route.selected_agent.id);
        this.registry.markHealthy(route.selected_agent.id);
      }

      return { status: "completed", output: retryResult.response.data };
    }

    if (route.selected_agent) {
      this.registry.recordFailure(route.selected_agent.id);
    }

    return {
      status: "failed",
      error: retryResult.error?.message || "Unknown error",
    };
  }

  /**
   * Execute a single stage using SecureMessageBus
   */
  private async executeStage(
    stage: WorkflowStage,
    context: Record<string, unknown>,
    route: StageRoute
  ): Promise<Record<string, unknown>> {
    const agentType = stage.agent_type as AgentType;
    const agentContext: AgentContext = {
      userId: context.userId,
      sessionId: context.sessionId,
      currentStage: stage.id,
    };

    // Use SecureMessageBus for inter-agent communication
    const messageResult = await this.messageBroker.sendToAgent(
      "orchestrator", // From orchestrator
      agentType, // To target agent
      {
        action: "execute",
        description: stage.description || `Execute ${stage.id}`,
        context: agentContext,
      },
      {
        priority: "normal",
        timeoutMs: stage.timeout_seconds * 1000,
      }
    );

    if (!messageResult.success) {
      throw new Error(`Agent communication failed: ${messageResult.error}`);
    }

    return {
      stage_id: stage.id,
      agent_type: stage.agent_type,
      agent_id: route.selected_agent?.id,
      output: messageResult.data,
    };
  }

  // ==========================================================================
  // SDUI Generation (from AgentOrchestrator)
  // ==========================================================================

  /**
   * Generate SDUI page using AgentAPI
   */
  async generateSDUIPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    streamingCallback?: (update: StreamingUpdate) => void
  ): Promise<AgentResponse> {
    this.validateExecutionIntent(envelope);
    if (!this.config.enableSDUI) {
      throw new Error("SDUI generation is disabled");
    }

    const traceId = uuidv4();

    streamingCallback?.({
      stage: "analyzing",
      message: `Invoking ${agent} agent...`,
      progress: 10,
    });

    try {
      let response: { success: boolean; data?: SDUIPageDefinition; error?: string };
      const breakerKey = `sdui-${agent}`;

      // Route to appropriate agent method
      switch (agent) {
        case "opportunity":
          response = await this.executeAgentWithRetry({
            agentType: agent,
            query,
            context,
            traceId,
            timeoutMs: this.config.defaultTimeoutMs,
            breakerKey,
            execute: () => this.agentAPI.generateValueCase(query, context),
          });
          break;
        case "realization":
          response = await this.executeAgentWithRetry({
            agentType: agent,
            query,
            context,
            traceId,
            timeoutMs: this.config.defaultTimeoutMs,
            breakerKey,
            execute: () => this.agentAPI.generateRealizationDashboard(query, context),
          });
          break;
        case "expansion":
          response = await this.executeAgentWithRetry({
            agentType: agent,
            query,
            context,
            traceId,
            timeoutMs: this.config.defaultTimeoutMs,
            breakerKey,
            execute: () => this.agentAPI.generateExpansionOpportunities(query, context),
          });
          break;
        default:
          response = await this.executeAgentWithRetry({
            agentType: agent,
            query,
            context,
            traceId,
            timeoutMs: this.config.defaultTimeoutMs,
            breakerKey,
            execute: () => this.agentAPI.invokeAgent({ agent, query, context }),
          });
      }

      streamingCallback?.({
        stage: "processing",
        message: "Processing agent response...",
        progress: 60,
      });

      if (!response.success) {
        throw new Error(response.error || "Agent request failed");
      }

      streamingCallback?.({
        stage: "complete",
        message: "SDUI page generated successfully",
        progress: 100,
      });

      return {
        type: "sdui-page",
        payload: response.data,
        sduiPage: response.data,
      };
    } catch (error) {
      logger.error("SDUI generation failed", error instanceof Error ? error : undefined, {
        traceId,
        agent,
      });
      throw error;
    }
  }

  /**
   * Generate and render SDUI page
   */
  async generateAndRenderPage(
    envelope: ExecutionEnvelope,
    agent: AgentType,
    query: string,
    context?: AgentContext,
    renderOptions?: RenderPageOptions
  ): Promise<{
    response: AgentResponse;
    rendered: ReturnType<typeof renderPage>;
  }> {
    const response = await this.generateSDUIPage(envelope, agent, query, context);

    if (response.sduiPage) {
      const rendered = renderPage(response.sduiPage, renderOptions);
      return { response, rendered };
    }

    throw new Error("No SDUI page in response");
  }

  // ==========================================================================
  // Task Planning (from CoordinatorAgent - simplified)
  // ==========================================================================

  /**
   * Plan a task by breaking it into subgoals
   */
  async planTask(
    intentType: string,
    description: string,
    context: Record<string, unknown> = {}
  ): Promise<TaskPlanResult> {
    if (!this.config.enableTaskPlanning) {
      throw new Error("Task planning is disabled");
    }

    const taskId = uuidv4();

    // Generate subgoals based on intent type
    const subgoals = this.generateSubgoals(taskId, intentType, description, context);

    // Determine execution order
    const executionOrder = this.determineExecutionOrder(subgoals);

    // Calculate complexity
    const complexityScore = this.calculateComplexity(subgoals);

    // Determine if simulation is needed
    const requiresSimulation = this.config.enableSimulation && complexityScore > 0.7;

    return {
      taskId,
      subgoals,
      executionOrder,
      complexityScore,
      requiresSimulation,
    };
  }

  /**
   * Generate subgoals for a task
   */
  private generateSubgoals(
    taskId: string,
    intentType: string,
    description: string,
    context: Record<string, unknown>
  ): SubgoalDefinition[] {
    // Map intent types to subgoal sequences
    const subgoalPatterns: Record<
      string,
      Array<{ type: string; agent: string; deps: string[] }>
    > = {
      value_assessment: [
        { type: "discovery", agent: "opportunity", deps: [] },
        { type: "analysis", agent: "system-mapper", deps: ["discovery"] },
        { type: "design", agent: "intervention-designer", deps: ["analysis"] },
        { type: "validation", agent: "value-eval", deps: ["design"] },
      ],
      financial_modeling: [
        { type: "data_collection", agent: "company-intelligence", deps: [] },
        { type: "modeling", agent: "financial-modeling", deps: ["data_collection"] },
        { type: "reporting", agent: "coordinator", deps: ["modeling"] },
      ],
      expansion_planning: [
        { type: "analysis", agent: "expansion", deps: [] },
        { type: "opportunity_mapping", agent: "opportunity", deps: ["analysis"] },
        { type: "planning", agent: "coordinator", deps: ["opportunity_mapping"] },
      ],
    };

    const pattern = subgoalPatterns[intentType] || subgoalPatterns.value_assessment;
    const subgoalIdMap = new Map<string, string>();

    return pattern.map((step, index) => {
      const subgoalId = uuidv4();
      subgoalIdMap.set(step.type, subgoalId);

      const dependencies = step.deps
        .map((dep) => subgoalIdMap.get(dep))
        .filter((id): id is string => id !== undefined);

      return {
        id: subgoalId,
        type: step.type,
        description: `${step.type}: ${description}`,
        assignedAgent: step.agent,
        dependencies,
        priority: pattern.length - index,
        estimatedComplexity: 0.5 + index * 0.1,
      };
    });
  }

  /**
   * Determine execution order based on dependencies
   */
  private determineExecutionOrder(subgoals: SubgoalDefinition[]): string[] {
    const order: string[] = [];
    const completed = new Set<string>();
    const remaining = [...subgoals];

    while (remaining.length > 0) {
      const ready = remaining.filter((sg) => sg.dependencies.every((dep) => completed.has(dep)));

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
      subgoals.reduce((sum, sg) => sum + sg.estimatedComplexity, 0) / subgoals.length;
    const countFactor = Math.min(subgoals.length / 10, 1);
    const totalDeps = subgoals.reduce((sum, sg) => sum + sg.dependencies.length, 0);
    const depFactor = Math.min(totalDeps / (subgoals.length * 2), 1);

    return Math.min((avgComplexity + countFactor + depFactor) / 3, 1);
  }

  // ==========================================================================
  // Agent Selection & Routing
  // ==========================================================================

  /**
   * Select appropriate agent based on query and state
   */
  private selectAgent(query: string, state: WorkflowState): AgentType {
    const lowerQuery = query.toLowerCase();

    // Stage-based routing
    switch (state.currentStage) {
      case "discovery":
        return "company-intelligence";
      case "research":
        return "research";
      case "analysis":
        return "system-mapper";
      case "benchmarking":
        return "benchmark";
      case "design":
        return "intervention-designer";
      case "modeling":
        return "financial-modeling";
      case "narrative":
        return "narrative";
      default:
        break;
    }

    // Intent-based routing - Research Agent
    if (
      lowerQuery.includes("research") ||
      lowerQuery.includes("company intel") ||
      lowerQuery.includes("persona")
    ) {
      return "research";
    }

    // Intent-based routing - Benchmark Agent
    if (
      lowerQuery.includes("benchmark") ||
      lowerQuery.includes("industry") ||
      lowerQuery.includes("compare")
    ) {
      return "benchmark";
    }

    // Intent-based routing - Narrative Agent
    if (
      lowerQuery.includes("narrative") ||
      lowerQuery.includes("story") ||
      lowerQuery.includes("present") ||
      lowerQuery.includes("explain")
    ) {
      return "narrative";
    }

    // Existing intent-based routing
    if (lowerQuery.includes("roi") || lowerQuery.includes("financial")) {
      return "financial-modeling";
    }

    if (lowerQuery.includes("system") || lowerQuery.includes("map")) {
      return "system-mapper";
    }

    if (lowerQuery.includes("intervention") || lowerQuery.includes("solution")) {
      return "intervention-designer";
    }

    if (lowerQuery.includes("outcome") || lowerQuery.includes("result")) {
      return "outcome-engineer";
    }

    if (lowerQuery.includes("expand") || lowerQuery.includes("growth")) {
      return "expansion";
    }

    if (lowerQuery.includes("value") || lowerQuery.includes("opportunity")) {
      return "opportunity";
    }

    // Default to coordinator
    return "coordinator";
  }

  // ==========================================================================
  // Circuit Breaker Management
  // ==========================================================================

  /**
   * Get circuit breaker status for an agent
   */
  getCircuitBreakerStatus(agent: AgentType) {
    return this.agentAPI.getCircuitBreakerStatus(agent);
  }

  /**
   * Reset circuit breaker for an agent
   */
  resetCircuitBreaker(agent: AgentType) {
    this.agentAPI.resetCircuitBreaker(agent);
  }

  // ==========================================================================
  // Registry Access
  // ==========================================================================

  /**
   * Get agent registry for external access
   */
  getRegistry(): AgentRegistry {
    return this.registry;
  }

  /**
   * Register an agent
   */
  registerAgent(registration: Parameters<AgentRegistry["registerAgent"]>[0]): AgentRecord {
    return this.registry.registerAgent(registration);
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  private validateExecutionIntent(envelope: ExecutionEnvelope): ExecutionEnvelope {
    const parsed = executionIntentSchema.safeParse(envelope);
    if (!parsed.success) {
      throw new Error(`Invalid execution envelope: ${parsed.error.message}`);
    }
    return parsed.data;
  }

  private validateWorkflowDAG(rawDag: unknown): WorkflowDAG {
    const parsed = workflowDAGSchema.safeParse(rawDag);
    if (!parsed.success) {
      throw new Error(`Invalid workflow DAG schema: ${parsed.error.message}`);
    }

    const stageIds = new Set(parsed.data.stages.map((stage) => stage.id));
    if (!stageIds.has(parsed.data.initial_stage)) {
      throw new Error("Workflow DAG initial_stage must reference an existing stage");
    }

    const missingFinals = parsed.data.final_stages.filter((stage) => !stageIds.has(stage));
    if (missingFinals.length > 0) {
      throw new Error(
        `Workflow DAG final_stages reference missing stages: ${missingFinals.join(", ")}`
      );
    }

    const invalidTransitions = parsed.data.transitions.filter(
      (transition) => !stageIds.has(transition.from_stage) || !stageIds.has(transition.to_stage)
    );
    if (invalidTransitions.length > 0) {
      throw new Error("Workflow DAG transitions reference missing stages");
    }

    return parsed.data as WorkflowDAG;
  }

  private async getNextEventSequence(executionId: string): Promise<number> {
    const { data, error } = await supabase
      .from("workflow_events")
      .select("sequence")
      .eq("execution_id", executionId)
      .order("sequence", { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to fetch workflow event sequence: ${error.message}`);
    }

    const lastSequence = data?.[0]?.sequence ?? 0;
    return lastSequence + 1;
  }

  private async recordWorkflowEvent(
    executionId: string,
    eventType: WorkflowEvent["event_type"] | "workflow_initiated",
    stageId: string | null,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const sequence = await this.getNextEventSequence(executionId);
    const { error } = await supabase.from("workflow_events").insert({
      execution_id: executionId,
      event_type: eventType,
      stage_id: stageId,
      metadata,
      sequence,
    });

    if (error) {
      throw new Error(`Failed to record workflow event: ${error.message}`);
    }
  }

  /**
   * Check autonomy guardrails before executing stage
   */
  private async checkAutonomyGuardrails(
    executionId: string,
    stageId: string,
    context: Record<string, unknown>,
    startTime: number
  ): Promise<void> {
    const autonomy = getAutonomyConfig();

    // Check kill switch
    if (autonomy.killSwitchEnabled) {
      throw new Error("Autonomy kill switch is enabled");
    }

    // Check duration limit
    const elapsed = Date.now() - startTime;
    if (elapsed > autonomy.maxDurationMs) {
      await this.handleWorkflowFailure(executionId, "Autonomy guard: max duration exceeded");
      throw new Error("Autonomy guard: max duration exceeded");
    }

    // Check cost limit
    const cost = context.cost_accumulated_usd || 0;
    if (cost > autonomy.maxCostUsd) {
      await this.handleWorkflowFailure(executionId, "Autonomy guard: max cost exceeded");
      throw new Error("Autonomy guard: max cost exceeded");
    }

    // Check destructive action approval
    if (autonomy.requireApprovalForDestructive) {
      const approvalState = context.approvals || {};
      const destructivePending = context.destructive_actions_pending as string[] | undefined;
      if (destructivePending && destructivePending.length > 0 && !approvalState[executionId]) {
        await this.handleWorkflowFailure(executionId, "Approval required for destructive actions");
        throw new Error("Approval required for destructive actions");
      }
    }

    // Check per-agent autonomy level
    const agentLevels = autonomy.agentAutonomyLevels || {};
    const stageAgentId = context.current_agent_id;
    const level = stageAgentId ? agentLevels[stageAgentId] : undefined;
    if (level === "observe") {
      await this.handleWorkflowFailure(
        executionId,
        `Agent ${stageAgentId} restricted to observe-only`
      );
      throw new Error("Autonomy guard: observe-only agent attempted action");
    }

    // Check agent kill switches
    const agentKillSwitches = autonomy.agentKillSwitches || {};
    if (stageAgentId && agentKillSwitches[stageAgentId]) {
      await this.handleWorkflowFailure(
        executionId,
        `Agent ${stageAgentId} is disabled by kill switch`
      );
      throw new Error("Autonomy guard: agent disabled");
    }

    // Check iteration limits
    const agentMaxIterations = autonomy.agentMaxIterations || {};
    const maxIterations = stageAgentId ? agentMaxIterations[stageAgentId] : undefined;
    if (maxIterations !== undefined) {
      const executed = (context.executed_steps || []).filter(
        (s: unknown) => s.agent_id === stageAgentId
      ).length;
      if (executed >= maxIterations) {
        await this.handleWorkflowFailure(
          executionId,
          `Agent ${stageAgentId} exceeded iteration limit`
        );
        throw new Error("Autonomy guard: iteration limit exceeded");
      }
    }

    logger.debug("Autonomy guardrails passed", { executionId, stageId });
  }

  private async persistExecutionRecord(
    executionId: string,
    executionRecord: WorkflowExecutionRecord
  ): Promise<void> {
    await supabase
      .from("workflow_executions")
      .update({ execution_record: executionRecord })
      .eq("id", executionId);
  }

  private async recordStageRun(
    executionId: string,
    stage: WorkflowStage,
    executionRecord: WorkflowExecutionRecord,
    startedAt: Date,
    completedAt: Date,
    output?: Record<string, unknown>
  ): Promise<void> {
    await supabase.from("workflow_stage_runs").insert({
      execution_id: executionId,
      stage_id: stage.id,
      stage_name: stage.name || stage.id,
      lifecycle_stage: stage.agent_type,
      status: "completed",
      inputs: executionRecord.io.inputs,
      assumptions: executionRecord.io.assumptions,
      outputs: output || {},
      economic_deltas: output?.economic_deltas || executionRecord.economicDeltas,
      persona: executionRecord.persona,
      industry: executionRecord.industry,
      fiscal_quarter: executionRecord.fiscalQuarter,
      started_at: startedAt.toISOString(),
      completed_at: completedAt.toISOString(),
    });
  }

  private async updateExecutionStatus(
    executionId: string,
    status: WorkflowStatus,
    currentStage: string | null,
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void> {
    const update: unknown = {
      status,
      current_stage: currentStage,
      updated_at: new Date().toISOString(),
    };

    if (executionRecord) {
      update.execution_record = executionRecord;
      update.persona = executionRecord.persona;
      update.industry = executionRecord.industry;
      update.fiscal_quarter = executionRecord.fiscalQuarter;
    }

    if (status === "completed" || status === "failed" || status === "rolled_back") {
      update.completed_at = new Date().toISOString();
    }

    await supabase.from("workflow_executions").update(update).eq("id", executionId);
  }

  /**
   * Get workflow execution status
   */
  async getExecutionStatus(executionId: string): Promise<unknown> {
    const { data, error } = await supabase
      .from("workflow_executions")
      .select("*")
      .eq("id", executionId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get execution status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get workflow execution logs
   */
  async getExecutionLogs(executionId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("workflow_execution_logs")
      .select("*")
      .eq("execution_id", executionId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to get execution logs: ${error.message}`);
    }

    return data || [];
  }

  private async handleWorkflowFailure(executionId: string, errorMessage: string): Promise<void> {
    await supabase
      .from("workflow_executions")
      .update({
        status: "failed",
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    logger.error("Workflow failed", undefined, { executionId, errorMessage });
  }

  // ==========================================================================
  // Workflow Status Helpers
  // ==========================================================================

  isWorkflowComplete(state: WorkflowState): boolean {
    return state.status === "completed" || state.status === "error";
  }

  getProgress(state: WorkflowState, totalStages: number = 5): number {
    return Math.round((state.completedStages.length / totalStages) * 100);
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: UnifiedAgentOrchestrator | null = null;

/**
 * Get singleton instance of UnifiedAgentOrchestrator
 */
export function getUnifiedOrchestrator(
  config?: Partial<OrchestratorConfig>
): UnifiedAgentOrchestrator {
  if (!instance) {
    instance = new UnifiedAgentOrchestrator(config);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetUnifiedOrchestrator(): void {
  instance = null;
}

/**
 * Default export for convenience
 */
export const unifiedOrchestrator = getUnifiedOrchestrator();
