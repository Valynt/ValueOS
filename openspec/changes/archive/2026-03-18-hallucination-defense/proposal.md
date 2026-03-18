# Proposal: Hallucination Defense

## Problem Statement

LLM-generated narratives may contain financial figures that:
- Don't match deterministic calculations
- Are fabricated or hallucinated
- Undermine trust in the platform

## Proposed Solution

Implement a `NarrativeHallucinationChecker` that:
- Parses financial figures from generated narrative text
- Cross-references against economic kernel deterministic calculations
- Flags discrepancies as hallucinations with severity and location
- Blocks narrative persistence if critical hallucinations detected
- Runs after NarrativeAgent, before persist

## Success Criteria

- [ ] NarrativeHallucinationChecker service implemented
- [ ] Financial figures parsed from narrative text
- [ ] Figures cross-referenced against deterministic calculations
- [ ] Discrepancies flagged as hallucinations with severity/location
- [ ] Checker wired into narrative generation pipeline
- [ ] Critical hallucinations block narrative persistence

## Scope

In Scope:
- HallucinationChecker service
- Figure parsing from text
- Cross-reference logic
- Severity classification
- Pipeline integration

Out of Scope:
- Auto-correction of hallucinations
- LLM re-generation on failure

## Dependencies

- Economic kernel (for deterministic calculations)
- NarrativeAgent (runs before this checker)
