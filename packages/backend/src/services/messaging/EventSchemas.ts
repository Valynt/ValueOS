import { z } from 'zod';

import { ViolationSchema } from '@shared/domain/Violation.js';

export type EventName =
  | 'notifications.email.requested'
  | 'notifications.webhook.dispatch'
  | 'data.export.requested'
  | 'billing.usage.reported'
  | 'agent_message'
  | 'integrity.contradiction.detected';

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
  'agent_message': z.object({
    message: z.object({
      id: z.string(),
      fromAgentId: z.string(),
      toAgentId: z.string(),
      tenantContext: z.object({
        tenantId: z.string().min(1),
        organizationId: z.string().min(1),
      }),
      payload: z.any(),
      priority: z.enum(['low', 'normal', 'high', 'urgent']),
      encrypted: z.boolean(),
      correlationId: z.string().optional(),
      replyTo: z.string().optional(),
      timestamp: z.date(),
    }),
    idempotencyKey: z.string(),
  }),

  /**
   * Emitted by ValueIntegrityService when one or more contradictions are
   * detected in a business case after an agent run.
   *
   * Sprint 53 — Value Integrity Layer
   */
  'integrity.contradiction.detected': z.object({
    schemaVersion: z.literal('1.0'),
    idempotencyKey: z.string().min(1),
    emittedAt: z.string().datetime(),
    /** Tenant that owns the case. Required for consumer-side isolation. */
    organizationId: z.string().uuid(),
    caseId: z.string().uuid(),
    /** Propagated from the triggering agent run context. */
    trace_id: z.string().min(1),
    violations: z.array(ViolationSchema),
  }),
};

export type EventPayloadMap = {
  'notifications.email.requested': z.infer<typeof eventSchemaRegistry['notifications.email.requested']>;
  'notifications.webhook.dispatch': z.infer<typeof eventSchemaRegistry['notifications.webhook.dispatch']>;
  'data.export.requested': z.infer<typeof eventSchemaRegistry['data.export.requested']>;
  'billing.usage.reported': z.infer<typeof eventSchemaRegistry['billing.usage.reported']>;
  'agent_message': z.infer<typeof eventSchemaRegistry['agent_message']>;
  'integrity.contradiction.detected': z.infer<typeof eventSchemaRegistry['integrity.contradiction.detected']>;
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
