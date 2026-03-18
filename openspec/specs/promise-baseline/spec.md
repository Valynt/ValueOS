# Promise Baseline Specification

## Purpose

The promise baseline bridges pre-sale value articulation and post-sale value realization. When a value case is approved, it is converted into a structured handoff package containing target KPI commitments, milestone assumptions, realization checkpoints, and customer success notes.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §10.8, §13 (PromiseBaseline entity)

## Requirements

### Requirement: Promise baseline creation from approved case

The system SHALL convert an approved value case into a post-sale promise baseline.

#### Scenario: Baseline created on approval

- GIVEN a value case has been reviewed and approved by the user
- WHEN the user confirms approval
- THEN the system creates a promise baseline containing: target KPI commitments, milestone assumptions, realization checkpoints, and customer success handoff notes
- AND the baseline is linked to the originating value case

#### Scenario: Baseline reflects approved scenario

- GIVEN the user approved the value case with a specific scenario (conservative, base, or upside)
- WHEN the promise baseline is created
- THEN it reflects the KPI targets and assumptions from the approved scenario
- AND the scenario choice is recorded in the baseline metadata

### Requirement: Target KPI commitments

The promise baseline SHALL include specific, measurable KPI targets tied to the value drivers in the approved model.

#### Scenario: KPI target with timeline

- GIVEN a value driver has an accepted impact estimate
- WHEN the promise baseline is created
- THEN each KPI target includes: metric name, current baseline value, target value, expected timeline, and source classification of the baseline

### Requirement: Milestone assumptions

The promise baseline SHALL include the key assumptions that underpin the committed value, with their source classifications preserved.

#### Scenario: Assumption carry-forward

- GIVEN the approved value model contains assumptions with source tags
- WHEN the promise baseline is created
- THEN each critical assumption is carried forward with its source tag, confidence score, and benchmark reference intact

### Requirement: Realization checkpoints

The promise baseline SHALL define checkpoints at which actual performance can be measured against committed targets.

#### Scenario: Checkpoint schedule

- GIVEN a promise baseline with KPI targets and timelines
- WHEN checkpoints are defined
- THEN each checkpoint specifies: measurement date, KPI to measure, expected value range, and data source for actuals

### Requirement: Customer success handoff notes

The promise baseline SHOULD include contextual notes for the post-sale team summarizing deal context, buyer priorities, and implementation assumptions.

#### Scenario: Handoff package completeness

- GIVEN a promise baseline is created
- WHEN the customer success team receives the handoff
- THEN they can understand: what was promised, why it was promised, what assumptions underpin the promise, and what the buyer cares most about
- AND they do not need to re-read the full value case to begin realization tracking

### Requirement: Continuity across lifecycle

The same value model used to support the buying decision SHALL become the baseline for post-sale realization without manual reconstruction.

#### Scenario: No manual re-entry

- GIVEN a value case was approved pre-sale
- WHEN post-sale realization tracking begins
- THEN the promise baseline provides all necessary targets, assumptions, and checkpoints
- AND the post-sale team does not need to manually reconstruct the value model
