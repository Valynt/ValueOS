/**
 * validateOpportunityAccess middleware tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@shared/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { validateOpportunityAccess } from "../validateOpportunityAccess.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT_ID = "tenant-abc";
const OPP_ID = "770e8400-e29b-41d4-a716-446655440002";

function makeSupabaseMock(result: { data: unknown; error: unknown }) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue(result),
        }),
      }),
    }),
  };
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    params: { opportunityId: OPP_ID },
    tenantId: TENANT_ID,
    supabase: makeSupabaseMock({ data: { tenant_id: TENANT_ID }, error: null }),
    path: "/api/v1/graph/test",
    ...overrides,
  } as unknown as Parameters<typeof validateOpportunityAccess>[0];
}

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Parameters<typeof validateOpportunityAccess>[1];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("validateOpportunityAccess", () => {
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    next = vi.fn();
  });

  it("calls next() and sets req.opportunityId when ownership is confirmed", async () => {
    const req = makeReq();
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.opportunityId).toBe(OPP_ID);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 when opportunity belongs to a different tenant", async () => {
    const req = makeReq({
      supabase: makeSupabaseMock({ data: { tenant_id: "other-tenant" }, error: null }),
    });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("denied") }),
    );
  });

  it("returns 403 when opportunity does not exist", async () => {
    const req = makeReq({
      supabase: makeSupabaseMock({ data: null, error: null }),
    });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 when opportunityId param is missing", async () => {
    const req = makeReq({ params: {} });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 when tenantId is missing (middleware chain misconfiguration)", async () => {
    const req = makeReq({ tenantId: undefined });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 when supabase client is missing", async () => {
    const req = makeReq({ supabase: undefined });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns 500 when the DB query fails", async () => {
    const req = makeReq({
      supabase: makeSupabaseMock({ data: null, error: { message: "connection refused" } }),
    });
    const res = makeRes();

    await validateOpportunityAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("does not leak whether the record exists in the 403 response", async () => {
    // Both "not found" and "wrong tenant" return the same 403 body
    const notFoundReq = makeReq({
      supabase: makeSupabaseMock({ data: null, error: null }),
    });
    const wrongTenantReq = makeReq({
      supabase: makeSupabaseMock({ data: { tenant_id: "other" }, error: null }),
    });
    const res1 = makeRes();
    const res2 = makeRes();

    await validateOpportunityAccess(notFoundReq, res1, next);
    await validateOpportunityAccess(wrongTenantReq, res2, next);

    expect(res1.json).toHaveBeenCalledWith(res2.json.mock.calls[0][0]);
  });
});
