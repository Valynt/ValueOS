/**
 * AuditLogService.resolveSecurityEventCategory — unit tests
 *
 * The method is private; we access it via a test subclass to avoid
 * instantiating the full service (which requires a Supabase client).
 *
 * Regression: "authorization" was declared in the return type but had no
 * matching branch, causing authorization events to be miscategorised as "audit".
 */

import { describe, expect, it } from "vitest";

// Minimal stub — only what the constructor touches
vi.mock("../../BaseService.js", () => ({
  BaseService: class {
    constructor() {}
  },
}));
vi.mock("../../../lib/supabase.js", () => ({
  assertNotTestEnv: vi.fn(),
  createServerSupabaseClient: () => ({}),
  // Named export consumed by modules that import supabase directly
  supabase: { from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), insert: vi.fn().mockResolvedValue({ data: null, error: null }), update: vi.fn().mockReturnThis(), delete: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) })) },
}));
vi.mock("../SecurityEventStreamingService.js", () => ({
  securityEventStreamingService: { stream: () => Promise.resolve() },
}));
vi.mock("../../../lib/logger.js", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
}));

import { vi } from "vitest";

import { AuditLogService } from "../AuditLogService.js";

// Expose the private method for testing
class TestableAuditLogService extends AuditLogService {
  public resolveCategory(action: string) {
    return (this as unknown as { resolveSecurityEventCategory(a: string): string })
      .resolveSecurityEventCategory(action);
  }
}

describe("AuditLogService.resolveSecurityEventCategory", () => {
  const svc = new TestableAuditLogService({} as never);

  it("returns 'auth' for login actions", () => {
    expect(svc.resolveCategory("user.login")).toBe("auth");
    expect(svc.resolveCategory("session.create")).toBe("auth");
    expect(svc.resolveCategory("mfa.verify")).toBe("auth");
  });

  // Regression: this branch was missing — authorization events fell through to "audit"
  it("returns 'authorization' for authorization/access-check actions", () => {
    expect(svc.resolveCategory("authorization.check")).toBe("authorization");
    expect(svc.resolveCategory("authorise.resource")).toBe("authorization");
    // access_check has no overlap with policy keywords
    expect(svc.resolveCategory("access_check")).toBe("authorization");
  });

  it("returns 'role_change' for grant/revoke/role/permission actions", () => {
    expect(svc.resolveCategory("role.grant")).toBe("role_change");
    expect(svc.resolveCategory("permission.revoke")).toBe("role_change");
  });

  it("returns 'data_export' for export actions", () => {
    expect(svc.resolveCategory("data.export")).toBe("data_export");
  });

  it("returns 'policy' for deny/forbidden/unauthorized actions", () => {
    expect(svc.resolveCategory("policy.deny")).toBe("policy");
    expect(svc.resolveCategory("request.forbidden")).toBe("policy");
    expect(svc.resolveCategory("access.unauthorized")).toBe("policy");
  });

  it("returns 'audit' for unrecognised actions", () => {
    expect(svc.resolveCategory("workflow.transition")).toBe("audit");
    expect(svc.resolveCategory("case.update")).toBe("audit");
  });
});
