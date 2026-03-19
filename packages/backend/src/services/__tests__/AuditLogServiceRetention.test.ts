import { beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemorySupabaseClient } from "../../test/inMemorySupabase";

describe("AuditLogService retention and immutability", () => {
  let service: import("../security/AuditLogService.js").AuditLogService;
  let client: ReturnType<typeof createInMemorySupabaseClient>;

  beforeEach(async () => {
    vi.resetModules();
    client = createInMemorySupabaseClient({
      audit_logs: [
        {
          id: "old-log",
          tenant_id: "tenant-a",
          user_id: "user-1",
          user_name: "Alice",
          user_email: "alice@example.com",
          action: "export",
          resource_type: "report",
          resource_id: "r-1",
          details: { correlation_id: "corr-old", request_path: "/exports", status_code: 200, outcome: "success" },
          ip_address: "127.0.0.1",
          user_agent: "vitest",
          status: "success",
          integrity_hash: "hash-old",
          previous_hash: null,
          timestamp: "2024-01-01T00:00:00.000Z",
        },
        {
          id: "new-log",
          tenant_id: "tenant-a",
          user_id: "user-2",
          user_name: "Bob",
          user_email: "bob@example.com",
          action: "view",
          resource_type: "dashboard",
          resource_id: "d-1",
          details: { correlation_id: "corr-new", request_path: "/dashboards", status_code: 200, outcome: "success" },
          ip_address: "127.0.0.2",
          user_agent: "vitest",
          status: "success",
          integrity_hash: "hash-new",
          previous_hash: "hash-old",
          timestamp: "2026-01-01T00:00:00.000Z",
        },
      ],
      audit_logs_archive: [],
      audit_retention_batches: [],
    });

    vi.doMock("../../lib/supabase.js", () => ({
      createServerSupabaseClient: () => client,
      supabase: client,
    }));
    vi.doMock("../../lib/logger.js", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../../lib/piiFilter.js", () => ({ sanitizeForLogging: (value: unknown) => value }));
    vi.doMock("../security/SecurityEventStreamingService.js", () => ({
      securityEventStreamingService: { stream: vi.fn().mockResolvedValue(undefined) },
    }));

    const module = await import("../security/AuditLogService.js");
    service = new module.AuditLogService();
  });

  it("archives expired logs with verification metadata before source cleanup", async () => {
    const count = await service.archiveOldLogs("2025-01-01T00:00:00.000Z");

    expect(count).toBe(1);

    const { data: activeLogs } = await client.from("audit_logs").select("*");
    const { data: archivedLogs } = await client.from("audit_logs_archive").select("*");
    const { data: retentionBatches } = await client.from("audit_retention_batches").select("*");

    expect(activeLogs).toEqual([
      expect.objectContaining({ id: "new-log" }),
    ]);
    expect(archivedLogs).toEqual([
      expect.objectContaining({
        id: "old-log",
        tenant_id: "tenant-a",
        integrity_hash: "hash-old",
        user_id: "user-1",
        user_agent: "vitest",
      }),
    ]);
    expect(retentionBatches).toEqual([
      expect.objectContaining({
        source_table: "audit_logs",
        archive_table: "audit_logs_archive",
        archived_row_count: 1,
        verification_status: "verified",
      }),
    ]);
  });


  it("skips source cleanup when archival verification fails", async () => {
    const archiveExpiredRows = vi.fn().mockResolvedValue({
      archivedCount: 0,
      batchId: "batch-failed",
      verified: false,
    });

    (service as unknown as { retentionService: { archiveExpiredRows: typeof archiveExpiredRows } }).retentionService = {
      archiveExpiredRows,
    };

    const count = await service.archiveOldLogs("2025-01-01T00:00:00.000Z");
    expect(count).toBe(0);

    const { data: activeLogs } = await client.from("audit_logs").select("*");
    const { data: archivedLogs } = await client.from("audit_logs_archive").select("*");
    expect(activeLogs).toHaveLength(2);
    expect(archivedLogs).toEqual([]);
  });

  it("includes archived logs in compliance exports so archived evidence remains queryable", async () => {
    await service.archiveOldLogs("2025-01-01T00:00:00.000Z");

    const exported = await service.export({
      format: "json",
      tenantId: "tenant-a",
      query: {
        startDate: "2023-01-01T00:00:00.000Z",
        endDate: "2026-12-31T00:00:00.000Z",
      },
    });

    const parsed = JSON.parse(exported) as Array<{ id: string }>;
    expect(parsed.map((entry) => entry.id)).toEqual(["new-log", "old-log"]);
  });

  it("verifies append-only behavior by not exposing delete/update APIs", () => {
    expect(typeof (service as { deleteEntry?: unknown }).deleteEntry).toBe("undefined");
    expect(typeof (service as { updateEntry?: unknown }).updateEntry).toBe("undefined");
  });
});
