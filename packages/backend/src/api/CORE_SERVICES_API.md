# Core Services API Documentation

API endpoint contracts for V1 Core Backend and Infrastructure services.

## Base URL

All endpoints are prefixed with: `/api/v1`

## Authentication

All endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

## Deal Assembly Endpoints

### Get Deal Context

```
GET /cases/:caseId/context
```

**Description**: Retrieve assembled deal context for a case including stakeholders, use cases, and data sources.

**Response**:
```json
{
  "id": "uuid",
  "case_id": "case-uuid",
  "tenant_id": "tenant-uuid",
  "assembled_at": "2024-01-15T10:00:00Z",
  "status": "draft",
  "context_json": {
    "stakeholders": [
      {
        "name": "John Smith",
        "role": "economic_buyer",
        "priority": 9,
        "source_type": "crm-derived"
      }
    ],
    "use_cases": [
      {
        "name": "Process Efficiency",
        "description": "Reduce processing time",
        "pain_signals": ["slow workflows"],
        "source_type": "call-derived"
      }
    ],
    "value_drivers": [
      {
        "name": "Automation",
        "impact_range_low": 100000,
        "impact_range_high": 200000,
        "confidence": 0.85
      }
    ]
  },
  "source_fragments": [
    {
      "source_type": "crm-derived",
      "ingested_at": "2024-01-15T09:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `404`: Case not found
- `403`: Tenant access denied

### Trigger Deal Assembly

```
POST /cases/:caseId/assemble
```

**Description**: Trigger the deal assembly pipeline to fetch CRM data and extract context.

**Request Body**:
```json
{
  "crm_connection_id": "conn-123",
  "opportunity_id": "opp-456"
}
```

**Response**:
```json
{
  "assembly_id": "uuid",
  "status": "processing",
  "estimated_completion": "2024-01-15T10:05:00Z"
}
```

**Error Responses**:
- `400`: Missing required fields
- `404`: Case not found
- `422`: CRM connection failed

### Submit Gap Fill

```
PATCH /cases/:caseId/context/gaps
```

**Description**: Fill in missing data gaps identified during deal assembly.

**Request Body**:
```json
{
  "gap_id": "gap-uuid",
  "value": "$100,000",
  "source": "customer-confirmed"
}
```

**Response**:
```json
{
  "gap_id": "gap-uuid",
  "status": "resolved",
  "resolved_at": "2024-01-15T10:30:00Z"
}
```

## Ground Truth Endpoints

### Get Company CIK

```
GET /ground-truth/companies/lookup?query=Apple
```

**Description**: Look up a company's CIK (Central Index Key) from SEC EDGAR.

**Query Parameters**:
- `query`: Company name or ticker symbol

**Response**:
```json
{
  "cik": "0000320193",
  "name": "Apple Inc.",
  "ticker": "AAPL"
}
```

**Error Responses**:
- `404`: Company not found
- `503`: SEC EDGAR API unavailable

### Get Company Financials

```
GET /ground-truth/companies/:cik/financials
```

**Description**: Retrieve financial metrics from SEC XBRL company facts.

**Response**:
```json
{
  "cik": "0000320193",
  "company_name": "Apple Inc.",
  "fiscal_year_end": "09-30",
  "facts": [
    {
      "metric_name": "revenue",
      "period": "2023",
      "value": 394328000000,
      "unit": "USD",
      "gaap_tag": "Revenues",
      "filing_date": "2023-11-03"
    }
  ],
  "extracted_at": "2024-01-15T10:00:00Z"
}
```

### Get Filing Content

```
GET /ground-truth/companies/:cik/filings/:accessionNumber
```

**Description**: Retrieve and extract content from a specific SEC filing.

**Response**:
```json
{
  "cik": "0000320193",
  "accession_number": "0000320193-24-000001",
  "form": "10-K",
  "sections": {
    "item_1_business": "Apple Inc. designs...",
    "item_1a_risk_factors": "The Company's business...",
    "item_7_md_and_a": "The following discussion...",
    "full_text": "..."
  },
  "extracted_at": "2024-01-15T10:00:00Z"
}
```

## Trust Layer Endpoints

### Get Readiness Score

```
GET /cases/:caseId/readiness
```

**Description**: Calculate and retrieve the readiness score for a value case.

**Response**:
```json
{
  "case_id": "case-uuid",
  "overall_score": 0.85,
  "is_presentation_ready": true,
  "component_scores": {
    "validation_rate": 0.9,
    "mean_grounding": 0.85,
    "benchmark_coverage": 0.8,
    "unsupported_penalty": 0.9
  },
  "blockers": [
    {
      "type": "insufficient_benchmarks",
      "severity": "warning",
      "description": "Only 80% of assumptions have benchmark references",
      "recommendation": "Attach relevant industry benchmarks"
    }
  ],
  "calculated_at": "2024-01-15T10:00:00Z"
}
```

### Get Evidence Gaps

```
GET /cases/:caseId/readiness/gaps
```

**Description**: Retrieve list of claims with insufficient evidence.

**Response**:
```json
{
  "gaps": [
    {
      "claim_id": "claim-uuid",
      "claim_text": "50% efficiency improvement",
      "current_tier": 3,
      "required_tier": 1,
      "suggested_action": "Add customer reference or benchmark data",
      "confidence_score": 0.4
    }
  ],
  "total_gaps": 1,
  "critical_gaps": 0
}
```

### Get Plausibility Assessment

```
GET /cases/:caseId/plausibility
```

**Description**: Retrieve plausibility classifications for all KPIs in the case.

**Response**:
```json
{
  "assessments": [
    {
      "kpi_name": "ROI",
      "current_value": 100,
      "proposed_value": 250,
      "improvement_pct": 150,
      "classification": "plausible",
      "benchmark_p25": 100,
      "benchmark_p75": 200,
      "benchmark_p90": 250,
      "confidence": 0.85
    }
  ],
  "calculated_at": "2024-01-15T10:00:00Z"
}
```

### Assess Single KPI

```
POST /cases/:caseId/plausibility/assess
```

**Description**: Assess plausibility of a single KPI improvement.

**Request Body**:
```json
{
  "kpi_name": "ROI",
  "current_value": 100,
  "proposed_value": 250,
  "industry": "Technology",
  "company_size_tier": "mid-market"
}
```

**Response**:
```json
{
  "id": "uuid",
  "kpi_name": "ROI",
  "classification": "plausible",
  "benchmark_p25": 100,
  "benchmark_p75": 200,
  "confidence": 0.85,
  "calculated_at": "2024-01-15T10:00:00Z"
}
```

## Promise Baseline Endpoints

### Get Baseline

```
GET /cases/:caseId/baseline
```

**Description**: Retrieve the promise baseline for an approved scenario.

**Response**:
```json
{
  "id": "baseline-uuid",
  "case_id": "case-uuid",
  "scenario_id": "scenario-uuid",
  "scenario_type": "base",
  "status": "active",
  "approved_at": "2024-01-15T10:00:00Z",
  "kpi_targets": [
    {
      "id": "target-uuid",
      "metric_name": "Efficiency",
      "baseline_value": 100,
      "target_value": 150,
      "unit": "hours",
      "timeline_months": 12,
      "confidence_score": 0.85
    }
  ],
  "handoff_notes": {
    "deal_context": "Value case for Q1 expansion",
    "buyer_priorities": ["Cost reduction", "Efficiency"],
    "implementation_assumptions": ["6-month rollout"],
    "key_risks": ["Adoption challenges"]
  }
}
```

### Get Checkpoints

```
GET /cases/:caseId/baseline/checkpoints
```

**Description**: Retrieve scheduled checkpoints for measuring value realization.

**Response**:
```json
{
  "checkpoints": [
    {
      "id": "checkpoint-uuid",
      "kpi_target_id": "target-uuid",
      "measurement_date": "2024-04-15",
      "expected_value_min": 110,
      "expected_value_max": 130,
      "status": "pending"
    }
  ],
  "total_checkpoints": 4,
  "completed_checkpoints": 0
}
```

### Approve Case

```
POST /cases/:caseId/approve
```

**Description**: Approve a value case scenario and create promise baseline.

**Request Body**:
```json
{
  "scenario_id": "scenario-uuid",
  "scenario_type": "base"
}
```

**Response**:
```json
{
  "baseline_id": "baseline-uuid",
  "status": "active",
  "kpi_targets_count": 5,
  "checkpoints_count": 15,
  "created_at": "2024-01-15T10:00:00Z"
}
```

## Executive Output Endpoints

### List Artifacts

```
GET /cases/:caseId/artifacts
```

**Description**: List all generated artifacts for a case.

**Response**:
```json
{
  "artifacts": [
    {
      "id": "artifact-uuid",
      "artifact_type": "executive_memo",
      "status": "final",
      "readiness_score_at_generation": 0.85,
      "created_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total_count": 4
}
```

### Get Artifact

```
GET /cases/:caseId/artifacts/:artifactId
```

**Description**: Retrieve a specific artifact with full content.

**Response**:
```json
{
  "id": "artifact-uuid",
  "case_id": "case-uuid",
  "artifact_type": "executive_memo",
  "content_json": {
    "title": "Value Assessment: ACME Corp",
    "summary": "Analysis indicates strong ROI potential...",
    "value_hypothesis": {
      "statement": "Implementation will deliver 250% ROI...",
      "confidence": 0.85
    },
    "top_drivers": [
      {
        "name": "Process Automation",
        "impact_range": "$100K - $200K",
        "evidence_tier": 1
      }
    ]
  },
  "status": "final",
  "readiness_score_at_generation": 0.85,
  "created_at": "2024-01-15T10:00:00Z"
}
```

### Generate Artifacts

```
POST /cases/:caseId/artifacts/generate
```

**Description**: Generate all artifact types for a case.

**Request Body**:
```json
{
  "scenario_id": "scenario-uuid"
}
```

**Response**:
```json
{
  "artifacts": [
    {
      "artifact_id": "memo-uuid",
      "artifact_type": "executive_memo",
      "status": "final"
    },
    {
      "artifact_id": "cfo-uuid",
      "artifact_type": "cfo_recommendation",
      "status": "final"
    }
  ],
  "generated_count": 4
}
```

### Edit Artifact

```
PATCH /cases/:caseId/artifacts/:artifactId
```

**Description**: Edit an artifact with audit logging.

**Request Body**:
```json
{
  "content_patch": {
    "summary": "Updated summary text..."
  },
  "edit_reason": "Customer requested clarification on timeline"
}
```

**Response**:
```json
{
  "artifact_id": "artifact-uuid",
  "version": 2,
  "edited_at": "2024-01-15T11:00:00Z",
  "edit_reason": "Customer requested clarification on timeline",
  "edited_by": "user-uuid"
}
```

## Provenance Endpoints

### Get Provenance Chain

```
GET /cases/:caseId/provenance/:claimId
```

**Description**: Retrieve the provenance chain for a financial claim.

**Response**:
```json
{
  "claim_id": "claim-uuid",
  "case_id": "case-uuid",
  "chain": [
    {
      "node_type": "raw_data",
      "label": "Customer Input",
      "value": "$500K",
      "source": "discovery-call",
      "timestamp": "2024-01-10T09:00:00Z"
    },
    {
      "node_type": "formula",
      "label": "ROI Calculation",
      "value": "250%",
      "formula": "(benefits - costs) / costs",
      "agent": "FinancialModelingAgent",
      "agent_version": "1.2.0",
      "timestamp": "2024-01-15T10:00:00Z"
    },
    {
      "node_type": "confidence",
      "label": "Confidence Score",
      "value": "0.85",
      "evidence_tier": 1,
      "timestamp": "2024-01-15T10:00:00Z"
    }
  ]
}
```

## Value Modeling Endpoints

### Get Hypotheses

```
GET /cases/:caseId/hypotheses
```

**Description**: Retrieve value driver hypotheses for a case.

**Response**:
```json
{
  "hypotheses": [
    {
      "id": "hypothesis-uuid",
      "value_driver": "Process Automation",
      "description": "Automate manual workflows",
      "estimated_impact_min": 100000,
      "estimated_impact_max": 200000,
      "impact_unit": "USD",
      "confidence_score": 0.85,
      "status": "pending"
    }
  ]
}
```

### Accept Hypothesis

```
POST /cases/:caseId/hypotheses/:hypothesisId/accept
```

**Description**: Accept a hypothesis and add to assumptions.

**Response**:
```json
{
  "hypothesis_id": "hypothesis-uuid",
  "status": "accepted",
  "assumption_id": "assumption-uuid",
  "accepted_at": "2024-01-15T10:00:00Z"
}
```

### Get Assumptions

```
GET /cases/:caseId/assumptions
```

**Description**: Retrieve all assumptions for a case.

**Response**:
```json
{
  "assumptions": [
    {
      "id": "assumption-uuid",
      "name": "Current Processing Time",
      "value": 48,
      "unit": "hours",
      "source_type": "customer-confirmed",
      "confidence_score": 0.9,
      "benchmark_reference_id": null,
      "is_validated": true
    }
  ]
}
```

### Update Assumption

```
PATCH /cases/:caseId/assumptions/:assumptionId
```

**Description**: Update an assumption with optimistic locking.

**Request Body**:
```json
{
  "value": 36,
  "source_type": "customer-confirmed",
  "confidence_score": 0.95
}
```

**Response**:
```json
{
  "id": "assumption-uuid",
  "value": 36,
  "source_type": "customer-confirmed",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

## Error Handling

All endpoints use consistent error responses:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional error context"
    }
  }
}
```

**Common Error Codes**:
- `UNAUTHORIZED` (401): Missing or invalid authentication
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `VALIDATION_ERROR` (422): Invalid request data
- `RATE_LIMITED` (429): Too many requests
- `INTERNAL_ERROR` (500): Server error

## Rate Limiting

API endpoints are rate limited:
- Read endpoints: 100 requests per minute
- Write endpoints: 20 requests per minute
- Generation endpoints: 5 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705312800
```

## Versioning

The API is versioned via URL path:
- Current version: `/api/v1/`
- Future versions: `/api/v2/`, etc.

Deprecated endpoints return a warning header:
```
Deprecation: true
Sunset: Sat, 01 Jun 2024 00:00:00 GMT
```
