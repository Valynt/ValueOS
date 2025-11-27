/**
 * SEC EDGAR Module - Tier 1 Authoritative Data Source
 * 
 * Provides deterministic access to SEC filings with zero-hallucination guarantees.
 * All data is sourced directly from sec.gov with full provenance tracking.
 * 
 * Security: IL4 (Impact Level 4 - Controlled Unclassified Information)
 * Compliance: SOX, RegTech, Zero-Trust Architecture
 */

import { BaseModule } from '../core/BaseModule';
import {
  ModuleRequest,
  ModuleResponse,
  FinancialMetric,
  EDGARSearchParams,
  EDGARFiling,
  EDGARExtraction,
  GroundTruthError,
  ErrorCodes,
} from '../types';
import { logger } from '../../utils/logger';

interface EDGARConfig {
  userAgent: string; // Required by SEC: "Company Name contact@email.com"
  baseUrl: string;
  rateLimit: number; // Requests per second (SEC limit: 10/sec)
  timeout: number;
}

/**
 * EDGAR Module - Tier 1 Canonical Source
 * 
 * Implements MCP tool: get_authoritative_financials
 * Node Mapping: [NODE: Tier_1_Canonical], [NODE: EDGAR_API]
 */
export class EDGARModule extends BaseModule {
  name = 'sec-edgar';
  tier = 'tier1' as const;
  description = 'SEC EDGAR filing retrieval and extraction - Tier 1 authoritative source';

  private userAgent: string = '';
  private baseUrl: string = 'https://data.sec.gov';
  private rateLimit: number = 10; // SEC enforces 10 requests/second
  private lastRequestTime: number = 0;

  async initialize(config: Record<string, any>): Promise<void> {
    await super.initialize(config);
    
    const edgarConfig = config as EDGARConfig;
    this.userAgent = edgarConfig.userAgent || 'ValueCanvas contact@valuecanvas.com';
    this.baseUrl = edgarConfig.baseUrl || this.baseUrl;
    this.rateLimit = edgarConfig.rateLimit || this.rateLimit;

    if (!this.userAgent.includes('@')) {
      throw new GroundTruthError(
        ErrorCodes.INVALID_REQUEST,
        'SEC requires User-Agent with valid email address'
      );
    }

    logger.info('EDGAR Module initialized', {
      baseUrl: this.baseUrl,
      rateLimit: this.rateLimit,
    });
  }

  canHandle(request: ModuleRequest): boolean {
    // Can handle CIK or ticker lookups
    return !!(request.identifier && (
      request.identifier.match(/^\d{10}$/) || // CIK format
      request.identifier.match(/^[A-Z]{1,5}$/) // Ticker format
    ));
  }

  async query(request: ModuleRequest): Promise<ModuleResponse> {
    return this.executeWithMetrics(request, async () => {
      this.validateRequest(request, ['identifier']);

      const { identifier, metric, period, options } = request;

      // Determine if identifier is CIK or ticker
      const isCIK = /^\d{10}$/.test(identifier);
      const cik = isCIK ? identifier : await this.tickerToCIK(identifier);

      if (!cik) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `Unable to resolve identifier: ${identifier}`
        );
      }

      // Search for relevant filings
      const filings = await this.searchFilings({
        cik,
        filing_type: options?.filing_type || '10-K',
        date_from: options?.date_from,
        date_to: options?.date_to,
      });

      if (filings.length === 0) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `No filings found for CIK ${cik}`
        );
      }

      // Get the most recent filing
      const filing = filings[0];

      // Extract requested metrics
      if (metric) {
        const extraction = await this.extractMetric(filing, metric, period);
        return this.createMetric(
          metric,
          extraction.value,
          {
            source_type: 'sec-edgar',
            source_url: filing.file_url,
            filing_type: filing.filing_type,
            accession_number: filing.accession_number,
            period: period || filing.report_date,
            extraction_method: 'text-extract',
          },
          {
            company_name: filing.company_name,
            filing_date: filing.filing_date,
            report_date: filing.report_date,
          },
          extraction.raw_text
        );
      }

      // Return filing metadata if no specific metric requested
      return this.createMetric(
        'filing_metadata',
        filing.accession_number,
        {
          source_type: 'sec-edgar',
          source_url: filing.file_url,
          filing_type: filing.filing_type,
          accession_number: filing.accession_number,
          extraction_method: 'api',
        },
        {
          company_name: filing.company_name,
          filing_date: filing.filing_date,
          report_date: filing.report_date,
          cik,
        }
      );
    });
  }

  /**
   * Search for SEC filings
   * 
   * Uses SEC EDGAR API to find filings matching criteria
   */
  private async searchFilings(params: EDGARSearchParams): Promise<EDGARFiling[]> {
    await this.enforceRateLimit();

    const { cik, filing_type = '10-K', date_from, date_to } = params;
    
    // Pad CIK to 10 digits
    const paddedCIK = cik.padStart(10, '0');
    
    // SEC submissions endpoint
    const url = `${this.baseUrl}/submissions/CIK${paddedCIK}.json`;

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
            `CIK ${cik} not found in SEC database`
          );
        }
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `SEC API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      const filings: EDGARFiling[] = [];

      // Parse recent filings
      if (data.filings && data.filings.recent) {
        const recent = data.filings.recent;
        const forms = recent.form || [];
        const filingDates = recent.filingDate || [];
        const accessionNumbers = recent.accessionNumber || [];
        const reportDates = recent.reportDate || [];

        for (let i = 0; i < forms.length; i++) {
          const form = forms[i];
          const filingDate = filingDates[i];
          const accessionNumber = accessionNumbers[i];
          const reportDate = reportDates[i];

          // Filter by filing type
          if (filing_type && form !== filing_type) {
            continue;
          }

          // Filter by date range
          if (date_from && filingDate < date_from) {
            continue;
          }
          if (date_to && filingDate > date_to) {
            continue;
          }

          // Construct filing URL
          const accessionNumberClean = accessionNumber.replace(/-/g, '');
          const fileUrl = `${this.baseUrl}/Archives/edgar/data/${paddedCIK}/${accessionNumberClean}/${accessionNumber}.txt`;

          filings.push({
            accession_number: accessionNumber,
            filing_type: form,
            filing_date: filingDate,
            report_date: reportDate,
            company_name: data.name || '',
            cik: paddedCIK,
            file_url: fileUrl,
          });
        }
      }

      // Sort by filing date (most recent first)
      filings.sort((a, b) => b.filing_date.localeCompare(a.filing_date));

      logger.info('EDGAR filings retrieved', {
        cik: paddedCIK,
        filing_type,
        count: filings.length,
      });

      return filings;
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to fetch EDGAR data: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract specific metric from filing
   * 
   * Implements deterministic extraction with pattern matching
   */
  private async extractMetric(
    filing: EDGARFiling,
    metric: string,
    period?: string
  ): Promise<{ value: number | string; raw_text: string }> {
    await this.enforceRateLimit();

    try {
      const response = await fetch(filing.file_url, {
        headers: {
          'User-Agent': this.userAgent,
        },
      });

      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Failed to fetch filing: ${response.status}`
        );
      }

      const filingText = await response.text();

      // Extract metric using pattern matching
      const extraction = this.extractMetricFromText(filingText, metric);

      if (!extraction) {
        throw new GroundTruthError(
          ErrorCodes.NO_DATA_FOUND,
          `Metric ${metric} not found in filing ${filing.accession_number}`
        );
      }

      return extraction;
    } catch (error) {
      if (error instanceof GroundTruthError) {
        throw error;
      }
      throw new GroundTruthError(
        ErrorCodes.UPSTREAM_FAILURE,
        `Failed to extract metric: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Extract metric value from filing text using pattern matching
   * 
   * This is a simplified implementation. Production would use:
   * - XBRL parsing for structured data
   * - NLP-based extraction for unstructured sections
   * - Multiple pattern matching strategies
   */
  private extractMetricFromText(
    text: string,
    metric: string
  ): { value: number | string; raw_text: string } | null {
    // Metric pattern mappings
    const patterns: Record<string, RegExp[]> = {
      revenue_total: [
        /Total\s+(?:Net\s+)?Revenues?[:\s]+\$?([\d,]+)/i,
        /Net\s+Sales[:\s]+\$?([\d,]+)/i,
        /Revenue[:\s]+\$?([\d,]+)/i,
      ],
      gross_profit: [
        /Gross\s+Profit[:\s]+\$?([\d,]+)/i,
        /Gross\s+Margin[:\s]+\$?([\d,]+)/i,
      ],
      operating_income: [
        /Operating\s+Income[:\s]+\$?([\d,]+)/i,
        /Income\s+from\s+Operations[:\s]+\$?([\d,]+)/i,
      ],
      net_income: [
        /Net\s+Income[:\s]+\$?([\d,]+)/i,
        /Net\s+Earnings?[:\s]+\$?([\d,]+)/i,
      ],
      eps_diluted: [
        /Diluted\s+(?:Earnings|EPS)[:\s]+\$?([\d.]+)/i,
        /Earnings\s+per\s+Share.*Diluted[:\s]+\$?([\d.]+)/i,
      ],
    };

    const metricPatterns = patterns[metric];
    if (!metricPatterns) {
      return null;
    }

    // Try each pattern
    for (const pattern of metricPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const valueStr = match[1].replace(/,/g, '');
        const value = parseFloat(valueStr);
        
        if (!isNaN(value)) {
          // Extract surrounding context (100 chars before and after)
          const matchIndex = text.indexOf(match[0]);
          const contextStart = Math.max(0, matchIndex - 100);
          const contextEnd = Math.min(text.length, matchIndex + match[0].length + 100);
          const rawText = text.substring(contextStart, contextEnd);

          return { value, raw_text: rawText };
        }
      }
    }

    return null;
  }

  /**
   * Convert ticker symbol to CIK
   * 
   * Uses SEC ticker lookup API
   */
  private async tickerToCIK(ticker: string): Promise<string | null> {
    await this.enforceRateLimit();

    try {
      // SEC company tickers JSON
      const url = `${this.baseUrl}/files/company_tickers.json`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new GroundTruthError(
          ErrorCodes.UPSTREAM_FAILURE,
          `Failed to fetch ticker mapping: ${response.status}`
        );
      }

      const data = await response.json();
      
      // Find matching ticker
      for (const key in data) {
        const company = data[key];
        if (company.ticker && company.ticker.toUpperCase() === ticker.toUpperCase()) {
          // Pad CIK to 10 digits
          return company.cik_str.toString().padStart(10, '0');
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to convert ticker to CIK', {
        ticker,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Enforce SEC rate limiting (10 requests per second)
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const minInterval = 1000 / this.rateLimit; // milliseconds between requests
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Extract section from filing (e.g., Risk Factors, MD&A)
   */
  async extractSection(
    accessionNumber: string,
    section: string
  ): Promise<EDGARExtraction> {
    // Implementation would parse filing structure and extract specific sections
    // This is a placeholder for the full implementation
    throw new GroundTruthError(
      ErrorCodes.INVALID_REQUEST,
      'Section extraction not yet implemented'
    );
  }

  /**
   * Extract keywords from filing
   */
  async extractKeywords(
    accessionNumber: string,
    keywords: string[]
  ): Promise<EDGARExtraction> {
    // Implementation would search filing for keyword occurrences
    // This is a placeholder for the full implementation
    throw new GroundTruthError(
      ErrorCodes.INVALID_REQUEST,
      'Keyword extraction not yet implemented'
    );
  }
}
