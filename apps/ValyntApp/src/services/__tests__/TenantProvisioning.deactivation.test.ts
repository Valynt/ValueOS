import { describe, it, expect, vi, beforeEach } from "vitest";
import { emailService } from "../EmailService";

// Mock dependencies
vi.mock("../EmailService", () => ({
  emailService: {
    send: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock("../lib/logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock config
vi.mock("../../config/environment", () => ({
  getConfig: vi.fn().mockReturnValue({
    email: { enabled: true },
    features: { billing: true, usageTracking: true },
  }),
}));

// Mock supabase
const { mockSupabase } = vi.hoisted(() => {
  const createBuilder = (table: string): any => {
    const builder = {
      select: vi.fn().mockImplementation(() => builder),
      eq: vi.fn().mockImplementation(() => builder),
      in: vi.fn().mockImplementation(() => builder),
      update: vi.fn().mockImplementation(() => builder),
      upsert: vi.fn().mockImplementation(() => builder),
      delete: vi.fn().mockImplementation(() => builder),
      limit: vi.fn().mockImplementation(() => builder),
      order: vi.fn().mockImplementation(() => builder),
      single: vi.fn().mockImplementation(async () => {
        if (table === "organizations") return { data: { name: "Test Org" }, error: null };
        if (table === "users") return { data: { email: "owner@example.com" }, error: null };
        return { data: null, error: null };
      }),
      then: (resolve: any) => {
        if (table === "user_tenants") {
          resolve({ data: [{ user_id: "user-123" }], error: null });
        } else {
          resolve({ data: [], error: null });
        }
      },
    };
    return builder;
  };

  return {
    mockSupabase: {
      from: vi.fn().mockImplementation((table) => createBuilder(table)),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
      auth: {
        admin: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-123" } }, error: null }),
      },
    },
  };
});

vi.mock("@lib/supabase", () => ({
  supabase: mockSupabase,
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  createServerSupabaseClient: vi.fn().mockReturnValue(mockSupabase),
}));

vi.mock("../AuditLogService", () => ({
  auditLogService: {
    logAudit: vi.fn().mockResolvedValue({ id: "audit-123" }),
    createEntry: vi.fn().mockResolvedValue({ id: "audit-123" }),
  },
}));

import { deprovisionTenant } from "../TenantProvisioning";
import { getConfig } from "../../config/environment";

describe("TenantProvisioning - sendDeactivationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getConfig).mockReturnValue({
      email: { enabled: true },
      features: { billing: true, usageTracking: true },
    });
  });

  it("should send deactivation email when deprovisioning", async () => {
    const orgId = "org-123";
    const email = "owner@example.com";
    const orgName = "Test Org";

    await deprovisionTenant(orgId);

    expect(emailService.send).toHaveBeenCalledWith({
      to: email,
      subject: `Account Deactivation - ${orgName}`,
      template: "deactivation",
      data: expect.objectContaining({
        organizationName: orgName,
      }),
    });
  });
});
