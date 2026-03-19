/**
 * Consent Type Definitions
 *
 * Types for consent management, data processing permissions,
 * and GDPR/privacy compliance.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Consent Types
// ============================================================================

export interface ConsentRecord {
  id: string;
  user_id: string;
  organization_id: string;
  consent_type: ConsentType;
  status: ConsentStatus;
  granted_at?: string;
  revoked_at?: string;
  expires_at?: string;
  scope: ConsentScope;
  metadata?: ConsentMetadata;
  version: string;
}

export type ConsentType =
  | 'data_processing'
  | 'analytics'
  | 'marketing'
  | 'third_party_sharing'
  | 'ai_processing'
  | 'data_retention'
  | 'profiling';

export type ConsentStatus =
  | 'granted'
  | 'revoked'
  | 'expired'
  | 'pending';

export interface ConsentScope {
  purposes: string[];
  data_categories: DataCategory[];
  retention_period_days?: number;
  geographic_scope?: string[];
  third_parties?: string[];
}

export type DataCategory =
  | 'personal_identifiable'
  | 'financial'
  | 'health'
  | 'behavioral'
  | 'professional'
  | 'technical'
  | 'usage';

export interface ConsentMetadata {
  ip_address?: string;
  user_agent?: string;
  consent_method: 'explicit' | 'implicit' | 'legitimate_interest';
  legal_basis?: string;
  documentation_url?: string;
  language?: string;
}

// ============================================================================
// Consent Request
// ============================================================================

export interface ConsentRequest {
  user_id: string;
  organization_id: string;
  consent_type: ConsentType;
  scope: ConsentScope;
  requested_at: string;
  request_context?: Record<string, unknown>;
}

export interface ConsentResponse {
  consent_id: string;
  status: ConsentStatus;
  granted_at?: string;
  message?: string;
}

// ============================================================================
// Consent Validation
// ============================================================================

export interface ConsentValidation {
  user_id: string;
  organization_id: string;
  consent_type: ConsentType;
  purpose: string;
  is_valid: boolean;
  reasons?: string[];
  checked_at: string;
}

// ============================================================================
// Consent History
// ============================================================================

export interface ConsentHistoryEntry {
  id: string;
  consent_id: string;
  action: ConsentAction;
  actor_id: string;
  actor_type: 'user' | 'admin' | 'system';
  timestamp: string;
  details?: Record<string, unknown>;
}

export type ConsentAction =
  | 'granted'
  | 'revoked'
  | 'renewed'
  | 'modified'
  | 'expired'
  | 'requested';

// ============================================================================
// Consent Registry Configuration
// ============================================================================

export interface ConsentPolicyConfig {
  policy_id: string;
  consent_type: ConsentType;
  required: boolean;
  default_status: ConsentStatus;
  requires_explicit_consent: boolean;
  retention_period_days: number;
  auto_renewal: boolean;
  description: string;
  legal_basis: string;
}

// ============================================================================
// Data Subject Rights
// ============================================================================

export interface DataSubjectRequest {
  id: string;
  user_id: string;
  organization_id: string;
  request_type: DataSubjectRequestType;
  status: DataSubjectRequestStatus;
  requested_at: string;
  completed_at?: string;
  details?: string;
}

export type DataSubjectRequestType =
  | 'access'
  | 'rectification'
  | 'erasure'
  | 'restriction'
  | 'portability'
  | 'objection'
  | 'automated_decision_opt_out';

export type DataSubjectRequestStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled';

// ============================================================================
// Consent Audit
// ============================================================================

export interface ConsentAuditLog {
  id: string;
  timestamp: string;
  event_type: ConsentAuditEventType;
  user_id: string;
  organization_id: string;
  consent_id?: string;
  actor_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
}

export type ConsentAuditEventType =
  | 'consent_granted'
  | 'consent_revoked'
  | 'consent_checked'
  | 'consent_expired'
  | 'data_access'
  | 'data_processed'
  | 'data_shared'
  | 'policy_updated';

// ============================================================================
// Consent Registry (Simplified)
// ============================================================================

export interface ConsentCheckRequest {
  tenantId: string;
  scope: string;
  subject: string;
  supabase: Pick<SupabaseClient, "from">;
}

export interface ConsentRegistry {
  hasConsent: (request: ConsentCheckRequest) => Promise<boolean>;
}
