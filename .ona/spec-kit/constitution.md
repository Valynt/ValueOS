# ValueOS Specification Constitution
## Hypothesis-First Agentic Workflow System

### Version
1.0.0

---

## 1. Foundational Principles

### 1.1 Hypothesis-First Mandate
Every workflow MUST begin with a quantifiable value thesis before any modeling or analysis occurs.

**Rule:** No agent may execute financial calculations without a validated hypothesis artifact.

### 1.2 CFO-Defensibility Standard
All outputs must meet CFO-defensibility criteria:
- Traceability: Every number links to source data
- Reproducibility: Models execute deterministically given same inputs
- Explainability: Narrative explains financial logic in executive terms

**Rule:** Outputs without audit lineage are rejected by the Integrity Agent.

### 1.3 Closed-Loop Validation
The 7-step workflow operates as a closed feedback system:
1. Hypothesis → 2. Model → 3. Evidence → 4. Narrative → 5. Objection → 6. Revision → 7. Approval → (back to Evidence if challenged)

**Rule:** No step may be skipped. Workflow advancement requires explicit state transition events.

### 1.4 Deterministic + AI Hybrid
AI agents generate candidates. System enforces deterministic validation before finalization.

**Rule:** AI-generated outputs are always Draft state until validated by rule-based checks.

---

## 2. Architectural Constraints

### 2.1 Multi-Agent Orchestration
The system employs specialized agents with single responsibilities:
- HypothesisAgent: Value thesis generation
- FinancialModelAgent: Value tree construction
- EvidenceRetrievalAgent: Grounding data sourcing
- NarrativeAgent: Executive translation
- RedTeamAgent: Adversarial validation
- IntegrityAgent: Audit and compliance
- ValueEngineerAgent: Human-in-the-loop interface

**Constraint:** Agents communicate via MessageBus only. Direct coupling forbidden.

### 2.2 Distributed Saga Pattern
Workflow state transitions use Saga pattern with:
- Compensating actions for rollback
- Idempotent execution guarantees
- Event-driven state machine

**Constraint:** Every state mutation requires a compensating function registration.

### 2.3 Tenant Isolation
All data operations are tenant-scoped:
- Database queries include organization_id filter
- Vector queries include tenant_id metadata
- Cross-tenant data transfer is blocked

**Constraint:** Service role bypasses RLS only for AuthService, tenant provisioning, and cron jobs.

---

## 3. State Machine Specification

### 3.1 Valid States
- `INITIATED`: Workflow created, context building
- `DRAFTING`: Hypothesis and value tree under construction
- `VALIDATING`: Logic, evidence, and assumptions being verified
- `COMPOSING`: Narrative and executive outputs being generated
- `REFINING`: Red team feedback incorporated
- `FINALIZED`: Locked and approved (decision-grade)
- `ROLLED_BACK`: Compensation executed due to failure

### 3.2 State Transitions
```
INITIATED → DRAFTING: hypothesis_generated
DRAFTING → VALIDATING: model_constructed
VALIDATING → COMPOSING: evidence_sufficient
VALIDATING → DRAFTING: evidence_insufficient (loop back)
COMPOSING → REFINING: narrative_generated
REFINING → FINALIZED: objections_resolved
REFINING → VALIDATING: assumptions_invalid (loop back)
ANY → ROLLED_BACK: saga_compensation_triggered
```

### 3.3 Transition Requirements
Each transition requires:
- Event trigger (CloudEvent format)
- Pre-condition validation
- Post-condition assertion
- Audit log entry

---

## 4. Data Contracts

### 4.1 Hypothesis Artifact
```typescript
interface Hypothesis {
  id: string;                    // HYP-{uuid}
  metric: string;                // KPI identifier
  expected_delta: number;        // Percentage change
  value_type: 'cash_flow_improvement' | 'cost_reduction' | 'revenue_growth';
  confidence_threshold: number;  // Minimum 0.7
  created_at: ISO8601;
  tenant_id: string;             // Required for isolation
}
```

### 4.2 Value Tree Artifact
```typescript
interface ValueTree {
  id: string;
  hypothesis_id: string;         // Foreign key
  driver: string;                // Human-readable description
  formula: string;               // Deterministic calculation
  inputs: string[];              // Required data points
  outputs: {
    npv?: number;
    irr?: number;
    payback_months?: number;
  };
  assumptions: Assumption[];
  tenant_id: string;
}
```

### 4.3 Evidence Bundle
```typescript
interface Evidence {
  id: string;
  hypothesis_id: string;
  sources: Source[];
  confidence: number;            // 0-1 aggregate score
  gaps: string[];                // Missing data points
  tenant_id: string;
}

interface Source {
  type: '10-K' | '10-Q' | 'benchmark' | 'crm' | 'erp';
  origin: string;
  retrieval_date: ISO8601;
  confidence: number;
}
```

### 4.4 Audit Trail Entry
```typescript
interface AuditEntry {
  id: string;
  workflow_id: string;
  stage: LifecycleStage;
  action: string;
  actor: string;                 // agent_id or user_id
  timestamp: ISO8601;
  delta?: Record<string, unknown>;
  tenant_id: string;
}
```

---

## 5. Security & Compliance Rules

### 5.1 Data Handling
- PII detection and redaction before agent ingestion
- Financial data encrypted at rest and in transit
- No cross-tenant aggregation without explicit opt-in

### 5.2 Audit Requirements
- All create/update/delete operations logged
- Immutable audit trail (append-only)
- 7-year retention for financial decisions

### 5.3 Agent Permissions
- Agents have tool-specific permissions via policy files
- Agent identity expires and requires refresh
- Kill switch capability for runtime disabling

---

## 6. Quality Gates

### 6.1 Hypothesis Quality
- Must specify metric, delta, and value type
- Confidence threshold ≥ 0.7 for financial decisions
- Requires at least one data source reference

### 6.2 Model Quality
- All formulas deterministic and testable
- Assumptions explicitly listed with confidence scores
- Sensitivity analysis required for NPV > $1M

### 6.3 Evidence Quality
- Minimum 2 independent sources for key assumptions
- Confidence score ≥ 0.8 for primary drivers
- Gaps documented if data unavailable

### 6.4 Narrative Quality
- Executive summary ≤ 500 words
- Clear link between hypothesis and financial outcome
- Risk disclosure mandatory

---

## 7. Human-in-the-Loop Requirements

### 7.1 Mandatory Approval Points
- Hypothesis approval: Value Engineer validates thesis
- Model approval: Value Engineer confirms assumptions
- Final approval: CFO or delegate locks business case

### 7.2 Override Capabilities
- Value Engineer can force workflow advancement
- CFO can approve despite Red Team objections (with justification)
- Audit trail captures all overrides

### 7.3 Rejection Handling
- Rejected artifacts return to appropriate stage with feedback
- Maximum 3 revision cycles before human escalation required
- All rejection reasons logged

---

## 8. Failure Handling

### 8.1 Saga Compensation
Every stage has registered compensating action:
- `INITIATED`: Delete workflow record
- `DRAFTING`: Archive draft artifacts
- `VALIDATING`: Invalidate cached evidence
- `COMPOSING`: Delete generated outputs
- `REFINING`: Revert to previous version

### 8.2 Retry Policy
- Standard: 3 attempts, exponential backoff
- Aggressive: 5 attempts for critical financial models
- Conservative: 2 attempts for expensive operations (LLM calls)

### 8.3 Circuit Breaker
- Failure threshold: 5 errors in 60 seconds
- Recovery period: 30 seconds
- Fallback: Queue for manual review

---

## 9. Observability Standards

### 9.1 Metrics
- Workflow duration by stage
- Agent invocation count and latency
- Evidence confidence distribution
- Red team objection frequency by type

### 9.2 Tracing
- OpenTelemetry trace propagation
- Correlation IDs across agent boundaries
- Tenant ID in all span attributes

### 9.3 Alerting
- Workflow stuck > 2 hours
- Evidence confidence < 0.5
- Red Team finds critical flaws
- Compensation actions triggered

---

## 10. Evolution Rules

### 10.1 Versioning
- Constitution versions follow semver
- Breaking changes require migration plan
- Previous versions supported for 90 days

### 10.2 Amendment Process
1. Propose change with impact analysis
2. Review by system architects
3. Test in staging with sample workflows
4. Deploy with feature flag
5. Monitor for 48 hours
6. Full rollout or rollback

---

## Appendix: Glossary

- **CFO-Defensible**: Meeting standards for board presentation and audit
- **Hypothesis**: Quantifiable value thesis with expected outcome
- **Value Tree**: Structured financial model linking drivers to outcomes
- **Red Team**: Adversarial agent challenging assumptions
- **Saga**: Distributed transaction pattern with compensation
- **SDUI**: Server-Driven UI (dynamic interface generation)
