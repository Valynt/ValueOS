# Onboarding Specification

## Purpose

Research-assisted tenant onboarding that pre-populates company context from public web presence and SEC filings, letting users review and accept rather than author from scratch. Aligns with V1 design principle §4.2 (No Blank Starts) and §4.3 (Review and Steer, Not Fill and Submit).

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §4.2, §4.3, §10.1
Consolidated from: `conductor/tracks/enhanced-onboarding/spec.md`

## Requirements

### Requirement: Research job lifecycle

The system SHALL support asynchronous research jobs that crawl a company's web presence and extract structured suggestions for products, competitors, personas, claims, capabilities, and value patterns.

#### Scenario: Research job creation and execution

- GIVEN a user enters a company website URL during onboarding
- WHEN the user triggers "Auto-fill from website"
- THEN the system creates a research job with status `queued`
- AND a background worker picks up the job, crawls the website, and extracts entity suggestions
- AND the job transitions through `queued → running → completed` with per-entity-type progress tracking

#### Scenario: Partial failure resilience

- GIVEN a research job is running
- WHEN extraction for one entity type (e.g., competitors) fails
- THEN the other entity types (products, personas, claims) still complete
- AND the job status reflects partial completion

#### Scenario: Crawl constraints

- GIVEN a research job starts crawling
- WHEN the crawler processes the target website
- THEN it fetches the homepage and up to 10 same-domain linked pages
- AND total crawl time does not exceed 30 seconds
- AND external domains are not followed
- AND extracted text is stripped of HTML and capped at 50k characters

### Requirement: Suggestion extraction with confidence scoring

The system SHALL extract structured entity suggestions using LLM analysis with Zod-validated schemas and confidence scores.

#### Scenario: Entity extraction

- GIVEN crawled web content is available
- WHEN the suggestion extractor processes it
- THEN it produces typed suggestions for each entity type: product, competitor, persona, claim, capability, value_pattern
- AND each suggestion includes a confidence score (0.0–1.0) and source URLs

#### Scenario: Low-confidence claim defaulting

- GIVEN a claim suggestion has confidence_score < 0.5
- WHEN the suggestion is presented to the user
- THEN the risk_level defaults to `conditional` regardless of the LLM suggestion

### Requirement: Suggestion accept/reject/edit workflow

The system SHALL present suggestions to the user with Accept, Edit, and Reject actions, writing accepted items to the corresponding tenant-scoped tables.

#### Scenario: Accept a suggestion

- GIVEN a research suggestion is displayed to the user
- WHEN the user accepts it
- THEN the suggestion payload is written to the corresponding company table (e.g., `company_products`)
- AND the suggestion status changes to `accepted`

#### Scenario: Edit before accept

- GIVEN a research suggestion is displayed
- WHEN the user edits the payload and confirms
- THEN the modified payload is written to the target table
- AND the suggestion status changes to `edited`

#### Scenario: Reject a suggestion

- GIVEN a research suggestion is displayed
- WHEN the user rejects it
- THEN no data is written to the target table
- AND the suggestion status changes to `rejected`

#### Scenario: Bulk accept

- GIVEN multiple suggestions are displayed
- WHEN the user selects and accepts multiple suggestions at once
- THEN all selected payloads are written to their respective target tables in a single operation

### Requirement: Manual flow preservation

The system MUST preserve the existing manual onboarding flow as a fallback.

#### Scenario: Skip auto-fill

- GIVEN a user is in the onboarding wizard
- WHEN the user chooses not to use auto-fill
- THEN the manual entry flow works exactly as before
- AND no research job is created

### Requirement: Provenance in review

The system SHALL show provenance metadata for accepted suggestions in the review phase.

#### Scenario: Review shows AI provenance

- GIVEN a user reaches the review phase of onboarding
- WHEN accepted suggestions are displayed
- THEN each shows an "AI-suggested" badge with confidence score and expandable source URLs
- AND the version snapshot records which items were AI-suggested vs manually entered

### Requirement: SEC filing integration for onboarding

The system SHOULD integrate SEC EDGAR filings into the research pipeline for public companies.

#### Scenario: SEC filing used in suggestions

- GIVEN a public company ticker is known or resolved
- WHEN the research job runs
- THEN it fetches the latest 10-K and extracts business sections (Item 1, Item 1A, Item 7)
- AND suggestions derived from SEC filings are tagged with source tier 1
- AND the user sees "Source: SEC 10-K (year)" next to affected suggestions

### Requirement: Tenant isolation for research data

The system MUST enforce tenant isolation on all research job and suggestion data.

#### Scenario: Cross-tenant access blocked

- GIVEN research jobs and suggestions belong to tenant A
- WHEN a user from tenant B queries research data
- THEN no data from tenant A is returned
- AND RLS policies enforce isolation at the database layer
