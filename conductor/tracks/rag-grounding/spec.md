# Spec: Real-world Data Grounding (RAG & SEC EDGAR)

## Problem Statement

ValueOS needs to transition from LLM-only "hallucinated retrieval" to rigorous data grounding using real-world sources like SEC filings and a Retrieval-Augmented Generation (RAG) pipeline. This is critical for both:
1. **Value Case Integrity**: Grounding financial claims in Tier-1 public data (10-K/Q).
2. **Company Onboarding**: Automatically learning about a company's products, value propositions, and competitors during the initial setup.

Current onboarding research only uses a basic `WebCrawler`, and the `GroundTruthAgent` lacks a deep integration with a vector-backed RAG pipeline.

## Requirements

### R1: SEC EDGAR Ingestion Pipeline
Integrate SEC filing data into the company research workflow.

- **Entity Identification**: Map company domain/name to SEC CIK (Central Index Key) or Ticker.
- **Filing Retrieval**: Fetch the latest 10-K (Annual) and 10-Q (Quarterly) filings.
- **Authoritative Extraction**: Extract key business sections (Item 1: Business, Item 1A: Risk Factors, Item 7: MD&A).
- **Integration**: Add a step to `ResearchJobWorker.ts` to trigger SEC ingestion alongside `WebCrawler`.

### R2: Onboarding RAG Pipeline
Implement a dedicated RAG pipeline for company setup.

- **Chunking & Embedding**: Implement a semantic chunking strategy for web content and SEC filings.
- **Vector Storage**: Store chunks in the `semantic_memory` table with high-fidelity metadata (source, tier, page_url).
- **Search Integration**: Expose a retrieval interface for the `SuggestionExtractor` to find relevant context when proposing personas, claims, and competitors.

### R3: Product Learning Enhancement
Improve how the system learns about a company's products.

- **Product Deep-Dive**: Targeted crawling of `/products`, `/solutions`, and `/pricing` pages.
- **Feature-to-Value Mapping**: Use extracted product descriptions to generate initial "Value Patterns" (e.g., "Feature X reduces Cost Y").
- **SEC Alignment**: Cross-reference web product descriptions with "Business" sections in 10-Ks to ensure consistency.

### R4: GroundTruthAgent Hardening
Connect the standalone `GroundTruthAgent` to the RAG infrastructure.

- **Context Enrichment**: Modify `GroundtruthAnalyzer` to perform a vector search before calling the LLM.
- **Factual Verification**: Use the `MCPGroundTruthService` to verify specific financial claims (Revenue, Net Income) during the Value Case loop.
- **Confidence Calibration**: Adjust confidence scores based on whether a claim is grounded in Tier-1 (SEC) vs Tier-3 (Internal) data.

### R5: Onboarding UI/UX Integration
Enhance the Onboarding Wizard to support real-world grounding.

- **Ticker/CIK Search**: Add an optional field for Ticker/CIK in the onboarding wizard.
- **Grounding Feedback**: Show the user which sources (e.g., "Found your 2024 10-K") were used to generate suggestions.
- **Entity Lineage**: Clicking a suggestion shows the specific sentence in the filing or website it was derived from.

## Existing Assets (What We Keep)

| Asset | Location | Status |
|---|---|---|
| `MCPGroundTruthService` | `packages/backend/src/services/MCPGroundTruthService.ts` | Base for SEC/Financial data |
| `VectorSearchService` | `packages/backend/src/services/VectorSearchService.ts` | Base for RAG retrieval |
| `ResearchJobWorker` | `packages/backend/src/workers/researchWorker.ts` | Orchestrator for onboarding jobs |
| `WebCrawler` | `packages/backend/src/services/onboarding/WebCrawler.ts` | Existing data fetcher |
| `SuggestionExtractor` | `packages/backend/src/services/onboarding/SuggestionExtractor.ts` | Entity extraction logic |
| `semantic_memory` table | `infra/supabase/supabase/migrations/` | pgvector-backed storage |

## Acceptance Criteria

### AC1: SEC filings appear in suggestions
- Given a public company ticker, the system fetches the 10-K and generates suggestions (claims, personas) derived from it.
- Suggestion metadata correctly identifies the SEC filing as the source.

### AC2: RAG-backed suggestion extraction
- `SuggestionExtractor` uses vector search to find relevant context from thousands of crawled characters instead of passing everything to the LLM context window.
- Extraction latency remains < 30s for large sites.

### AC3: GroundTruthAgent Verification
- `GroundTruthAgent` correctly identifies a discrepancy between a hallucinated financial figure and an actual SEC filing value.
- Confidence score reflects Tier-1 data usage.

### AC4: Lineage in Onboarding
- Frontend displays "Source: SEC 10-K (2024)" next to accepted suggestions.
