/**
 * Tenant-Safe Secret Layer — Type Definitions
 *
 * Design brief: tenant_safe_secret_layer_design_brief.md
 *
 * Core principles enforced by these types:
 *  1. Tenant isolation — every record is scoped to an organization_id
 *  2. Capability-based access — agents request capabilities, not raw secrets
 *  3. Zero secret exposure — decrypted values never appear in public interfaces
 *  4. Policy-enforced access — deny-by-default with explicit allow lists
 *  5. Full auditability — every allow/deny decision is captured
 */

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

export type SecretEnvironment = 'development' | 'staging' | 'production';

// ---------------------------------------------------------------------------
// Tenant Secret Record
// ---------------------------------------------------------------------------

/** Persisted row shape returned from the database (encrypted at rest). */
export interface TenantSecretRecord {
  id: string;
  /** Tenant (organization) ID — REQUIRED for all lookups; no cross-tenant fallback. */
  organization_id: string;
  /** Integration identifier, e.g. "salesforce", "hubspot", "openai". */
  integration: string;
  /** Logical name of the secret within the integration, e.g. "api_key". */
  secret_name: string;
  /** AES-256-GCM envelope-encrypted ciphertext (never decrypted outside SecretBroker). */
  encrypted_value: string;
  /** Key version used to encrypt this record — enables rotation without downtime. */
  key_version: number;
  environment: SecretEnvironment;
  /** Agent IDs allowed to request this secret. Empty array = deny all. */
  allowed_agents: string[];
  /** Tool names allowed to receive this secret. Empty array = deny all. */
  allowed_tools: string[];
  /** Purposes allowed for this secret, e.g. ["salesforce.read"]. */
  allowed_purposes: string[];
  rotation_metadata: SecretRotationMetadata;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

export interface SecretRotationMetadata {
  last_rotated_at?: string;
  next_rotation_at?: string;
  rotation_interval_days?: number;
  rotation_count: number;
}

// ---------------------------------------------------------------------------
// Secret Access Audit Record
// ---------------------------------------------------------------------------

/** Immutable audit row written for every allow/deny decision. */
export interface SecretAccessAuditRecord {
  id: string;
  /** Tenant isolation — REQUIRED. */
  organization_id: string;
  agent_id: string;
  workflow_id?: string;
  run_id?: string;
  /** Capability requested, e.g. "salesforce.read". */
  capability: string;
  /** Purpose declared by the calling agent. */
  purpose: string;
  tool_name: string;
  decision: 'allow' | 'deny';
  reason?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Secret Access Request (inbound to SecretBroker)
// ---------------------------------------------------------------------------

/**
 * Request submitted by a tool executor to the SecretBroker.
 * Agents MUST NOT call this directly — only tool executors may.
 */
export interface SecretAccessRequest {
  /** Tenant ID — REQUIRED; no implicit defaults. */
  tenantId: string;
  agentId: string;
  workflowId?: string;
  runId?: string;
  /** Capability being requested, e.g. "salesforce.read". */
  capability: string;
  /** Purpose declared by the caller. */
  purpose: string;
  /** Name of the tool requesting the credential. */
  toolName: string;
  environment: SecretEnvironment;
}

// ---------------------------------------------------------------------------
// Secret Access Result (outbound from SecretBroker)
// ---------------------------------------------------------------------------

/**
 * Successful credential grant — ephemeral, scoped to a single execution.
 * The decrypted value is NEVER logged, traced, or serialized beyond this object.
 */
export interface SecretAccessGrant {
  /** Opaque ephemeral token identifying this grant for audit purposes. */
  grantId: string;
  tenantId: string;
  capability: string;
  toolName: string;
  /**
   * The decrypted credential value.
   * SECURITY: Must never be logged, stored in memory beyond execution, or
   * included in any observability pipeline.
   */
  decryptedValue: string;
  issuedAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Secret Broker Decision
// ---------------------------------------------------------------------------

export type SecretBrokerDecision =
  | { decision: 'allow'; grant: SecretAccessGrant }
  | { decision: 'deny'; reason: SecretDenyReason; message: string };

export type SecretDenyReason =
  | 'TENANT_MISMATCH'
  | 'SECRET_NOT_FOUND'
  | 'AGENT_NOT_ALLOWED'
  | 'TOOL_NOT_ALLOWED'
  | 'PURPOSE_NOT_ALLOWED'
  | 'ENVIRONMENT_MISMATCH'
  | 'DECRYPTION_FAILED'
  | 'POLICY_VIOLATION';

// ---------------------------------------------------------------------------
// Secret Upsert / Management Input
// ---------------------------------------------------------------------------

export interface UpsertTenantSecretInput {
  tenantId: string;
  integration: string;
  secretName: string;
  /** Plaintext value — will be encrypted before persistence. */
  plaintextValue: string;
  environment: SecretEnvironment;
  allowedAgents: string[];
  allowedTools: string[];
  allowedPurposes: string[];
  rotationMetadata?: Partial<SecretRotationMetadata>;
  actorId: string;
}

export interface RotateTenantSecretInput {
  tenantId: string;
  integration: string;
  secretName: string;
  environment: SecretEnvironment;
  /** New plaintext value. */
  newPlaintextValue: string;
  actorId: string;
}

// ---------------------------------------------------------------------------
// Secret Broker Service Interface
// ---------------------------------------------------------------------------

export interface ISecretBrokerService {
  /**
   * Resolve a capability request to an ephemeral credential.
   * This is the ONLY entry point for runtime secret access.
   */
  resolve(request: SecretAccessRequest): Promise<SecretBrokerDecision>;

  /**
   * Store or update a tenant secret (admin/provisioning path only).
   * Plaintext is encrypted before persistence; plaintext is never stored.
   */
  upsertSecret(input: UpsertTenantSecretInput): Promise<TenantSecretRecord>;

  /**
   * Rotate a secret: encrypt new value, increment key_version, invalidate cache.
   */
  rotateSecret(input: RotateTenantSecretInput): Promise<TenantSecretRecord>;

  /**
   * Retrieve audit log entries for a given tenant.
   */
  getAuditLog(
    tenantId: string,
    filters?: SecretAuditFilters
  ): Promise<SecretAccessAuditRecord[]>;
}

export interface SecretAuditFilters {
  agentId?: string;
  capability?: string;
  decision?: 'allow' | 'deny';
  since?: string;
  limit?: number;
}
