# Spec: SDUI Hardening, Correlation ID Tracing, Idempotent Agent Actions

## Problem Statement

Three production-readiness gaps exist in the current codebase:

1. **SDUI fallback is silent.** When `LazyComponentRegistry` or the renderer cannot resolve a component from the schema, it renders a placeholder and increments a security metric, but emits no telemetry event. Engineering has no alerting path for schema drift in production.

2. **Correlation IDs are not user-visible.** `UnifiedApiClient` generates and attaches an `X-Request-ID` on every request, and the ID is stored in `ApiResponse.metadata.requestId`. However, none of the error boundary components or the `ErrorRecoveryModal` surface this ID to the user, making it impossible to correlate a user-reported failure with a backend log entry.

3. **Agent-triggering buttons are not fully hardened against duplicate submission.** `HypothesisStage` disables its button via `runAgent.isPending`, but `IntegrityStage` and `NarrativeStage` have inconsistent patterns. None of the three attach an idempotency key to the outgoing request, so a race condition during network latency can still enqueue duplicate BullMQ jobs.

---

## Requirements

### 1. SDUI Fallback Telemetry

**Files:** `packages/sdui/lib/telemetry/SDUITelemetry.ts`, `packages/sdui/src/LazyComponentRegistry.tsx`, `packages/sdui/src/renderer.tsx`, `apps/ValyntApp/src/lib/telemetry/SDUITelemetry.ts`

- Add `COMPONENT_NOT_FOUND = "component_not_found"` to the `TelemetryEventType` enum in `packages/sdui/lib/telemetry/SDUITelemetry.ts`.

- In `LazyComponentRegistry.resolveComponentAsync`, in the `lazyLoader` not-found branch (currently only calls `logger.warn("Component not found in lazy registry")`), also call `sduiTelemetry.recordEvent(...)` with:
  ```
  type: TelemetryEventType.COMPONENT_NOT_FOUND
  metadata.componentKey   — the requested component name
  metadata.schemaVersion  — section.version
  metadata.reason         — "schema_component_missing"
  ```

- In `renderer.tsx`, in the `!entry || !entry.component` branch (currently calls `incrementSecurityMetric("component_not_found", ...)`), add three emission calls:
  1. `sduiTelemetry.recordEvent(...)` with the same `COMPONENT_NOT_FOUND` shape, plus `metadata.route` (`window.location.pathname` guarded by `typeof window !== "undefined"`).
  2. `logger.warn(...)` with a structured payload: `{ componentKey, schemaVersion, reason: "schema_component_missing", route }`.
  3. `window.analytics?.track("sdui_component_not_found", { ... })` with the same payload (guarded by `typeof window !== "undefined"`).

- Extend the app-level `SDUITelemetry` stub in `apps/ValyntApp/src/lib/telemetry/SDUITelemetry.ts` to forward `COMPONENT_NOT_FOUND` events to `window.analytics` when available.

- No change to the rendered placeholder UI — this is telemetry-only.

---

### 2. Correlation ID Tracing via React Context

**New file:** `apps/ValyntApp/src/contexts/ApiRequestContext.tsx`  
**Modified files:** `apps/ValyntApp/src/api/client/unified-api-client.ts`, `packages/sdui/src/components/ComponentErrorBoundary.tsx`, `packages/sdui/src/components/SDUIErrorBoundary.tsx`, `apps/ValyntApp/src/features/workspace/components/states/ErrorRecoveryModal.tsx`, app root provider

#### Context shape

```typescript
interface ApiRequestState {
  lastRequestId: string | null;
  lastFailedRequestId: string | null;
}

// Module-level setter registration (called once from provider useEffect)
export function registerApiRequestSetter(
  setter: (id: string, failed: boolean) => void
): void
```

Provide `ApiRequestContext` at the app root. On every `UnifiedApiClient.request()` completion:
- Call `setter(requestId, false)` — updates `lastRequestId`.
- On error responses: also call `setter(requestId, true)` — updates `lastFailedRequestId`.

Because `UnifiedApiClient` is a class instantiated outside React, the setter is injected via the module-level `registerApiRequestSetter` function, called once from the provider's `useEffect` on mount.

#### Error boundary display

In `ComponentErrorBoundary.renderFallback()` and `SDUIErrorBoundary` error render, add a "Request ID" row below the existing error message:

```
Request ID: req_1234567890_abc123  [Copy]
Include this ID when contacting support.
```

- Read `lastFailedRequestId` from `ApiRequestContext`.
  - `ComponentErrorBoundary` is a class component — use a static `contextType` or wrap the fallback in a functional consumer.
  - `SDUIErrorBoundary` is a class component — same approach.
- Show a copy-to-clipboard button using `navigator.clipboard.writeText`.
- Only render the row when `lastFailedRequestId` is non-null.

#### ErrorRecoveryModal

Extend `ErrorRecoveryModalProps` with `requestId?: string`. When provided:
- Render the ID in the modal body alongside the existing error details.
- Extend `handleCopyError` to append the request ID to the copied text:
  ```
  Error: ${code}
  ${message}
  Request ID: ${requestId}
  ```

---

### 3. Idempotent UI Actions — Stage Run Buttons

**Files:** `apps/ValyntApp/src/views/canvas/HypothesisStage.tsx`, `apps/ValyntApp/src/views/canvas/IntegrityStage.tsx`, `apps/ValyntApp/src/views/canvas/NarrativeStage.tsx`, `apps/ValyntApp/src/hooks/useHypothesis.ts`, `apps/ValyntApp/src/hooks/useIntegrity.ts`, `apps/ValyntApp/src/hooks/useNarrative.ts`

#### Button hardening (all three stages)

Each "Run Stage" / "Re-run Agent" / "Run Narrative Agent" button must:

1. Be `disabled` while the mutation is pending (`isPending` / `isRunning`). Already done in `HypothesisStage`; apply to `IntegrityStage` and `NarrativeStage`.
2. Use a `useRef`-based debounced click handler (300 ms) to prevent rapid double-clicks from firing two mutations before React re-renders with `isPending = true`. Do not add a new library dependency.
3. Show a loading spinner and updated label while pending. Already done in `HypothesisStage`; apply consistently to `IntegrityStage` and `NarrativeStage`.

#### Idempotency key

Each mutation hook (`useRunHypothesisAgent`, `useRunIntegrityAgent`, `useRunNarrativeAgent`) must generate and attach an `idempotency_key` in the request body:

- Generated once per button click using `crypto.randomUUID()` (available in all target browsers and Node 18+).
- Generated at the top of `mutationFn`, before the `apiClient.post(...)` call.
- Passed as `idempotency_key` in the POST body alongside existing fields.
- The backend type `ExecutionOptions.idempotency_key` already accepts this field — no backend schema change required.

---

## Acceptance Criteria

### SDUI Fallback Telemetry

- [ ] `TelemetryEventType.COMPONENT_NOT_FOUND` exists in the enum.
- [ ] When the renderer encounters a component name not in the registry, `sduiTelemetry.recordEvent` is called with `type: "component_not_found"` and `metadata.componentKey`, `metadata.schemaVersion`, `metadata.reason`.
- [ ] `window.analytics?.track("sdui_component_not_found", ...)` is called (guarded by `typeof window !== "undefined"`).
- [ ] `logger.warn(...)` is called with a structured payload including `componentKey`, `schemaVersion`, `reason`, and `route`.
- [ ] Rendered placeholder UI is unchanged.

### Correlation ID Tracing

- [ ] `ApiRequestContext` exists and is provided at the app root.
- [ ] After every `UnifiedApiClient` request, `lastRequestId` is updated in context.
- [ ] After every failed request, `lastFailedRequestId` is updated in context.
- [ ] `ComponentErrorBoundary` fallback UI shows `lastFailedRequestId` with a copy button when non-null.
- [ ] `SDUIErrorBoundary` error UI shows `lastFailedRequestId` with a copy button when non-null.
- [ ] `ErrorRecoveryModal` includes the request ID in the copied error text when `requestId` prop is provided.
- [ ] No request ID row is rendered when `lastFailedRequestId` is null.

### Idempotent UI Actions

- [ ] All three stage run buttons are `disabled` while their mutation is pending.
- [ ] All three buttons use a debounced click handler (≥ 300 ms).
- [ ] All three buttons show a loading spinner and updated label while pending.
- [ ] Each mutation POST body includes an `idempotency_key` (UUID) generated at click time.
- [ ] Rapid double-clicks on any stage run button do not enqueue two jobs (verified by inspecting that only one POST fires per click sequence).

---

## Implementation Steps

1. Add `COMPONENT_NOT_FOUND` to `TelemetryEventType` in `packages/sdui/lib/telemetry/SDUITelemetry.ts`.

2. Emit `sduiTelemetry.recordEvent(COMPONENT_NOT_FOUND, ...)` in `LazyComponentRegistry.resolveComponentAsync` — "not found in lazy registry" branch.

3. Emit telemetry + `logger.warn` + `window.analytics?.track` in `renderer.tsx` — `!entry || !entry.component` branch.

4. Extend app-level `SDUITelemetry` in `apps/ValyntApp/src/lib/telemetry/SDUITelemetry.ts` to forward `COMPONENT_NOT_FOUND` events to `window.analytics`.

5. Create `apps/ValyntApp/src/contexts/ApiRequestContext.tsx` — provider with `lastRequestId`, `lastFailedRequestId`, and `registerApiRequestSetter`.

6. Wire `UnifiedApiClient.request()` to call the registered setter after success and error paths.

7. Mount `ApiRequestContext` provider at the app root.

8. Add request ID display to `ComponentErrorBoundary.renderFallback()` — read from context, render ID + copy button.

9. Add request ID display to `SDUIErrorBoundary` error render — same pattern.

10. Extend `ErrorRecoveryModal` — add optional `requestId` prop, include in copied text.

11. Harden `IntegrityStage` button — `disabled={isRunning}`, loading spinner, debounced handler.

12. Harden `NarrativeStage` button — `disabled={runAgent.isPending}`, loading spinner, debounced handler.

13. Add `idempotency_key: crypto.randomUUID()` to `useRunHypothesisAgent` `mutationFn`.

14. Add `idempotency_key: crypto.randomUUID()` to `useRunIntegrityAgent` `mutationFn`.

15. Add `idempotency_key: crypto.randomUUID()` to `useRunNarrativeAgent` `mutationFn`.

16. Write/update unit tests covering: telemetry emission on missing component, request ID rendering in error boundaries, button disabled state during pending mutation.
