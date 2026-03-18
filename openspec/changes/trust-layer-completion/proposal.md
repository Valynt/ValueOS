# Proposal: Trust Layer Completion

## Intent

Complete the trust and validation layer so every value claim carries a confidence score, evidence tier, benchmark plausibility classification, and readiness signal. Close gaps in hallucination defense and explainability.

## Scope

In scope:
- Readiness scoring (defense readiness for executive presentation)
- Benchmark plausibility testing (p25–p90 classification)
- Unsupported assumption detection
- Hallucination defense (narrative vs calculation cross-check)
- Explainability (number lineage drill-down)
- Source classification enforcement on all assumptions and evidence

Out of scope:
- Red Team agent (separate change)
- Causal inference engine improvements (V2)

## Approach

Evidence tiering (`EvidenceTiering.ts`) and confidence scoring (`ConfidenceScorer.ts`) already exist. Extend them with readiness scoring, plausibility classification, and wire the hallucination detection middleware into the narrative generation pipeline. Add explainability endpoints for number lineage.
