import { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { customerAccessService } from "../../../services/tenant/CustomerAccessService";
import { getCustomerMetrics } from "../metrics.js";

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

describe("customer portal metrics cross-tenant isolation", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: ReturnType<typeof vi.fn>;
  let jsonMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { params: { token: "tenant-a-token" }, query: { period: "90d" } };
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock, json: jsonMock };
  });

  it("locks realization_metrics reads to the token's organization_id", async () => {
    const metricsEqCalls: Array<[string, string]> = [];
    const valueCaseQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "case-123",
          company_name: "Acme",
          name: "Q1",
          organization_id: "tenant-a",
        },
        error: null,
      }),
    };
    const metricsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((column: string, value: string) => {
        metricsEqCalls.push([column, value]);
        return metricsQuery;
      }),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: "metric-a",
            metric_name: "Revenue",
            metric_type: "revenue",
            predicted_value: 100,
            predicted_date: "2026-01-01",
            actual_value: 110,
            actual_date: "2026-01-02",
            variance: 10,
            variance_pct: 10,
            status: "on_track",
            created_at: "2026-01-02",
            updated_at: "2026-01-02",
          },
        ],
        error: null,
      }),
    };

    getSupabaseClientMock
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(valueCaseQuery) })
      .mockReturnValueOnce({ from: vi.fn().mockReturnValue(metricsQuery) });

    vi.mocked(customerAccessService.validateCustomerToken).mockResolvedValue({
      value_case_id: "case-123",
      is_valid: true,
      error_message: null,
    });

    await getCustomerMetrics(req as Request, res as Response);

    expect(metricsEqCalls).toContainEqual(["value_case_id", "case-123"]);
    expect(metricsEqCalls).toContainEqual(["organization_id", "tenant-a"]);
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
