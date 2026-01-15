# Ground Truth Data & Value Model Datasets

**Version:** 1.0
**Last Updated:** 2026-01-15
**Maintainer:** AI Implementation Team
**Status:** Production Ready

---

## Overview

ValueOS employs a **Ground Truth Benchmark Layer** - a deterministic, zero-hallucination data architecture that eliminates manual research and hallucinated baselines. All financial and operational assumptions used in value modeling are sourced from authoritative, whitelisted datasets with full provenance tracking.

### Mission Statement

Replace manual spreadsheet research and AI hallucinations with **transparent, defensible, auditable** financial data that CFOs can trust.

---

## Architecture: Tiered Truth Model

ValueOS implements a three-tiered data hierarchy that guarantees reliability and transparency:

```text
┌─────────────────────────────────────────────────────────────┐
│ Tier 1: Authoritative Public Data (Confidence: 0.9-1.0)   │
│ SEC EDGAR, XBRL, Legally Binding Financial Filings         │
└─────────────────────────────────────────────────────────────┘
                          ↓ Fallback
┌─────────────────────────────────────────────────────────────┐
│ Tier 2: High-Confidence Private Data (Confidence: 0.5-0.85)│
│ Crunchbase, ZoomInfo, Census, Inferred Ranges             │
└─────────────────────────────────────────────────────────────┘
                          ↓ Fallback
┌─────────────────────────────────────────────────────────────┐
│ Tier 3: Narrative/Contextual Data (Confidence: 0.2-0.6)   │
│ Industry Benchmarks, Wage Data, Market Trends             │
└─────────────────────────────────────────────────────────────┘
```

### Resolution Hierarchy

1. **Try Tier 1 (EDGAR/XBRL)** - If public company data exists, use it (highest priority)
2. **Fallback to Tier 2 (Market/Private)** - If Tier 1 unavailable
3. **Fallback to Tier 3 (Benchmarks)** - For contextual data only (lowest priority)

EDGAR/XBRL data **always overrides** all other sources when available.

---

## Data Sources by Tier

### Tier 1: Authoritative Public Data

**Characteristics:**

- Legally binding GAAP/IFRS financial statements
- Confidence scores: 0.9-1.0
- Full provenance: Filing type, accession number, filing date
- Update frequency: Real-time as SEC filings are released

#### 1.1 SEC EDGAR (U.S. Securities and Exchange Commission)

**Type:** Regulatory Financial Filings
**Coverage:** ~10,000 U.S. public companies
**Base URL:** `https://www.sec.gov/cgi-bin/browse-edgar`
**Rate Limit:** 10 requests/second
**Authentication:** None (requires User-Agent header)

**Available Data:**

- Quarterly reports (10-Q)
- Annual reports (10-K)
- Registration statements (S-1, S-4)
- Current reports (8-K)
- Proxy statements (DEF 14A)

**Key Metrics Extracted:**

```typescript
{
  // Income Statement
  revenue_total: number;
  cost_of_revenue: number;
  gross_profit: number;
  operating_income: number;
  net_income: number;
  ebitda: number;

  // Balance Sheet
  total_assets: number;
  total_liabilities: number;
  shareholders_equity: number;
  cash_and_equivalents: number;
  total_debt: number;

  // Cash Flow
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  free_cash_flow: number;

  // Per Share
  earnings_per_share: number;
  book_value_per_share: number;
}
```

**Implementation:**

- Module: `EDGARModule.ts`
- CIK (Central Index Key) used as primary identifier
- Ticker symbol resolution to CIK via mapping table
- Automated filing type detection (10-K vs 10-Q)

#### 1.2 XBRL (eXtensible Business Reporting Language)

**Type:** Structured Financial Data Format
**Coverage:** Same as SEC EDGAR (mandatory for large filers)
**Confidence:** 0.95-1.0
**Update Frequency:** Same as source filing

**Advantages:**

- Machine-readable structured data
- Standardized taxonomy (US-GAAP, IFRS)
- Deterministic extraction (no NLP required)
- Fact-level precision with units and contexts

**Implementation:**

- Module: `XBRLModule.ts`
- Parser: Custom XBRL taxonomy navigator
- Validation: Schema validation against US-GAAP/IFRS standards
- Fallback: If XBRL unavailable, parse HTML/text filings

**Extraction Confidence Scoring:**

```typescript
if (metric.extracted_from === "xbrl") {
  confidence = 0.97; // Structured, unambiguous
} else if (metric.extracted_from === "html_table") {
  confidence = 0.85; // Parsed from HTML
} else if (metric.extracted_from === "text_nlp") {
  confidence = 0.7; // NLP extraction
}
```

---

### Tier 2: High-Confidence Private Data

**Characteristics:**

- Private company estimates and inferred ranges
- Confidence scores: 0.5-0.85
- Proxy-based estimation (headcount, web traffic, funding)
- Update frequency: Monthly to quarterly

#### 2.1 Crunchbase (Private Company Data)

**Type:** Venture-backed Company Database
**Coverage:** ~1M+ startups and private companies
**API:** Crunchbase Enterprise API
**Environment Variable:** `CRUNCHBASE_API_KEY`

**Available Data:**

- Funding rounds and total capital raised
- Headcount estimates
- Industry classification (NAICS mapping)
- Leadership and board members
- Acquisition and IPO history

**Estimation Methodology:**

```typescript
// Revenue estimation for private companies
revenue_estimate = {
  lower_bound: headcount × industry_revenue_per_employee × 0.8,
  upper_bound: headcount × industry_revenue_per_employee × 1.2,
  confidence: 0.65,
  rationale: "Estimated using headcount proxy method"
}
```

#### 2.2 ZoomInfo / LinkedIn (Headcount Data)

**Type:** B2B Contact and Company Intelligence
**Coverage:** ~65M companies globally
**Environment Variable:** `ZOOMINFO_API_KEY`, `LINKEDIN_API_KEY`

**Available Data:**

- Real-time employee counts
- Department-level headcount (Sales, Engineering, etc.)
- Growth rate trends
- Job posting velocity

**Use Cases:**

- Private company revenue estimation
- Operational efficiency benchmarking
- Competitive intelligence

#### 2.3 U.S. Census Bureau (Industry Benchmarks)

**Type:** Government Economic Statistics
**Coverage:** All U.S. industries (NAICS codes)
**Base URL:** `https://api.census.gov/data`
**Authentication:** API Key (optional)

**Available Data:**

- Industry-level revenue per employee
- Median wages by industry and geography
- Number of firms by size category
- Economic census data (every 5 years)

**Datasets Used:**

- **County Business Patterns (CBP):** Annual employment and payroll
- **Economic Census:** Comprehensive industry statistics
- **Annual Survey of Manufacturers:** Manufacturing-specific metrics

#### 2.4 Bureau of Labor Statistics (Wage Data)

**Type:** Labor Market Statistics
**Coverage:** All U.S. occupations and industries
**Base URL:** `https://api.bls.gov/publicAPI/v2`
**Environment Variable:** `BLS_API_KEY`

**Available Data:**

- Median hourly/annual wages by occupation (SOC codes)
- Wage by percentile (P10, P25, P50, P75, P90)
- Geographic wage differentials
- Employment growth projections

**Use Cases:**

- Labor cost benchmarking
- Productivity delta calculations
- Cost modeling for workforce changes

---

### Tier 3: Narrative & Contextual Data

**Characteristics:**

- Industry trends and qualitative insights
- Confidence scores: 0.2-0.6
- Used for context, not direct calculations
- Update frequency: Quarterly to annually

#### 3.1 Market Data Providers

**Alpha Vantage** (Free/Premium)

- Real-time stock prices
- Historical market data
- Technical indicators
- Environment Variable: `ALPHA_VANTAGE_API_KEY`

**Polygon.io** (Premium)

- Market data at scale
- Real-time and historical prices
- Options and derivatives data
- Environment Variable: `POLYGON_API_KEY`

#### 3.2 Industry Research Reports

**Sources:**

- Gartner Magic Quadrants
- Forrester Wave Reports
- IDC Market Analysis
- McKinsey Industry Reports

**Usage:**

- Qualitative context for value propositions
- Trend analysis and market sizing
- Competitive positioning
- **NOT used for direct financial calculations**

**Implementation:**

- Manually curated research database
- Tagged with confidence scores (0.3-0.5)
- Referenced in narrative outputs only

---

## Data Contracts & Schemas

### Standard Financial Metric Format

All modules return data in a standardized `FinancialMetric` object:

```typescript
interface FinancialMetric {
  // Core data
  type: "metric" | "range" | "text" | "narrative";
  metric_name: string;
  value: number | string | [number, number]; // Range for private companies
  unit: string; // 'USD', 'employees', 'percentage', etc.

  // Trust and quality
  confidence: number; // 0.0 to 1.0
  tier: "tier1" | "tier2" | "tier3";

  // Provenance
  source: string;
  source_name?: string;
  timestamp: string; // ISO 8601

  // Additional context
  metadata: {
    filing_type?: string; // For Tier 1
    accession_number?: string; // For Tier 1
    estimation_method?: string; // For Tier 2
    industry_code?: string; // NAICS code
    quality_factors?: number[]; // Adjustment multipliers
  };

  // Audit trail
  raw_extract?: string;
  provenance: ProvenanceInfo;
  verification_hash?: string; // SHA-256 of raw data
}
```

### Provenance Tracking

```typescript
interface ProvenanceInfo {
  trace_id: string; // Unique request ID
  module_name: string; // Which module generated this
  query_timestamp: string;
  data_timestamp: string; // When underlying data was published
  cache_hit: boolean;
  execution_time_ms: number;
}
```

---

## Value Model Integration

### How Ground Truth Powers Value Drivers

Value drivers in ValueOS are grounded in real data using this workflow:

```typescript
// 1. Extract value driver from discovery conversation
const driver: ValueDriver = {
  category: "cost",
  subcategory: "labor_efficiency",
  name: "Reduce invoice processing time",
  economic_mechanism: "linear",
  // ... other fields
};

// 2. Fetch benchmark data from Ground Truth
const benchmark = await mcpServer.executeTool("get_industry_benchmark", {
  identifier: "541511", // NAICS: Custom Computer Programming
  metric: "invoice_processing_cost_per_invoice",
});

// 3. Attach benchmark to driver
driver.benchmarks = [
  {
    source: "census",
    benchmark_id: "apqc_invoice_processing_p50",
    value: 5.83,
    unit: "USD",
    percentile: 50,
    industry: "541511",
  },
];

// 4. Calculate baseline gap
driver.baseline_value = 12.5; // From customer
driver.target_value = 5.83; // Benchmark P50
driver.expected_delta = 12.5 - 5.83; // $6.67 savings per invoice

// 5. Calculate financial impact
const invoiceVolume = 50000; // Annual invoices
driver.financial_impact = {
  annual_value: driver.expected_delta * invoiceVolume,
  currency: "USD",
  calculation_method: "linear: (baseline - target) × volume",
  confidence: benchmark.confidence, // Inherited from source
};
```

### Benchmark Agent Integration

The `BenchmarkAgent` (`src/lib/agent-fabric/agents/BenchmarkAgent.ts`) uses ground truth data to:

1. **Position KPIs** against industry percentiles (P25, P50, P75)
2. **Identify gaps** to median and best-in-class
3. **Quantify opportunities** with confidence scores
4. **Cite sources** for all benchmark claims

**Example Invocation:**

```typescript
const result = await benchmarkAgent.execute(sessionId, {
  industry: "541511",
  companySize: "enterprise",
  kpis: [
    { name: "revenue_per_employee", currentValue: 200000, unit: "USD" },
    { name: "sales_cycle_days", currentValue: 45, unit: "days" },
  ],
});

// Result includes:
result.comparisons[0] = {
  kpiName: "revenue_per_employee",
  currentValue: 200000,
  benchmarks: {
    median: 250000, // P50 from Census data
    p25: 180000, // P25
    p75: 320000, // P75
    bestInClass: 450000, // P90
  },
  percentile: 40,
  gapToMedian: -50000,
  status: "lagging",
  dataSources: ["U.S. Census Bureau - Economic Census 2022"],
};
```

---

## MCP Financial Ground Truth Server

### Implementation Details

**Module:** `src/mcp-ground-truth/`
**Version:** 2.1.0-Enterprise
**Standard:** Model Context Protocol (MCP) v1.0
**Security Level:** IL4 (Controlled Unclassified Information)

### Core Services

#### 1. `get_authoritative_financials` (Tier 1)

Retrieves legally binding GAAP financial data from SEC EDGAR.

```typescript
await mcpServer.executeTool("get_authoritative_financials", {
  entity_id: "0000320193", // CIK or ticker (AAPL)
  period: "FY2024",
  metrics: ["revenue_total", "net_income", "gross_profit"],
});
```

**Returns:**

- Tier 1 confidence (0.95-1.0)
- Filing metadata (10-K, 10-Q, accession number)
- Verification hash for audit trail

#### 2. `get_private_entity_estimates` (Tier 2)

Generates financial estimates for private companies.

```typescript
await mcpServer.executeTool("get_private_entity_estimates", {
  domain: "openai.com",
  proxy_metric: "headcount_linkedin",
  industry_code: "541511",
});
```

**Estimation Methods:**

- Headcount proxy: `revenue = headcount × industry_avg_revenue_per_employee`
- Funding-based: `revenue = total_funding_raised × industry_funding_to_revenue_ratio`
- Quality factors applied for adjustments

#### 3. `verify_claim_aletheia` (Verification)

Cross-references natural language claims against ground truth.

```typescript
await mcpServer.executeTool("verify_claim_aletheia", {
  claim_text: "Apple generated $383B in revenue in FY2024",
  context_entity: "0000320193",
  strict_mode: true,
});
```

**The Aletheia Loop Pattern:**

> Before outputting final responses, AI agents pass draft summaries to `verify_claim_aletheia`. If `verified` is `false`, agents rewrite using provided `evidence_snippet`.

**Result:**

```typescript
{
  verified: true,
  confidence: 0.97,
  evidence: {
    metric: 'revenue_total',
    value: 383285000000,
    source: 'xbrl-parser',
    tier: 'tier1'
  }
}
```

#### 4. `populate_value_driver_tree` (Value Engineering)

Calculates productivity deltas for value driver analysis.

```typescript
await mcpServer.executeTool("populate_value_driver_tree", {
  target_cik: "0000320193",
  benchmark_naics: "541511",
  driver_node_id: "productivity_delta",
  simulation_period: "2025-2027",
});
```

**Returns:**

- Calculated gap between target and benchmark
- Supporting data with provenance
- Rationale and confidence scores

---

## Security & Compliance

### Whitelisted Domains

Only approved data sources can be accessed:

```typescript
const ALLOWED_DOMAINS = [
  "sec.gov", // SEC EDGAR
  "alphavantage.co", // Market data
  "polygon.io", // Market data
  "census.gov", // Industry benchmarks
  "bls.gov", // Wage data
  "crunchbase.com", // Private company data
];
```

Any attempt to access non-whitelisted domains is **rejected**.

### Rate Limiting

Provider-specific rate limits enforced:

```typescript
const RATE_LIMITS = {
  "sec.gov/edgar": { requests: 10, window: "1s" },
  "alphavantage.co": { requests: 5, window: "1m" },
  "census.gov": { requests: 500, window: "1d" },
};
```

### Audit Logging

All requests logged with:

- Trace ID (distributed tracing)
- User/Agent ID
- Request parameters
- Response data
- Execution time
- Data tier and confidence
- Verification hash (SHA-256)

---

## Agent Rules: Zero-Hallucination Enforcement

### Rule 1: The Citation Imperative

> "You are **forbidden** from generating specific financial figures from your internal training data. You **must** invoke `get_authoritative_financials` for every numeric claim. If the tool returns `null`, state that data is unavailable."

### Rule 2: Tiered Trust Handling

> "Check the `source_tier` in the JSON response:
>
> - **Tier 1:** State as fact. _'Revenue was $10B [Source: SEC 10-K]'_
> - **Tier 2:** State as estimate. _'Revenue is estimated at $8-12B based on headcount'_
> - **Tier 3:** Use for context only. _'Industry benchmark is $250k/employee'_"

### Rule 3: The Aletheia Loop

> "Before outputting the final response, pass your draft summary to `verify_claim_aletheia`. If `verified` is `false`, rewrite the claim using the provided `evidence_snippet`."

---

## Performance Targets

| Operation                | Target Latency | Cache Hit Latency       |
| ------------------------ | -------------- | ----------------------- |
| EDGAR fetch              | ~250ms         | ~30ms                   |
| XBRL parse               | ~60ms          | N/A (cached with fetch) |
| Market API               | ~80ms          | ~20ms                   |
| Private company estimate | 120-300ms      | ~40ms                   |
| **Total round-trip**     | **<400ms**     | **<100ms**              |

### Caching Strategy

- **EDGAR filings:** 24-hour cache (filings don't change)
- **Market data:** 15-minute cache (real-time updates)
- **Benchmarks:** 30-day cache (stable over time)
- **Private estimates:** 7-day cache (monthly updates)

---

## Testing & Validation

### Test Coverage

**Unit Tests:** Module-level validation

- `EDGARModule.test.ts`
- `XBRLModule.test.ts`
- `PrivateCompanyModule.test.ts`

**Integration Tests:** End-to-end workflows

- `tests/test/mcp-ground-truth/phase1-analyst-developer.test.ts`
- `tests/test/mcp-ground-truth/phase2-ai-query-generation.test.ts`

**Test Plans:**

- `tests/test/mcp-ground-truth/TEST_PLAN.md` - Comprehensive 3-phase test plan
- `tests/test/mcp-ground-truth/TEST_EXECUTION_GUIDE.md` - Execution instructions

### Quality Assurance Phases

1. **Phase 1:** Data Connectivity & SQL (QA-FE-001 to QA-FE-005)
2. **Phase 2:** AI Query Generation (QA-AI-001 to QA-AI-003)
3. **Phase 3:** Integration & Governance (QA-INT-001, QA-GOV-001, QA-GOV-002)

---

## Data Freshness & Updates

| Data Source        | Update Frequency    | Data Latency                |
| ------------------ | ------------------- | --------------------------- |
| SEC EDGAR (10-Q)   | Quarterly + 45 days | Real-time as filed          |
| SEC EDGAR (10-K)   | Annual + 90 days    | Real-time as filed          |
| Market Data        | Continuous          | 15-minute delay (free tier) |
| Census Benchmarks  | Annual              | 6-12 month lag              |
| BLS Wage Data      | Annual              | 3-6 month lag               |
| Crunchbase         | Daily               | Real-time                   |
| LinkedIn Headcount | Weekly              | 7-day lag                   |

### Staleness Detection

```typescript
if (dataAge > 90 days && tier === 'tier1') {
  confidence *= 0.9; // Reduce confidence for stale data
  metadata.staleness_warning = 'Data older than 90 days';
}
```

---

## Future Enhancements

Planned improvements to ground truth infrastructure:

- [ ] **LLM-based structured extraction** for non-XBRL filings
- [ ] **Sector-specific benchmark enrichment** (SaaS, Manufacturing, Healthcare)
- [ ] **Automated peer set detection** using industry classification
- [ ] **Real-time filing alerts** via SEC RSS feeds
- [ ] **Multi-currency support** with exchange rate APIs
- [ ] **Historical trend analysis** for 5-year KPI trajectories
- [ ] **Predictive analytics integration** for forward-looking estimates

---

## Related Documentation

- **`index.md`** - ValueOS overview and architecture
- **`agents.md`** - Agent system and orchestration
- **`database.md`** - Database schema for value drivers
- **`frontend.md`** - UI components for value visualization
- **`security.md`** - Authentication and data protection

**MCP Ground Truth Server:**

- `src/mcp-ground-truth/README.md` - Technical implementation guide
- `src/mcp-ground-truth/QUICK_START.md` - Getting started guide
- `tests/test/mcp-ground-truth/TEST_PLAN.md` - QA test plan

---

**Last Updated:** 2026-01-15
**Maintainer:** AI Implementation Team
**Status:** Production Ready
