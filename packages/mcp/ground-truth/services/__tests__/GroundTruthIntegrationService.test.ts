/**
 * Tests for GroundTruthIntegrationService.ingestSECData
 *
 * Covers:
 *   - empty metrics list returns [] without calling edgar.query
 *   - all metrics succeed: result array length matches input
 *   - partial failure: failed metric produces a failed ModuleResponse,
 *     successful metrics are unaffected
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

const successResponse = (metric: string): ModuleResponse => ({
  success: true,
  data: { id: metric, value: 1, unit: "USD", source_type: "sec-edgar", confidence: 1, timestamp: "" },
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

  it("returns [] and does not call edgar.query when metrics list is empty", async () => {
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async () => successResponse("any"));
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const results = await service.ingestSECData(cik, period, [], tenantId);

    expect(results).toEqual([]);
    expect(edgar.query).not.toHaveBeenCalled();
  });

  it("returns one result per metric when all succeed", async () => {
    const metrics = ["revenue_total", "net_income", "total_assets"];
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async (req) => successResponse(req.metric ?? ""));
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const results = await service.ingestSECData(cik, period, metrics, tenantId);

    expect(results).toHaveLength(metrics.length);
    expect(edgar.query).toHaveBeenCalledTimes(metrics.length);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("collects a failed ModuleResponse for a throwing metric without aborting the batch", async () => {
    const metrics = ["revenue_total", "bad_metric", "net_income"];
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async (req) => {
      if (req.metric === "bad_metric") throw new Error("EDGAR lookup failed");
      return successResponse(req.metric ?? "");
    });
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const results = await service.ingestSECData(cik, period, metrics, tenantId);

    expect(results).toHaveLength(3);
    expect(results[0]!.success).toBe(true);
    expect(results[1]!.success).toBe(false);
    expect(results[1]!.error?.code).toBe("INGESTION_ERROR");
    expect(results[1]!.error?.message).toBe("EDGAR lookup failed");
    expect(results[2]!.success).toBe(true);
  });

  it("captures non-Error throws as string messages", async () => {
    const { GroundTruthIntegrationService } = await import("../GroundTruthIntegrationService.js");
    const edgar = makeEDGARModule(async () => { throw "string error"; });
    const service = new GroundTruthIntegrationService(edgar, makeXBRLModule(), makeIndustryModule());

    const results = await service.ingestSECData(cik, period, ["revenue_total"], tenantId);

    expect(results[0]!.success).toBe(false);
    expect(results[0]!.error?.message).toBe("string error");
  });
});
