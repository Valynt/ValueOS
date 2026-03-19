# ValueOS Master Test Strategy

## Problem Statement

The repository has 600+ test files and 9 CI lanes, but the test suite has three structural gaps that block release confidence:

1. **WF-1 through WF-5 E2E specs use localStorage stubs** — they do not assert real backend execution or DB persistence. A workflow can "pass" while the backend is broken.
2. **The infra-mode matrix covers deployment topology (local/docker/supabase) but not messaging topology** — Kafka ON/OFF × streaming ON/OFF combinations are untested, so infrastructure-mode parity is unproven.
3. **The chaos suite covers one failure class (Redis/Kafka/circuit-breaker)** — five of the six failure scenarios in the risk model have no test coverage.

This document specifies the refactor and new work required to close these gaps.

---

## Workspace Vitest Topology

The root `vitest.config.ts` now mirrors the actual workspace package topology instead of inlining a few hand-picked projects. Every workspace package that contains test files must do two things:

1. Provide a package-local `vitest.config.ts` so CI can run that package directly.
2. Register its package directory in the shared topology manifest consumed by the root workspace and CI guard (`scripts/ci/vitest-workspace-topology.mjs`).

### Root workspace projects

| Workspace package | Role | Test owner |
| --- | --- | --- |
| `apps/ValyntApp` | production deliverable | package-local Vitest config + root workspace |
| `apps/mcp-dashboard` | production deliverable | package-local Vitest config + root workspace |
| `packages/backend` | production deliverable | package-local Vitest config + root workspace |
| `packages/components` | production deliverable | package-local Vitest config + root workspace |
| `packages/infra` | internal library | package-local Vitest config + root workspace |
| `packages/integrations` | production deliverable | package-local Vitest config + root workspace |
| `packages/mcp` | production deliverable | package-local Vitest config + root workspace |
| `packages/memory` | internal library | package-local Vitest config + root workspace |
| `packages/sdui` | production deliverable | package-local Vitest config + root workspace |
| `packages/services/domain-validator` | production deliverable | package-local Vitest config + root workspace |
| `packages/services/github-code-optimizer` | production deliverable | package-local Vitest config + root workspace |
| `packages/shared` | internal library | package-local Vitest config + root workspace |

### Explicitly documented packages without standalone package tests

| Package | Classification | Current test strategy |
| --- | --- | --- |
| `apps/mcp-dashboard` | production deliverable | Included in the root Vitest workspace because it now has route/security tests and its own package-local config. |
| `packages/config-v2` | internal library | Intentionally testless for now because it only ships shared ESLint/Prettier/TypeScript configuration assets rather than runtime behavior. |
| `packages/mcp` | production deliverable | Covered by the `packages/mcp` workspace project, which owns the package-level config and coverage reporting. |
| `packages/mcp/common` | internal library | No standalone test project; covered transitively through the `packages/mcp` workspace suite. |
| `packages/mcp/crm` | production deliverable | Tested via the `packages/mcp` workspace suite instead of a nested workspace package. |
| `packages/mcp/ground-truth` | production deliverable | Tested via the `packages/mcp` workspace suite instead of a nested workspace package. |
| `packages/mcp/ground-truth/examples` | example | Usage examples are documentation artifacts and are excluded from the root Vitest workspace. |

### CI guard

`node scripts/ci/check-vitest-workspace-packages.mjs` fails CI when a workspace package gains test files but is absent from the root Vitest workspace, or when a registered workspace package is missing a package-local `vitest.config.ts`.

## Scope

**In scope:**
- Upgrade wf-1..5 Playwright specs to assert real backend execution and DB persistence
- Extend `tests/matrix/infra-mode.matrix.ts` to cover 4 Kafka × streaming combinations
- Add 5 new chaos test files covering the missing failure scenarios
- Consolidate duplicate/overlapping test files identified during the refactor
- Update CI lanes to run the new suites at the correct trigger points

**Out of scope:**
- New agent logic or backend features
- Performance/load testing changes (locustfile.py, agent-benchmarks)
- Accessibility suite changes
- i18n/localization tests

---

## Requirements

### R1 — WF-1..5: Real Backend + DB Persistence Assertions

**Current state:** `tests/e2e/helpers/session-assertions.ts` seeds state into `localStorage` directly via `page.evaluate`. `db-assertions.ts` only checks that the API returns a non-5xx status and that the response body contains the `runId` or `workflowDefinitionId` string. No DB row is verified.

**Required state:**

Each wf-N spec must assert across four planes after execution:

| Plane | Assertion |
|---|---|
| Backend execution | API response contains `run_id`, `status: "completed"` (or `"queued"` for async), and `organization_id` |
| DB persistence | A row exists in the relevant table (`workflow_runs`, `hypothesis_outputs`, `financial_model_snapshots`, `workflow_checkpoints`, `compliance_evidence`) scoped to the test `organization_id` |
| UI correctness | The UI displays the persisted value, not a placeholder or mock |
| Reload durability | After `page.reload()`, the same value is visible and matches the DB row |

**Per-workflow DB table targets:**

| Workflow | DB table | Key column | Pre-assertion step |
|---|---|---|---|
| WF-1 (opportunity discovery) | `hypothesis_outputs` | `organization_id`, `run_id` | — |
| WF-2 (async queue) | `workflow_runs` | `organization_id`, `run_id`, `status` | — |
| WF-3 (human checkpoint) | `workflow_checkpoints` | `execution_id`, `status: "approved"` | `POST /api/checkpoints/:checkpointId/approve` using `checkpointId` from execution response |
| WF-4 (financial model) | `financial_model_snapshots` | `case_id`, `snapshot_version` | — |
| WF-5 (integrity veto) | `workflow_runs` | `run_id`, `status: "vetoed"` | — |

**WF-3 execution sequence (differs from the standard four-plane sequence):**

1. Submit workflow via API → receive `execution_id` + `checkpointId` in response
2. Assert backend execution response contains `status: "pending_approval"`
3. Trigger approval: `POST /api/checkpoints/:checkpointId/approve`
4. Assert DB row in `workflow_checkpoints` has `status: "approved"` (with polling — see `db-query.ts` spec below)
5. Assert UI displays approved state
6. Assert reload durability

**Implementation approach:**

1. Add a `db-query.ts` helper to `tests/e2e/helpers/` that accepts a Supabase service-role client (injected via `playwright.config.ts` global setup) and queries a table with `organization_id` + `run_id` filters. The helper must expose a `pollForRow` function with configurable interval (default 500ms) and timeout (default 5000ms) to account for async persistence latency. Single-shot queries are not permitted in E2E DB assertions. Error messages must include the table name, filter, and elapsed time for diagnostics.

   ```typescript
   export async function pollForRow(
     supabase: SupabaseClient,
     table: string,
     filter: Record<string, string>,
     options?: { intervalMs?: number; timeoutMs?: number }
   ): Promise<Record<string, unknown>>
   ```

2. Replace the `assertWorkflowPersistenceBoundary` stub in `db-assertions.ts` with a real DB assertion using `pollForRow`.

3. Remove `assertSessionSeeded` from `executeWorkflowFixture`. Add `assertBackendHasRecord(response, runId)` as a post-submission step that validates the API response body contains the submitted `runId` and a non-error `status`. The updated call sequence is:

   ```
   1. page.goto(workflow.route)
   2. Generate runId
   3. runWorkflowRequest(request, workflow, runId)   ← submit first
   4. assertBackendHasRecord(response, runId)        ← replaces assertSessionSeeded
   5. assertDBPersistence(runId, workflow)           ← polls DB via pollForRow
   6. assertUIMatchesDB(page, workflow, dbRow)       ← final step, after DB resolves
   7. reloadAndAssertWorkflowSnapshot(page, ...)
   ```

   `assertSessionSeeded` is removed entirely. `session-assertions.ts` can be deleted or repurposed for other session-level assertions unrelated to localStorage seeding.

4. Add an `assertUIMatchesDB` helper that compares the value visible in the page against the DB row value. This must be called only after `pollForRow` resolves — it is the final assertion step.

5. Update each `wf-N.spec.ts` to call the new sequence. For WF-3, insert the approval trigger step between steps 4 and 5 (see WF-3 execution sequence above).

**Environment requirements:** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` must be available in the `critical-workflows-gate` CI lane (already present in the `tenant-isolation-gate` lane — replicate the env block).

---

### R2 — Infra-Mode Matrix: Kafka × Streaming Combinations

**Current state:** `tests/matrix/infra-mode.matrix.ts` defines three modes: `local`, `docker`, `supabase`. These cover deployment topology only.

**Required state:** Add a second dimension — messaging topology — producing 4 combinations:

| ID | Kafka | Streaming | Env vars |
|---|---|---|---|
| `kafka-on-stream-on` | enabled | enabled | `KAFKA_ENABLED=true`, `STREAMING_ENABLED=true` |
| `kafka-on-stream-off` | enabled | disabled | `KAFKA_ENABLED=true`, `STREAMING_ENABLED=false` |
| `kafka-off-stream-on` | disabled | enabled | `KAFKA_ENABLED=false`, `STREAMING_ENABLED=true` |
| `kafka-off-stream-off` | disabled | disabled | `KAFKA_ENABLED=false`, `STREAMING_ENABLED=false` |

**Required assertions per combination:**

- When `KAFKA_ENABLED=false`: `isKafkaEnabled()` returns `false`. Assertions are split by endpoint type because `api/agents.ts` implements a synchronous fallback for the primary invocation path:

  | Endpoint | Expected behavior |
  |---|---|
  | `POST /agents/:agentId/invoke` | `200` + synchronous execution result + `run_id` in response body (sync fallback path) |
  | `GET /jobs/:jobId` | `503` with `{ error: { code: "KAFKA_DISABLED" } }` |
  | `GET /jobs/:jobId/stream` | `503` with `{ error: { code: "KAFKA_DISABLED" } }` |
  | `POST /agents/:agentId/sessions/:sessionId/invoke` | `503` with `{ error: { code: "KAFKA_DISABLED" } }` |

  UI must not display "live" or "streaming" status in any kafka-off combination.

- When `STREAMING_ENABLED=false`: SSE/WebSocket endpoints return `404` or `501`; UI does not claim streaming is active.
- When both disabled: `POST /agents/:agentId/invoke` still produces a durable completion record via the synchronous fallback path.
- `trace_id` and `correlation_id` are present in response headers regardless of mode.

**Implementation approach:**

1. Add `MessagingMode` type and `messagingModeMatrix` array to `tests/matrix/infra-mode.matrix.ts` (or a new `tests/matrix/messaging-mode.matrix.ts`).
2. Add `runInMessagingMode` utility parallel to `runInInfraMode`.
3. Add `tests/matrix/messaging-mode.pilot.test.ts` with the four-combination matrix.
4. Add `tests/matrix/kafka-streaming-combinations.test.ts` with the full assertion suite.
5. Wire into the `nightly-matrix-chaos-replay` CI lane under the `matrix` suite.

---

### R3 — Chaos Suite: Five Missing Failure Scenarios

**Current state:** `tests/chaos/agent-layer-chaos.test.ts` covers Redis disconnection, Kafka broker failure, agent execution timeout, and circuit-breaker overload.

**Missing scenarios (from risk model):**

| File | Scenario | Success criteria |
|---|---|---|
| `tests/chaos/llm-provider-outage.test.ts` | LLM timeout + provider outage | Circuit breaker opens; user sees degraded state; no phantom completion; audit log contains `trace_id` |
| `tests/chaos/db-transient-outage.test.ts` | Database transient outage during workflow | Workflow state remains consistent; retry is idempotent; no duplicate records on recovery |
| `tests/chaos/queue-outage.test.ts` | Queue outage + delayed consumer | Job enters DLQ; UI shows accurate queued/failed state; retry bounded |
| `tests/chaos/crm-billing-failure.test.ts` | CRM/billing API failure | Integration error is isolated; core workflow unaffected; error logged with `trace_id` |
| `tests/chaos/partial-execution-recovery.test.ts` | Partial execution then recovery | Saga compensation fires; no partial output shown as final; workflow resumes from last checkpoint |

**Each chaos test file must:**
- Mock the failing dependency at the module boundary (consistent with `agent-layer-chaos.test.ts` pattern using `vi.mock`)
- Assert the user-visible error state is accurate (not a success state)
- Assert retry count is bounded (no infinite retry loops)
- Assert audit/error logs contain `trace_id` and `organization_id`
- Assert workflow state in the in-memory or mocked store is consistent after recovery

**Wire into CI:** Add all five files to the `chaos` suite in `nightly-matrix-chaos-replay`.

---

### R4 — Consolidation: Remove Duplicate and Overlapping Tests

During exploration, the following overlaps were identified. Consolidation reduces maintenance surface and eliminates contradictory assertions.

| Duplicate pair | Action |
|---|---|
| `packages/backend/src/runtime/artifact-composer/artifact-composer.test.ts` and `__tests__/ArtifactComposer.test.ts` | Merge into `__tests__/ArtifactComposer.test.ts`; delete root-level file |
| `packages/backend/src/runtime/execution-runtime/execution-runtime.test.ts` | Move to `execution-runtime/__tests__/ExecutionRuntime.test.ts`; create `__tests__/` directory; update relative imports |
| `packages/backend/src/runtime/execution-runtime/workflow-executor.test.ts` | Move to `execution-runtime/__tests__/WorkflowExecutor.test.ts`; update relative imports. These two files test different classes (`QueryExecutor`/`ExecutionRuntime` vs `WorkflowExecutor`) — do not merge |
| `packages/backend/src/runtime/policy-engine/policy-engine.test.ts` and `__tests__/PolicyEngine.test.ts` | Merge into `__tests__/PolicyEngine.test.ts`; delete root-level file |
| `packages/backend/src/runtime/context-store/context-store.test.ts` and `__tests__/ContextStore.test.ts` | Merge into `__tests__/ContextStore.test.ts`; delete root-level file |
| `tests/integration/rls_isolation.integration.test.ts` and `tests/integration/rls_leak.test.ts` | Merge into `tests/security/rls-tenant-isolation.test.ts` (already the canonical location per CI lane config) |

**Rule going forward:** Runtime service tests live in `packages/backend/src/runtime/<service>/__tests__/<ServiceName>.test.ts`. Root-level `*.test.ts` files in runtime service directories are not permitted.

---

### R5 — CI Lane Updates

| Lane | Change |
|---|---|
| `critical-workflows-gate` | Add `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` env block (mirror from `tenant-isolation-gate`) |
| `nightly-matrix-chaos-replay` (matrix suite) | Add `tests/matrix/messaging-mode.pilot.test.ts` and `tests/matrix/kafka-streaming-combinations.test.ts` |
| `nightly-matrix-chaos-replay` (chaos suite) | Add the 5 new chaos test files to `launch-chaos-smoke.mjs` or directly to the vitest run command |
| `unit-component-schema` | Add a guard step: `node scripts/ci/check-runtime-test-placement.mjs` to enforce R4's naming rule |

---

## Acceptance Criteria

### WF-1..5 (R1)
- [ ] `db-query.ts` exposes `pollForRow` with 500ms interval and 5000ms timeout defaults
- [ ] Each wf-N spec submits the workflow before any DB or session assertion
- [ ] Each spec uses `pollForRow` to assert the DB row exists before the UI assertion
- [ ] Each spec asserts the UI value matches the DB row value (`assertUIMatchesDB` is the final step)
- [ ] Each spec asserts the same value is visible after `page.reload()`
- [ ] `assertSessionSeeded` is removed from `executeWorkflowFixture`; replaced by `assertBackendHasRecord`
- [ ] WF-3 spec includes `POST /api/checkpoints/:checkpointId/approve` between backend execution and DB assertion
- [ ] All 5 specs pass in `critical-workflows-gate` with real Supabase credentials

### Infra-mode matrix (R2)
- [ ] `messagingModeMatrix` exports 4 entries with correct env var combinations
- [ ] `kafka-off` combination: `POST /agents/:agentId/invoke` returns `200` with synchronous execution result and `run_id`
- [ ] `kafka-off` combination: `/jobs/*` and session invocation endpoints return `503` with `code: "KAFKA_DISABLED"`
- [ ] `kafka-off-stream-off` combination: `POST /agents/:agentId/invoke` produces a durable completion record via synchronous fallback
- [ ] `streaming-off` combination: SSE/WS endpoints return non-2xx; UI does not claim streaming active
- [ ] All 4 combinations pass in `nightly-matrix-chaos-replay` matrix suite

### Chaos (R3)
- [ ] Each of the 5 new chaos files exists and passes in isolation (`vitest run <file>`)
- [ ] Each file asserts: accurate degraded state, bounded retries, `trace_id` in logs, consistent workflow state
- [ ] All 5 files are included in the nightly chaos suite

### Consolidation (R4)
- [ ] No root-level `*.test.ts` files remain in `packages/backend/src/runtime/*/` directories
- [ ] `execution-runtime/__tests__/ExecutionRuntime.test.ts` and `execution-runtime/__tests__/WorkflowExecutor.test.ts` exist (moved from root)
- [ ] `tests/integration/rls_isolation.integration.test.ts` and `rls_leak.test.ts` are removed; coverage absorbed into `tests/security/rls-tenant-isolation.test.ts`
- [ ] `pnpm test` passes after consolidation with no regressions

### CI (R5)
- [ ] `critical-workflows-gate` has Supabase env vars and wf-1..5 pass
- [ ] Nightly matrix lane includes messaging-mode tests
- [ ] Nightly chaos lane includes all 5 new chaos files

---

## Implementation Order

Steps are sequenced by dependency. Each step is independently mergeable.

1. **Consolidate duplicate runtime service tests (R4)** — no new logic, reduces noise before adding new tests
2. **Add `db-query.ts` helper and upgrade `db-assertions.ts` (R1 infrastructure)** — shared helper needed by all wf-N specs
3. **Upgrade `session-assertions.ts` to read from API (R1)** — prerequisite for wf-N specs
4. **Upgrade wf-1 and wf-2 specs (R1)** — opportunity discovery + async queue (simplest DB shapes)
5. **Upgrade wf-3, wf-4, wf-5 specs (R1)** — checkpoint, financial model, veto (more complex DB shapes)
6. **Add Supabase env block to `critical-workflows-gate` CI lane (R5-a)**
7. **Add `messagingModeMatrix` and `runInMessagingMode` (R2 infrastructure)**
8. **Add `messaging-mode.pilot.test.ts` and `kafka-streaming-combinations.test.ts` (R2)**
9. **Wire messaging matrix into nightly CI lane (R5-b)**
10. **Add `llm-provider-outage.test.ts` and `db-transient-outage.test.ts` (R3)**
11. **Add `queue-outage.test.ts`, `crm-billing-failure.test.ts`, `partial-execution-recovery.test.ts` (R3)**
12. **Wire chaos files into nightly CI lane (R5-c)**
13. **Add `check-runtime-test-placement.mjs` guard to unit-component-schema lane (R5-d)**

---

## Key File Map

| File | Role |
|---|---|
| `tests/e2e/helpers/db-query.ts` | New — Supabase query helper with `pollForRow` (500ms/5000ms defaults) |
| `tests/e2e/helpers/db-assertions.ts` | Upgrade — replace stub with real DB assertion using `pollForRow` |
| `tests/e2e/helpers/session-assertions.ts` | Remove or repurpose — `assertSessionSeeded` deleted; replaced by `assertBackendHasRecord` |
| `tests/e2e/workflows/wf-1.spec.ts` .. `wf-5.spec.ts` | Upgrade — four-plane assertions |
| `tests/matrix/infra-mode.matrix.ts` | Extend — add `messagingModeMatrix` |
| `tests/matrix/messaging-mode.pilot.test.ts` | New |
| `tests/matrix/kafka-streaming-combinations.test.ts` | New |
| `tests/chaos/llm-provider-outage.test.ts` | New |
| `tests/chaos/db-transient-outage.test.ts` | New |
| `tests/chaos/queue-outage.test.ts` | New |
| `tests/chaos/crm-billing-failure.test.ts` | New |
| `tests/chaos/partial-execution-recovery.test.ts` | New |
| `scripts/ci/check-runtime-test-placement.mjs` | New — CI guard for R4 naming rule |
| `.github/workflows/ci.yml` | Update — env vars + new suite entries |

---

## Definition of Done

This work is complete when:

- All 5 wf-N specs pass in `critical-workflows-gate` with real Supabase credentials and four-plane assertions
- The messaging-mode matrix runs 4 combinations in nightly CI with all assertions passing
- All 5 new chaos files pass in nightly CI
- No root-level `*.test.ts` files remain in runtime service directories
- `pnpm test` passes with no regressions
- Coverage thresholds in `vitest` config are not reduced
