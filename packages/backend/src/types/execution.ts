import { randomBytes } from "crypto";

import { z } from "zod";
import { JsonObjectSchema, type JsonObject } from "./json";

/**
 * Execution Type Definitions
 * 
 * Types for workflow execution requests, task execution,
 * and execution orchestration.
 */

// ============================================================================
// Execution Request
// ============================================================================

export interface ExecutionRequest {
  id?: string;
  type: ExecutionType;
  workflow_id?: string;
  agent_id?: string;
  context: ExecutionContext;
  input: JsonObject;
  options?: ExecutionOptions;
  metadata?: JsonObject;
  parameters?: Record<string, unknown>;
  intent?: string;
  environment?: string;
}

export type ExecutionType =
  | 'workflow'
  | 'agent'
  | 'task'
  | 'pipeline'
  | 'batch';

export interface ExecutionContext {
  workspace_id: string;
  organization_id: string;
  user_id: string;
  lifecycle_stage?: string;
  parent_execution_id?: string;
  correlation_id?: string;
}

export interface ExecutionOptions {
  timeout_seconds?: number;
  max_retries?: number;
  retry_delay_ms?: number;
  enable_streaming?: boolean;
  callback_url?: string;
  idempotency_key?: string;
  priority?: ExecutionPriority;
  async_mode?: boolean;
}

export type ExecutionPriority = 'low' | 'normal' | 'high' | 'critical';

// ============================================================================
// Execution Response
// ============================================================================

export interface ExecutionResponse {
  execution_id: string;
  status: ExecutionStatus;
  result?: JsonObject;
  error?: ExecutionError;
  metadata: ExecutionMetadata;
}

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface ExecutionError {
  code: string;
  message: string;
  details?: JsonObject;
  recoverable: boolean;
}

export interface ExecutionMetadata {
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  retry_count?: number;
  resource_usage?: ResourceUsage;
}

export interface ResourceUsage {
  cpu_ms?: number;
  memory_mb?: number;
  network_kb?: number;
  tokens_used?: number;
  cost_usd?: number;
}

// ============================================================================
// Task Execution
// ============================================================================

export interface TaskExecution {
  task_id: string;
  execution_id: string;
  workflow_id?: string;
  status: ExecutionStatus;
  input: JsonObject;
  output?: JsonObject;
  error?: ExecutionError;
  started_at: string;
  completed_at?: string;
}

// ============================================================================
// Execution Normalization
// ============================================================================

/**
 * Normalize execution request to ensure all required fields are present
 */
export function normalizeExecutionRequest(
  request: Partial<ExecutionRequest>
): ExecutionRequest {
  return {
    id: request.id || generateExecutionId(),
    type: request.type || 'workflow',
    workflow_id: request.workflow_id,
    agent_id: request.agent_id,
    context: {
      workspace_id: request.context?.workspace_id || '',
      organization_id: request.context?.organization_id || '',
      user_id: request.context?.user_id || '',
      lifecycle_stage: request.context?.lifecycle_stage,
      parent_execution_id: request.context?.parent_execution_id,
      correlation_id: request.context?.correlation_id || generateCorrelationId(),
    },
    input: request.input || {},
    options: {
      timeout_seconds: request.options?.timeout_seconds || 300,
      max_retries: request.options?.max_retries || 3,
      retry_delay_ms: request.options?.retry_delay_ms || 1000,
      enable_streaming: request.options?.enable_streaming || false,
      priority: request.options?.priority || 'normal',
      async_mode: request.options?.async_mode || false,
      ...request.options,
    },
    metadata: request.metadata || {},
  };
}

function generateExecutionId(): string {
  return `exec_${Date.now()}_${randomBytes(6).toString("hex")}`;
}

function generateCorrelationId(): string {
  return `corr_${Date.now()}_${randomBytes(6).toString("hex")}`;
}

// ============================================================================
// Batch Execution
// ============================================================================

export interface BatchExecutionRequest {
  batch_id?: string;
  requests: ExecutionRequest[];
  options?: BatchExecutionOptions;
}

export interface BatchExecutionOptions {
  parallel?: boolean;
  max_concurrency?: number;
  fail_fast?: boolean;
  callback_url?: string;
}

export interface BatchExecutionResponse {
  batch_id: string;
  total_requests: number;
  completed: number;
  failed: number;
  pending: number;
  results: ExecutionResponse[];
}

// ============================================================================
// Pipeline Execution
// ============================================================================

export interface PipelineExecution {
  pipeline_id: string;
  stages: PipelineStage[];
  status: ExecutionStatus;
  current_stage_index: number;
  started_at: string;
  completed_at?: string;
}

export interface PipelineStage {
  stage_id: string;
  name: string;
  execution_request: ExecutionRequest;
  depends_on?: string[];
  status: ExecutionStatus;
  result?: JsonObject;
}

const ExecutionContextSchema = z.object({
  workspace_id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  lifecycle_stage: z.string().optional(),
  parent_execution_id: z.string().optional(),
  correlation_id: z.string().optional(),
});

const ExecutionOptionsSchema = z
  .object({
    timeout_seconds: z.number().optional(),
    max_retries: z.number().optional(),
    retry_delay_ms: z.number().optional(),
    enable_streaming: z.boolean().optional(),
    callback_url: z.string().optional(),
    idempotency_key: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "critical"]).optional(),
    async_mode: z.boolean().optional(),
  })
  .strict();

export const ExecutionRequestSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["workflow", "agent", "task", "pipeline", "batch"]),
    workflow_id: z.string().optional(),
    agent_id: z.string().optional(),
    context: ExecutionContextSchema,
    input: JsonObjectSchema,
    options: ExecutionOptionsSchema.optional(),
    metadata: JsonObjectSchema.optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    intent: z.string().optional(),
    environment: z.string().optional(),
  })
  .strict();

export const ExecutionResponseSchema = z
  .object({
    execution_id: z.string(),
    status: z.enum(["pending", "running", "completed", "failed", "cancelled", "timeout"]),
    result: JsonObjectSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: JsonObjectSchema.optional(),
        recoverable: z.boolean(),
      })
      .optional(),
    metadata: z
      .object({
        started_at: z.string(),
        completed_at: z.string().optional(),
        duration_ms: z.number().optional(),
        retry_count: z.number().optional(),
        resource_usage: z
          .object({
            cpu_ms: z.number().optional(),
            memory_mb: z.number().optional(),
            network_kb: z.number().optional(),
            tokens_used: z.number().optional(),
            cost_usd: z.number().optional(),
          })
          .optional(),
      })
      .strict(),
  })
  .strict();

export type ExecutionRequestDTO = z.infer<typeof ExecutionRequestSchema>;
export type ExecutionResponseDTO = z.infer<typeof ExecutionResponseSchema>;

export function parseExecutionRequestDTO(value: unknown): ExecutionRequestDTO {
  return ExecutionRequestSchema.parse(value);
}

export function parseExecutionResponseDTO(value: unknown): ExecutionResponseDTO {
  return ExecutionResponseSchema.parse(value);
}

// typed-debt-boundary-migration: execution.ts migrated any-bearing execution contracts to JsonObject and introduced ingress/egress DTO parsing (ExecutionRequest/ExecutionResponse); owner=@workflow-runtime, remaining debt=adopt parseExecution*DTO at all transport boundaries.
