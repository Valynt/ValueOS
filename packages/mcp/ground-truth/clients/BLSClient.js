/**
 * BLS API Client
 *
 * Provides live access to Bureau of Labor Statistics data including wage information,
 * employment statistics, and economic indicators.
 * BLS API: https://www.bls.gov/developers/
 */
import { logger } from "../../lib/logger";

import { fetchWithRetry } from "./utils/fetchWithRetry";
export class BLSClient {
    baseUrl = "https://api.bls.gov/publicAPI/v2/timeseries/data";
    apiKey;
    rateLimiter = new Map();
    maxRequestsPerDay = 500; // BLS daily limit for registered users
    requestCount = 0;
    lastResetDate = new Date().toDateString();
    constructor(apiKey) {
        this.apiKey = apiKey;
    }
    /**
     * Get wage data for occupations
     */
    async getWageData(occupationCodes, areaCode = "00000", // National
    year, quarter) {
        await this.checkRateLimit();
        try {
            // Build series IDs for OEWS (Occupational Employment and Wage Statistics)
            const seriesIds = occupationCodes.map((code) => {
                const oesCode = code.replace("-", ""); // Remove hyphen for OEWS format
                return `OEUM${oesCode}000000`; // National level
            });
            const params = {
                seriesid: seriesIds,
                startyear: year?.toString() || (new Date().getFullYear() - 1).toString(),
                endyear: year?.toString() || new Date().getFullYear().toString(),
                catalog: true,
                calculations: true,
                annualaverage: true,
                aspects: true,
            };
            if (this.apiKey) {
                params.registrationkey = this.apiKey;
            }
            logger.debug("Fetching BLS wage data", { occupationCodes, areaCode, params });
            const response = await fetchWithRetry(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                throw new Error(`BLS API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseWageData(data, occupationCodes);
        }
        catch (error) {
            logger.error("Failed to fetch BLS wage data", { occupationCodes, error });
            throw error;
        }
    }
    /**
     * Get employment data for series
     */
    async getEmploymentData(seriesIds, startYear, endYear) {
        await this.checkRateLimit();
        try {
            const params = {
                seriesid: seriesIds,
                startyear: startYear.toString(),
                endyear: endYear.toString(),
                catalog: true,
                calculations: true,
                annualaverage: true,
            };
            if (this.apiKey) {
                params.registrationkey = this.apiKey;
            }
            logger.debug("Fetching BLS employment data", { seriesIds, startYear, endYear });
            const response = await fetchWithRetry(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                throw new Error(`BLS API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseEmploymentData(data);
        }
        catch (error) {
            logger.error("Failed to fetch BLS employment data", { seriesIds, error });
            throw error;
        }
    }
    /**
     * Get industry employment data
     */
    async getIndustryData(naicsCodes, year, quarter) {
        await this.checkRateLimit();
        try {
            // Build series IDs for QCEW (Quarterly Census of Employment and Wages)
            const seriesIds = naicsCodes.flatMap((naics) => [
                `ENU${naics}0000005`, // Employment
                `ENU${naics}0000006`, // Average weekly hours
                `ENU${naics}0000007`, // Average hourly earnings
                `ENU${naics}0000008`, // Average weekly earnings
            ]);
            const params = {
                seriesid: seriesIds,
                startyear: year?.toString() || (new Date().getFullYear() - 1).toString(),
                endyear: year?.toString() || new Date().getFullYear().toString(),
                catalog: true,
                calculations: true,
                annualaverage: true,
            };
            if (quarter) {
                params.quarter = quarter;
            }
            if (this.apiKey) {
                params.registrationkey = this.apiKey;
            }
            logger.debug("Fetching BLS industry data", { naicsCodes, year, quarter });
            const response = await fetchWithRetry(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                throw new Error(`BLS API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseIndustryData(data, naicsCodes);
        }
        catch (error) {
            logger.error("Failed to fetch BLS industry data", { naicsCodes, error });
            throw error;
        }
    }
    /**
     * Get CPI (Consumer Price Index) data
     */
    async getCPIData(areaCode = "0000", // U.S. city average
    itemCode = "SA0", // All items
    startYear, endYear) {
        await this.checkRateLimit();
        try {
            const seriesId = `CUUR${areaCode}${itemCode}L`; // Current CPI-U
            const seriesIds = [seriesId];
            const params = {
                seriesid: seriesIds,
                startyear: startYear.toString(),
                endyear: endYear.toString(),
                catalog: true,
                calculations: true,
            };
            if (this.apiKey) {
                params.registrationkey = this.apiKey;
            }
            logger.debug("Fetching BLS CPI data", { areaCode, itemCode, startYear, endYear });
            const response = await fetchWithRetry(this.baseUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                throw new Error(`BLS API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return this.parseEmploymentData(data);
        }
        catch (error) {
            logger.error("Failed to fetch BLS CPI data", { areaCode, itemCode, error });
            throw error;
        }
    }
    // ==================== Private Methods ====================
    async checkRateLimit() {
        const today = new Date().toDateString();
        // Reset counter daily
        if (today !== this.lastResetDate) {
            this.requestCount = 0;
            this.lastResetDate = today;
        }
        if (this.requestCount >= this.maxRequestsPerDay) {
            throw new Error("BLS API daily rate limit exceeded");
        }
        this.requestCount++;
        // Basic throttling for non-registered users
        if (!this.apiKey) {
            await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 request per second
        }
    }
    parseWageData(apiResponse, requestedCodes) {
        const wageData = [];
        if (!apiResponse.Results || !apiResponse.Results.series) {
            return wageData;
        }
        for (const series of apiResponse.Results.series) {
            try {
                const seriesId = series.seriesID;
                const occupationCode = this.extractOccupationCode(seriesId);
                // Only process requested occupation codes
                if (!requestedCodes.includes(occupationCode))
                    continue;
                // Get the most recent data point
                const dataPoints = series.data || [];
                if (dataPoints.length === 0)
                    continue;
                const latestData = dataPoints[0]; // BLS returns data in descending order
                const wageEntry = {
                    occupationCode,
                    occupationTitle: series.catalog?.occupation_title || "",
                    areaCode: series.catalog?.area_code || "",
                    areaTitle: series.catalog?.area_title || "",
                    year: parseInt(latestData.year),
                    quarter: latestData.periodName === "Annual" ? undefined : latestData.periodName,
                    meanWage: parseFloat(latestData.value) || 0,
                    medianWage: this.extractPercentile(latestData, "50th"),
                    percentile10: this.extractPercentile(latestData, "10th"),
                    percentile25: this.extractPercentile(latestData, "25th"),
                    percentile75: this.extractPercentile(latestData, "75th"),
                    percentile90: this.extractPercentile(latestData, "90th"),
                    employmentCount: this.extractEmploymentCount(latestData),
                    employmentPercentRelativeStandardError: parseFloat(latestData.employment_RSE) || 0,
                    meanWagePercentRelativeStandardError: parseFloat(latestData.mean_RSE) || 0,
                    medianWagePercentRelativeStandardError: parseFloat(latestData.median_RSE) || 0,
                };
                wageData.push(wageEntry);
            }
            catch (error) {
                logger.warn("Failed to parse BLS wage data series", { seriesId: series.seriesID, error });
            }
        }
        return wageData;
    }
    parseEmploymentData(apiResponse) {
        const employmentData = [];
        if (!apiResponse.Results || !apiResponse.Results.series) {
            return employmentData;
        }
        for (const series of apiResponse.Results.series) {
            const seriesId = series.seriesID;
            for (const dataPoint of series.data || []) {
                employmentData.push({
                    seriesId,
                    year: parseInt(dataPoint.year),
                    period: dataPoint.period,
                    periodName: dataPoint.periodName,
                    value: dataPoint.value,
                    footnotes: dataPoint.footnotes || [],
                });
            }
        }
        return employmentData;
    }
    parseIndustryData(apiResponse, requestedNaics) {
        const industryData = [];
        if (!apiResponse.Results || !apiResponse.Results.series) {
            return industryData;
        }
        // Group data by NAICS code
        const naicsGroups = {};
        for (const series of apiResponse.Results.series) {
            const naicsCode = this.extractNaicsCode(series.seriesID);
            if (!requestedNaics.includes(naicsCode))
                continue;
            if (!naicsGroups[naicsCode]) {
                naicsGroups[naicsCode] = [];
            }
            naicsGroups[naicsCode].push(series);
        }
        // Process each NAICS group
        for (const [naicsCode, seriesList] of Object.entries(naicsGroups)) {
            try {
                const employmentSeries = seriesList.find((s) => s.seriesID.endsWith("0000005"));
                const hoursSeries = seriesList.find((s) => s.seriesID.endsWith("0000006"));
                const hourlyEarningsSeries = seriesList.find((s) => s.seriesID.endsWith("0000007"));
                const weeklyEarningsSeries = seriesList.find((s) => s.seriesID.endsWith("0000008"));
                if (!employmentSeries?.data?.[0])
                    continue;
                const latestData = employmentSeries.data[0];
                const latestYear = parseInt(latestData.year);
                const industryEntry = {
                    naicsCode,
                    industryTitle: employmentSeries.catalog?.industry_title || "",
                    year: latestYear,
                    quarter: latestData.periodName === "Annual" ? undefined : latestData.periodName,
                    employmentCount: parseFloat(employmentSeries.data[0]?.value) || 0,
                    averageWeeklyHours: parseFloat(hoursSeries?.data[0]?.value) || 0,
                    averageHourlyEarnings: parseFloat(hourlyEarningsSeries?.data[0]?.value) || 0,
                    averageWeeklyEarnings: parseFloat(weeklyEarningsSeries?.data[0]?.value) || 0,
                    employmentPercentRelativeStandardError: parseFloat(employmentSeries.data[0]?.RSE) || 0,
                    hoursPercentRelativeStandardError: parseFloat(hoursSeries?.data[0]?.RSE) || 0,
                    earningsPercentRelativeStandardError: parseFloat(hourlyEarningsSeries?.data[0]?.RSE) || 0,
                };
                industryData.push(industryEntry);
            }
            catch (error) {
                logger.warn("Failed to parse BLS industry data", { naicsCode, error });
            }
        }
        return industryData;
    }
    extractOccupationCode(seriesId) {
        // OEUM001234000000 -> 00-1234
        const code = seriesId.substring(4, 10);
        return `${code.substring(0, 2)}-${code.substring(2)}`;
    }
    extractNaicsCode(seriesId) {
        // ENU1234560000005 -> 123456
        return seriesId.substring(3, 9);
    }
    extractPercentile(dataPoint, percentile) {
        const percentileData = dataPoint.percentiles?.find((p) => p.percentile === percentile);
        return parseFloat(percentileData?.value) || 0;
    }
    extractEmploymentCount(dataPoint) {
        return parseFloat(dataPoint.employment) || 0;
    }
}
//# sourceMappingURL=BLSClient.js.map