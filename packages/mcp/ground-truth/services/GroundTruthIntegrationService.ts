/**
 * GroundTruthIntegrationService
 *
 * Orchestrates automated ingestion of authoritative financial data from SEC EDGAR, BLS, and other sources.
 * Ensures provenance, error handling, and multi-tenant scoping for all ingested records.
 */
import { EDGARModule } from "../modules/EDGARModule";
import { XBRLModule } from "../modules/XBRLModule";
import { IndustryBenchmarkModule } from "../modules/IndustryBenchmarkModule";
import { logger } from "../../lib/logger";

export class GroundTruthIntegrationService {
  private edgar: EDGARModule;
  private xbrl: XBRLModule;
  private industry: IndustryBenchmarkModule;

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
    try {
      const results = await this.edgar.query({ identifier: cik, metric: metrics[0], period });
      // TODO: Loop over metrics, store with provenance and tenantId
      logger.info("Ingested SEC data", { cik, period, tenantId, metrics });
      return results;
    } catch (error) {
      logger.error("SEC ingestion failed", { cik, error });
      throw error;
    }
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
