/**
 * Live Data Feed Service
 *
 * Unified service for accessing live data from SEC, BLS, and Census APIs.
 * Provides caching, rate limiting, error handling, and data quality validation.
 */
import { logger } from "../../lib/logger.js";
import { SECEdgarClient } from "../clients/SECEdgarClient.js";
import { BLSClient } from "../clients/BLSClient.js";
import { CensusClient, } from "../clients/CensusClient.js";
export class LiveDataFeedService {
    secClient;
    blsClient;
    censusClient;
    config;
    cache = new Map();
    qualityMetrics = new Map();
    constructor(config) {
        this.config = config;
        this.secClient = new SECEdgarClient();
        this.blsClient = new BLSClient(config.blsApiKey);
        this.censusClient = new CensusClient(config.censusApiKey);
        logger.info("Live Data Feed Service initialized", {
            hasSecKey: !!config.secApiKey,
            hasBlsKey: !!config.blsApiKey,
            hasCensusKey: !!config.censusApiKey,
            cacheEnabled: config.cacheEnabled,
        });
    }
    // ==================== SEC Data Feeds ====================
    /**
     * Get SEC company filings with caching
     */
    async getSECCompanyFilings(cik, formTypes = ["10-K", "10-Q"], count = 20) {
        const cacheKey = `sec:filings:${cik}:${formTypes.join(",")}:${count}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.secClient.getCompanyFilings(cik, formTypes, undefined, undefined, count);
            });
        }, "sec-filings");
    }
    /**
     * Get SEC company information
     */
    async getSECCompanyInfo(cik) {
        const cacheKey = `sec:company:${cik}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.secClient.getCompanyInfo(cik);
            });
        }, "sec-company");
    }
    /**
     * Get XBRL financial data from SEC filings
     */
    async getSECXBRLData(accessionNumber, cik) {
        const cacheKey = `sec:xbrl:${accessionNumber}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.secClient.getXBRLData(accessionNumber, cik);
            });
        }, "sec-xbrl");
    }
    /**
     * Search SEC companies by name
     */
    async searchSECCompanies(companyName, limit = 10) {
        const cacheKey = `sec:search:${companyName}:${limit}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.secClient.searchCompanies(companyName, limit);
            });
        }, "sec-search");
    }
    // ==================== BLS Data Feeds ====================
    /**
     * Get BLS wage data for occupations
     */
    async getBLSWageData(occupationCodes, year, quarter) {
        const cacheKey = `bls:wage:${occupationCodes.join(",")}:${year || "latest"}:${quarter || "annual"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.blsClient.getWageData(occupationCodes, undefined, year, quarter);
            });
        }, "bls-wage");
    }
    /**
     * Get BLS employment data
     */
    async getBLSEmploymentData(seriesIds, startYear, endYear) {
        const cacheKey = `bls:employment:${seriesIds.join(",")}:${startYear}-${endYear}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.blsClient.getEmploymentData(seriesIds, startYear, endYear);
            });
        }, "bls-employment");
    }
    /**
     * Get BLS industry data
     */
    async getBLSIndustryData(naicsCodes, year, quarter) {
        const cacheKey = `bls:industry:${naicsCodes.join(",")}:${year || "latest"}:${quarter || "annual"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.blsClient.getIndustryData(naicsCodes, year, quarter);
            });
        }, "bls-industry");
    }
    /**
     * Get BLS CPI data
     */
    async getBLSCPIData(startYear, endYear) {
        const cacheKey = `bls:cpi:${startYear}-${endYear}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.blsClient.getCPIData(undefined, undefined, startYear, endYear);
            });
        }, "bls-cpi");
    }
    // ==================== Census Data Feeds ====================
    /**
     * Get Census demographic data
     */
    async getCensusDemographicData(year = 2022, geography = "us", stateCode, countyCode) {
        const cacheKey = `census:demographic:${year}:${geography}:${stateCode || "all"}:${countyCode || "all"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.censusClient.getDemographicData(year, geography, stateCode, countyCode);
            });
        }, "census-demographic");
    }
    /**
     * Get Census economic data
     */
    async getCensusEconomicData(year = 2022, geography = "us", stateCode, countyCode) {
        const cacheKey = `census:economic:${year}:${geography}:${stateCode || "all"}:${countyCode || "all"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.censusClient.getEconomicData(year, geography, stateCode, countyCode);
            });
        }, "census-economic");
    }
    /**
     * Get Census business patterns data
     */
    async getCensusBusinessPatterns(naicsCodes, year = 2021, geography = "us", stateCode) {
        const cacheKey = `census:business:${naicsCodes.join(",")}:${year}:${geography}:${stateCode || "all"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.censusClient.getBusinessPatterns(naicsCodes, year, geography, stateCode);
            });
        }, "census-business");
    }
    /**
     * Get Census population estimates
     */
    async getCensusPopulationEstimates(year = 2022, geography = "us", stateCode) {
        const cacheKey = `census:population:${year}:${geography}:${stateCode || "all"}`;
        return this.withCaching(cacheKey, async () => {
            return await this.retryOperation(async () => {
                return await this.censusClient.getPopulationEstimates(year, geography, stateCode);
            });
        }, "census-population");
    }
    // ==================== Data Quality & Monitoring ====================
    /**
     * Get data quality metrics for all feeds
     */
    getDataQualityMetrics() {
        const metrics = {};
        for (const [source, metric] of this.qualityMetrics.entries()) {
            metrics[source] = { ...metric };
        }
        return metrics;
    }
    /**
     * Clear expired cache entries
     */
    clearExpiredCache() {
        const now = Date.now();
        let cleared = 0;
        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expiresAt) {
                this.cache.delete(key);
                cleared++;
            }
        }
        logger.info("Cleared expired cache entries", { cleared });
        return cleared;
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const now = Date.now();
        const totalEntries = this.cache.size;
        let expiredEntries = 0;
        for (const cached of this.cache.values()) {
            if (now > cached.expiresAt) {
                expiredEntries++;
            }
        }
        return {
            totalEntries,
            expiredEntries,
            activeEntries: totalEntries - expiredEntries,
            hitRate: 0, // Would need to track hits/misses
        };
    }
    /**
     * Force refresh cache for specific key pattern
     */
    async refreshCache(pattern) {
        let refreshed = 0;
        for (const [key, cached] of this.cache.entries()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
                refreshed++;
            }
        }
        logger.info("Refreshed cache entries", { pattern, refreshed });
        return refreshed;
    }
    // ==================== Private Methods ====================
    async withCaching(cacheKey, fetchFn, source) {
        if (this.config.cacheEnabled) {
            const cached = this.cache.get(cacheKey);
            const now = Date.now();
            if (cached && now < cached.expiresAt) {
                logger.debug("Cache hit", { cacheKey, source });
                this.updateQualityMetrics(source, true);
                return cached.data;
            }
        }
        try {
            logger.debug("Fetching fresh data", { cacheKey, source });
            const data = await fetchFn();
            const quality = this.createQualityMetrics(source, Array.isArray(data) ? data.length : 1);
            if (this.config.cacheEnabled) {
                const cachedData = {
                    data,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + this.config.cacheTTLSeconds * 1000,
                    quality,
                };
                this.cache.set(cacheKey, cachedData);
            }
            this.updateQualityMetrics(source, true);
            return data;
        }
        catch (error) {
            logger.error("Data fetch failed", { cacheKey, source, error });
            this.updateQualityMetrics(source, false);
            // Try to return stale cache data if available
            if (this.config.enableFallbackToStatic) {
                const cached = this.cache.get(cacheKey);
                if (cached) {
                    logger.warn("Returning stale cache data due to fetch failure", { cacheKey, source });
                    return cached.data;
                }
            }
            throw error;
        }
    }
    async retryOperation(operation) {
        let lastError;
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                return await Promise.race([
                    operation(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), this.config.requestTimeoutMs)),
                ]);
            }
            catch (error) {
                lastError = error;
                logger.warn(`Operation attempt ${attempt} failed`, {
                    error,
                    attempt,
                    maxRetries: this.config.maxRetries,
                });
                if (attempt < this.config.maxRetries) {
                    // Exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }
        }
        throw lastError;
    }
    createQualityMetrics(source, dataPoints) {
        return {
            source,
            timestamp: new Date().toISOString(),
            dataPoints,
            errorRate: 0,
            averageResponseTime: 0,
            lastSuccessfulFetch: new Date().toISOString(),
            consecutiveFailures: 0,
        };
    }
    updateQualityMetrics(source, success) {
        let metrics = this.qualityMetrics.get(source);
        if (!metrics) {
            metrics = this.createQualityMetrics(source, 0);
        }
        if (success) {
            metrics.lastSuccessfulFetch = new Date().toISOString();
            metrics.consecutiveFailures = 0;
            // Update average response time (simplified)
            metrics.averageResponseTime =
                (metrics.averageResponseTime + Date.now() - Date.parse(metrics.timestamp)) / 2;
        }
        else {
            metrics.consecutiveFailures++;
            metrics.errorRate = Math.min(100, ((metrics.errorRate + 1) / (metrics.errorRate + metrics.consecutiveFailures)) * 100);
        }
        this.qualityMetrics.set(source, metrics);
    }
}
//# sourceMappingURL=LiveDataFeedService.js.map