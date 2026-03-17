/**
 * Tests for billing API response shape normalisation.
 *
 * Covers the pure mapping functions exported from the billing hooks.
 * @valueos/shared is mocked because it pulls in server-side deps (redis,
 * supabase) unavailable in the jsdom environment. The mock uses vi.hoisted
 * so the factory runs before module resolution.
 */

import { describe, expect, it, vi } from "vitest";

// vi.hoisted runs before module resolution, so we can safely build the mock
// schemas here without triggering the redis/supabase import chain.
const { BackendSubscriptionSchema, BillingSummaryResponseSchema, InvoicesResponseSchema } =
  vi.hoisted(() => {
    // Inline minimal schema stubs — just enough for the hooks to import without
    // error. The mapping functions under test do not call .parse() at all.
    const stub = { parse: (v: unknown) => v };
    return {
      BackendSubscriptionSchema: stub,
      BillingSummaryResponseSchema: stub,
      InvoicesResponseSchema: stub,
    };
  });

vi.mock("@valueos/shared", () => ({
  BackendSubscriptionSchema,
  BillingSummaryResponseSchema,
  InvoicesResponseSchema,
}));

vi.mock("@/api/client/unified-api-client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

// Import mapping functions after mocks are registered.
import { mapInvoice, mapInvoiceStatus } from "../useInvoices";
import { mapPlanTier, mapSubscription, mapSubscriptionStatus } from "../useSubscription";
import { mapUsageSummary } from "../useUsageSummary";

// ---------------------------------------------------------------------------
// mapPlanTier
// ---------------------------------------------------------------------------

describe("mapPlanTier", () => {
  it("maps 'standard' to 'pro'", () => {
    expect(mapPlanTier("standard")).toBe("pro");
  });

  it("passes 'free' through unchanged", () => {
    expect(mapPlanTier("free")).toBe("free");
  });

  it("passes 'enterprise' through unchanged", () => {
    expect(mapPlanTier("enterprise")).toBe("enterprise");
  });
});

// ---------------------------------------------------------------------------
// mapSubscriptionStatus
// ---------------------------------------------------------------------------

describe("mapSubscriptionStatus", () => {
  it.each([
    ["active", "active"],
    ["trialing", "trialing"],
    ["past_due", "past_due"],
    ["canceled", "canceled"],
  ] as const)("maps '%s' to '%s' unchanged", (input, expected) => {
    expect(mapSubscriptionStatus(input)).toBe(expected);
  });

  it("maps 'unpaid' to 'past_due'", () => {
    expect(mapSubscriptionStatus("unpaid")).toBe("past_due");
  });

  it("maps 'incomplete' to 'active'", () => {
    expect(mapSubscriptionStatus("incomplete")).toBe("active");
  });

  it("maps 'incomplete_expired' to 'canceled'", () => {
    expect(mapSubscriptionStatus("incomplete_expired")).toBe("canceled");
  });

  it("falls back to 'active' for unknown status values", () => {
    expect(mapSubscriptionStatus("some_future_stripe_status")).toBe("active");
  });
});

// ---------------------------------------------------------------------------
// mapSubscription — full shape including rawStatus
// ---------------------------------------------------------------------------

const baseBackendSubscription = {
  id: "sub_123",
  stripe_subscription_id: "stripe_sub_abc",
  customer_id: "cust_456",
  organization_id: "org_789",
  status: "active" as const,
  plan_tier: "standard" as const,
  current_period_start: "2026-06-01T00:00:00.000Z",
  current_period_end: "2026-07-01T00:00:00.000Z",
  cancel_at_period_end: false,
};

describe("mapSubscription", () => {
  it("maps plan_tier 'standard' to planTier 'pro'", () => {
    expect(mapSubscription(baseBackendSubscription).planTier).toBe("pro");
  });

  it("sets userId from organization_id", () => {
    expect(mapSubscription(baseBackendSubscription).userId).toBe("org_789");
  });

  it("preserves rawStatus as the original backend value", () => {
    const result = mapSubscription({ ...baseBackendSubscription, status: "unpaid" as const });
    expect(result.rawStatus).toBe("unpaid");
    expect(result.status).toBe("past_due");
  });

  it("rawStatus and status differ for 'incomplete'", () => {
    const result = mapSubscription({ ...baseBackendSubscription, status: "incomplete" as const });
    expect(result.rawStatus).toBe("incomplete");
    expect(result.status).toBe("active");
  });

  it("rawStatus and status are identical for standard UI statuses", () => {
    const result = mapSubscription({ ...baseBackendSubscription, status: "past_due" as const });
    expect(result.rawStatus).toBe("past_due");
    expect(result.status).toBe("past_due");
  });

  it("maps period dates through unchanged", () => {
    const result = mapSubscription(baseBackendSubscription);
    expect(result.currentPeriodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(result.currentPeriodEnd).toBe("2026-07-01T00:00:00.000Z");
  });

  it("maps cancelAtPeriodEnd", () => {
    expect(
      mapSubscription({ ...baseBackendSubscription, cancel_at_period_end: true }).cancelAtPeriodEnd,
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapInvoiceStatus
// ---------------------------------------------------------------------------

describe("mapInvoiceStatus", () => {
  it.each([
    ["paid", "paid"],
    ["open", "pending"],
    ["draft", "pending"],
    ["uncollectible", "failed"],
    ["void", "failed"],
    ["some_new_stripe_status", "failed"],
  ] as const)("maps '%s' to '%s'", (input, expected) => {
    expect(mapInvoiceStatus(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// mapInvoice — full shape
// ---------------------------------------------------------------------------

const baseBackendInvoice = {
  id: "inv_db_id",
  stripe_invoice_id: "in_stripe_123",
  invoice_number: "INV-2026-001",
  status: "paid",
  amount_due: 2900,
  amount_paid: 2900,
  currency: "usd",
  period_start: "2026-06-01T00:00:00.000Z",
  period_end: "2026-07-01T00:00:00.000Z",
  invoice_pdf: "https://stripe.com/pdf/inv_123",
  created_at: "2026-06-01T12:00:00.000Z",
};

describe("mapInvoice", () => {
  it("prefers invoice_number as the display id", () => {
    expect(mapInvoice(baseBackendInvoice).id).toBe("INV-2026-001");
  });

  it("falls back to stripe_invoice_id when invoice_number is absent", () => {
    const { invoice_number: _, ...withoutNumber } = baseBackendInvoice;
    expect(mapInvoice(withoutNumber).id).toBe("in_stripe_123");
  });

  it("falls back to db id when stripe_invoice_id is empty", () => {
    expect(
      mapInvoice({ ...baseBackendInvoice, invoice_number: undefined, stripe_invoice_id: "" }).id,
    ).toBe("inv_db_id");
  });

  it("maps amount_due to amount", () => {
    expect(mapInvoice(baseBackendInvoice).amount).toBe(2900);
  });

  it("maps status correctly", () => {
    expect(mapInvoice(baseBackendInvoice).status).toBe("paid");
  });

  it("formats date containing the year", () => {
    expect(mapInvoice(baseBackendInvoice).date).toContain("2026");
  });

  it("uses invoice_pdf as pdfUrl", () => {
    expect(mapInvoice(baseBackendInvoice).pdfUrl).toBe("https://stripe.com/pdf/inv_123");
  });

  it("falls back to hosted_invoice_url when invoice_pdf is absent", () => {
    const { invoice_pdf: _, ...withoutPdf } = baseBackendInvoice;
    expect(
      mapInvoice({ ...withoutPdf, hosted_invoice_url: "https://invoice.stripe.com/hosted/123" })
        .pdfUrl,
    ).toBe("https://invoice.stripe.com/hosted/123");
  });

  it("sets pdfUrl to undefined when neither pdf field is present", () => {
    const { invoice_pdf: _, ...withoutPdf } = baseBackendInvoice;
    expect(mapInvoice(withoutPdf).pdfUrl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapUsageSummary
// ---------------------------------------------------------------------------

const baseUsageSummary = {
  tenant_id: "org_abc",
  period_start: "2026-06-01T00:00:00.000Z",
  period_end: "2026-07-01T00:00:00.000Z",
  usage: { api_calls: 500, llm_tokens: 10000, agent_executions: 20, storage_gb: 1, user_seats: 3 },
  quotas: {
    api_calls: 1000,
    llm_tokens: 50000,
    agent_executions: 100,
    storage_gb: 10,
    user_seats: 5,
  },
  percentages: {
    api_calls: 50,
    llm_tokens: 20,
    agent_executions: 20,
    storage_gb: 10,
    user_seats: 60,
  },
  overages: { api_calls: 0, llm_tokens: 0, agent_executions: 0, storage_gb: 0, user_seats: 0 },
} as const;

describe("mapUsageSummary", () => {
  it("produces one metric entry per usage key", () => {
    expect(mapUsageSummary(baseUsageSummary).metrics).toHaveLength(5);
  });

  it("maps metricKey and human-readable label for api_calls", () => {
    const apiCalls = mapUsageSummary(baseUsageSummary).metrics.find(
      (m) => m.metricKey === "api_calls",
    )!;
    expect(apiCalls.metric).toBe("API Calls");
  });

  it("sets used, limit, percentage from the correct source fields", () => {
    const apiCalls = mapUsageSummary(baseUsageSummary).metrics.find(
      (m) => m.metricKey === "api_calls",
    )!;
    expect(apiCalls.used).toBe(500);
    expect(apiCalls.limit).toBe(1000);
    expect(apiCalls.percentage).toBe(50);
  });

  it("thresholdBreached is false when all metrics are below 80%", () => {
    expect(mapUsageSummary(baseUsageSummary).thresholdBreached).toBe(false);
  });

  it("thresholdBreached is true when any metric reaches 80%", () => {
    expect(
      mapUsageSummary({
        ...baseUsageSummary,
        percentages: { ...baseUsageSummary.percentages, api_calls: 80 },
      }).thresholdBreached,
    ).toBe(true);
  });

  it("hardLimitReached is false when all metrics are below 100%", () => {
    expect(mapUsageSummary(baseUsageSummary).hardLimitReached).toBe(false);
  });

  it("hardLimitReached is true when any metric reaches 100%", () => {
    expect(
      mapUsageSummary({
        ...baseUsageSummary,
        percentages: { ...baseUsageSummary.percentages, llm_tokens: 100 },
      }).hardLimitReached,
    ).toBe(true);
  });

  it("thresholdBreached true but hardLimitReached false at exactly 80%", () => {
    const result = mapUsageSummary({
      ...baseUsageSummary,
      percentages: { ...baseUsageSummary.percentages, api_calls: 80 },
    });
    expect(result.thresholdBreached).toBe(true);
    expect(result.hardLimitReached).toBe(false);
  });

  it("passes period dates through unchanged", () => {
    const result = mapUsageSummary(baseUsageSummary);
    expect(result.periodStart).toBe("2026-06-01T00:00:00.000Z");
    expect(result.periodEnd).toBe("2026-07-01T00:00:00.000Z");
  });
});
