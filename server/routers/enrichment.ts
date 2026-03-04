import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { callDataApi } from "../_core/dataApi";

// ── Shared types ──────────────────────────────────────────────────────────────

interface EnrichedCompany {
  // Overview
  name: string;
  domain: string;
  description: string;
  industry: string;
  sector: string;
  founded: string;
  headquarters: string;
  employees: number | null;
  website: string;
  logo: string;
  linkedinUrl: string;
  crunchbaseUrl: string;

  // Financials
  revenue: string;
  marketCap: string;
  stockPrice: string;
  peRatio: string;
  dividendYield: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  currency: string;
  exchange: string;
  ticker: string;

  // Intelligence
  specialties: string[];
  executives: { name: string; title: string }[];
  recentFilings: { title: string; type: string; date: string; url: string }[];

  // Metadata
  sources: { name: string; status: "success" | "partial" | "failed"; fieldsFound: number }[];
  confidence: number;
  enrichedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Map a company name to a likely stock ticker. Falls back to the name itself. */
function guessTickerFromName(name: string): string {
  const map: Record<string, string> = {
    salesforce: "CRM",
    microsoft: "MSFT",
    apple: "AAPL",
    google: "GOOGL",
    alphabet: "GOOGL",
    amazon: "AMZN",
    meta: "META",
    facebook: "META",
    tesla: "TSLA",
    nvidia: "NVDA",
    snowflake: "SNOW",
    servicenow: "NOW",
    workday: "WDAY",
    oracle: "ORCL",
    ibm: "IBM",
    sap: "SAP",
    adobe: "ADBE",
    cisco: "CSCO",
    intel: "INTC",
    amd: "AMD",
    netflix: "NFLX",
    uber: "UBER",
    airbnb: "ABNB",
    shopify: "SHOP",
    zoom: "ZM",
    palantir: "PLTR",
    crowdstrike: "CRWD",
    datadog: "DDOG",
    cloudflare: "NET",
    twilio: "TWLO",
    hubspot: "HUBS",
    atlassian: "TEAM",
    stripe: "STRIP",
    databricks: "DBR",
    mongodb: "MDB",
    elastic: "ESTC",
    confluent: "CFLT",
    hashicorp: "HCP",
    paloalto: "PANW",
    fortinet: "FTNT",
    zscaler: "ZS",
    okta: "OKTA",
    splunk: "SPLK",
    vmware: "VMW",
    dell: "DELL",
    hp: "HPQ",
    accenture: "ACN",
    deloitte: "DL",
    jpmorgan: "JPM",
    goldman: "GS",
    "goldman sachs": "GS",
    "bank of america": "BAC",
    walmart: "WMT",
    target: "TGT",
    costco: "COST",
    disney: "DIS",
    boeing: "BA",
    lockheed: "LMT",
    raytheon: "RTX",
    pfizer: "PFE",
    johnson: "JNJ",
    "johnson & johnson": "JNJ",
    unitedhealth: "UNH",
  };
  const lower = name.toLowerCase().trim();
  return map[lower] || name.toUpperCase().replace(/\s+/g, "").slice(0, 5);
}

/** Guess LinkedIn username from company name */
function guessLinkedInUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "").replace(/^-+/, "");
}

function fmt(val: unknown, fallback = "N/A"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object" && "fmt" in (val as any)) return (val as any).fmt ?? fallback;
  if (typeof val === "object" && "raw" in (val as any)) return String((val as any).raw);
  return String(val);
}

// ── Router ────────────────────────────────────────────────────────────────────

export const enrichmentRouter = router({
  /**
   * Enrich a company by name or domain.
   * Calls YahooFinance (stock profile + SEC filings) and LinkedIn in parallel.
   */
  enrichCompany: publicProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        domain: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { companyName } = input;
      const ticker = guessTickerFromName(companyName);
      const linkedinUsername = guessLinkedInUsername(companyName);

      const sources: EnrichedCompany["sources"] = [];

      // ── Call all three APIs in parallel ──────────────────────────────────
      const [profileResult, filingsResult, linkedinResult] = await Promise.allSettled([
        callDataApi("YahooFinance/get_stock_profile", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        }),
        callDataApi("YahooFinance/get_stock_sec_filing", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        }),
        callDataApi("LinkedIn/get_company_details", {
          query: { username: linkedinUsername },
        }),
      ]);

      // ── Parse YahooFinance Profile ──────────────────────────────────────
      let profile: any = null;
      let profileFieldCount = 0;
      if (profileResult.status === "fulfilled" && profileResult.value) {
        profile = profileResult.value;
        const ap = profile?.assetProfile ?? {};
        const price = profile?.price ?? {};
        const sd = profile?.summaryDetail ?? {};
        profileFieldCount =
          (ap.sector ? 1 : 0) +
          (ap.industry ? 1 : 0) +
          (ap.fullTimeEmployees ? 1 : 0) +
          (ap.website ? 1 : 0) +
          (ap.longBusinessSummary ? 1 : 0) +
          (ap.country ? 1 : 0) +
          (price.regularMarketPrice ? 1 : 0) +
          (sd.marketCap ? 1 : 0);
        sources.push({
          name: "Yahoo Finance",
          status: profileFieldCount > 3 ? "success" : "partial",
          fieldsFound: profileFieldCount,
        });
      } else {
        sources.push({ name: "Yahoo Finance", status: "failed", fieldsFound: 0 });
      }

      // ── Parse SEC Filings ───────────────────────────────────────────────
      let filings: any[] = [];
      if (filingsResult.status === "fulfilled" && filingsResult.value) {
        const fd = filingsResult.value as any;
        filings = (fd?.filings ?? []).slice(0, 10);
        sources.push({
          name: "SEC EDGAR",
          status: filings.length > 0 ? "success" : "partial",
          fieldsFound: filings.length,
        });
      } else {
        sources.push({ name: "SEC EDGAR", status: "failed", fieldsFound: 0 });
      }

      // ── Parse LinkedIn ──────────────────────────────────────────────────
      let linkedin: any = null;
      let linkedinFieldCount = 0;
      if (linkedinResult.status === "fulfilled" && linkedinResult.value) {
        const lr = linkedinResult.value as any;
        if (lr?.success !== false) {
          linkedin = lr?.data ?? lr;
          linkedinFieldCount =
            (linkedin?.name ? 1 : 0) +
            (linkedin?.description ? 1 : 0) +
            (linkedin?.staffCount ? 1 : 0) +
            (linkedin?.website ? 1 : 0) +
            (linkedin?.industries?.length ? 1 : 0) +
            (linkedin?.specialities?.length ? 1 : 0) +
            (linkedin?.followerCount ? 1 : 0);
          sources.push({
            name: "LinkedIn",
            status: linkedinFieldCount > 2 ? "success" : "partial",
            fieldsFound: linkedinFieldCount,
          });
        } else {
          sources.push({ name: "LinkedIn", status: "failed", fieldsFound: 0 });
        }
      } else {
        sources.push({ name: "LinkedIn", status: "failed", fieldsFound: 0 });
      }

      // ── Merge into unified response ─────────────────────────────────────
      const ap = profile?.assetProfile ?? {};
      const price = profile?.price ?? {};
      const sd = profile?.summaryDetail ?? {};
      const qt = profile?.quoteType ?? {};

      // Build executives from assetProfile.companyOfficers
      const executives: { name: string; title: string }[] = (ap.companyOfficers ?? [])
        .slice(0, 5)
        .map((o: any) => ({
          name: o.name ?? "Unknown",
          title: o.title ?? "Executive",
        }));

      // Build recent filings
      const recentFilings = filings.map((f: any) => ({
        title: f.title ?? f.type ?? "Filing",
        type: f.type ?? "Unknown",
        date: f.date ?? "",
        url: f.edgarUrl ?? "",
      }));

      // Build headquarters string
      const hqParts = [ap.city, ap.state, ap.country].filter(Boolean);
      const headquarters = hqParts.length > 0 ? hqParts.join(", ") : "N/A";

      // Calculate confidence score (0-100)
      const totalFields = profileFieldCount + linkedinFieldCount + Math.min(filings.length, 5);
      const maxPossible = 8 + 7 + 5; // profile + linkedin + filings
      const confidence = Math.round((totalFields / maxPossible) * 100);

      const enriched: EnrichedCompany = {
        // Overview
        name: linkedin?.name ?? qt?.longName ?? qt?.shortName ?? companyName,
        domain: linkedin?.website ?? ap.website ?? input.domain ?? "",
        description: ap.longBusinessSummary ?? linkedin?.description ?? "",
        industry: ap.industry ?? (linkedin?.industries ?? [])[0] ?? "",
        sector: ap.sector ?? "",
        founded: ap.startDate ? String(new Date(ap.startDate * 1000).getFullYear()) : linkedin?.foundedOn?.year ? String(linkedin.foundedOn.year) : "",
        headquarters,
        employees: ap.fullTimeEmployees ?? linkedin?.staffCount ?? null,
        website: ap.website ?? linkedin?.website ?? "",
        logo: linkedin?.logo ?? `https://logo.clearbit.com/${ap.website ?? ""}`,
        linkedinUrl: linkedin?.linkedinUrl ?? linkedin?.url ?? "",
        crunchbaseUrl: linkedin?.crunchbaseUrl ?? "",

        // Financials
        revenue: fmt(sd.totalRevenue ?? price.revenue),
        marketCap: fmt(sd.marketCap ?? price.marketCap),
        stockPrice: fmt(price.regularMarketPrice),
        peRatio: fmt(sd.trailingPE),
        dividendYield: fmt(sd.dividendYield),
        fiftyTwoWeekHigh: fmt(sd.fiftyTwoWeekHigh),
        fiftyTwoWeekLow: fmt(sd.fiftyTwoWeekLow),
        currency: price.currency ?? "USD",
        exchange: qt.exchange ?? "",
        ticker,

        // Intelligence
        specialties: linkedin?.specialities ?? [],
        executives,
        recentFilings,

        // Metadata
        sources,
        confidence,
        enrichedAt: new Date().toISOString(),
      };

      return enriched;
    }),

  /**
   * Quick ticker lookup — returns basic stock info for autocomplete.
   */
  lookupTicker: publicProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ input }) => {
      const ticker = guessTickerFromName(input.query);
      try {
        const result = (await callDataApi("YahooFinance/get_stock_profile", {
          query: { symbol: ticker, region: "US", lang: "en-US" },
        })) as any;
        const qt = result?.quoteType ?? {};
        const price = result?.price ?? {};
        return {
          found: true,
          ticker,
          name: qt.longName ?? qt.shortName ?? input.query,
          exchange: qt.exchange ?? "",
          price: fmt(price.regularMarketPrice),
          marketCap: fmt(price.marketCap),
        };
      } catch {
        return { found: false, ticker, name: input.query, exchange: "", price: "", marketCap: "" };
      }
    }),
});
