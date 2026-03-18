# Ground Truth Specification

## Purpose

The Ground Truth system provides verified financial data, industry benchmarks, and SEC filing integration that agents use for benchmark-constrained reasoning, claim verification, and plausibility testing. It is the authoritative data backbone for the trust layer.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §10.3, §12.1, §12.5
Consolidated from: `conductor/tracks/mcp-ground-truth/spec.md`, `conductor/tracks/rag-grounding/spec.md`

## Requirements

### Requirement: SEC EDGAR filing retrieval and extraction

The system SHALL retrieve and extract structured data from SEC EDGAR filings for public companies.

#### Scenario: 10-K retrieval by ticker

- GIVEN a public company ticker or CIK
- WHEN the system fetches SEC filings
- THEN it retrieves the latest 10-K (annual) and 10-Q (quarterly) filings
- AND extracts key business sections: Item 1 (Business), Item 1A (Risk Factors), Item 7 (MD&A)

#### Scenario: XBRL fact extraction

- GIVEN a SEC filing is available in XBRL format
- WHEN structured data extraction runs
- THEN the system extracts GAAP-tagged financial facts (revenue, net income, margins, assets)
- AND provides historical trend data across multiple periods

#### Scenario: Ticker resolution from domain

- GIVEN a company website domain
- WHEN the system needs financial data
- THEN it resolves the corporate domain to a public ticker where possible
- AND falls back gracefully when the company is not publicly traded

### Requirement: Industry benchmark retrieval

The system SHALL provide contextual industry benchmarks as probabilistic distributions.

#### Scenario: Benchmark by industry and size

- GIVEN an account with known industry (e.g., SaaS) and company size
- WHEN benchmarks are requested for a KPI
- THEN the system returns p25/p50/p75/p90 distributions
- AND each benchmark includes: source, date, sample size, and confidence

#### Scenario: Size-adjusted benchmarks

- GIVEN a company with known revenue range or headcount
- WHEN size-adjusted benchmarks are requested
- THEN the system adjusts benchmark ranges for the company's size tier
- AND documents the adjustment methodology

#### Scenario: Persona-specific KPIs

- GIVEN a buyer persona (CFO, CIO, VP Ops)
- WHEN persona-relevant KPIs are requested
- THEN the system returns KPIs most relevant to that persona's priorities
- AND ranks them by typical importance

### Requirement: Claim verification against ground truth

The system SHALL verify financial claims against authoritative data sources.

#### Scenario: Claim matches filing data

- GIVEN an agent produces a claim referencing a financial metric
- WHEN the claim is verified against SEC filing data
- THEN the system confirms alignment and reports the verification result with source citation

#### Scenario: Claim contradicts filing data

- GIVEN an agent produces a claim that contradicts SEC filing data
- WHEN verification runs
- THEN the system flags the discrepancy with severity classification
- AND provides the authoritative value and source reference

#### Scenario: No authoritative data available

- GIVEN a claim references a metric with no authoritative source
- WHEN verification runs
- THEN the system reports that verification is not possible
- AND the claim's confidence score is penalized accordingly

### Requirement: Feasibility assessment

The system SHOULD assess whether a proposed KPI improvement is realistically achievable.

#### Scenario: Improvement within feasible range

- GIVEN a value driver proposes improving a KPI from X to Y
- WHEN feasibility is assessed against benchmarks
- THEN the system determines whether the improvement falls within historical improvement ranges
- AND classifies feasibility as achievable, stretch, or unrealistic

### Requirement: RAG-backed retrieval for agent context

The system SHALL support vector-backed retrieval of ingested content for agent reasoning.

#### Scenario: Semantic search over ingested content

- GIVEN SEC filings, web content, and benchmark data have been chunked, embedded, and stored
- WHEN an agent needs contextual information for reasoning
- THEN it performs a semantic search over the vector store
- AND results include source metadata (tier, URL, date) for provenance tracking

#### Scenario: Retrieval scoped to tenant

- GIVEN vector content is stored with tenant metadata
- WHEN retrieval runs
- THEN results are filtered to the requesting tenant's data only

### Requirement: Circuit breaker and fallback

The system SHALL implement resilience patterns for external data sources.

#### Scenario: External API failure

- GIVEN the SEC EDGAR API or a benchmark provider is unavailable
- WHEN a data request is made
- THEN the circuit breaker prevents repeated failed calls
- AND the system falls back to cached data where available
- AND the fallback is logged with a freshness warning

### Requirement: Caching

The system SHALL cache external data retrievals to reduce latency and API load.

#### Scenario: Cached response served

- GIVEN a previous retrieval for the same company and metric exists in cache
- WHEN the same data is requested within the cache TTL
- THEN the cached response is returned
- AND the response indicates it was served from cache with the original retrieval timestamp
