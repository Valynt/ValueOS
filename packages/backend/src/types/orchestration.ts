/**
 * Orchestration types — canonical home for types previously on UnifiedAgentOrchestrator.
 *
 * Extracted in Sprint 10 when the UAO facade was deleted. All consumers that
 * previously imported from UnifiedAgentOrchestrator should import from here.
 */

import * as z from "zod";

import type { AgentType } from "../services/agent-types.js";
import type { AgentResponsePayload } from "../types/workflow/orchestration.js";
import type { WorkflowState, WorkflowStatus } from "../repositories/WorkflowStateRepository.js";
import type { SDUIPageDefinition } from "@valueos/sdui";

// ============================================================================
// Execution envelope
// ============================================================================

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

export const executionIntentSchema = z.object({
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
    requestedAt: z.string(),
    approvedAt: z.string().optional(),
    expiresAt: z.string().optional(),
  }),
});

// ============================================================================
// Agent response types
// ============================================================================

export interface IntegrityVetoMetadata {
  integrityVeto: true;
  deviationPercent: number;
  benchmark: number;
  metricId: string;
  claimedValue: number;
  warning?: string;
}

export interface AgentResponse {
  type: "component" | "message" | "suggestion" | "sdui-page";
  payload: AgentResponsePayload;
  streaming?: boolean;
  sduiPage?: SDUIPageDefinition;
  metadata?: IntegrityVetoMetadata;
}

export type RenderPageOptions = Record<string, unknown>;

export interface StreamingUpdate {
  stage: "thinking" | "executing" | "completed" | "analyzing" | "processing" | "complete";
  message: string;
  progress?: number;
}

// ============================================================================
// Execution result types
// ============================================================================

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

// ============================================================================
// Task planning types
// ============================================================================

export interface SubgoalDefinition {
  id: string;
  type: string;
  description: string;
  assignedAgent: string;
  dependencies: string[];
  priority: number;
  estimatedComplexity: number;
}

export interface TaskPlanResult {
  taskId: string;
  subgoals: SubgoalDefinition[];
  executionOrder: string[];
  complexityScore: number;
  requiresSimulation: boolean;
}

// ============================================================================
// Middleware types
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
    next: () => Promise<AgentResponse>,
  ): Promise<AgentResponse>;
}

// ============================================================================
// Orchestrator config
// ============================================================================

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
