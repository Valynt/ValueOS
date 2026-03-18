# Value Modeling Specification

## Purpose

Value modeling constructs the economic case for a strategic deal. It covers value hypothesis generation, baseline metric establishment, assumption management, financial scenario modeling (conservative/base/upside), and sensitivity analysis — producing a structured, benchmark-constrained financial model.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §10.4–10.5, §12.3–12.4, §13

## Requirements

### Requirement: Value hypothesis generation

The system SHALL generate account-specific value hypotheses from accepted discovery signals, each with a value driver, estimated impact range, and evidence tier.

#### Scenario: Auto-generated hypotheses from discovery

- GIVEN context extraction has identified candidate value drivers
- WHEN the value modeling stage begins
- THEN the system generates 3–5 value hypotheses with confidence scores
- AND each hypothesis includes a value driver, estimated impact range, and supporting evidence tier
- AND the user can accept, reject, or edit each hypothesis

#### Scenario: Hypothesis linked to benchmark

- GIVEN a value hypothesis proposes a specific KPI improvement
- WHEN the hypothesis is generated
- THEN it is constrained by the relevant benchmark range for the account's industry and size
- AND claims outside the plausible range are flagged

### Requirement: Baseline metric establishment

The system SHALL establish current-state baseline metrics for each value driver, sourced from customer data, CRM signals, call-derived clues, benchmarks, or system inference.

#### Scenario: Baseline from customer-confirmed data

- GIVEN the customer has provided an operational metric
- WHEN that metric is used as a baseline
- THEN it is tagged as `customer-confirmed`
- AND it takes precedence over inferred or benchmark-derived values

#### Scenario: Baseline inferred from benchmarks

- GIVEN no customer-confirmed baseline exists for a value driver
- WHEN the system needs a baseline to construct the model
- THEN it infers a baseline from contextual benchmarks
- AND tags it as `benchmark-derived`
- AND flags it as requiring customer confirmation

### Requirement: Assumption register with source tagging

The system SHALL maintain an assumption register where every named modeled input has a source classification, confidence level, and benchmark relationship.

#### Scenario: Assumption source classification

- GIVEN a modeled assumption is created or modified
- WHEN it is persisted
- THEN it MUST have a source tag (customer-confirmed, CRM-derived, call-derived, note-derived, benchmark-derived, externally researched, inferred, or manually overridden)
- AND the source tag is visible in the assumption register

#### Scenario: User override of assumption

- GIVEN the user overrides a system-generated assumption
- WHEN the override is saved
- THEN the assumption source changes to `manually-overridden`
- AND the original value and source are preserved in the audit trail

### Requirement: Financial scenario modeling

The system SHALL construct conservative, base, and upside financial scenarios using deterministic economic logic.

#### Scenario: Three-scenario output

- GIVEN accepted value hypotheses and established baselines
- WHEN the financial modeling agent runs
- THEN it produces conservative, base, and upside scenarios
- AND each scenario includes ROI, NPV, and payback period calculations
- AND the economic kernel uses deterministic math (no LLM-generated arithmetic)

#### Scenario: Sensitivity analysis

- GIVEN a completed financial model
- WHEN the user or system runs sensitivity analysis
- THEN the system shows the impact of varying key assumptions by ±20%
- AND identifies which assumptions have the highest leverage on the outcome

### Requirement: EVF decomposition

The system SHOULD decompose economic value into revenue, cost, risk, and efficiency components.

#### Scenario: Value driver categorization

- GIVEN a set of accepted value drivers
- WHEN the financial model is constructed
- THEN each driver is categorized by economic value framework component (revenue uplift, cost reduction, risk mitigation, efficiency gain)
- AND the model shows contribution by category

### Requirement: Recalculation on upstream changes

The system MUST trigger downstream re-validation when an upstream assumption or variable changes.

#### Scenario: Assumption change propagation

- GIVEN a user modifies a baseline metric or assumption
- WHEN the change is saved
- THEN all dependent financial outputs are recalculated
- AND narrative components referencing the changed values are flagged for refresh
- AND no stale financial claim is presented without re-validation
