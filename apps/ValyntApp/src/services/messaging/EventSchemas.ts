import { z } from 'zod';

export type EventName =
  | 'notifications.email.requested'
  | 'notifications.webhook.dispatch'
  | 'data.export.requested'
  | 'billing.usage.reported'
  | 'agent.stream.update'
  | 'agent.action.checkpoint';

export const eventSchemaRegistry: Record<EventName, z.ZodTypeAny> = {
  'notifications.email.requested': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    recipient: z.string().email(),
    template: z.string().min(1),
    variables: z.record(z.any()),
  }),
  'notifications.webhook.dispatch': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    targetUrl: z.string().url(),
    body: z.record(z.any()),
    signature: z.string().min(1),
    retryCount: z.number().int().nonnegative().optional(),
  }),
  'data.export.requested': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    exportType: z.string().min(1),
    requestedBy: z.string().min(1),
    filters: z.record(z.any()).default({}),
    notifyOnCompletion: z
      .object({
        channels: z.array(z.enum(['email', 'webhook'])).default(['email']),
        target: z.string().optional(),
      })
      .optional(),
  }),
  'billing.usage.reported': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime(),
    usage: z.record(z.number()),
  }),
  'agent.stream.update': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    sessionId: z.string().min(1),
    userId: z.string().min(1),
    stage: z.enum(['thinking', 'executing', 'completed']),
    message: z.string(),
    progress: z.number().optional(),
  }),
  'agent.action.checkpoint': z.object({
    schemaVersion: z.string(),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    tenantId: z.string().min(1),
    sessionId: z.string().min(1),
    userId: z.string().min(1),
    actionType: z.string(),
    actionData: z.record(z.any()),
    requiresApproval: z.boolean(),
    reason: z.string(),
    checkpointIdempotencyKey: z.string().min(1).optional(),
  }),
};

export type EventPayloadMap = {
  'notifications.email.requested': z.infer<typeof eventSchemaRegistry['notifications.email.requested']>;
  'notifications.webhook.dispatch': z.infer<typeof eventSchemaRegistry['notifications.webhook.dispatch']>;
  'data.export.requested': z.infer<typeof eventSchemaRegistry['data.export.requested']>;
  'billing.usage.reported': z.infer<typeof eventSchemaRegistry['billing.usage.reported']>;
  'agent.stream.update': z.infer<typeof eventSchemaRegistry['agent.stream.update']>;
  'agent.action.checkpoint': z.infer<typeof eventSchemaRegistry['agent.action.checkpoint']>;
};

export function validateEventPayload<TName extends EventName>(
  name: TName,
  payload: unknown
): EventPayloadMap[TName] {
  const schema = eventSchemaRegistry[name];
  const result = schema.safeParse(payload);

  if (!result.success) {
    throw new Error(`Invalid payload for event ${name}: ${result.error.message}`);
  }

  return result.data as EventPayloadMap[TName];
}
