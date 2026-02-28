# Implementation Plan: Real-world Data Grounding (RAG & SEC EDGAR)

This track implements the data ingestion and RAG pipeline for company onboarding and value case grounding.

## Phases

### Phase 1: SEC Ingestion (Tier-1 Data)
- [ ] **R1.1: SEC Service Integration** - Wire `MCPGroundTruthService` to fetch 10-K/Q filings.
- [ ] **R1.2: Entity Mapping** - Logic to resolve domains to CIKs via a ticker lookup.
- [ ] **R1.3: Worker Integration** - Add SEC step to `ResearchJobWorker.ts`.

### Phase 2: RAG Pipeline
- [ ] **R2.1: Semantic Chunking** - Strategy for dividing long filings and web pages into context-rich chunks.
- [ ] **R2.2: Vector Ingestion** - Bulk embedding and storage in Supabase `semantic_memory`.
- [ ] **R2.3: Retrieval Interface** - Search utility for `SuggestionExtractor`.

### Phase 3: Product & Value Extraction
- [ ] **R3.1: Targeted Product Crawl** - Focus crawler on product-specific subpaths.
- [ ] **R3.2: Value Hypothesis Generator** - Create initial `ValueHypothesis` from product/SEC overlap.

### Phase 4: Agent Hardening
- [ ] **R4.1: GroundTruthAgent RAG Hook** - Add vector lookup to `GroundTruthAgent`.
- [ ] **R4.2: Confidence Scoring Integration** - Calibration based on evidence tier.

### Phase 5: UI & Feedback
- [ ] **R5.1: Onboarding Field Addition** - Add Ticker/CIK input to frontend wizard.
- [ ] **R5.2: Lineage Display** - Visualize source origin in onboarding suggestions.

## Verification Plan
- Integration test: Verify ticker `MSFT` pulls Microsoft's 10-K.
- Performance test: Measure RAG retrieval latency for a 50-page crawl.
- End-to-end test: Run onboarding for a known public company and check suggestion accuracy.
