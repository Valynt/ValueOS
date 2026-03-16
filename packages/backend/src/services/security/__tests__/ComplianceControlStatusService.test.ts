import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock supabase before importing the service
vi.mock("../../../lib/supabase.js", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { createServerSupabaseClient } from "../../../lib/supabase.js";
import { ComplianceControlStatusService } from "../ComplianceControlStatusService.js";

const TENANT_ID = "tenant-abc-123";

function buildSupabaseMock(overrides: {
  usersCount?: number;
  mfaCount?: number;
  crmUpdatedAt?: string | null;
  integrityFailures?: number;
  usersError?: boolean;
  mfaError?: boolean;
  crmError?: boolean;
  integrityError?: boolean;
} = {}) {
  const {
    usersCount = 10,
    mfaCount = 8,
    crmUpdatedAt = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
    integrityFailures = 2,
    usersError = false,
    mfaError = false,
    crmError = false,
    integrityError = false,
  } = overrides;

  const insertMock = vi.fn().mockResolvedValue({ error: null });

  const fromMock = vi.fn((table: string) => {
    if (table === "users") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: usersError ? null : usersCount,
            error: usersError ? { message: "users error" } : null,
          }),
        }),
      };
    }
    if (table === "user_settings") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: mfaError ? null : mfaCount,
              error: mfaError ? { message: "mfa error" } : null,
            }),
          }),
        }),
      };
    }
    if (table === "crm_connections") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: crmUpdatedAt ? { updated_at: crmUpdatedAt } : null,
                  error: crmError ? { message: "crm error" } : null,
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
    // compliance_control_evidence / compliance_control_audit / compliance_control_status
    return { insert: insertMock, select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }) }) }) };
  });

  return { from: fromMock, insert: insertMock };
}

describe("ComplianceControlStatusService", () => {
  let service: ComplianceControlStatusService;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("derives mfa_coverage from real user counts", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ usersCount: 10, mfaCount: 8 }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const mfa = (controls as Array<{ control_id: string; metric_value: number; status: string }>).find((c) => c.control_id === "mfa_coverage");

    expect(mfa?.metric_value).toBe(80); // 8/10 * 100
    expect(mfa?.status).toBe("fail"); // 80 < 90 threshold
  });

  it("returns mfa_coverage 0 when users query fails", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ usersError: true }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const mfa = (controls as Array<{ control_id: string; metric_value: number }>).find((c) => c.control_id === "mfa_coverage");

    expect(mfa?.metric_value).toBe(0);
  });

  it("encryption_at_rest is always 100 (infra-enforced)", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock() as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const enc = (controls as Array<{ control_id: string; metric_value: number; status: string }>).find((c) => c.control_id === "encryption_at_rest_coverage");

    expect(enc?.metric_value).toBe(100);
    expect(enc?.status).toBe("pass");
  });

  it("key_rotation_freshness reflects real crm_connections updated_at", async () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ crmUpdatedAt: twelveHoursAgo }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const kr = (controls as Array<{ control_id: string; metric_value: number; status: string }>).find((c) => c.control_id === "key_rotation_freshness");

    expect(kr?.metric_value).toBeGreaterThan(11);
    expect(kr?.metric_value).toBeLessThan(13);
    expect(kr?.status).toBe("pass"); // 12h < 24h warn threshold
  });

  it("key_rotation_freshness passes when no CRM connections exist", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ crmUpdatedAt: null }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const kr = (controls as Array<{ control_id: string; metric_value: number; status: string }>).find((c) => c.control_id === "key_rotation_freshness");

    expect(kr?.metric_value).toBe(0);
    expect(kr?.status).toBe("pass");
  });

  it("audit_integrity_checks reflects real veto count from integrity_outputs", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ integrityFailures: 4 }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();

    const controls = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const ai = (controls as Array<{ control_id: string; metric_value: number; status: string }>).find((c) => c.control_id === "audit_integrity_checks");

    expect(ai?.metric_value).toBe(4);
    expect(ai?.status).toBe("fail"); // 4 >= 3 fail threshold
  });

  it("metric values change when underlying data changes (not hash-stable)", async () => {
    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ mfaCount: 5 }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();
    const controls1 = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const mfa1 = (controls1 as Array<{ control_id: string; metric_value: number }>).find((c) => c.control_id === "mfa_coverage")?.metric_value;

    vi.mocked(createServerSupabaseClient).mockReturnValue(buildSupabaseMock({ mfaCount: 10 }) as ReturnType<typeof createServerSupabaseClient>);
    service = new ComplianceControlStatusService();
    const controls2 = await (service as unknown as { buildComputedControls: (id: string) => Promise<unknown[]> }).buildComputedControls(TENANT_ID);
    const mfa2 = (controls2 as Array<{ control_id: string; metric_value: number }>).find((c) => c.control_id === "mfa_coverage")?.metric_value;

    expect(mfa1).toBe(50);
    expect(mfa2).toBe(100);
    expect(mfa1).not.toBe(mfa2);
  });
});
