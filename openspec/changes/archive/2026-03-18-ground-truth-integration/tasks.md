# Tasks

## 1. SEC EDGAR Client

- [x] 1.1 Implement `SECEdgarClient` with SEC EDGAR API integration
- [x] 1.2 Map company domain/name to CIK or Ticker
- [x] 1.3 Fetch latest 10-K (annual) and 10-Q (quarterly) filings
- [x] 1.4 Extract key business sections: Item 1 (Business), Item 1A (Risk Factors), Item 7 (MD&A)
- [x] 1.5 Add circuit breaker with configurable failure threshold
- [x] 1.6 Add Redis cache with 24-hour TTL for filing data
- [x] 1.7 Graceful fallback when company is not publicly traded

## 2. XBRL Parser

- [x] 2.1 Implement `XBRLParser` for SEC companyfacts API
- [x] 2.2 Extract GAAP-tagged financial facts: revenue, net income, margins, assets, liabilities
- [x] 2.3 Parse XBRL taxonomy and map to standard metric names
- [x] 2.4 Provide historical trend data across multiple periods (up to 5 years)
- [x] 2.5 Handle XBRL validation errors gracefully
- [x] 2.6 Return structured `XBRLFact[]` with period, value, unit, and GAAP tag

## 3. Benchmark Retrieval Service

- [x] 3.1 Implement `BenchmarkRetrievalService`
- [x] 3.2 Retrieve industry benchmarks as p25/p50/p75/p90 distributions
- [x] 3.3 Accept industry, company size, and KPI as query parameters
- [x] 3.4 Each benchmark includes: source, date, sample size, confidence
- [x] 3.5 Support size-adjusted benchmarks (adjust ranges for company size tier)
- [x] 3.6 Support persona-specific KPI retrieval (CFO, CIO, VP Ops priorities)
- [x] 3.7 Add circuit breaker and cache for benchmark provider APIs

## 4. Chunk and Embed Pipeline

- [x] 4.1 Implement `ChunkEmbedPipeline` for semantic chunking
- [x] 4.2 Chunk SEC filings by section with overlap
- [x] 4.3 Chunk web content by paragraph with metadata (source URL, page title)
- [x] 4.4 Embed chunks using configured embedding model
- [x] 4.5 Store in `semantic_memory` table with metadata: source, tier, tenant_id, date, source_url
- [x] 4.6 Add to `ResearchJobWorker` pipeline: crawl → chunk → embed

## 5. Vector Search Enhancement

- [x] 5.1 Modify `VectorSearchService` for tenant-scoped retrieval
- [x] 5.2 All queries MUST filter on tenant_id in metadata
- [x] 5.3 Return results with source metadata (tier, URL, date) for provenance
- [x] 5.4 Support similarity threshold filtering

## 6. Claim Verification Service

- [x] 6.1 Implement `ClaimVerificationService`
- [x] 6.2 Accept a claim (metric + value) and verify against authoritative sources
- [x] 6.3 If match: return verification result with source citation
- [x] 6.4 If contradiction: flag discrepancy with severity, provide authoritative value and source
- [x] 6.5 If no authoritative data: report unverifiable, penalize confidence score
- [x] 6.6 Wire into IntegrityAgent validation pipeline

## 7. Feasibility Assessor

- [x] 7.1 Implement `FeasibilityAssessor`
- [x] 7.2 Given a proposed KPI improvement (from X to Y), assess against historical improvement ranges
- [x] 7.3 Classify: achievable, stretch, or unrealistic
- [x] 7.4 Include benchmark reference in classification

## 8. GroundTruth Agent Hardening

- [x] 8.1 Modify `GroundtruthAnalyzer` to perform vector search before LLM call (RAG pattern)
- [x] 8.2 Use `MCPGroundTruthService` to verify specific financial claims during value case loop
- [x] 8.3 Adjust confidence scores based on Tier-1 (SEC) vs Tier-3 (internal) grounding

## 9. Cache Layer

- [x] 9.1 Implement `GroundTruthCache` with Redis backend
- [x] 9.2 Cache SEC filing data with 24-hour TTL
- [x] 9.3 Cache benchmark data with 1-hour TTL
- [x] 9.4 Include original retrieval timestamp in cached responses
- [x] 9.5 Indicate cache hit/miss in response metadata

## 10. Integration with Deal Assembly

- [x] 10.1 Wire SEC EDGAR fetch into deal assembly pipeline for public companies
- [x] 10.2 Add optional Ticker/CIK input in onboarding wizard
- [x] 10.3 Show user which sources were used ("Found your 2024 10-K")
- [x] 10.4 Tag SEC-derived suggestions with Tier 1 evidence

## 11. Tests

- [x] 11.1 Unit test SECEdgarClient with mocked EDGAR API responses
- [x] 11.2 Unit test XBRLParser with sample XBRL data
- [x] 11.3 Unit test BenchmarkRetrievalService with p25/p50/p75 ranges
- [x] 11.4 Unit test ChunkEmbedPipeline: chunking strategy, metadata preservation
- [x] 11.5 Unit test ClaimVerificationService: match, contradiction, unverifiable cases
- [x] 11.6 Unit test FeasibilityAssessor: achievable, stretch, unrealistic classifications
- [x] 11.7 Unit test tenant-scoped vector search isolation
- [x] 11.8 Unit test cache hit/miss behavior and TTL
- [x] 11.9 Integration test: SEC filing → chunk → embed → vector search → claim verification
