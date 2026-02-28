import { logger } from "../../lib/logger.js";
export class GroundTruthIntegrationService {
    edgar;
    xbrl;
    industry;
    constructor(edgar, xbrl, industry) {
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
    async ingestSECData(cik, period, metrics, tenantId) {
        try {
            const results = await this.edgar.query({ identifier: cik, metric: metrics[0], period });
            // TODO: Loop over metrics, store with provenance and tenantId
            logger.info("Ingested SEC data", { cik, period, tenantId, metrics });
            return results;
        }
        catch (error) {
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
    async ingestBLSData(naics, metric, tenantId) {
        try {
            const results = await this.industry.query({ identifier: naics, metric });
            logger.info("Ingested BLS data", { naics, metric, tenantId });
            return results;
        }
        catch (error) {
            logger.error("BLS ingestion failed", { naics, error });
            throw error;
        }
    }
}
//# sourceMappingURL=GroundTruthIntegrationService.js.map