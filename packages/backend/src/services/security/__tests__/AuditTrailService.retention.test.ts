import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  getSupabaseClient: vi.fn(),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../SecurityEventStreamingService.js", () => ({
  securityEventStreamingService: { stream: vi.fn() },
}));

vi.mock("../SiemExportForwarderService.js", () => ({
  siemExportForwarderService: { forward: vi.fn() },
}));

import { getSupabaseClient } from "../../../lib/supabase.js";
import { AuditTrailService } from "../AuditTrailService.js";

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

  contains(field: string, values: unknown[]) {
    this.filters.push((row) => Array.isArray(row[field]) && values.every((value) => (row[field] as unknown[]).includes(value)));
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
      single: () => Promise.resolve({ data: inserted[0] ?? null, error: null }),
    };
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  then(resolve: (value: { data: Row[]; error: null; count?: number }) => unknown, reject?: (reason: unknown) => unknown) {
    const rows = this.executeRows();
    return Promise.resolve({ data: rows, error: null, count: rows.length }).then(resolve, reject);
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
      rows = rows.sort((left, right) => ((Number(left[column]) - Number(right[column])) * (ascending ? 1 : -1)));
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
  };
}

describe("AuditTrailService retention and compliance export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("archives expired security audit events and keeps them queryable for compliance exports", async () => {
    const expiredEvent = {
      id: "security-1",
      event_type: "security_event",
      actor_id: "user-1",
      actor_type: "user",
      resource_id: "case-1",
      resource_type: "case",
      action: "security.blocked",
      outcome: "success",
      details: { actor_email: "user@example.com", request_path: "/api/cases/1" },
      ip_address: "10.0.0.2",
      user_agent: "vitest",
      timestamp: 100,
      session_id: "session-1",
      correlation_id: "corr-1",
      risk_score: 0.9,
      compliance_flags: ["soc2"],
      tenant_id: "tenant-1",
    };

    const supabase = buildSupabaseMock({
      security_audit_log: [expiredEvent],
      security_audit_log_archive: [],
    });
    vi.mocked(getSupabaseClient).mockReturnValue(supabase as ReturnType<typeof getSupabaseClient>);

    const service = new AuditTrailService({ flushIntervalMs: 60_000 });
    const archivedCount = await service.cleanupOldEvents(1);

    expect(archivedCount).toBe(1);
    expect(supabase.tables.security_audit_log).toHaveLength(0);
    expect(supabase.tables.security_audit_log_archive).toHaveLength(1);
    expect(supabase.tables.security_audit_log_archive[0]).toMatchObject({
      id: "security-1",
      tenant_id: "tenant-1",
      source_table: "security_audit_log",
    });
    expect(supabase.tables.security_audit_log_archive[0].archive_verification).toMatchObject({
      archive_table: "security_audit_log_archive",
      source_table: "security_audit_log",
    });

    const exported = await service.exportForCompliance(
      "tenant-1",
      new Date(0),
      new Date(1_000),
    );

    expect(exported).toEqual([
      expect.objectContaining({
        id: "security-1",
        actorId: "user-1",
        tenantId: "tenant-1",
        correlationId: "corr-1",
      }),
    ]);

    await service.shutdown();
  });
});
