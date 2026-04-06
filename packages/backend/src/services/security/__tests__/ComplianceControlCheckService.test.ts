import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn() })) },
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../AuditLogService.js", () => ({
  auditLogService: {
    createEntry: vi.fn().mockResolvedValue({}),
  },
}));

import { createServerSupabaseClient } from "../../../lib/supabase.js";
import { ComplianceControlCheckService } from "../ComplianceControlCheckService.js";

interface SupabaseOptions {
  stale?: boolean;
  missingTechnicalControls?: boolean;
}

function buildSupabaseMock(options: SupabaseOptions = {}) {
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

    if (table === "organization_configurations") {
      const query = {
        eq: vi.fn(() => query),
        limit: vi.fn(() => query),
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.missingTechnicalControls ? { auth_policy: { enforceMFA: false } } : { auth_policy: { enforceMFA: true } },
          error: null,
        }),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    if (table === "pg_tables") {
      const query = {
        eq: vi.fn(() => query),
        in: vi.fn().mockResolvedValue({
          data: [
            { tablename: "audit_logs", rowsecurity: !options.missingTechnicalControls },
            { tablename: "audit_logs_archive", rowsecurity: !options.missingTechnicalControls },
            { tablename: "compliance_reports", rowsecurity: true },
            { tablename: "organization_configurations", rowsecurity: true },
          ],
          error: null,
        }),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    if (table === "pg_policies") {
      const query = {
        eq: vi.fn(() => query),
        in: vi.fn().mockResolvedValue({
          data: options.missingTechnicalControls
            ? [{ tablename: "audit_logs", policyname: "deny_audit_logs_update" }]
            : [
                { tablename: "audit_logs", policyname: "deny_audit_logs_update" },
                { tablename: "audit_logs", policyname: "deny_audit_logs_delete" },
                { tablename: "audit_logs_archive", policyname: "deny_audit_logs_archive_update" },
                { tablename: "audit_logs_archive", policyname: "deny_audit_logs_archive_delete" },
              ],
          error: null,
        }),
      };
      return {
        select: vi.fn(() => query),
      };
    }

    if (table === "information_schema.triggers") {
      const query = {
        eq: vi.fn(() => query),
        in: vi.fn().mockResolvedValue({
          data: options.missingTechnicalControls
            ? [{ event_object_table: "audit_logs", trigger_name: "prevent_audit_update" }]
            : [
                { event_object_table: "audit_logs", trigger_name: "prevent_audit_update" },
                { event_object_table: "audit_logs", trigger_name: "prevent_audit_delete" },
                { event_object_table: "audit_logs_archive", trigger_name: "prevent_audit_archive_update" },
                { event_object_table: "audit_logs_archive", trigger_name: "prevent_audit_archive_delete" },
              ],
          error: null,
        }),
      };
      return {
        select: vi.fn(() => query),
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
    process.env.NODE_ENV = "production";
    process.env.MFA_ENABLED = "true";
    process.env.DATABASE_URL = "postgres://db.example/valueos?sslmode=require";
    process.env.REDIS_URL = "rediss://cache.internal:6379";
    process.env.REDIS_TLS_REJECT_UNAUTHORIZED = "true";
    process.env.CACHE_ENCRYPTION_ENABLED = "true";
    process.env.CACHE_ENCRYPTION_KEY = "cache-encryption-key";
    process.env.APP_ENCRYPTION_KEY = "a".repeat(64);
    process.env.SERVICE_IDENTITY_CONFIG_JSON = JSON.stringify({
      jwtIssuers: [{ issuer: "valueos-internal", audience: "internal" }],
    });
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.MFA_ENABLED;
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TLS_REJECT_UNAUTHORIZED;
    delete process.env.CACHE_ENCRYPTION_ENABLED;
    delete process.env.CACHE_ENCRYPTION_KEY;
    delete process.env.APP_ENCRYPTION_KEY;
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;
  });

  it("returns pass when evidence artifacts are fresh and technical controls validate", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock() as ReturnType<typeof createServerSupabaseClient>);
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "manual");

    expect(snapshot.overall_status).toBe("pass");
    expect(snapshot.failing_checks).toBe(0);
    expect(snapshot.declared_capability.every((entry) => entry.gating_label === "prerequisite_gate")).toBe(true);
    expect(snapshot.configured_controls.some((control) => control.status === "configured")).toBe(true);
    expect(snapshot.results.some((result) => result.check_kind === "technical_validation")).toBe(true);
  });

  it("fails when technical controls are misconfigured even if evidence is fresh", async () => {
    delete process.env.SERVICE_IDENTITY_CONFIG_JSON;

    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ missingTechnicalControls: true }) as ReturnType<typeof createServerSupabaseClient>,
    );
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "scheduled");

    expect(snapshot.overall_status).toBe("fail");
    expect(snapshot.failing_checks).toBeGreaterThan(0);
    expect(
      snapshot.results.some(
        (result) => result.check_kind === "technical_validation" && result.status === "fail",
      ),
    ).toBe(true);
  });

  it("fails checks when evidence artifacts are stale", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ stale: true }) as ReturnType<typeof createServerSupabaseClient>,
    );
    const service = new ComplianceControlCheckService();

    const snapshot = await service.runChecksForTenant("tenant-1", "scheduled");

    expect(snapshot.overall_status).toBe("fail");
    expect(snapshot.failing_checks).toBeGreaterThan(0);
    expect(snapshot.results.some((result) => result.check_kind === "evidence_freshness" && result.status === "fail")).toBe(true);
  });
});
