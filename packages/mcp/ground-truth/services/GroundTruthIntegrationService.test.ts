import { describe, expect, it, vi } from "vitest";

import type { EDGARModule } from "../modules/EDGARModule";
import type { IndustryBenchmarkModule } from "../modules/IndustryBenchmarkModule";
import type { XBRLModule } from "../modules/XBRLModule";
import type { FinancialMetric, ModuleResponse } from "../types";

import { GroundTruthIntegrationService } from "./GroundTruthIntegrationService.ts";

const createMetric = (
  metricName: string,
  value: FinancialMetric["value"],
  timestamp: string
): FinancialMetric => ({
  type: "metric",
  metric_name: metricName,
  value,
  confidence: 0.99,
  tier: "tier1",
  source: "sec-edgar",
  timestamp,
  metadata: {},
  provenance: {
    source_type: "sec-edgar",
    extraction_method: "text-extract",
    extracted_at: timestamp,
    accession_number: "0000320193-24-000123",
    filing_type: "10-K",
    period: "FY2024",
    source_url: "https://sec.example.test/filing",
  },
});

describe("GroundTruthIntegrationService.ingestSECData", () => {
  it("persists every metric in a multi-metric payload with tenant metadata", async () => {
    const revenueMetric = createMetric("revenue_total", 1000, "2025-01-01T00:00:00.000Z");
    const incomeMetric = createMetric("net_income", 250, "2025-01-01T00:01:00.000Z");

    const queryMock = vi
      .fn<EDGARModule["query"]>()
      .mockResolvedValueOnce({ success: true, data: revenueMetric } as ModuleResponse)
      .mockResolvedValueOnce({ success: true, data: incomeMetric } as ModuleResponse);

    const service = new GroundTruthIntegrationService(
      { query: queryMock } as unknown as EDGARModule,
      {} as XBRLModule,
      {} as IndustryBenchmarkModule
    );

    const result = await service.ingestSECData(
      "0000320193",
      "FY2024",
      ["revenue_total", "net_income"],
      "tenant-123"
    );

    expect(result.success).toBe(true);
    expect(result.metricFailures).toHaveLength(0);
    expect(result.metricsPersisted).toHaveLength(2);
    expect(result.metricsPersisted.map((metric) => metric.metric)).toEqual([
      "revenue_total",
      "net_income",
    ]);

    for (const persisted of result.metricsPersisted) {
      expect(persisted.metadata.tenant_id).toBe("tenant-123");
      expect(persisted.metadata.period).toBe("FY2024");
      expect(persisted.provenance.source_type).toBe("sec-edgar");
      expect(persisted.timestamp).toMatch(/2025-01-01T00:0[0-1]:00.000Z/);
    }

    expect(service.getPersistedSECMetricRecords()).toHaveLength(2);
    expect(queryMock).toHaveBeenNthCalledWith(1, {
      identifier: "0000320193",
      metric: "revenue_total",
      period: "FY2024",
    });
    expect(queryMock).toHaveBeenNthCalledWith(2, {
      identifier: "0000320193",
      metric: "net_income",
      period: "FY2024",
    });
  });

  it("isolates failures per metric and reports aggregate failures without dropping successful metrics", async () => {
    const revenueMetric = createMetric("revenue_total", 1000, "2025-01-01T00:00:00.000Z");

    const queryMock = vi
      .fn<EDGARModule["query"]>()
      .mockResolvedValueOnce({ success: true, data: revenueMetric } as ModuleResponse)
      .mockRejectedValueOnce(new Error("EDGAR unavailable for net_income"))
      .mockResolvedValueOnce({ success: false, error: { code: "NO_DATA", message: "No EPS data" } });

    const service = new GroundTruthIntegrationService(
      { query: queryMock } as unknown as EDGARModule,
      {} as XBRLModule,
      {} as IndustryBenchmarkModule
    );

    const result = await service.ingestSECData(
      "0000320193",
      "FY2024",
      ["revenue_total", "net_income", "eps_basic"],
      "tenant-456"
    );

    expect(result.success).toBe(false);
    expect(result.metricsPersisted).toHaveLength(1);
    expect(result.metricsPersisted[0]?.metric).toBe("revenue_total");
    expect(result.metricFailures).toEqual([
      { metric: "net_income", error: "EDGAR unavailable for net_income" },
      { metric: "eps_basic", error: "No EPS data" },
    ]);

    expect(service.getPersistedSECMetricRecords()).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledTimes(3);
  });
});
