import { describe, expect, it, vi } from "vitest";

import { SiemExportForwarderService } from "../SiemExportForwarderService.js";

describe("SiemExportForwarderService", () => {
  it("routes audit log events to configured HTTP sink", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);

    const service = new SiemExportForwarderService({
      enabled: true,
      maxRetries: 2,
      baseBackoffMs: 1,
      maxBackoffMs: 5,
      deadLetterEnabled: true,
      routes: { auditLogs: ["sink-a"], securityAuditLog: [] },
      sinks: [{ name: "sink-a", type: "http", endpoint: "https://example.com/ingest" }],
    });

    await service.forward({
      id: "evt-1",
      source: "audit_logs",
      tenantId: "tenant-1",
      timestamp: new Date().toISOString(),
      payload: { action: "audit.logs.query" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("moves failed deliveries to dead-letter queue after retry exhaustion", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const service = new SiemExportForwarderService({
      enabled: true,
      maxRetries: 2,
      baseBackoffMs: 1,
      maxBackoffMs: 5,
      deadLetterEnabled: true,
      routes: { auditLogs: ["sink-a"], securityAuditLog: [] },
      sinks: [{ name: "sink-a", type: "webhook", endpoint: "https://example.com/webhook" }],
    });

    await service.forward({
      id: "evt-2",
      source: "audit_logs",
      tenantId: "tenant-1",
      timestamp: new Date().toISOString(),
      payload: { action: "audit.logs.query" },
    });

    expect(service.getDeadLetterQueue()).toHaveLength(1);
  });
});
