import { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { customerAccessService } from "../../../services/tenant/CustomerAccessService";
import { getCustomerBenchmarks } from "../benchmarks.js";

const getSupabaseClientMock = vi.fn();

vi.mock("@shared/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("../../../services/tenant/CustomerAccessService", () => ({
  customerAccessService: {
    validateCustomerToken: vi.fn(),
  },
}));
vi.mock("@shared/lib/supabase", () => ({
  getSupabaseClient: () => getSupabaseClientMock(),
}));

describe("customer portal benchmarks cross-tenant isolation", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: { token: "tenant-a-token" }, query: {} };
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock };
  });

  it("uses only same-tenant realization metrics when building benchmark comparisons", async () => {
    const metricEqCalls: Array<[string, string]> = [];
    const valueCaseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "case-123",
          company_name: "Acme",
          custom_fields: { industry: "technology" },
          organization_id: "tenant-a",
        },
        error: null,
      }),
    };
    const benchmarksQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "bench-1",
            kpi_name: "NPS",
            industry: "technology",
            company_size: null,
            p25: 30,
            median: 50,
            p75: 70,
            best_in_class: 80,
            unit: "%",
            source: "dataset",
            vintage: "2026",
            sample_size: 20,
          },
        ],
        error: null,
      }),
    };
    const metricsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((column: string, value: string) => {
        metricEqCalls.push([column, value]);
        return metricsQuery;
      }),
      not: vi.fn().mockResolvedValue({
        data: [{ metric_name: "NPS", actual_value: 55 }],
        error: null,
      }),
    };

    getSupabaseClientMock
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(valueCaseQuery) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(benchmarksQuery) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(metricsQuery) });

    vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
      value_case_id: "case-123",
      is_valid: true,
      error_message: null,
    });

    await getCustomerBenchmarks(req as Request, res as Response);

    expect(metricEqCalls).toContainEqual(["value_case_id", "case-123"]);
    expect(metricEqCalls).toContainEqual(["organization_id", "tenant-a"]);
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
