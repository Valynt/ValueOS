# Design: Ground Truth Integration

## Technical Approach

Layer new data modules onto the existing `MCPGroundTruthService` and `GroundTruthIntegrationService`. Each external source gets a dedicated client with circuit breaker and caching. Retrieved data is chunked, embedded, and stored in `semantic_memory` for RAG retrieval.

## Architecture Decisions

### Decision: Source-specific clients with unified interface

Each data source (SEC EDGAR, benchmark providers) gets a dedicated client class. All implement a common `GroundTruthSource` interface for uniform consumption by agents.

### Decision: Vector store for RAG retrieval

All ingested content (SEC filings, benchmark reports, web content) is chunked and embedded into `semantic_memory` with metadata (source, tier, tenant_id, date). Agents query via semantic search before LLM calls.

### Decision: Cache-first, fetch-on-miss

External data is cached with configurable TTL. Agents always check cache first. Cache misses trigger live fetch with circuit breaker protection.

## Data Flow

```
SEC EDGAR API ─────────┐
Benchmark Providers ───┤──► Source Clients (circuit breaker + cache)
Web Crawl Content ─────┘              │
                                      ▼
                              Chunk + Embed Pipeline
                                      │
                                      ▼
                              semantic_memory (pgvector)
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                   DealAssembly  Benchmarking  ClaimVerification
                      Agent        Agent          Agent
```

## File Changes

### New
- `packages/backend/src/services/ground-truth/SECEdgarClient.ts` — Filing retrieval + XBRL extraction
- `packages/backend/src/services/ground-truth/XBRLParser.ts` — GAAP fact extraction
- `packages/backend/src/services/ground-truth/BenchmarkRetrievalService.ts` — Industry benchmarks
- `packages/backend/src/services/ground-truth/ClaimVerificationService.ts` — Verify claims against sources
- `packages/backend/src/services/ground-truth/FeasibilityAssessor.ts` — KPI improvement feasibility
- `packages/backend/src/services/ground-truth/ChunkEmbedPipeline.ts` — Chunk + embed ingested content
- `packages/backend/src/services/ground-truth/GroundTruthCache.ts` — Redis cache layer

### Modified
- `packages/backend/src/services/MCPGroundTruthService.ts` — Wire new source clients
- `packages/backend/src/services/VectorSearchService.ts` — Add tenant-scoped retrieval
- `packages/backend/src/services/domain-packs/GroundTruthIntegrationService.ts` — Wire claim verification
