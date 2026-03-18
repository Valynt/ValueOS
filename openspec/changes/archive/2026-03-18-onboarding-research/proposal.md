# Proposal: Onboarding Research Pipeline

## Intent

Implement research-assisted tenant onboarding that pre-populates company context from public web presence and SEC filings, replacing manual form-filling with a review-and-accept workflow.

## Scope

In scope:
- BullMQ research job worker for async web crawling
- LLM-based entity extraction (products, competitors, personas, claims, capabilities, value patterns)
- Suggestion cards with accept/edit/reject in onboarding wizard phases 1–5
- SEC EDGAR filing integration for public companies
- Confidence scoring and source URL provenance
- Bulk accept for efficiency
- Tenant-isolated research data

Out of scope:
- External site triangulation (G2, LinkedIn) — V2
- Competitive positioning analysis — V2
- Automated value hypothesis generation from onboarding data — V2
- Pre-built ROI model templates — V2

## Approach

Add a BullMQ worker that crawls company websites, extracts entities via LLM with Zod validation, and stores suggestions in new database tables. Frontend phases 1–5 render suggestion cards above manual entry. Existing manual flow preserved as fallback.
