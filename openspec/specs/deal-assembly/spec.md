# Deal Assembly Specification

## Purpose

Deal assembly is the entry point of the ValueOS V1 workflow. It covers opportunity ingestion from connected systems, context extraction and structuring, and benchmarking enrichment — transforming fragmented deal signals into a structured case file ready for value modeling.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §10.1–10.3, §12.1–12.2

## Requirements

### Requirement: Opportunity ingestion from connected systems

The system SHALL ingest and normalize opportunity context from CRM systems, call recording and transcript platforms, note repositories, email or meeting summaries where permitted, public company and market sources, internal precedent libraries, and benchmark services.

#### Scenario: CRM opportunity linked to a new case

- GIVEN a user selects an existing CRM opportunity
- WHEN the system creates a new value case
- THEN CRM metadata (account name, deal size, industry, stage) is pre-populated
- AND the case is scoped to the user's tenant

#### Scenario: Call transcript ingestion

- GIVEN a call recording or transcript is available for the opportunity
- WHEN the system processes the transcript
- THEN it extracts and persists structured signals (pains, priorities, stakeholder mentions, baseline clues)
- AND each extracted signal is tagged with its source type as `call-derived`

#### Scenario: Public company enrichment

- GIVEN the opportunity account is a publicly traded company
- WHEN the system assembles the deal context
- THEN it retrieves relevant public filings, firmographics, and market data
- AND attaches them as enrichment sources with provenance metadata

#### Scenario: No blank start

- GIVEN any new opportunity is created
- WHEN the deal assembly completes its first pass
- THEN the user sees an auto-assembled draft case file, not an empty form
- AND the draft includes at least inferred context, candidate value drivers, and benchmark references where available

### Requirement: Context extraction and structuring

The system SHALL extract account context, stakeholder identities and priorities, use cases, baseline clues, business pains, implementation assumptions, value driver candidates, and objections and risks from ingested sources.

#### Scenario: Stakeholder map inference

- GIVEN call transcripts and CRM contacts are available
- WHEN context extraction runs
- THEN the system produces a likely stakeholder map with roles and priorities
- AND each stakeholder entry identifies its source (CRM-derived, call-derived, inferred)

#### Scenario: Value driver candidate identification

- GIVEN discovery signals have been ingested
- WHEN context extraction completes
- THEN the system identifies candidate value drivers (revenue uplift, cost reduction, efficiency improvement, risk reduction, digital enablement)
- AND ranks them by signal strength and evidence availability

#### Scenario: Missing data identification

- GIVEN the system has completed context extraction
- WHEN critical data points are absent (e.g., baseline metrics, customer-confirmed numbers)
- THEN the system flags specific missing inputs
- AND requests only high-leverage information the system cannot infer, retrieve, or benchmark on its own

### Requirement: Benchmarking and external research enrichment

The system SHALL pull contextual benchmarks and research relevant to the account's industry, size, use case, and buying motion, and determine which claims appear plausible, aggressive, or weakly supported.

#### Scenario: Industry-contextual benchmark retrieval

- GIVEN an opportunity with a known industry and company size
- WHEN the benchmark agent runs
- THEN it retrieves benchmark ranges (p25/p50/p75) relevant to the account's context
- AND each benchmark reference includes provenance (source, date, sample size)

#### Scenario: Plausibility classification

- GIVEN benchmark ranges have been retrieved
- WHEN the system evaluates candidate value drivers against benchmarks
- THEN each driver is classified as plausible, aggressive, or weakly supported
- AND the classification rationale is visible to the user

### Requirement: Precedent case retrieval

The system SHOULD retrieve prior similar business cases when relevant to inform the current opportunity.

#### Scenario: Similar case found

- GIVEN the tenant has prior completed value cases
- WHEN a new opportunity shares industry, use case, or deal characteristics
- THEN the system surfaces relevant precedent cases as reference
- AND precedent data remains scoped to the same tenant
