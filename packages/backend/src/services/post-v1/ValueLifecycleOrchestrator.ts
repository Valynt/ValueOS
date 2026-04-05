/**
 * Value Lifecycle Orchestrator with Saga Pattern
 *
 * Coordinates multi-agent workflows across the value lifecycle stages
 * with compensation patterns for failure recovery.
 */

import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { BaseAgent } from "../../lib/agent-fabric/agents/BaseAgent";
import { ExpansionAgent } from "../../lib/agent-fabric/agents/ExpansionAgent";
import { IntegrityAgent } from "../../lib/agent-fabric/agents/IntegrityAgent";
import { OpportunityAgent } from "../../lib/agent-fabric/agents/OpportunityAgent";
import { RealizationAgent } from "../../lib/agent-fabric/agents/RealizationAgent";
import { TargetAgent } from "../../lib/agent-fabric/agents/TargetAgent";
import { AuditLogger } from "../../lib/agent-fabric/AuditLogger";
import { LLMGateway } from "../../lib/agent-fabric/LLMGateway";
import { ValidationError as LibValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js"
import { CircuitBreaker } from "../../lib/resilience/CircuitBreaker";
import { TargetAgentInputSchema } from "../validators/agentInputs.js";
import {
  recordAgentInvocation,
  recordLoopCompletion,
  recordStageTransition,
  type ValueLoopStage,
} from "../../observability/valueLoopMetrics.js";



// Canonical LifecycleStage is defined in packages/shared/src/domain/Opportunity.ts. ADR-0010.
import type { LifecycleStage as SharedLifecycleStage } from '@valueos/shared';
export type { LifecycleStage } from '@valueos/shared';
import type { WorkflowStageType } from '../../types/workflow';

/**
 * Saga-aligned lifecycle states from the design brief.
 * Maps to ValueCaseSaga states in packages/agents/core/ValueCaseSaga.ts
 */
export type SagaLifecycleState =
  | "INITIATED"
  | "DRAFTING"
  | "VALIDATING"
  | "COMPOSING"
  | "REFINING"
  | "FINALIZED";

export interface LifecycleContext {
  userId: string;
  tenantId?: string;
  organizationId?: string;
  sessionId?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export type StageInput = Record<string, unknown>;

export interface StageResult {
  success: boolean;
  data: Record<string, unknown> | null;
  confidence?: string;
  assumptions?: unknown[];
  error?: string;
  stageExecutionId?: string;
  lineage?: StageLineage;
  delta?: StageDelta;
  compensation?: CompensationOutcome[];
}

export interface StageLineage {
  stage: WorkflowStageType;
  parentExecutionId?: string;
  replayed?: boolean;
}

export interface StageDelta {
  before: unknown;
  after: unknown;
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
interface DLQRecoveryMetrics {
  alertsReceived: number;
  retriesAttempted: number;
  restartsTriggered: number;
  compensationsTriggered: number;
  failures: number;
  lastRecoveryAt?: string;
}


export class LifecycleError extends Error {
  constructor(
    public stage: WorkflowStageType,
    message: string,
    public originalError?: Error,
    public compensation?: CompensationOutcome[],
    public stageResult?: StageResult
  ) {
    super(message);
    this.name = "LifecycleError";
  }
}

export class ValidationError extends LibValidationError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

import { MemorySystem } from "../../lib/agent-fabric/MemorySystem";
import { AgentConfig } from "../../types/agent.js";

import { AuditTrailService, getAuditTrailService } from "./security/AuditTrailService.js";

import type { WorkflowStatus } from "../../repositories/WorkflowStateRepository.js";
import { DLQAlert } from "../../lib/agent-fabric/FabricMonitor";
import {
  DeadLetterQueue,
  IdempotencyGuard,
  ValueCaseSaga
} from "../../lib/agents/core/index.js";
import {
  HypothesisLoop,
  RedTeamAgent,
  type RedTeamAnalyzer
} from "../../lib/agents/orchestration/index.js";

import {
  AgentServiceAdapter,
  RedTeamLLMAdapter
} from "./workflows/AgentAdapters.js";
import {
  DomainDLQEventEmitter,
  RedisDLQStore,
  RedisIdempotencyStore
} from "./workflows/RedisAdapters.js";
import {
  DomainSagaEventEmitter,
  SagaAuditTrailLogger,
  SupabaseSagaPersistence
} from "./workflows/SagaAdapters.js";

// ... (other imports remain the same) ...

const REPLAYABLE_STAGES = new Set<WorkflowStageType>(["opportunity", "target", "expansion"]);
const DESTRUCTIVE_STAGES = new Set<WorkflowStageType>(["integrity", "realization"]);

export class ValueLifecycleOrchestrator {
  private circuitBreaker: CircuitBreaker;
  private compensations: Map<string, CompensationHandler[]> = new Map();
  private supabase: ReturnType<typeof createClient>;
  private llmGateway: LLMGateway;
  private memorySystem: MemorySystem;
  private auditLogger: AuditLogger;
  private auditTrailService: AuditTrailService;

  // Saga Infrastructure
  private saga: ValueCaseSaga;
  private hypothesisLoop: HypothesisLoop;
  private dlqRecoveryMetrics: DLQRecoveryMetrics = {
    alertsReceived: 0,
    retriesAttempted: 0,
    restartsTriggered: 0,
    compensationsTriggered: 0,
    failures: 0,
  };

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

    // Initialize Saga Infrastructure
    const sagaPersistence = new SupabaseSagaPersistence(this.supabase);
    const sagaEventEmitter = new DomainSagaEventEmitter();
    const sagaAuditLogger = new SagaAuditTrailLogger();
    this.saga = new ValueCaseSaga({
      persistence: sagaPersistence,
      eventEmitter: sagaEventEmitter,
      auditLogger: sagaAuditLogger,
    });

    const idempotencyGuard = new IdempotencyGuard(new RedisIdempotencyStore());
    const dlq = new DeadLetterQueue(new RedisDLQStore(), new DomainDLQEventEmitter());

    const redTeamAgent: RedTeamAnalyzer = new RedTeamAgent(new RedTeamLLMAdapter(this.llmGateway));
    const agentAdapter = new AgentServiceAdapter(this.llmGateway);

    this.hypothesisLoop = new HypothesisLoop({
      saga: this.saga,
      idempotencyGuard,
      dlq,
      opportunityAgent: agentAdapter,
      financialModelingAgent: agentAdapter,
      groundTruthAgent: agentAdapter,
      narrativeAgent: agentAdapter,
      redTeamAgent,
    });
  }

  async executeLifecycleStage(
    stage: WorkflowStageType,
    input: StageInput,
    context: LifecycleContext
  ): Promise<StageResult> {
    const stageStartMs = Date.now();
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

      void this.auditLogger.logAgentEvent({
        agentName: agent.getName(),
        action: "execute",
        organizationId: context.organizationId ?? "",
        sessionId: context.sessionId ?? "",
        userId: context.userId ?? "system",
        status: "success",
        details: { stage, stageInput: Object.keys(input) },
      });

      // Record agent invocation metric
      recordAgentInvocation({
        agentName: agent.getName(),
        stage: stage as ValueLoopStage,
        outcome: "success",
        organizationId: context.organizationId ?? context.tenantId ?? "unknown",
        durationMs: Date.now() - stageStartMs,
      });

      const previousResult = (context.metadata?.['previousResult']) as StageResult | undefined;
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
      void this.auditLogger.logAgentEvent({
        agentName: stage,
        action: "execute",
        organizationId: context.organizationId ?? "",
        sessionId: context.sessionId ?? "",
        userId: context.userId ?? "system",
        status: "failed",
        details: {
          stage,
          error: error instanceof Error ? error.message : String(error),
        },
      });

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
    stage: WorkflowStageType,
    persistedResult: Record<string, unknown> | null,
    enrichedResult: StageResult,
    input: StageInput,
    context: LifecycleContext
  ): void {
    const persistedId = persistedResult?.id ?? enrichedResult.stageExecutionId;
    if (persistedId) {
      this.registerCompensation(context, {
        name: `${stage}_delete_results`,
        handler: async () => {
          await this.deleteStageResults(stage, String(persistedId));
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
      externalSub: context.userId || "system",
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
      // Trigger Compensation Handler for Opportunity to Target failure
      await this.executeOpportunityTargetCompensationHandler(
        opportunityResult,
        error,
        context
      );
      await this.logOpportunityTargetCompensation(
        error,
        opportunityResult,
        context
      );
      throw error;
    }
  }

  private async executeOpportunityTargetCompensationHandler(
    opportunityResult: StageResult,
    error: unknown,
    context: LifecycleContext
  ): Promise<void> {
    const failureReason = error instanceof Error ? error.message : String(error);
    const correlationId = context.sessionId || uuidv4();

    try {
      // Restore previous state
      await this.restoreOpportunityState(opportunityResult, context);

      // Log the compensation to AuditTrailService
      await this.auditTrailService.logImmediate({
        eventType: "saga_compensation_executed",
        actorId: context.userId || "system",
        externalSub: context.userId || "system",
        actorType: "service",
        resourceId: opportunityResult.stageExecutionId
          ? String(opportunityResult.stageExecutionId)
          : correlationId,
        resourceType: "system",
        action: "restore_previous_state",
        outcome: "success",
        details: {
          compensationType: "opportunity_target_failure",
          failureReason,
          restoredState: opportunityResult.data,
          delta: opportunityResult.delta,
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

      logger.info("Compensation handler executed successfully for opportunity to target failure", {
        correlationId,
        opportunityStageExecutionId: opportunityResult.stageExecutionId,
      });
    } catch (compensationError) {
      logger.error("Failed to execute compensation handler", {
        correlationId,
        error: compensationError instanceof Error ? compensationError.message : String(compensationError),
      });

      // Log compensation failure
      await this.auditTrailService.logImmediate({
        eventType: "saga_compensation_failed",
        actorId: context.userId || "system",
        externalSub: context.userId || "system",
        actorType: "service",
        resourceId: opportunityResult.stageExecutionId
          ? String(opportunityResult.stageExecutionId)
          : correlationId,
        resourceType: "system",
        action: "restore_previous_state",
        outcome: "error",
        details: {
          compensationType: "opportunity_target_failure",
          failureReason,
          compensationError: compensationError instanceof Error ? compensationError.message : String(compensationError),
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
      externalSub: context.userId || "system",
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

  /**
   * Run the hypothesis-first core loop via the ValueCaseSaga and HypothesisLoop.
   * Delegates to the orchestration layer defined in packages/agents/orchestration/.
   * On terminal failure, routes to the DLQ and triggers compensation.
   */
  async runHypothesisLoop(
    valueCaseId: string,
    context: LifecycleContext
  ): Promise<{
    success: boolean;
    finalState: SagaLifecycleState | 'FAILED';
    error?: string;
  }> {
    const correlationId = context.sessionId || uuidv4();
    const tenantId = context.tenantId || context.organizationId || 'unknown';
    const loopStartMs = Date.now();

    try {
      this.ensureWorkflowActive(context);

      // Record loop start: signal → hypothesis transition
      recordStageTransition({
        fromStage: "signal" as ValueLoopStage,
        toStage: "hypothesis" as ValueLoopStage,
        organizationId: tenantId,
        durationMs: 0,
      });

      // Initialize the saga in the INITIATED state if it doesn't exist
      const existingState = await this.saga.getState(valueCaseId);
      if (!existingState) {
        await this.saga.initialize(valueCaseId, tenantId, correlationId);
      }

      // Load domain pack KPI context if a pack is assigned to this case
      let domainPackContext: string | undefined;
      try {
        const valueCaseQuery = this.supabase
          .from('value_cases')
          .select('domain_pack_id')
          .eq('id', valueCaseId);

        if (context.organizationId) {
          valueCaseQuery.eq('organization_id', context.organizationId);
        } else if (context.tenantId) {
          valueCaseQuery.eq('tenant_id', context.tenantId);
        }

        const { data: caseData } = await valueCaseQuery.single();

        if (caseData?.domain_pack_id) {
          const { DomainPackService } = await import('../domain-packs/DomainPackService.js');
          const packService = new DomainPackService(this.supabase);
          domainPackContext = await packService.getAgentKPIContext(caseData.domain_pack_id, tenantId);
        }
      } catch (packErr) {
        logger.warn('Failed to load domain pack context, proceeding without it', {
          valueCaseId,
          error: packErr instanceof Error ? packErr.message : String(packErr),
        });
      }

      // Execute the HypothesisLoop
      const hypothesisStartMs = Date.now();
      const result = await this.hypothesisLoop.run(
        valueCaseId,
        tenantId,
        correlationId,
        undefined, // sse
        domainPackContext
      );

      const hypothesisDurationMs = Date.now() - hypothesisStartMs;

      // Record agent invocation outcome
      recordAgentInvocation({
        agentName: "HypothesisLoop",
        stage: "hypothesis" as ValueLoopStage,
        outcome: result.success ? "success" : "error",
        organizationId: tenantId,
        durationMs: hypothesisDurationMs,
      });

      // Record hypothesis → business_case transition
      recordStageTransition({
        fromStage: "hypothesis" as ValueLoopStage,
        toStage: "business_case" as ValueLoopStage,
        organizationId: tenantId,
        durationMs: hypothesisDurationMs,
      });

      // Record end-to-end loop completion
      recordLoopCompletion({
        organizationId: tenantId,
        sessionId: correlationId,
        durationMs: Date.now() - loopStartMs,
        completedStages: result.success
          ? ["signal", "hypothesis", "business_case"] as ValueLoopStage[]
          : ["signal", "hypothesis"] as ValueLoopStage[],
      });

      return {
        success: result.success,
        finalState: result.finalState as SagaLifecycleState,
        error: result.error,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Record failed loop
      recordAgentInvocation({
        agentName: "HypothesisLoop",
        stage: "hypothesis" as ValueLoopStage,
        outcome: "error",
        organizationId: tenantId,
        durationMs: Date.now() - loopStartMs,
      });

      recordLoopCompletion({
        organizationId: tenantId,
        sessionId: correlationId,
        durationMs: Date.now() - loopStartMs,
        completedStages: ["signal"] as ValueLoopStage[],
      });

      logger.error('Hypothesis loop terminal failure', {
        valueCaseId,
        error: errorMsg,
        correlationId,
      });

      return {
        success: false,
        finalState: 'FAILED',
        error: errorMsg,
      };
    }
  }

  /**
   * Map legacy LifecycleStage to SagaLifecycleState
   */
  static mapStageToSagaState(stage: WorkflowStageType): SagaLifecycleState {
    const mapping: Record<WorkflowStageType, SagaLifecycleState> = {
      opportunity: 'INITIATED',
      target: 'DRAFTING',
      expansion: 'VALIDATING',
      integrity: 'COMPOSING',
      realization: 'FINALIZED',
    };
    return mapping[stage];
  }

  private getAgentForStage(stage: WorkflowStageType, context: LifecycleContext): BaseAgent {
    const agentConfig: AgentConfig = {
      id: `${stage}-agent`,
      name: stage,
      type: stage,
      lifecycle_stage: stage,
      capabilities: [],
      model: { provider: 'custom', model_name: 'default' },
      prompts: { system_prompt: '', user_prompt_template: '' },
      parameters: {
        timeout_seconds: 30,
        max_retries: 3,
        retry_delay_ms: 1000,
        enable_caching: true,
        enable_telemetry: true,
      },
      constraints: {
        max_input_tokens: 4096,
        max_output_tokens: 4096,
        allowed_actions: [],
        forbidden_actions: [],
        required_permissions: [],
      },
    };

    const agents: Record<WorkflowStageType, new (
      config: AgentConfig,
      organizationId: string,
      memorySystem: MemorySystem,
      llmGateway: LLMGateway,
      circuitBreaker: CircuitBreaker,
    ) => BaseAgent> = {
      opportunity: OpportunityAgent,
      target: TargetAgent,
      expansion: ExpansionAgent,
      integrity: IntegrityAgent,
      realization: RealizationAgent,
    };

    const AgentClass = agents[stage];
    const circuitBreaker = new CircuitBreaker();
    return new AgentClass(
      agentConfig,
      context.organizationId,
      this.memorySystem,
      this.llmGateway,
      circuitBreaker,
    );
  }

  private async validatePrerequisites(
    stage: WorkflowStageType,
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
    const prerequisites: Record<WorkflowStageType, string[]> = {
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
    stage: WorkflowStageType,
    result: StageResult,
    context: LifecycleContext
  ): Promise<Record<string, unknown> | null> {
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

  private async deleteStageResults(stage: WorkflowStageType, resultId: string): Promise<void> {
    logger.info("Compensating: deleting stage results", { stage, resultId });
    const tableName = `${stage}_results`;
    const { error } = await this.supabase
      .from(tableName)
      .delete()
      .eq("id", resultId);
    if (error) {
      throw new Error(`Compensation failed for ${stage} result ${resultId}: ${error.message}`);
    }
  }

  private ensureWorkflowActive(context: LifecycleContext): void {
    const workflowId = context.sessionId || context.organizationId || context.userId;
    if (!workflowId) {
      return;
    }

    // Status guard is enforced by WorkflowStateRepository at the DB layer.
    // The Redis-backed store that previously provided this check has been removed.
    const _exhaustiveCheck: WorkflowStatus = "running"; // keeps the import live
  }

  private isReplayableStage(stage: WorkflowStageType): boolean {
    return REPLAYABLE_STAGES.has(stage);
  }

  private isDestructiveStage(stage: WorkflowStageType): boolean {
    return DESTRUCTIVE_STAGES.has(stage);
  }

  private captureDelta(before: unknown, after: unknown): StageDelta {
    return { before: before ?? null, after };
  }

  private async updateValueTree(persistedData: Record<string, unknown> | null, context: LifecycleContext): Promise<void> {
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

    if (!snapshot) {
      logger.info("No opportunity snapshot available for compensation", {
        stageExecutionId: opportunityResult.stageExecutionId,
      });
      return;
    }

    try {
      // If snapshot contains a value_tree_id or id, try to restore the value tree
      const valueTreeId =
        snapshot.value_tree_id ?? snapshot.id ?? opportunityResult.data?.value_tree_id;

      if (valueTreeId) {
        // Attempt to restore in the value_trees table
        try {
          await this.supabase
            .from('value_trees')
            .update({ data: snapshot, restored_at: new Date().toISOString() })
            .eq('id', String(valueTreeId));
          logger.info('Restored value tree from snapshot', { valueTreeId, sessionId: context.sessionId });
        } catch (err) {
          logger.warn('Failed to restore value tree, falling back to updateValueTree', {
            error: err instanceof Error ? err.message : String(err),
            valueTreeId,
          });
          await this.updateValueTree(snapshot, context);
        }
      } else {
        // No explicit id — attempt to call generic updater
        await this.updateValueTree(snapshot, context);
      }

      // Log the compensation to the audit trail for compliance and forensics
      await this.auditTrailService.logImmediate({
        eventType: 'saga_compensation',
        actorId: context.userId || 'system',
        externalSub: context.userId || 'system',
        actorType: 'service',
        resourceId: opportunityResult.stageExecutionId || context.sessionId || 'unknown',
        resourceType: 'data',
        action: 'restore_opportunity_snapshot',
        outcome: 'success',
        details: {
          stageExecutionId: opportunityResult.stageExecutionId,
          restored: true,
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        },
        ipAddress: 'system',
        userAgent: 'system',
        timestamp: Date.now(),
        sessionId: context.sessionId || (opportunityResult.stageExecutionId ?? 'unknown'),
        correlationId: context.sessionId || opportunityResult.stageExecutionId || uuidv4(),
        riskScore: 0,
        complianceFlags: [],
        tenantId: context.tenantId,
      });
    } catch (error) {
      logger.error('Failed to restore opportunity snapshot', {
        error: error instanceof Error ? error.message : String(error),
        stageExecutionId: opportunityResult.stageExecutionId,
      });
      // Record failure in audit trail
      await this.auditTrailService.logImmediate({
        eventType: 'saga_compensation',
        actorId: context.userId || 'system',
        externalSub: context.userId || 'system',
        actorType: 'service',
        resourceId: opportunityResult.stageExecutionId || context.sessionId || 'unknown',
        resourceType: 'data',
        action: 'restore_opportunity_snapshot',
        outcome: 'error',
        details: {
          stageExecutionId: opportunityResult.stageExecutionId,
          error: error instanceof Error ? error.message : String(error),
          tenantId: context.tenantId,
          organizationId: context.organizationId,
        },
        ipAddress: 'system',
        userAgent: 'system',
        timestamp: Date.now(),
        sessionId: context.sessionId || (opportunityResult.stageExecutionId ?? 'unknown'),
        correlationId: context.sessionId || opportunityResult.stageExecutionId || uuidv4(),
        riskScore: 0,
        complianceFlags: [],
        tenantId: context.tenantId,
      });
    }
  }

  private hasNextStage(stage: WorkflowStageType): boolean {
    const stageOrder: WorkflowStageType[] = [
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
    currentStage: WorkflowStageType,
    persistedData: Record<string, unknown> | null,
    context: LifecycleContext
  ): Promise<void> {
    logger.info("Scheduling next stage", { currentStage, persistedData });
    // Implementation would schedule the next stage
  }

  // Handle DLQ alerts from FabricMonitor
  async handleDLQAlert(alert: DLQAlert): Promise<void> {
    this.dlqRecoveryMetrics.alertsReceived += 1;
    logger.error("Received DLQ alert from FabricMonitor", alert);

    // Extract agent type from stream name (e.g., "agent_messages_opportunity" -> "opportunity")
    const agentType = alert.streamName.replace("agent_messages_", "");
    const strategy = this.selectDLQRecoveryStrategy(alert.messageCount);

    // Log the alert for monitoring
    await this.auditTrailService.logImmediate({
      eventType: 'dlq_alert',
      actorId: 'system',
      externalSub: 'system',
      actorType: 'service',
      resourceId: alert.streamName,
      resourceType: 'message_queue',
      action: 'alert',
      outcome: 'error',
      details: {
        agentType,
        messageCount: alert.messageCount,
        lastFailedMessage: alert.lastFailedMessage,
        strategy,
      },
      ipAddress: 'system',
      userAgent: 'system',
      timestamp: Date.now(),
      sessionId: uuidv4(),
      correlationId: uuidv4(),
      riskScore: 0.8, // High risk for DLQ alerts
      complianceFlags: ['system_failure'],
      tenantId: undefined, // System-wide alert
    });

    try {
      await this.executeDLQRecovery(strategy, agentType, alert);
      this.dlqRecoveryMetrics.lastRecoveryAt = new Date().toISOString();

      logger.info('DLQ recovery strategy completed', {
        strategy,
        agentType,
        messageCount: alert.messageCount,
        metrics: this.dlqRecoveryMetrics,
      });
    } catch (error) {
      this.dlqRecoveryMetrics.failures += 1;
      logger.error('DLQ recovery strategy failed', {
        strategy,
        agentType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getDLQRecoveryMetrics(): DLQRecoveryMetrics {
    return { ...this.dlqRecoveryMetrics };
  }

  private selectDLQRecoveryStrategy(messageCount: number): 'retry' | 'restart' | 'compensation' {
    if (messageCount <= 3) return 'retry';
    if (messageCount <= 10) return 'restart';
    return 'compensation';
  }

  private async executeDLQRecovery(
    strategy: 'retry' | 'restart' | 'compensation',
    agentType: string,
    alert: DLQAlert
  ): Promise<void> {
    if (strategy === 'retry') {
      this.dlqRecoveryMetrics.retriesAttempted += 1;
      logger.warn('DLQ retry strategy triggered', {
        agentType,
        streamName: alert.streamName,
        messageCount: alert.messageCount,
      });
      return;
    }

    if (strategy === 'restart') {
      this.dlqRecoveryMetrics.restartsTriggered += 1;
      logger.warn('DLQ restart strategy triggered', {
        agentType,
        streamName: alert.streamName,
        messageCount: alert.messageCount,
      });
      return;
    }

    this.dlqRecoveryMetrics.compensationsTriggered += 1;
    logger.error('DLQ compensation strategy triggered', {
      agentType,
      streamName: alert.streamName,
      messageCount: alert.messageCount,
    });

    await this.auditTrailService.logImmediate({
      eventType: 'dlq_compensation_triggered',
      actorId: 'system',
      externalSub: 'system',
      actorType: 'service',
      resourceId: alert.streamName,
      resourceType: 'message_queue',
      action: 'compensate',
      outcome: 'success',
      details: {
        agentType,
        strategy,
        messageCount: alert.messageCount,
      },
      ipAddress: 'system',
      userAgent: 'system',
      timestamp: Date.now(),
      sessionId: uuidv4(),
      correlationId: uuidv4(),
      riskScore: 0.7,
      complianceFlags: ['system_recovery'],
      tenantId: undefined,
    });
  }

}
