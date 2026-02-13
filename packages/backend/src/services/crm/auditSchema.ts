/**
 * CRM Audit Event Schema
 *
 * Zod schemas for consistent, validated audit event payloads.
 * All CRM audit events must conform to these schemas.
 */

import { z } from 'zod';

/**
 * Base audit event fields required for all CRM audit entries.
 */
const CrmAuditBaseSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  userEmail: z.string().email().or(z.literal('system@valueos.io')),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  status: z.enum(['success', 'failed']).optional(),
});

/**
 * CRM-specific audit detail schemas per action type.
 */
export const CrmAuditDetailSchemas = {
  crm_oauth_started: z.object({
    provider: z.string(),
    tenantId: z.string(),
  }),

  crm_connected: z.object({
    provider: z.string(),
    tenantId: z.string(),
    status: z.string(),
  }),

  crm_disconnected: z.object({
    provider: z.string(),
    tenantId: z.string(),
  }),

  crm_sync_triggered: z.object({
    provider: z.string(),
    tenantId: z.string(),
    jobId: z.string().or(z.number()).optional(),
  }),

  crm_sync_completed: z.object({
    tenantId: z.string(),
    provider: z.string(),
    processed: z.number(),
    errors: z.number(),
  }),

  crm_sync_failed: z.object({
    tenantId: z.string(),
    provider: z.string(),
    error: z.string(),
  }),

  value_case_scaffolded: z.object({
    tenantId: z.string(),
    provider: z.string(),
    opportunityId: z.string(),
    crmExternalId: z.string(),
    stage: z.string(),
  }),

  saga_started: z.object({
    tenantId: z.string(),
    initialState: z.string(),
    valueCaseId: z.string(),
  }),

  security_access_denied: z.object({
    tenantId: z.string().optional(),
    provider: z.string().optional(),
    reason: z.string(),
    endpoint: z.string(),
  }),
} as const;

export type CrmAuditAction = keyof typeof CrmAuditDetailSchemas;

/**
 * Validate an audit event's details against the schema for its action type.
 * Returns the validated details or throws on invalid data.
 */
export function validateAuditDetails(
  action: string,
  details: Record<string, unknown>,
): Record<string, unknown> {
  const schema = CrmAuditDetailSchemas[action as CrmAuditAction];
  if (!schema) {
    // Unknown action — pass through but log
    return details;
  }
  return schema.parse(details);
}

/**
 * Full CRM audit event schema for validation.
 */
export const CrmAuditEventSchema = CrmAuditBaseSchema.extend({
  details: z.record(z.unknown()),
});

export type CrmAuditEvent = z.infer<typeof CrmAuditEventSchema>;
