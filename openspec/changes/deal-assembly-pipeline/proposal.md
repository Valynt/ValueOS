# Proposal: Deal Assembly Pipeline

## Intent

Build the ingestion and context extraction pipeline that transforms fragmented deal signals (CRM, transcripts, notes, research) into a structured DealContext — the entry point of the V1 workflow.

## Scope

In scope:
- CRM opportunity ingestion (HubSpot connector exists, needs wiring to case assembly)
- Call transcript ingestion and signal extraction
- Notes and document ingestion
- Public company enrichment (firmographics, market data)
- Stakeholder map inference
- Value driver candidate identification
- Missing data detection and targeted gap resolution
- DealContext entity assembly

Out of scope:
- Full CRM replacement functionality
- Email ingestion (V2)
- Custom connector framework (V2)
- Real-time streaming ingestion

## Approach

Extend the existing `OpportunityAgent` and `ResearchJobWorker` infrastructure. Add a `DealAssemblyAgent` that orchestrates ingestion from multiple sources, delegates extraction to a `ContextExtractionAgent`, and produces a structured `DealContext` entity stored in Supabase.
