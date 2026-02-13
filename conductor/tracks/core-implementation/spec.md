# Spec: ValueOS Agentic Workflow Engine


## Problem Statement

ValueOS has extensive scaffolding for an agentic Value Engineering platform — agent base infrastructure, SDUI components, a lifecycle orchestrator with saga compensation, database schema with RLS, and domain agents. However, the core agentic workflow described in the Architectural Design Brief is not wired end-to-end:

- **Agent orchestration is empty** — `packages/agents/orchestration/index.ts` and `packages/agents/core/index.ts` export nothing.
- **Domain agents use mock data** — `financial-modeling`, `narrative`, `integrity`, `groundtruth` agents return hardcoded responses instead of calling the LLMGateway.
- **Memory modules are stubs** — `packages/memory/{semantic,episodic,vector,provenance}/index.ts` all export `{}`.
- **The saga state machine doesn't match the design brief** — current states are generic (`created`, `started`, `completed`, `failed`, `paused`) instead of the domain-specific phases (`INITIATED`, `DRAFTING`, `VALIDATING`, `COMPOSING`, `REFINING`, `FINALIZED`).
- **No hypothesis-first core loop** — the design brief's 7-step loop (Hypothesis → Model → Evidence → Narrative → Objection → Revision → Approval) has no implementation.
- **No evidence tiering** — the Integrity Engine lacks Tier 1/2/3 classification and confidence scoring based on data freshness, source reliability, and logic transparency.
- **No idempotency enforcement** — agent requests don't carry or validate idempotency keys.
- **No Dead-Letter Queue** — failed agent tasks are logged but not routed to a DLQ for inspection.
- **No Red Team agent** — the "Objection" step has no agent implementation.

The `ValueLifecycleOrchestrator` (795 lines) and `IntegrityValidationService` (852 lines) contain substantial saga and validation logic but need to be aligned to the design brief's state machine and connected to real agent execution.

## Existing Assets (What We Keep)

| Asset | Location | Status |
|---|---|---|
| Agent base (server, config, health, safety, context) | `packages/agents/base/src/` | Working |
| SDUI schema + renderer | `packages/sdui/src/schema.ts`, `engine/renderPage.ts` | Working |
| SDUI components (DiscoveryCard, KPIForm, ValueTreeCard, NarrativeBlock) | `packages/sdui/src/components/SDUI/` | Working |
| ConfidenceDisplay, IntegrityVetoPanel, WorkflowStatusBar | `packages/sdui/src/components/Agent/`, `Workflow/` | Working |
| ValueLifecycleOrchestrator (saga + compensation) | `packages/backend/src/services/ValueLifecycleOrchestrator.ts` | Needs alignment |
| WorkflowStateMachine | `packages/backend/src/services/WorkflowStateMachine.ts` | Needs replacement |
| WorkflowExecutionStore (Redis) | `packages/backend/src/services/WorkflowExecutionStore.ts` | Working |
| IntegrityValidationService | `packages/backend/src/services/IntegrityValidationService.ts` | Working, extend |
| LLMGateway (multi-provider, cost tracking, circuit breaker) | `packages/backend/src/lib/agent-fabric/LLMGateway.ts` | Working |
| BaseAgent (abstract, secureInvoke with Zod validation) | `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts` | Working |
| Domain agents (Opportunity, Target, Expansion, Integrity, Realization) | `packages/backend/src/lib/agent-fabric/agents/` | Working (backend fabric) |
| Database schema (organizations, cases, workflows, workflow_states, agents, agent_runs, kpis) | `infra/supabase/supabase/migrations/` | Working |
| RLS policies (tenant-scoped via JWT) | `infra/supabase/supabase/migrations/20231202000000_rls.sql` | Working |
| Domain events (typed, with EventMeta, correlationId) | `packages/shared/src/types/events.ts` | Working |
| SSE streaming for agent responses | `packages/backend/src/api/agents.ts` | Working |
| Audit trail service | `packages/backend/src/services/security/AuditTrailService.ts` | Working |
| CircuitBreaker | `packages/backend/src/lib/agent-fabric/CircuitBreaker.ts` | Working |

## Requirements

### R1: Value Case Saga State Machine

Replace the generic `WorkflowStateMachine` with a domain-specific state machine matching the design brief.

**File:** `packages/agents/core/ValueCaseSaga.ts` (new)

States and transitions:

```
INITIATED  →  DRAFTING  →  VALIDATING  →  COMPOSING  →  REFINING  →  FINALIZED
                  ↑              |              |            |
                  └──────────────┘              |            |
                  (integrity veto)              |            |
                  ↑                             |            |
                  └─────────────────────────────┘            |
                  (red-team objection)                       |
                  ↑                                          |
                  └──────────────────────────────────────────┘
                  (user feedback)
```

| Phase | State | Trigger | Output |
|---|---|---|---|
| Discovery | `INITIATED` | Opportunity ID ingested | Context map, pain points |
| Modeling | `DRAFTING` | Hypothesis confirmed | Value Tree (JSON) |
| Integrity | `VALIDATING` | Model complete | Confidence scores, citations |
| Narrative | `COMPOSING` | Integrity check pass | Executive summary, SDUI page |
| Iteration | `REFINING` | User/Red-Team feedback | Delta-updates to model |
| Realization | `FINALIZED` | VE approval | Locked business case |

Each transition must:
- Validate the transition is legal
- Persist state to `workflow_states` table via Supabase
- Emit a typed domain event (`saga.state.transitioned`)
- Record the transition in the audit trail with `correlation_id`

Compensation handlers:
- `DRAFTING` → revert value tree to previous version
- `VALIDATING` → clear confidence scores, re-queue for modeling
- `COMPOSING` → delete generated narrative, revert to VALIDATING
- `REFINING` → restore pre-refinement snapshot

**File:** `packages/agents/core/index.ts` — export `ValueCaseSaga`, state types, transition types

### R2: Hypothesis-First Core Loop Orchestrator

Wire the 7-step core loop as a saga-driven orchestration.

**File:** `packages/agents/orchestration/HypothesisLoop.ts` (new)

The orchestrator accepts a `valueCaseId` and `tenantId`, then drives the loop:

1. **Hypothesis** — Call `OpportunityAgent` to propose value drivers from discovery signals. Output: array of `ValueHypothesis` objects.
2. **Model** — For each confirmed hypothesis, call `FinancialModelingAgent` to build a Value Tree. Output: `ValueTree` JSON persisted to DB.
3. **Evidence** — Call `GroundTruthAgent` to fetch grounding data. Classify evidence into tiers (R4). Output: `EvidenceBundle` with citations.
4. **Narrative** — Call `NarrativeAgent` to translate the math into a business story. Output: SDUI `NarrativeBlock` payload.
5. **Objection** — Call `RedTeamAgent` (R3) to stress-test. Output: array of `Objection` objects with severity.
6. **Revision** — If objections exist, auto-correct by re-entering at step 2 (DRAFTING) with objection context. Max 3 revision cycles.
7. **Approval** — Present to VE via SDUI. On approval, transition to FINALIZED.

Each step:
- Carries an `idempotency_key` (UUID) to prevent duplicate execution (R5)
- Streams progress to the frontend via SSE
- Records token usage, cost, and duration per agent invocation
- On failure, triggers saga compensation (R1) and routes to DLQ (R6)

**File:** `packages/agents/orchestration/index.ts` — export `HypothesisLoop`, loop types

### R3: Red Team Agent

Implement the "Objection" step — a Red Team agent that stress-tests value claims.

**File:** `packages/agents/orchestration/agents/RedTeamAgent.ts` (new)

Behavior:
- Receives a `ValueTree` + `NarrativeBlock` + `EvidenceBundle`
- Simulates CFO pushback: challenges assumptions, questions data sources, probes for math hallucinations
- Produces an array of `Objection` objects:
  ```typescript
  interface Objection {
    id: string;
    targetComponent: string;  // which value tree node or narrative claim
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'assumption' | 'data_quality' | 'math_error' | 'missing_evidence' | 'logical_gap';
    description: string;
    suggestedRevision?: string;
  }
  ```
- Uses the LLMGateway (not mock data) with a system prompt tuned for adversarial analysis
- Critical objections (`severity: 'critical'`) trigger automatic revision; others are flagged for VE review

### R4: Evidence Tiering and Confidence Scoring

Implement the Integrity Engine's evidence classification and confidence scoring.

**File:** `packages/agents/core/EvidenceTiering.ts` (new)

Evidence tiers:
- **Tier 1 (Public/Primary)**: EDGAR filings, 10-K/Q, customer-provided data. Weight: 1.0
- **Tier 2 (Market/Secondary)**: Gartner/Forrester, industry benchmarks. Weight: 0.7
- **Tier 3 (Benchmarks)**: Internal historical data, anonymized aggregates. Weight: 0.4

**File:** `packages/agents/core/ConfidenceScorer.ts` (new)

Confidence score (0.0-1.0) computed from:
- **Data Freshness**: `1.0 - (age_days / max_age_days)`, clamped to [0, 1]. Max age: 365 days for Tier 1, 730 for Tier 2, 1095 for Tier 3.
- **Source Reliability**: Tier weight (above)
- **Logic Transparency**: 1.0 if formula decomposes to primitive inputs, 0.5 if partially opaque, 0.0 if black-box

Final score: weighted average `(freshness * 0.3) + (reliability * 0.4) + (transparency * 0.3)`

Every claim in the Value Tree and NarrativeBlock must carry a `ConfidenceScore` and at least one `Citation` linking to the evidence source.

### R5: Idempotency Enforcement

Ensure all agent requests include and validate an idempotency key.

**File:** `packages/agents/core/IdempotencyGuard.ts` (new)

Behavior:
- Every agent request must include an `idempotency_key` (UUIDv4) in the request payload
- Before execution, check Redis for `idempotency:{key}` — if exists, return the cached result
- After successful execution, store the result in Redis with TTL of 24 hours
- The `HypothesisLoop` orchestrator generates idempotency keys per step

**Integration:** Add idempotency check to `BaseAgent.secureInvoke()` in `packages/backend/src/lib/agent-fabric/agents/BaseAgent.ts`

### R6: Dead-Letter Queue for Failed Agent Tasks

Route failed agent tasks to a DLQ for manual inspection.

**File:** `packages/agents/core/DeadLetterQueue.ts` (new)

Behavior:
- When an agent task fails after circuit breaker exhaustion (all retries failed), push the failed task to a Redis list `dlq:agent_tasks`
- Each DLQ entry contains: `{ taskId, agentType, input, error, timestamp, correlationId, tenantId, retryCount }`
- Expose a `/api/admin/dlq` endpoint (admin-only) to list, inspect, and retry DLQ entries
- Emit a `system.dlq.enqueued` domain event for alerting

### R7: Wire Domain Agents to LLMGateway

Replace mock implementations in `packages/agents/` domain agents with real LLM calls.

**Files to modify:**
- `packages/agents/financial-modeling/src/index.ts` — replace `FinancialModelingAnalyzer` mock with LLMGateway call using a financial modeling system prompt. Parse response with Zod schema.
- `packages/agents/narrative/src/index.ts` — replace `NarrativeAnalyzer` mock with LLMGateway call using a narrative construction system prompt.
- `packages/agents/integrity/src/index.ts` — replace `IntegrityAnalyzer` mock with LLMGateway call using an integrity analysis system prompt.
- `packages/agents/groundtruth/src/index.ts` — replace mock with LLMGateway call for evidence retrieval and classification.

Each agent must:
- Accept an `LLMGateway` instance via constructor injection (not hardcoded)
- Use `BaseAgent.secureInvoke()` for Zod-validated, circuit-breaker-protected LLM calls
- Include `idempotency_key` in every request
- Record token usage and cost via the existing `agent_runs` table
- Return structured output matching the existing response schemas

### R8: Memory Module — Provenance Tracking

Implement the provenance module to track data lineage for the "CFO Defence" requirement.

**File:** `packages/memory/provenance/index.ts` (replace empty stub)

```typescript
interface ProvenanceRecord {
  id: string;
  valueCaseId: string;
  claimId: string;           // which value tree node or narrative claim
  dataSource: string;        // raw data source reference
  evidenceTier: 1 | 2 | 3;
  formula?: string;          // the calculation formula used
  agentId: string;           // which agent produced this
  agentVersion: string;
  confidenceScore: number;
  createdAt: string;
  parentRecordId?: string;   // for tracking derivation chains
}
```

Behavior:
- Every calculated figure in the Value Tree must have a `ProvenanceRecord`
- Clicking a number in the UI triggers a provenance lookup that returns the full lineage chain
- Provenance records are immutable (append-only)
- Stored in the `agent_memory` table with `memory_type: 'provenance'`

### R9: Align ValueLifecycleOrchestrator to Design Brief

Update the existing `ValueLifecycleOrchestrator` to use the new `ValueCaseSaga` (R1) and `HypothesisLoop` (R2).

**File:** `packages/backend/src/services/ValueLifecycleOrchestrator.ts` (modify)

Changes:
1. Replace the generic `LifecycleStage` type with the saga states from R1
2. Replace `runLifecycle()` with a method that delegates to `HypothesisLoop`
3. Keep the existing compensation infrastructure but align compensation handlers to R1's definitions
4. Add `idempotency_key` to `LifecycleContext`
5. Add DLQ routing on terminal failures (R6)
6. Preserve the existing audit trail integration

### R10: Domain Events for Saga Transitions

Extend the domain events system to cover saga state transitions.

**File:** `packages/shared/src/types/events.ts` (modify)

Add new event types:
```typescript
type SagaEvent =
  | { type: 'saga.state.transitioned'; payload: { valueCaseId: string; fromState: string; toState: string; trigger: string; agentId?: string; } }
  | { type: 'saga.compensation.executed'; payload: { valueCaseId: string; compensationName: string; success: boolean; error?: string; } }
  | { type: 'saga.hypothesis.proposed'; payload: { valueCaseId: string; hypotheses: Array<{ id: string; description: string; confidence: number }>; } }
  | { type: 'saga.integrity.vetoed'; payload: { valueCaseId: string; componentId: string; reason: string; confidenceScore: number; } }
  | { type: 'saga.redteam.objection'; payload: { valueCaseId: string; objections: Array<{ id: string; severity: string; description: string }>; } }
  | { type: 'saga.case.finalized'; payload: { valueCaseId: string; approvedBy: string; finalConfidence: number; } };
```

Add `SagaEvent` to the `DomainEvent` union. Add `'saga.commands'` and `'saga.events'` to `EVENT_TOPICS`.

## Files Changed (Summary)

### Created
| File | Purpose |
|---|---|
| `packages/agents/core/ValueCaseSaga.ts` | Domain-specific saga state machine (6 states, transitions, compensation) |
| `packages/agents/core/EvidenceTiering.ts` | Evidence tier classification (Tier 1/2/3) |
| `packages/agents/core/ConfidenceScorer.ts` | Confidence scoring (freshness, reliability, transparency) |
| `packages/agents/core/IdempotencyGuard.ts` | Redis-backed idempotency key validation |
| `packages/agents/core/DeadLetterQueue.ts` | Redis-backed DLQ for failed agent tasks |
| `packages/agents/orchestration/HypothesisLoop.ts` | 7-step core loop orchestrator |
| `packages/agents/orchestration/agents/RedTeamAgent.ts` | Adversarial objection agent |

### Modified
| File | Change |
|---|---|
| `packages/agents/core/index.ts` | Export ValueCaseSaga, EvidenceTiering, ConfidenceScorer, IdempotencyGuard, DeadLetterQueue |
| `packages/agents/orchestration/index.ts` | Export HypothesisLoop |
| `packages/agents/financial-modeling/src/index.ts` | Replace mock with LLMGateway integration |
| `packages/agents/narrative/src/index.ts` | Replace mock with LLMGateway integration |
| `packages/agents/integrity/src/index.ts` | Replace mock with LLMGateway integration |
| `packages/agents/groundtruth/src/index.ts` | Replace mock with LLMGateway integration |
| `packages/memory/provenance/index.ts` | Implement provenance tracking |
| `packages/backend/src/services/ValueLifecycleOrchestrator.ts` | Align to ValueCaseSaga and HypothesisLoop |
| `packages/shared/src/types/events.ts` | Add SagaEvent types and topics |

## Out of Scope

- Frontend UI changes (SDUI components already exist and will render the new payloads)
- Database schema migrations (existing tables support the new data model via JSONB columns)
- EDGAR/10-K API integration (GroundTruthAgent will use LLM for evidence retrieval; real API adapters are a follow-up)
- PPTX export (design brief mentions it; deferred to a separate spec)
- CI/CD workflow changes
- Kubernetes/infrastructure changes
- Changes to the existing `packages/backend/src/lib/agent-fabric/agents/` (these are the backend-internal agents; R7 targets the `packages/agents/` standalone agents)

## Acceptance Criteria

### AC1: Saga State Machine
- `ValueCaseSaga` implements all 6 states with valid transitions
- Invalid transitions throw with a descriptive error
- Each transition persists state and emits a domain event
- Compensation handlers exist for DRAFTING, VALIDATING, COMPOSING, REFINING

### AC2: Hypothesis Loop Executes End-to-End
- `HypothesisLoop.run(valueCaseId, tenantId)` drives through all 7 steps
- Each step calls the corresponding agent (not mock data)
- Progress streams to SSE
- On Red Team objection (critical), the loop re-enters at DRAFTING (max 3 cycles)
- On VE approval, state transitions to FINALIZED

### AC3: Red Team Agent Produces Structured Objections
- `RedTeamAgent` receives ValueTree + Narrative + Evidence
- Returns typed `Objection[]` with severity, category, and description
- Uses LLMGateway (not mock)

### AC4: Evidence Tiering and Confidence Scoring
- Every evidence item is classified as Tier 1, 2, or 3
- `ConfidenceScorer` computes a score from freshness, reliability, transparency
- Every Value Tree node and NarrativeBlock claim carries a confidence score and citation

### AC5: Idempotency
- Duplicate agent requests with the same idempotency key return cached results
- The HypothesisLoop generates unique keys per step per execution

### AC6: Dead-Letter Queue
- Failed agent tasks (after circuit breaker exhaustion) appear in the DLQ
- DLQ entries contain taskId, agentType, input, error, correlationId, tenantId
- A `system.dlq.enqueued` event is emitted

### AC7: Domain Agents Use LLMGateway
- `financial-modeling`, `narrative`, `integrity`, `groundtruth` agents call LLMGateway
- Responses are Zod-validated
- Token usage and cost are recorded in `agent_runs`

### AC8: Provenance Tracking
- Every calculated figure has a ProvenanceRecord
- Provenance records include data source, formula, agent, confidence score
- Records are queryable by valueCaseId and claimId

### AC9: Domain Events
- `saga.state.transitioned` events fire on every state change
- `saga.integrity.vetoed` fires on component-scoped vetoes
- `saga.redteam.objection` fires when Red Team produces objections
- `saga.case.finalized` fires on VE approval

### AC10: No Regressions
- Existing SDUI components render without errors
- Existing API endpoints (`/health`, `/metrics`, `/api/agents/*`) continue to work
- Existing tests pass

## Implementation Order

1. **R1: ValueCaseSaga** — foundation for all orchestration
2. **R4: EvidenceTiering + ConfidenceScorer** — needed by agents
3. **R5: IdempotencyGuard** — needed before wiring agents
4. **R6: DeadLetterQueue** — needed for failure handling
5. **R10: Domain Events** — needed for saga event emission
6. **R3: RedTeamAgent** — new agent, no dependencies on existing agent rewrites
7. **R7: Wire domain agents to LLMGateway** — replace mocks
8. **R2: HypothesisLoop** — orchestrates all agents (depends on R1, R3-R7)
9. **R8: Provenance tracking** — depends on agents producing real data
10. **R9: Align ValueLifecycleOrchestrator** — final integration

## Completion Criteria

The spec is fully satisfied when:
1. All files listed in "Files Changed" are created or modified as specified
2. All 10 acceptance criteria (AC1-AC10) are satisfied
3. TypeScript compilation passes (`pnpm run typecheck` or `tsc --noEmit`) for modified packages
4. The HypothesisLoop can be instantiated and its type signatures are correct (runtime execution depends on LLM API keys and database, which are environment-specific)
