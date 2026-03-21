# Trust and Validation Specification

## Purpose

Trust and validation ensures that every value claim in the system is evidence-backed, benchmark-constrained, and transparent about its confidence level. It covers evidence tiering, confidence scoring, source classification, hallucination defense, plausibility testing, readiness scoring, and explainability — enforcing the CFO-defensibility standard.

Reference: [V1 Product Design Brief](../v1-product-vision/spec.md) §10.6, §12.5, §14, §20

## Requirements

### Requirement: Evidence tiering

The system SHALL classify all supporting evidence into tiers based on source reliability.

#### Scenario: Tier 1 primary evidence

- GIVEN evidence sourced from public filings (EDGAR, 10-K/Q), customer-provided data, or audited financials
- WHEN the evidence is classified
- THEN it receives Tier 1 classification with the highest reliability weight
- AND a maximum acceptable age of 365 days

#### Scenario: Tier 2 secondary evidence

- GIVEN evidence sourced from analyst firms (Gartner, Forrester, IDC, McKinsey) or industry benchmark reports
- WHEN the evidence is classified
- THEN it receives Tier 2 classification with moderate reliability weight
- AND a maximum acceptable age of 730 days

#### Scenario: Tier 3 tertiary evidence

- GIVEN evidence sourced from internal data, anonymized aggregates, or unverified sources
- WHEN the evidence is classified
- THEN it receives Tier 3 classification with the lowest reliability weight
- AND a maximum acceptable age of 1095 days

#### Scenario: Expired evidence

- GIVEN evidence exceeds the maximum age for its tier
- WHEN confidence is calculated
- THEN the evidence receives a freshness penalty
- AND the system flags it as stale

### Requirement: Confidence scoring

The system SHALL assign a confidence score (0.0–1.0) to every value claim based on data freshness, source reliability, and logic transparency.

#### Scenario: High-confidence claim

- GIVEN a claim backed by Tier 1 evidence less than 6 months old with full formula transparency
- WHEN confidence is scored
- THEN the score is >= 0.8

#### Scenario: Low-confidence claim

- GIVEN a claim backed only by Tier 3 evidence or system inference with no corroboration
- WHEN confidence is scored
- THEN the score is < 0.5
- AND the claim is flagged as requiring additional evidence

#### Scenario: Corroboration boost

- GIVEN a claim is supported by multiple independent sources
- WHEN confidence is scored
- THEN each additional corroborating source increases confidence (up to a cap)

### Requirement: Source classification

Every major data element in the value model SHALL be tagged with origin and trust metadata using the source classification model.

#### Scenario: Source tag on every assumption

- GIVEN an assumption is created or modified
- WHEN it is persisted
- THEN it MUST carry one of: customer-confirmed, CRM-derived, call-derived, note-derived, benchmark-derived, externally-researched, inferred, or manually-overridden

#### Scenario: Trust attributes on evidence

- GIVEN evidence is attached to a claim
- WHEN it is stored
- THEN it MUST include: source tier, freshness date, reliability score, transparency level, and validation status

### Requirement: Benchmark plausibility testing

The system SHALL test modeled claims against contextual benchmark ranges and flag claims that fall outside plausible bounds.

#### Scenario: Claim within plausible range

- GIVEN a modeled KPI improvement falls within p25–p75 of the relevant benchmark
- WHEN plausibility is evaluated
- THEN the claim is marked as plausible

#### Scenario: Claim exceeds benchmark ceiling

- GIVEN a modeled KPI improvement exceeds p90 of the relevant benchmark
- WHEN plausibility is evaluated
- THEN the claim is flagged as aggressive
- AND the flag is visible to the user with the benchmark reference

### Requirement: Unsupported assumption detection

The system SHALL detect and flag assumptions that lack supporting evidence or benchmark backing.

#### Scenario: Assumption with no evidence

- GIVEN a modeled assumption has no attached evidence and no benchmark reference
- WHEN validation runs
- THEN the assumption is flagged as unsupported
- AND the flag appears in the assumption register and readiness panel

### Requirement: Hallucination defense

The system MUST prevent discrepancies between LLM-generated narrative and programmatic calculations.

#### Scenario: Narrative matches calculation

- GIVEN a narrative references a financial figure
- WHEN the narrative is generated
- THEN the figure MUST match the deterministic calculation from the economic kernel
- AND any discrepancy triggers a hallucination flag

#### Scenario: No hidden confidence

- GIVEN a financial claim is presented in any output
- WHEN it is rendered
- THEN it MUST display its confidence score and citation
- AND claims without confidence scores MUST NOT appear in final outputs

### Requirement: Readiness scoring

The system SHALL compute a defense readiness score indicating whether the value case is ready for executive presentation.

#### Scenario: Case ready for presentation

- GIVEN assumption validation rate >= 80% and mean evidence grounding score >= 0.8
- WHEN readiness is evaluated
- THEN the defense readiness score is >= 0.8
- AND the case is marked as presentation-ready

#### Scenario: Case not ready

- GIVEN assumption validation rate < 60% or mean evidence grounding score < 0.4
- WHEN readiness is evaluated
- THEN the readiness score reflects the weakness
- AND the system identifies specific blockers preventing readiness

### Requirement: Explainability

The system SHALL explain the lineage of every calculated figure.

#### Scenario: Number lineage exploration

- GIVEN a financial figure is displayed in the UI
- WHEN the user clicks or inspects the figure
- THEN the system reveals: raw data source, formula used, agent responsible, assumptions involved, and benchmark reference where applicable

---

## Value Integrity Layer — Sprint 53/54

### Requirement: Cross-agent contradiction detection

The system SHALL detect four contradiction types across agent outputs for a business case.

#### Contradiction types

| Type | Key | Severity |
|---|---|---|
| Two agents assert different numeric values for the same metric (>20% relative diff) | `SCALAR_CONFLICT` | critical |
| Single agent output fails financial plausibility thresholds | `FINANCIAL_SANITY` | critical (ROI >10x, payback <1mo) / warning (range >5x) |
| Agent A's implied condition is negated by Agent B | `LOGIC_CHAIN_BREAK` | critical |
| Two agents use incompatible units or magnitude scales for the same metric | `UNIT_MISMATCH` | critical (currency) / warning (1000x magnitude) |

#### Scenario: Contradiction detected after agent run

- GIVEN a business case has received outputs from two or more agents
- WHEN `ValueIntegrityService.detectContradictions` runs after an agent completes
- THEN all four contradiction types are evaluated
- AND any detected violations are persisted to `value_integrity_violations`
- AND a `integrity.contradiction.detected` CloudEvent is emitted on the `integrity` channel
- AND the event payload includes `organizationId`, `caseId`, `trace_id`, and the violation array

#### Scenario: Status gate blocks in_review transition

- GIVEN a business case has one or more OPEN violations with severity `critical`
- WHEN a PATCH request sets `status: 'in_review'`
- THEN the API returns HTTP 422 with `blocked: true` and the list of blocking violations
- AND the status is NOT updated

#### Scenario: Warnings do not block

- GIVEN a business case has only OPEN violations with severity `warning` or `info`
- WHEN a PATCH request sets `status: 'in_review'`
- THEN the transition proceeds
- AND the response includes `soft_warnings` listing the non-blocking violations

### Requirement: Integrity score

The system SHALL maintain a composite `integrity_score` (0–1) on each business case.

#### Formula

```
integrity_score = 0.5 * defense_readiness_score
                + 0.5 * (1 - sum(violation_penalties))

penalties: critical=0.20, warning=0.05, info=0.01
dismissed violations: critical=-0.05, warning=-0.01 (transparency penalty)
clamped to [0, 1]
```

#### Scenario: Score recomputed after agent run

- GIVEN an agent run completes for a business case
- WHEN `ValueIntegrityService.recomputeScore` is called
- THEN `integrity_score` is updated on `business_cases`
- AND the score reflects both `defense_readiness_score` and current open violations

### Requirement: Integrity API

#### `GET /api/v1/cases/:caseId/integrity`

Returns the current integrity state for a business case.

**Response:**
```json
{
  "integrity_score": 0.72,
  "defense_readiness_score": 0.85,
  "violations": [...],
  "hard_blocked": false,
  "soft_warnings": [...]
}
```

- Requires authentication and tenant context.
- All violations are scoped to `organization_id`.

#### `POST /api/v1/cases/:caseId/integrity/resolve/:id`

Resolves a violation by re-evaluation or human dismissal.

**Request body:**
```json
{
  "resolution_type": "RE_EVALUATE" | "DISMISS",
  "reason_code": "string (required for DISMISS)",
  "comment": "string (required for DISMISS)"
}
```

**Behaviour:**
- `RE_EVALUATE`: re-runs detection for the violation's nodes; marks `RESOLVED_AUTO` if clean.
- `DISMISS`: marks `DISMISSED`, stores `reason_code` + `comment`, applies transparency penalty to `integrity_score`.
- Dismissal of `SCALAR_CONFLICT` or `LOGIC_CHAIN_BREAK` critical violations returns HTTP 422.
- Requires authentication and tenant context.
