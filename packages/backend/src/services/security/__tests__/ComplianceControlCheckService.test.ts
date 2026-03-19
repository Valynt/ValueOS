import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../../middleware/serviceIdentityMiddleware.js", () => ({
  validateServiceIdentityConfig: vi.fn(),
}));

vi.mock("../AuditLogService.js", () => ({
  auditLogService: {
    createEntry: vi.fn().mockResolvedValue({}),
  },
}));

import { createServerSupabaseClient } from "../../../lib/supabase.js";
import { validateServiceIdentityConfig } from "../../middleware/serviceIdentityMiddleware.js";
import { ComplianceControlCheckService } from "../ComplianceControlCheckService.js";

function createQueryChain(row: Record<string, unknown>) {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };

  return chain;
}

function buildSupabaseMock(options: { stale?: boolean; failRls?: boolean; failAuditIntegrity?: boolean } = {}) {
  const now = Date.now();
  const freshTs = new Date(now - 30 * 60 * 1000).toISOString();
  const staleTs = new Date(now - 48 * 60 * 60 * 1000).toISOString();
  const timestamp = options.stale ? staleTs : freshTs;

  const insertMock = vi.fn().mockResolvedValue({ error: null });
  const auditIntegrityRow = options.failAuditIntegrity
    ? { timestamp, integrity_hash: null, previous_hash: null }
    : { timestamp, integrity_hash: "hash-1", previous_hash: "hash-0" };

  const from = vi.fn((table: string) => {
    if (table === "compliance_control_status") {
      return { select: vi.fn().mockReturnValue(createQueryChain({ evidence_ts: timestamp })) };
    }

    if (table === "audit_logs") {
      return {
        select: vi.fn((query: string) => {
          if (query.includes("integrity_hash")) {
            return createQueryChain(auditIntegrityRow);
          }
          return createQueryChain({ timestamp });
        }),
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

  return {
    from,
    rpc: vi.fn().mockResolvedValue({
      data: [
        { table_name: "audit_logs", rls_enabled: !options.failRls, policy_count: options.failRls ? 0 : 2, has_not_null_constraint: true },
        { table_name: "audit_logs_archive", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "compliance_control_status", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "compliance_control_audit", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "compliance_control_evidence", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "security_audit_log", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "mfa_secrets", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "user_settings", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
        { table_name: "user_tenants", rls_enabled: true, policy_count: 2, has_not_null_constraint: true },
      ],
      error: null,
    }),
  };
}

describe("ComplianceControlCheckService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("returns pass when evidence artifacts are fresh and technical assertions pass", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock() as never);
    vi.mocked(validateServiceIdentityConfig).mockImplementation(() => undefined);
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "manual");

    expect(snapshot.overall_status).toBe("pass");
    expect(snapshot.failing_checks).toBe(0);
    expect(snapshot.results.some((result) => result.check_kind === "technical_validation")).toBe(true);
  });

  it("fails when technical assertions regress even if evidence remains fresh", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ failRls: true }) as never);
    vi.mocked(validateServiceIdentityConfig).mockImplementation(() => undefined);
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "scheduled");

    expect(snapshot.overall_status).toBe("fail");
    expect(snapshot.results.some((result) => result.assertion_id.includes("required_table_rls") && result.status === "fail")).toBe(true);
  });
});
