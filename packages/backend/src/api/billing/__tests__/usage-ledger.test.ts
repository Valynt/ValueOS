/**
 * Tests for the usage ledger endpoint.
 *
 * Covers:
 *   - parseLedgerDateRange: YYYY-MM and YYYY-MM:YYYY-MM formats, invalid inputs
 *   - Handler: tenant isolation (401 without tenantId), 400 on bad dateRange,
 *     correct Supabase query construction, breakdownByMetric aggregation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock supabase before importing the module under test.
// vi.hoisted ensures the mock values are available when vi.mock factories run.
// ---------------------------------------------------------------------------

type ChainResult = { data: unknown; error: unknown };

const { mockFrom, mockChain, mockGetRequestSupabaseClient, getMockQueryResult, setMockQueryResult } = vi.hoisted(() => {
  let _result: ChainResult = { data: [], error: null };

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    order: vi.fn(() => Promise.resolve(_result)),
  };

  return {
    mockChain: chain,
    mockFrom: vi.fn(() => chain),
    mockGetRequestSupabaseClient: vi.fn(() => ({ from: mockFrom })),
    getMockQueryResult: () => _result,
    setMockQueryResult: (r: ChainResult) => { _result = r; chain.order.mockResolvedValue(r); },
  };
});

vi.mock("@shared/lib/supabase", () => ({
  getRequestSupabaseClient: mockGetRequestSupabaseClient,
}));

vi.mock("../../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../../middleware/securityMiddleware.js", () => ({
  securityHeadersMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../middleware/serviceIdentityMiddleware.js", () => ({
  serviceIdentityMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock("../../../services/billing/EntitlementsService.js", () => ({
  EntitlementsService: class {
    getUsageWithEntitlements = vi.fn().mockResolvedValue({});
  },
}));

vi.mock("../../../services/billing/InvoiceMathEngine.js", () => ({
  InvoiceMathEngine: class {
    calculateUpcomingInvoice = vi.fn().mockResolvedValue(null);
  },
}));

vi.mock("../../../services/billing/PriceVersionService.js", () => ({
  priceVersionService: {
    getEffectiveVersionForTenant: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../../services/metering/MetricsCollector.js", () => ({
  default: {
    getUsageSummary: vi.fn().mockResolvedValue({}),
    getUsageForExport: vi.fn().mockResolvedValue([]),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks are registered
// ---------------------------------------------------------------------------

import { parseLedgerDateRange } from "../usage.js";

// ---------------------------------------------------------------------------
// parseLedgerDateRange — pure function tests
// ---------------------------------------------------------------------------

describe("parseLedgerDateRange", () => {
  describe("single-month format YYYY-MM", () => {
    it("returns periodStart as the first of the given month (UTC)", () => {
      const result = parseLedgerDateRange("2026-06");
      expect(result).not.toBeNull();
      expect(result!.periodStart.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    });

    it("returns periodEnd as the first of the following month (exclusive upper bound)", () => {
      const result = parseLedgerDateRange("2026-06");
      expect(result).not.toBeNull();
      // June → July
      expect(result!.periodEnd.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    });

    it("handles December correctly (rolls over to January of next year)", () => {
      const result = parseLedgerDateRange("2026-12");
      expect(result).not.toBeNull();
      expect(result!.periodEnd.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    });

    it("handles January correctly", () => {
      const result = parseLedgerDateRange("2026-01");
      expect(result).not.toBeNull();
      expect(result!.periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
      expect(result!.periodEnd.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    });
  });

  describe("range format YYYY-MM:YYYY-MM", () => {
    it("sets periodStart to the first of the start month", () => {
      const result = parseLedgerDateRange("2026-01:2026-03");
      expect(result).not.toBeNull();
      expect(result!.periodStart.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("sets periodEnd to the first of the month after the end month", () => {
      const result = parseLedgerDateRange("2026-01:2026-03");
      expect(result).not.toBeNull();
      // March → April
      expect(result!.periodEnd.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    });

    it("handles a single-month range (start === end) identically to YYYY-MM", () => {
      const single = parseLedgerDateRange("2026-06");
      const range = parseLedgerDateRange("2026-06:2026-06");
      expect(range!.periodStart.toISOString()).toBe(single!.periodStart.toISOString());
      expect(range!.periodEnd.toISOString()).toBe(single!.periodEnd.toISOString());
    });

    it("handles a cross-year range", () => {
      const result = parseLedgerDateRange("2025-11:2026-02");
      expect(result).not.toBeNull();
      expect(result!.periodStart.toISOString()).toBe("2025-11-01T00:00:00.000Z");
      expect(result!.periodEnd.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    });
  });

  describe("invalid inputs", () => {
    it("returns null for a plain year", () => {
      expect(parseLedgerDateRange("2026")).toBeNull();
    });

    it("returns null for a full date string", () => {
      expect(parseLedgerDateRange("2026-06-15")).toBeNull();
    });

    it("returns null for non-numeric month", () => {
      expect(parseLedgerDateRange("2026-ab")).toBeNull();
    });

    it("returns null for an empty string", () => {
      expect(parseLedgerDateRange("")).toBeNull();
    });

    it("returns null for random text", () => {
      expect(parseLedgerDateRange("last-month")).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// Handler integration — mock req/res to test routing logic
// ---------------------------------------------------------------------------

function makeReqRes(opts: {
  tenantId?: string;
  dateRange?: string;
}) {
  const req = {
    tenantId: opts.tenantId,
    params: { dateRange: opts.dateRange ?? "2026-06" },
    user: {},
    query: {},
  } as unknown as import("express").Request;

  const body: Record<string, unknown> = {};
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn((payload: unknown) => {
      body.payload = payload;
      return res;
    }),
    locals: {},
  } as unknown as import("express").Response;

  return { req, res, body };
}

describe("GET /billing/usage/ledger/:dateRange handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockQueryResult({ data: [], error: null });
    mockChain.select.mockReturnThis();
    mockChain.eq.mockReturnThis();
    mockChain.gte.mockReturnThis();
    mockChain.lt.mockReturnThis();
  });

  it("returns 401 when tenantId is absent", async () => {
    // Import the router and invoke the handler directly via supertest-style
    // approach: we test the handler logic by calling the route through a
    // minimal Express app.
    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req, _res, next) => {
      // No tenantId set
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    const response = await request(app).get("/usage/ledger/2026-06");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/unauthorized/i);
  });

  it("returns 400 for an invalid dateRange", async () => {
    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-abc";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    const response = await request(app).get("/usage/ledger/not-a-date");
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/invalid daterange/i);
  });

  it("queries rated_ledger scoped to tenantId", async () => {
    setMockQueryResult({ data: [], error: null });

    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-xyz";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    await request(app).get("/usage/ledger/2026-06");

    expect(mockGetRequestSupabaseClient).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("rated_ledger");
    expect(mockChain.eq).toHaveBeenCalledWith("tenant_id", "tenant-xyz");
  });

  it("applies gte/lt bounds from the parsed dateRange", async () => {
    setMockQueryResult({ data: [], error: null });

    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-xyz";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    await request(app).get("/usage/ledger/2026-06");

    expect(mockChain.gte).toHaveBeenCalledWith(
      "period_start",
      "2026-06-01T00:00:00.000Z",
    );
    expect(mockChain.lt).toHaveBeenCalledWith(
      "period_start",
      "2026-07-01T00:00:00.000Z",
    );
  });

  it("returns empty ledgerEntries and empty breakdownByMetric when no rows exist", async () => {
    setMockQueryResult({ data: [], error: null });

    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-xyz";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    const response = await request(app).get("/usage/ledger/2026-06");

    expect(response.status).toBe(200);
    expect(response.body.ledgerEntries).toEqual([]);
    expect(response.body.breakdownByMetric).toEqual({});
  });

  it("aggregates breakdownByMetric correctly across multiple entries", async () => {
    const rows = [
      { id: "1", meter_key: "api_calls", period_start: "2026-06-01T00:00:00.000Z", period_end: "2026-07-01T00:00:00.000Z", quantity_used: 500, quantity_included: 1000, quantity_overage: 0, unit_price: 0, amount: 0, rated_at: "2026-07-01T00:00:00.000Z" },
      { id: "2", meter_key: "llm_tokens", period_start: "2026-06-01T00:00:00.000Z", period_end: "2026-07-01T00:00:00.000Z", quantity_used: 5000, quantity_included: 10000, quantity_overage: 0, unit_price: 0, amount: 10, rated_at: "2026-07-01T00:00:00.000Z" },
      { id: "3", meter_key: "llm_tokens", period_start: "2026-06-15T00:00:00.000Z", period_end: "2026-07-01T00:00:00.000Z", quantity_used: 2000, quantity_included: 0, quantity_overage: 2000, unit_price: 0.001, amount: 2, rated_at: "2026-07-01T00:00:00.000Z" },
    ];
    setMockQueryResult({ data: rows, error: null });

    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-xyz";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    const response = await request(app).get("/usage/ledger/2026-06");

    expect(response.status).toBe(200);
    expect(response.body.ledgerEntries).toHaveLength(3);
    // api_calls: 0, llm_tokens: 10 + 2 = 12
    expect(response.body.breakdownByMetric.api_calls).toBe(0);
    expect(response.body.breakdownByMetric.llm_tokens).toBe(12);
  });

  it("returns 500 when the DB query errors", async () => {
    setMockQueryResult({ data: null, error: { message: "db error" } });

    const express = (await import("express")).default;
    const { default: usageRouter } = await import("../usage.js");

    const app = express();
    app.use((req: import("express").Request, _res, next) => {
      (req as unknown as Record<string, unknown>).tenantId = "tenant-xyz";
      next();
    });
    app.use("/usage", usageRouter);

    const { default: request } = await import("supertest");
    const response = await request(app).get("/usage/ledger/2026-06");
    expect(response.status).toBe(500);
    expect(response.body.error).toMatch(/failed to fetch ledger/i);
  });
});
