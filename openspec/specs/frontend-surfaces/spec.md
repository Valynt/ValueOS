# Frontend Surfaces Specification

## Purpose

Defines the V1 user-facing surfaces that compose the ValueOS experience. Each surface maps to a stage of the value engineering lifecycle and renders agent-generated data through SDUI widgets and purpose-built components. The frontend follows the "Review and Steer, Not Fill and Submit" principle — users guide an agentic process, not operate a form tool.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §4.2, §4.3, §9, §10, §22

## Requirements

### Requirement: Deal Assembly Workspace

The system SHALL provide a workspace where users review auto-assembled deal context, fill identified gaps, and confirm the structured case file before value modeling begins.

#### Scenario: View assembled deal context

- GIVEN a deal assembly agent has completed context extraction
- WHEN the user opens the deal assembly workspace for a case
- THEN they see: stakeholder map, identified use cases, pain signals, value driver candidates, baseline clue summary, and missing data flags

#### Scenario: Fill identified gaps

- GIVEN the assembled context flags missing baseline metrics
- WHEN the user clicks a gap item
- THEN an inline input appears to supply the missing value
- AND the gap item is marked resolved after submission

#### Scenario: Source provenance visible

- GIVEN deal context contains items from multiple sources
- WHEN the user views any data point
- THEN a source badge is visible (CRM, call transcript, web research, SEC filing, manual)

### Requirement: Value Model Workbench

The system SHALL provide a workbench where users review value hypotheses, manage assumptions, compare scenarios, and explore sensitivity analysis.

#### Scenario: Hypothesis review

- GIVEN hypotheses have been generated from deal context
- WHEN the user opens the value model workbench
- THEN they see hypothesis cards with: value driver, estimated impact range, evidence tier, confidence score
- AND each card has Accept / Edit / Reject actions

#### Scenario: Assumption register

- GIVEN accepted hypotheses have associated assumptions
- WHEN the user views the assumption register
- THEN each assumption shows: value, unit, source classification badge, confidence score, benchmark reference
- AND assumptions flagged as unsupported are visually highlighted

#### Scenario: Three-scenario comparison

- GIVEN financial modeling has produced conservative, base, and upside scenarios
- WHEN the user views the scenario comparison
- THEN they see a side-by-side view with: ROI, NPV, payback period, EVF decomposition per scenario
- AND the base scenario is visually emphasized as default

#### Scenario: Sensitivity analysis

- GIVEN sensitivity analysis has identified high-leverage assumptions
- WHEN the user views the sensitivity panel
- THEN they see a tornado chart showing top assumptions by impact
- AND clicking an assumption navigates to it in the register

### Requirement: Integrity Dashboard

The system SHALL provide a dashboard showing trust and validation status for a value case.

#### Scenario: Readiness score

- GIVEN the integrity agent has computed a readiness score
- WHEN the user opens the integrity dashboard
- THEN they see: composite readiness score, component breakdown (validation rate, grounding score, benchmark coverage, unsupported count), and presentation-ready or blocker status

#### Scenario: Evidence gaps

- GIVEN some claims lack sufficient evidence
- WHEN the user views the evidence panel
- THEN each gap is listed with: claim, current tier, required tier, suggested action

#### Scenario: Plausibility flags

- GIVEN plausibility classification has run
- WHEN the user views the plausibility panel
- THEN assumptions classified as aggressive or unrealistic are highlighted with benchmark context

### Requirement: Executive Output Studio

The system SHALL provide a studio for previewing, editing, and finalizing executive-ready artifacts.

#### Scenario: Multi-artifact preview

- GIVEN artifact generation has completed
- WHEN the user opens the output studio
- THEN they see tabs for: Executive Memo, CFO Recommendation, Customer Narrative, Internal Case
- AND each tab renders a formatted preview

#### Scenario: Inline editing

- GIVEN a generated artifact is displayed
- WHEN the user clicks an editable section
- THEN inline editing is enabled
- AND on save, the edit is logged in the audit trail with user ID and optional reason

#### Scenario: Number traceability

- GIVEN an artifact contains financial figures
- WHEN the user clicks a number
- THEN a provenance panel opens showing the full derivation chain: data source → formula → agent → confidence

#### Scenario: Draft vs final

- GIVEN the case readiness score is below 0.8
- WHEN artifacts are displayed
- THEN all artifacts show a "DRAFT" watermark and readiness blockers are surfaced inline

### Requirement: Realization Tracker

The system SHALL provide a view for the promise baseline, KPI targets, and realization checkpoints after case approval.

#### Scenario: Promise baseline overview

- GIVEN a case has been approved and a baseline created
- WHEN the user opens the realization tracker
- THEN they see: selected scenario, KPI targets with timelines, carried-forward assumptions, and handoff notes

#### Scenario: Checkpoint timeline

- GIVEN checkpoints have been auto-generated
- WHEN the user views the checkpoint section
- THEN they see a timeline of measurement dates with expected value ranges per KPI

### Requirement: Billing Portal

The system SHALL provide a self-service billing portal for usage monitoring, plan management, and invoice viewing.

#### Scenario: Usage dashboard

- GIVEN a tenant has metered usage
- WHEN the user opens the billing portal
- THEN they see: current period usage per meter, cap limits, usage trends, and days until reset

#### Scenario: Plan change

- GIVEN the user wants to change their plan
- WHEN they initiate a plan change
- THEN they see a preview with: current plan, proposed plan, price delta, and effective date
- AND if the delta exceeds the approval threshold, the change is submitted for approval

#### Scenario: Invoice history

- GIVEN invoices have been generated
- WHEN the user views the invoice section
- THEN they see a list of invoices with: period, amount, status, and download link

### Requirement: Provenance drill-down

The system SHALL provide a reusable provenance panel that can be invoked from any surface where financial figures appear.

#### Scenario: Click-to-trace

- GIVEN any financial figure is displayed on any surface
- WHEN the user clicks the figure
- THEN a slide-over panel shows the provenance chain: raw data → formula → agent → confidence → evidence tier

### Requirement: Confidence and source badges

The system SHALL display confidence scores and source classifications as visual badges across all surfaces.

#### Scenario: Confidence badge

- GIVEN a claim has a confidence score
- WHEN it is displayed
- THEN a badge shows the score with color coding: green >= 0.8, amber >= 0.5, red < 0.5

#### Scenario: Source badge

- GIVEN a data point has a source classification
- WHEN it is displayed
- THEN a badge shows the source type (customer-confirmed, benchmark-derived, inferred, etc.) with tier indicator
