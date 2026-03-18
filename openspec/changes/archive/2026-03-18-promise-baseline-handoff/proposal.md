# Proposal: Promise Baseline Handoff

## Intent

Build the post-sale handoff package that converts an approved value case into a structured promise baseline with KPI commitments, milestone assumptions, realization checkpoints, and customer success notes.

## Scope

In scope:
- Promise baseline creation from approved case
- Target KPI commitments with timelines
- Milestone assumptions carry-forward with source tags
- Realization checkpoint schedule
- Customer success handoff notes
- Lifecycle continuity (same model, no manual re-entry)

Out of scope:
- Full post-sale realization tracking dashboard (V2)
- Actual vs. committed variance reporting (V2)
- Customer success workflow automation (V2)

## Approach

Extend the existing `RealizationAgent` to produce a structured `PromiseBaseline` entity when a value case is approved. The baseline inherits scenario data, assumptions, and checkpoints from the approved model. Store in a new `promise_baselines` table.
