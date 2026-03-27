# Frontend Agentic UX — Remediation & Test Strategy

**Status:** Approved for implementation  
**Scope:** `apps/ValyntApp` + `packages/sdui`  
**Author:** Manus AI (Principal QA Architect) — spec transcribed by Ona  
**Date:** 2026-03-26

---

## 1. Problem Statement

The ValueOS frontend has a foundational test suite (~146 tests) that validates synchronous UI behavior. It does not test the frontend as a distributed-systems interface. Four confirmed defects exist in production-path code, and the test infrastructure cannot detect them:

| # | Defect | Location | Risk |
|---|--------|----------|------|
| D-1 | `useAgentStream` has no reconnect logic and no `Last-Event-ID` cursor | `src/hooks/useAgentStream.ts` | SSE drop → infinite spinner |
| D-2 | `useAgentJob` query key omits `tenantId` | `src/hooks/useAgentJob.ts:L47` | Cross-tenant React Query cache bleed |
| D-3 | `AgentStateMachine` has zero dedicated tests | `src/lib/agent/stateMachine.ts` | Undetected invalid transitions in production |
| D-4 | No tests for `useAgentStream` or `useAgentJob` hooks | `src/hooks/` | Regressions ship silently |

Additionally, the CI `e2e-critical` lane covers only `auth-complete-flow` and `critical-user-flow`. No agent workflow is gated on any PR.

---

## 2. Scope

### In scope

- Fix D-1: add reconnect logic with `Last-Event-ID` cursor to `useAgentStream`
- Fix D-2: add `tenantId` to `useAgentJob` query key
- Write P0 tests: streaming resilience, multi-tenant cache isolation, SDUI contract/XSS
- Write selected P1 tests: `AgentStateMachine` transitions, observability (correlation ID, error boundary context)
- Add MSW where SSE/network-level fidelity justifies it (not blanket)
- Minimal CI changes: wire new test files into the existing `unit-component-schema` lane; add a `agent-workflow-e2e` Playwright spec targeting a deterministic seeded environment

### Out of scope

- Full CI architecture redesign
- Performance/load tests (P1 §4.2 large workflow rendering, N+1 detection)
- BullMQ queue-delay simulation (requires backend test harness not yet available)
- Quarantine automation (GitHub issue auto-creation on flaky detection)

---

## 3. Requirements

### R-1: `useAgentStream` reconnect (fixes D-1)

- On `es.onerror`, if the job is not in a terminal state, attempt reconnect with exponential backoff (initial 1 s, max 30 s, max 5 attempts)
- Track the last received SSE event ID; include `Last-Event-ID` header on reconnect requests via `EventSource` URL parameter (`?lastEventId=<id>`) since the native `EventSource` API does not support custom headers
- Expose `reconnectAttempts: number` and `isReconnecting: boolean` in the hook return value
- After exhausting retries, transition to error state with the correlation ID from the last received event (or the `jobId` as fallback)
- Do not duplicate messages on reconnect (deduplicate by event `id` field)

### R-2: `useAgentJob` tenant-scoped cache key (fixes D-2)

- Change query key from `["agent-job", jobId, directResult?.mode]` to `["agent-job", tenantId, jobId, directResult?.mode]`
- `tenantId` must be sourced from `useTenant()` (the `TenantContext` in `src/contexts/TenantContext.tsx`)
- When `tenantId` is `null` or `undefined`, the query must be disabled (same as `jobId === null`)
- Existing callers of `useAgentJob` must be updated to pass or derive `tenantId`

### R-3: P0 test — streaming resilience

- **Dropped connection recovery**: mock `EventSource` to emit an error mid-stream; assert the hook attempts reconnect, does not duplicate prior messages, and eventually surfaces an error with `jobId` after retry exhaustion
- **Terminal state guarantee**: mock a backend timeout (no events after open); assert the UI transitions to `error` state within the retry window and exposes a correlation ID, not an infinite spinner
- **Reconnect deduplication**: simulate reconnect delivering events already seen; assert message list contains no duplicates

### R-4: P0 test — multi-tenant cache isolation

- **Cache purge on tenant switch**: render a component using `useAgentJob` as Tenant A with an active job; switch to Tenant B via `TenantContext`; assert the React Query cache entry for Tenant A's job is not accessible under Tenant B's query key
- **Query disabled without tenant**: assert `useAgentJob` does not fire a network request when `tenantId` is `null`

### R-5: P0 test — SDUI contract & XSS

- **Unknown component fallback**: inject an SDUI payload with `type: "UnregisteredWidget_XYZ"`; assert `renderPage` renders `UnknownComponentFallback` (confirmed `data-testid="unknown-component-fallback"` exists) and does not throw
- **XSS prevention via `SafeHtml`**: inject payloads containing `<script>alert(1)</script>`, `onerror=` event handlers, and `javascript:` URIs; assert `sanitizeHtml` strips all vectors (existing `sanitizeHtml.test.ts` covers this — verify 90% branch coverage threshold is enforced in CI)
- **SDUI telemetry on unknown component**: assert `sduiTelemetry` emits an event when `LazyComponentRegistry` encounters an unregistered type (requires spy on telemetry module)

### R-6: P1 test — `AgentStateMachine` transitions

- **Valid transitions**: assert every transition in `validTransitions` succeeds from the correct `from` state
- **Invalid transition rejection**: assert `transition()` returns `false` and state does not change for invalid event/state combinations
- **History recording**: assert each successful transition appends an `AgentEvent` to `getHistory()`
- **Subscriber notification**: assert `subscribe()` listeners are called with the new state and event on each transition
- **Reset**: assert `reset()` returns state to `idle` and clears history

### R-7: P1 test — observability

- **Correlation ID in requests**: assert `unified-api-client` sets `X-Request-ID` header on every `POST` and `GET` (the implementation already does this at line 287; test must verify it is present and non-empty)
- **Error boundary context**: render a component that throws inside an `AgentResponseCard`; assert the nearest `ErrorBoundary` catches it and renders a `traceId` or `correlationId` in the error UI

### R-8: MSW adoption (selective)

- Install `msw@2` as a `devDependency` in `apps/ValyntApp`
- Create `src/test/msw/server.ts` — a Node.js MSW server for Vitest
- Create `src/test/msw/handlers/agent.ts` — SSE stream handlers for `/api/agents/jobs/:jobId/stream`
- Wire the MSW server into `src/test/setup.ts` (`beforeAll(server.listen)`, `afterEach(server.resetHandlers)`, `afterAll(server.close)`)
- Use MSW **only** for: streaming resilience tests (R-3), cache isolation tests (R-4), and correlation ID tests (R-7)
- All other tests continue using `vi.mock()`

### R-9: Playwright E2E — Discovery workflow

- Target: deterministic seeded test environment (not production; not pure MSW UI theater)
- The spec file lives at `tests/e2e/agent-discovery-workflow.spec.ts`
- **Scenario**: authenticated user navigates to a seeded Value Case → triggers Discovery agent → observes pipeline progress (PipelineStepper steps transition) → reaches `completed` state → value model is visible
- **Assertions**: no infinite spinner after 30 s; pipeline steps render in order; final state is `completed`; no console errors containing `undefined` or `null` for tenant/job IDs
- The spec must be tagged `@agent-workflow` and added to the `e2e-critical` lane in `pr-fast.yml`
- Seeded fixtures: use existing `seeds/` directory conventions; document required seed data in the spec file

### R-10: CI wiring (minimal)

- The new unit/integration tests (R-3 through R-7) are automatically picked up by the existing `unit-component-schema` lane (Vitest workspace config already covers `apps/ValyntApp`)
- Add `tests/e2e/agent-discovery-workflow.spec.ts` to the `e2e-critical` step in `pr-fast.yml`
- No new CI lanes required

---

## 4. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-1 | `useAgentStream` reconnects on SSE error with exponential backoff; test passes in Vitest |
| AC-2 | `useAgentStream` deduplicates messages on reconnect; test passes |
| AC-3 | `useAgentJob` query key includes `tenantId`; cache isolation test proves Tenant B cannot read Tenant A's job |
| AC-4 | `useAgentJob` is disabled when `tenantId` is null; no network request fires |
| AC-5 | SDUI `renderPage` renders `UnknownComponentFallback` for unregistered types without throwing |
| AC-6 | `sanitizeHtml` branch coverage ≥ 90% (already enforced; must not regress) |
| AC-7 | `AgentStateMachine` has ≥ 10 dedicated test cases covering all valid transitions and rejection of invalid ones |
| AC-8 | `unified-api-client` test asserts `X-Request-ID` header is present and non-empty on outbound requests |
| AC-9 | `ErrorBoundary` test asserts `traceId`/`correlationId` is rendered on caught render errors |
| AC-10 | MSW server is wired in `setup.ts`; SSE handler exists for `/api/agents/jobs/:jobId/stream` |
| AC-11 | `tests/e2e/agent-discovery-workflow.spec.ts` exists, is tagged `@agent-workflow`, and is included in `e2e-critical` |
| AC-12 | `pnpm test` passes with no regressions in existing 146 tests |
| AC-13 | Coverage thresholds (lines 75%, functions 70%, branches 70%) are maintained or improved |

---

## 5. Implementation Approach

Steps are ordered by dependency. Each step is independently committable.

### Step 1 — Fix D-2: tenant-scoped cache key in `useAgentJob`

**File:** `apps/ValyntApp/src/hooks/useAgentJob.ts`

- Import `useTenant` from `src/contexts/TenantContext`
- Add `tenantId` parameter (sourced from `useTenant().currentTenant?.id ?? null`)
- Update `queryKey` to `["agent-job", tenantId, jobId, directResult?.mode]`
- Set `enabled: !!jobId && !!tenantId`
- Update all call sites (search: `useAgentJob(`)

### Step 2 — Fix D-1: reconnect logic in `useAgentStream`

**File:** `apps/ValyntApp/src/hooks/useAgentStream.ts`

- Add `lastEventIdRef: useRef<string | null>(null)` to track cursor
- In `es.onmessage`, capture `event.lastEventId` if present
- Replace the `es.onerror` handler with a reconnect scheduler:
  - Maintain `reconnectAttemptsRef` and `reconnectTimerRef`
  - On error, if not terminal and attempts < 5: schedule reconnect with `2^attempt * 1000ms` delay (capped at 30 s)
  - On reconnect, append `?lastEventId=<id>` to the SSE URL
  - On reconnect, deduplicate incoming events against a `seenEventIds: Set<string>`
  - After 5 failed attempts, call `setError` and `closeStream`
- Expose `reconnectAttempts` and `isReconnecting` in return value

### Step 3 — Install MSW and create test infrastructure

**Files:**
- `apps/ValyntApp/package.json` — add `"msw": "^2.x"` to `devDependencies`
- `apps/ValyntApp/src/test/msw/server.ts` — `setupServer()` export
- `apps/ValyntApp/src/test/msw/handlers/agent.ts` — SSE handler for `/api/agents/jobs/:jobId/stream` using `http.get` + `ReadableStream`; REST handler for `/api/agents/:agentId/invoke`
- `apps/ValyntApp/src/test/setup.ts` — wire `beforeAll/afterEach/afterAll` lifecycle

### Step 4 — Write P0 streaming resilience tests (R-3)

**File:** `apps/ValyntApp/src/hooks/__tests__/useAgentStream.test.ts`

- Use MSW to control SSE stream lifecycle
- Test: dropped connection triggers reconnect
- Test: reconnect deduplicates messages
- Test: terminal state after retry exhaustion exposes `jobId` as correlation ID
- Test: `isReconnecting` is `true` during backoff, `false` after terminal

### Step 5 — Write P0 cache isolation tests (R-4)

**File:** `apps/ValyntApp/src/hooks/__tests__/useAgentJob.test.ts`

- Use `renderHook` with a `QueryClientProvider` and a mock `TenantContext`
- Test: Tenant A job is not visible under Tenant B's query key
- Test: hook is disabled when `tenantId` is null (no fetch fires)
- Test: polling stops when job reaches terminal status

### Step 6 — Write P0 SDUI contract tests (R-5)

**File:** `packages/sdui/src/__tests__/agent-contract.test.tsx`

- Test: `renderPage` with unknown component type renders `UnknownComponentFallback`
- Test: `sduiTelemetry` is called with the unknown component name (spy)
- Verify existing XSS tests in `security.test.tsx` cover `SafeHtml` + `sanitizeHtml` — add any missing vectors from the spec document

### Step 7 — Write P1 `AgentStateMachine` tests (R-6)

**File:** `apps/ValyntApp/src/lib/agent/__tests__/stateMachine.test.ts`

- Test all 11 valid transitions from `validTransitions`
- Test 3+ invalid transition rejections (e.g., `idle → DONE`, `completed → START`)
- Test history accumulation
- Test subscriber notification
- Test `reset()`

### Step 8 — Write P1 observability tests (R-7)

**Files:**
- `apps/ValyntApp/src/api/client/__tests__/unified-api-client.test.ts` — assert `X-Request-ID` header presence using MSW request interception
- `apps/ValyntApp/src/components/__tests__/ErrorBoundary.test.tsx` — render a throwing child inside `ErrorBoundary`; assert error UI contains a `traceId` or `correlationId` field

### Step 9 — Write Playwright E2E spec (R-9)

**File:** `tests/e2e/agent-discovery-workflow.spec.ts`

- Tag: `@agent-workflow`
- Document required seed data at top of file (Value Case ID, tenant credentials)
- Implement the Discovery workflow scenario
- Assert no infinite spinner (30 s timeout), ordered pipeline steps, `completed` terminal state

### Step 10 — Wire CI (R-10)

**File:** `.github/workflows/pr-fast.yml`

- Add `tests/e2e/agent-discovery-workflow.spec.ts` to the `e2e-critical` step's Playwright invocation

### Step 11 — Verify

- Run `pnpm test` — all 146 existing tests pass; new tests pass
- Run `pnpm --filter ValyntApp test:coverage` — thresholds maintained
- Run `pnpm --filter ValyntApp test:e2e` against seeded environment — Discovery workflow spec passes

---

## 6. File Inventory

| File | Action |
|------|--------|
| `apps/ValyntApp/src/hooks/useAgentJob.ts` | Modify — add `tenantId` to query key |
| `apps/ValyntApp/src/hooks/useAgentStream.ts` | Modify — add reconnect logic |
| `apps/ValyntApp/package.json` | Modify — add `msw` devDependency |
| `apps/ValyntApp/src/test/setup.ts` | Modify — wire MSW server lifecycle |
| `apps/ValyntApp/src/test/msw/server.ts` | Create |
| `apps/ValyntApp/src/test/msw/handlers/agent.ts` | Create |
| `apps/ValyntApp/src/hooks/__tests__/useAgentStream.test.ts` | Create |
| `apps/ValyntApp/src/hooks/__tests__/useAgentJob.test.ts` | Create |
| `apps/ValyntApp/src/lib/agent/__tests__/stateMachine.test.ts` | Create |
| `apps/ValyntApp/src/api/client/__tests__/unified-api-client.test.ts` | Create |
| `apps/ValyntApp/src/components/__tests__/ErrorBoundary.test.tsx` | Create |
| `packages/sdui/src/__tests__/agent-contract.test.tsx` | Create |
| `tests/e2e/agent-discovery-workflow.spec.ts` | Create |
| `.github/workflows/pr-fast.yml` | Modify — add E2E spec to `e2e-critical` |

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| MSW v2 SSE support requires `ReadableStream` in jsdom | Use `@mswjs/interceptors` transport; pin msw@2 and verify jsdom compatibility in setup |
| `useAgentJob` call sites may not have `TenantContext` in scope | Audit all call sites before Step 1; add `TenantContext` wrapper to any that lack it |
| Playwright E2E requires seeded data that may not exist | Define seed script in `seeds/` as part of Step 9; document skip condition if seed is absent |
| Reconnect logic changes `useAgentStream` behavior for existing callers | `AgentChat.tsx` and `useValueCaseStream.ts` are the only callers; review both before Step 2 |
