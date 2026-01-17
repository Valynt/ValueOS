/**
 * Unified Agent Orchestrator - Refactored
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

import { logger } from "../../../lib/logger";
import { v4 as uuidv4 } from "uuid";
import { CircuitBreakerManager } from "./CircuitBreaker";
import { AgentRecord, AgentRegistry } from "./AgentRegistry";
import { SDUIPageDefinition, validateSDUISchema } from "../../../sdui/schema";
import { getAuditLogger, logAgentResponse } from "./AgentAuditLogger";
import { AgentType } from "./agent-types";
import { AgentHealthStatus, ConfidenceLevel } from "../../../types/agent";
import { env, getEnvVar, getGroundtruthConfig } from "../../../lib/env";
import GroundtruthAPI, {
  GroundtruthAPIConfig,
  GroundtruthRequestPayload,
  GroundtruthRequestOptions,
} from "./GroundtruthAPI";
import { getAgentMessageBroker, AgentMessageBroker } from "./AgentMessageBroker";
import { WorkflowStatus } from "../../../types";
import { WorkflowExecutionRecord } from "../../../types/workflowExecution";
import { ExecutionRequest } from "../../../types/execution";
import { WorkflowState } from "../../../repositories/WorkflowStateRepository";
import { AgentContext, AgentResponse as APIAgentResponse, getAgentAPI } from "./AgentAPI";
import { renderPage, RenderPageOptions } from "../../../sdui/renderPage";
import { WorkflowDAG, WorkflowEvent, WorkflowStage } from "../../../types/workflow";
import { AgentRoutingLayer, StageRoute } from "./AgentRoutingLayer";
import { supabase } from "../../../lib/supabase";
import { getAutonomyConfig } from "../../../config/autonomy";
import { MemorySystem } from "../../../lib/agent-fabric/MemorySystem";
import { LLMGateway } from "../../../lib/agent-fabric/LLMGateway";
import { llmConfig } from "../../../config/llm";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface OrchestratorConfig {
  enableCircuitBreaker: boolean;
  enableAuditLogging: boolean;
  enableMemorySystem: boolean;
  maxConcurrentRequests: number;
  defaultTimeout: number;
  retryAttempts: number;
}

export interface AgentRequest {
  id: string;
  type: AgentType;
  input: any;
  context: AgentContext;
  options?: AgentRequestOptions;
}

export interface AgentRequestOptions {
  timeout?: number;
  priority?: "low" | "medium" | "high";
  retryAttempts?: number;
  enableCache?: boolean;
  metadata?: Record<string, any>;
}

export interface AgentResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  metadata: ResponseMetadata;
}

export interface ResponseMetadata {
  executionTime: number;
  agentVersion: string;
  confidence: ConfidenceLevel;
  tokensUsed?: number;
  cost?: number;
  traceId: string;
}

export interface WorkflowRequest {
  id: string;
  workflowType: string;
  initialContext: AgentContext;
  stages: WorkflowStage[];
  options?: WorkflowOptions;
}

export interface WorkflowOptions {
  enableParallelExecution?: boolean;
  continueOnError?: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowResponse {
  id: string;
  success: boolean;
  results: Record<WorkflowStage, AgentResponse>;
  finalState: WorkflowState;
  metadata: WorkflowMetadata;
}

export interface WorkflowMetadata {
  totalExecutionTime: number;
  stagesCompleted: number;
  stagesFailed: number;
  totalTokensUsed: number;
  totalCost: number;
  traceId: string;
}

// ============================================================================
// Main Orchestrator Class
// ============================================================================

export class UnifiedAgentOrchestrator {
  private config: OrchestratorConfig;
  private circuitBreaker: CircuitBreakerManager;
  private auditLogger: any;
  private messageBroker: AgentMessageBroker;
  private routingLayer: AgentRoutingLayer;
  private memorySystem: MemorySystem;
  private llmGateway: LLMGateway;
  private groundtruthAPI: GroundtruthAPI;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      enableCircuitBreaker: true,
      enableAuditLogging: true,
      enableMemorySystem: true,
      maxConcurrentRequests: 10,
      defaultTimeout: 30000,
      retryAttempts: 3,
      ...config,
    };

    this.initializeServices();
  }

  private initializeServices(): void {
    if (this.config.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreakerManager();
    }

    if (this.config.enableAuditLogging) {
      this.auditLogger = getAuditLogger();
    }

    this.messageBroker = getAgentMessageBroker();
    this.routingLayer = new AgentRoutingLayer();
    this.memorySystem = new MemorySystem();
    this.llmGateway = new LLMGateway(llmConfig);

    const groundtruthConfig = getGroundtruthConfig();
    this.groundtruthAPI = new GroundtruthAPI(groundtruthConfig);
  }

  // ============================================================================
  // Single Agent Execution
  // ============================================================================

  async executeAgent(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const traceId = uuidv4();

    try {
      logger.info("Executing agent request", {
        agentType: request.type,
        requestId: request.id,
        traceId,
      });

      // Validate request
      this.validateAgentRequest(request);

      // Check circuit breaker
      if (this.config.enableCircuitBreaker) {
        const isAllowed = await this.circuitBreaker.checkAvailability(request.type);
        if (!isAllowed) {
          throw new Error(`Agent ${request.type} is currently unavailable`);
        }
      }

      // Get agent record
      const agentRecord = AgentRegistry.getAgent(request.type);
      if (!agentRecord) {
        throw new Error(`Agent ${request.type} not found in registry`);
      }

      // Prepare execution context
      const context = await this.prepareExecutionContext(request, agentRecord);

      // Execute agent
      const result = await this.executeAgentWithRetry(request, context, traceId);

      // Log success
      if (this.config.enableAuditLogging) {
        await this.auditLogger.logAgentExecution({
          requestId: request.id,
          agentType: request.type,
          success: true,
          executionTime: Date.now() - startTime,
          traceId,
        });
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error("Agent execution failed", {
        agentType: request.type,
        requestId: request.id,
        error: error.message,
        executionTime,
        traceId,
      });

      // Log failure
      if (this.config.enableAuditLogging) {
        await this.auditLogger.logAgentExecution({
          requestId: request.id,
          agentType: request.type,
          success: false,
          error: error.message,
          executionTime,
          traceId,
        });
      }

      // Update circuit breaker
      if (this.config.enableCircuitBreaker) {
        await this.circuitBreaker.recordFailure(request.type);
      }

      return {
        id: request.id,
        success: false,
        error: error.message,
        metadata: {
          executionTime,
          agentVersion: "unknown",
          confidence: ConfidenceLevel.LOW,
          traceId,
        },
      };
    }
  }

  // ============================================================================
  // Workflow Execution
  // ============================================================================

  async executeWorkflow(request: WorkflowRequest): Promise<WorkflowResponse> {
    const startTime = Date.now();
    const traceId = uuidv4();
    const results: Record<WorkflowStage, AgentResponse> = {} as any;
    let currentContext = request.initialContext;

    try {
      logger.info("Executing workflow", {
        workflowType: request.workflowType,
        requestId: request.id,
        stages: request.stages,
        traceId,
      });

      // Validate workflow request
      this.validateWorkflowRequest(request);

      // Create workflow execution record
      const executionRecord = await this.createWorkflowExecutionRecord(request, traceId);

      // Execute stages
      for (const stage of request.stages) {
        try {
          const agentRequest = await this.createAgentRequestFromStage(
            stage,
            currentContext,
            request.options
          );

          const response = await this.executeAgent(agentRequest);
          results[stage] = response;

          if (response.success && response.data) {
            // Update context for next stage
            currentContext = await this.updateContextFromResponse(
              currentContext,
              response.data,
              stage
            );
          } else if (!request.options?.continueOnError) {
            throw new Error(`Stage ${stage} failed: ${response.error}`);
          }
        } catch (error) {
          results[stage] = {
            id: uuidv4(),
            success: false,
            error: error.message,
            metadata: {
              executionTime: 0,
              agentVersion: "unknown",
              confidence: ConfidenceLevel.LOW,
              traceId,
            },
          };

          if (!request.options?.continueOnError) {
            throw error;
          }
        }
      }

      // Create final workflow state
      const finalState = await this.createFinalWorkflowState(request, currentContext, results);

      // Calculate metadata
      const metadata = this.calculateWorkflowMetadata(results, startTime, traceId);

      // Update execution record
      await this.updateWorkflowExecutionRecord(executionRecord.id, {
        status: "completed",
        finalState,
        results,
        metadata,
      });

      logger.info("Workflow completed successfully", {
        requestId: request.id,
        executionTime: metadata.totalExecutionTime,
        traceId,
      });

      return {
        id: request.id,
        success: true,
        results,
        finalState,
        metadata,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error("Workflow execution failed", {
        workflowType: request.workflowType,
        requestId: request.id,
        error: error.message,
        executionTime,
        traceId,
      });

      return {
        id: request.id,
        success: false,
        results,
        finalState: await this.createErrorWorkflowState(request.initialContext, error.message),
        metadata: {
          totalExecutionTime: executionTime,
          stagesCompleted: Object.keys(results).length,
          stagesFailed: request.stages.length - Object.keys(results).length,
          totalTokensUsed: 0,
          totalCost: 0,
          traceId,
        },
      };
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private validateAgentRequest(request: AgentRequest): void {
    if (!request.id) {
      throw new Error("Request ID is required");
    }
    if (!request.type) {
      throw new Error("Agent type is required");
    }
    if (!request.input) {
      throw new Error("Agent input is required");
    }
    if (!request.context) {
      throw new Error("Agent context is required");
    }
  }

  private validateWorkflowRequest(request: WorkflowRequest): void {
    if (!request.id) {
      throw new Error("Workflow request ID is required");
    }
    if (!request.workflowType) {
      throw new Error("Workflow type is required");
    }
    if (!request.initialContext) {
      throw new Error("Initial context is required");
    }
    if (!request.stages || request.stages.length === 0) {
      throw new Error("Workflow stages are required");
    }
  }

  private async prepareExecutionContext(
    request: AgentRequest,
    agentRecord: AgentRecord
  ): Promise<AgentContext> {
    const context = { ...request.context };

    // Add memory system data if enabled
    if (this.config.enableMemorySystem) {
      const memoryData = await this.memorySystem.getRelevantMemories(
        request.input,
        agentRecord.type
      );
      context.memory = memoryData;
    }

    // Add routing information
    context.routing = {
      agentType: agentRecord.type,
      agentVersion: agentRecord.version,
      requestId: request.id,
    };

    return context;
  }

  private async executeAgentWithRetry(
    request: AgentRequest,
    context: AgentContext,
    traceId: string
  ): Promise<AgentResponse> {
    const maxRetries = request.options?.retryAttempts ?? this.config.retryAttempts;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const agentAPI = getAgentAPI();
        const response = await agentAPI.executeAgent(request.type, {
          input: request.input,
          context,
          options: request.options,
        });

        // Update circuit breaker on success
        if (this.config.enableCircuitBreaker && attempt === 0) {
          await this.circuitBreaker.recordSuccess(request.type);
        }

        return {
          id: request.id,
          success: true,
          data: response.data,
          metadata: {
            executionTime: response.metadata?.executionTime || 0,
            agentVersion: response.metadata?.agentVersion || "unknown",
            confidence: response.metadata?.confidence || ConfidenceLevel.MEDIUM,
            tokensUsed: response.metadata?.tokensUsed,
            cost: response.metadata?.cost,
            traceId,
          },
        };
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  private async createAgentRequestFromStage(
    stage: WorkflowStage,
    context: AgentContext,
    options?: WorkflowOptions
  ): Promise<AgentRequest> {
    const route = this.routingLayer.getRouteForStage(stage);

    return {
      id: uuidv4(),
      type: route.agentType,
      input: {
        stage,
        context: context,
        ...route.defaultInput,
      },
      context,
      options: {
        timeout: options?.timeout,
        priority: "medium",
        retryAttempts: 3,
        enableCache: true,
        metadata: {
          stage,
          workflowExecution: true,
        },
      },
    };
  }

  private async updateContextFromResponse(
    currentContext: AgentContext,
    responseData: any,
    stage: WorkflowStage
  ): Promise<AgentContext> {
    return {
      ...currentContext,
      stageOutputs: {
        ...currentContext.stageOutputs,
        [stage]: responseData,
      },
      currentStage: stage,
    };
  }

  private async createWorkflowExecutionRecord(
    request: WorkflowRequest,
    traceId: string
  ): Promise<WorkflowExecutionRecord> {
    const record = {
      id: uuidv4(),
      workflow_id: request.id,
      workflow_type: request.workflowType,
      status: "running" as WorkflowStatus,
      initial_context: request.initialContext,
      stages: request.stages,
      trace_id: traceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("workflow_executions")
      .insert(record)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create workflow execution record", { error });
      throw error;
    }

    return data;
  }

  private async updateWorkflowExecutionRecord(
    recordId: string,
    updates: Partial<WorkflowExecutionRecord>
  ): Promise<void> {
    const { error } = await supabase
      .from("workflow_executions")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId);

    if (error) {
      logger.error("Failed to update workflow execution record", { error });
    }
  }

  private async createFinalWorkflowState(
    request: WorkflowRequest,
    context: AgentContext,
    results: Record<WorkflowStage, AgentResponse>
  ): Promise<WorkflowState> {
    return {
      id: uuidv4(),
      case_id: context.caseId || "",
      tenant_id: context.tenantId || "",
      organization_id: context.organizationId || "",
      current_stage: "completed" as WorkflowStage,
      stages: request.stages.map((stage) => ({
        stage,
        status: results[stage]?.success ? "completed" : "failed",
        data: results[stage]?.data,
        errors: results[stage]?.error ? [results[stage].error] : [],
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      })),
      context: context,
      metadata: {
        workflow_type: request.workflowType,
        execution_results: results,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private async createErrorWorkflowState(
    initialContext: AgentContext,
    errorMessage: string
  ): Promise<WorkflowState> {
    return {
      id: uuidv4(),
      case_id: initialContext.caseId || "",
      tenant_id: initialContext.tenantId || "",
      organization_id: initialContext.organizationId || "",
      current_stage: "failed" as WorkflowStage,
      stages: [],
      context: initialContext,
      metadata: {
        error: errorMessage,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private calculateWorkflowMetadata(
    results: Record<WorkflowStage, AgentResponse>,
    startTime: number,
    traceId: string
  ): WorkflowMetadata {
    const stagesCompleted = Object.values(results).filter((r) => r.success).length;
    const stagesFailed = Object.values(results).filter((r) => !r.success).length;
    const totalTokensUsed = Object.values(results).reduce(
      (sum, r) => sum + (r.metadata.tokensUsed || 0),
      0
    );
    const totalCost = Object.values(results).reduce((sum, r) => sum + (r.metadata.cost || 0), 0);

    return {
      totalExecutionTime: Date.now() - startTime,
      stagesCompleted,
      stagesFailed,
      totalTokensUsed,
      totalCost,
      traceId,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const unifiedAgentOrchestrator = new UnifiedAgentOrchestrator();
