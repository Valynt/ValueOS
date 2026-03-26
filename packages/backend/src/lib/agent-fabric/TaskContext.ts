/**
 * Task Context
 *
 * Context object passed through agent task execution pipeline.
 *
 * Unknown input reaches this module from external boundaries (HTTP/events/tooling).
 * All boundary helpers below validate and narrow with zod before the values are
 * allowed into the typed task runtime.
 */

import { z } from 'zod';

const nonEmptyIdSchema = z.string().min(1);

const taskErrorContextSchema = z.record(z.string(), z.unknown());

export interface TaskError {
  code: string;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

export const taskErrorSchema = z.object({
  code: nonEmptyIdSchema,
  message: z.string().min(1),
  timestamp: z.string().datetime(),
  context: taskErrorContextSchema.optional(),
});

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface TaskState {
  status: TaskStatus;
  progress: number;
  current_step?: string;
  completed_steps: string[];
  errors: TaskError[];
}

export const taskStateSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  progress: z.number().min(0).max(100),
  current_step: z.string().min(1).optional(),
  completed_steps: z.array(z.string()),
  errors: z.array(taskErrorSchema),
});

export interface TaskMetadata {
  started_at: string;
  updated_at: string;
  completed_at?: string;
  retry_count: number;
  timeout_seconds: number;
  priority: 'low' | 'normal' | 'high';
}

export const taskMetadataSchema = z.object({
  started_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  retry_count: z.number().int().min(0),
  timeout_seconds: z.number().int().positive(),
  priority: z.enum(['low', 'normal', 'high']),
});

/**
 * Known context payload sub-schemas.
 *
 * These are explicit and validated when a recognized `type` discriminator is present.
 */
export const workflowTaskContextInputSchema = z.object({
  type: z.literal('workflow'),
  workflow_id: nonEmptyIdSchema,
  workflow_definition_id: nonEmptyIdSchema.optional(),
  lifecycle_stage: z.string().min(1).optional(),
  trigger_source: z.enum(['api', 'scheduler', 'event', 'manual']).optional(),
}).passthrough();

export const opportunityTaskContextInputSchema = z.object({
  type: z.literal('opportunity'),
  opportunity_id: nonEmptyIdSchema,
  account_id: nonEmptyIdSchema.optional(),
  hypothesis_id: nonEmptyIdSchema.optional(),
  assumptions: z.array(z.string()).optional(),
}).passthrough();

export const agentInvocationTaskContextInputSchema = z.object({
  type: z.literal('agent_invocation'),
  agent_name: nonEmptyIdSchema,
  prompt: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const knownTaskContextInputSchema = z.discriminatedUnion('type', [
  workflowTaskContextInputSchema,
  opportunityTaskContextInputSchema,
  agentInvocationTaskContextInputSchema,
]);

export const genericTaskContextInputSchema = z.record(z.string(), z.unknown());

export type WorkflowTaskContextInput = z.infer<typeof workflowTaskContextInputSchema>;
export type OpportunityTaskContextInput = z.infer<typeof opportunityTaskContextInputSchema>;
export type AgentInvocationTaskContextInput = z.infer<typeof agentInvocationTaskContextInputSchema>;
export type KnownTaskContextInput = z.infer<typeof knownTaskContextInputSchema>;
export type GenericTaskContextInput = z.infer<typeof genericTaskContextInputSchema>;
export type TaskContextInput = KnownTaskContextInput | GenericTaskContextInput;

const knownPayloadTypeCompileCheck = ['workflow', 'opportunity', 'agent_invocation'] as const satisfies ReadonlyArray<KnownTaskContextInput['type']>;

export function parseTaskContextInput(input: unknown): TaskContextInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('TaskContext input must be a plain object');
  }

  const recordInput = input as Record<string, unknown>;
  const typedPayload = recordInput.type;

  if (typeof typedPayload === 'string') {
    if (knownPayloadTypeCompileCheck.includes(typedPayload as KnownTaskContextInput['type'])) {
      return knownTaskContextInputSchema.parse(recordInput);
    }

    throw new Error(`Unsupported task context input type: ${typedPayload}`);
  }

  return genericTaskContextInputSchema.parse(recordInput);
}

export interface TaskContext {
  task_id: string;
  workspace_id: string;
  organization_id: string;
  user_id: string;
  lifecycle_stage?: string;
  parent_task_id?: string;
  correlation_id: string;
  input: TaskContextInput;
  state: TaskState;
  metadata: TaskMetadata;
}

const taskContextSchema = z.object({
  task_id: nonEmptyIdSchema,
  workspace_id: nonEmptyIdSchema,
  organization_id: nonEmptyIdSchema,
  user_id: nonEmptyIdSchema,
  lifecycle_stage: z.string().min(1).optional(),
  parent_task_id: nonEmptyIdSchema.optional(),
  correlation_id: nonEmptyIdSchema,
  input: z.unknown().transform(parseTaskContextInput),
  state: taskStateSchema,
  metadata: taskMetadataSchema,
});

export function parseTaskContext(raw: unknown): TaskContext {
  return taskContextSchema.parse(raw) as TaskContext;
}


const defaultTaskState = {
  status: 'pending',
  progress: 0,
  completed_steps: [],
  errors: [],
} satisfies TaskState;

const defaultTaskMetadata = (timestamp: string): TaskMetadata => ({
  started_at: timestamp,
  updated_at: timestamp,
  retry_count: 0,
  timeout_seconds: 300,
  priority: 'normal',
});

export function createTaskContext(params: {
  task_id: string;
  workspace_id: string;
  organization_id: string;
  user_id: string;
  input: unknown;
  lifecycle_stage?: string;
  correlation_id?: string;
}): TaskContext {
  const now = new Date().toISOString();

  return parseTaskContext({
    ...params,
    correlation_id: params.correlation_id ?? `corr_${Date.now()}`,
    input: parseTaskContextInput(params.input),
    state: defaultTaskState,
    metadata: defaultTaskMetadata(now),
  });
}

