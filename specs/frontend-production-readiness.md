# Frontend Production-Readiness Remediation

**Status:** Draft  
**Scope:** P0 (blocking) + selected adjacent P1 fixes, with unit tests for all changed hooks  
**Target:** `apps/ValyntApp` — agent hooks, streaming infrastructure, tenant cache isolation

---

## Problem Statement

The frontend's integration with the agentic backend relies on fake synchronous flows, a fragile SSE implementation, and globally-scoped React Query cache keys. These defects cause:

- UI state that does not reflect actual backend agent execution (fake progress bars, false completions)
- Permanent stream loss on any network interruption during long-running agent jobs
- Risk of cross-tenant state bleed when a user belongs to multiple organizations

The system is not safe for production use until these are resolved.

---

## Issues in Scope

### P0 — Blocking

| ID | File | Defect |
|----|------|--------|
| P0-1 | `hooks/useAgentOrchestrator.ts` | State transitions driven by `setTimeout` mock logic, not backend events |
| P0-2 | `hooks/useAgentStream.ts` | Native `EventSource` with no reconnect, no `Last-Event-ID`, no auth headers |
| P0-3 | `hooks/useAgentJob.ts` | React Query key `["agent-job", jobId]` lacks `tenantId` — cross-tenant cache bleed risk |

### P1 — Adjacent / Low-Effort (pulled in)

| ID | File | Defect | Inclusion Rationale |
|----|------|--------|---------------------|
| P1-1 | `hooks/useAgentJob.ts` | `AgentJobStatus` has no `retrying` state; no `attemptsMade`/`nextRetryAt` exposure | Same file as P0-3; zero incremental risk |
| P1-2 | `hooks/useAgentStream.ts` | `processing` heartbeats silently discarded; no sub-task feedback rendered | Same file as P0-2; one-line parse change |
| P1-3 | `views/canvas/AgentThread.tsx` | No `retrying` state rendered; no `attemptsMade`/`nextRetryAt` display | Directly consumes the P1-1 data model |

### Improvements — In Scope

| ID | Location | Change |
|----|----------|--------|
| I-1 | `packages/sdui/src/LazyComponentRegistry.tsx` | `ComponentLoadingFallback` must emit a telemetry event on render so schema mismatches are observable in production |
| I-2 | `components/ErrorBoundary.tsx` | Surface `X-Request-ID` (from `UnifiedApiClient`) in the error UI so users can copy it for support |
| I-3 | `views/canvas/HypothesisStage.tsx` | "Run Stage" button must be disabled and debounced on first click to prevent duplicate BullMQ job enqueues |

### Out of Scope

- Migrating `useAgentJob` / `useResearchJobStatus` from polling to Supabase Realtime (blocked by missing `REPLICA IDENTITY FULL` on `agent_jobs` and `company_research_jobs`)
- Backend changes to the SSE endpoint or event sourcing service
- CI architecture overhaul

---

## Requirements

### R1 — Replace `useAgentOrchestrator` mock logic

The `submitQuery` function currently uses `await new Promise(resolve => setTimeout(resolve, N))` to simulate planning and execution phases. This must be replaced.

**Required behavior:**
1. `submitQuery` POSTs to `/api/agents/:agentId/invoke` and receives a `{ jobId }`.
2. It immediately opens an SSE stream via the fixed `useAgentStream` infrastructure (see R2).
3. State transitions (`IDLE → PLANNING → EXECUTING → IDLE/ERROR`) are driven exclusively by incoming SSE event payloads:
   - `status: "processing"` → `EXECUTING`; update `context.currentStep` from the event's `agentId` or sub-task field
   - `status: "completed"` → `IDLE`; populate `thoughts` with a `result` ThoughtEvent
   - `status: "error"` → `ERROR`
4. The hardcoded `planSteps` array is removed. Steps are populated from `processing` heartbeat payloads.
5. `cancel()` closes the SSE stream and aborts the in-flight POST.

### R2 — Replace native `EventSource` with `@microsoft/fetch-event-source`

The `openStream` function in `useAgentStream` must be rewritten.

**Required behavior:**
1. Use `@microsoft/fetch-event-source` (`fetchEventSource`) instead of `new EventSource(url)`.
2. Pass auth headers from `UnifiedApiClient` (Authorization, x-tenant-id) on every connection and reconnect.
3. On network error or non-200 response, automatically retry with exponential backoff (library default).
4. Pass `Last-Event-ID` header on reconnect so the backend can resume the stream from the last acknowledged event.
5. `onerror` must not close the stream on transient failures — only on explicit terminal events (`completed`, `error`) or user-initiated `cancel()`.
6. The `AbortController` ref must be passed to `fetchEventSource` so `closeStream()` correctly terminates the fetch.
7. `processing` heartbeat events must be parsed and forwarded to a new `onProgress` callback (optional, same pattern as `onMessage`).

### R3 — Scope `useAgentJob` React Query key to tenant

**Required behavior:**
1. `useAgentJob` must accept `tenantId: string | null` as a third parameter.
2. The query key becomes `["agent-job", jobId, tenantId]`.
3. The query is disabled when `tenantId` is null (same guard as `jobId`).
4. All call sites must be updated to pass `tenantId` from `useTenantContext`.

### R4 — Expand `AgentJobStatus` to include `retrying`

**Required behavior:**
1. Add `"retrying"` to the `AgentJobStatus` union type.
2. Add `attemptsMade?: number` and `nextRetryAt?: string` (ISO timestamp) to `AgentJobResult`.
3. The backend `/api/agents/jobs/:jobId` endpoint already returns BullMQ job metadata — the frontend must map `attemptsMade` and `nextRetryAt` from the response if present.
4. `AgentThread` must render a `retrying` state: show attempt count and a countdown or timestamp for the next retry.
5. The `TERMINAL_STATUSES` array in `useAgentJob` must not include `"retrying"` (polling must continue).

### R5 — Render `processing` heartbeats in `AgentThread`

**Required behavior:**
1. `useAgentStream`'s `onmessage` handler must parse `processing` events and call `onProgress(payload)`.
2. `AgentThread` (or its parent) must display the current sub-task string from the heartbeat (e.g., "Analyzing SEC filings…").
3. The display must update in place — not append a new message per heartbeat.

### R6 — `ComponentLoadingFallback` telemetry

**Required behavior:**
1. When `ComponentLoadingFallback` renders (i.e., a component name is not found in the registry), it must call `sduiTelemetry.recordEvent` with event type `COMPONENT_LOAD_ERROR` (or equivalent) and include the missing `componentName`.
2. This must not throw or affect the render path.

### R7 — Surface `X-Request-ID` in `ErrorBoundary`

**Required behavior:**
1. `ErrorBoundary` must accept an optional `requestId?: string` prop.
2. When `requestId` is present and the boundary is in error state, display it as a copyable code element with a "Copy ID" button.
3. The `UnifiedApiClient` already attaches `X-Request-ID` to responses — the error propagation path must thread this value to the boundary.

### R8 — Debounce "Run Stage" button

**Required behavior:**
1. The "Run Stage" / "Re-run Stage" button in `HypothesisStage.tsx` must be disabled immediately on click (before the mutation resolves).
2. A minimum 500ms debounce must prevent double-submission during network latency.
3. The button must re-enable only after the mutation settles (success or error).
4. This pattern must be applied to any other button that enqueues a BullMQ job.

---

## Acceptance Criteria

### P0-1 (Orchestrator)
- [ ] `useAgentOrchestrator` contains zero `setTimeout` calls
- [ ] State transitions only occur in response to parsed SSE payloads
- [ ] Cancelling mid-stream closes the SSE connection and returns state to `IDLE`
- [ ] Unit test: mock SSE server emits `processing` → `completed`; assert state sequence `PLANNING → EXECUTING → IDLE`
- [ ] Unit test: mock SSE server emits `error`; assert state transitions to `ERROR`
- [ ] Unit test: `cancel()` called mid-stream; assert stream is closed and state is `IDLE`

### P0-2 (SSE Resilience)
- [ ] `useAgentStream` uses `fetchEventSource`, not `new EventSource`
- [ ] Auth headers are present on initial connection and all reconnects
- [ ] `Last-Event-ID` is sent on reconnect
- [ ] A simulated network drop triggers automatic reconnect (not permanent stream death)
- [ ] Unit test (MSW): SSE stream drops mid-message; assert reconnect occurs and stream resumes
- [ ] Unit test (MSW): `processing` heartbeat received; assert `onProgress` callback is invoked
- [ ] Unit test (MSW): `completed` event received; assert `onMessage` is called and stream closes

### P0-3 (Cache Key Tenant Scoping)
- [ ] `useAgentJob` query key is `["agent-job", jobId, tenantId]`
- [ ] Query does not execute when `tenantId` is null
- [ ] Unit test: switching `tenantId` invalidates the previous cache entry and triggers a fresh fetch

### P1-1 / P1-3 (Retry State)
- [ ] `AgentJobStatus` includes `"retrying"`
- [ ] `AgentJobResult` includes `attemptsMade` and `nextRetryAt`
- [ ] `AgentThread` renders a distinct "Retrying" state with attempt count
- [ ] Polling continues when status is `"retrying"`
- [ ] Unit test: job status `"retrying"` with `attemptsMade: 2` renders correct UI

### P1-2 (Heartbeat Rendering)
- [ ] `processing` events are no longer silently discarded
- [ ] Sub-task text updates in place in the UI
- [ ] Unit test: three sequential `processing` events result in one updated display element, not three appended messages

### I-1 (SDUI Fallback Telemetry)
- [ ] `ComponentLoadingFallback` calls `sduiTelemetry.recordEvent` with the missing component name
- [ ] Unit test: rendering fallback with an unknown component name triggers the telemetry call

### I-2 (Request ID in ErrorBoundary)
- [ ] `ErrorBoundary` renders a copyable `requestId` when provided
- [ ] Unit test: `requestId` prop is displayed and copy button is present

### I-3 (Debounce Run Stage)
- [ ] "Run Stage" button is disabled immediately on click
- [ ] Rapid double-click does not enqueue two jobs
- [ ] Unit test: two rapid clicks result in exactly one mutation call

---

## Implementation Approach

Steps are ordered by dependency. Each step is independently committable.

### Step 1 — Install `@microsoft/fetch-event-source` and MSW

Add `@microsoft/fetch-event-source` to `apps/ValyntApp/package.json`. Add `msw` as a dev dependency. Configure MSW handlers in `src/test/` (or extend the existing `src/test-utils/` setup). MSW is used only where it materially improves fidelity (SSE reconnect behavior, auth header verification); `vi.mock` is preferred for pure unit tests.

**Files:**
- `apps/ValyntApp/package.json`
- `apps/ValyntApp/src/test/msw-setup.ts` (new)
- `apps/ValyntApp/src/test/handlers/agent-sse.ts` (new)

### Step 2 — Fix `useAgentStream` (P0-2 + P1-2)

Rewrite `openStream` to use `fetchEventSource`. Add `onProgress` callback to options interface. Parse `processing` events and invoke `onProgress`. Pass `AbortController` ref. Implement `Last-Event-ID` tracking via a `lastEventId` ref updated on each message.

**Files:**
- `apps/ValyntApp/src/hooks/useAgentStream.ts`
- `apps/ValyntApp/src/hooks/__tests__/useAgentStream.test.ts` (new)

### Step 3 — Fix `useAgentOrchestrator` (P0-1)

Delete all `setTimeout` / mock logic. Rewrite `submitQuery` to: POST invoke → receive `jobId` → open SSE stream via the fixed `useAgentStream` infrastructure → drive state machine from SSE events. Wire `onProgress` to update `context.currentStep`.

**Files:**
- `apps/ValyntApp/src/hooks/useAgentOrchestrator.ts`
- `apps/ValyntApp/src/hooks/__tests__/useAgentOrchestrator.test.ts` (new)

### Step 4 — Fix `useAgentJob` cache key + retry state (P0-3 + P1-1)

Add `tenantId` parameter. Update query key. Add `"retrying"` to `AgentJobStatus`. Add `attemptsMade` and `nextRetryAt` to `AgentJobResult`. Update `TERMINAL_STATUSES`. Update all call sites.

**Files:**
- `apps/ValyntApp/src/hooks/useAgentJob.ts`
- `apps/ValyntApp/src/hooks/__tests__/useAgentJob.test.ts` (new or extend existing)
- All call sites (grep: `useAgentJob(`)

### Step 5 — Update `AgentThread` (P1-3 + P1-2)

Add `retrying` state rendering (attempt count + `nextRetryAt`). Accept and display `currentSubTask` prop for heartbeat feedback. Wire to `useAgentJob` updated return shape.

**Files:**
- `apps/ValyntApp/src/views/canvas/AgentThread.tsx`
- `apps/ValyntApp/src/views/canvas/__tests__/AgentThread.test.tsx` (new)

### Step 6 — `ComponentLoadingFallback` telemetry (I-1)

Add `sduiTelemetry.recordEvent` call inside `ComponentLoadingFallback` on mount via `useEffect`. Use existing `TelemetryEventType` enum — add `COMPONENT_LOAD_ERROR` if not present.

**Files:**
- `packages/sdui/src/LazyComponentRegistry.tsx`
- `packages/sdui/src/__tests__/LazyComponentRegistry.test.tsx` (extend existing)

### Step 7 — `ErrorBoundary` request ID (I-2)

Add `requestId?: string` prop. Render copyable element in error state. Thread `requestId` from `UnifiedApiClient` error responses through to the boundary at call sites.

**Files:**
- `apps/ValyntApp/src/components/ErrorBoundary.tsx`
- `apps/ValyntApp/src/components/__tests__/ErrorBoundary.test.tsx` (new or extend)

### Step 8 — Debounce "Run Stage" (I-3)

Add a `useRef` flag or `useDebounce` wrapper to the "Run Stage" button handler. Disable immediately on click. Re-enable on mutation settle.

**Files:**
- `apps/ValyntApp/src/views/canvas/HypothesisStage.tsx`
- `apps/ValyntApp/src/views/canvas/__tests__/HypothesisStage.test.tsx` (new or extend)

### Step 9 — CI wiring

Verify MSW is initialized in the Vitest setup file. Ensure new test files are picked up by the existing `test` task. No new CI jobs required.

**Files:**
- `apps/ValyntApp/vitest.config.ts` (verify MSW setup is included)
- `apps/ValyntApp/src/test/setup.ts` (extend with MSW server start/stop lifecycle)

---

## Dependencies and Constraints

- `@microsoft/fetch-event-source` — new runtime dependency; must be added to `apps/ValyntApp/package.json`
- `msw` — new dev dependency; used only in test files; permitted where it materially improves fidelity over `vi.mock`
- Backend SSE endpoint (`/api/agents/jobs/:jobId/stream`) is assumed stable and unchanged
- `useTenantContext` is the canonical source of `tenantId` — all call sites must use it
- `sduiTelemetry` and `TelemetryEventType` are already imported in `LazyComponentRegistry.tsx`; no new telemetry infrastructure needed
- Polling migration (useAgentJob → Supabase Realtime) is deferred; `REPLICA IDENTITY FULL` is a prerequisite not yet in migrations

---

## Files Changed (Summary)

| File | Change Type |
|------|-------------|
| `apps/ValyntApp/package.json` | Add `@microsoft/fetch-event-source`, `msw` (dev) |
| `apps/ValyntApp/src/hooks/useAgentStream.ts` | Rewrite `openStream`; add `onProgress`; `Last-Event-ID` tracking |
| `apps/ValyntApp/src/hooks/useAgentOrchestrator.ts` | Delete mock logic; wire to SSE stream |
| `apps/ValyntApp/src/hooks/useAgentJob.ts` | Add `tenantId` param; add `retrying` status; add retry fields |
| `apps/ValyntApp/src/views/canvas/AgentThread.tsx` | Render `retrying` state; render heartbeat sub-task |
| `apps/ValyntApp/src/views/canvas/HypothesisStage.tsx` | Debounce "Run Stage" button |
| `apps/ValyntApp/src/components/ErrorBoundary.tsx` | Add `requestId` prop and copyable display |
| `packages/sdui/src/LazyComponentRegistry.tsx` | Add telemetry call in `ComponentLoadingFallback` |
| `apps/ValyntApp/src/test/msw-setup.ts` | New — MSW server config |
| `apps/ValyntApp/src/test/handlers/agent-sse.ts` | New — MSW SSE handlers |
| `apps/ValyntApp/src/hooks/__tests__/useAgentStream.test.ts` | New |
| `apps/ValyntApp/src/hooks/__tests__/useAgentOrchestrator.test.ts` | New |
| `apps/ValyntApp/src/hooks/__tests__/useAgentJob.test.ts` | New / extend |
| `apps/ValyntApp/src/views/canvas/__tests__/AgentThread.test.tsx` | New |
| `apps/ValyntApp/src/views/canvas/__tests__/HypothesisStage.test.tsx` | New / extend |
| `apps/ValyntApp/src/components/__tests__/ErrorBoundary.test.tsx` | New / extend |
| `packages/sdui/src/__tests__/LazyComponentRegistry.test.tsx` | Extend |
