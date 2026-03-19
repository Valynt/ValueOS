import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "../../lib/logger.js";

export interface ArchiveExpiredRowsInput {
  sourceTable: string;
  archiveTable: string;
  timestampColumn: string;
  cutoff: string | number;
  idColumn?: string;
  tenantColumn?: string;
}

export interface ArchiveExpiredRowsResult {
  archivedCount: number;
  batchId: string | null;
  verified: boolean;
}

interface RetentionBatchInsert {
  batch_id: string;
  source_table: string;
  archive_table: string;
  retention_cutoff: string;
  archived_row_count: number;
  source_checksum_sha256: string;
  archive_checksum_sha256: string;
  verification_status: "verified" | "verification_failed" | "delete_failed";
  verified_at: string | null;
  source_deleted_at: string | null;
  tenant_id: string | null;
  metadata: Record<string, unknown>;
}

type MutableRow = Record<string, unknown>;

const ARCHIVE_METADATA_KEYS = new Set(["archive_batch_id", "archived_at", "archive_checksum_sha256"]);

export class ImmutableAuditRetentionService {
  constructor(private readonly supabase: SupabaseClient) {}

  async archiveExpiredRows(input: ArchiveExpiredRowsInput): Promise<ArchiveExpiredRowsResult> {
    const batchId = crypto.randomUUID();
    const archivedAt = new Date().toISOString();
    const idColumn = input.idColumn ?? "id";
    const tenantId = await this.resolveTenantId(input.sourceTable, input.tenantColumn, input.cutoff, input.timestampColumn);

    const { data, error } = await this.supabase
      .from(input.sourceTable)
      .select("*")
      .lt(input.timestampColumn, input.cutoff)
      .order(input.timestampColumn, { ascending: true });

    if (error) {
      throw new Error(`Failed to load expired rows from ${input.sourceTable}: ${error.message}`);
    }

    const sourceRows = ((data ?? []) as MutableRow[]).map((row) => ({ ...row }));
    if (sourceRows.length === 0) {
      return { archivedCount: 0, batchId: null, verified: true };
    }

    const sourceChecksum = this.calculateRowsChecksum(sourceRows);
    const archiveRows = sourceRows.map((row) => ({
      ...row,
      archive_batch_id: batchId,
      archived_at: archivedAt,
      archive_checksum_sha256: this.calculateRowChecksum(row),
    }));

    const insertResult = await this.supabase.from(input.archiveTable).insert(archiveRows);
    if (insertResult.error) {
      throw new Error(`Failed to archive rows into ${input.archiveTable}: ${insertResult.error.message}`);
    }

    const { data: archivedRowsData, error: archivedRowsError } = await this.supabase
      .from(input.archiveTable)
      .select("*")
      .eq("archive_batch_id", batchId)
      .order(input.timestampColumn, { ascending: true });

    if (archivedRowsError) {
      throw new Error(`Failed to verify archived rows in ${input.archiveTable}: ${archivedRowsError.message}`);
    }

    const archivedRows = ((archivedRowsData ?? []) as MutableRow[]).map((row) => this.stripArchiveMetadata(row));
    const archiveChecksum = this.calculateRowsChecksum(archivedRows);
    const verified = archivedRows.length === sourceRows.length && archiveChecksum === sourceChecksum;

    if (!verified) {
      await this.recordBatch({
        batch_id: batchId,
        source_table: input.sourceTable,
        archive_table: input.archiveTable,
        retention_cutoff: String(input.cutoff),
        archived_row_count: sourceRows.length,
        source_checksum_sha256: sourceChecksum,
        archive_checksum_sha256: archiveChecksum,
        verification_status: "verification_failed",
        verified_at: null,
        source_deleted_at: null,
        tenant_id: tenantId,
        metadata: {
          source_count: sourceRows.length,
          archived_count: archivedRows.length,
          timestamp_column: input.timestampColumn,
          id_column: idColumn,
        },
      });

      logger.error("Audit archive verification failed", undefined, {
        sourceTable: input.sourceTable,
        archiveTable: input.archiveTable,
        batchId,
        sourceCount: sourceRows.length,
        archivedCount: archivedRows.length,
      });

      return { archivedCount: 0, batchId, verified: false };
    }

    const ids = sourceRows
      .map((row) => row[idColumn])
      .filter((value): value is string | number => typeof value === "string" || typeof value === "number");

    const deleteResult = await this.supabase
      .from(input.sourceTable)
      .delete()
      .in(idColumn, ids);

    if (deleteResult.error) {
      await this.recordBatch({
        batch_id: batchId,
        source_table: input.sourceTable,
        archive_table: input.archiveTable,
        retention_cutoff: String(input.cutoff),
        archived_row_count: sourceRows.length,
        source_checksum_sha256: sourceChecksum,
        archive_checksum_sha256: archiveChecksum,
        verification_status: "delete_failed",
        verified_at: archivedAt,
        source_deleted_at: null,
        tenant_id: tenantId,
        metadata: {
          source_count: sourceRows.length,
          archived_count: archivedRows.length,
          timestamp_column: input.timestampColumn,
          id_column: idColumn,
          delete_error: deleteResult.error.message,
        },
      });
      throw new Error(`Failed to delete archived rows from ${input.sourceTable}: ${deleteResult.error.message}`);
    }

    await this.recordBatch({
      batch_id: batchId,
      source_table: input.sourceTable,
      archive_table: input.archiveTable,
      retention_cutoff: String(input.cutoff),
      archived_row_count: sourceRows.length,
      source_checksum_sha256: sourceChecksum,
      archive_checksum_sha256: archiveChecksum,
      verification_status: "verified",
      verified_at: archivedAt,
      source_deleted_at: new Date().toISOString(),
      tenant_id: tenantId,
      metadata: {
        source_count: sourceRows.length,
        archived_count: archivedRows.length,
        timestamp_column: input.timestampColumn,
        id_column: idColumn,
      },
    });

    return { archivedCount: sourceRows.length, batchId, verified: true };
  }

  private async resolveTenantId(
    sourceTable: string,
    tenantColumn: string | undefined,
    cutoff: string | number,
    timestampColumn: string,
  ): Promise<string | null> {
    if (!tenantColumn) {
      return null;
    }

    const { data, error } = await this.supabase
      .from(sourceTable)
      .select(tenantColumn)
      .lt(timestampColumn, cutoff);

    if (error) {
      logger.warn("Failed to resolve tenant scope for audit retention batch", {
        sourceTable,
        tenantColumn,
        error: error.message,
      });
      return null;
    }

    const tenantIds = new Set(
      ((data ?? []) as MutableRow[])
        .map((row) => row[tenantColumn])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    );

    return tenantIds.size === 1 ? [...tenantIds][0] : null;
  }

  private async recordBatch(payload: RetentionBatchInsert): Promise<void> {
    const { error } = await this.supabase.from("audit_retention_batches").insert(payload);
    if (error) {
      logger.warn("Failed to persist audit retention batch metadata", {
        batchId: payload.batch_id,
        sourceTable: payload.source_table,
        archiveTable: payload.archive_table,
        error: error.message,
      });
    }
  }

  private stripArchiveMetadata(row: MutableRow): MutableRow {
    const strippedEntries = Object.entries(row).filter(([key]) => !ARCHIVE_METADATA_KEYS.has(key));
    return Object.fromEntries(strippedEntries);
  }

  private calculateRowsChecksum(rows: MutableRow[]): string {
    return createHash("sha256")
      .update(JSON.stringify(rows.map((row) => this.sortValue(row))))
      .digest("hex");
  }

  private calculateRowChecksum(row: MutableRow): string {
    return createHash("sha256")
      .update(JSON.stringify(this.sortValue(row)))
      .digest("hex");
  }

  private sortValue(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((entry) => this.sortValue(entry));
    }

    if (value && typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, this.sortValue(nestedValue)]);
      return Object.fromEntries(entries);
    }

    return value;
  }
}
