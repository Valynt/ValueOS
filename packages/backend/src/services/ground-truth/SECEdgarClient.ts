/**
 * SECEdgarClient
 *
 * Client for SEC EDGAR API integration. Fetches 10-K and 10-Q filings,
 * extracts business sections, and provides circuit breaker for resilience.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §1
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SECFilingSchema = z.object({
  cik: z.string(),
  accession_number: z.string(),
  filing_date: z.string(),
  form: z.enum(["10-K", "10-Q", "8-K", "DEF 14A"]),
  report_date: z.string().optional(),
  primary_document_url: z.string(),
  filing_metadata: z.record(z.unknown()),
});

export const FilingContentSchema = z.object({
  cik: z.string(),
  accession_number: z.string(),
  form: z.string(),
  sections: z.object({
    item_1_business: z.string().optional(),
    item_1a_risk_factors: z.string().optional(),
    item_7_md_and_a: z.string().optional(),
    full_text: z.string(),
  }),
  extracted_at: z.string(),
});

export type SECFiling = z.infer<typeof SECFilingSchema>;
export type FilingContent = z.infer<typeof FilingContentSchema>;

// ---------------------------------------------------------------------------
// Circuit Breaker State
// ---------------------------------------------------------------------------

interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class SECEdgarClient {
  private readonly baseUrl = "https://www.sec.gov/Archives/edgar/daily-index";
  private readonly searchUrl = "https://efts.sec.gov/LATEST/search-index";
  private readonly userAgent: string;

  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    isOpen: false,
  };

  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT_MS = 60000; // 60 seconds
  private readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

  constructor() {
    // SEC requires a User-Agent with contact info
    this.userAgent = process.env.SEC_USER_AGENT ?? "ValueOS (contact@valueos.com)";
  }

  /**
   * Map company domain/name to CIK (Central Index Key).
   * Uses SEC company tickers JSON or search API.
   */
  async getCIK(companyNameOrDomain: string): Promise<string | null> {
    if (this.isCircuitOpen()) {
      logger.warn("SEC EDGAR circuit breaker is open");
      return null;
    }

    try {
      // Try to fetch from SEC company tickers endpoint
      const response = await this.fetchWithTimeout(
        "https://www.sec.gov/files/company_tickers.json",
        { method: "GET" }
      );

      if (!response.ok) {
        throw new Error(`SEC API returned ${response.status}`);
      }

      const data = await response.json();

      // Search through tickers
      for (const entry of Object.values(data) as Array<{ticker: string; title: string; cik_str: string}>) {
        const title = entry.title.toLowerCase();
        const ticker = entry.ticker.toLowerCase();
        const search = companyNameOrDomain.toLowerCase();

        if (title.includes(search) || ticker === search) {
          // CIK needs to be 10 digits, padded with leading zeros
          return entry.cik_str.padStart(10, "0");
        }
      }

      return null;
    } catch (error) {
      this.recordFailure();
      logger.error("Failed to get CIK from SEC", {
        company: companyNameOrDomain,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Fetch the latest 10-K (annual) filing for a company.
   */
  async fetchLatest10K(cik: string): Promise<SECFiling | null> {
    return this.fetchLatestFiling(cik, "10-K");
  }

  /**
   * Fetch the latest 10-Q (quarterly) filing for a company.
   */
  async fetchLatest10Q(cik: string): Promise<SECFiling | null> {
    return this.fetchLatestFiling(cik, "10-Q");
  }

  /**
   * Fetch filing content and extract key business sections.
   */
  async fetchFilingContent(filing: SECFiling): Promise<FilingContent | null> {
    if (this.isCircuitOpen()) {
      logger.warn("SEC EDGAR circuit breaker is open");
      return null;
    }

    try {
      const response = await this.fetchWithTimeout(filing.primary_document_url, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch filing content: ${response.status}`);
      }

      const html = await response.text();
      const sections = this.extractSections(html);

      return {
        cik: filing.cik,
        accession_number: filing.accession_number,
        form: filing.form,
        sections,
        extracted_at: new Date().toISOString(),
      };
    } catch (error) {
      this.recordFailure();
      logger.error("Failed to fetch filing content", {
        cik: filing.cik,
        accession: filing.accession_number,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get circuit breaker status for health checks.
   */
  getCircuitStatus(): { isOpen: boolean; failures: number; lastFailure: number | null } {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      lastFailure: this.circuitBreaker.lastFailure,
    };
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private async fetchLatestFiling(
    cik: string,
    formType: "10-K" | "10-Q"
  ): Promise<SECFiling | null> {
    if (this.isCircuitOpen()) {
      logger.warn("SEC EDGAR circuit breaker is open");
      return null;
    }

    try {
      // Use SEC submissions endpoint
      const submissionsUrl = `https://data.sec.gov/submissions/CIK${cik}.json`;

      const response = await this.fetchWithTimeout(submissionsUrl, { method: "GET" });

      if (!response.ok) {
        if (response.status === 404) {
          // Company not found or not publicly traded
          logger.info("Company not found in SEC database", { cik });
          return null;
        }
        throw new Error(`SEC API returned ${response.status}`);
      }

      const data = await response.json();

      // Find the latest filing of the requested type
      const filings = data.filings?.recent;
      if (!filings) {
        return null;
      }

      const forms: string[] = filings.form;
      const filingDates: string[] = filings.filingDate;
      const accessionNumbers: string[] = filings.accessionNumber;
      const primaryDocuments: string[] = filings.primaryDocument;

      for (let i = 0; i < forms.length; i++) {
        if (forms[i] === formType) {
          const accession = accessionNumbers[i].replace(/-/g, "");
          const documentUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accession}/${primaryDocuments[i]}`;

          return {
            cik,
            accession_number: accessionNumbers[i],
            filing_date: filingDates[i],
            form: formType,
            report_date: filingDates[i],
            primary_document_url: documentUrl,
            filing_metadata: {},
          };
        }
      }

      return null;
    } catch (error) {
      this.recordFailure();
      logger.error("Failed to fetch latest filing", {
        cik,
        form: formType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { timeout?: number } = {}
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = options.timeout ?? this.REQUEST_TIMEOUT_MS;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          "User-Agent": this.userAgent,
        },
      });

      // Reset circuit breaker on success
      this.resetCircuitBreaker();

      return response;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private extractSections(html: string): FilingContent["sections"] {
    // Simple section extraction based on common patterns
    // In production, this would use a more sophisticated HTML parser

    const sections: FilingContent["sections"] = {
      full_text: html,
    };

    // Try to extract Item 1 (Business)
    const item1Match = html.match(/ITEM\s+1[.\s]+BUSINESS/i);
    if (item1Match) {
      const start = item1Match.index ?? 0;
      const end = html.indexOf("ITEM 1A", start) || html.indexOf("ITEM 2", start) || start + 10000;
      sections.item_1_business = html.slice(start, end).substring(0, 5000);
    }

    // Try to extract Item 1A (Risk Factors)
    const item1aMatch = html.match(/ITEM\s+1A[.\s]+RISK\s+FACTORS/i);
    if (item1aMatch) {
      const start = item1aMatch.index ?? 0;
      const end = html.indexOf("ITEM 1B", start) || html.indexOf("ITEM 2", start) || start + 10000;
      sections.item_1a_risk_factors = html.slice(start, end).substring(0, 5000);
    }

    // Try to extract Item 7 (MD&A)
    const item7Match = html.match(/ITEM\s+7[.\s]+MANAGEMENT.*?DISCUSSION/i);
    if (item7Match) {
      const start = item7Match.index ?? 0;
      const end = html.indexOf("ITEM 7A", start) || html.indexOf("ITEM 8", start) || start + 10000;
      sections.item_7_md_and_a = html.slice(start, end).substring(0, 5000);
    }

    return sections;
  }

  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) {
      return false;
    }

    // Check if we should reset
    if (this.circuitBreaker.lastFailure) {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
      if (timeSinceLastFailure > this.RESET_TIMEOUT_MS) {
        logger.info("SEC EDGAR circuit breaker reset after timeout");
        this.resetCircuitBreaker();
        return false;
      }
    }

    return true;
  }

  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.FAILURE_THRESHOLD) {
      this.circuitBreaker.isOpen = true;
      logger.error("SEC EDGAR circuit breaker opened due to repeated failures");
    }
  }

  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.lastFailure = null;
    this.circuitBreaker.isOpen = false;
  }
}
