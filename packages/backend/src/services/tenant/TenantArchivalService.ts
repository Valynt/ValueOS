import { logger } from '../../lib/logger.js';
import { createServerSupabaseClient } from '../../lib/supabase.js';

import { auditLogService } from './AuditLogService.js';
import { integrationControlService } from './IntegrationControlService.js';
import type { TenantStatus } from './TenantProvisioningTypes.js';

const TENANT_ARCHIVE_BUCKET = 'tenant-archives';
const TENANT_ARCHIVE_FORMAT = 'json';
const TENANT_ARCHIVE_RETENTION_POLICY = 'default-90-days';

const TENANT_ARCHIVE_TABLES: Array<{
  table: string;
  tenantColumns: string[];
}> = [
  { table: 'organizations', tenantColumns: ['id'] },
  { table: 'tenants', tenantColumns: ['id'] },
  { table: 'user_tenants', tenantColumns: ['tenant_id'] },
  { table: 'user_roles', tenantColumns: ['tenant_id'] },
  { table: 'users', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'api_keys', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'audit_logs', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'cases', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'workflows', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'workflow_states', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'shared_artifacts', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agents', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agent_runs', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'agent_memory', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'models', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'kpis', tenantColumns: ['organization_id', 'tenant_id'] },
  { table: 'messages', tenantColumns: ['tenant_id', 'organization_id'] },
  { table: 'security_audit_events', tenantColumns: ['tenant_id', 'organization_id'] },
];

export async function archiveTenantData(organizationId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const exportTimestamp = new Date().toISOString();
  const errors: string[] = [];

  try {
    const { data: tableRows, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public');

    if (tableError) {
      throw new Error(`Failed to list tables for archival: ${tableError.message}`);
    }

    const existingTables = new Set((tableRows || []).map((row) => row.table_name));
    const tablesToArchive = TENANT_ARCHIVE_TABLES.filter((entry) => existingTables.has(entry.table));

    const archivePayload: Record<string, unknown> = {};
    const tableColumnCache: Record<string, Set<string>> = {};
    const tableNames = tablesToArchive.map((t) => t.table);

    const { data: allColumns, error: columnsError } = await supabase
      .from('information_schema.columns')
      .select('table_name, column_name')
      .eq('table_schema', 'public')
      .in('table_name', tableNames);

    if (columnsError) {
      throw new Error(`Failed to inspect columns: ${columnsError.message}`);
    }

    (allColumns || []).forEach((row) => {
      if (!tableColumnCache[row.table_name]) {
        tableColumnCache[row.table_name] = new Set();
      }
      tableColumnCache[row.table_name].add(row.column_name);
    });

    await runWithConcurrency(tablesToArchive, async (entry) => {
      const columns = tableColumnCache[entry.table];
      if (!columns) {
        errors.push(`Missing column metadata for ${entry.table}`);
        return;
      }

      const availableTenantColumns = entry.tenantColumns.filter((column) => columns.has(column));
      if (availableTenantColumns.length === 0) {
        errors.push(`No tenant identifier columns found for ${entry.table}`);
        return;
      }

      let query = supabase.from(entry.table).select('*');
      if (availableTenantColumns.length === 1) {
        query = query.eq(availableTenantColumns[0], organizationId);
      } else {
        const filters = availableTenantColumns.map((column) => `${column}.eq.${organizationId}`).join(',');
        query = query.or(filters);
      }

      const { data, error } = await query;
      if (error) {
        errors.push(`Failed to export ${entry.table}: ${error.message}`);
        return;
      }

      archivePayload[entry.table] = data || [];
    }, 5);

    if (errors.length > 0) {
      throw new Error(`Archival export failed: ${errors.join('; ')}`);
    }

    const storagePath = `${organizationId}/${exportTimestamp}.${TENANT_ARCHIVE_FORMAT}`;
    const serializedPayload = JSON.stringify({
      organizationId,
      exportedAt: exportTimestamp,
      format: TENANT_ARCHIVE_FORMAT,
      tables: archivePayload,
    }, null, 2);

    const { error: storageError } = await supabase.storage
      .from(TENANT_ARCHIVE_BUCKET)
      .upload(storagePath, Buffer.from(serializedPayload), {
        contentType: 'application/json',
        upsert: true,
      });

    if (storageError) {
      throw new Error(`Failed to upload archive: ${storageError.message}`);
    }

    const { error: archiveRecordError } = await supabase.from('tenant_archives').upsert(
      {
        organization_id: organizationId,
        storage_location: `${TENANT_ARCHIVE_BUCKET}/${storagePath}`,
        export_format: TENANT_ARCHIVE_FORMAT,
        exported_at: exportTimestamp,
        retention_policy: TENANT_ARCHIVE_RETENTION_POLICY,
      },
      { onConflict: 'organization_id' }
    );

    if (archiveRecordError) {
      throw new Error(`Failed to record archive metadata: ${archiveRecordError.message}`);
    }

    const statusOverrides: Record<string, string> = {
      tenants: 'deleted',
      users: 'inactive',
      cases: 'closed',
      workflow_states: 'cancelled',
      agent_runs: 'cancelled',
      models: 'archived',
    };

    const tableTimestampOverrides: Record<string, string> = {
      cases: 'closed_at',
    };

    await runWithConcurrency(tablesToArchive, async (entry) => {
      const columns = tableColumnCache[entry.table];
      if (!columns) {
        errors.push(`Missing column metadata for ${entry.table}`);
        return;
      }

      const availableTenantColumns = entry.tenantColumns.filter((column) => columns.has(column));
      if (availableTenantColumns.length === 0) {
        errors.push(`No tenant identifier columns found for ${entry.table}`);
        return;
      }

      const updatePayload: Record<string, unknown> = {};
      let hasArchiveMarker = false;
      if (columns.has('archived_at')) {
        updatePayload.archived_at = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('is_archived')) {
        updatePayload.is_archived = true;
        hasArchiveMarker = true;
      }
      if (columns.has('deleted_at')) {
        updatePayload.deleted_at = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('is_active')) {
        updatePayload.is_active = false;
        hasArchiveMarker = true;
      }
      if (columns.has('status') && statusOverrides[entry.table]) {
        updatePayload.status = statusOverrides[entry.table];
        hasArchiveMarker = true;
      }
      const timestampOverrideColumn = tableTimestampOverrides[entry.table];
      if (timestampOverrideColumn && columns.has(timestampOverrideColumn)) {
        updatePayload[timestampOverrideColumn] = exportTimestamp;
        hasArchiveMarker = true;
      }
      if (columns.has('updated_at')) {
        updatePayload.updated_at = exportTimestamp;
      }

      if (!hasArchiveMarker) {
        if (columns.has('metadata') && columns.has('id')) {
          const rows = archivePayload[entry.table];
          if (Array.isArray(rows)) {
            for (const row of rows) {
              if (!row || !('id' in row)) {
                errors.push(`Failed to archive metadata for ${entry.table}: missing id`);
                break;
              }
              const currentMetadata = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {};
              const mergedMetadata = {
                ...currentMetadata,
                archived: true,
                archived_at: exportTimestamp,
              };
              const metadataUpdate: Record<string, unknown> = { metadata: mergedMetadata };
              if (columns.has('updated_at')) {
                metadataUpdate.updated_at = exportTimestamp;
              }
              const { error: metadataError } = await supabase
                .from(entry.table)
                .update(metadataUpdate)
                .eq('id', row.id as string);
              if (metadataError) {
                errors.push(`Failed to archive metadata for ${entry.table}: ${metadataError.message}`);
                break;
              }
            }
            return;
          }
        }

        errors.push(`No archival fields available for ${entry.table}`);
        return;
      }

      let updateQuery = supabase.from(entry.table).update(updatePayload);
      if (availableTenantColumns.length === 1) {
        updateQuery = updateQuery.eq(availableTenantColumns[0], organizationId);
      } else {
        const filters = availableTenantColumns.map((column) => `${column}.eq.${organizationId}`).join(',');
        updateQuery = updateQuery.or(filters);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) {
        errors.push(`Failed to mark ${entry.table} as archived: ${updateError.message}`);
      }
    }, 5);

    if (errors.length > 0) {
      throw new Error(`Archival update incomplete: ${errors.join('; ')}`);
    }

    logger.debug(`Data archived for ${organizationId}`);
  } catch (error) {
    logger.error('Tenant archival failed', error instanceof Error ? error : undefined, {
      organizationId,
    });
    throw new Error(`Tenant archival failed for ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function revokeAllAccess(organizationId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const SYSTEM_USER_ID = 'system-deprovisioning';

  try {
    await integrationControlService.disableIntegrations(organizationId, 'Tenant deprovisioned');
    const scrubbedCount = await integrationControlService.scrubCredentials(organizationId);

    await auditLogService.createEntry({
      userId: SYSTEM_USER_ID,
      userName: 'System',
      userEmail: 'system@internal',
      action: 'integrations_disabled',
      resourceType: 'organization',
      resourceId: organizationId,
      details: { scrubbedCredentialsCount: scrubbedCount },
      status: 'success',
    });
  } catch (error) {
    logger.error('Failed to disable integrations', error instanceof Error ? error : undefined, { organizationId });
    await auditLogService.createEntry({
      userId: SYSTEM_USER_ID,
      userName: 'System',
      userEmail: 'system@internal',
      action: 'integrations_disabled',
      resourceType: 'organization',
      resourceId: organizationId,
      details: { error: error instanceof Error ? error.message : 'Unknown' },
      status: 'failed',
    });
  }

  try {
    const { data: members } = await supabase
      .from('user_tenants')
      .select('user_id')
      .eq('tenant_id', organizationId);

    const { error: updateError } = await supabase
      .from('user_tenants')
      .update({
        status: 'inactive',
        // @ts-ignore dynamic column support
        disabled_at: new Date().toISOString(),
        // @ts-ignore dynamic column support
        disabled_reason: 'Tenant deprovisioned',
      })
      .eq('tenant_id', organizationId);

    if (updateError) {
      logger.warn('Failed to update membership status with extended fields, trying basic status', updateError);
      await supabase
        .from('user_tenants')
        .update({ status: 'inactive' } as unknown)
        .eq('tenant_id', organizationId);
    }

    await auditLogService.createEntry({
      userId: SYSTEM_USER_ID,
      userName: 'System',
      userEmail: 'system@internal',
      action: 'membership_revoked',
      resourceType: 'organization',
      resourceId: organizationId,
      details: { memberCount: members?.length || 0 },
      status: 'success',
    });

    if (members && members.length > 0) {
      let revokedCount = 0;
      for (const member of members) {
        try {
          const { error } = await supabase.auth.admin.signOut(member.user_id);
          if (!error) revokedCount++;
        } catch {
          // best effort
        }
      }

      await auditLogService.createEntry({
        userId: SYSTEM_USER_ID,
        userName: 'System',
        userEmail: 'system@internal',
        action: 'sessions_revoked',
        resourceType: 'organization',
        resourceId: organizationId,
        details: { revokedCount, totalMembers: members.length },
        status: 'success',
      });
    }
  } catch (error) {
    logger.error('Failed to revoke memberships', error instanceof Error ? error : undefined, { organizationId });
  }

  try {
    const { error: revokedAtError } = await supabase
      .from('api_keys')
      .update({ revoked_at: new Date().toISOString() } as unknown)
      .eq('tenant_id', organizationId);

    if (revokedAtError) {
      const { error: statusError } = await supabase
        .from('api_keys')
        .update({ status: 'revoked' } as unknown)
        .eq('tenant_id', organizationId);

      if (statusError) {
        const { error: isActiveError } = await supabase
          .from('api_keys')
          .update({ is_active: false } as unknown)
          .eq('tenant_id', organizationId);

        if (isActiveError) {
          const { data: keys } = await supabase.from('api_keys').select('*').eq('tenant_id', organizationId);
          if (keys && keys.length > 0) {
            await supabase.from('api_keys').delete().eq('tenant_id', organizationId);
          }
        }
      }
    }

    await auditLogService.createEntry({
      userId: SYSTEM_USER_ID,
      userName: 'System',
      userEmail: 'system@internal',
      action: 'api_keys_revoked',
      resourceType: 'organization',
      resourceId: organizationId,
      status: 'success',
    });
  } catch (error) {
    logger.error('Failed to revoke API keys', error instanceof Error ? error : undefined, { organizationId });
  }

  logger.debug(`Access revoked for ${organizationId}`);
}

export async function updateTenantStatus(
  organizationId: string,
  status: TenantStatus
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from('organizations')
    .update({
      status: status as unknown,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId);

  if (error) {
    throw new Error(`Failed to update tenant status: ${error.message}`);
  }

  logger.debug(`Status updated to ${status} for ${organizationId}`);
}

async function runWithConcurrency<T>(
  items: T[],
  task: (item: T) => Promise<void>,
  concurrency: number
): Promise<void> {
  const results: Promise<void>[] = [];
  const executing = new Set<Promise<void>>();

  for (const item of items) {
    const p = task(item).then(() => {
      executing.delete(p);
    });
    results.push(p);
    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(results);
}
