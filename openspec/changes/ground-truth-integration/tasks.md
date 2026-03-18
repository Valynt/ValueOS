# Tasks

## 1. SEC EDGAR Client

- [ ] 1.1 Implement `SECEdgarClient` with SEC EDGAR API integration
- [ ] 1.2 Map company domain/name to CIK or Ticker
- [ ] 1.3 Fetch latest 10-K (annual) and 10-Q (quarterly) filings
- [ ] 1.4 Extract key business sections: Item 1 (Business), Item 1A (Risk Factors), Item 7 (MD&A)
- [ ] 1.5 Add circuit breaker with configurable failure threshold
- [ ] 1.6 Add Redis cache with 24-hour TTL for filing data
- [ ] 1.7 Graceful fallback when company is not publicly traded

## 2. XBRL Parser

- [ ] 2.1 Implement `XBRLParser` for SEC companyfacts API
- [ ] 2.2 Extract GAAP-tagged financial facts: revenue, net income, margins, assets, liabilities
- [ ] 2.3 Parse XBRL taxonomy and map to standard metric names
- [ ] 2.4 Provide historical trend data across multiple periods (up to 5 years)
- [ ] 2.5 Handle XBRL validation errors gracefully
- [ ] 2.6 Return structured `XBRLFact[]` with period, value, unit, and GAAP tag

## 3. Benchmark Retrieval Service

- [ ] 3.1 Implement `BenchmarkRetrievalService`
- [ ] 3.2 Retrieve industry benchmarks as p25/p50/p75/p90 distributions
- [ ] 3.3 Accept industry, company size, and KPI as query parameters
- [ ] 3.4 Each benchmark includes: source, date, sample size, confidence
- [ ] 3.5 Support size-adjusted benchmarks (adjust ranges for company size tier)
- [ ] 3.6 Support persona-specific KPI retrieval (CFO, CIO, VP Ops priorities)
- [ ] 3.7 Add circuit breaker and cache for benchmark provider APIs

## 4. Chunk and Embed Pipeline

- [ ] 4.1 Implement `ChunkEmbedPipeline` for semantic chunking
- [ ] 4.2 Chunk SEC filings by section with overlap
- [ ] 4.3 Chunk web content by paragraph with metadata (source URL, page title)
- [ ] 4.4 Embed chunks using configured embedding model
- [ ] 4.5 Store in `semantic_memory` table with metadata: source, tier, tenant_id, date, source_url
- [ ] 4.6 Add to `ResearchJobWorker` pipeline: crawl → chunk → embed

## 5. Vector Search Enhancement

- [ ] 5.1 Modify `VectorSearchService` for tenant-scoped retrieval
- [ ] 5.2 All queries MUST filter on tenant_id in metadata
- [ ] 5.3 Return results with source metadata (tier, URL, date) for provenance
- [ ] 5.4 Support similarity threshold filtering

## 6. Claim Verification Service

- [ ] 6.1 Implement `ClaimVerificationService`
- [ ] 6.2 Accept a claim (metric + value) and verify against authoritative sources
- [ ] 6.3 If match: return verification result with source citation
- [ ] 6.4 If contradiction: flag discrepancy with severity, provide authoritative value and source
- [ ] 6.5 If no authoritative data: report unverifiable, penalize confidence score
- [ ] 6.6 Wire into IntegrityAgent validation pipeline

## 7. Feasibility Assessor

- [ ] 7.1 Implement `FeasibilityAssessor`
- [ ] 7.2 Given a proposed KPI improvement (from X to Y), assess against historical improvement ranges
- [ ] 7.3 Classify: achievable, stretch, or unrealistic
- [ ] 7.4 Include benchmark reference in classification

## 8. GroundTruth Agent Hardening

- [ ] 8.1 Modify `GroundtruthAnalyzer` to perform vector search before LLM call (RAG pattern)
- [ ] 8.2 Use `MCPGroundTruthService` to verify specific financial claims during value case loop
- [ ] 8.3 Adjust confidence scores based on Tier-1 (SEC) vs Tier-3 (internal) grounding

## 9. Cache Layer

- [ ] 9.1 Implement `GroundTruthCache` with Redis backend
- [ ] 9.2 Cache SEC filing data with 24-hour TTL
- [ ] 9.3 Cache benchmark data with 1-hour TTL
- [ ] 9.4 Include original retrieval timestamp in cached responses
- [ ] 9.5 Indicate cache hit/miss in response metadata

## 10. Integration with Deal Assembly

- [ ] 10.1 Wire SEC EDGAR fetch into deal assembly pipeline for public companies
- [ ] 10.2 Add optional Ticker/CIK input in onboarding wizard
- [ ] 10.3 Show user which sources were used ("Found your 2024 10-K")
- [ ] 10.4 Tag SEC-derived suggestions with Tier 1 evidence

## 11. Tests

- [ ] 11.1 Unit test SECEdgarClient with mocked EDGAR API responses
- [ ] 11.2 Unit test XBRLParser with sample XBRL data
- [ ] 11.3 Unit test BenchmarkRetrievalService with p25/p50/p75 ranges
- [ ] 11.4 Unit test ChunkEmbedPipeline: chunking strategy, metadata preservation
- [ ] 11.5 Unit test ClaimVerificationService: match, contradiction, unverifiable cases
- [ ] 11.6 Unit test FeasibilityAssessor: achievable, stretch, unrealistic classifications
- [ ] 11.7 Unit test tenant-scoped vector search isolation
- [ ] 11.8 Unit test cache hit/miss behavior and TTL
- [ ] 11.9 Integration test: SEC filing → chunk → embed → vector search → claim verification
