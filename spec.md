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
