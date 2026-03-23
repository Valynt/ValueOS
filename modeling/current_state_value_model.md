# ValueOS Technical Documentation: Current-State Value Model Analysis

## 1. Executive Summary

### What the System Does
ValueOS is an AI-powered **Value Orchestration Platform** that helps B2B SaaS companies discover, quantify, validate, and realize business value for their customers. It automates the creation of data-driven business cases through an 8-agent fabric that operates across a structured value lifecycle.

### Core Value Domains
The implemented value model spans **four primary economic value drivers**:
1. **Revenue Growth** - Upsell, cross-sell, price optimization, retention
2. **Cost Reduction** - Process efficiency, headcount optimization, automation
3. **Risk Mitigation** - Compliance, security, operational risk reduction
4. **Capital Efficiency** - Cash flow improvement, working capital optimization

### Key Workflows Supporting Value Generation
- **Opportunity Discovery** (OpportunityAgent) → Generates testable value hypotheses
- **Financial Modeling** (FinancialModelingAgent) → Builds ROI/NPV/IRR models with sensitivity analysis
- **Target Setting** (TargetAgent) → Commits KPI targets with stakeholder accountability
- **Realization Tracking** (RealizationAgent) → Monitors actual vs. committed value delivery
- **Expansion Modeling** (ExpansionAgent) → Identifies follow-on growth opportunities
- **Integrity Validation** (IntegrityAgent) → Validates claims against evidence with veto power
- **Narrative Composition** (NarrativeAgent) → Creates customer-facing business case documents

### Biggest Risks, Inconsistencies, and Blind Spots
| Risk Category | Issue | Impact |
|--------------|-------|--------|
| **Schema Drift** | Domain model has two parallel type systems (Zod schemas in `packages/shared/src/domain/` vs API types in `packages/backend/src/api/valueCases/types.ts`) | Inconsistency in field naming, validation rules, and type definitions |
| **Tenant ID Duality** | Database uses both `tenant_id` (TEXT) and `organization_id` (UUID) with OR logic in RLS policies | Query complexity, index fragmentation, potential isolation gaps |
| **Evidence Tier Enforcement** | Gold/Platinum evidence requires `source_url`, but validation is only in Zod superRefine—not DB constraint | Data quality risk for high-confidence claims |
| **Integrity Score Calculation** | Formula documented but not materialized; computed on-the-fly in `ValueIntegrityService` | Cannot query/sort by integrity at database level |
| **Workflow State Gaps** | No unified `workflow_executions` table tracking end-to-end value lifecycle progress | Cannot reconstruct full value journey without joining multiple tables |

---

## 2. Current-State Value Model

### What "Value" Means in ValueOS

**Explicit Definition (from code):**
- Value is a **quantified, time-bound economic impact** tied to a specific business intervention
- Must be expressed as a range (`low`, `high`) with unit and timeframe
- Must have supporting evidence with provenance tracking
- Must pass integrity validation before presentation to customers

**Core Value Entities:**

| Entity | Purpose | Key Value Fields |
|--------|---------|------------------|
| `ValueHypothesis` | Testable claim about value creation | `estimated_value` (ValueRange), `confidence`, `category`, `evidence_ids` |
| `BusinessCase` | Customer-facing value proposition | `financial_summary` (total_value_low/high, ROI, NPV, payback), `defense_readiness_score`, `integrity_score` |
| `Assumption` | Auditable input to financial models | `value`, `unit`, `source`, `sensitivity_range`, `human_reviewed` |
| `RealizationPlan` | Post-sale value tracking | `milestones`, `overall_realization_rate` |
| `ExpansionOpportunity` | Follow-on growth signals | `estimated_additional_value`, `confidence`, `evidence_ids` |
| `ValueCommitment` | Contractual value promise | `financial_impact`, `progress_percentage`, `target_completion_date` |

### Value Calculation Pipeline

```
Raw Input (company name, CRM data, call notes)
    ↓
OpportunityAgent → Generates hypotheses with ValueRange
    ↓
FinancialModelingAgent → Builds cash flow projections
    ↓
Economic Kernel (decimal.js) → Computes ROI/NPV/IRR/Payback
    ↓
TargetAgent → Commits KPI targets with stakeholders
    ↓
RealizationAgent → Compares committed vs. actual via telemetry
    ↓
ExpansionAgent → Flags over-performance as expansion signals
```

### Value Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VALUE FLOW                                │
└─────────────────────────────────────────────────────────────────┘

[Discovery]          [Modeling]            [Commitment]         [Realization]
     │                     │                      │                   │
     ▼                     ▼                      ▼                   ▼
┌──────────┐        ┌────────────┐        ┌─────────────┐      ┌────────────┐
│Opportunity│        │Financial   │        │Value        │      │Realization │
│  Agent   │   →    │  Modeling  │   →    │ Commitments  │  →   │   Agent    │
│          │        │   Agent    │        │  (Target)    │      │            │
└──────────┘        └────────────┘        └─────────────┘      └────────────┘
     │                     │                      │                   │
     ▼                     ▼                      ▼                   ▼
Hypothesis Outputs   Financial Model         Committed KPIs      Proof Points
(Stored in:          Snapshots              (Stored in:          (Stored in:
hypothesis_outputs)  (financial_model        commitment_*        realization_reports)
                     _snapshots)              tables)
```

---

## 3. Canonical Entity and Relationship Model

### Domain Entities (Zod Schemas in `packages/shared/src/domain/`)

| Entity | File | Key Fields | Relationships |
|--------|------|------------|---------------|
| **Account** | `Account.ts` | `id`, `organization_id`, `name`, `domain`, `industry`, `employee_count`, `arr_usd` | 1:N Opportunities |
| **Opportunity** | `Opportunity.ts` | `id`, `organization_id`, `account_id`, `name`, `lifecycle_stage`, `status` | N:1 Account, 1:N Hypotheses, 1:N BusinessCases |
| **ValueHypothesis** | `ValueHypothesis.ts` | `id`, `organization_id`, `opportunity_id`, `description`, `category`, `estimated_value`, `confidence`, `status` | N:1 Opportunity, N:N Evidence |
| **Assumption** | `Assumption.ts` | `id`, `organization_id`, `opportunity_id`, `hypothesis_id`, `name`, `value`, `unit`, `source`, `human_reviewed` | N:1 Opportunity, N:1 Hypothesis |
| **Evidence** | `Evidence.ts` | `id`, `organization_id`, `opportunity_id`, `hypothesis_id`, `title`, `content`, `provenance`, `tier`, `grounding_score` | N:1 Opportunity, N:1 Hypothesis |
| **BusinessCase** | `BusinessCase.ts` | `id`, `organization_id`, `opportunity_id`, `title`, `status`, `hypothesis_ids`, `financial_summary`, `defense_readiness_score`, `integrity_score` | N:1 Opportunity, N:N Hypotheses |
| **RealizationPlan** | `RealizationPlan.ts` | `id`, `organization_id`, `opportunity_id`, `business_case_id`, `milestones`, `overall_realization_rate` | N:1 Opportunity, N:1 BusinessCase |
| **ExpansionOpportunity** | `ExpansionOpportunity.ts` | `id`, `organization_id`, `source_opportunity_id`, `type`, `estimated_additional_value`, `confidence` | N:1 Opportunity |

### Database Schema (Core Value Tables)

| Table | Purpose | Tenant Column | Key Indexes |
|-------|---------|---------------|-------------|
| `value_cases` | Central value case entity | `tenant_id` (TEXT), `organization_id` (UUID) | `idx_value_cases_tenant_id`, `idx_value_cases_organization_id`, `idx_value_cases_stage` |
| `assumptions` | Financial model inputs | `organization_id` | `idx_assumptions_org_id`, `idx_assumptions_case_id`, `idx_assumptions_source_type` |
| `scenarios` | Conservative/base/upside scenarios | `organization_id` | `idx_scenarios_org_id`, `idx_scenarios_case_id`, `idx_scenarios_case_scenario_type` |
| `hypothesis_outputs` | OpportunityAgent outputs | `organization_id` | `idx_hypothesis_outputs_org`, `idx_hypothesis_outputs_case` |
| `financial_model_snapshots` | Computed financial models | `organization_id` | `idx_financial_model_org_case`, `idx_financial_model_created` |
| `integrity_outputs` | IntegrityAgent validation results | `organization_id` | `idx_integrity_outputs_org`, `idx_integrity_outputs_case` |
| `realization_reports` | RealizationAgent tracking | `organization_id` | `idx_realization_reports_org`, `idx_realization_reports_case` |
| `value_commitments` | Committed value promises | `organization_id`, `tenant_id` | `idx_value_commitments_org`, `idx_value_commitments_status` |
| `commitment_milestones` | Milestone tracking | `organization_id` | `idx_commitment_milestones_commitment` |
| `commitment_metrics` | KPI tracking | `organization_id` | `idx_commitment_metrics_commitment` |
| `vg_capabilities` | Value Graph ontology | `organization_id` | `idx_vg_capabilities_org_opp` |
| `vg_metrics` | Quantifiable outcomes | `organization_id` | `idx_vg_metrics_org_opp` |
| `vg_value_drivers` | EVF taxonomy | `organization_id` | `idx_vg_value_drivers_org_opp` |
| `value_graph_edges` | Typed relationships | `organization_id` | `idx_value_graph_edges_unique_pair` (unique) |

### Entity Relationship Diagram (Text)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Account    │◄────┤ Opportunity │────►│ ValueHypoth │
│  (company)  │  1:N │ (engagement)│  1:N │   esis      │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                     │
                           │ 1:N                 │ 1:N
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ BusinessCase  │◄────┤ Assumption  │
                    │  (artifact)   │ 1:N │  (input)    │
                    └──────┬──────┘     └─────────────┘
                           │
                           │ 1:N
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │RealizationPlan│───► │   Evidence  │
                    │ (tracking)    │     │ (provenance)│
                    └─────────────┘     └─────────────┘

                    ┌─────────────┐
                    │  Scenario   │
                    │(conservative/│
                    │ base/upside) │
                    └─────────────┘

                    ┌─────────────┐
                    │  ValueCommit│
                    │   ment      │
                    │ (promise)    │
                    └──────┬──────┘
                           │
                ┌─────────┼─────────┐
                ▼         ▼         ▼
         ┌──────────┐ ┌────────┐ ┌────────┐
         │Milestone │ │ Metric │ │  Risk  │
         └──────────┘ └────────┘ └────────┘
```

---

## 4. Data Flow and Value Flow Mapping

### End-to-End Value Flow

**Stage 1: Input Capture (Discovery)**
- Entry points: `POST /api/v1/cases` (manual), CRM webhook, company research query
- Data captured: Company profile, stakeholders, pain points, industry context
- Storage: `value_cases` (base record), `company_value_context` (enrichment data)

**Stage 2: Hypothesis Generation**
- Agent: OpportunityAgent (`packages/backend/src/lib/agent-fabric/agents/OpportunityAgent.ts`)
- Process:
  1. Query Ground Truth MCP for financial data
  2. Load domain pack context (feature-flagged)
  3. LLM generates ValueHypothesis array via `secureInvoke`
  4. Persists to `hypothesis_outputs` table
  5. Publishes `opportunity.updated` domain event
  6. Writes to Value Graph (vg_capabilities → vg_metrics → vg_value_drivers)

**Stage 3: Financial Modeling**
- Agent: FinancialModelingAgent
- Process:
  1. Retrieves hypotheses from memory
  2. LLM structures cash flow projections
  3. **Economic Kernel** computes precise values:
     - `calculateROI()` → 3-year ROI
     - `calculateNPV()` → Net present value
     - `calculateIRR()` → Internal rate of return
     - `calculatePayback()` → Payback period
     - `sensitivityAnalysis()` → NPV at ±20% assumption variance
  4. Builds 3 scenarios (conservative/base/upside)
  5. Persists to `financial_model_snapshots` and `scenarios`

**Stage 4: Target Commitment**
- Agent: TargetAgent
- Process:
  1. Retrieves financial models from memory
  2. LLM recommends KPI targets with confidence intervals
  3. Persists committed targets to `value_commitments`
  4. Creates `commitment_milestones`, `commitment_metrics`, `commitment_stakeholders`
  5. Publishes `commitment.created` domain event

**Stage 5: Realization Tracking**
- Agent: RealizationAgent
- Process:
  1. Retrieves committed KPIs from memory
  2. Fetches actual telemetry data (context-provided)
  3. LLM analyzes variance (committed vs. realized)
  4. Generates proof points with `variance_percentage`, `direction`
  5. Creates interventions if realization < 80%
  6. Flags expansion signals if realization > 110%
  7. Persists to `realization_reports`

**Stage 6: Expansion Identification**
- Agent: ExpansionAgent
- Process:
  1. Retrieves realization analysis from memory
  2. Identifies over-performance and new opportunities
  3. LLM estimates additional value
  4. Persists to `expansion_opportunities`

---

## 5. Agent / Workflow Orchestration Map

### 8-Agent Fabric

| Agent | Lifecycle Stage | Authority Level | Primary Output | Downstream Consumer |
|-------|-----------------|-----------------|----------------|---------------------|
| **OpportunityAgent** | discovery | 2 | Hypotheses | FinancialModelingAgent |
| **FinancialModelingAgent** | modeling | 4 | Financial models | TargetAgent, IntegrityAgent |
| **TargetAgent** | targeting | 3 | KPI commitments | RealizationAgent |
| **IntegrityAgent** | validating | 5 | Veto/pass decision | Controls saga transition |
| **RealizationAgent** | realization | 3 | Proof points, variance | ExpansionAgent |
| **ExpansionAgent** | expansion | 2 | Growth opportunities | New opportunity cycle |
| **NarrativeAgent** | composing | 3 | Business case draft | Customer presentation |
| **ComplianceAuditorAgent** | compliance | 5 | Audit report | Governance review |

### Workflow DAG Definition

```typescript
// From apps/ValyntApp/src/data/lifecycleWorkflows.ts
LIFECYCLE_WORKFLOW_DEFINITIONS = [
  {
    id: 'value-lifecycle-v1',
    stages: [
      { id: 'opportunity_discovery', agent_type: 'opportunity', timeout_seconds: 90 },
      { id: 'target_value_commit', agent_type: 'target', timeout_seconds: 120 },
      { id: 'realization_tracking', agent_type: 'realization', timeout_seconds: 120 },
      { id: 'expansion_modeling', agent_type: 'expansion', timeout_seconds: 90 },
      { id: 'integrity_controls', agent_type: 'integrity', timeout_seconds: 90 }
    ],
    transitions: [
      { from: 'opportunity_discovery', to: 'target_value_commit' },
      { from: 'target_value_commit', to: 'realization_tracking' },
      { from: 'realization_tracking', to: 'expansion_modeling' },
      { from: 'expansion_modeling', to: 'integrity_controls' }
    ]
  }
]
```

### Orchestration Runtime (6 Services)

| Service | Location | Responsibility |
|---------|----------|----------------|
| **DecisionRouter** | `runtime/decision-router/` | Agent selection based on domain state |
| **ExecutionRuntime** | `runtime/execution-runtime/` | Task lifecycle: queuing, retries, circuit breaking |
| **PolicyEngine** | `runtime/policy-engine/` | Authorization, rate limits, guardrails |
| **ContextStore** | `runtime/context-store/` | Workflow state persistence |
| **ArtifactComposer** | `runtime/artifact-composer/` | SDUI generation, business case assembly |
| **RecommendationEngine** | `runtime/recommendation-engine/` | Next-best-action suggestions |

---

## 6. API and Contract Surface

### Value-Related Endpoints

| Endpoint | Method | Request Schema | Response Schema | Auth |
|----------|--------|----------------|-----------------|------|
| `/api/v1/cases` | POST | `CreateValueCaseSchema` | `ValueCase` | JWT + tenant |
| `/api/v1/cases/:id` | GET | UUID param | `ValueCase` | JWT + tenant |
| `/api/v1/cases/:id` | PATCH | `UpdateValueCaseSchema` | `ValueCase` | JWT + tenant |
| `/api/v1/cases/:id/hypothesis` | POST | `{ query: string }` | `HypothesisOutput` | JWT + tenant |
| `/api/v1/cases/:id/financial-model` | GET | - | `FinancialModelSnapshot` | JWT + tenant |
| `/api/v1/cases/:id/integrity` | GET | - | `IntegrityOutput` | JWT + tenant |
| `/api/v1/cases/:id/realization` | GET | - | `RealizationReport` | JWT + tenant |
| `/api/v1/cases/:id/commitments` | GET | - | `ValueCommitment[]` | JWT + tenant |
| `/api/v1/cases/:id/expansion` | GET | - | `ExpansionOpportunity[]` | JWT + tenant |
| `/api/v1/cases/:id/narrative` | GET | - | `NarrativeDraft` | JWT + tenant |
| `/api/v1/agents/invoke` | POST | `{ agentType, query, context }` | Agent-specific | JWT + rate limit |

### Key Contract Dependencies

```typescript
// ValueCase ↔ Domain Model Mapping (inferred from code)
API ValueCase.status: 'draft' | 'in_progress' | 'committed' | 'closed'
Domain Opportunity.status: 'active' | 'on_hold' | 'closed_won' | 'closed_lost'
Domain Opportunity.lifecycle_stage: 'discovery' | 'drafting' | 'validating' | 'composing' | 'refining' | 'realized' | 'expansion'

// Inconsistency: API uses 'in_progress', Domain uses 'drafting'
// Inconsistency: API uses 'committed', Domain uses 'composing'/'refining'
```

---

## 7. Governance and Constraint Model

### Tenant Isolation

**Policy:** Every database query MUST include `organization_id` or `tenant_id` filter.

```sql
-- RLS policy template (from migrations)
CREATE POLICY table_tenant_select ON public.table
  FOR SELECT USING (security.user_has_tenant_access(organization_id::text));
```

**Validation:** `pnpm run test:rls` executes SQL to verify isolation.

### Authorization

| Role | Permissions |
|------|-------------|
| `owner` | Full CRUD on all value data, user management |
| `admin` | CRUD on value data, read-only user management |
| `editor` | CRUD on value data, no user management |
| `viewer` | Read-only access to value data |

### Validation Rules (Enforced)

| Entity | Rule | Enforcement |
|--------|------|-------------|
| Evidence | Gold/Platinum tier requires `source_url` | Zod `superRefine` |
| Assumption | Financial model inputs must have `human_reviewed=true` for customer presentation | Application-level check |
| BusinessCase | `integrity_score < 0.6` with critical violations blocks status advance to `in_review` | `ValueIntegrityService` |
| ValueHypothesis | `confidence` must be 0-1 | Zod `number().min(0).max(1)` |
| Scenario | `scenario_type` must be `conservative` \| `base` \| `upside` | Database CHECK constraint |

### Model Integrity Safeguards

| Safeguard | Implementation |
|-----------|----------------|
| **Hallucination Detection** | `secureInvoke` in BaseAgent sets `hallucination_check: boolean` |
| **Grounding Score** | Evidence items carry `grounding_score` (0-1) from LLM validation |
| **Evidence Tier Guardrails** | Platinum-tier claims require gold+ evidence (IntegrityAgent enforcement) |
| **Defense Readiness Score** | `0.6 * assumption_validation_rate + 0.4 * mean_evidence_grounding_score` |
| **Integrity Score** | `0.5 * defense_readiness + 0.5 * (1 - Σ violation_penalties)` |

---

## 8. State and Lifecycle Model

### Opportunity Lifecycle Stages

| Stage | Description | Entry Trigger | Exit Trigger |
|-------|-------------|---------------|--------------|
| **discovery** | Initial value hypotheses | New opportunity created | Hypotheses generated |
| **drafting** | Business case construction | Hypotheses validated | Financial models complete |
| **validating** | Integrity review | Models complete | Integrity check passes |
| **composing** | Narrative assembly | Integrity passed | Business case ready |
| **refining** | Customer feedback loop | Case presented | Customer approves |
| **realized** | Post-sale value tracking | Deal closed won | Value commitments met |
| **expansion** | Growth opportunity identification | Realization > 110% | New opportunity created |

### BusinessCase State Machine

```
draft → in_review → approved → presented → archived
  ↑________↓         ↓
  (rejection)    (rejection)
```

**Transitions Enforced:**
- `draft → in_review`: Requires `integrity_score >= 0.6` and no critical violations
- `in_review → approved`: Manual approval by owner
- `approved → presented`: Customer presentation event
- Any state → `archived`: Soft delete

### ValueCommitment State Machine

```
draft → active → fulfilled/cancelled
          ↓
       at_risk (if progress stalls)
```

---

## 9. Observability and Explainability Summary

### What is Logged/Traced/Auditable

| Data | Location | Retention |
|------|----------|-----------|
| **Agent executions** | `agent_execution_lineage` table (migration `20260914000000`) | Indefinite |
| **Reasoning traces** | `reasoning_traces` table (migration `20260919000000`) | 90 days |
| **Provenance records** | `provenance_records` table (migration `20260902000000`) | Indefinite |
| **Value integrity violations** | `value_integrity_violations` table (migration `20260919000000`) | Indefinite |
| **Audit logs** | `audit_logs` + `audit_logs_archive` (WORM after 30 days) | 7 years |
| **Workflow states** | `workflow_states` table | 90 days |
| **Usage events** | `usage_events` (partitioned monthly) | 13 months |

### What is NOT Observable (Gaps)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No unified `value_number` lineage | Cannot trace a specific dollar value from hypothesis → commitment → realization | Join hypothesis_outputs → financial_model_snapshots → value_commitments → realization_reports by opportunity_id |
| No versioning of assumption changes | Cannot see how assumptions evolved over time | `assumptions` table has `original_value` and `overridden_by_user_id`, but no history table |
| No materialized integrity score | Cannot query cases by trustworthiness at DB level | Computed on-the-fly in application layer |
| No real-time value realization stream | Lag between actual value delivery and system awareness | Telemetry integration required; currently batch/manual |
| No confidence interval tracking over time | Cannot see if confidence improved/worsened | Single `confidence_score` field; no history |

### Reconstructing a Value Number

To trace how a value number was produced:

```sql
-- Example: Trace a specific value commitment
SELECT 
  vc.id as commitment_id,
  vc.financial_impact,
  h.id as hypothesis_id,
  h.description as hypothesis_claim,
  h.confidence as hypothesis_confidence,
  fms.roi, fms.npv, fms.payback_months,
  a.name as assumption_name, a.value as assumption_value, a.source as assumption_source,
  io.integrity_score,
  io.violation_count
FROM value_commitments vc
JOIN hypothesis_outputs h ON h.case_id = vc.id
JOIN financial_model_snapshots fms ON fms.case_id = vc.id
JOIN assumptions a ON a.case_id = vc.id
JOIN integrity_outputs io ON io.case_id = vc.id
WHERE vc.id = 'uuid-here';
```

---

## 10. Data Quality and DS Readiness Assessment

### Usable Data Assets for DS

| Asset | Quality | Schema Stability | Notes |
|-------|---------|------------------|-------|
| `value_cases` | ⭐⭐⭐ High | Stable | Core entity; well-typed |
| `assumptions` | ⭐⭐⭐ High | Stable | Key value modeling table |
| `scenarios` | ⭐⭐⭐ High | Stable | Conservative/base/upside stored |
| `financial_model_snapshots` | ⭐⭐⭐ High | Stable | JSONB `models` column contains full projections |
| `hypothesis_outputs` | ⭐⭐⭐ High | Stable | LLM-generated hypotheses with confidence |
| `realization_reports` | ⭐⭐⭐ High | Stable | Actual vs. committed tracking |
| `value_commitments` | ⭐⭐⭐ High | Stable | Contractual promises |
| `value_graph_edges` | ⭐⭐⭐ High | New (Sprint 47) | Graph relationships with confidence scores |
| `reasoning_traces` | ⭐⭐ Medium | Evolving | Useful for explainability research |
| `integrity_outputs` | ⭐⭐ Medium | Evolving | Validation results; schema changing |
| `narrative_drafts` | ⭐⭐ Medium | Evolving | Text artifacts; less structured |
| `expansion_opportunities` | ⭐⭐⭐ High | Stable | Growth signals |

### Weakly Defined Fields (DS Caution)

| Field | Issue | Recommendation |
|-------|-------|----------------|
| `value_cases.metadata` | JSONB blob; schema varies | Normalize commonly accessed fields |
| `financial_model_snapshots.models` | Deeply nested JSONB | Document schema; consider flattening |
| `scenarios.evf_decomposition_json` | Custom JSON structure | Standardize EVF taxonomy |
| `value_commitments.financial_impact` | JSONB without schema | Extract scalar fields for aggregation |
| `hypothesis_outputs.raw_output` | LLM raw response | Parse into typed fields on ingest |

### Data Integrity Risks

| Risk | Likelihood | Impact | Detection |
|------|------------|--------|-----------|
| Orphaned assumptions (case_id FK violation) | Low | Medium | DB FK constraint missing; check via query |
| Duplicate hypotheses for same opportunity | Medium | Low | Application-level deduplication |
| Stale financial models (hypothesis changed, model not regenerated) | Medium | High | No automatic cascade; manual trigger |
| Inconsistent realization rates (milestone math error) | Low | High | Cross-check: `overall_realization_rate` vs. milestone aggregation |

### Limitations for Analytics/Forecasting/Experimentation

| Use Case | Limitation | Workaround |
|----------|------------|------------|
| **Benchmarking** | No industry-wide value benchmark table | Use domain packs for sector comparison |
| **A/B Testing** | No experiment assignment framework | Add `experiment_id` to value_cases metadata |
| **Causal Inference** | No control group tracking | Flag `is_control` opportunities |
| **Time-Series Forecasting** | Monthly partitioning recent; older data in archive | Query both `value_cases` and archive tables |
| **Multi-Touch Attribution** | No marketing touchpoint log | Join with external CRM data |

---

## 11. Minimal Recommendations

### Clarify the Value Model

1. **Unify status enums**: Align API `CaseStatus` with domain `OpportunityStatus` or document mapping explicitly
2. **Materialize integrity_score**: Add column to `value_cases` or `business_cases`; update via trigger or application
3. **Document EVF taxonomy**: Add `docs/value-drivers.md` explaining revenue_growth/cost_reduction/risk_mitigation/capital_efficiency categories

### Improve Consistency

4. **Migrate to UUID-only tenant keys**: Deprecate `tenant_id` TEXT; standardize on `organization_id` UUID
5. **Add FK constraints**: `assumptions.case_id → value_cases.id`, `scenarios.case_id → value_cases.id`
6. **Standardize JSONB schemas**: Add JSON Schema validation for `metadata`, `financial_impact`, `evf_decomposition_json`

### Improve Traceability

7. **Create value_lineage_view**: Database view joining hypothesis → model → commitment → realization
8. **Add assumption_history table**: Track assumption changes with `changed_at`, `previous_value`, `changed_by`
9. **Enrich audit logs**: Include `integrity_score`, `realization_rate` in audit context

### Support DS Consumption

10. **Flatten financial_model_snapshots.models**: Extract common fields (total_npv, total_roi) as scalar columns
11. **Add value_outcomes materialized view**: Pre-aggregated realized value by driver category, industry, time
12. **Document data dictionary**: Generate from Zod schemas + DB comments

---

## 12. Machine-Readable Appendix

### JSON Schema: ValueHypothesis (Simplified)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "ValueHypothesis",
  "type": "object",
  "required": ["id", "organization_id", "opportunity_id", "description", "category", "confidence", "status"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "organization_id": { "type": "string", "format": "uuid" },
    "opportunity_id": { "type": "string", "format": "uuid" },
    "description": { "type": "string", "minLength": 10, "maxLength": 2000 },
    "category": { 
      "type": "string", 
      "enum": ["revenue_growth", "cost_reduction", "risk_mitigation", "operational_efficiency", "strategic_advantage"]
    },
    "estimated_value": {
      "type": "object",
      "required": ["low", "high", "unit", "timeframe_months"],
      "properties": {
        "low": { "type": "number" },
        "high": { "type": "number" },
        "unit": { "enum": ["usd", "percent", "hours", "headcount"] },
        "timeframe_months": { "type": "integer", "minimum": 1 }
      }
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "status": { "enum": ["proposed", "under_review", "validated", "rejected", "superseded"] },
    "evidence_ids": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "hallucination_check": { "type": "boolean" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" }
  }
}
```

### Dataset Inventory for DS Use

| Dataset | SQL Source | Update Frequency | Grain |
|---------|------------|------------------|-------|
| `ds_value_cases` | `SELECT * FROM value_cases WHERE deleted_at IS NULL` | Real-time | 1 row per engagement |
| `ds_hypotheses` | `SELECT * FROM hypothesis_outputs` | On agent run | 1 row per hypothesis |
| `ds_financial_models` | `SELECT * FROM financial_model_snapshots` | On modeling complete | 1 row per model run |
| `ds_commitments` | `SELECT * FROM value_commitments` | On target set | 1 row per commitment |
| `ds_realization` | `SELECT * FROM realization_reports` | Weekly/batch | 1 row per realization check |
| `ds_assumptions` | `SELECT * FROM assumptions` | On assumption change | 1 row per assumption |
| `ds_value_graph` | `SELECT * FROM value_graph_edges` | On graph update | 1 row per relationship |
| `ds_integrity_checks` | `SELECT * FROM integrity_outputs` | On validation | 1 row per validation run |

---

**Document Version:** Current-state as of 2026-03-22  
**Repository:** Valynt/ValueOS (commit HEAD)  
**Analysis Method:** Static code analysis of TypeScript/Zod schemas, SQL migrations, and API contracts
