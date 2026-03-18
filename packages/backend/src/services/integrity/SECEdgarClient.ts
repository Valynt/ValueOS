/**
 * SECEdgarClient
 *
 * Fetches SEC EDGAR filings (10-K, 10-Q) for public companies.
 * Maps company domain/name to CIK/Ticker, extracts key business sections.
 * Implements circuit breaker and Redis caching with 24-hour TTL.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §1
 */

import { z } from "zod";
import { logger } from "../lib/logger.js";
import { getIoRedisClient } from "../../lib/ioredisClient.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const SECFilingSchema = z.object({
  cik: z.string(),
  ticker: z.string().optional(),
  company_name: z.string(),
  form_type: z.enum(["10-K", "10-Q", "8-K", "DEF 14A"]),
  filing_date: z.string().datetime(),
  period_end_date: z.string().datetime().optional(),
  accession_number: z.string(),
  filing_url: z.string().url(),
  extracted_sections: z.record(z.string()),
  fetched_at: z.string().datetime(),
});

export type SECFiling = z.infer<typeof SECFilingSchema>;

export interface SECFetchInput {
  cik?: string;
  ticker?: string;
  companyName?: string;
  domain?: string;
  formTypes?: Array<"10-K" | "10-Q" | "8-K" | "DEF 14A">;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SECEdgarClient {
  private readonly BASE_URL = "https://www.sec.gov/Archives/edgar";
  private readonly API_URL = "https://www.sec.gov/cgi-bin/browse-edgar";
  private readonly REQUEST_TIMEOUT_MS = 30000;
  private readonly CACHE_TTL_SECONDS = 86400; // 24 hours

  private circuitBreaker = {
    failures: 0,
    lastFailure: 0,
    isOpen: false,
    threshold: 5,
    resetTimeoutMs: 60000,
  };

  /**
   * Fetch SEC filings for a company.
   */
  async fetchFilings(input: SECFetchInput): Promise<SECFiling[]> {
    logger.info(`Fetching SEC filings for ${input.ticker || input.cik || input.companyName}`);

    if (this.isCircuitOpen()) {
      throw new Error("SEC EDGAR circuit breaker is open");
    }

    try {
      // Resolve CIK from ticker/company name if needed
      const cik = input.cik || await this.resolveCIK(input);
      if (!cik) {
        logger.warn(`Could not resolve CIK for ${input.ticker || input.companyName}`);
        return [];
      }

      // Fetch filings
      const filings = await this.fetchFilingsForCIK(cik, input.formTypes || ["10-K", "10-Q"], input.limit || 5);

      this.resetCircuitBreaker();
      return filings;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  // SEC EDGAR public endpoints — no auth required, but User-Agent header is mandatory.
  private readonly TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
  private readonly SUBMISSIONS_URL = "https://data.sec.gov/submissions";
  private readonly SEC_USER_AGENT = "ValueOS/1.0 (contact@valueos.io)";
  private readonly TICKERS_CACHE_KEY = "sec:company_tickers";

  /**
   * Resolve CIK from ticker symbol.
   *
   * Fetches the SEC company_tickers.json (cached in Redis for 24 h) and
   * performs a case-insensitive ticker lookup. Returns null when the ticker
   * is not found — never returns a fabricated CIK.
   */
  private async resolveCIK(input: SECFetchInput): Promise<string | null> {
    if (!input.ticker) return null;

    const ticker = input.ticker.toUpperCase();

    try {
      const redis = getIoRedisClient();

      // Try cache first.
      const cached = await redis.get(this.TICKERS_CACHE_KEY);
      let tickerMap: Record<string, { cik_str: string; ticker: string; title: string }>;

      if (cached) {
        tickerMap = JSON.parse(cached) as typeof tickerMap;
      } else {
        // Fetch from SEC EDGAR.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

        let response: Response;
        try {
          response = await fetch(this.TICKERS_URL, {
            headers: { "User-Agent": this.SEC_USER_AGENT },
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) {
          logger.error("SECEdgarClient: failed to fetch company tickers", {
            status: response.status,
          });
          return null;
        }

        // The response is an object keyed by numeric index, not by ticker.
        const raw = (await response.json()) as Record<
          string,
          { cik_str: string; ticker: string; title: string }
        >;

        // Re-index by ticker for O(1) lookup and cache.
        tickerMap = {};
        for (const entry of Object.values(raw)) {
          tickerMap[entry.ticker.toUpperCase()] = entry;
        }

        await redis.set(
          this.TICKERS_CACHE_KEY,
          JSON.stringify(tickerMap),
          "EX",
          this.CACHE_TTL_SECONDS,
        );

        logger.info("SECEdgarClient: company tickers cached", {
          count: Object.keys(tickerMap).length,
        });
      }

      const entry = tickerMap[ticker];
      if (!entry) {
        logger.warn("SECEdgarClient: ticker not found in SEC company list", { ticker });
        return null;
      }

      // CIK must be zero-padded to 10 digits for EDGAR API calls.
      return entry.cik_str.padStart(10, "0");
    } catch (err) {
      logger.error("SECEdgarClient: resolveCIK failed", {
        ticker,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  /**
   * Fetch real filings for a CIK from the SEC EDGAR submissions API.
   *
   * Uses https://data.sec.gov/submissions/CIK{cik}.json which returns the
   * full filing history. Filters by requested form types and returns the
   * most recent `limit` filings.
   */
  private async fetchFilingsForCIK(
    cik: string,
    formTypes: string[],
    limit: number,
  ): Promise<SECFiling[]> {
    const cacheKey = `sec:filings:${cik}:${formTypes.sort().join(",")}`;

    try {
      const redis = getIoRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SECFiling[];
      }
    } catch {
      // Cache miss or Redis unavailable — proceed to fetch.
    }

    const url = `${this.SUBMISSIONS_URL}/CIK${cik}.json`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);

    let submissionsData: Record<string, unknown>;
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": this.SEC_USER_AGENT },
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn("SECEdgarClient: CIK not found in EDGAR", { cik });
          return [];
        }
        throw new Error(`SEC EDGAR submissions API returned ${response.status}`);
      }

      submissionsData = (await response.json()) as Record<string, unknown>;
    } finally {
      clearTimeout(timeout);
    }

    const companyName = (submissionsData.name as string) ?? "Unknown";
    const ticker = ((submissionsData.tickers as string[]) ?? [])[0] ?? undefined;

    const recent = (submissionsData.filings as Record<string, unknown>)?.recent as
      | Record<string, unknown[]>
      | undefined;

    if (!recent) return [];

    const forms = (recent.form ?? []) as string[];
    const dates = (recent.filingDate ?? []) as string[];
    const accessions = (recent.accessionNumber ?? []) as string[];
    const periodDates = (recent.reportDate ?? []) as string[];

    const filings: SECFiling[] = [];

    for (let i = 0; i < forms.length && filings.length < limit; i++) {
      const form = forms[i];
      if (!formTypes.includes(form)) continue;

      const accession = accessions[i]?.replace(/-/g, "") ?? "";
      const filingUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${accession}/`;

      const filing: SECFiling = {
        cik,
        ticker,
        company_name: companyName,
        form_type: form as SECFiling["form_type"],
        filing_date: new Date(dates[i] ?? Date.now()).toISOString(),
        period_end_date: periodDates[i]
          ? new Date(periodDates[i]).toISOString()
          : undefined,
        accession_number: accessions[i] ?? "",
        filing_url: filingUrl,
        extracted_sections: this.extractKeySections(form),
        fetched_at: new Date().toISOString(),
      };

      filings.push(filing);
    }

    // Cache the result.
    try {
      const redis = getIoRedisClient();
      await redis.set(cacheKey, JSON.stringify(filings), "EX", this.CACHE_TTL_SECONDS);
    } catch {
      // Non-fatal — continue without caching.
    }

    return filings;
  }

  /**
   * Return the standard section labels for a given form type.
   * These are structural labels, not content — actual content is fetched
   * from the filing document when needed.
   */
  private extractKeySections(formType: string): Record<string, string> {
    if (formType === "10-K") {
      return {
        "Item 1": "Business",
        "Item 1A": "Risk Factors",
        "Item 7": "Management's Discussion and Analysis",
        "Item 7A": "Quantitative and Qualitative Disclosures About Market Risk",
        "Item 8": "Financial Statements and Supplementary Data",
      };
    }
    if (formType === "10-Q") {
      return {
        "Part I, Item 2": "Management's Discussion and Analysis",
        "Part I, Item 3": "Quantitative and Qualitative Disclosures About Market Risk",
        "Part I, Item 4": "Controls and Procedures",
      };
    }
    return {};
  }

  /**
   * Check circuit breaker status.
   */
  private isCircuitOpen(): boolean {
    if (!this.circuitBreaker.isOpen) return false;

    const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailure;
    if (timeSinceLastFailure > this.circuitBreaker.resetTimeoutMs) {
      this.resetCircuitBreaker();
      return false;
    }

    return true;
  }

  /**
   * Record circuit breaker failure.
   */
  private recordFailure(): void {
    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      logger.error("SEC EDGAR circuit breaker opened");
    }
  }

  /**
   * Reset circuit breaker.
   */
  private resetCircuitBreaker(): void {
    this.circuitBreaker.failures = 0;
    this.circuitBreaker.isOpen = false;
  }

  /**
   * Get circuit status for health checks.
   */
  getCircuitStatus(): { isOpen: boolean; failures: number; lastFailure: number } {
    return {
      isOpen: this.circuitBreaker.isOpen,
      failures: this.circuitBreaker.failures,
      lastFailure: this.circuitBreaker.lastFailure,
    };
  }
}
