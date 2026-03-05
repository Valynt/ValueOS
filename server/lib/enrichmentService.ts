/**
 * Enrichment Service — Shared API functions for SEC EDGAR, BLS, Census,
 * Yahoo Finance, and LinkedIn data retrieval.
 *
 * Extracted from the enrichment router so that both the tRPC enrichment
 * procedure and agent tool executors can call the same underlying functions
 * without HTTP loopback.
 *
 * Each function returns a typed result with status indicators so callers
 * can handle partial/failed results gracefully.
 */

import { callDataApi } from "../_core/dataApi";

// ── SEC EDGAR ───────────────────────────────────────────────────────────────

export interface SECCompanyInfo {
  cik: string;
  name: string;
  ticker: string;
  sic: string;
  sicDescription: string;
  stateOfIncorporation: string;
  filings: { form: string; filingDate: string; accessionNumber: string }[];
}

const SEC_USER_AGENT = "ValueOS/1.0 (contact@valynt.com)";

/**
 * Resolve a company in SEC EDGAR by name or ticker.
 * Returns CIK, ticker, SIC code, and recent filings.
 */
export async function fetchSECCompany(
  companyName: string
): Promise<SECCompanyInfo | null> {
  try {
    // Step 1: Get company tickers list
    const tickerResp = await fetch(
      "https://www.sec.gov/files/company_tickers.json",
      {
        headers: {
          "User-Agent": SEC_USER_AGENT,
          Accept: "application/json",
        },
      }
    );

    if (!tickerResp.ok) return null;

    const tickers = await tickerResp.json();
    const lowerName = companyName.toLowerCase();

    // Find matching company by name or ticker
    let match: any = null;
    for (const key of Object.keys(tickers)) {
      const entry = tickers[key];
      if (
        entry.title?.toLowerCase().includes(lowerName) ||
        entry.ticker?.toLowerCase() === lowerName
      ) {
        match = entry;
        break;
      }
    }

    if (!match) return null;

    const cik = String(match.cik_str).padStart(10, "0");

    // Step 2: Get company submissions for SIC code and filings
    const factsResp = await fetch(
      `https://data.sec.gov/submissions/CIK${cik}.json`,
      {
        headers: {
          "User-Agent": SEC_USER_AGENT,
          Accept: "application/json",
        },
      }
    );

    if (!factsResp.ok) {
      return {
        cik,
        name: match.title,
        ticker: match.ticker,
        sic: "",
        sicDescription: "",
        stateOfIncorporation: "",
        filings: [],
      };
    }

    const facts = await factsResp.json();
    const recentFilings = (facts.filings?.recent?.form ?? [])
      .slice(0, 10)
      .map((form: string, i: number) => ({
        form,
        filingDate: facts.filings?.recent?.filingDate?.[i] ?? "",
        accessionNumber: facts.filings?.recent?.accessionNumber?.[i] ?? "",
      }));

    return {
      cik,
      name: facts.name ?? match.title,
      ticker: match.ticker,
      sic: facts.sic ?? "",
      sicDescription: facts.sicDescription ?? "",
      stateOfIncorporation: facts.stateOfIncorporation ?? "",
      filings: recentFilings,
    };
  } catch (err) {
    console.error("[EnrichmentService] SEC EDGAR fetch failed:", err);
    return null;
  }
}

/**
 * Search SEC EDGAR EFTS (full-text search) for filings matching a query.
 * Returns filing metadata from the EFTS search index.
 */
export async function searchSECFilings(
  companyName: string,
  formType?: string
): Promise<{
  status: "success" | "partial" | "error";
  filings: Array<{
    form: string;
    filingDate: string;
    companyName: string;
    cik: string;
    accessionNumber: string;
    fileUrl: string;
  }>;
  totalHits: number;
  edgarUrl: string;
  error?: string;
}> {
  const query = encodeURIComponent(companyName);
  const forms = formType || "10-K,10-Q,8-K";
  const edgarUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${query}%22&forms=${forms}`;

  try {
    // Try EFTS full-text search first
    const eftsResp = await fetch(
      `https://efts.sec.gov/LATEST/search-index?q=%22${query}%22&forms=${forms}&dateRange=custom&startdt=2022-01-01`,
      {
        headers: {
          "User-Agent": SEC_USER_AGENT,
          Accept: "application/json",
        },
      }
    );

    if (eftsResp.ok) {
      const data = await eftsResp.json();
      const hits = data?.hits?.hits ?? [];
      const filings = hits.slice(0, 10).map((hit: any) => ({
        form: hit._source?.form_type ?? "",
        filingDate: hit._source?.file_date ?? "",
        companyName: (hit._source?.display_names ?? [])[0] ?? companyName,
        cik: hit._source?.entity_id ?? "",
        accessionNumber: hit._source?.file_num ?? "",
        fileUrl: hit._source?.file_url
          ? `https://www.sec.gov/Archives/${hit._source.file_url}`
          : "",
      }));

      return {
        status: filings.length > 0 ? "success" : "partial",
        filings,
        totalHits: data?.hits?.total?.value ?? filings.length,
        edgarUrl,
      };
    }

    // Fallback: use company submissions endpoint
    const secCompany = await fetchSECCompany(companyName);
    if (secCompany && secCompany.filings.length > 0) {
      const filtered = formType
        ? secCompany.filings.filter((f) => f.form === formType)
        : secCompany.filings;

      return {
        status: filtered.length > 0 ? "success" : "partial",
        filings: filtered.map((f) => ({
          form: f.form,
          filingDate: f.filingDate,
          companyName: secCompany.name,
          cik: secCompany.cik,
          accessionNumber: f.accessionNumber,
          fileUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${secCompany.cik}&type=${f.form}`,
        })),
        totalHits: filtered.length,
        edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${secCompany.cik}&type=${formType || ""}`,
      };
    }

    return {
      status: "partial",
      filings: [],
      totalHits: 0,
      edgarUrl: `https://www.sec.gov/cgi-bin/browse-edgar?company=${query}&action=getcompany`,
      error: "No filings found via EFTS or submissions endpoint",
    };
  } catch (err) {
    return {
      status: "error",
      filings: [],
      totalHits: 0,
      edgarUrl,
      error: err instanceof Error ? err.message : "SEC search failed",
    };
  }
}

// ── BLS (Bureau of Labor Statistics) ────────────────────────────────────────

export interface BLSResult {
  industryEmployment: string;
  avgHourlyWage: string;
  laborTrend: string;
  sectorLabel: string;
}

/**
 * Map SIC 2-digit prefix to BLS CES super-sector series IDs.
 */
const SIC_TO_BLS_SECTOR: Record<
  string,
  { seriesId: string; wageSeriesId: string; label: string }
> = {
  "73": { seriesId: "CES6054000001", wageSeriesId: "CES6054000008", label: "Professional & Business Services" },
  "35": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "36": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "37": { seriesId: "CES3100000001", wageSeriesId: "CES3100000008", label: "Manufacturing" },
  "48": { seriesId: "CES5000000001", wageSeriesId: "CES5000000008", label: "Information" },
  "50": { seriesId: "CES4142000001", wageSeriesId: "CES4142000008", label: "Wholesale Trade" },
  "51": { seriesId: "CES4200000001", wageSeriesId: "CES4200000008", label: "Retail Trade" },
  "52": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "53": { seriesId: "CES5553000001", wageSeriesId: "CES5553000008", label: "Real Estate" },
  "60": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "61": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "62": { seriesId: "CES5552000001", wageSeriesId: "CES5552000008", label: "Finance & Insurance" },
  "70": { seriesId: "CES7000000001", wageSeriesId: "CES7000000008", label: "Leisure & Hospitality" },
  "72": { seriesId: "CES7000000001", wageSeriesId: "CES7000000008", label: "Leisure & Hospitality" },
  "80": { seriesId: "CES6562000001", wageSeriesId: "CES6562000008", label: "Health Care" },
  "82": { seriesId: "CES6561000001", wageSeriesId: "CES6561000008", label: "Educational Services" },
};

/**
 * Fetch BLS employment and wage data for a given SIC code.
 */
export async function fetchBLSData(
  sicCode: string | undefined
): Promise<BLSResult> {
  const result: BLSResult = {
    industryEmployment: "N/A",
    avgHourlyWage: "N/A",
    laborTrend: "N/A",
    sectorLabel: "N/A",
  };

  if (!sicCode) return result;

  const sicPrefix = sicCode.substring(0, 2);
  const mapping = SIC_TO_BLS_SECTOR[sicPrefix];
  if (!mapping) return result;

  result.sectorLabel = mapping.label;
  const currentYear = String(new Date().getFullYear());
  const prevYear = String(new Date().getFullYear() - 1);

  try {
    // Fetch employment data
    const empUrl = new URL("https://api.bls.gov/publicAPI/v2/timeseries/data/");
    empUrl.searchParams.set("seriesid", mapping.seriesId);
    empUrl.searchParams.set("startyear", prevYear);
    empUrl.searchParams.set("endyear", currentYear);

    const empResp = await fetch(empUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (empResp.ok) {
      const empData = await empResp.json();
      const series = empData?.Results?.series?.[0];
      if (series?.data?.length > 0) {
        const latestValue = parseFloat(series.data[0].value);
        result.industryEmployment = `${(latestValue / 1000).toFixed(1)}M`;

        if (series.data.length >= 12) {
          const currentVal = parseFloat(series.data[0].value);
          const yearAgoVal = parseFloat(series.data[11].value);
          const pctChange =
            ((currentVal - yearAgoVal) / yearAgoVal) * 100;
          result.laborTrend =
            pctChange >= 0
              ? `+${pctChange.toFixed(1)}% YoY`
              : `${pctChange.toFixed(1)}% YoY`;
        }
      }
    }

    // Fetch average hourly earnings
    const wageUrl = new URL("https://api.bls.gov/publicAPI/v2/timeseries/data/");
    wageUrl.searchParams.set("seriesid", mapping.wageSeriesId);
    wageUrl.searchParams.set("startyear", currentYear);
    wageUrl.searchParams.set("endyear", currentYear);

    const wageResp = await fetch(wageUrl.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (wageResp.ok) {
      const wageData = await wageResp.json();
      const wageSeries = wageData?.Results?.series?.[0];
      if (wageSeries?.data?.length > 0) {
        result.avgHourlyWage = `$${parseFloat(wageSeries.data[0].value).toFixed(2)}/hr`;
      }
    }
  } catch (err) {
    console.error("[EnrichmentService] BLS fetch failed:", err);
  }

  return result;
}

// ── Census Bureau ───────────────────────────────────────────────────────────

export interface CensusResult {
  marketSizeProxy: string;
  establishmentCount: string;
}

/**
 * Map SIC 2-digit prefix to NAICS 2-digit sector for Census CBP lookup.
 */
const SIC_TO_NAICS: Record<string, string> = {
  "73": "54",
  "35": "31",
  "36": "33",
  "37": "33",
  "48": "51",
  "50": "42",
  "51": "44",
  "52": "52",
  "53": "53",
  "60": "52",
  "61": "52",
  "62": "52",
  "70": "72",
  "72": "72",
  "80": "62",
  "82": "61",
};

/**
 * Fetch Census Bureau County Business Patterns data for a given SIC code.
 */
export async function fetchCensusData(
  sicCode: string | undefined
): Promise<CensusResult> {
  const result: CensusResult = {
    marketSizeProxy: "N/A",
    establishmentCount: "N/A",
  };

  if (!sicCode) return result;

  const sicPrefix = sicCode.substring(0, 2);
  const naicsCode = SIC_TO_NAICS[sicPrefix];
  if (!naicsCode) return result;

  try {
    const url = new URL("https://api.census.gov/data/2021/cbp");
    url.searchParams.set("get", "ESTAB,PAYANN,EMP");
    url.searchParams.set("for", "us:*");
    url.searchParams.set("NAICS2017", naicsCode);

    const resp = await fetch(url.toString(), {
      headers: { "Content-Type": "application/json" },
    });

    if (resp.ok) {
      const cbpData = await resp.json();

      if (Array.isArray(cbpData) && cbpData.length >= 2) {
        const headers = cbpData[0] as string[];
        const estabIdx = headers.indexOf("ESTAB");
        const payannIdx = headers.indexOf("PAYANN");

        let totalEstab = 0;
        let totalPayroll = 0;
        for (let i = 1; i < cbpData.length; i++) {
          const row = cbpData[i];
          if (estabIdx >= 0)
            totalEstab += parseInt(row[estabIdx] || "0", 10);
          if (payannIdx >= 0)
            totalPayroll += parseInt(row[payannIdx] || "0", 10);
        }

        if (totalEstab > 0) {
          result.establishmentCount = totalEstab.toLocaleString();
        }
        if (totalPayroll > 0) {
          const payrollBillions = (totalPayroll * 1000) / 1e9;
          result.marketSizeProxy = `$${payrollBillions.toFixed(1)}B annual payroll`;
        }
      }
    }
  } catch (err) {
    console.error("[EnrichmentService] Census fetch failed:", err);
  }

  return result;
}

// ── Yahoo Finance (via Manus Data API) ──────────────────────────────────────

export interface YahooFinanceResult {
  status: "success" | "partial" | "error";
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  employees: number | null;
  website: string;
  description: string;
  headquarters: string;
  revenue: string;
  marketCap: string;
  stockPrice: string;
  peRatio: string;
  dividendYield: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  exchange: string;
  currency: string;
  executives: Array<{ name: string; title: string }>;
  error?: string;
}

function fmt(val: unknown, fallback = "N/A"): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "object" && "fmt" in (val as any))
    return (val as any).fmt ?? fallback;
  if (typeof val === "object" && "raw" in (val as any))
    return String((val as any).raw);
  return String(val);
}

/** Map a company name to a likely stock ticker */
export function guessTickerFromName(name: string): string {
  const map: Record<string, string> = {
    salesforce: "CRM", microsoft: "MSFT", apple: "AAPL",
    google: "GOOGL", alphabet: "GOOGL", amazon: "AMZN",
    meta: "META", facebook: "META", tesla: "TSLA",
    nvidia: "NVDA", snowflake: "SNOW", servicenow: "NOW",
    workday: "WDAY", oracle: "ORCL", ibm: "IBM",
    sap: "SAP", adobe: "ADBE", cisco: "CSCO",
    intel: "INTC", amd: "AMD", netflix: "NFLX",
    uber: "UBER", airbnb: "ABNB", shopify: "SHOP",
    zoom: "ZM", palantir: "PLTR", crowdstrike: "CRWD",
    datadog: "DDOG", cloudflare: "NET", twilio: "TWLO",
    hubspot: "HUBS", atlassian: "TEAM", mongodb: "MDB",
    elastic: "ESTC", confluent: "CFLT", hashicorp: "HCP",
    paloalto: "PANW", fortinet: "FTNT", zscaler: "ZS",
    okta: "OKTA", splunk: "SPLK", vmware: "VMW",
    dell: "DELL", hp: "HPQ", accenture: "ACN",
    jpmorgan: "JPM", goldman: "GS", "goldman sachs": "GS",
    "bank of america": "BAC", walmart: "WMT", target: "TGT",
    costco: "COST", disney: "DIS", boeing: "BA",
    lockheed: "LMT", raytheon: "RTX", pfizer: "PFE",
    johnson: "JNJ", "johnson & johnson": "JNJ", unitedhealth: "UNH",
  };
  const lower = name.toLowerCase().trim();
  return map[lower] || name.toUpperCase().replace(/\s+/g, "").slice(0, 5);
}

/**
 * Fetch Yahoo Finance stock profile and financial data.
 * Uses the Manus Data API proxy (no API key needed).
 */
export async function fetchYahooFinance(
  companyNameOrTicker: string
): Promise<YahooFinanceResult> {
  const ticker = guessTickerFromName(companyNameOrTicker);

  const emptyResult: YahooFinanceResult = {
    status: "error",
    ticker,
    name: companyNameOrTicker,
    sector: "N/A",
    industry: "N/A",
    employees: null,
    website: "N/A",
    description: "N/A",
    headquarters: "N/A",
    revenue: "N/A",
    marketCap: "N/A",
    stockPrice: "N/A",
    peRatio: "N/A",
    dividendYield: "N/A",
    fiftyTwoWeekHigh: "N/A",
    fiftyTwoWeekLow: "N/A",
    exchange: "N/A",
    currency: "USD",
    executives: [],
  };

  try {
    const profile = (await callDataApi("YahooFinance/get_stock_profile", {
      query: { symbol: ticker, region: "US", lang: "en-US" },
    })) as any;

    if (!profile) return { ...emptyResult, error: "No data returned from Yahoo Finance" };

    const ap = profile?.assetProfile ?? {};
    const price = profile?.price ?? {};
    const sd = profile?.summaryDetail ?? {};
    const qt = profile?.quoteType ?? {};

    const hqParts = [ap.city, ap.state, ap.country].filter(Boolean);
    const executives = (ap.companyOfficers ?? [])
      .slice(0, 5)
      .map((o: any) => ({
        name: o.name ?? "Unknown",
        title: o.title ?? "Executive",
      }));

    const fieldCount =
      (ap.sector ? 1 : 0) + (ap.industry ? 1 : 0) +
      (ap.fullTimeEmployees ? 1 : 0) + (ap.website ? 1 : 0) +
      (ap.longBusinessSummary ? 1 : 0) + (price.regularMarketPrice ? 1 : 0) +
      (sd.marketCap ? 1 : 0);

    return {
      status: fieldCount > 3 ? "success" : "partial",
      ticker,
      name: qt.longName ?? qt.shortName ?? companyNameOrTicker,
      sector: ap.sector ?? "N/A",
      industry: ap.industry ?? "N/A",
      employees: ap.fullTimeEmployees ?? null,
      website: ap.website ?? "N/A",
      description: ap.longBusinessSummary ?? "N/A",
      headquarters: hqParts.length > 0 ? hqParts.join(", ") : "N/A",
      revenue: fmt(sd.totalRevenue ?? price.revenue),
      marketCap: fmt(sd.marketCap ?? price.marketCap),
      stockPrice: fmt(price.regularMarketPrice),
      peRatio: fmt(sd.trailingPE),
      dividendYield: fmt(sd.dividendYield),
      fiftyTwoWeekHigh: fmt(sd.fiftyTwoWeekHigh),
      fiftyTwoWeekLow: fmt(sd.fiftyTwoWeekLow),
      exchange: qt.exchange ?? "N/A",
      currency: price.currency ?? "USD",
      executives,
    };
  } catch (err) {
    return {
      ...emptyResult,
      error: err instanceof Error ? err.message : "Yahoo Finance fetch failed",
    };
  }
}

// ── LinkedIn (via Manus Data API) ───────────────────────────────────────────

export interface LinkedInResult {
  status: "success" | "partial" | "error";
  name: string;
  description: string;
  staffCount: number | null;
  industries: string[];
  specialties: string[];
  website: string;
  followerCount: number | null;
  founded: string;
  headquarters: string;
  linkedinUrl: string;
  error?: string;
}

/** Guess LinkedIn username from company name */
function guessLinkedInUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+$/, "")
    .replace(/^-+/, "");
}

/**
 * Fetch LinkedIn company details.
 * Uses the Manus Data API proxy.
 */
export async function fetchLinkedIn(
  companyName: string
): Promise<LinkedInResult> {
  const username = guessLinkedInUsername(companyName);

  const emptyResult: LinkedInResult = {
    status: "error",
    name: companyName,
    description: "N/A",
    staffCount: null,
    industries: [],
    specialties: [],
    website: "N/A",
    followerCount: null,
    founded: "N/A",
    headquarters: "N/A",
    linkedinUrl: "",
  };

  try {
    const lr = (await callDataApi("LinkedIn/get_company_details", {
      query: { username },
    })) as any;

    if (!lr || lr?.success === false) {
      return { ...emptyResult, error: "LinkedIn API returned no data" };
    }

    const data = lr?.data ?? lr;
    const hqParts = [
      data?.headquarter?.city,
      data?.headquarter?.geographicArea,
      data?.headquarter?.country,
    ].filter(Boolean);

    const fieldCount =
      (data?.name ? 1 : 0) + (data?.description ? 1 : 0) +
      (data?.staffCount ? 1 : 0) + (data?.website ? 1 : 0) +
      (data?.industries?.length ? 1 : 0) + (data?.specialities?.length ? 1 : 0);

    return {
      status: fieldCount > 2 ? "success" : "partial",
      name: data?.name ?? companyName,
      description: data?.description ?? "N/A",
      staffCount: data?.staffCount ?? null,
      industries: data?.industries ?? [],
      specialties: data?.specialities ?? [],
      website: data?.website ?? "N/A",
      followerCount: data?.followerCount ?? null,
      founded: data?.foundedOn?.year ? String(data.foundedOn.year) : "N/A",
      headquarters: hqParts.length > 0 ? hqParts.join(", ") : "N/A",
      linkedinUrl: data?.linkedinUrl ?? data?.url ?? "",
    };
  } catch (err) {
    return {
      ...emptyResult,
      error: err instanceof Error ? err.message : "LinkedIn fetch failed",
    };
  }
}

// ── Full Enrichment Pipeline ────────────────────────────────────────────────

export interface FullEnrichmentResult {
  companyName: string;
  ticker: string;
  industry: string;
  sector: string;
  sicCode: string;
  sicDescription: string;
  employees: number | null;
  headquarters: string;
  website: string;
  description: string;
  revenue: string;
  marketCap: string;
  stockPrice: string;
  industryEmployment: string;
  avgIndustryWage: string;
  laborTrend: string;
  marketSizeProxy: string;
  establishmentCount: string;
  executives: Array<{ name: string; title: string }>;
  recentFilings: Array<{ form: string; filingDate: string; accessionNumber: string }>;
  sources: Array<{ name: string; status: "success" | "partial" | "error"; fieldsFound: number }>;
  confidence: number;
}

/**
 * Run the full 5-source enrichment pipeline directly (no HTTP loopback).
 * SEC EDGAR → Yahoo Finance + LinkedIn (parallel) → BLS + Census (parallel)
 */
export async function runFullEnrichment(
  companyName: string
): Promise<FullEnrichmentResult> {
  const sources: FullEnrichmentResult["sources"] = [];

  // Stage 1: SEC EDGAR
  const secData = await fetchSECCompany(companyName);
  if (secData) {
    const fields = [secData.name, secData.ticker, secData.sic, secData.sicDescription, secData.stateOfIncorporation, secData.filings?.[0]].filter(Boolean).length;
    sources.push({ name: "SEC EDGAR", status: fields > 2 ? "success" : "partial", fieldsFound: fields });
  } else {
    sources.push({ name: "SEC EDGAR", status: "error", fieldsFound: 0 });
  }

  const ticker = secData?.ticker || guessTickerFromName(companyName);
  const sicCode = secData?.sic || "";

  // Stage 2: Yahoo Finance + LinkedIn (parallel)
  const [yahooResult, linkedinResult] = await Promise.allSettled([
    fetchYahooFinance(ticker),
    fetchLinkedIn(companyName),
  ]);

  const yahoo = yahooResult.status === "fulfilled" ? yahooResult.value : null;
  const linkedin = linkedinResult.status === "fulfilled" ? linkedinResult.value : null;

  if (yahoo) {
    const fields = yahoo.status === "success" ? 7 : yahoo.status === "partial" ? 3 : 0;
    sources.push({ name: "Yahoo Finance", status: yahoo.status, fieldsFound: fields });
  } else {
    sources.push({ name: "Yahoo Finance", status: "error", fieldsFound: 0 });
  }

  if (linkedin) {
    const fields = linkedin.status === "success" ? 5 : linkedin.status === "partial" ? 2 : 0;
    sources.push({ name: "LinkedIn", status: linkedin.status, fieldsFound: fields });
  } else {
    sources.push({ name: "LinkedIn", status: "error", fieldsFound: 0 });
  }

  // Stage 3: BLS + Census (parallel)
  const [blsResult, censusResult] = await Promise.allSettled([
    fetchBLSData(sicCode || undefined),
    fetchCensusData(sicCode || undefined),
  ]);

  const bls = blsResult.status === "fulfilled" ? blsResult.value : null;
  const census = censusResult.status === "fulfilled" ? censusResult.value : null;

  if (bls) {
    const fields = [bls.industryEmployment !== "N/A" ? 1 : 0, bls.avgHourlyWage !== "N/A" ? 1 : 0, bls.laborTrend !== "N/A" ? 1 : 0].reduce((a, b) => a + b, 0);
    sources.push({ name: "BLS", status: fields > 0 ? "success" : "partial", fieldsFound: fields });
  } else {
    sources.push({ name: "BLS", status: "error", fieldsFound: 0 });
  }

  if (census) {
    const fields = [census.marketSizeProxy !== "N/A" ? 1 : 0, census.establishmentCount !== "N/A" ? 1 : 0].reduce((a, b) => a + b, 0);
    sources.push({ name: "Census Bureau", status: fields > 0 ? "success" : "partial", fieldsFound: fields });
  } else {
    sources.push({ name: "Census Bureau", status: "error", fieldsFound: 0 });
  }

  // Calculate confidence
  const totalFields = sources.reduce((sum, s) => sum + s.fieldsFound, 0);
  const maxPossible = 6 + 7 + 5 + 3 + 2; // SEC + Yahoo + LinkedIn + BLS + Census
  const confidence = Math.round((totalFields / maxPossible) * 100);

  return {
    companyName: linkedin?.name ?? yahoo?.name ?? secData?.name ?? companyName,
    ticker,
    industry: yahoo?.industry ?? secData?.sicDescription ?? (linkedin?.industries ?? [])[0] ?? "N/A",
    sector: yahoo?.sector ?? "N/A",
    sicCode,
    sicDescription: secData?.sicDescription ?? "",
    employees: yahoo?.employees ?? linkedin?.staffCount ?? null,
    headquarters: yahoo?.headquarters ?? linkedin?.headquarters ?? "N/A",
    website: yahoo?.website ?? linkedin?.website ?? "N/A",
    description: yahoo?.description ?? linkedin?.description ?? "N/A",
    revenue: yahoo?.revenue ?? "N/A",
    marketCap: yahoo?.marketCap ?? "N/A",
    stockPrice: yahoo?.stockPrice ?? "N/A",
    industryEmployment: bls?.industryEmployment ?? "N/A",
    avgIndustryWage: bls?.avgHourlyWage ?? "N/A",
    laborTrend: bls?.laborTrend ?? "N/A",
    marketSizeProxy: census?.marketSizeProxy ?? "N/A",
    establishmentCount: census?.establishmentCount ?? "N/A",
    executives: yahoo?.executives ?? [],
    recentFilings: secData?.filings ?? [],
    sources,
    confidence,
  };
}
