/**
 * XBRLParser
 *
 * Parser for SEC companyfacts API. Extracts GAAP-tagged financial facts:
 * revenue, net income, margins, assets, liabilities.
 *
 * Reference: openspec/changes/ground-truth-integration/tasks.md §2
 */

import { z } from "zod";

import { logger } from "../../lib/logger.js";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const XBRLFactSchema = z.object({
  metric_name: z.string(),
  period: z.string(), // YYYY or YYYY-QX
  value: z.number(),
  unit: z.string(),
  gaap_tag: z.string(),
  taxonomy: z.string(),
  filing_date: z.string(),
  source_form: z.enum(["10-K", "10-Q"]),
});

export const FinancialMetricsSchema = z.object({
  cik: z.string(),
  company_name: z.string(),
  fiscal_year_end: z.string(),
  facts: z.array(XBRLFactSchema),
  extracted_at: z.string(),
});

export type XBRLFact = z.infer<typeof XBRLFactSchema>;
export type FinancialMetrics = z.infer<typeof FinancialMetricsSchema>;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class XBRLParser {
  private readonly baseUrl = "https://data.sec.gov/api/xbrl/companyfacts";
  private readonly userAgent: string;

  constructor() {
    this.userAgent = process.env.SEC_USER_AGENT ?? "ValueOS (contact@valueos.com)";
  }

  /**
   * Fetch and parse XBRL company facts for a given CIK.
   */
  async parseCompanyFacts(cik: string): Promise<FinancialMetrics | null> {
    try {
      const url = `${this.baseUrl}/CIK${cik.padStart(10, "0")}.json`;

      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          logger.info("No XBRL data found for CIK", { cik });
          return null;
        }
        throw new Error(`SEC API returned ${response.status}`);
      }

      const data = await response.json();

      return this.parseFacts(data, cik);
    } catch (error) {
      logger.error("Failed to parse XBRL company facts", {
        cik,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get specific metric history (up to 5 years).
   */
  async getMetricHistory(
    cik: string,
    metricName: string
  ): Promise<XBRLFact[] | null> {
    const metrics = await this.parseCompanyFacts(cik);
    if (!metrics) return null;

    const facts = metrics.facts.filter(
      (f) => f.metric_name.toLowerCase() === metricName.toLowerCase()
    );

    // Sort by period descending and take last 5 years
    return facts
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, 20); // ~5 years of quarterly data
  }

  /**
   * Get standard financial summary (revenue, net income, assets, liabilities).
   */
  async getFinancialSummary(cik: string): Promise<{
    revenue: XBRLFact[];
    net_income: XBRLFact[];
    total_assets: XBRLFact[];
    total_liabilities: XBRLFact[];
    gross_profit: XBRLFact[];
    operating_income: XBRLFact[];
  } | null> {
    const metrics = await this.parseCompanyFacts(cik);
    if (!metrics) return null;

    return {
      revenue: this.findMetric(metrics.facts, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax", "SalesRevenueNet"]),
      net_income: this.findMetric(metrics.facts, ["NetIncomeLoss", "ProfitLoss"]),
      total_assets: this.findMetric(metrics.facts, ["Assets"]),
      total_liabilities: this.findMetric(metrics.facts, ["Liabilities"]),
      gross_profit: this.findMetric(metrics.facts, ["GrossProfit"]),
      operating_income: this.findMetric(metrics.facts, ["OperatingIncomeLoss", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"]),
    };
  }

  // -------------------------------------------------------------------------
  // Private methods
  // -------------------------------------------------------------------------

  private parseFacts(data: unknown, cik: string): FinancialMetrics {
    const typed = data as {
      cik: string;
      entityName: string;
      facts: Record<string, Record<string, {
        label: string;
        description: string;
        units: Record<string, Array<{
          start?: string;
          end?: string;
          val: number;
          filed: string;
          form: string;
          fy: string;
          fp: string;
        }>>;
      }>>;
    };

    const facts: XBRLFact[] = [];

    // Map of common GAAP concepts to metric names
    const conceptMap: Record<string, string> = {
      // Revenue
      "Revenues": "revenue",
      "RevenueFromContractWithCustomerExcludingAssessedTax": "revenue",
      "SalesRevenueNet": "revenue",
      "TotalRevenues": "revenue",

      // Net Income
      "NetIncomeLoss": "net_income",
      "ProfitLoss": "net_income",
      "NetIncomeLossAvailableToCommonStockholdersBasic": "net_income",

      // Assets
      "Assets": "total_assets",
      "AssetsCurrent": "current_assets",
      "AssetsNoncurrent": "noncurrent_assets",

      // Liabilities
      "Liabilities": "total_liabilities",
      "LiabilitiesCurrent": "current_liabilities",
      "LiabilitiesNoncurrent": "noncurrent_liabilities",

      // Equity
      "StockholdersEquity": "shareholders_equity",
      "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest": "shareholders_equity",

      // Cash Flow
      "NetCashProvidedByUsedInOperatingActivities": "operating_cash_flow",
      "NetCashProvidedByUsedInInvestingActivities": "investing_cash_flow",
      "NetCashProvidedByUsedInFinancingActivities": "financing_cash_flow",

      // Margins
      "GrossProfit": "gross_profit",
      "OperatingIncomeLoss": "operating_income",
      "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest": "ebit",

      // Per Share
      "EarningsPerShareBasic": "eps_basic",
      "EarningsPerShareDiluted": "eps_diluted",
    };

    // Process us-gaap taxonomy
    const usGaap = typed.facts?.["us-gaap"];
    if (usGaap) {
      for (const [concept, data] of Object.entries(usGaap)) {
        const metricName = conceptMap[concept];
        if (!metricName) continue; // Skip unmapped concepts

        // Process each unit (usually USD)
        for (const [unit, values] of Object.entries(data.units)) {
          for (const entry of values) {
            // Skip non-annual/quarterly periods (we want FY or QX)
            if (!entry.fy || !entry.fp) continue;

            const period = entry.fp === "FY" ? entry.fy : `${entry.fy}-${entry.fp}`;

            facts.push({
              metric_name: metricName,
              period,
              value: entry.val,
              unit,
              gaap_tag: concept,
              taxonomy: "us-gaap",
              filing_date: entry.filed,
              source_form: entry.form === "10-Q" ? "10-Q" : "10-K",
            });
          }
        }
      }
    }

    // Deduplicate facts (keep most recent filing for each metric+period)
    const deduped = this.deduplicateFacts(facts);

    return {
      cik: typed.cik ?? cik,
      company_name: typed.entityName ?? "Unknown",
      fiscal_year_end: "", // Would need additional parsing
      facts: deduped,
      extracted_at: new Date().toISOString(),
    };
  }

  private deduplicateFacts(facts: XBRLFact[]): XBRLFact[] {
    const seen = new Map<string, XBRLFact>();

    for (const fact of facts) {
      const key = `${fact.metric_name}-${fact.period}`;
      const existing = seen.get(key);

      if (!existing || fact.filing_date > existing.filing_date) {
        seen.set(key, fact);
      }
    }

    return Array.from(seen.values());
  }

  private findMetric(facts: XBRLFact[], conceptNames: string[]): XBRLFact[] {
    return facts
      .filter((f) => conceptNames.includes(f.gaap_tag))
      .sort((a, b) => b.period.localeCompare(a.period));
  }
}

export const xbrlParser = new XBRLParser();
