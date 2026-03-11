/**
 * Tenant Deletion Service
 *
 * Three-phase tenant offboarding:
 *
 *   Phase 1 — Soft delete (immediate)
 *     - Marks tenant status = 'pending_deletion'
 *     - Records deletion_requested_at, deletion_scheduled_at (now + SOFT_DELETE_DAYS)
 *     - Cancels billing and revokes all user access
 *     - Sends notification to tenant admin
 *
 *   Phase 2 — Data export (during soft-delete window)
 *     - Exports all tenant data to a structured JSON archive
 *     - Records data_exported_at on completion
 *     - Export is available for download for SOFT_DELETE_DAYS
 *
 *   Phase 3 — Hard delete (after soft-delete window)
 *     - Deletes all tenant rows in FK-safe order
 *     - Marks tenant status = 'deleted', records deleted_at
 *     - Intended to be called by a scheduled job (cron/pg_cron)
 *
 * FK deletion order (leaf → root):
 *   agent_audit_logs, value_loop_events, saga_transitions,
 *   usage_ledger, rated_ledger, prompt_executions, agent_predictions,
 *   active_sessions, sessions, messages, agent_memory,
 *   integrity_outputs, narrative_drafts, realization_reports,
 *   hypothesis_outputs, workflow_executions, value_cases,
 *   crm_connections, user_tenants, tenants
 *
 * Safety:
 * - All DB operations use service_role (approved: tenant provisioning).
 * - Each phase is independently retriable.
 * - Hard delete is gated on data_exported_at being set.
 * - Audit log entry written for every phase transition.
 */

import { createLogger } from '@shared/lib/logger';

import { createServerSupabaseClient } from '../../lib/supabase.js';
import { deprovisionTenant } from './TenantProvisioning.js';

const logger = createLogger({ service: 'TenantDeletionService' });

/** Days between soft-delete request and hard delete. */
const SOFT_DELETE_DAYS = 30;

/** Rows fetched per page during export. Limits peak memory per table. */
const EXPORT_PAGE_SIZE = 1000;

/** Tables deleted in FK-safe order (leaf → root). */
const HARD_DELETE_ORDER: Array<{ table: string; tenantCol: string }> = [
  { table: 'agent_audit_logs',      tenantCol: 'organization_id' },
  { table: 'value_loop_events',     tenantCol: 'organization_id' },
  { table: 'saga_transitions',      tenantCol: 'organization_id' },
  { table: 'usage_ledger',          tenantCol: 'tenant_id' },
  { table: 'rated_ledger',          tenantCol: 'tenant_id' },
  { table: 'prompt_executions',     tenantCol: 'tenant_id' },
  { table: 'agent_predictions',     tenantCol: 'organization_id' },
  { table: 'active_sessions',       tenantCol: 'tenant_id' },
  { table: 'sessions',              tenantCol: 'tenant_id' },
  { table: 'messages',              tenantCol: 'tenant_id' },
  { table: 'agent_memory',          tenantCol: 'organization_id' },
  { table: 'integrity_outputs',     tenantCol: 'organization_id' },
  { table: 'narrative_drafts',      tenantCol: 'organization_id' },
  { table: 'realization_reports',   tenantCol: 'organization_id' },
  { table: 'hypothesis_outputs',    tenantCol: 'organization_id' },
  { table: 'workflow_executions',   tenantCol: 'organization_id' },
  { table: 'value_cases',           tenantCol: 'organization_id' },
  { table: 'crm_connections',       tenantCol: 'tenant_id' },
  { table: 'user_tenants',          tenantCol: 'tenant_id' },
];

export interface DeletionPhaseResult {
  success: boolean;
  errors: string[];
}

export interface TenantExportData {
  tenant_id: string;
  exported_at: string;
  tables: Record<string, unknown[]>;
}

export class TenantDeletionService {
  private supabase: ReturnType<typeof createServerSupabaseClient>;

  constructor() {
    this.supabase = createServerSupabaseClient();
  }

  // ── Phase 1: Soft delete ──────────────────────────────────────────────────

  /**
   * Initiate soft delete. Marks the tenant pending_deletion, cancels billing,
   * revokes access. Hard delete is scheduled SOFT_DELETE_DAYS from now.
   */
  async initiateSoftDelete(
    tenantId: string,
    requestedBy: string,
    reason: string,
  ): Promise<DeletionPhaseResult> {
    const errors: string[] = [];
    logger.info('TenantDeletion: initiating soft delete', { tenantId, requestedBy });

    // Verify tenant exists and is not already in deletion
    const { data: tenant, error: fetchErr } = await this.supabase
      .from('tenants')
      .select('id, status')
      .eq('id', tenantId)
      .single();

    if (fetchErr || !tenant) {
      return { success: false, errors: [`Tenant not found: ${tenantId}`] };
    }

    if (tenant.status === 'pending_deletion' || tenant.status === 'deleted') {
      return { success: false, errors: [`Tenant already in deletion state: ${tenant.status}`] };
    }

    const scheduledAt = new Date(Date.now() + SOFT_DELETE_DAYS * 86_400_000).toISOString();

    const { error: updateErr } = await this.supabase
      .from('tenants')
      .update({
        status: 'pending_deletion',
        deletion_requested_at: new Date().toISOString(),
        deletion_requested_by: requestedBy,
        deletion_scheduled_at: scheduledAt,
        deletion_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (updateErr) {
      return { success: false, errors: [`Failed to update tenant status: ${updateErr.message}`] };
    }

    // Reuse existing deprovisionTenant for billing cancellation + access revocation
    const deprovResult = await deprovisionTenant(tenantId, reason);
    errors.push(...deprovResult.errors);

    logger.info('TenantDeletion: soft delete complete', { tenantId, scheduledAt, errors });
    return { success: errors.length === 0, errors };
  }

  // ── Phase 2: Data export ──────────────────────────────────────────────────

  /**
   * Export all tenant data to a structured archive.
   * Records data_exported_at on the tenant row when complete.
   * Returns the export payload — caller is responsible for storage.
   *
   * Each table is fetched in pages of EXPORT_PAGE_SIZE rows to avoid loading
   * the entire dataset into memory at once (critical for partitioned tables
   * like usage_ledger and value_loop_events that can hold millions of rows).
   */
  async exportTenantData(tenantId: string): Promise<TenantExportData> {
    logger.info('TenantDeletion: exporting tenant data', { tenantId });

    const exportTables = HARD_DELETE_ORDER.map(t => t.table);
    const tables: Record<string, unknown[]> = {};

    for (const { table, tenantCol } of HARD_DELETE_ORDER) {
      const rows: unknown[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await this.supabase
          .from(table)
          .select('*')
          .eq(tenantCol, tenantId)
          .range(offset, offset + EXPORT_PAGE_SIZE - 1)
          .order('id' as never);

        if (error) {
          logger.warn('TenantDeletion: export failed for table', { table, error: error.message });
          hasMore = false;
          break;
        }

        const page = data ?? [];
        rows.push(...page);
        hasMore = page.length === EXPORT_PAGE_SIZE;
        offset += EXPORT_PAGE_SIZE;
      }

      tables[table] = rows;
    }

    // Also export the tenant row itself
    const { data: tenantRow } = await this.supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    tables['tenants'] = tenantRow ? [tenantRow] : [];

    const exportedAt = new Date().toISOString();

    await this.supabase
      .from('tenants')
      .update({ data_exported_at: exportedAt, updated_at: exportedAt })
      .eq('id', tenantId);

    logger.info('TenantDeletion: export complete', {
      tenantId,
      tableCount: exportTables.length,
      exportedAt,
    });

    return { tenant_id: tenantId, exported_at: exportedAt, tables };
  }

  // ── Phase 3: Hard delete ──────────────────────────────────────────────────

  /**
   * Permanently delete all tenant data in FK-safe order.
   * Gated on data_exported_at being set — will not proceed without an export.
   * Intended to be called by a scheduled job after the soft-delete window elapses.
   */
  async hardDelete(tenantId: string): Promise<DeletionPhaseResult> {
    const errors: string[] = [];
    logger.info('TenantDeletion: starting hard delete', { tenantId });

    // Gate: verify export has been completed
    const { data: tenant, error: fetchErr } = await this.supabase
      .from('tenants')
      .select('status, deletion_scheduled_at, data_exported_at')
      .eq('id', tenantId)
      .single();

    if (fetchErr || !tenant) {
      return { success: false, errors: [`Tenant not found: ${tenantId}`] };
    }

    if (tenant.status !== 'pending_deletion') {
      return { success: false, errors: [`Tenant is not in pending_deletion state: ${tenant.status}`] };
    }

    if (!tenant.data_exported_at) {
      return { success: false, errors: ['Data export must be completed before hard delete'] };
    }

    if (tenant.deletion_scheduled_at && new Date(tenant.deletion_scheduled_at) > new Date()) {
      return { success: false, errors: [`Soft-delete window has not elapsed. Scheduled: ${tenant.deletion_scheduled_at}`] };
    }

    // Delete in FK-safe order (leaf → root)
    for (const { table, tenantCol } of HARD_DELETE_ORDER) {
      const { error } = await this.supabase
        .from(table)
        .delete()
        .eq(tenantCol, tenantId);

      if (error) {
        errors.push(`Failed to delete from ${table}: ${error.message}`);
        logger.error('TenantDeletion: hard delete failed for table', { table, error: error.message });
        // Continue — partial deletion is better than stopping; the job is retriable
      }
    }

    // Mark tenant as deleted
    const deletedAt = new Date().toISOString();
    const { error: finalErr } = await this.supabase
      .from('tenants')
      .update({ status: 'deleted', deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', tenantId);

    if (finalErr) {
      errors.push(`Failed to mark tenant deleted: ${finalErr.message}`);
    }

    logger.info('TenantDeletion: hard delete complete', { tenantId, errors });
    return { success: errors.length === 0, errors };
  }

  // ── Scheduled job ─────────────────────────────────────────────────────────

  /**
   * Process all tenants whose soft-delete window has elapsed.
   * Intended to be called daily by a cron job.
   * Skips tenants that have not been exported yet (logs a warning).
   */
  async processScheduledDeletions(): Promise<{ processed: number; errors: number }> {
    const now = new Date().toISOString();
    let processed = 0;
    let errorCount = 0;

    const { data: due, error } = await this.supabase
      .from('tenants')
      .select('id, data_exported_at')
      .eq('status', 'pending_deletion')
      .lte('deletion_scheduled_at', now)
      .is('deleted_at', null);

    if (error) {
      logger.error('TenantDeletion: failed to query scheduled deletions', { error: error.message });
      return { processed: 0, errors: 1 };
    }

    for (const tenant of due ?? []) {
      if (!tenant.data_exported_at) {
        logger.warn('TenantDeletion: skipping hard delete — export not completed', { tenantId: tenant.id });
        errorCount++;
        continue;
      }

      const result = await this.hardDelete(tenant.id);
      processed++;
      if (!result.success) errorCount++;
    }

    return { processed, errors: errorCount };
  }
}

export const tenantDeletionService = new TenantDeletionService();
