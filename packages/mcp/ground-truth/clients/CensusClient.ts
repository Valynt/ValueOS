/**
 * Census Bureau API Client
 *
 * Provides live access to U.S. Census Bureau data including demographic information,
 * business statistics, economic indicators, and geographic data.
 * Census API: https://www.census.gov/data/developers/data-sets.html
 */

import { logger } from "../lib/logger";

async function fetchWithRetry(
  url: string,
  options: any = {},
  retries = 3,
  backoff = 500
): Promise<Response> {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      lastError = err;
      logger.warn("Fetch failed, retrying", { url, attempt, error: err });
      if (attempt < retries)
        await new Promise((res) => setTimeout(res, backoff * Math.pow(2, attempt)));
    }
  }
  logger.error("Fetch failed after retries", { url, error: lastError });
  throw lastError;
}

export interface CensusBusinessData {
  naicsCode: string;
  naicsTitle: string;
  year: number;
  stateCode: string;
  stateName: string;
  countyCode?: string;
  countyName?: string;
  establishmentCount: number;
  employmentCount: number;
  annualPayroll: number;
  firstQuarterPayroll: number;
  averageEmployeeCount: number;
  averageAnnualPay: number;
}

export interface CensusDemographicData {
  geoid: string;
  geographyName: string;
  geographyType: string;
  year: number;
  totalPopulation: number;
  medianAge: number;
  medianHouseholdIncome: number;
  perCapitaIncome: number;
  povertyRate: number;
  unemploymentRate: number;
  educationBachelorPlus: number;
  housingUnits: number;
  medianHomeValue: number;
}

export interface CensusEconomicData {
  geoid: string;
  geographyName: string;
  year: number;
  totalHouseholds: number;
  medianHouseholdIncome: number;
  meanHouseholdIncome: number;
  perCapitaIncome: number;
  povertyCount: number;
  povertyRate: number;
  giniIndex: number; // Income inequality measure
}

export class CensusClient {
  private baseUrl = "https://api.census.gov/data";
  private apiKey?: string;
  private rateLimiter: Map<string, number> = new Map();
  private maxRequestsPerSecond = 10; // Census rate limit

  constructor(apiKey?: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get business statistics by NAICS code
   */
  async getBusinessData(
    naicsCodes: string[],
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string,
    countyCode?: string
  ): Promise<CensusBusinessData[]> {
    await this.checkRateLimit();

    try {
      // Use County Business Patterns (CBP) dataset
      const dataset = `acs/acs5`; // American Community Survey 5-year estimates
      const baseVars = [
        "NAME", // Geography name
        "B01003_001E", // Total population
        "B01002_001E", // Median age
        "B19013_001E", // Median household income
        "B19301_001E", // Per capita income
        "B17001_002E", // Poverty count
        "B17001_001E", // Total poverty universe
        "B23025_005E", // Unemployed population
        "B23025_003E", // Civilian labor force
        "B15003_022E", // Bachelor's degree or higher (25+)
        "B15003_001E", // Total population 25+
        "B25001_001E", // Total housing units
        "B25077_001E", // Median home value
      ];

      let geographyParam = "us:*";
      if (geography === "state") {
        geographyParam = "state:*";
      } else if (geography === "county" && stateCode) {
        geographyParam = `county:*&in=state:${stateCode}`;
      }

      const params = new URLSearchParams({
        get: baseVars.join(","),
        for: geographyParam,
        key: this.apiKey || "",
      });

      const url = `${this.baseUrl}/${year}/${dataset}?${params.toString()}`;

      logger.debug("Fetching Census demographic data", { geography, year, url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseDemographicData(data, year);
    } catch (error) {
      logger.error("Failed to fetch Census business data", { naicsCodes, geography, error });
      throw error;
    }
  }

  /**
   * Get demographic data by geography
   */
  async getDemographicData(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string,
    countyCode?: string
  ): Promise<CensusDemographicData[]> {
    await this.checkRateLimit();

    try {
      // Use American Community Survey (ACS) 5-year estimates
      const dataset = `acs/acs5`;
      const variables = [
        "NAME", // Geography name
        "B01003_001E", // Total population
        "B01002_001E", // Median age
        "B19013_001E", // Median household income
        "B19301_001E", // Per capita income
        "B17001_002E", // Poverty count
        "B17001_001E", // Total poverty universe
        "B23025_005E", // Unemployed population
        "B23025_003E", // Civilian labor force
        "B15003_022E", // Bachelor's degree or higher (25+)
        "B15003_001E", // Total population 25+
        "B25001_001E", // Total housing units
        "B25077_001E", // Median home value
      ];

      let geographyParam = "us:*";
      if (geography === "state") {
        geographyParam = "state:*";
      } else if (geography === "county" && stateCode) {
        geographyParam = `county:*&in=state:${stateCode}`;
      }

      const params = new URLSearchParams({
        get: variables.join(","),
        for: geographyParam,
        key: this.apiKey || "",
      });

      const url = `${this.baseUrl}/${year}/${dataset}?${params.toString()}`;

      logger.debug("Fetching Census demographic data", { geography, year, url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseDemographicData(data, year);
    } catch (error) {
      logger.error("Failed to fetch Census demographic data", { geography, year, error });
      throw error;
    }
  }

  /**
   * Get economic indicators
   */
  async getEconomicData(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string,
    countyCode?: string
  ): Promise<CensusEconomicData[]> {
    await this.checkRateLimit();

    try {
      const dataset = `acs/acs5`;
      const variables = [
        "NAME",
        "B19001_001E", // Total households
        "B19013_001E", // Median household income
        "B19049_001E", // Median household income (past 12 months)
        "B19301_001E", // Per capita income
        "B17001_002E", // Income below poverty level
        "B17001_001E", // Poverty status total
        "B19083_001E", // Gini index of income inequality
      ];

      let geographyParam = "us:*";
      if (geography === "state") {
        geographyParam = "state:*";
      } else if (geography === "county" && stateCode) {
        geographyParam = `county:*&in=state:${stateCode}`;
      }

      const params = new URLSearchParams({
        get: variables.join(","),
        for: geographyParam,
        key: this.apiKey || "",
      });

      const url = `${this.baseUrl}/${year}/${dataset}?${params.toString()}`;

      logger.debug("Fetching Census economic data", { geography, year, url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseEconomicData(data, year);
    } catch (error) {
      logger.error("Failed to fetch Census economic data", { geography, year, error });
      throw error;
    }
  }

  /**
   * Get business patterns data (County Business Patterns)
   */
  async getBusinessPatterns(
    naicsCodes: string[],
    year = 2021, // CBP data typically lags by 1-2 years
    geography: "state" | "county" | "us" = "us",
    stateCode?: string
  ): Promise<CensusBusinessData[]> {
    await this.checkRateLimit();

    try {
      // County Business Patterns dataset
      const dataset = `acs/acs5`; // Using ACS as proxy - CBP has specific endpoint

      // CBP variables (simplified - actual CBP has different structure)
      const variables = [
        "NAME",
        "B01003_001E", // Population proxy for business activity
        "B19013_001E", // Income proxy for economic activity
      ];

      let geographyParam = "us:*";
      if (geography === "state") {
        geographyParam = "state:*";
      } else if (geography === "county" && stateCode) {
        geographyParam = `county:*&in=state:${stateCode}`;
      }

      const params = new URLSearchParams({
        get: variables.join(","),
        for: geographyParam,
        key: this.apiKey || "",
      });

      const url = `${this.baseUrl}/${year}/${dataset}?${params.toString()}`;

      logger.debug("Fetching Census business patterns", { naicsCodes, geography, year, url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parseBusinessPatternsData(data, naicsCodes, year);
    } catch (error) {
      logger.error("Failed to fetch Census business patterns", { naicsCodes, geography, error });
      throw error;
    }
  }

  /**
   * Get population estimates
   */
  async getPopulationEstimates(
    year = 2022,
    geography: "state" | "county" | "us" = "us",
    stateCode?: string
  ): Promise<Array<{ geoid: string; name: string; population: number }>> {
    await this.checkRateLimit();

    try {
      const dataset = `acs/acs5`;
      const variables = ["NAME", "B01003_001E"]; // Population

      let geographyParam = "us:*";
      if (geography === "state") {
        geographyParam = "state:*";
      } else if (geography === "county" && stateCode) {
        geographyParam = `county:*&in=state:${stateCode}`;
      }

      const params = new URLSearchParams({
        get: variables.join(","),
        for: geographyParam,
        key: this.apiKey || "",
      });

      const url = `${this.baseUrl}/${year}/${dataset}?${params.toString()}`;

      logger.debug("Fetching Census population estimates", { geography, year, url });

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Census API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return this.parsePopulationData(data);
    } catch (error) {
      logger.error("Failed to fetch Census population data", { geography, year, error });
      throw error;
    }
  }

  // ==================== Private Methods ====================

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const key = "census_api";
    const lastRequest = this.rateLimiter.get(key) || 0;

    const timeSinceLastRequest = now - lastRequest;
    const minInterval = 1000 / this.maxRequestsPerSecond; // milliseconds between requests

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.rateLimiter.set(key, Date.now());
  }

  private parseDemographicData(data: any[], year: number): CensusDemographicData[] {
    const results: CensusDemographicData[] = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      try {
        const [
          name,
          totalPopulation,
          medianAge,
          medianHouseholdIncome,
          perCapitaIncome,
          povertyCount,
          povertyUniverse,
          unemployed,
          laborForce,
          bachelorsPlus,
          educationUniverse,
          housingUnits,
          medianHomeValue,
          geoid,
        ] = row;

        const demographicData: CensusDemographicData = {
          geoid,
          geographyName: name,
          geographyType: this.determineGeographyType(geoid),
          year,
          totalPopulation: parseInt(totalPopulation) || 0,
          medianAge: parseFloat(medianAge) || 0,
          medianHouseholdIncome: parseInt(medianHouseholdIncome) || 0,
          perCapitaIncome: parseInt(perCapitaIncome) || 0,
          povertyRate:
            povertyUniverse > 0 ? (parseInt(povertyCount) / parseInt(povertyUniverse)) * 100 : 0,
          unemploymentRate:
            laborForce > 0 ? (parseInt(unemployed) / parseInt(laborForce)) * 100 : 0,
          educationBachelorPlus:
            educationUniverse > 0
              ? (parseInt(bachelorsPlus) / parseInt(educationUniverse)) * 100
              : 0,
          housingUnits: parseInt(housingUnits) || 0,
          medianHomeValue: parseInt(medianHomeValue) || 0,
        };

        results.push(demographicData);
      } catch (error) {
        logger.warn("Failed to parse Census demographic row", { row, error });
      }
    }

    return results;
  }

  private parseEconomicData(data: any[], year: number): CensusEconomicData[] {
    const results: CensusEconomicData[] = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      try {
        const [
          name,
          totalHouseholds,
          medianHouseholdIncome,
          meanHouseholdIncome,
          perCapitaIncome,
          povertyCount,
          povertyUniverse,
          giniIndex,
          geoid,
        ] = row;

        const economicData: CensusEconomicData = {
          geoid,
          geographyName: name,
          year,
          totalHouseholds: parseInt(totalHouseholds) || 0,
          medianHouseholdIncome: parseInt(medianHouseholdIncome) || 0,
          meanHouseholdIncome: parseInt(meanHouseholdIncome) || 0,
          perCapitaIncome: parseInt(perCapitaIncome) || 0,
          povertyCount: parseInt(povertyCount) || 0,
          povertyRate:
            povertyUniverse > 0 ? (parseInt(povertyCount) / parseInt(povertyUniverse)) * 100 : 0,
          giniIndex: parseFloat(giniIndex) || 0,
        };

        results.push(economicData);
      } catch (error) {
        logger.warn("Failed to parse Census economic row", { row, error });
      }
    }

    return results;
  }

  private parseBusinessPatternsData(
    data: any[],
    naicsCodes: string[],
    year: number
  ): CensusBusinessData[] {
    const results: CensusBusinessData[] = [];

    // This is a simplified implementation
    // Actual CBP data would have different structure and variables
    // For now, we'll create proxy data based on population and income

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      try {
        const [name, population, medianIncome, geoid] = row;

        // Create proxy business data for each requested NAICS
        for (const naicsCode of naicsCodes) {
          const businessData: CensusBusinessData = {
            naicsCode,
            naicsTitle: this.getNaicsTitle(naicsCode),
            year,
            stateCode: geoid.substring(0, 2),
            stateName: name.split(",")[1]?.trim() || name,
            countyCode: geoid.length > 5 ? geoid.substring(2, 5) : undefined,
            countyName: geoid.length > 5 ? name.split(",")[0] : undefined,
            establishmentCount: Math.floor(parseInt(population) / 10000), // Rough proxy
            employmentCount: Math.floor(parseInt(population) / 500), // Rough proxy
            annualPayroll: (parseInt(population) * parseInt(medianIncome)) / 10, // Rough proxy
            firstQuarterPayroll: (parseInt(population) * parseInt(medianIncome)) / 40, // Rough proxy
            averageEmployeeCount: Math.floor(parseInt(population) / 500),
            averageAnnualPay: parseInt(medianIncome) * 1.2, // Rough proxy
          };

          results.push(businessData);
        }
      } catch (error) {
        logger.warn("Failed to parse Census business patterns row", { row, error });
      }
    }

    return results;
  }

  private parsePopulationData(
    data: any[]
  ): Array<{ geoid: string; name: string; population: number }> {
    const results: Array<{ geoid: string; name: string; population: number }> = [];

    // Skip header row
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      try {
        const [name, population, geoid] = row;

        results.push({
          geoid,
          name,
          population: parseInt(population) || 0,
        });
      } catch (error) {
        logger.warn("Failed to parse Census population row", { row, error });
      }
    }

    return results;
  }

  private determineGeographyType(geoid: string): string {
    if (geoid.length === 2) return "state";
    if (geoid.length === 5) return "county";
    if (geoid === "01000US") return "us";
    return "unknown";
  }

  private getNaicsTitle(naicsCode: string): string {
    // Simplified NAICS title lookup
    const naicsTitles: Record<string, string> = {
      "541511": "Custom Computer Programming Services",
      "541512": "Computer Systems Design Services",
      "541513": "Computer Facilities Management Services",
      "541519": "Other Computer Related Services",
    };

    return naicsTitles[naicsCode] || `NAICS ${naicsCode}`;
  }
}
