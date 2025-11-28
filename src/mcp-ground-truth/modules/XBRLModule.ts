/**
 * XBRL Parser Module - Tier 1 Structured Financial Data
 * 
 * Provides deterministic access to XBRL-tagged financial data from SEC filings.
 * XBRL (eXtensible Business Reporting Language) is the standardized format for
 * financial reporting, ensuring consistent, machine-readable data.
 * 
 * Security: IL4 (Impact Level 4 - Controlled Unclassified Information)
 * Standard: XBRL US GAAP Taxonomy
 */

import { BaseModule } from '../core/BaseModule';
import {
  ModuleRequest,
  ModuleResponse,
  FinancialMetric,
  XBRLFactRequest,
  XBRLFact,
  XBRLTrendData,
  GroundTruthError,
  ErrorCodes,
} from '../types';
import { logger } from '../../lib/logger';

interface XBRLConfig {
  userAgent: string;
  baseUrl: string;
  rateLimit: number;
  companyfactsCache: boolean;
}

/**
 * XBRL Module - Tier 1 Structured Data Source
 * 
 * Implements MCP tool: get_authoritative_financials (structured variant)
 * Node Mapping: [NODE: XBRL_Parser], [NODE: Tier_1_Canonical]
 * 
 * Uses SEC's XBRL API for standardized financial facts:
 * https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json
 */
export class XBRLModule extends BaseModule {
  name = 'xbrl-parser';
  tier = 'tier1' as const;
  description = 'XBRL structured financial data parser - Tier 1 authoritative source';

  private userAgent: string = '';
  private baseUrl: string = 'https://data.sec.gov/api/xbrl';
  private rateLimit: number = 10;
  private lastRequestTime: number = 0;
  private factsCache: Map<string, any> = new Map();

  // Standard XBRL US GAAP taxonomy mappings
  private readonly GAAP_MAPPINGS: Record<string, string> = {
    revenue_total: 'Revenues',
    revenue: 'RevenueFromContractWithCustomerExcludingAssessedTax',
    gross_profit: 'GrossProfit',
    operating_income: 'OperatingIncomeLoss',
    net_income: 'NetIncomeLoss',
    eps_diluted: 'EarningsPerShareDiluted',
    eps_basic: 'EarningsPerShareBasic',
    cash_and_equivalents: 'CashAndCashEquivalentsAtCarryingValue',
    total_assets: 'Assets',
    total_liabilities: 'Liabilities',
    total_debt: 'LongTermDebtAndCapitalLeaseObligations',
    stockholders_equity: 'StockholdersEquity',
    operating_expenses: 'OperatingExpenses',
    research_development: 'ResearchAndDevelopmentExpense',
    sales_marketing: 'SellingAndMarketingExpense',
    cost_of_revenue: 'CostOfRevenue',
  };

  async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);
    
    const xbrlConfig = config as XBRLConfig;
    this.userAgent = xbrlConfig.userAgent || 'ValueCanvas contact@valuecanvas.com';
    this.baseUrl = xbrlConfig.baseUrl || this.baseUrl;
    this.rateLimit = xbrlConfig.rateLimit || this.rateLimit;

    logger.info('XBRL Module initialized', {
      baseUrl: this.baseUrl,
      rateLimit: this.rateLimit,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle CIK lookups with metric specifications
    return !!(
      request.identifier &&
      request.identifier.match(/^\d{10}$/) && // CIK format
      request.metric
    );
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      this.validateRequest(request, ['identifier', 'metric']);

      const { identifier: cik, metric, period, options } = request;

      // Get company facts
      const facts = await this.getCompanyFacts(cik);

      // Map metric name to XBRL tag
      const xbrlTag = this.GAAP_MAPPINGS[metric] || metric;

      // Extract specific fact
      const fact = this.extractFact(facts, xbrlTag, period);

      if (!fact) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `XBRL fact not found: ${metric} for CIK ${cik} in period ${period || 'latest'}`
        );
      }

      return this.createMetric(
        metric,
        fact.value,
        {
          source_type: 'xbrl',
          source_url: `${this.baseUrl}/companyfacts/CIK${cik}.json`,
          filing_type: fact.form || 'XBRL',
          period: fact.period,
          extraction_method: 'xbrl-parse',
        },
        {
          tag: fact.tag,
          label: fact.label,
          unit: fact.unit,
          frame: fact.frame,
          taxonomy: fact.taxonomy,
          accession_number: fact.accn,
        },
        JSON.stringify(fact)
      );
    });
  }

  /**
   * Get all XBRL facts for a company
   * 
   * Uses SEC's companyfacts API endpoint
   * Caches results to minimize API calls
   */
  private async getCompanyFacts(cik: string): Promise<any> {
    // Check cache first
    if (this.factsCache.has(cik)) {
      logger.debug('XBRL facts cache hit', { cik });
      return this.factsCache.get(cik);
    }

    await this.enforceRateLimit();

    const paddedCIK = cik.padStart(10, '0');
    const url = `${this.baseUrl}/companyfacts/CIK${paddedCIK}.json`;

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new GroundTruthError(
            ErrorCodes.NO_DATA_FOUND,
            `No XBRL data found for CIK ${cik}`
          );
        }
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `SEC XBRL API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();

      // Cache the results
      this.factsCache.set(cik, data);

      logger.info('XBRL facts retrieved', {
        cik: paddedCIK,
        entityName: data.entityName,
        factsCount: Object.keys(data.facts || {}).length,
      });

      return data;
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch XBRL data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract specific fact from company facts data
   * 
   * Handles multiple taxonomies (us-gaap, dei, etc.) and periods
   */
  private extractFact(
    factsData: any,
    tag: string,
    period?: string
  ): XBRLFact | null {
    const facts = factsData.facts;
    if (!facts) {
      return null;
    }

    // Search in us-gaap taxonomy first (most common)
    const taxonomies = ['us-gaap', 'dei', 'ifrs-full'];
    
    for (const taxonomy of taxonomies) {
      if (!facts[taxonomy] || !facts[taxonomy][tag]) {
        continue;
      }

      const tagData = facts[taxonomy][tag];
      const units = tagData.units;

      if (!units) {
        continue;
      }

      // Get the appropriate unit (USD for monetary values, shares for counts, etc.)
      const unitKeys = Object.keys(units);
      const preferredUnits = ['USD', 'shares', 'pure'];
      
      let selectedUnit = unitKeys[0];
      for (const preferred of preferredUnits) {
        if (unitKeys.includes(preferred)) {
          selectedUnit = preferred;
          break;
        }
      }

      const unitData = units[selectedUnit];
      if (!unitData || unitData.length === 0) {
        continue;
      }

      // Filter by period if specified
      let filteredData = unitData;
      if (period) {
        filteredData = unitData.filter((item: any) => {
          return item.fy?.toString() === period || 
                 item.fp === period ||
                 item.frame === period;
        });
      }

      if (filteredData.length === 0) {
        continue;
      }

      // Get most recent fact
      const sortedData = filteredData.sort((a: any, b: any) => {
        return new Date(b.filed).getTime() - new Date(a.filed).getTime();
      });

      const mostRecent = sortedData[0];

      return {
        tag,
        label: tagData.label || tag,
        value: mostRecent.val,
        unit: selectedUnit,
        period: mostRecent.fy ? `FY${mostRecent.fy}` : mostRecent.frame || 'Unknown',
        frame: mostRecent.frame,
        taxonomy,
        form: mostRecent.form,
        filed: mostRecent.filed,
        accn: mostRecent.accn,
        start: mostRecent.start,
        end: mostRecent.end,
      };
    }

    return null;
  }

  /**
   * Get trend data for a specific metric over multiple periods
   * 
   * Implements time-series analysis for financial metrics
   */
  async getTrend(
    cik: string,
    metric: string,
    periods?: number
  ): Promise<XBRLTrendData> {
    const facts = await this.getCompanyFacts(cik);
    const xbrlTag = this.GAAP_MAPPINGS[metric] || metric;

    const trendData: XBRLTrendData = {
      metric,
      periods: [],
      values: [],
    };

    // Extract all available periods for this metric
    const taxonomies = ['us-gaap', 'dei', 'ifrs-full'];
    
    for (const taxonomy of taxonomies) {
      if (!facts.facts[taxonomy] || !facts.facts[taxonomy][xbrlTag]) {
        continue;
      }

      const tagData = facts.facts[taxonomy][xbrlTag];
      const units = tagData.units;

      if (!units) {
        continue;
      }

      // Get USD unit data (most common for financial metrics)
      const unitData = units.USD || units[Object.keys(units)[0]];
      if (!unitData) {
        continue;
      }

      trendData.unit = Object.keys(units)[0];

      // Sort by filing date
      const sortedData = unitData
        .filter((item: any) => item.val !== null && item.val !== undefined)
        .sort((a: any, b: any) => {
          return new Date(a.filed).getTime() - new Date(b.filed).getTime();
        });

      // Limit to requested number of periods
      const limitedData = periods 
        ? sortedData.slice(-periods) 
        : sortedData;

      for (const item of limitedData) {
        const periodLabel = item.fy 
          ? `FY${item.fy}${item.fp ? `-${item.fp}` : ''}`
          : item.frame || 'Unknown';
        
        trendData.periods.push(periodLabel);
        trendData.values.push(item.val);
      }

      break; // Use first taxonomy that has data
    }

    if (trendData.periods.length === 0) {
      throw new GroundTruthError(
        ErrorCodes.NO_DATA_FOUND,
        `No trend data found for metric ${metric}`
      );
    }

    logger.info('XBRL trend data extracted', {
      cik,
      metric,
      periodsCount: trendData.periods.length,
    });

    return trendData;
  }

  /**
   * Get multiple facts at once for efficiency
   * 
   * Batch retrieval for multiple metrics
   */
  async getMultipleFacts(
    cik: string,
    metrics: string[],
    period?: string
  ): Promise<FinancialMetric[]> {
    const facts = await this.getCompanyFacts(cik);
    const results: FinancialMetric[] = [];

    for (const metric of metrics) {
      const xbrlTag = this.GAAP_MAPPINGS[metric] || metric;
      const fact = this.extractFact(facts, xbrlTag, period);

      if (fact) {
        const financialMetric = this.createMetric(
          metric,
          fact.value,
          {
            source_type: 'xbrl',
            source_url: `${this.baseUrl}/companyfacts/CIK${cik}.json`,
            filing_type: fact.form || 'XBRL',
            period: fact.period,
            extraction_method: 'xbrl-parse',
          },
          {
            tag: fact.tag,
            label: fact.label,
            unit: fact.unit,
            frame: fact.frame,
            taxonomy: fact.taxonomy,
            accession_number: fact.accn,
          },
          JSON.stringify(fact)
        );
        results.push(financialMetric);
      }
    }

    return results;
  }

  /**
   * Calculate financial ratios from XBRL data
   * 
   * Derives common financial ratios from base metrics
   */
  async calculateRatios(
    cik: string,
    period?: string
  ): Promise<Record<string, number>> {
    const metrics = await this.getMultipleFacts(
      cik,
      ['revenue_total', 'gross_profit', 'operating_income', 'net_income', 'total_assets', 'stockholders_equity'],
      period
    );

    const metricMap = new Map(metrics.map(m => [m.metric_name, m.value as number]));

    const ratios: Record<string, number> = {};

    // Gross margin
    const revenue = metricMap.get('revenue_total');
    const grossProfit = metricMap.get('gross_profit');
    if (revenue && grossProfit && revenue > 0) {
      ratios.gross_margin = (grossProfit / revenue) * 100;
    }

    // Operating margin
    const operatingIncome = metricMap.get('operating_income');
    if (revenue && operatingIncome && revenue > 0) {
      ratios.operating_margin = (operatingIncome / revenue) * 100;
    }

    // Net margin
    const netIncome = metricMap.get('net_income');
    if (revenue && netIncome && revenue > 0) {
      ratios.net_margin = (netIncome / revenue) * 100;
    }

    // ROA (Return on Assets)
    const totalAssets = metricMap.get('total_assets');
    if (netIncome && totalAssets && totalAssets > 0) {
      ratios.roa = (netIncome / totalAssets) * 100;
    }

    // ROE (Return on Equity)
    const equity = metricMap.get('stockholders_equity');
    if (netIncome && equity && equity > 0) {
      ratios.roe = (netIncome / equity) * 100;
    }

    return ratios;
  }

  /**
   * Enforce SEC rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.rateLimit;
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Clear facts cache
   */
  clearCache(): void {
    this.factsCache.clear();
    logger.info('XBRL facts cache cleared');
  }
}
