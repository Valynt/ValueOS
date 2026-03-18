# Proposal: Unsupported Assumption Detection

## Problem Statement

Assumptions in value cases often lack supporting evidence, leading to:
- Unreliable projections
- Poor decision-making
- Audit failures
- Loss of stakeholder confidence

## Proposed Solution

Implement an `UnsupportedAssumptionDetector` service that:
- Scans all assumptions in a case
- Flags those with no attached evidence AND no benchmark reference
- Persists flags in the assumption register
- Surfaces flags in the readiness panel UI

## Success Criteria

- [ ] Service detects assumptions without evidence or benchmark
- [ ] Flags are persisted in assumption register
- [ ] Unsupported count affects readiness score
- [ ] Flags visible in UI readiness panel

## Scope

In Scope:
- UnsupportedAssumptionDetector service
- Assumption register flag persistence
- Readiness score integration
- UI surface for flags

Out of Scope:
- Auto-fixing unsupported assumptions
- Evidence auto-discovery

## Dependencies

- Source classification enforcement (for identifying evidence)
- Readiness scoring (for integration)
