# Escalation Matrix v1.0

**Status:** Draft
**Scope:** ValueOS Agent Fabric — MVP Model Creation Pipeline
**Date:** 2026-03-23
**Derived from:** `packages/backend/src/__tests__/mvp-model-creation.test.ts` (17 test cases)

---

## Severity Tiers

| Tier | Name | SLA | Response |
|------|------|-----|----------|
| L0 | Autonomous Resolution | Immediate | Agent self-corrects or degrades gracefully |
| L1 | System Arbitration | 30s | Orchestrator intervenes to break tie or retry |
| L2 | Review Required | 1 hour | Pipeline pauses; human review triggered via dashboard alert |
| L3 | Critical Intervention | 15 min | Subsystem halt; rapid human input required |
| L4 | Emergency Stop | 5 min | Total agent fabric lockdown; security/compliance review |

---

## Failure Mode Registry

### Coordination Tax: Divergent Interpretations

| ID | Scenario | Test Reference | Severity | Trigger | System Response |
|----|----------|---------------|----------|---------|-----------------|
| CT-001 | Empty memory at handoff (Opportunity → FinancialModeling) | `Seam: empty memory` | L0 | `retrieve()` returns `[]` | FinancialModelingAgent returns `status: 'failure'`, error `"No hypotheses found"`. No LLM call. |
| CT-002 | Unverified hypotheses in memory | `Seam: unverified hypotheses` | L0 | `metadata.verified === false` | Agent filters out; if zero remain → same as CT-001. |
| CT-003 | Missing workspace_id | `Seam: Missing workspace_id` | L0 | `context.workspace_id === ''` | `validateInput()` throws `"Invalid input context"` before any work. |

### False Consensus: Hallucination Cascades

| ID | Scenario | Test Reference | Severity | Trigger | System Response |
|----|----------|---------------|----------|---------|-----------------|
| FC-001 | LLM returns invalid JSON | `Seam: LLM hallucination` | L0 | `secureInvoke` Zod validation fails | Agent catches, returns `status: 'failure'`, error `"Financial projection generation failed"`. |
| FC-002 | IntegrityAgent veto issued | `Escalation: veto` | L2 | Deterministic policy detects missing evidence | `status: 'failure'`, `veto_decision.veto: true`. Pipeline must halt before NarrativeAgent. |

### Confused Deputy / Tool Misuse

| ID | Scenario | Test Reference | Severity | Trigger | System Response |
|----|----------|---------------|----------|---------|-----------------|
| CD-001 | Cross-tenant context (FinancialModelingAgent) | `Seam: Tenant isolation` | L4 | `context.organization_id !== agent.tenantId` | Throws `/tenant context mismatch/i` — immediate halt. |
| CD-002 | Cross-tenant context (IntegrityAgent) | `Seam: Tenant isolation` | L4 | Same as CD-001 | Same response. |

### Stale Memory / Corrupted Retrieval

| ID | Scenario | Test Reference | Severity | Trigger | System Response |
|----|----------|---------------|----------|---------|-----------------|
| SM-001 | Evidence array empty | `Escalation: veto` (implicit) | L2 | `claim.evidence.length === 0` | Deterministic policy adds `data_integrity` issue + veto trace. |

### Infrastructure Degradation

| ID | Scenario | Test Reference | Severity | Trigger | System Response |
|----|----------|---------------|----------|---------|-----------------|
| INF-001 | LLM service unavailable | `Escalation: LLM total failure` | L1 | `complete()` rejects | Circuit breaker catches; agent returns `status: 'failure'`. Retry via orchestrator policy. |

---

## Acceptance Gates & Agent Contracts

### Input Validation Gate (All Agents)

- **Enforcer:** `BaseAgent.validateInput()`
- **Contract:** `workspace_id`, `organization_id`, `user_id` must be non-empty strings.
- **Violation:** Immediate throw (L0 — no work started).

### Tenant Isolation Gate (All Agents)

- **Enforcer:** Agent constructor + `execute()` early exit
- **Contract:** `context.organization_id` must match `this.organizationId`.
- **Violation:** Throw with tenant mismatch message (L4).

### Memory Schema Gate (FinancialModelingAgent)

- **Enforcer:** `retrieveHypotheses()` filter logic
- **Contract:** Hypotheses must have `metadata.verified === true` and non-null `category`.
- **Violation:** Filter applied; empty result → CT-001 path.

### Integrity Veto Gate (IntegrityAgent)

- **Enforcer:** `evaluateVetoDecision()` static method
- **Contract:** Deterministic policy trace drives veto; LLM supplemental only.
- **Veto Conditions:**
  - Policy trace contains `status: 'veto'`
  - `data_integrity` issue with `severity: 'high'` present
- **Violation:** `veto: true`, `status: 'failure'` → pipeline halt.

### Orchestration Contract (NarrativeAgent Preconditions)

- **Enforcer:** Workflow orchestrator (documented, not yet enforced in harness)
- **Contract:** NarrativeAgent must only execute if `integrity.veto_decision.veto === false`.
- **Violation:** If veto true, NarrativeAgent call is skipped (tested via orchestration contract assertion).

---

## Policy Trace Schema

Each gate emits a `PolicyTrace` entry:

```typescript
interface PolicyTrace {
  claim_id?: string;      // Associated claim, if applicable
  rule: string;           // Rule identifier (e.g., 'evidence_presence')
  status: 'pass' | 'refine' | 'veto';
  message: string;        // Human-readable explanation
}
```

Aggregated traces are stored in `AgentOutput.result.policy_trace` for audit.

---

## CI Enforcement

All entries above are validated by `mvp-model-creation.test.ts`. Key test references:

| Test | Coverage |
|------|----------|
| `should execute full 5-stage agent chain: Opportunity → FinancialModeling → Integrity → Narrative` | E2E happy path including NarrativeAgent execution with `executive_summary`, `key_proof_points`, `defense_readiness_score` validation |
| `should handle export endpoints correctly` | PDF/PPTX signed URL contract validation |

To add a new failure mode:

1. Add test case to harness with explicit trigger.
2. Map to severity tier in this matrix.
3. Ensure policy trace is emitted and asserted.
4. Update orchestrator logic if new veto condition affects NarrativeAgent preconditions.

---

## Open Questions / TODO

- [x] NarrativeAgent full execution test (completed: `should execute full 5-stage agent chain` in `mvp-model-creation.test.ts`).
- [ ] Define L1 retry policy (exponential backoff, max attempts) for INF-001.
- [ ] Add metric: `agent_fabric_escalation_total{severity, rule}` for Prometheus.
- [ ] Dashboard alert routing: which channels for L2 vs L3?
