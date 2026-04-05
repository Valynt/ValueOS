/**
 * Secret Broker Service
 *
 * Central enforcement layer for the Tenant-Safe Secret Layer.
 *
 * Responsibilities:
 *  1. Resolve capability requests to ephemeral credentials at runtime
 *  2. Enforce policy constraints (tenant, agent, tool, purpose, environment)
 *  3. Decrypt secrets — ONLY here, never in callers
 *  4. Append immutable audit records for every allow/deny decision
 *  5. Support secret upsert, rotation, and cache invalidation
 *
 * SECURITY INVARIANTS:
 *  - Deny-by-default: any missing allow-list entry results in DENY
 *  - Decrypted values NEVER appear in logs, traces, or error messages
 *  - tenantId is REQUIRED for every operation; no implicit defaults
 *  - Agents MUST NOT call this service directly; only tool executors may
 *
 * Design ref: tenant_safe_secret_layer_design_brief.md §§ Secret Broker Service,
 *             Access Flow, Security Controls
 */

import { randomUUID } from 'node:crypto';
import { createLogger } from '../../lib/logger.js';
import { decrypt, encrypt } from '../../utils/encryption.js';
import { getTenantSecretRepository } from './TenantSecretRepository.js';
import type {
  ISecretBrokerService,
  RotateTenantSecretInput,
  SecretAccessAuditRecord,
  SecretAccessGrant,
  SecretAccessRequest,
  SecretAuditFilters,
  SecretBrokerDecision,
  SecretDenyReason,
  SecretEnvironment,
  TenantSecretRecord,
  UpsertTenantSecretInput,
} from './TenantSecretTypes.js';

const logger = createLogger({ component: 'SecretBrokerService' });

// Grant TTL: ephemeral credentials expire after 5 minutes
const GRANT_TTL_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class SecretAccessDeniedError extends Error {
  constructor(
    public readonly reason: SecretDenyReason,
    message: string,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'SecretAccessDeniedError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SecretBrokerService implements ISecretBrokerService {
  private readonly repo = getTenantSecretRepository();

  // -------------------------------------------------------------------------
  // resolve — primary runtime entry point
  // -------------------------------------------------------------------------

  /**
   * Resolve a capability request to an ephemeral credential.
   *
   * Access flow (per design brief §Access Flow):
   *  1. Validate tenantId is present
   *  2. Look up the secret record scoped to tenant + capability + environment
   *  3. Enforce agent, tool, purpose allow-lists (deny-by-default)
   *  4. Decrypt the secret (only here)
   *  5. Build ephemeral grant
   *  6. Append audit record
   *  7. Return grant or structured deny
   */
  async resolve(request: SecretAccessRequest): Promise<SecretBrokerDecision> {
    const { tenantId, agentId, workflowId, runId, capability, purpose, toolName, environment } =
      request;

    // Step 1 — tenant guard
    if (!tenantId) {
      await this.audit(request, 'deny', 'TENANT_MISMATCH', 'tenantId is required');
      return this.deny('TENANT_MISMATCH', 'tenantId is required');
    }

    // Derive integration + secretName from capability (e.g. "salesforce.read" → integration="salesforce")
    const { integration, secretName } = parseCapability(capability);

    // Step 2 — look up secret record
    let record: TenantSecretRecord | null;
    try {
      record = await this.repo.findSecret(tenantId, integration, secretName, environment);
    } catch (err) {
      logger.error('SecretBrokerService.resolve: repo lookup failed', err, {
        tenantId,
        capability,
      });
      await this.audit(request, 'deny', 'SECRET_NOT_FOUND', 'Repository lookup error');
      return this.deny('SECRET_NOT_FOUND', 'Secret lookup failed');
    }

    if (!record) {
      await this.audit(request, 'deny', 'SECRET_NOT_FOUND', 'No matching secret record');
      return this.deny('SECRET_NOT_FOUND', `No secret found for capability '${capability}'`);
    }

    // Step 3 — policy enforcement (deny-by-default)
    const policyDeny = this.enforcePolicy(record, request);
    if (policyDeny) {
      await this.audit(request, 'deny', policyDeny.reason, policyDeny.message);
      return this.deny(policyDeny.reason, policyDeny.message);
    }

    // Step 4 — decrypt (only here, never exposed to callers beyond this point)
    let decryptedValue: string;
    try {
      decryptedValue = decrypt(record.encrypted_value);
    } catch (err) {
      logger.error('SecretBrokerService.resolve: decryption failed', err, {
        tenantId,
        capability,
        keyVersion: record.key_version,
      });
      await this.audit(request, 'deny', 'DECRYPTION_FAILED', 'Decryption error');
      return this.deny('DECRYPTION_FAILED', 'Failed to decrypt secret');
    }

    // Step 5 — build ephemeral grant
    const now = new Date();
    const grant: SecretAccessGrant = {
      grantId: randomUUID(),
      tenantId,
      capability,
      toolName,
      decryptedValue,
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + GRANT_TTL_MS).toISOString(),
    };

    // Step 6 — audit allow
    await this.audit(request, 'allow', undefined, 'Policy satisfied');

    logger.info('SecretBrokerService.resolve: access granted', {
      tenantId,
      agentId,
      capability,
      toolName,
      grantId: grant.grantId,
      workflowId,
      runId,
    });

    // Step 7 — return grant (decryptedValue is inside grant, NOT logged)
    return { decision: 'allow', grant };
  }

  // -------------------------------------------------------------------------
  // upsertSecret — admin / provisioning path
  // -------------------------------------------------------------------------

  async upsertSecret(input: UpsertTenantSecretInput): Promise<TenantSecretRecord> {
    const {
      tenantId,
      integration,
      secretName,
      plaintextValue,
      environment,
      allowedAgents,
      allowedTools,
      allowedPurposes,
      rotationMetadata,
      actorId,
    } = input;

    if (!tenantId) {
      throw new SecretAccessDeniedError('TENANT_MISMATCH', 'tenantId is required');
    }

    // Encrypt before persistence — plaintext never touches the DB
    const encryptedValue = encrypt(plaintextValue);

    const existing = await this.repo.findSecret(tenantId, integration, secretName, environment);
    const keyVersion = existing ? existing.key_version : 1;

    const record = await this.repo.upsertSecret({
      organization_id: tenantId,
      integration,
      secret_name: secretName,
      encrypted_value: encryptedValue,
      key_version: keyVersion,
      environment: environment as SecretEnvironment,
      allowed_agents: allowedAgents,
      allowed_tools: allowedTools,
      allowed_purposes: allowedPurposes,
      rotation_metadata: {
        rotation_count: existing?.rotation_metadata?.rotation_count ?? 0,
        ...rotationMetadata,
      },
      created_by: actorId,
      updated_by: actorId,
    });

    logger.info('SecretBrokerService.upsertSecret: secret stored', {
      tenantId,
      integration,
      secretName,
      environment,
      actorId,
    });

    return record;
  }

  // -------------------------------------------------------------------------
  // rotateSecret
  // -------------------------------------------------------------------------

  async rotateSecret(input: RotateTenantSecretInput): Promise<TenantSecretRecord> {
    const { tenantId, integration, secretName, environment, newPlaintextValue, actorId } = input;

    if (!tenantId) {
      throw new SecretAccessDeniedError('TENANT_MISMATCH', 'tenantId is required');
    }

    const existing = await this.repo.findSecret(tenantId, integration, secretName, environment);
    if (!existing) {
      throw new SecretAccessDeniedError(
        'SECRET_NOT_FOUND',
        `No secret found for ${integration}/${secretName} in ${environment}`
      );
    }

    const newEncryptedValue = encrypt(newPlaintextValue);
    const newKeyVersion = existing.key_version + 1;
    const now = new Date().toISOString();

    const updated = await this.repo.upsertSecret({
      ...existing,
      encrypted_value: newEncryptedValue,
      key_version: newKeyVersion,
      rotation_metadata: {
        ...existing.rotation_metadata,
        last_rotated_at: now,
        rotation_count: (existing.rotation_metadata?.rotation_count ?? 0) + 1,
      },
      updated_by: actorId,
    });

    logger.info('SecretBrokerService.rotateSecret: secret rotated', {
      tenantId,
      integration,
      secretName,
      environment,
      newKeyVersion,
      actorId,
    });

    return updated;
  }

  // -------------------------------------------------------------------------
  // getAuditLog
  // -------------------------------------------------------------------------

  async getAuditLog(
    tenantId: string,
    filters?: SecretAuditFilters
  ): Promise<SecretAccessAuditRecord[]> {
    if (!tenantId) {
      throw new SecretAccessDeniedError('TENANT_MISMATCH', 'tenantId is required');
    }
    return this.repo.queryAudits(tenantId, filters);
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Enforce allow-lists against the request.
   * Returns null when all checks pass; returns deny reason + message otherwise.
   *
   * SECURITY: deny-by-default — empty allow-list means deny all.
   */
  private enforcePolicy(
    record: TenantSecretRecord,
    request: SecretAccessRequest
  ): { reason: SecretDenyReason; message: string } | null {
    const { agentId, toolName, purpose, environment } = request;

    // Environment check
    if (record.environment !== environment) {
      return {
        reason: 'ENVIRONMENT_MISMATCH',
        message: `Secret is scoped to '${record.environment}', requested '${environment}'`,
      };
    }

    // Agent allow-list
    if (record.allowed_agents.length > 0 && !record.allowed_agents.includes(agentId)) {
      return {
        reason: 'AGENT_NOT_ALLOWED',
        message: `Agent '${agentId}' is not in the allowed_agents list`,
      };
    }

    // Tool allow-list
    if (record.allowed_tools.length > 0 && !record.allowed_tools.includes(toolName)) {
      return {
        reason: 'TOOL_NOT_ALLOWED',
        message: `Tool '${toolName}' is not in the allowed_tools list`,
      };
    }

    // Purpose allow-list
    if (record.allowed_purposes.length > 0 && !record.allowed_purposes.includes(purpose)) {
      return {
        reason: 'PURPOSE_NOT_ALLOWED',
        message: `Purpose '${purpose}' is not in the allowed_purposes list`,
      };
    }

    return null;
  }

  /** Build a structured deny result. */
  private deny(reason: SecretDenyReason, message: string): SecretBrokerDecision {
    return { decision: 'deny', reason, message };
  }

  /**
   * Append an immutable audit record.
   * Failures are logged but do not propagate — audit must not block execution.
   */
  private async audit(
    request: SecretAccessRequest,
    decision: 'allow' | 'deny',
    reason?: SecretDenyReason,
    message?: string
  ): Promise<void> {
    try {
      const auditRecord: Omit<SecretAccessAuditRecord, 'id' | 'created_at'> = {
        organization_id: request.tenantId,
        agent_id: request.agentId,
        workflow_id: request.workflowId,
        run_id: request.runId,
        capability: request.capability,
        purpose: request.purpose,
        tool_name: request.toolName,
        decision,
        reason: reason ? `${reason}: ${message ?? ''}` : message,
      };
      await this.repo.appendAudit(auditRecord);
    } catch (err) {
      // Audit write failure must not block the caller — log and continue
      logger.error('SecretBrokerService.audit: failed to write audit record', err, {
        tenantId: request.tenantId,
        agentId: request.agentId,
        decision,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Capability parsing
// ---------------------------------------------------------------------------

/**
 * Parse a capability string into integration + secretName.
 *
 * Convention:  "<integration>.<operation>"  →  integration = "<integration>", secretName = "<operation>"
 * Examples:
 *   "salesforce.read"  → { integration: "salesforce", secretName: "read" }
 *   "openai.api_key"   → { integration: "openai",     secretName: "api_key" }
 *   "hubspot"          → { integration: "hubspot",    secretName: "default" }
 */
export function parseCapability(capability: string): {
  integration: string;
  secretName: string;
} {
  const dotIndex = capability.indexOf('.');
  if (dotIndex === -1) {
    return { integration: capability, secretName: 'default' };
  }
  return {
    integration: capability.slice(0, dotIndex),
    secretName: capability.slice(dotIndex + 1),
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: SecretBrokerService | null = null;

export function getSecretBrokerService(): SecretBrokerService {
  if (!_instance) {
    _instance = new SecretBrokerService();
  }
  return _instance;
}

export function resetSecretBrokerServiceForTests(): void {
  _instance = null;
}
