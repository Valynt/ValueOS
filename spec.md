<<<<<<< HEAD
# Spec: Agent Fabric Resilience — LLM Gateway Hardening & Orchestrator Tracing

## Problem Statement

The `LLMGateway` (`packages/backend/src/lib/agent-fabric/LLMGateway.ts`) has no circuit breaker, retry, or timeout logic. If an LLM provider goes down or rate-limits, every consumer (6+ services) fails immediately with no recovery path. The `UnifiedAgentOrchestrator` also lacks distributed tracing — there is no way to see the cost and latency breakdown of a multi-step agent reasoning chain in the observability stack.

## Current State

### LLMGateway
- `LLMGateway.complete()` makes a single attempt with no retry, no circuit breaker, no configurable timeout.
- `LLMGateway.executeCompletion()` is a placeholder returning mock data — real calls go through `LLMFallbackService` which has its own `ExternalCircuitBreaker` but is a separate code path.
- 6+ services instantiate `LLMGateway` directly: `EmailAnalysisService`, `AdversarialValidator`, `AgentChatService`, `IntegrityAgentService`, `CallAnalysisService`, `ValueLifecycleOrchestrator`.

### Circuit Breakers
- 3 separate implementations exist, none wired into `LLMGateway`:
  1. `lib/resilience.ts` — inline CB + retry with exponential backoff + bulkhead + timeout (best tested)
  2. `config/secrets/CircuitBreaker.ts` — standalone class with basic open/half-open/closed
  3. `services/agents/resilience/AgentRetryManager.ts` — agent-level retry with fallback agents

### Tracing
- OpenTelemetry SDK initialized in `config/telemetry.ts` with OTLP HTTP export.
- `traceLLMOperation()` helper exists but is only used by `LLMFallbackServiceWithTracing`, not by `LLMGateway`.
- `AgentTelemetryService` records OTel metrics (counters/histograms) but no distributed trace spans for orchestrator reasoning steps.
- `UnifiedAgentOrchestrator` has no span creation — `processQuery`, `executeStageWithRetry`, `executeStage`, and the direct `llmGateway.chat()` call (line 1846) are all untraced.

### Observability Infrastructure
- Jaeger (OTLP-compatible) in `infra/docker-compose.observability.yml`.
- Decision: emit OTLP traces; backend (Jaeger/Tempo) is a deployment concern.

## Requirements

### R1: LLMResilience Module

Create `packages/backend/src/lib/agent-fabric/LLMResilience.ts` — a wrapper that adds circuit breaker + retry with exponential backoff to any `LLMGateway` instance.

**R1.1** Circuit breaker per LLM provider key (e.g., `llm:openai`, `llm:anthropic`, `llm:together`).
- Default thresholds: 5 failures to open, 60s cooldown, 2 half-open successes to close.
- Configurable via constructor options.

**R1.2** Retry with exponential backoff + jitter for transient failures.
- Default: 3 attempts, 1s base delay, 2x multiplier, 30s max delay, 0.2 jitter ratio.
- Only retry on transient errors (network, 429, 500-503). Do not retry on 400, 401, 403, 404.
- Configurable via constructor options.

**R1.3** Per-request timeout (default 30s, configurable).

**R1.4** The module wraps `LLMGateway.complete()` — all existing consumers get base resilience automatically when they use the wrapped gateway.

**R1.5** Consumers can layer additional retry/fallback logic on top (the module does not prevent this).

### R2: Integrate Resilience into LLMGateway

**R2.1** Modify `LLMGateway.complete()` to use the `LLMResilience` module internally, so all 6+ consumers get circuit breaker + retry without code changes.

**R2.2** Expose a `LLMGateway.completeRaw()` method (or similar) for consumers that want to handle resilience themselves.

**R2.3** Circuit breaker state must be observable — expose `getCircuitBreakerState()` returning current state and metrics.

### R3: Orchestrator Distributed Tracing

Add OpenTelemetry spans to `UnifiedAgentOrchestrator` at every level of the reasoning hierarchy:

**R3.1** `processQuery` — root span for the entire query processing.
- Attributes: `agent.query`, `agent.user_id`, `agent.session_id`, `agent.trace_id`, `agent.organization_id`.

**R3.2** `selectAgent` / agent routing — child span.
- Attributes: `agent.selected_type`, `agent.routing_strategy`.

**R3.3** `executeStageWithRetry` — child span per workflow stage.
- Attributes: `agent.stage_id`, `agent.stage_name`, `agent.agent_type`, `agent.retry_count`.

**R3.4** `executeStage` — child span for the actual stage execution.
- Attributes: `agent.stage_id`, `agent.agent_type`.

**R3.5** LLM calls (via `LLMGateway.complete()`) — leaf span.
- Attributes: `llm.provider`, `llm.model`, `llm.prompt_tokens`, `llm.completion_tokens`, `llm.total_tokens`, `llm.cost_usd`, `llm.latency_ms`, `llm.cached`.

**R3.6** Every span must record:
- `cost_usd`: accumulated cost at that level (LLM spans have per-call cost; parent spans aggregate child costs).
- `latency_ms`: wall-clock duration.
- Error status and exception recording on failure.

### R4: Tests

**R4.1** Unit tests for `LLMResilience`:
- Circuit breaker opens after N failures, rejects while open, transitions to half-open after cooldown, closes after successes.
- Retry with exponential backoff: verify delay progression, jitter bounds, max delay cap.
- Non-retryable errors (400, 401) are not retried.
- Timeout fires correctly.

**R4.2** Unit tests for `LLMGateway` integration:
- `complete()` retries on transient failure and succeeds.
- `complete()` opens circuit breaker after repeated failures.
- `completeRaw()` bypasses resilience.

**R4.3** Unit tests for orchestrator tracing:
- `processQuery` creates a root span with correct attributes.
- Nested spans are created for stage execution and LLM calls.
- Cost and latency attributes are recorded on spans.
- Failed operations record error status and exceptions.

All tests use vitest (project standard). No real LLM calls — mock `executeCompletion()`.

## Implementation Approach

### Phase 1: LLMResilience Module
1. Create `packages/backend/src/lib/agent-fabric/LLMResilience.ts` with:
   - `LLMResilienceConfig` interface (CB thresholds, retry options, timeout).
   - `LLMResilienceWrapper` class that wraps a `LLMGateway` instance.
   - Uses the circuit breaker pattern from `lib/resilience.ts` (`executeWithResilience`) as the underlying mechanism — reuse, don't reinvent.
   - Classifies LLM errors as retryable/non-retryable based on HTTP status or error type.
2. Write tests in `packages/backend/src/lib/agent-fabric/__tests__/LLMResilience.test.ts`.

### Phase 2: LLMGateway Integration
1. Modify `LLMGateway.complete()` to delegate through `LLMResilienceWrapper`.
2. Add `completeRaw()` that calls `executeCompletion()` directly (no resilience).
3. Add `getCircuitBreakerState()` method.
4. Update existing `LLMGateway.test.ts` with resilience integration tests.

### Phase 3: Orchestrator Tracing
1. Import `getTracer` from `config/telemetry.ts`.
2. Add span creation to `processQuery`, agent selection, `executeStageWithRetry`, `executeStage`.
3. Add span creation inside `LLMGateway.complete()` for LLM call tracing (using existing `traceLLMOperation` pattern).
4. Ensure cost aggregation: LLM spans record per-call cost; parent spans sum child costs via span events or attributes set after children complete.
5. Write tracing tests in `packages/backend/src/services/__tests__/UnifiedAgentOrchestrator.tracing.test.ts`.

### Files Modified
- `packages/backend/src/lib/agent-fabric/LLMResilience.ts` (new)
- `packages/backend/src/lib/agent-fabric/__tests__/LLMResilience.test.ts` (new)
- `packages/backend/src/lib/agent-fabric/LLMGateway.ts` (modified)
- `packages/backend/src/lib/agent-fabric/__tests__/LLMGateway.test.ts` (modified)
- `packages/backend/src/services/UnifiedAgentOrchestrator.ts` (modified)
- `packages/backend/src/services/__tests__/UnifiedAgentOrchestrator.tracing.test.ts` (new)

### Files NOT Modified
- Existing circuit breaker implementations (`config/secrets/CircuitBreaker.ts`, `AgentRetryManager.ts`) — left as-is; no consolidation in this scope.
- Consumer services (EmailAnalysis, etc.) — they get resilience automatically via LLMGateway.
- `LLMFallbackService` / `LLMFallbackServiceWithTracing` — separate code path, out of scope.

## Acceptance Criteria

1. **`LLMResilience.test.ts` passes** — circuit breaker state transitions, retry backoff progression, non-retryable error handling, timeout behavior all verified.
2. **`LLMGateway.test.ts` passes** — `complete()` retries transient failures, opens CB after repeated failures, `completeRaw()` bypasses resilience, `getCircuitBreakerState()` returns correct state.
3. **`UnifiedAgentOrchestrator.tracing.test.ts` passes** — root span created for `processQuery`, nested child spans for stage execution and LLM calls, cost/latency attributes recorded, errors propagated to span status.
4. **All existing tests still pass** — `pnpm test:unit` green (no regressions).
5. **No new dependencies added** — reuse `lib/resilience.ts` patterns and existing `@opentelemetry/api`.

## Completion Criteria (Ralph Loop)

The implementation is done when:
1. All 3 new/modified test files pass (`pnpm test:unit` or targeted vitest runs).
2. Existing test suite has no regressions.
3. `LLMGateway.complete()` has circuit breaker + retry with exponential backoff built in.
4. `UnifiedAgentOrchestrator.processQuery()` emits nested OTLP spans with cost and latency at every level of the reasoning hierarchy.
=======
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
>>>>>>> wip/save-20260212-063344
