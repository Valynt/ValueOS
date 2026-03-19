/**
 * customer-portal-cross-tenant-benchmarks — integration test
 *
 * Verifies that the customer benchmarks endpoint keeps tenant-owned tables
 * scoped by organization_id while still allowing explicit access to global
 * benchmark reference data.
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
    custom_fields: { industry: "technology" },
  },
  {
    id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_B,
    company_name: "Tenant B Co",
    custom_fields: { industry: "technology" },
  },
];

const METRIC_ROWS = [
  {
    metric_name: "Customer Acquisition Cost",
    actual_value: 140,
    value_case_id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_A,
  },
  {
    metric_name: "Customer Acquisition Cost",
    actual_value: 900,
    value_case_id: SHARED_VALUE_CASE_ID,
    organization_id: ORG_B,
  },
];

const BENCHMARK_ROWS = [
  {
    id: "benchmark-1",
    kpi_name: "Customer Acquisition Cost",
    industry: "technology",
    company_size: null,
    p25: 100,
    median: 150,
    p75: 200,
    best_in_class: 250,
    unit: "USD",
    source: "Global benchmark dataset",
    vintage: "2026",
    sample_size: 500,
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
    } else if (table === "benchmarks") {
      rows = [...BENCHMARK_ROWS];
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

describe("customer-portal-cross-tenant-benchmarks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses only the requesting organization's realization metrics while keeping benchmarks global", async () => {
    const { getCustomerBenchmarks } = await import("../benchmarks.js");

    const req = {
      params: { token: "valid-token" },
      query: {},
    } as unknown as Request;

    const json = vi.fn();
    const res = {
      status: vi.fn().mockReturnValue({ json }),
      json,
    } as unknown as Response;

    await getCustomerBenchmarks(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        value_case_id: SHARED_VALUE_CASE_ID,
        company_name: "Tenant A Co",
        industry: "technology",
        comparisons: [
          expect.objectContaining({
            kpi_name: "Customer Acquisition Cost",
            current_value: 140,
            benchmark: expect.objectContaining({
              id: "benchmark-1",
              source: "Global benchmark dataset",
            }),
          }),
        ],
      })
    );

    const payload = json.mock.calls[0]?.[0] as { comparisons: Array<{ current_value: number | null; benchmark: { id: string } }> };
    expect(payload.comparisons).toHaveLength(1);
    expect(payload.comparisons[0]?.current_value).toBe(140);
    expect(payload.comparisons[0]?.current_value).not.toBe(900);
    expect(payload.comparisons[0]?.benchmark.id).toBe("benchmark-1");
  });
});
