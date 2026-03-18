# Proposal: Ground Truth Integration

## Intent

Build the complete data grounding pipeline: SEC EDGAR filing retrieval, XBRL fact extraction, industry benchmark retrieval, RAG-backed vector search, and claim verification — so agents reason from verified data, not hallucinations.

## Scope

In scope:
- SEC EDGAR CIK/ticker resolution and filing retrieval (10-K, 10-Q)
- XBRL fact extraction and GAAP tag mapping
- Industry benchmark retrieval with p25/p50/p75/p90 distributions
- Vector-backed RAG pipeline (chunk, embed, store, retrieve)
- Claim verification against authoritative sources
- Feasibility assessment for KPI improvements
- Circuit breaker and caching for external sources
- Tenant-scoped vector retrieval

Out of scope:
- Private company estimation (LinkedIn, Crunchbase) — V2
- Real-time market data streaming — V2
- Sentiment analysis engine — V2
- Web dashboard for ground truth data — V2

## Approach

Extend the existing `MCPGroundTruthService` and `VectorSearchService`. Add SEC EDGAR client, XBRL parser, and benchmark retrieval services. Wire into the deal assembly and trust pipelines.
