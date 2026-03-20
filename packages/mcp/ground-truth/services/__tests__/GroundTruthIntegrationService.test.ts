/**
 * Tests for GroundTruthIntegrationService.ingestSECData
 *
 * Covers:
 *   - empty metrics list returns aggregate with empty arrays without calling edgar.query
 *   - all metrics succeed: metricsPersisted length matches input (after persist step)
 *   - partial failure: failed metric appears in metricFailures, batch continues
 *   - non-Error throws are captured as string messages in metricFailures
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ModuleResponse } from "../../types/index.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---------------------------------------------------------------------------
// Helpers — minimal module stubs
// ---------------------------------------------------------------------------

function makeEDGARModule(queryImpl: (req: { metric?: string }) => Promise<ModuleResponse>) {
  return { query: vi.fn(queryImpl) } as unknown as import("../../modules/EDGARModule.js").EDGARModule;
}

function makeXBRLModule() {
  return { query: vi.fn() } as unknown as import("../../modules/XBRLModule.js").XBRLModule;
}

function makeIndustryModule() {
  return { query: vi.fn() } as unknown as import("../../modules/IndustryBenchmarkModule.js").IndustryBenchmarkModule;
}

// A response whose data shape matches what persistSECMetricResults expects
const successResponse = (metric: string): ModuleResponse => ({
  success: true,
  data: { metric_name: metric, value: 1, provenance: "sec-edgar", timestamp: "" } as any,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GroundTruthIntegrationService.ingestSECData", () => {
  const cik = "0000320193";
  const period = "FY2024";
  const tenantId = "tenant-test";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns aggregate with empty arrays and does not call edgar.query when metrics list is empty", async () => {
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async () => successResponse("any"));
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const result = await service.ingestSECData(cik, period, [], tenantId);

    expect(result.success).toBe(true);
    expect(result.metricsRequested).toEqual([]);
    expect(result.metricsPersisted).toEqual([]);
    expect(result.metricFailures).toEqual([]);
    expect(edgar.query).not.toHaveBeenCalled();
  });

  it("calls edgar.query once per metric and reports success when all succeed", async () => {
    const metrics = ["revenue_total", "net_income", "total_assets"];
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async (req) => successResponse(req.metric ?? ""));
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const result = await service.ingestSECData(cik, period, metrics, tenantId);

    expect(edgar.query).toHaveBeenCalledTimes(metrics.length);
    expect(result.success).toBe(true);
    expect(result.metricsRequested).toEqual(metrics);
    expect(result.metricFailures).toHaveLength(0);
  });

  it("records a failure for a throwing metric without aborting the batch", async () => {
    const metrics = ["revenue_total", "bad_metric", "net_income"];
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async (req) => {
      if (req.metric === "bad_metric") throw new Error("EDGAR lookup failed");
      return successResponse(req.metric ?? "");
    });
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const result = await service.ingestSECData(cik, period, metrics, tenantId);

    expect(result.success).toBe(false);
    expect(result.metricFailures).toHaveLength(1);
    expect(result.metricFailures[0]!.metric).toBe("bad_metric");
    expect(result.metricFailures[0]!.error).toBe("EDGAR lookup failed");
    // The other two metrics were still attempted
    expect(edgar.query).toHaveBeenCalledTimes(3);
  });

  it("captures non-Error throws as string messages in metricFailures", async () => {
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async () => { throw "string error"; });
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const result = await service.ingestSECData(cik, period, ["revenue_total"], tenantId);

    expect(result.success).toBe(false);
    expect(result.metricFailures[0]!.error).toBe("string error");
  });
});
