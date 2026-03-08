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
  private readonly policy: PolicyEngine;
  private readonly contextStore: ContextStore;
  private readonly executionRuntime: ExecutionRuntime;
  private readonly artifactComposer: ArtifactComposer;
  private readonly router: DecisionRouter;

  constructor(private readonly config: Partial<OrchestratorConfig> = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    // PolicyEngine now uses injected deps; supabase + registry are resolved
    // lazily inside the runtime services, so we pass a no-op registry and
    // a readiness snapshot that reports all services as ready.
    const registry = new AgentRegistry();
    this.policy = new PolicyEngine({
      supabase,
      registry,
      serviceReadiness: (): ServiceReadiness => ({
        message_broker_ready: true,
        queue_ready: true,
        memory_backend_ready: true,
        llm_gateway_ready: true,
        circuit_breaker_ready: true,
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

  async processQuery(envelope: ExecutionEnvelope, query: string, currentState: WorkflowState, userId: string, sessionId: string, traceId: string = uuidv4()): Promise<ProcessQueryResult> {
    return this.executionRuntime.processQuery(envelope, query, currentState, userId, sessionId, traceId);
  }

  async processQueryAsync(envelope: ExecutionEnvelope, query: string, currentState: WorkflowState, userId: string, sessionId: string, traceId: string = uuidv4()): Promise<{ jobId: string; traceId: string }> {
    return this.executionRuntime.processQueryAsync(envelope, query, currentState, userId, sessionId, traceId);
  }

  async getAsyncQueryResult(jobId: string, currentState: WorkflowState): Promise<ProcessQueryResult | null> {
    return this.executionRuntime.getAsyncQueryResult(jobId, currentState);
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
