# Proposal: Plausibility Classifier

## Problem Statement

Modeled KPI improvements often exceed realistic ranges, leading to:
- Unrealistic value projections
- Loss of stakeholder trust
- Failed implementations

## Proposed Solution

Implement a `PlausibilityClassifier` service that:
- Compares modeled KPI improvements against benchmark p25/p50/p75/p90 ranges
- Classifies: within p25–p75 → `plausible`, p75–p90 → `aggressive`, > p90 → `unrealistic`
- Includes benchmark reference in results
- Surfaces classification in SDUI assumption register

## Success Criteria

- [ ] PlausibilityClassifier service implemented
- [ ] KPI improvements compared against benchmark percentiles
- [ ] Correct classification based on percentile ranges
- [ ] Benchmark references included in results
- [ ] Classification surfaced in SDUI

## Scope

In Scope:
- PlausibilityClassifier service
- Benchmark percentile comparison
- Classification logic
- SDUI surface

Out of Scope:
- Benchmark data collection (uses existing system)

## Dependencies

- Benchmark retrieval service (existing from ground-truth-integration)
