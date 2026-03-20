import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

interface ArchiveTableConfig {
  sourceTable: string;
  archiveTable: string;
  timestampColumn: string;
  cutoff: string | number;
  batchSize?: number;
}

interface ArchivedVerificationMetadata {
  verified_at: string;
  source_table: string;
  archive_table: string;
  retention_cutoff: string | number;
  source_hash_sha256: string;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
}

async function sha256Hex(value: unknown): Promise<string> {
  const serialized = stableSerialize(value);
  const encoded = new TextEncoder().encode(serialized);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class AuditRetentionService {
  constructor(private readonly supabase: SupabaseClient) {}

  async archiveAuditLogs(olderThan: string, batchSize: number = 10_000): Promise<number> {
    return this.archiveRows({
      sourceTable: "audit_logs",
      archiveTable: "audit_logs_archive",
      timestampColumn: "timestamp",
      cutoff: olderThan,
      batchSize,
    });
  }

  async archiveSecurityAuditEvents(olderThan: number, batchSize: number = 10_000): Promise<number> {
    return this.archiveRows({
      sourceTable: "security_audit_log",
      archiveTable: "security_audit_log_archive",
      timestampColumn: "timestamp",
      cutoff: olderThan,
      batchSize,
    });
  }

  private async archiveRows(config: ArchiveTableConfig): Promise<number> {
    const { sourceTable, archiveTable, timestampColumn, cutoff, batchSize = 10_000 } = config;
    const archivedAt = new Date().toISOString();
    const archiveBatchId = crypto.randomUUID();

    const sourceQuery = this.supabase
      .from(sourceTable)
      .select("*")
      .lt(timestampColumn, cutoff)
      .order(timestampColumn, { ascending: true })
      .limit(batchSize);

    const { data: sourceRows, error: sourceError } = await sourceQuery;
    if (sourceError) {
      throw sourceError;
    }

    const rows = (sourceRows ?? []) as Record<string, unknown>[];
    if (rows.length === 0) {
      logger.info("No audit rows eligible for archival", { sourceTable, archiveTable, cutoff });
      return 0;
    }

    const archiveRows = await Promise.all(
      rows.map(async (row) => {
        const verification: ArchivedVerificationMetadata = {
          verified_at: archivedAt,
          source_table: sourceTable,
          archive_table: archiveTable,
          retention_cutoff: cutoff,
          source_hash_sha256: await sha256Hex(row),
        };

        return {
          ...row,
          source_table: sourceTable,
          archive_batch_id: archiveBatchId,
          archived_at: archivedAt,
          archive_verified_at: archivedAt,
          archive_verification: verification,
        };
      }),
    );

    const sourceIds = rows
      .map((row) => row.id)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    if (sourceIds.length !== rows.length) {
      throw new Error(`${sourceTable} archival requires every row to include a stable string id`);
    }

    const { data: insertedRows, error: insertError } = await this.supabase
      .from(archiveTable)
      .insert(archiveRows)
      .select("id, archive_verified_at");

    if (insertError) {
      throw insertError;
    }

    const inserted = (insertedRows ?? []) as Array<{ id?: string; archive_verified_at?: string | null }>;
    const insertedIds = new Set(inserted.map((row) => row.id).filter((value): value is string => typeof value === "string"));

    const verificationPassed =
      inserted.length === rows.length
      && sourceIds.every((id) => insertedIds.has(id))
      && inserted.every((row) => typeof row.archive_verified_at === "string" && row.archive_verified_at.length > 0);

    if (!verificationPassed) {
      throw new Error(`Archival verification failed for ${sourceTable}`);
    }

    const { data: deletedRows, error: deleteError } = await this.supabase
      .from(sourceTable)
      .delete()
      .in("id", sourceIds)
      .select("id");

    if (deleteError) {
      throw deleteError;
    }

    const deletedIds = new Set(((deletedRows ?? []) as Array<{ id?: string }>).map((row) => row.id).filter((value): value is string => typeof value === "string"));
    if (deletedIds.size !== sourceIds.length || sourceIds.some((id) => !deletedIds.has(id))) {
      throw new Error(`Source cleanup verification failed for ${sourceTable}`);
    }

    logger.info("Archived immutable audit rows", {
      sourceTable,
      archiveTable,
      cutoff,
      archiveBatchId,
      count: rows.length,
    });

    return rows.length;
  }
}
