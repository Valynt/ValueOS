import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/supabase.js", () => ({
  createServerSupabaseClient: vi.fn(),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../security/SecurityEventStreamingService.js", () => ({
  securityEventStreamingService: { stream: vi.fn() },
}));

import { createServerSupabaseClient } from "../../lib/supabase.js";
import { AuditLogService } from "../AuditLogService.js";

type Row = Record<string, unknown>;

class SupabaseTableMock {
  private mode: "select" | "delete" = "select";
  private filters: Array<(row: Row) => boolean> = [];
  private selectedColumns: string | null = null;
  private limitCount: number | null = null;
  private rangeSpec: { start: number; end: number } | null = null;
  private orderSpec: { column: string; ascending: boolean } | null = null;

  constructor(private readonly table: string, private readonly tables: Record<string, Row[]>) {}

  select(columns: string) {
    this.selectedColumns = columns;
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push((row) => row[field] >= value);
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push((row) => row[field] <= value);
    return this;
  }

  lt(field: string, value: unknown) {
    this.filters.push((row) => row[field] < value);
    return this;
  }

  order(column: string, options: { ascending: boolean }) {
    this.orderSpec = { column, ascending: options.ascending };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(start: number, end: number) {
    this.rangeSpec = { start, end };
    return this;
  }

  insert(rows: Row | Row[]) {
    const payload = Array.isArray(rows) ? rows : [rows];
    const inserted = payload.map((row) => ({ ...row }));
    this.tables[this.table] ??= [];
    this.tables[this.table].push(...inserted);

    return {
      select: (columns: string) => Promise.resolve({
        data: inserted.map((row) => pickColumns(row, columns)),
        error: null,
      }),
    };
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  maybeSingle() {
    const rows = this.executeRows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  single() {
    const rows = this.executeRows();
    return Promise.resolve({ data: rows[0] ?? null, error: null });
  }

  then(resolve: (value: { data: Row[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
    return Promise.resolve({ data: this.executeRows(), error: null }).then(resolve, reject);
  }

  private executeRows(): Row[] {
    const tableRows = [...(this.tables[this.table] ?? [])];
    const filtered = tableRows.filter((row) => this.filters.every((predicate) => predicate(row)));

    if (this.mode === "delete") {
      const deletedIds = new Set(filtered.map((row) => row.id));
      this.tables[this.table] = tableRows.filter((row) => !deletedIds.has(row.id));
      return filtered.map((row) => pickColumns(row, this.selectedColumns));
    }

    let rows = filtered;
    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      rows = rows.sort((left, right) => {
        const leftValue = left[column];
        const rightValue = right[column];
        if (leftValue === rightValue) return 0;
        if (leftValue === undefined) return ascending ? -1 : 1;
        if (rightValue === undefined) return ascending ? 1 : -1;
        return (leftValue < rightValue ? -1 : 1) * (ascending ? 1 : -1);
      });
    }

    if (this.rangeSpec) {
      rows = rows.slice(this.rangeSpec.start, this.rangeSpec.end + 1);
    }

    if (this.limitCount !== null) {
      rows = rows.slice(0, this.limitCount);
    }

    return rows.map((row) => pickColumns(row, this.selectedColumns));
  }
}

function pickColumns(row: Row, columns: string | null): Row {
  if (!columns || columns === "*") {
    return { ...row };
  }

  const result: Row = {};
  for (const column of columns.split(",").map((value) => value.trim())) {
    result[column] = row[column];
  }
  return result;
}

function buildSupabaseMock(seed: Record<string, Row[]>) {
  const tables = Object.fromEntries(Object.entries(seed).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]));
  return {
    from: (table: string) => new SupabaseTableMock(table, tables),
    tables,
    auth: { admin: { getUserById: vi.fn() } },
  };
}

describe("AuditLogService retention and compliance export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives expired audit rows into append-only storage before cleanup and exports archived rows", async () => {
    const expiredRow = {
      id: "audit-1",
      tenant_id: "tenant-1",
      user_id: "user-1",
      user_name: "User One",
      user_email: "user@example.com",
      action: "admin.export",
      resource_type: "report",
      resource_id: "report-1",
      details: { request_path: "/exports/1", correlation_id: "corr-1", actor_ip: "10.0.0.1" },
      ip_address: "10.0.0.1",
      user_agent: "vitest",
      status: "success",
      integrity_hash: "hash-1",
      previous_hash: null,
      timestamp: "2023-12-31T00:00:00.000Z",
    };

    const supabase = buildSupabaseMock({
      audit_logs: [expiredRow],
      audit_logs_archive: [],
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(supabase as ReturnType<typeof createServerSupabaseClient>);

    const service = new AuditLogService();
    const archivedCount = await service.archiveOldLogs("2024-01-01T00:00:00.000Z");

    expect(archivedCount).toBe(1);
    expect(supabase.tables.audit_logs).toHaveLength(0);
    expect(supabase.tables.audit_logs_archive).toHaveLength(1);
    expect(supabase.tables.audit_logs_archive[0]).toMatchObject({
      id: "audit-1",
      tenant_id: "tenant-1",
      integrity_hash: "hash-1",
      previous_hash: null,
      source_table: "audit_logs",
    });
    expect(supabase.tables.audit_logs_archive[0].archive_verified_at).toBeTruthy();
    expect(supabase.tables.audit_logs_archive[0].archive_verification).toMatchObject({
      source_table: "audit_logs",
      archive_table: "audit_logs_archive",
      retention_cutoff: "2024-01-01T00:00:00.000Z",
    });

    const exported = await service.export({
      tenantId: "tenant-1",
      format: "json",
      query: {
        startDate: "2023-01-01T00:00:00.000Z",
        endDate: "2024-12-31T23:59:59.999Z",
      },
    });

    expect(JSON.parse(exported)).toEqual([
      expect.objectContaining({
        id: "audit-1",
        tenant_id: "tenant-1",
        integrity_hash: "hash-1",
      }),
    ]);
  });
});
