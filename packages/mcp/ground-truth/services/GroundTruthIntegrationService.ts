/**
 * GroundTruthIntegrationService
 *
 * Orchestrates automated ingestion of authoritative financial data from SEC EDGAR, BLS, and other sources.
 * Ensures provenance, error handling, and multi-tenant scoping for all ingested records.
 */
import { logger } from "../../lib/logger.js";
import { EDGARModule } from "../modules/EDGARModule.js";
import { IndustryBenchmarkModule } from "../modules/IndustryBenchmarkModule.js";
import { XBRLModule } from "../modules/XBRLModule.js";
import { FinancialMetric, ModuleResponse, ProvenanceInfo } from "../types/index.js";

export interface PersistedSECMetricRecord {
  cik: string;
  metric: string;
  value: FinancialMetric["value"];
  provenance: ProvenanceInfo;
  timestamp: string;
  metadata: {
    tenant_id: string;
    period: string;
  };
}

export interface SECIngestionAggregateResult {
  cik: string;
  period: string;
  tenantId: string;
  metricsRequested: string[];
  metricsPersisted: PersistedSECMetricRecord[];
  metricFailures: Array<{ metric: string; error: string }>;
  success: boolean;
}

export class GroundTruthIntegrationService {
  private edgar: EDGARModule;
  private xbrl: XBRLModule;
  private industry: IndustryBenchmarkModule;
  private secMetricStore: PersistedSECMetricRecord[] = [];

  constructor(edgar: EDGARModule, xbrl: XBRLModule, industry: IndustryBenchmarkModule) {
    this.edgar = edgar;
    this.xbrl = xbrl;
    this.industry = industry;
  }

  /**
   * Ingests authoritative data for a given CIK and period.
   * @param cik Central Index Key (public company)
   * @param period Fiscal period (e.g., 'FY2024')
   * @param metrics List of GAAP metrics
   * @param tenantId Organization/tenant scope
   */
  async ingestSECData(cik: string, period: string, metrics: string[], tenantId: string) {
    const metricFailures: Array<{ metric: string; error: string }> = [];
    const metricsPersisted: PersistedSECMetricRecord[] = [];

    for (const metric of metrics) {
      try {
        const result = await this.edgar.query({ identifier: cik, metric, period });
        const persistedRecords = this.persistSECMetricResults(result, {
          cik,
          tenantId,
          period,
          metric,
        });
        metricsPersisted.push(...persistedRecords);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        metricFailures.push({ metric, error: errorMessage });
        logger.warn("SEC metric ingestion failed", { cik, period, tenantId, metric, error });
      }
    }

    const aggregateResult: SECIngestionAggregateResult = {
      cik,
      period,
      tenantId,
      metricsRequested: metrics,
      metricsPersisted,
      metricFailures,
      success: metricFailures.length === 0,
    };

    logger.info("SEC ingestion completed", {
      cik,
      period,
      tenantId,
      requested: metrics.length,
      persisted: metricsPersisted.length,
      failures: metricFailures.length,
    });

    return aggregateResult;
  }

  getPersistedSECMetricRecords(): PersistedSECMetricRecord[] {
    return [...this.secMetricStore];
  }

  private persistSECMetricResults(
    result: ModuleResponse,
    context: { cik: string; period: string; tenantId: string; metric: string }
  ): PersistedSECMetricRecord[] {
    if (!result.success || !result.data) {
      const message = result.error?.message ?? "No SEC metric data returned";
      throw new Error(message);
    }

    const financialMetrics = Array.isArray(result.data) ? result.data : [result.data];

    if (financialMetrics.length === 0) {
      throw new Error(`No metric records returned for ${context.metric}`);
    }

    const persistedRecords = financialMetrics.map((financialMetric) => {
      const record: PersistedSECMetricRecord = {
        cik: context.cik,
        metric: financialMetric.metric_name,
        value: financialMetric.value,
        provenance: financialMetric.provenance,
        timestamp: financialMetric.timestamp,
        metadata: {
          tenant_id: context.tenantId,
          period: context.period,
        },
      };

      this.secMetricStore.push(record);
      return record;
    });

    return persistedRecords;
  }

  /**
   * Ingests industry benchmark data from BLS for a given NAICS code.
   * @param naics NAICS industry code
   * @param metric Benchmark metric
   * @param tenantId Organization/tenant scope
   */
  async ingestBLSData(naics: string, metric: string, tenantId: string) {
    try {
      const results = await this.industry.query({ identifier: naics, metric });
      logger.info("Ingested BLS data", { naics, metric, tenantId });
      return results;
    } catch (error) {
      logger.error("BLS ingestion failed", { naics, error });
      throw error;
    }
  }
}
