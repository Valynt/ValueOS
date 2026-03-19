import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../AuditLogService.js", () => ({
  auditLogService: {
    createEntry: vi.fn().mockResolvedValue({}),
  },
}));

import { createServerSupabaseClient } from "../../../lib/supabase.js";
import { ComplianceControlCheckService } from "../ComplianceControlCheckService.js";

function buildSupabaseMock(options: { stale?: boolean } = {}) {
  const now = Date.now();
  const freshTs = new Date(now - 30 * 60 * 1000).toISOString();
  const staleTs = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const ts = options.stale ? staleTs : freshTs;

  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const buildTimestampQuery = (field: "timestamp" | "evidence_ts") => {
    const chain = {
      eq: vi.fn(() => chain),
      in: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: { [field]: ts }, error: null }),
    };

    return chain;
  };

  const from = vi.fn((table: string) => {
    if (table === "compliance_control_status") {
      return {
        select: vi.fn().mockReturnValue(buildTimestampQuery("evidence_ts")),
      };
    }

    if (table === "audit_logs") {
      return {
        select: vi.fn().mockReturnValue(buildTimestampQuery("timestamp")),
      };
    }

    if (table === "compliance_control_audit") {
      return {
        insert: insertMock,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "tenants") {
      return { select: vi.fn().mockResolvedValue({ data: [{ id: "tenant-1" }], error: null }) };
    }

    return { insert: insertMock };
  });

  return { from };
}

describe("ComplianceControlCheckService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass when evidence artifacts exist and are fresh", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock() as ReturnType<typeof createServerSupabaseClient>);
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "manual");

    expect(snapshot.overall_status).toBe("pass");
    expect(snapshot.failing_checks).toBe(0);
    expect(snapshot.results.length).toBeGreaterThan(0);
  });

  it("fails checks when evidence artifacts are stale", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ stale: true }) as ReturnType<typeof createServerSupabaseClient>);
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "scheduled");

    expect(snapshot.overall_status).toBe("fail");
    expect(snapshot.failing_checks).toBeGreaterThan(0);
    expect(snapshot.results.some((result) => result.status === "fail")).toBe(true);
  });
});
