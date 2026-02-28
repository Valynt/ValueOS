/**
 * Unified Agent Orchestrator
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

import { logger } from "../lib/logger.js";
import { v4 as uuidv4 } from "uuid";
import { getTracer } from "../config/telemetry.js";
import { Span, SpanStatusCode } from "@opentelemetry/api";
import * as z from "zod";
import { CircuitBreakerManager } from "./CircuitBreaker.js";
import { AgentRecord, AgentRegistry } from "./AgentRegistry.js";
import { SDUIPageDefinition } from "@sdui/schema";
import { logAgentResponse } from "./AgentAuditLogger.js";
import { AgentType } from "./agent-types.js";
import { AgentHealthStatus, ConfidenceLevel } from "../types/agent";
import { env, getEnvVar, getGroundtruthConfig } from "@shared/lib/env";
import { GroundTruthIntegrationService } from "./GroundTruthIntegrationService.js";
import {
  STRUCTURAL_TRUTH_SCHEMA_FIELDS,
  StructuralTruthModuleSchema,
} from "@mcp/ground-truth/modules/StructuralTruthModule";
import { assertProvenance, validateGroundTruthMetadata } from "@mcp/ground-truth/validators/GroundTruthValidator";
import { ConfidenceMonitor } from "./ConfidenceMonitor";
import GroundtruthAPI, {
  GroundtruthAPIConfig,
  GroundtruthRequestOptions,
  GroundtruthRequestPayload,
} from "./GroundtruthAPI";
import { AgentMessageBroker } from "./AgentMessageBroker";
import { AgentMessageQueue } from "./AgentMessageQueue.js";
import { WorkflowStatus } from "../types";
import { WorkflowExecutionRecord } from "../types/workflowExecution";
import { ExecutionRequest } from "../types/execution";
import { WorkflowState } from "../repositories/WorkflowStateRepository";
import { AgentContext, AgentResponse as APIAgentResponse, getAgentAPI } from "./AgentAPI";
import { MemorySystem } from "../lib/agent-fabric/MemorySystem.js";
import { SupabaseMemoryBackend } from "../lib/agent-fabric/SupabaseMemoryBackend.js";
import { LLMGateway } from "../lib/agent-fabric/LLMGateway.js";
import { semanticMemory } from "./SemanticMemory.js";

// ============================================================================
// Local Types
// ============================================================================

interface StageLifecycleRecord {
  stageId: string;
  lifecycleStage: string;
  status: string;
  startedAt: string;
  completedAt: string;
  summary?: string;
}

// Stub for missing imports
interface AutonomyConfig {
  maxAutonomousActions: number;
  requireApproval: boolean;
  killSwitchEnabled?: boolean;
  maxDurationMs?: number;
  maxCostUsd?: number;
  requireApprovalForDestructive?: boolean;
  agentAutonomyLevels?: Record<string, string>;
  agentKillSwitches?: Record<string, boolean>;
  agentMaxIterations?: Record<string, number>;
}
declare function getAutonomyConfig(): AutonomyConfig;
declare const securityLogger: {
  warn: (msg: string | Record<string, unknown>, meta?: Record<string, unknown>) => void;
  log: (msg: string | Record<string, unknown>, meta?: Record<string, unknown>) => void;
};

// ============================================================================
// Middleware Types
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
  execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse>;
}

// ============================================================================
// Integrity Veto Middleware
// ============================================================================

export class IntegrityVetoMiddleware implements AgentMiddleware {
  public readonly name = "integrity_veto";

  constructor(private orchestrator: UnifiedAgentOrchestrator) {}

  async execute(
    context: AgentMiddlewareContext,
    next: () => Promise<AgentResponse>
  ): Promise<AgentResponse> {
    // Execute the agent
    const response = await next();

    // Apply integrity veto check
    if (response.payload) {
      const vetoResult = await this.orchestrator.evaluateIntegrityVeto(response.payload, {
        traceId: context.traceId,
        agentType: context.agentType,
        query: context.query,
        context: {
          userId: context.userId,
          sessionId: context.sessionId,
          organizationId: context.envelope.organizationId,
        },
      });

      if (vetoResult.vetoed) {
        // Return vetoed response
        return {
          type: "message",
          payload: {
            message: "Output failed integrity validation against ground truth benchmarks.",
            error: true,
          },
          metadata: vetoResult.metadata,
        };
      }
    }

    return response;
  }
}
// Lazy-imported to avoid pulling the entire SDUI component tree into the backend at startup.
// renderPage depends on React component registry which has deep frontend-only dependencies.
type RenderPageOptions = Record<string, unknown>;
let _renderPage: ((page: any, options?: RenderPageOptions) => any) | null = null;
async function getRenderPage() {
  if (!_renderPage) {
    const mod = await import("@sdui/renderPage");
    _renderPage = mod.renderPage;
  }
  return _renderPage;
}
import { WorkflowDAG, WorkflowEvent, WorkflowStage } from "../types/workflow";
import { AgentRoutingLayer, StageRoute } from "./AgentRoutingLayer.js";
import { getEnhancedParallelExecutor, RunnableTask } from "./EnhancedParallelExecutor.js";
import { supabase } from "../lib/supabase.js";
import { AgentRetryManager, RetryOptions } from "./agents/resilience/AgentRetryManager.js";
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

// ============================================================================
// Types
// ============================================================================

export interface AgentResponse {
  type: "component" | "message" | "suggestion" | "sdui-page";
  payload: any;
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
  /** Maximum concurrent agent executions */
  maxConcurrent?: number;
  /** Timeout for individual operations (ms) */
  timeout?: number;
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
  private agentMessageQueue: AgentMessageQueue;
  private retryManager = AgentRetryManager.getInstance();
  private agentInvocationTimes: Map<string, number[]> = new Map();
  private maxAgentInvocationsPerMinute = 20; // Conservative limit per agent type
  private groundTruthService = GroundTruthIntegrationService.getInstance();
  private groundTruthInitialized = false;
  private confidenceMonitor: ConfidenceMonitor;
  private maxReRefineAttempts = 2; // Default number of refine attempts
  private middleware: AgentMiddleware[] = [];

  constructor(configOrRegistry?: Partial<OrchestratorConfig> | AgentRegistry, ...rest: any[]) {
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
    } else {
      const cfg = (configOrRegistry ?? {}) as Partial<OrchestratorConfig>;
      this.config = {
        maxConcurrent: cfg.maxConcurrent ?? 5,
        timeout: cfg.timeout ?? 30_000,
        ...cfg,
      } as OrchestratorConfig;
      this.registry = new AgentRegistry();
      this.routingLayer = new AgentRoutingLayer();
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

    // Initialize middleware
    this.initializeMiddleware();
  }

  /**
   * Returns checkpoint middleware for HITL (Human-in-the-Loop) endpoints.
   * Returns null when no checkpoint system is configured.
   */
  getCheckpointMiddleware(): any {
    return null;
  }

  private initializeMiddleware(): void {
    this.middleware.push(new IntegrityVetoMiddleware(this));
  }

  private async ensureGroundTruthInitialized(): Promise<void> {
    if (this.groundTruthInitialized) {
      return;
    }
    await this.groundTruthService.initialize();
    this.groundTruthInitialized = true;
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
    const claims = this.extractNumericClaims(payload);

    // Validate ground truth metadata schema if present (best-effort)
    try {
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

    // Check ConfidenceMonitor for low confidence threshold (global signal)
    try {
      const metrics = await this.confidenceMonitor.getMetrics(options.agentType, "hour");
      const confidenceScore = metrics.avgConfidenceScore;

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

    // Best-effort: ask Integrity agent to evaluate this output for per-output confidence
    try {
      if (this.agentAPI) {
        const integrityAgentResponse = await this.agentAPI.invokeAgent({
          agent: "integrity",
          query: JSON.stringify({ intent: "validate_output", payload }),
          context: options.context,
        });

        if (integrityAgentResponse?.success && integrityAgentResponse.data) {
          const ia = integrityAgentResponse.data as any;
          const integrityCheck = ia.integrityCheck ?? ia;

          if (integrityCheck?.confidence !== undefined && integrityCheck.confidence < 0.85) {
            logger.warn("Integrity agent reported low confidence, requesting RE-REFINE", {
              traceId: options.traceId,
              agentType: options.agentType,
              integrityConfidence: integrityCheck.confidence,
            });
            return { vetoed: false, reRefine: true };
          }

          if (Array.isArray(integrityCheck?.issues) && integrityCheck.issues.length > 0) {
            // Check for any high/critical issues that warrant a veto
            const severe = (integrityCheck.issues as any[]).find((issue) =>
              ["high", "critical"].includes(issue.severity) &&
              ["logic_error", "data_integrity"].includes(issue.type)
            );

            if (severe) {
              const vetoMetadata: IntegrityVetoMetadata = {
                integrityVeto: true,
                deviationPercent: 100,
                benchmark: 0,
                metricId: "integrity_agent_issue",
                claimedValue: 0,
                warning: `${severe.type}: ${severe.description}`,
              };

              await logAgentResponse(
                options.agentType,
                options.query ?? "integrity-agent-veto",
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
          }
        }
      }
    } catch (error) {
      logger.warn("Integrity agent call failed during integrity evaluation", {
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
    // Always validate structural schema for outputs. If schema deviation
    // exceeds threshold, flag veto and attempt to get a detailed integrity
    // assessment from the `integrity` agent for richer audit context.
    const validation = StructuralTruthModuleSchema.safeParse(payload);
    if (validation.success) {
      return { vetoed: false };
    }

    const issueCount = validation.error.issues.length;
    const fieldCount = Math.max(1, STRUCTURAL_TRUTH_SCHEMA_FIELDS.length);
    const deviationPercent = Math.min(100, (issueCount / fieldCount) * 100);

    if (deviationPercent <= 15) {
      return { vetoed: false };
    }

    const warning = validation.error.issues
      .slice(0, 3)
      .map((issue) => issue.message)
      .join("; ");

    const vetoMetadata: IntegrityVetoMetadata = {
      integrityVeto: true,
      deviationPercent,
      benchmark: 15,
      metricId: "structural_truth_schema",
      claimedValue: deviationPercent,
      warning: warning || "Structural truth schema deviation exceeded threshold.",
    };

    // Log the immediate veto decision for traceability
    await logAgentResponse(
      options.agentType,
      options.query ?? "structural-truth-veto",
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

    // Try to get a deeper integrity analysis by invoking the Integrity agent
    // This is best-effort — don't fail the pipeline if the agent call fails.
    try {
      if (this.agentAPI) {
        // Ask the integrity agent for a validation report to include in audit logs
        const integrityAgentResponse = await this.agentAPI.invokeAgent({
          agent: "integrity",
          query: JSON.stringify({ intent: "validate_structural", payload }),
          context: options.context,
        });

        if (integrityAgentResponse?.success && integrityAgentResponse.data) {
          vetoMetadata.warning = `${vetoMetadata.warning} | integrity_agent_summary: ${
            typeof integrityAgentResponse.data === "string"
              ? integrityAgentResponse.data
              : JSON.stringify(integrityAgentResponse.data)
          }`;
        }
      }
    } catch (err) {
      logger.warn("Integrity agent call failed while enriching structural veto", {
        traceId: options.traceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return { vetoed: true, metadata: vetoMetadata };
  }

  private async performReRefine(
    agentType: AgentType,
    originalQuery: string,
    agentContext: AgentContext,
    traceId: string,
    maxAttempts: number = this.maxReRefineAttempts
  ): Promise<{ success: boolean; response?: any; attempts: number }> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.info("Attempting RE-REFINE", { traceId, agentType, attempt });
        const refinePrompt = `${originalQuery}\n\nREFINE: Please re-run your analysis with explicit grounding: include metric ids (ESO), numeric citations, provenance metadata, and a causal trace (impact cascade) that links back to any verified Opportunity in memory. Provide structured JSON output where possible. Attempt: ${attempt}`;

        const circuitBreakerKey = `query-${agentType}-refine-${attempt}`;
        const agentResponse = await this.circuitBreakers.execute(
          circuitBreakerKey,
          () =>
            this.agentAPI.invokeAgent({
              agent: agentType,
              query: refinePrompt,
              context: agentContext,
            }),
          { timeoutMs: this.config.defaultTimeoutMs }
        );

        if (!agentResponse?.success) {
          logger.warn("RE-REFINE attempt failed (agent error)", { traceId, agentType, attempt });
          continue;
        }

        const structural = await this.evaluateStructuralTruthVeto(agentResponse.data, {
          traceId,
          agentType,
          query: originalQuery,
          context: agentContext,
        });
        if (structural.vetoed) {
          logger.warn("RE-REFINE produced structurally invalid output, retrying", { traceId, agentType, attempt });
          continue;
        }

        const integrity = await this.evaluateIntegrityVeto(agentResponse.data, {
          traceId,
          agentType,
          query: originalQuery,
          context: agentContext,
        });

        if (integrity.reRefine) {
          logger.info("RE-REFINE requested further refinement", { traceId, agentType, attempt });
          continue;
        }

        if (integrity.vetoed) {
          logger.warn("RE-REFINE produced output that was vetoed", { traceId, agentType, attempt });
          return { success: false, response: agentResponse, attempts: attempt };
        }

        return { success: true, response: agentResponse, attempts: attempt };
      } catch (err) {
        logger.warn("RE-REFINE attempt errored", { traceId, agentType, attempt, error: err instanceof Error ? err.message : String(err) });
        continue;
      }
    }

    logger.info("RE-REFINE exhausted attempts without acceptance", { traceId, agentType, attempts: maxAttempts });
    return { success: false, attempts: maxAttempts };
  }

  private normalizeExecutionRequest(intent: string, execution: Partial<ExecutionRequest> & Record<string, unknown>) {
    return { ...execution, intent };
  }

  private deriveFiscalQuarter(date: Date): string {
    const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
    return `Q${quarter}`;
  }

  private buildExecutionRecord(
    workflowDefinitionId: string,
    workflowVersion: number,
    context: Record<string, any>,
    userId: string,
    traceId: string
  ): WorkflowExecutionRecord {
    const persona = context.persona || context.buyer_persona?.role || context.role;
    const industry = context.industry || context.companyProfile?.industry;
    const fiscalQuarter =
      context.fiscal_quarter || context.quarter || this.deriveFiscalQuarter(new Date());

    return {
      id: uuidv4(),
      workflow_id: workflowDefinitionId,
      workspace_id: context.workspace_id || "",
      organization_id: context.organization_id || "",
      status: "pending",
      started_at: new Date().toISOString(),
      context,
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

    logger.info("Processing query asynchronously", {
      traceId,
      sessionId,
      userId,
      currentStage: currentState.currentStage,
      queryLength: query.length,
    });

    // Determine which agent to use based on query and current stage
    const agentType = this.selectAgent(query, currentState);

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

      const asyncAgentType = this.selectAgent(query, currentState);
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
        agentType = this.selectAgent(query, currentState);
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
    context: Record<string, any> = {},
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

      await this.recordWorkflowEvent(executionId, "workflow_initiated", dag.initial_stage ?? "", {
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
    context: Record<string, any> = {},
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
    const similarEpisodes = await this.memorySystem.retrieve({
      agent_id: "orchestrator",
      organization_id: orgId || "",
      limit: 5,
    });

    // Simulate each stage
    const stepsSimulated: any[] = [];
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

      currentStageId = transition?.to_stage ?? undefined;

      if (dag.final_stages?.includes(currentStageId || "")) {
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
    context: Record<string, any>,
    similarEpisodes: any[]
  ): Promise<{
    outcome: Record<string, any>;
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
      const organizationId = context.organizationId || context.organization_id;
      const response = await this.llmGateway.complete({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.3,
        metadata: {
          tenantId: organizationId,
          agentType: "workflow_predictor",
        },
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
    executionRecord?: WorkflowExecutionRecord
  ): Promise<void> {
    let executionContext = { ...initialContext };
    const defaultRecord: WorkflowExecutionRecord = executionRecord ?? {
      id: executionId,
      workflow_id: dag.id ?? "",
      workspace_id: "",
      organization_id: "",
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
        context: Record<string, any>;
        startedAt: Date;
      }>[] = readyStages.map((stage) => {
        const route = this.routingLayer.routeStage(dag, stage.id, executionContext);
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
          const stageResult = await this.executeStageWithRetry(
            executionId,
            stage,
            context,
            route,
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

            await this.recordWorkflowEvent(executionId, "stage_failed", stage.id, {
              reason: "integrity_veto",
              metadata: structuralCheck.metadata,
            });

            await this.persistExecutionRecord(executionId, recordSnapshot);
            await this.updateExecutionStatus(executionId, "failed", stage.id, recordSnapshot);
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

            await this.recordWorkflowEvent(executionId, "stage_failed", stage.id, {
              reason: "integrity_veto",
              metadata: integrityCheck.metadata,
            });

            await this.persistExecutionRecord(executionId, recordSnapshot);
            await this.updateExecutionStatus(executionId, "failed", stage.id, recordSnapshot);
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

        await this.persistExecutionRecord(executionId, recordSnapshot);
        await this.updateExecutionStatus(executionId, "in_progress", stage.id, recordSnapshot);
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

      await this.updateExecutionStatus(executionId, "failed", null, recordSnapshot);
      return;
    }

    await this.updateExecutionStatus(executionId, "completed", null, recordSnapshot);
  }

  /**
   * Execute a single stage with retry logic
   */
  private async executeStageWithRetry(
    executionId: string,
    stage: WorkflowStage,
    context: Record<string, any>,
    route: StageRoute,
    traceId: string
  ): Promise<{ status: "completed" | "failed"; output?: any; error?: string }> {
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
          () => this.executeStage(stage, context, route),
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

    stageSpan.setAttributes({
      'agent.retry_count': retryResult.attempts ?? 0,
      'agent.latency_ms': Date.now() - stageStart,
    });

    if (retryResult.success && retryResult.response?.data) {
      if (route.selected_agent) {
        this.registry.recordRelease(route.selected_agent.id);
        this.registry.markHealthy(route.selected_agent.id);
      }

      stageSpan.setStatus({ code: SpanStatusCode.OK });
      stageSpan.end();
      return { status: "completed", output: retryResult.response.data };
    }

    if (route.selected_agent) {
      this.registry.recordFailure(route.selected_agent.id);
    }

    const errorMsg = retryResult.error?.message || "Unknown error";
    stageSpan.setStatus({ code: SpanStatusCode.ERROR, message: errorMsg });
    if (retryResult.error) stageSpan.recordException(retryResult.error);
    stageSpan.end();

    return {
      status: "failed",
      error: errorMsg,
    };

    }); // end startActiveSpan for executeStageWithRetry
  }

  /**
   * Execute a single stage using SecureMessageBus
   */
  private async executeStage(
    stage: WorkflowStage,
    context: Record<string, any>,
    route: StageRoute
  ): Promise<Record<string, any>> {
    const execTracer = getTracer();
    return execTracer.startActiveSpan(
      'agent.executeStage',
      {
        attributes: {
          'agent.stage_id': stage.id,
          'agent.agent_type': stage.agent_type,
        },
      },
      async (execSpan: any) => {
        const execStart = Date.now();
        const agentType = stage.agent_type as AgentType;
        const sessionId = context.sessionId || `session_${Date.now()}`;
        const orgId = context.organizationId || context.tenantId || "";
        const agentContext: AgentContext = {
          userId: context.userId,
          sessionId,
          metadata: { currentStage: stage.id },
        };

        // Retrieve relevant memory before execution
        let memoryContext: Record<string, unknown> = {};
        try {
          const memories = await this.memorySystem.retrieve({
            agent_id: agentType,
            organization_id: orgId,
            workspace_id: sessionId,
            limit: 5,
          });
          if (memories.length > 0) {
            memoryContext = {
              pastMemories: memories.map((m) => ({
                content: m.content,
                type: m.memory_type,
                importance: m.importance,
              })),
            };
          }
        } catch (memErr) {
          logger.warn("Failed to retrieve memory for stage execution", {
            stage_id: stage.id,
            error: memErr instanceof Error ? memErr.message : String(memErr),
          });
        }

        try {
          // Use SecureMessageBus for inter-agent communication
          const messageResult = await this.messageBroker.sendToAgent(
            "orchestrator", // From orchestrator
            agentType, // To target agent
            {
              action: "execute",
              description: stage.description || `Execute ${stage.id}`,
              context: { ...agentContext, ...memoryContext },
            },
            {
              priority: "normal",
              timeoutMs: stage.timeout_seconds * 1000,
            }
          );

          if (!messageResult.success) {
            throw new Error(`Agent communication failed: ${messageResult.error}`);
          }

          const durationMs = Date.now() - execStart;

          // Store execution episode in memory
          try {
            await this.memorySystem.storeEpisode({
              sessionId,
              agentId: agentType,
              episodeType: "stage_execution",
              taskIntent: stage.description || stage.id,
              context: { organizationId: orgId, stageId: stage.id },
              initialState: context,
              finalState: messageResult.data as Record<string, unknown> ?? {},
              success: true,
              rewardScore: 0.8,
              durationSeconds: durationMs / 1000,
            });

            await this.memorySystem.storeEpisodicMemory(
              sessionId,
              agentType,
              `Executed stage ${stage.id}: ${stage.description || stage.agent_type}`,
              { success: true, durationMs },
              orgId
            );
          } catch (memErr) {
            logger.warn("Failed to store execution memory", {
              stage_id: stage.id,
              error: memErr instanceof Error ? memErr.message : String(memErr),
            });
          }

          execSpan.setAttributes({ 'agent.latency_ms': durationMs });
          execSpan.setStatus({ code: SpanStatusCode.OK });
          execSpan.end();

          return {
            stage_id: stage.id,
            agent_type: stage.agent_type,
            agent_id: route.selected_agent?.id,
            output: messageResult.data,
          };
        } catch (err) {
          const durationMs = Date.now() - execStart;

          // Store failure episode
          try {
            await this.memorySystem.storeEpisode({
              sessionId,
              agentId: agentType,
              episodeType: "stage_execution",
              taskIntent: stage.description || stage.id,
              context: { organizationId: orgId, stageId: stage.id },
              initialState: context,
              finalState: { error: err instanceof Error ? err.message : String(err) },
              success: false,
              rewardScore: 0.1,
              durationSeconds: durationMs / 1000,
            });
          } catch {
            // Don't let memory failures mask the original error
          }

          execSpan.setAttributes({ 'agent.latency_ms': durationMs });
          execSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          if (err instanceof Error) execSpan.recordException(err);
          execSpan.end();
          throw err;
        }
      }
    );
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
      let response: APIAgentResponse<SDUIPageDefinition>;

      // Route to appropriate agent method
      switch (agent) {
        case "opportunity":
          response = await this.agentAPI.generateValueCase(query, context);
          break;
        case "realization":
          response = await this.agentAPI.generateRealizationDashboard(query, context);
          break;
        case "expansion":
          response = await this.agentAPI.generateExpansionOpportunities(query, context);
          break;
        default:
          response = await this.agentAPI.invokeAgent({ agent, query, context });
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
    rendered: any;
  }> {
    const response = await this.generateSDUIPage(envelope, agent, query, context);

    if (response.sduiPage) {
      const renderPage = await getRenderPage();
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
    context: Record<string, any> = {}
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
    context: Record<string, any>
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
        {
          type: "modeling",
          agent: "financial-modeling",
          deps: ["data_collection"],
        },
        { type: "reporting", agent: "coordinator", deps: ["modeling"] },
      ],
      expansion_planning: [
        { type: "analysis", agent: "expansion", deps: [] },
        {
          type: "opportunity_mapping",
          agent: "opportunity",
          deps: ["analysis"],
        },
        {
          type: "planning",
          agent: "coordinator",
          deps: ["opportunity_mapping"],
        },
      ],
    };

    const pattern = subgoalPatterns[intentType] ?? subgoalPatterns.value_assessment ?? [];
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
    metadata: Record<string, any>
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
    context: Record<string, any>,
    startTime: number
  ): Promise<void> {
    const autonomy = getAutonomyConfig();

    // Check kill switch
    if (autonomy.killSwitchEnabled) {
      securityLogger.log({
        category: "autonomy",
        action: "kill_switch_activated",
        severity: "error",
        metadata: {
          executionId,
          stageId,
          reason: "Global autonomy kill switch is enabled",
        },
      });
      throw new Error("Autonomy kill switch is enabled");
    }

    // Check duration limit
    const elapsed = Date.now() - startTime;
    if (autonomy.maxDurationMs && elapsed > autonomy.maxDurationMs) {
      await this.handleWorkflowFailure(executionId, "Autonomy guard: max duration exceeded");
      securityLogger.log({
        category: "autonomy",
        action: "duration_limit_exceeded",
        severity: "error",
        metadata: {
          executionId,
          stageId,
          elapsedMs: elapsed,
          limitMs: autonomy.maxDurationMs,
        },
      });
      throw new Error("Autonomy guard: max duration exceeded");
    }

    // Check cost limit
    const cost = context.cost_accumulated_usd || 0;
    if (autonomy.maxCostUsd && cost > autonomy.maxCostUsd) {
      await this.handleWorkflowFailure(executionId, "Autonomy guard: max cost exceeded");
      securityLogger.log({
        category: "autonomy",
        action: "cost_limit_exceeded",
        severity: "error",
        metadata: {
          executionId,
          stageId,
          costUsd: cost,
          limitUsd: autonomy.maxCostUsd,
        },
      });
      throw new Error("Autonomy guard: max cost exceeded");
    }

    // Check destructive action approval
    if (autonomy.requireApprovalForDestructive) {
      const approvalState = context.approvals || {};
      const destructivePending = context.destructive_actions_pending as string[] | undefined;
      if (destructivePending && destructivePending.length > 0 && !approvalState[executionId]) {
        await this.handleWorkflowFailure(executionId, "Approval required for destructive actions");
        securityLogger.log({
          category: "autonomy",
          action: "destructive_action_unapproved",
          severity: "error",
          metadata: {
            executionId,
            stageId,
            destructiveActions: destructivePending,
            requiresApproval: true,
          },
        });
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
      securityLogger.log({
        category: "autonomy",
        action: "agent_autonomy_violation",
        severity: "error",
        metadata: {
          executionId,
          stageId,
          agentId: stageAgentId,
          autonomyLevel: level,
          violation: "observe-only agent attempted action",
        },
      });
      throw new Error("Autonomy guard: observe-only agent attempted action");
    }

    // Check agent kill switches
    const agentKillSwitches = autonomy.agentKillSwitches || {};
    if (stageAgentId && agentKillSwitches[stageAgentId]) {
      await this.handleWorkflowFailure(
        executionId,
        `Agent ${stageAgentId} is disabled by kill switch`
      );
      securityLogger.log({
        category: "autonomy",
        action: "agent_kill_switch_activated",
        severity: "error",
        metadata: {
          executionId,
          stageId,
          agentId: stageAgentId,
          killSwitchEnabled: true,
        },
      });
      throw new Error("Autonomy guard: agent disabled");
    }

    // Check iteration limits
    const agentMaxIterations = autonomy.agentMaxIterations || {};
    const maxIterations = stageAgentId ? agentMaxIterations[stageAgentId] : undefined;
    if (maxIterations !== undefined) {
      const executed = (context.executed_steps || []).filter(
        (s: any) => s.agent_id === stageAgentId
      ).length;
      if (executed >= maxIterations) {
        await this.handleWorkflowFailure(
          executionId,
          `Agent ${stageAgentId} exceeded iteration limit`
        );
        securityLogger.log({
          category: "autonomy",
          action: "iteration_limit_exceeded",
          severity: "error",
          metadata: {
            executionId,
            stageId,
            agentId: stageAgentId,
            iterationsExecuted: executed,
            maxIterations,
          },
        });
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
    output?: Record<string, any>
  ): Promise<void> {
    await supabase.from("workflow_stage_runs").insert({
      execution_id: executionId,
      stage_id: stage.id,
      stage_name: stage.name || stage.id,
      lifecycle_stage: stage.agent_type,
      status: "completed",
      inputs: (executionRecord.io as Record<string, unknown> | undefined)?.inputs,
      assumptions: (executionRecord.io as Record<string, unknown> | undefined)?.assumptions,
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
    const update: any = {
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
  async getExecutionStatus(executionId: string): Promise<any> {
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
    return state.status === "completed";
  }

  getProgress(state: WorkflowState, totalStages: number = 5): number {
    return Math.round((state.completed_steps.length / totalStages) * 100);
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
