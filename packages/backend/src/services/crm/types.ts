/**
 * CRM Integration Types
 *
 * Shared types for the CRM provider abstraction layer.
 */

import { z } from 'zod';

// ============================================================================
// Provider enum
// ============================================================================

export const CrmProviderSchema = z.enum(['salesforce', 'hubspot']);
export type CrmProvider = z.infer<typeof CrmProviderSchema>;

// ============================================================================
// Connection status
// ============================================================================

export const ConnectionStatusSchema = z.enum(['connected', 'disconnected', 'error', 'expired']);
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

// ============================================================================
// OAuth types
// ============================================================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  instanceUrl?: string;
  scopes: string[];
  externalOrgId?: string;
  externalUserId?: string;
}

export interface OAuthStartResult {
  authUrl: string;
  state: string;
}

export interface OAuthCallbackParams {
  code: string;
  state: string;
}

// ============================================================================
// Canonical opportunity (internal representation)
// ============================================================================

export const CanonicalOpportunitySchema = z.object({
  externalId: z.string(),
  name: z.string(),
  amount: z.number().nullable().optional(),
  currency: z.string().default('USD'),
  stage: z.string(),
  probability: z.number().nullable().optional(),
  closeDate: z.string().nullable().optional(),
  ownerName: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  properties: z.record(z.unknown()).default({}),
});

export type CanonicalOpportunity = z.infer<typeof CanonicalOpportunitySchema>;

// ============================================================================
// Canonical account
// ============================================================================

export interface CanonicalAccount {
  externalId: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  revenue?: number;
  properties: Record<string, unknown>;
}

// ============================================================================
// Delta sync types
// ============================================================================

export interface DeltaSyncResult {
  opportunities: CanonicalOpportunity[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ============================================================================
// Webhook types
// ============================================================================

export interface WebhookVerificationResult {
  valid: boolean;
  tenantId?: string;
}

// ============================================================================
// CRM Connection row (DB shape)
// ============================================================================

export interface CrmConnectionRow {
  id: string;
  tenant_id: string;
  provider: CrmProvider;
  status: ConnectionStatus;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expires_at: string | null;
  instance_url: string | null;
  external_org_id: string | null;
  external_user_id: string | null;
  scopes: string[];
  sync_cursor: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_error: Record<string, unknown> | null;
  connected_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Webhook event row (DB shape)
// ============================================================================

export interface WebhookEventRow {
  id: string;
  tenant_id: string;
  provider: CrmProvider;
  idempotency_key: string;
  event_type: string;
  payload: Record<string, unknown>;
  received_at: string;
  processed_at: string | null;
  process_status: 'pending' | 'processed' | 'failed';
  last_error: Record<string, unknown> | null;
}

// ============================================================================
// Provenance record
// ============================================================================

export interface ProvenanceInput {
  tenantId: string;
  sourceType: 'crm' | 'agent' | 'user' | 'benchmark' | 'system';
  sourceProvider?: string;
  externalObjectType?: string;
  externalObjectId?: string;
  internalTable: string;
  internalId: string;
  fieldName?: string;
  confidenceDataQuality?: number;
  confidenceAssumptionStability?: number;
  confidenceHistoricalAlignment?: number;
  metadata?: Record<string, unknown>;
}
