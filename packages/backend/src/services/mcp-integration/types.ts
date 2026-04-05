import { z } from 'zod';

export const McpIntegrationProviderSchema = z.enum(['openai', 'anthropic', 'internal']);
export type McpIntegrationProvider = z.infer<typeof McpIntegrationProviderSchema>;

export const McpConnectionStateSchema = z.enum([
  'connected',
  'degraded',
  'failed',
  'disabled',
  'disconnected',
  'pending_validation',
]);
export type McpConnectionState = z.infer<typeof McpConnectionStateSchema>;

export const McpFailureReasonCodeSchema = z.enum([
  'auth_invalid',
  'auth_expired',
  'network_unreachable',
  'scope_missing',
  'provider_rate_limited',
  'provider_unavailable',
  'sync_failed',
  'validation_failed',
  'disabled_by_admin',
  'manual_disconnect',
  'unknown_error',
]);
export type McpFailureReasonCode = z.infer<typeof McpFailureReasonCodeSchema>;

export const McpCapabilityDescriptorSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  syncMode: z.enum(['pull', 'push', 'hybrid']),
  requiresWriteAccess: z.boolean().default(false),
});
export type McpCapabilityDescriptor = z.infer<typeof McpCapabilityDescriptorSchema>;

export const McpConfigurePayloadSchema = z.object({
  provider: McpIntegrationProviderSchema,
  authType: z.enum(['oauth', 'api_key', 'service_account']).default('api_key'),
  config: z.record(z.string(), z.unknown()).default({}),
});
export type McpConfigurePayload = z.infer<typeof McpConfigurePayloadSchema>;

export interface McpAccessTestResult {
  ok: boolean;
  status: McpConnectionState;
  reasonCode: McpFailureReasonCode | null;
  checkedAt: string;
  latencyMs: number;
  message: string;
}

export interface McpHealthStatus {
  provider: McpIntegrationProvider;
  state: McpConnectionState;
  reasonCode: McpFailureReasonCode | null;
  statusMessage: string;
  checkedAt: string;
  queuedValidationJobId?: string;
  queuedSyncJobId?: string;
}

export interface McpSyncResult {
  ok: boolean;
  syncedRecords: number;
  degraded: boolean;
  reasonCode: McpFailureReasonCode | null;
  message: string;
}

export interface TenantMcpIntegrationRecord {
  id: string;
  tenant_id: string;
  provider: McpIntegrationProvider;
  auth_type: 'oauth' | 'api_key' | 'service_account';
  connection_state: McpConnectionState;
  reason_code: McpFailureReasonCode | null;
  reason_message: string | null;
  capabilities: McpCapabilityDescriptor[];
  metadata: Record<string, unknown>;
  queued_validation_job_id: string | null;
  queued_sync_job_id: string | null;
  validated_at: string | null;
  health_checked_at: string | null;
  disabled_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export const TenantMcpIntegrationRecordSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  provider: McpIntegrationProviderSchema,
  auth_type: z.enum(['oauth', 'api_key', 'service_account']),
  connection_state: McpConnectionStateSchema,
  reason_code: McpFailureReasonCodeSchema.nullable(),
  reason_message: z.string().nullable(),
  capabilities: z.array(McpCapabilityDescriptorSchema),
  metadata: z.record(z.string(), z.unknown()).default({}),
  queued_validation_job_id: z.string().nullable(),
  queued_sync_job_id: z.string().nullable(),
  validated_at: z.string().nullable(),
  health_checked_at: z.string().nullable(),
  disabled_at: z.string().nullable(),
  disconnected_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
