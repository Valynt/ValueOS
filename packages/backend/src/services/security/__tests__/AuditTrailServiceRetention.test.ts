import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createInMemorySupabaseClient } from "../../../test/inMemorySupabase";

describe("AuditTrailService archival retention", () => {
  let service: import("../AuditTrailService.js").AuditTrailService;
  let client: ReturnType<typeof createInMemorySupabaseClient>;

  beforeEach(async () => {
    vi.resetModules();
    client = createInMemorySupabaseClient({
      security_audit_log: [
        {
          id: "expired-security-event",
          event_type: "security_event",
          actor_id: "actor-1",
          auth0_sub: "ext-1",
          actor_type: "user",
          resource_id: "case-1",
          resource_type: "case",
          action: "security.alert",
          outcome: "success",
          details: { request_path: "/api/v1/cases/1" },
          ip_address: "10.0.0.1",
          user_agent: "vitest",
          timestamp: Date.UTC(2024, 0, 1),
          session_id: "session-1",
          correlation_id: "corr-1",
          risk_score: 0.9,
          compliance_flags: ["soc2"],
          tenant_id: "tenant-security",
        },
      ],
      security_audit_log_archive: [],
      audit_retention_batches: [],
    });

    vi.doMock("../../../lib/supabase.js", () => ({
      getSupabaseClient: () => client,
    }));
    vi.doMock("../../../lib/logger.js", () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock("../SecurityEventStreamingService.js", () => ({
      securityEventStreamingService: { stream: vi.fn().mockResolvedValue(undefined) },
    }));
    vi.doMock("../SiemExportForwarderService.js", () => ({
      siemExportForwarderService: { forward: vi.fn().mockResolvedValue(undefined) },
    }));

    const module = await import("../AuditTrailService.js");
    service = new module.AuditTrailService({ flushIntervalMs: 60_000 });
  });

  afterEach(async () => {
    await service.shutdown();
  });

  it("archives expired security events and keeps them queryable for compliance exports", async () => {
    const archivedCount = await service.cleanupOldEvents(365);
    expect(archivedCount).toBe(1);

    const { data: activeRows } = await client.from("security_audit_log").select("*");
    const { data: archiveRows } = await client.from("security_audit_log_archive").select("*");
    const { data: retentionBatches } = await client.from("audit_retention_batches").select("*");

    expect(activeRows).toEqual([]);
    expect(archiveRows).toEqual([
      expect.objectContaining({
        id: "expired-security-event",
        tenant_id: "tenant-security",
        actor_id: "actor-1",
        correlation_id: "corr-1",
        user_agent: "vitest",
      }),
    ]);
    expect(retentionBatches).toEqual([
      expect.objectContaining({
        source_table: "security_audit_log",
        archive_table: "security_audit_log_archive",
        archived_row_count: 1,
        verification_status: "verified",
      }),
    ]);

    const exported = await service.exportForCompliance(
      "tenant-security",
      new Date("2023-01-01T00:00:00.000Z"),
      new Date("2026-12-31T00:00:00.000Z"),
    );

    expect(exported).toEqual([
      expect.objectContaining({
        id: "expired-security-event",
        actorId: "actor-1",
        correlationId: "corr-1",
        tenantId: "tenant-security",
      }),
    ]);
  });
});
