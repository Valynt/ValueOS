/**
 * Task Context
 *
 * Context object passed through agent task execution pipeline
 */

import { z } from 'zod';

export type TaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

const metadataSchemaBase = z.object({
  started_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().optional(),
  retry_count: z.number(),
  timeout_seconds: z.number(),
  priority: z.enum(['low', 'normal', 'high']),
});

const taskErrorSchemaBase = z.object({
  code: z.string(),
  message: z.string(),
  timestamp: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

const taskStateSchemaBase = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']),
  progress: z.number(),
  current_step: z.string().optional(),
  completed_steps: z.array(z.string()),
  errors: z.array(taskErrorSchemaBase),
});

const workflowInputPayloadSchema = z
  .object({
    workflow_id: z.string().optional(),
    workflow_name: z.string().optional(),
    step_id: z.string().optional(),
  })
  .catchall(z.unknown());

const opportunityInputPayloadSchema = z
  .object({
    opportunity_id: z.string().optional(),
    account_id: z.string().optional(),
    stage: z.string().optional(),
  })
  .catchall(z.unknown());

const agentInvocationInputPayloadSchema = z
  .object({
    agent_name: z.string().optional(),
    invocation_id: z.string().optional(),
    tool_name: z.string().optional(),
  })
  .catchall(z.unknown());

const workflowTaskContextInputSchema = z.object({
  type: z.literal('workflow'),
  payload: workflowInputPayloadSchema,
});

const opportunityTaskContextInputSchema = z.object({
  type: z.literal('opportunity'),
  payload: opportunityInputPayloadSchema,
});

const agentInvocationTaskContextInputSchema = z.object({
  type: z.literal('agent_invocation'),
  payload: agentInvocationInputPayloadSchema,
});

const knownTaskContextInputSchema = z.discriminatedUnion('type', [
  workflowTaskContextInputSchema,
  opportunityTaskContextInputSchema,
  agentInvocationTaskContextInputSchema,
]);

const unknownTaskContextInputSchema = z.record(z.string(), z.unknown());

export const taskContextInputSchema = z.union([
  knownTaskContextInputSchema,
  unknownTaskContextInputSchema,
]);

const taskContextSchemaBase = z.object({
  task_id: z.string(),
  workspace_id: z.string(),
  organization_id: z.string(),
  user_id: z.string(),
  lifecycle_stage: z.string().optional(),
  parent_task_id: z.string().optional(),
  correlation_id: z.string(),
  input: taskContextInputSchema,
  state: taskStateSchemaBase,
  metadata: metadataSchemaBase,
});

export type TaskError = z.infer<typeof taskErrorSchemaBase>;
export type TaskState = z.infer<typeof taskStateSchemaBase>;
export type TaskMetadata = z.infer<typeof metadataSchemaBase>;
export type TaskContextInput = z.infer<typeof taskContextInputSchema>;
export type KnownTaskContextInput = z.infer<typeof knownTaskContextInputSchema>;

export type TaskContext = z.infer<typeof taskContextSchemaBase>;

export const taskErrorSchema = taskErrorSchemaBase;
export const taskStateSchema = taskStateSchemaBase;
export const taskMetadataSchema = metadataSchemaBase;
export const taskContextSchema = taskContextSchemaBase;

export function parseTaskContextInput(input: unknown): TaskContextInput {
  return taskContextInputSchema.parse(input);
}

export function parseTaskContext(raw: unknown): TaskContext {
  return taskContextSchema.parse(raw);
}

const defaultTaskState = {
  status: 'pending',
  progress: 0,
  completed_steps: [],
  errors: [],
} satisfies TaskState;

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
    input: parseTaskContextInput(params.input),
    correlation_id: params.correlation_id ?? `corr_${Date.now()}`,
    state: defaultTaskState,
    metadata: {
      started_at: now,
      updated_at: now,
      retry_count: 0,
      timeout_seconds: 300,
      priority: 'normal',
    } satisfies TaskMetadata,
  });
}

interface SupabaseSessionLike {
  id?: string;
  user?: {
    id?: string;
    raw_user_meta_data?: {
      tenant_id?: string;
      organization_id?: string;
    };
  };
}

/**
 * Maps a Supabase session into a full TaskContext shape.
 * Returns undefined when required task context fields are missing.
 */
export function mapSessionToTaskContext(
  session: SupabaseSessionLike | null | undefined,
  input: unknown = {},
): TaskContext | undefined {
  if (!session?.id || !session.user?.id) {
    return undefined;
  }

  const organizationId = session.user.raw_user_meta_data?.tenant_id ?? session.user.raw_user_meta_data?.organization_id;
  if (!organizationId) {
    return undefined;
  }

  return createTaskContext({
    task_id: `document-parse-${session.id}`,
    workspace_id: session.id,
    organization_id: organizationId,
    user_id: session.user.id,
    input,
  });
}
