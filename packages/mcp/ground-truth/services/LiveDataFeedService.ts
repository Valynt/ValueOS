/**
 * Live Data Feed Service
 *
 * Unified service for accessing live data from SEC, BLS, and Census APIs.
 * Provides caching, rate limiting, error handling, and data quality validation.
 */

import { logger } from "../lib/logger.js";
import { SECEdgarClient, SECFiling, SECCompanyInfo, SE CXBRLData } from "./clients/SECEdgarClient.js";
import { BLSClient, BLSWageData, BLSEmploymentData, BLSIndustryData } from "./clients/BLSClient";
import {
  CensusClient,
  CensusBusinessData,
  CensusDemographicData,
  CensusEconomicData,
} from "./clients/CensusClient";

export interface DataFeedConfig {
  secApiKey?: string;
  blsApiKey?: string;
  censusApiKey?: string;
  cacheEnabled: boolean;
  cacheTTLSeconds: number;
  maxRetries: number;
  requestTimeoutMs: number;
  enableFallbackToStatic: boolean;
}

export interface DataQualityMetrics {
  source: string;
  timestamp: string;
  dataPoints: number;
  errorRate: number;
  averageResponseTime: number;
  lastSuccessfulFetch: string;
  consecutiveFailures: number;
}

export interface CachedData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  quality: DataQualityMetrics;
}

export class LiveDataFeedService {
  private secClient: SECEdgarClient;
  private blsClient: BLSClient;
  private censusClient: CensusClient;

  private config: DataFeedConfig;
  private cache = new Map<string, CachedData<any>>();
  private qualityMetrics = new Map<string, DataQualityMetrics>();

  constructor(config: DataFeedConfig) {
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
  async getSECCompanyFilings(
    cik: string,
    formTypes: string[] = ["10-K", "10-Q"],
    count = 20
  ): Promise<SECFiling[]> {
    const cacheKey = `sec:filings:${cik}:${formTypes.join(",")}:${count}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.secClient.getCompanyFilings(
            cik,
            formTypes,
            undefined,
            undefined,
            count
          );
        });
      },
      "sec-filings"
    );
  }

  /**
   * Get SEC company information
   */
  async getSECCompanyInfo(cik: string): Promise<SECCompanyInfo> {
    const cacheKey = `sec:company:${cik}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.secClient.getCompanyInfo(cik);
        });
      },
      "sec-company"
    );
  }

  /**
   * Get XBRL financial data from SEC filings
   */
  async getSECXBRLData(accessionNumber: string, cik: string): Promise<SECXBRLData> {
    const cacheKey = `sec:xbrl:${accessionNumber}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.secClient.getXBRLData(accessionNumber, cik);
        });
      },
      "sec-xbrl"
    );
  }

  /**
   * Search SEC companies by name
   */
  async searchSECCompanies(
    companyName: string,
    limit = 10
  ): Promise<Array<{ cik: string; name: string }>> {
    const cacheKey = `sec:search:${companyName}:${limit}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.secClient.searchCompanies(companyName, limit);
        });
      },
      "sec-search"
    );
  }

  // ==================== BLS Data Feeds ====================

  /**
   * Get BLS wage data for occupations
   */
  async getBLSWageData(
    occupationCodes: string[],
    year?: number,
    quarter?: string
  ): Promise<BLSWageData[]> {
    const cacheKey = `bls:wage:${occupationCodes.join(",")}:${year || "latest"}:${quarter || "annual"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.blsClient.getWageData(occupationCodes, undefined, year, quarter);
        });
      },
      "bls-wage"
    );
  }

  /**
   * Get BLS employment data
   */
  async getBLSEmploymentData(
    seriesIds: string[],
    startYear: number,
    endYear: number
  ): Promise<BLSEmploymentData[]> {
    const cacheKey = `bls:employment:${seriesIds.join(",")}:${startYear}-${endYear}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.blsClient.getEmploymentData(seriesIds, startYear, endYear);
        });
      },
      "bls-employment"
    );
  }

  /**
   * Get BLS industry data
   */
  async getBLSIndustryData(
    naicsCodes: string[],
    year?: number,
    quarter?: string
  ): Promise<BLSIndustryData[]> {
    const cacheKey = `bls:industry:${naicsCodes.join(",")}:${year || "latest"}:${quarter || "annual"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.blsClient.getIndustryData(naicsCodes, year, quarter);
        });
      },
      "bls-industry"
    );
  }

  /**
   * Get BLS CPI data
   */
  async getBLSCPIData(startYear: number, endYear: number): Promise<BLSEmploymentData[]> {
    const cacheKey = `bls:cpi:${startYear}-${endYear}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.blsClient.getCPIData(undefined, undefined, startYear, endYear);
        });
      },
      "bls-cpi"
    );
  }

  // ==================== Census Data Feeds ====================

  /**
   * Get Census demographic data
   */
  async getCensusDemographicData(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string,
    countyCode?: string
  ): Promise<CensusDemographicData[]> {
    const cacheKey = `census:demographic:${year}:${geography}:${stateCode || "all"}:${countyCode || "all"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.censusClient.getDemographicData(year, geography, stateCode, countyCode);
        });
      },
      "census-demographic"
    );
  }

  /**
   * Get Census economic data
   */
  async getCensusEconomicData(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string,
    countyCode?: string
  ): Promise<CensusEconomicData[]> {
    const cacheKey = `census:economic:${year}:${geography}:${stateCode || "all"}:${countyCode || "all"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.censusClient.getEconomicData(year, geography, stateCode, countyCode);
        });
      },
      "census-economic"
    );
  }

  /**
   * Get Census business patterns data
   */
  async getCensusBusinessPatterns(
    naicsCodes: string[],
    year = 2021,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string
  ): Promise<CensusBusinessData[]> {
    const cacheKey = `census:business:${naicsCodes.join(",")}:${year}:${geography}:${stateCode || "all"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.censusClient.getBusinessPatterns(
            naicsCodes,
            year,
            geography,
            stateCode
          );
        });
      },
      "census-business"
    );
  }

  /**
   * Get Census population estimates
   */
  async getCensusPopulationEstimates(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string
  ): Promise<Array<{ geoid: string; name: string; population: number }>> {
    const cacheKey = `census:population:${year}:${geography}:${stateCode || "all"}`;

    return this.withCaching(
      cacheKey,
      async () => {
        return await this.retryOperation(async () => {
          return await this.censusClient.getPopulationEstimates(year, geography, stateCode);
        });
      },
      "census-population"
    );
  }

  // ==================== Data Quality & Monitoring ====================

  /**
   * Get data quality metrics for all feeds
   */
  getDataQualityMetrics(): Record<string, DataQualityMetrics> {
    const metrics: Record<string, DataQualityMetrics> = {};

    for (const [source, metric] of this.qualityMetrics.entries()) {
      metrics[source] = { ...metric };
    }

    return metrics;
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): number {
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
  getCacheStats(): {
    totalEntries: number;
    expiredEntries: number;
    activeEntries: number;
    hitRate: number;
  } {
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
  async refreshCache(pattern: string): Promise<number> {
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

  private async withCaching<T>(
    cacheKey: string,
    fetchFn: () => Promise<T>,
    source: string
  ): Promise<T> {
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
        const cachedData: CachedData<T> = {
          data,
          timestamp: Date.now(),
          expiresAt: Date.now() + this.config.cacheTTLSeconds * 1000,
          quality,
        };
        this.cache.set(cacheKey, cachedData);
      }

      this.updateQualityMetrics(source, true);
      return data;
    } catch (error) {
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

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), this.config.requestTimeoutMs)
          ),
        ]);
      } catch (error) {
        lastError = error as Error;
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

    throw lastError!;
  }

  private createQualityMetrics(source: string, dataPoints: number): DataQualityMetrics {
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

  private updateQualityMetrics(source: string, success: boolean): void {
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
    } else {
      metrics.consecutiveFailures++;
      metrics.errorRate = Math.min(
        100,
        ((metrics.errorRate + 1) / (metrics.errorRate + metrics.consecutiveFailures)) * 100
      );
    }

    this.qualityMetrics.set(source, metrics);
  }
}
