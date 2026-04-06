/**
 * customer-portal-cross-tenant-metrics — integration test
 *
 * Verifies that the customer metrics endpoint filters both value_cases and
 * realization_metrics by organization_id, preventing Tenant B from seeing
 * Tenant A's data when value_case_id values collide.
 */

import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ORG_A = "org-a-111";
const ORG_B = "org-b-222";
const SHARED_VALUE_CASE_ID = "shared-vc-000";

const VALUE_CASE_ROWS = [
  {
    id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_A,
    company_name: "Tenant A Co",
    name: "Tenant A Case",
  },
  {
    id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_B,
    company_name: "Tenant B Co",
    name: "Tenant B Case",
  },
];

const METRIC_ROWS = [
  {
    id: "metric-a1",
    value_case_id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_A,
    metric_name: "Net Revenue Retention",
    metric_type: "revenue",
    predicted_value: 110,
    predicted_date: "2026-01-01T00:00:00Z",
    actual_value: 115,
    actual_date: "2026-02-01T00:00:00Z",
    variance: 5,
    variance_pct: 5,
    status: "on_track",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
  {
    id: "metric-b1",
    value_case_id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_B,
    metric_name: "Net Revenue Retention",
    metric_type: "revenue",
    predicted_value: 110,
    predicted_date: "2026-01-01T00:00:00Z",
    actual_value: 80,
    actual_date: "2026-02-01T00:00:00Z",
    variance: -30,
    variance_pct: -27,
    status: "off_track",
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-02-01T00:00:00Z",
  },
];

function buildMockSupabase() {
  function makeQueryBuilder(table: string) {
    const filters: Array<{ col: string; val: unknown }> = [];
    const notNullFilters: string[] = [];
    let rows: Record<string, unknown>[] = [];

    if (table === "value_cases") {
      rows = [...VALUE_CASE_ROWS];
    } else if (table === "realization_metrics") {
      rows = [...METRIC_ROWS];
    }

    const applyFilters = () =>
      rows.filter((row) =>
        filters.every((filter) => row[filter.col] === filter.val) &&
        notNullFilters.every((col) => row[col] !== null)
      );

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: (col: string, val: unknown) => {
        filters.push({ col, val });
        return builder;
      },
      gte: () => builder,
      order: () => builder,
      not: (col: string) => {
        notNullFilters.push(col);
        return builder;
      },
      single: async () => {
        const row = applyFilters()[0] ?? null;
        return {
          data: row,
          error: row ? null : { code: "PGRST116", message: "not found" },
        };
      },
    };

    Object.defineProperty(builder, "then", {
      value: (resolve: (value: unknown) => void) => {
        resolve({ data: applyFilters(), error: null });
      },
    });

    return builder;
  }

  return {
    from: (table: string) => makeQueryBuilder(table),
  };
}

const mockSupabase = buildMockSupabase();

vi.mock("@shared/lib/supabase", () => ({
  createServiceRoleSupabaseClient: vi.fn(),
  assertNotTestEnv: vi.fn(),
  getSupabaseClient: () => mockSupabase,
}));

vi.mock("../../../services/tenant/CustomerAccessService", () => ({
  customerAccessService: {
    validateCustomerToken: vi.fn().mockResolvedValue({
      is_valid: true,
      value_case_id: SHARED_VALUE_CASE_ID,
      organization_id: ORG_A,
      error_message: null,
    }),
  },
}));

vi.mock("@shared/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("customer-portal-cross-tenant-metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the requesting organization's metrics for a shared value_case_id", async () => {
    const { getCustomerMetrics } = await import("../metrics.js");

    const req = {
      params: { token: "valid-token" },
      query: { period: "all", metric_type: "all" },
    } as unknown as Request;

    const json = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json }),
      json,
    } as unknown as Response;

    await getCustomerMetrics(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        value_case_id: SHARED_VALUE_CASE_ID,
        company_name: "Tenant A Co",
        metrics: [
          expect.objectContaining({
            id: "metric-a1",
            organization_id: ORG_A,
            actual_value: 115,
          }),
        ],
      })
    );

    const payload = json.mock.calls[0]?.[0] as { metrics: Array<{ id: string; organization_id: string; actual_value: number }> };
    expect(payload.metrics).toHaveLength(1);
    expect(payload.metrics.every((metric) => metric.organization_id === ORG_A)).toBe(true);
    expect(payload.metrics.every((metric) => metric.id !== "metric-b1")).toBe(true);
  });
});
