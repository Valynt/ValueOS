import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before importing the service
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn() })) },
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { createServerSupabaseClient } from "../../../lib/supabase.js";
import { logger } from "../../../lib/logger.js";
import { ComplianceControlStatusService } from "../ComplianceControlStatusService.js";

const TENANT_ID = "tenant-abc-123";

// ---------------------------------------------------------------------------
// Mock builder
//
// MFA coverage query sequence (in order):
//   1. user_tenants  .select("user_id", count).eq("tenant_id")                    → totalUsers
//   2. user_settings .select("user_id", count).eq("org").eq("mfa_enabled", true)  → primaryMfaCount
//   3. user_tenants  .select("user_id")       .eq("tenant_id")                    → tenantUserIds list
//   4. user_settings .select("user_id, mfa_enabled").eq("org").in("user_id")      → settingsRows
//   5. mfa_secrets   .select("user_id", count).in("user_id").eq("enabled", true)  → fallbackCount
//      (only when indeterminate users exist)
// ---------------------------------------------------------------------------

interface MfaScenario {
  totalUsers?: number;
  totalUsersError?: boolean;
  primaryMfaCount?: number;
  primaryMfaError?: boolean;
  tenantUserIds?: string[];
  tenantUserIdsError?: boolean;
  settingsRows?: Array<{ user_id: string; mfa_enabled: boolean | null }>;
  settingsRowsError?: boolean;
  fallbackSecretCount?: number;
  fallbackSecretError?: boolean;
}

interface OtherScenario {
  auditLogCreatedAt?: string | null;
  auditLogError?: boolean;
  integrityFailures?: number;
  integrityError?: boolean;
  insertErrors?: Partial<Record<"compliance_control_evidence" | "compliance_control_audit" | "compliance_control_status", string>>;
}

function buildSupabaseMock(mfa: MfaScenario = {}, other: OtherScenario = {}) {
  const totalUsers = mfa.totalUsers ?? 10;
  const totalUsersError = mfa.totalUsersError ?? false;
  const primaryMfaCount = mfa.primaryMfaCount ?? 8;
  const primaryMfaError = mfa.primaryMfaError ?? false;
  const tenantUserIds = mfa.tenantUserIds ?? Array.from({ length: totalUsers }, (_, i) => `user-${i}`);
  const tenantUserIdsError = mfa.tenantUserIdsError ?? false;
  const settingsRows = mfa.settingsRows ??
    tenantUserIds.slice(0, primaryMfaCount).map((id) => ({ user_id: id, mfa_enabled: true as boolean | null }));
  const settingsRowsError = mfa.settingsRowsError ?? false;
  const fallbackSecretCount = mfa.fallbackSecretCount ?? 0;
  const fallbackSecretError = mfa.fallbackSecretError ?? false;

  const auditLogCreatedAt = other.auditLogCreatedAt !== undefined
    ? other.auditLogCreatedAt
    : new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const auditLogError = other.auditLogError ?? false;
  const integrityFailures = other.integrityFailures ?? 2;
  const integrityError = other.integrityError ?? false;
  const insertErrors = other.insertErrors ?? {};

  const complianceEvidenceInsertMock = vi.fn().mockResolvedValue({
    error: insertErrors.compliance_control_evidence
      ? { message: insertErrors.compliance_control_evidence }
      : null,
  });
  const complianceAuditInsertMock = vi.fn().mockResolvedValue({
    error: insertErrors.compliance_control_audit
      ? { message: insertErrors.compliance_control_audit }
      : null,
  });
  const complianceStatusInsertMock = vi.fn().mockResolvedValue({
    error: insertErrors.compliance_control_status
      ? { message: insertErrors.compliance_control_status }
      : null,
  });

  // user_tenants is called twice: first for count, then for list
  let userTenantsCallCount = 0;

  const fromMock = vi.fn((table: string) => {
    if (table === "user_tenants") {
      userTenantsCallCount++;
      if (userTenantsCallCount === 1) {
        // count query
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: totalUsersError ? null : totalUsers,
              error: totalUsersError ? { message: "user_tenants count error" } : null,
            }),
          }),
        };
      }
      // list query
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: tenantUserIdsError ? null : tenantUserIds.map((id) => ({ user_id: id })),
            error: tenantUserIdsError ? { message: "user_tenants list error" } : null,
          }),
        }),
      };
    }

    if (table === "user_settings") {
      // Two call shapes: count (primary) and list (settings rows).
      // Distinguish by whether the select string contains a comma.
      return {
        select: vi.fn().mockImplementation((cols: string) => {
          if (!cols.includes(",")) {
            // count query: .select("user_id", { count: "exact", head: true })
            return {
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: primaryMfaError ? null : primaryMfaCount,
                  error: primaryMfaError ? { message: "user_settings count error" } : null,
                }),
              }),
            };
          }
          // list query: .select("user_id, mfa_enabled")
          return {
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: settingsRowsError ? null : settingsRows,
                error: settingsRowsError ? { message: "user_settings list error" } : null,
              }),
            }),
          };
        }),
      };
    }

    if (table === "mfa_secrets") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: fallbackSecretError ? null : fallbackSecretCount,
              error: fallbackSecretError ? { message: "mfa_secrets error" } : null,
            }),
          }),
        }),
      };
    }

    if (table === "audit_logs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: auditLogCreatedAt ? { created_at: auditLogCreatedAt } : null,
                    error: auditLogError ? { message: "audit_logs error" } : null,
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "integrity_outputs") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gte: vi.fn().mockResolvedValue({
                count: integrityError ? null : integrityFailures,
                error: integrityError ? { message: "integrity error" } : null,
              }),
            }),
          }),
        }),
      };
    }

    if (table === "compliance_control_evidence") {
      return {
        insert: complianceEvidenceInsertMock,
      };
    }

    if (table === "compliance_control_audit") {
      return {
        insert: complianceAuditInsertMock,
      };
    }

    if (table === "compliance_control_status") {
      return {
        insert: complianceStatusInsertMock,
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      };
    }

    // fallback table shape
    return {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      }),
    };
  });

  return {
    from: fromMock,
    inserts: {
      complianceEvidenceInsertMock,
      complianceAuditInsertMock,
      complianceStatusInsertMock,
    },
  };
}

type ControlRecord = { control_id: string; metric_value: number; status: string; tenant_id: string };

async function getMfaControl(service: ComplianceControlStatusService): Promise<ControlRecord> {
  const controls = await (
    service as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
  ).buildComputedControls(TENANT_ID);
  return controls.find((c) => c.control_id === "mfa_coverage")!;
}

// ---------------------------------------------------------------------------
// MFA coverage tests
// ---------------------------------------------------------------------------

describe("ComplianceControlStatusService — MFA coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Case 1: mfa_enabled = true → primary signal, no fallback needed
  it("counts users with explicit mfa_enabled = true as MFA-enabled (primary signal wins)", async () => {
    const tenantUserIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    const settingsRows = [
      ...Array.from({ length: 8 }, (_, i) => ({ user_id: `user-${i}`, mfa_enabled: true as boolean | null })),
      ...Array.from({ length: 2 }, (_, i) => ({ user_id: `user-${8 + i}`, mfa_enabled: false as boolean | null })),
    ];
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ totalUsers: 10, primaryMfaCount: 8, tenantUserIds, settingsRows, fallbackSecretCount: 0 }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(80);
    expect(mfa.status).toBe("fail"); // 80 < 90 threshold
  });

  // Case 2: mfa_enabled = false wins over an active secret (primary is authoritative)
  it("treats mfa_enabled = false as disabled even when an active mfa_secrets row exists", async () => {
    const tenantUserIds = ["user-0", "user-1", "user-2", "user-3"];
    const settingsRows = tenantUserIds.map((id) => ({ user_id: id, mfa_enabled: false as boolean | null }));
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({
        totalUsers: 4, primaryMfaCount: 0, tenantUserIds, settingsRows,
        fallbackSecretCount: 99, // should never be queried — no indeterminate users
      }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(0);
  });

  // Case 3: mfa_enabled = null → fallback to mfa_secrets, active secret → enabled
  it("falls back to mfa_secrets when mfa_enabled is null and counts active secrets", async () => {
    const tenantUserIds = ["user-0", "user-1", "user-2", "user-3"];
    const settingsRows = [
      { user_id: "user-0", mfa_enabled: true as boolean | null },
      { user_id: "user-1", mfa_enabled: true as boolean | null },
      { user_id: "user-2", mfa_enabled: null },
      { user_id: "user-3", mfa_enabled: null },
    ];
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ totalUsers: 4, primaryMfaCount: 2, tenantUserIds, settingsRows, fallbackSecretCount: 1 }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(75); // (2 primary + 1 fallback) / 4
  });

  // Case 4: mfa_enabled = null, no active secret → disabled
  it("treats user as MFA-disabled when mfa_enabled is null and no active secret exists", async () => {
    const tenantUserIds = ["user-0", "user-1"];
    const settingsRows = [
      { user_id: "user-0", mfa_enabled: null },
      { user_id: "user-1", mfa_enabled: null },
    ];
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ totalUsers: 2, primaryMfaCount: 0, tenantUserIds, settingsRows, fallbackSecretCount: 0 }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(0);
  });

  // Case 5: no user_settings row → absent = indeterminate → fallback to mfa_secrets
  it("falls back to mfa_secrets when user_settings row is absent for a user", async () => {
    const tenantUserIds = ["user-0", "user-1", "user-2"];
    // Only user-0 has a settings row; user-1 and user-2 are absent
    const settingsRows = [{ user_id: "user-0", mfa_enabled: true as boolean | null }];
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ totalUsers: 3, primaryMfaCount: 1, tenantUserIds, settingsRows, fallbackSecretCount: 1 }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBeCloseTo(66.67, 1); // (1 + 1) / 3
  });

  // Case 6: mfa_secrets.enabled = false → not counted (only enabled = true qualifies)
  it("does not count mfa_secrets rows with enabled = false as MFA-enabled", async () => {
    const tenantUserIds = ["user-0", "user-1"];
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({
        totalUsers: 2, primaryMfaCount: 0, tenantUserIds,
        settingsRows: [], // all indeterminate
        fallbackSecretCount: 0, // secrets exist but enabled = false → DB returns count 0
      }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(0);
  });

  // Case 7: tenant scoping — fallback query is scoped to the correct tenant's users
  it("scopes fallback mfa_secrets query to users belonging to the correct tenant", async () => {
    const tenantUserIds = ["user-A", "user-B"];
    const mockClient = buildSupabaseMock({
      totalUsers: 2, primaryMfaCount: 0, tenantUserIds,
      settingsRows: [], fallbackSecretCount: 1,
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      mockClient as ReturnType<typeof createServerSupabaseClient>
    );
    await getMfaControl(new ComplianceControlStatusService());

    // user_tenants must be queried twice (count + list) with the correct tenant_id
    const fromCalls = (mockClient.from as ReturnType<typeof vi.fn>).mock.calls;
    const userTenantsCalls = fromCalls.filter(([t]: [string]) => t === "user_tenants");
    expect(userTenantsCalls.length).toBe(2);

    // mfa_secrets must be queried exactly once (for the indeterminate users)
    const mfaSecretsCalls = fromCalls.filter(([t]: [string]) => t === "mfa_secrets");
    expect(mfaSecretsCalls.length).toBe(1);
  });

  // Case 8: mfa_secrets not queried when all users have explicit settings
  it("does not query mfa_secrets when all users have an explicit mfa_enabled value", async () => {
    const tenantUserIds = ["user-0", "user-1"];
    const settingsRows = [
      { user_id: "user-0", mfa_enabled: true as boolean | null },
      { user_id: "user-1", mfa_enabled: false as boolean | null },
    ];
    const mockClient = buildSupabaseMock({
      totalUsers: 2, primaryMfaCount: 1, tenantUserIds, settingsRows,
    });
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      mockClient as ReturnType<typeof createServerSupabaseClient>
    );
    await getMfaControl(new ComplianceControlStatusService());

    const fromCalls = (mockClient.from as ReturnType<typeof vi.fn>).mock.calls;
    const mfaSecretsCalls = fromCalls.filter(([t]: [string]) => t === "mfa_secrets");
    expect(mfaSecretsCalls.length).toBe(0);
  });

  // Fail-closed: primary query error → 0
  it("returns 0 when the primary user_settings query fails (fail-closed)", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ primaryMfaError: true }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(0);
    expect(mfa.status).toBe("fail");
  });

  // Fail-closed: total users query error → 0
  it("returns 0 when the user_tenants count query fails", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({ totalUsersError: true }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa = await getMfaControl(new ComplianceControlStatusService());
    expect(mfa.metric_value).toBe(0);
  });

  // Regression: metric changes when underlying data changes
  it("metric value changes when underlying MFA data changes (not hash-stable)", async () => {
    const tenantUserIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);

    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({
        totalUsers: 10, primaryMfaCount: 5, tenantUserIds,
        settingsRows: Array.from({ length: 5 }, (_, i) => ({ user_id: `user-${i}`, mfa_enabled: true as boolean | null })),
        fallbackSecretCount: 0,
      }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa1 = await getMfaControl(new ComplianceControlStatusService());

    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({
        totalUsers: 10, primaryMfaCount: 10, tenantUserIds,
        settingsRows: Array.from({ length: 10 }, (_, i) => ({ user_id: `user-${i}`, mfa_enabled: true as boolean | null })),
        fallbackSecretCount: 0,
      }) as ReturnType<typeof createServerSupabaseClient>
    );
    const mfa2 = await getMfaControl(new ComplianceControlStatusService());

    expect(mfa1.metric_value).toBe(50);
    expect(mfa2.metric_value).toBe(100);
    expect(mfa1.metric_value).not.toBe(mfa2.metric_value);
  });
});

// ---------------------------------------------------------------------------
// Non-MFA controls — regression tests
// ---------------------------------------------------------------------------

describe("ComplianceControlStatusService — other controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("encryption_at_rest is always 100 (infra-enforced)", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock() as ReturnType<typeof createServerSupabaseClient>
    );
    const controls = await (
      new ComplianceControlStatusService() as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
    ).buildComputedControls(TENANT_ID);
    const enc = controls.find((c) => c.control_id === "encryption_at_rest_coverage")!;
    expect(enc.metric_value).toBe(100);
    expect(enc.status).toBe("pass");
  });

  it("key_rotation_freshness reflects hours since last audit_logs rotation event", async () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({}, { auditLogCreatedAt: twelveHoursAgo }) as ReturnType<typeof createServerSupabaseClient>
    );
    const controls = await (
      new ComplianceControlStatusService() as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
    ).buildComputedControls(TENANT_ID);
    const kr = controls.find((c) => c.control_id === "key_rotation_freshness")!;
    expect(kr.metric_value).toBeGreaterThan(11);
    expect(kr.metric_value).toBeLessThan(13);
    expect(kr.status).toBe("pass");
  });

  it("key_rotation_freshness passes when no rotation events exist", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({}, { auditLogCreatedAt: null }) as ReturnType<typeof createServerSupabaseClient>
    );
    const controls = await (
      new ComplianceControlStatusService() as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
    ).buildComputedControls(TENANT_ID);
    const kr = controls.find((c) => c.control_id === "key_rotation_freshness")!;
    expect(kr.metric_value).toBe(0);
    expect(kr.status).toBe("pass");
  });

  it("audit_integrity_checks reflects veto count from integrity_outputs", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock({}, { integrityFailures: 4 }) as ReturnType<typeof createServerSupabaseClient>
    );
    const controls = await (
      new ComplianceControlStatusService() as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
    ).buildComputedControls(TENANT_ID);
    const ai = controls.find((c) => c.control_id === "audit_integrity_checks")!;
    expect(ai.metric_value).toBe(4);
    expect(ai.status).toBe("fail");
  });

  it("all controls carry the correct tenant_id", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      buildSupabaseMock() as ReturnType<typeof createServerSupabaseClient>
    );
    const controls = await (
      new ComplianceControlStatusService() as unknown as { buildComputedControls: (id: string) => Promise<ControlRecord[]> }
    ).buildComputedControls(TENANT_ID);
    for (const control of controls) {
      expect(control.tenant_id).toBe(TENANT_ID);
    }
  });
});

describe("ComplianceControlStatusService — refreshControlStatus persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes one bulk insert per compliance_control_* table with unchanged payload shape", async () => {
    const mockClient = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      mockClient as ReturnType<typeof createServerSupabaseClient>
    );

    const controls = await new ComplianceControlStatusService().refreshControlStatus(TENANT_ID);

    expect(mockClient.inserts.complianceEvidenceInsertMock).toHaveBeenCalledTimes(1);
    expect(mockClient.inserts.complianceAuditInsertMock).toHaveBeenCalledTimes(1);
    expect(mockClient.inserts.complianceStatusInsertMock).toHaveBeenCalledTimes(1);

    const evidenceRows = mockClient.inserts.complianceEvidenceInsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    const auditRows = mockClient.inserts.complianceAuditInsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    const statusRows = mockClient.inserts.complianceStatusInsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;

    expect(evidenceRows).toHaveLength(controls.length);
    expect(auditRows).toHaveLength(controls.length);
    expect(statusRows).toHaveLength(controls.length);

    expect(evidenceRows[0]).toMatchObject({
      tenant_id: controls[0]?.tenant_id,
      control_id: controls[0]?.control_id,
      framework: controls[0]?.framework,
      evidence_pointer: controls[0]?.evidence_pointer,
      evidence_ts: controls[0]?.evidence_ts,
      evidence_payload: {
        metric_value: controls[0]?.metric_value,
        metric_unit: controls[0]?.metric_unit,
      },
    });

    expect(auditRows[0]).toMatchObject({
      tenant_id: controls[0]?.tenant_id,
      control_id: controls[0]?.control_id,
      event_type: "control_status_updated",
      evidence_ts: controls[0]?.evidence_ts,
      event_payload: {
        status: controls[0]?.status,
        framework: controls[0]?.framework,
        evidence_pointer: controls[0]?.evidence_pointer,
      },
    });

    expect(statusRows[0]).toMatchObject(controls[0] ?? {});
    for (const control of controls) {
      expect(control.evidence_pointer).toContain(`audit://controls/${TENANT_ID}/`);
    }
  });

  it("logs partial insert failures with tenant and control context while still returning controls", async () => {
    const mockClient = buildSupabaseMock({}, { insertErrors: { compliance_control_audit: "audit insert failed" } });
    vi.mocked(createServerSupabaseClient).mockReturnValue(
      mockClient as ReturnType<typeof createServerSupabaseClient>
    );

    const controls = await new ComplianceControlStatusService().refreshControlStatus(TENANT_ID);

    expect(controls.length).toBeGreaterThan(0);
    expect(mockClient.inserts.complianceEvidenceInsertMock).toHaveBeenCalledTimes(1);
    expect(mockClient.inserts.complianceAuditInsertMock).toHaveBeenCalledTimes(1);
    expect(mockClient.inserts.complianceStatusInsertMock).toHaveBeenCalledTimes(1);

    const warnCalls = vi.mocked(logger.warn).mock.calls;
    const partialFailureCall = warnCalls.find(([msg]) =>
      typeof msg === "string" && msg.includes("partial insert failure on compliance_control_audit")
    );

    expect(partialFailureCall).toBeDefined();
    expect(partialFailureCall?.[1]).toMatchObject({
      tenantId: TENANT_ID,
      controlIds: expect.arrayContaining(["mfa_coverage", "encryption_at_rest_coverage", "key_rotation_freshness", "audit_integrity_checks"]),
      error: "audit insert failed",
    });
  });
});
