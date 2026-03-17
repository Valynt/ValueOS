import { beforeEach, describe, expect, it, vi } from "vitest";

import { createBillingAccessEnforcement } from "../billingAccessEnforcement.js";

const singleMock = vi.fn();
const eqMock = vi.fn(() => ({ single: singleMock }));
const selectMock = vi.fn(() => ({ eq: eqMock }));
const fromMock = vi.fn(() => ({ select: selectMock }));

vi.mock("../../lib/supabase.js", () => ({
  supabase: {
    from: fromMock,
  },
}));

const logRequestEvent = vi.fn(async () => {});
vi.mock("../../services/security/SecurityAuditService.js", () => ({
  securityAuditService: {
    logRequestEvent,
  },
}));

describe("billingAccessEnforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows requests for tenants with full access", async () => {
    singleMock.mockResolvedValue({
      data: {
        access_mode: "full_access",
        grace_period_enforcement: false,
        grace_period_expires_at: null,
      },
      error: null,
    });

    const middleware = createBillingAccessEnforcement();
    const req = {
      originalUrl: "/api/agents/execute",
      tenantId: "tenant-1",
      user: { id: "user-1" },
      ip: "127.0.0.1",
      get: vi.fn(() => "vitest"),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(logRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "billing_access_allow" })
    );
  });

  it("denies requests for restricted tenants", async () => {
    singleMock.mockResolvedValue({
      data: {
        access_mode: "restricted",
        grace_period_enforcement: false,
        grace_period_expires_at: null,
      },
      error: null,
    });

    const middleware = createBillingAccessEnforcement();
    const req = {
      originalUrl: "/api/agents/execute",
      tenantId: "tenant-1",
      user: { id: "user-1" },
      ip: "127.0.0.1",
      get: vi.fn(() => "vitest"),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(logRequestEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "billing_access_deny" })
    );
  });

  it("allows whitelisted billing endpoints", async () => {
    const middleware = createBillingAccessEnforcement();
    const req = {
      originalUrl: "/api/billing/payment-methods/portal",
      tenantId: "tenant-1",
      get: vi.fn(() => "vitest"),
    } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
