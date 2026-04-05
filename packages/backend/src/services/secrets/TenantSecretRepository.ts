/**
 * Tenant Secret Repository
 *
 * Handles all database I/O for tenant_secrets and secret_access_audits tables.
 * All queries are scoped by organization_id — no cross-tenant fallback is possible.
 *
 * SECURITY INVARIANTS:
 *  - Every SELECT, INSERT, UPDATE includes organization_id in the WHERE clause
 *  - encrypted_value is stored as-is; decryption is the SecretBroker's responsibility
 *  - Audit records are INSERT-only (no UPDATE or DELETE)
 */

import { createLogger } from '../../lib/logger.js';
import { createServerSupabaseClient } from '../../lib/supabase.js';
import type {
  SecretAccessAuditRecord,
  SecretAuditFilters,
  TenantSecretRecord,
} from './TenantSecretTypes.js';

const logger = createLogger({ component: 'TenantSecretRepository' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function secretsTable(supabase: ReturnType<typeof createServerSupabaseClient>) {
  return supabase.from('tenant_secrets');
}

function auditsTable(supabase: ReturnType<typeof createServerSupabaseClient>) {
  return supabase.from('secret_access_audits');
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class TenantSecretRepository {
  private get db() {
    return createServerSupabaseClient();
  }

  // -------------------------------------------------------------------------
  // tenant_secrets
  // -------------------------------------------------------------------------

  /**
   * Look up a single secret by (tenantId, integration, secretName, environment).
   * Returns null when not found — callers must treat absence as DENY.
   *
   * SECURITY: tenantId is ALWAYS included in the query predicate.
   */
  async findSecret(
    tenantId: string,
    integration: string,
    secretName: string,
    environment: string
  ): Promise<TenantSecretRecord | null> {
    const { data, error } = await secretsTable(this.db)
      .select('*')
      .eq('organization_id', tenantId)
      .eq('integration', integration)
      .eq('secret_name', secretName)
      .eq('environment', environment)
      .maybeSingle();

    if (error) {
      logger.error('TenantSecretRepository.findSecret failed', error, {
        tenantId,
        integration,
        environment,
      });
      throw error;
    }

    return data as TenantSecretRecord | null;
  }

  /**
   * Upsert a secret record.
   * The encrypted_value is provided by the caller (SecretBroker encrypts before calling this).
   */
  async upsertSecret(
    record: Omit<TenantSecretRecord, 'id' | 'created_at' | 'updated_at'>
  ): Promise<TenantSecretRecord> {
    const { data, error } = await secretsTable(this.db)
      .upsert(
        {
          ...record,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'organization_id,integration,secret_name,environment',
        }
      )
      .select()
      .single();

    if (error) {
      logger.error('TenantSecretRepository.upsertSecret failed', error, {
        tenantId: record.organization_id,
        integration: record.integration,
      });
      throw error;
    }

    return data as TenantSecretRecord;
  }

  /**
   * Delete a secret. Requires tenantId to prevent cross-tenant deletion.
   */
  async deleteSecret(
    tenantId: string,
    integration: string,
    secretName: string,
    environment: string
  ): Promise<void> {
    const { error } = await secretsTable(this.db)
      .delete()
      .eq('organization_id', tenantId)
      .eq('integration', integration)
      .eq('secret_name', secretName)
      .eq('environment', environment);

    if (error) {
      logger.error('TenantSecretRepository.deleteSecret failed', error, {
        tenantId,
        integration,
      });
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // secret_access_audits
  // -------------------------------------------------------------------------

  /**
   * Append an immutable audit record.
   * This is INSERT-only — no updates or deletes are permitted.
   */
  async appendAudit(
    record: Omit<SecretAccessAuditRecord, 'id' | 'created_at'>
  ): Promise<SecretAccessAuditRecord> {
    const { data, error } = await auditsTable(this.db)
      .insert({
        ...record,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Audit failures must not silently swallow — log at error level but do
      // not rethrow so that a DB hiccup does not block the calling workflow.
      logger.error('TenantSecretRepository.appendAudit failed', error, {
        tenantId: record.organization_id,
        agentId: record.agent_id,
        decision: record.decision,
      });
      throw error;
    }

    return data as SecretAccessAuditRecord;
  }

  /**
   * Query audit records for a tenant with optional filters.
   * SECURITY: organization_id is always applied.
   */
  async queryAudits(
    tenantId: string,
    filters: SecretAuditFilters = {}
  ): Promise<SecretAccessAuditRecord[]> {
    let query = auditsTable(this.db)
      .select('*')
      .eq('organization_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }
    if (filters.capability) {
      query = query.eq('capability', filters.capability);
    }
    if (filters.decision) {
      query = query.eq('decision', filters.decision);
    }
    if (filters.since) {
      query = query.gte('created_at', filters.since);
    }
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('TenantSecretRepository.queryAudits failed', error, {
        tenantId,
      });
      throw error;
    }

    return (data ?? []) as SecretAccessAuditRecord[];
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let _instance: TenantSecretRepository | null = null;

export function getTenantSecretRepository(): TenantSecretRepository {
  if (!_instance) {
    _instance = new TenantSecretRepository();
  }
  return _instance;
}

export function resetTenantSecretRepositoryForTests(): void {
  _instance = null;
}
